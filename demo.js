#!/usr/bin/env node

var bencode = require("bencode-stream"),
    Bitfield = require("opaque-bitfield"),
    crypto = require("crypto"),
    events = require("events"),
    fs = require("fs"),
    net = require("net"),
    BitTorrent = require("./bittorrent");

var TorrentSession = function TorrentSession(options) {
  options = options || {};

  events.EventEmitter.call(this, options);

  if (options.peerId) {
    this.setPeerId(options.peerId);
  }

  if (options.infoHash) {
    this.setInfoHash(options.infoHash);
  }

  if (options.metainfo) {
    this.loadFromObject(options.metainfo);
  }

  if (options.storage) {
    this.setStorage(options.storage);
  }

  this.connections = [];
  this.requests = [];
};
TorrentSession.prototype = Object.create(events.EventEmitter.prototype, {constructor: {value: TorrentSession}});

TorrentSession.prototype.loadFromObject = function loadFromObject(torrent, done) {
  if (typeof torrent.info !== "object" || torrent.info === null) {
    return done(Error("info key is missing"));
  }

  if (!torrent.info.pieces || !Buffer.isBuffer(torrent.info.pieces)) {
    return done(Error("pieces key is missing or invalid"));
  }

  this.metainfo = torrent;
  this.length = torrent.info.length;
  this.pieceCount = torrent.info.pieces.length / 20;
  this.pieceLength = torrent.info["piece length"];

  this.pieceHashes = [];
  for (var i=0;i<this.pieceCount;++i) {
    this.pieceHashes[i] = torrent.info.pieces.slice(i * 20, i * 20 + 20);
  }

  var liberator = new bencode.Liberator(),
      encoder = new bencode.Encoder();

  var self = this;
  liberator.on("error", done).pipe(encoder).on("error", done).pipe(crypto.createHash("sha1")).on("error", done).on("data", function(infoHash) {
    self.setInfoHash(infoHash);

    self.emit("metadata", torrent);

    return done();
  });

  liberator.end(torrent.info);
};

TorrentSession.prototype.setPeerId = function setPeerId(peerId) {
  if (typeof peerId === "string") {
    peerId = Buffer(peerId);
  }

  this.peerId = peerId;

  this.emit("peerId", peerId);
};

TorrentSession.prototype.setInfoHash = function setInfoHash(infoHash) {
  if (typeof infoHash === "string") {
    infoHash = Buffer(infoHash, "hex");
  }

  this.infoHash = infoHash;

  this.emit("infoHash", infoHash);
};

TorrentSession.prototype.setStorage = function setStorage(storage) {
  this.storage = storage;
  this.bitfield = storage.getBitfield();

  this.emit("storage", storage);
};

TorrentSession.prototype.addConnection = function addConnection(connection, done) {
  this.connections.push(connection);

  connection.on("bitfield", function(bitfield) {
    console.log("%s: bitfield %s", connection.getRemotePeerId(), bitfield.toBuffer().toString("hex"));
  });

  connection.on("choked", function() {
    console.log("%s: choked", connection.getRemotePeerId());
  });

  connection.on("unchoked", function() {
    console.log("%s: unchoked", connection.getRemotePeerId());
  });

  connection.on("interested", function() {
    console.log("%s: interested", connection.getRemotePeerId());
  });

  connection.on("notInterested", function() {
    console.log("%s: notInterested", connection.getRemotePeerId());
  });

  connection.on("piece", function(piece) {
    console.log("%s: piece %d (%d @ %d)", connection.getRemotePeerId(), piece.index, piece.piece.length, piece.offset);
  });

  this.emit("connection", connection);
};

TorrentSession.prototype.connectTo = function connectTo(options, cb) {
  var _cb = cb;

  var called = false;
  cb = function cb() {
    if (called) { return; } else { called = true; }
    return _cb.apply(null, arguments);
  };

  var self = this;

  var connection = new BitTorrent.Protocol.TCP.Connection({
    infoHash: this.infoHash || null,
    peerId: this.peerId || null,
  });

  var socket = net.connect(51413, "127.0.0.1");

  socket.on("error", cb).pipe(connection).on("error", cb).pipe(socket);

  connection.handshake();

  connection.on("infoHash", function(infoHash) {
    if (infoHash.toString("hex") !== self.infoHash.toString("hex")) {
      connection.end();

      return cb(Error("infoHash from other client didn't match"));
    }
  });

  connection.on("peerId", function(peerId) {
    return self.addConnection(connection, cb);
  });
};

var session = new TorrentSession({
  peerId: "BT.JS-" + crypto.randomBytes(7).toString("hex"),
});

session.on("metadata", function(torrent) {
  var storage = new BitTorrent.Storage.File({
    filename: "./something",
    length: session.length,
    pieceHashes: session.pieceHashes,
    pieceCount: session.pieceCount,
    pieceLength: session.pieceLength,
  });

  storage.initialise(function(err) {
    if (err) {
      return console.warn(err);
    }

    storage.fullHashCheck(function(err) {
      if (err) {
        return console.warn(err);
      }

      session.setStorage(storage);
    });
  });
});

session.on("storage", function() {
  console.log("session for torrent %s ready", session.infoHash.toString("hex"));

  session.connectTo({host: "127.0.0.1", port: 51413}, function(err, connection) {
    if (err) {
      return console.warn(err);
    }
  });
});

session.on("connection", function(connection) {
  console.log("%s: negotiated connection", connection.getRemotePeerId());
});

var decoder = new bencode.Decoder(),
    accumulator = new bencode.Accumulator(),
    objectifier = new bencode.Objectifier();

fs.createReadStream("./random.torrent").pipe(decoder).pipe(accumulator).pipe(objectifier).on("data", function(torrent) {
  session.loadFromObject(torrent, function(err) {
    if (err) {
      return console.warn(err);
    }
  });
});
