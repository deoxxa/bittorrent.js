//
// TCP protocol serialiser
//
// See [theory.org](http://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29)
// for more information.
//

var Concentrate = require("concentrate"),
    stream = require("stream");

var TCPProtocolSerialiser = module.exports = function TCPProtocolSerialiser(options) {
  options = options || {};
  options.objectMode = true;

  stream.Transform.call(this, options);

  this._concentrate = new Concentrate();

  var self = this;
  this._concentrate.on("end", function() {
    self.end();
  });
  this._concentrate.on("data", function(chunk) {
    self.push(chunk);
  });
};
TCPProtocolSerialiser.prototype = Object.create(stream.Transform.prototype, {constructor: {value: TCPProtocolSerialiser}});

TCPProtocolSerialiser.prototype._transform = function _transform(input, encoding, done) {
  switch (input.type) {
    case "handshake": {
      this.handshake(input);
      break;
    }
    case "peerId": {
      this.peerId(input);
      break;
    }
    case "keepAlive": {
      this.keepAlive(input);
      break;
    }
    case "choked": {
      this.choked(input);
      break;
    }
    case "unchoked": {
      this.unchoked(input);
      break;
    }
    case "interested": {
      this.interested(input);
      break;
    }
    case "notInterested": {
      this.notInterested(input);
      break;
    }
    case "have": {
      this.have(input);
      break;
    }
    case "bitfield": {
      this.bitfield(input);
      break;
    }
    case "request": {
      this.request(input);
      break;
    }
    case "piece": {
      this.piece(input);
      break;
    }
    case "cancel": {
      this.cancel(input);
      break;
    }
    case "port": {
      this.port(input);
      break;
    }
    case "extended": {
      this.extended(input);
      break;
    }
    case "message": {
      this.message(input);
      break;
    }
    default: {
      return done(Error("unknown input type `" + input.type + "'"));
    }
  }

  return done();
};

TCPProtocolSerialiser.prototype._flush = function _flush(done) {
  return this._concentrate.end(done);
};

TCPProtocolSerialiser.prototype.handshake = function handshake(options) {
  this._concentrate.uint8(options.protocol.length).buffer(options.protocol).buffer(options.reserved).buffer(options.infoHash).flush();

  return this;
};

TCPProtocolSerialiser.prototype.peerId = function peerId(options) {
  this._concentrate.buffer(options.peerId).flush();

  return this;
};

TCPProtocolSerialiser.prototype.keepAlive = function keepAlive() {
  this._concentrate.buffer(Buffer([0x00, 0x00, 0x00, 0x00])).flush();

  return this;
};

TCPProtocolSerialiser.prototype.choked = function choked(options) {
  this._concentrate.uint32be(1).uint8(0).flush();

  return this;
};

TCPProtocolSerialiser.prototype.unchoked = function unchoked(options) {
  this._concentrate.uint32be(1).uint8(1).flush();

  return this;
};

TCPProtocolSerialiser.prototype.interested = function interested(options) {
  this._concentrate.uint32be(1).uint8(2).flush();

  return this;
};

TCPProtocolSerialiser.prototype.notInterested = function notInterested(options) {
  this._concentrate.uint32be(1).uint8(3).flush();

  return this;
};

TCPProtocolSerialiser.prototype.have = function have(options) {
  this._concentrate.uint32be(5).uint8(4).uint32be(options.index).flush();

  return this;
};

TCPProtocolSerialiser.prototype.bitfield = function bitfield(options) {
  this._concentrate.uint32be(options.bitfield.length + 1).uint8(5).buffer(options.bitfield).flush();

  return this;
};

TCPProtocolSerialiser.prototype.request = function request(options) {
  this._concentrate.uint32be(13).uint8(6).uint32be(options.index).uint32be(options.begin).uint32be(options.length).flush();

  return this;
};

TCPProtocolSerialiser.prototype.piece = function piece(options) {
  this._concentrate.uint32be(options.piece.length + 9).uint8(7).uint32be(options.index).uint32be(options.begin).buffer(options.piece).flush();

  return this;
};

TCPProtocolSerialiser.prototype.cancel = function cancel(options) {
  this._concentrate.uint32be(13).uint8(8).uint32be(options.index).uint32be(options.begin).uint32be(options.length).flush();

  return this;
};

TCPProtocolSerialiser.prototype.port = function port(options) {
  this._concentrate.uint32be(5).uint8(9).uint32be(options.port).flush();

  return this;
};

TCPProtocolSerialiser.prototype.extended = function extended(options) {
  this._concentrate.uint32be(options.payload.length + 6).uint8(20).uint8(options.extendedId).buffer(options.payload);

  return this;
};

TCPProtocolSerialiser.prototype.message = function message(options) {
  this._concentrate.uint32be(options.data.length + 1).uint8(options.type).buffer(options.data).flush();

  return this;
};
