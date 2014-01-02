var Bitfield = require("opaque-bitfield"),
    crypto = require("crypto"),
    stream = require("stream");

var Connection = module.exports = function Connection(options) {
  options = options || {};

  stream.Transform.call(this, options);

  var self = this;

  this._btParser = new this.Parser(options.parser);
  this._btSerialiser = new this.Serialiser(options.serialiser);

  this._btInfoHash = null;
  this._btLocalPeerId = null;
  this._btLocalChoked = true;
  this._btLocalInterested = false;
  this._btLocalRequests = [];
  this._btRemotePeerId = null;
  this._btRemoteChoked = true;
  this._btRemoteInterested = false;
  this._btRemoteRequests = [];
  this._btRemoteBitfield = new Bitfield();

  if (options.infoHash) {
    this._btInfoHash = options.infoHash;

    if (typeof this._btInfoHash === "string") {
      this._btInfoHash = Buffer(this._btInfoHash, "hex");
    }
  }

  if (this._btInfoHash && this._btInfoHash.length !== 20) {
    throw new Error("infoHash must be 20 bytes");
  }

  if (options.peerId) {
    this._btLocalPeerId = options.peerId;

    if (typeof this._btLocalPeerId === "string") {
      this._btLocalPeerId = Buffer(this._btLocalPeerId);
    }
  }

  if (!this._btLocalPeerId) {
    this._btLocalPeerId = Buffer.concat([
      Buffer("BT.JS-"),
      Buffer(crypto.randomBytes(7).toString("hex")),
    ]);
  }

  if (this._btLocalPeerId.length !== 20) {
    throw new Error("peerId must be 20 bytes");
  }

  var recvTimeoutCallback = function recvTimeoutCallback() {
    self.emit("timeout");

    return self._btParser.end();
  };
  var sendTimeoutCallback = function sendTimeoutCallback() {
    self._btSerialiser.keepAlive();
  };

  this._btRecvTimeout = setTimeout(recvTimeoutCallback, 300 * 1000);
  this._btSendTimeout = null;

  this._btParser.on("data", function onParserData(message) {
    console.log("<", "received message", message);

    if (self._btRecvTimeout) {
      clearTimeout(self._btRecvTimeout);
      self._btRecvTimeout = setTimeout(recvTimeoutCallback, 300 * 1000);
    }

    if (message.type === "handshake") {
      self._btInfoHash = message.infoHash;

      self.emit("infoHash", self._btInfoHash);
    }

    if (message.type === "peerId") {
      self._btRemotePeerId = message.peerId;

      self.emit("peerId", self._btRemotePeerId);
    }

    if (message.type === "bitfield") {
      self._btRemoteBitfield = new Bitfield(message.bitfield);

      self.emit("bitfield", self._btRemoteBitfield);
    }

    if (message.type === "choked") {
      self._btRemoteChoked = true;

      self.emit("choked");
    }

    if (message.type === "unchoked") {
      self._btRemoteChoked = false;

      self.emit("unchoked");
    }

    if (message.type === "interested") {
      self._btRemoteInterested = true;

      self.emit("interested");
    }

    if (message.type === "notInterested") {
      self._btRemoteInterested = false;

      self.emit("notInterested");
    }

    if (message.type === "have") {
      self._btRemoteBitfield.set(message.index, true);

      self.emit("have", message.index);
    }

    if (message.type === "piece") {
      for (var i=0;i<self._btLocalRequests.length;++i) {
        if (self._btLocalRequests[i].index === message.index && self._btLocalRequests[i].begin === message.begin && self._btLocalRequests[i].length === message.piece.length) {
          self._btLocalRequests.splice(i, 1);
        }
      }

      self.emit("piece", message);
    }
  });

  this._btSerialiser.on("data", function onSerialiserData(chunk) {
    console.log(">", "sending data", chunk);

    self.push(chunk);

    if (self._btSendTimeout) {
      clearTimeout(self._btSendTimeout);
    }

    self._btSendTimeout = setTimeout(function onSendTimeout() {
      self._btSerialiser.keepAlive();
    }, 30 * 1000);
  });
};
Connection.prototype = Object.create(stream.Transform.prototype, {constructor: {value: Connection}});

Connection.prototype._transform = function _transform(input, encoding, done) {
  return this._btParser.write(input, encoding, done);
};

Connection.prototype._flush = function _flush(done) {
  var counter = 2;
  var fn = function() {
    counter--;

    if (counter === 0) {
      return done();
    }
  };

  this._btParser.end(fn);
  this._btSerialiser.end(fn);
};

Connection.prototype.getRemotePeerId = function getRemotePeerId() {
  return this._btRemotePeerId;
};

Connection.prototype.handshake = function handshake() {
  this._btSerialiser.handshake({
    protocol: Buffer("BitTorrent protocol"),
    reserved: Buffer([0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00]),
    infoHash: this._btInfoHash,
  }).peerId({
    peerId: this._btLocalPeerId,
  });

  return this;
};

Connection.prototype.bitfield = function bitfield(bitfield) {
  this._btSerialiser.bitfield({
    bitfield: bitfield.toBuffer(),
  });

  return this;
};

Connection.prototype.choke = function choke() {
  this._btSerialiser.choke();
  this._btLocalChoked = true;
  return this;
};

Connection.prototype.unchoke = function unchoke() {
  this._btSerialiser.unchoke();
  this._btLocalChoked = false;
  return this;
};

Connection.prototype.interested = function interested() {
  this._btSerialiser.interested();
  this._btLocalChoked = true;
  return this;
};

Connection.prototype.notInterested = function notInterested() {
  this._btSerialiser.notInterested();
  this._btLocalChoked = false;
  return this;
};

Connection.prototype.request = function request(index, begin, length) {
  var request = {
    index: index,
    begin: begin,
    length: length,
  };

  this._btLocalRequests.push(request);
  this._btSerialiser.request(request);

  return this;
};

Connection.prototype.cancel = function cancel(index, begin, length) {
  for (var i=0;i<this._btLocalRequests.length;++i) {
    if (this._btLocalRequests[i].index === index && this._btLocalRequests[i].begin === begin && this._btLocalRequests[i].length === length) {
      this._btSerialiser.cancel(this._btLocalRequests[i]);
      this._btLocalRequests.splice(i, 1);

      i -= 1;
    }
  }

  return this;
};

Connection.prototype.sendPiece = function sendPiece(index, begin, block) {
  this._btSerialiser.piece({
    index: index,
    begin: begin,
    block: block,
  });

  return this;
};