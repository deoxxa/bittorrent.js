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

  this.infoHash = options.infoHash || null;
  this.torrent = options.torrent || null;
  this.length = options.length || null;
  this.pieceCount = options.pieceCount || null;
  this.pieceLength = options.pieceLength || null;
  this.bitfield = options.bitfield || null;
  this.storage = options.storage || null;

  this.connections = [];
};
TorrentSession.prototype = Object.create(events.EventEmitter.prototype, {constructor: {value: TorrentSession}});

TorrentSession.prototype.loadFromObject = function loadFromObject(torrent, done) {
  if (typeof torrent.info !== "object" || torrent.info === null) {
    return done(Error("info key is missing"));
  }

  if (!torrent.info.pieces || !Buffer.isBuffer(torrent.info.pieces)) {
    return done(Error("pieces key is missing or invalid"));
  }

  this.torrent = torrent;
  this.length = torrent.info.length;
  this.pieceCount = torrent.info.pieces.length / 20;
  this.pieceLength = torrent.info["piece length"];
  this.bitfield = new Bitfield(Math.ceil(this.pieceCount / 8));

  this.pieceHashes = [];
  for (var i=0;i<this.pieceCount;++i) {
    this.pieceHashes[i] = torrent.info.pieces.slice(i * 20, i * 20 + 20);
  }

  var liberator = new bencode.Liberator(),
      encoder = new bencode.Encoder();

  var self = this;
  liberator.on("error", done).pipe(encoder).on("error", done).pipe(crypto.createHash("sha1")).on("error", done).on("data", function(infoHash) {
    self.setInfoHash(infoHash);

    self.emit("torrent", torrent);

    return done();
  });

  liberator.end(torrent.info);
};

TorrentSession.prototype.setInfoHash = function setInfoHash(infoHash) {
  this.infoHash = infoHash;

  this.emit("infoHash", infoHash);
};

TorrentSession.prototype.setStorage = function setStorage(storage) {
  this.storage = storage;
  this.bitfield = storage.getBitfield();
};

TorrentSession.prototype.connectTo = function connectTo(options, done) {
  var _done = done;

  var calledDone = false;
  done = function done() {
    if (calledDone) { return; } else { calledDone = true; }
    return _done.apply(null, arguments);
  };

  var self = this;

  var connection = new BitTorrent.Protocol.TCP.Connection({
    infoHash: this.infoHash || null,
  });

  var socket = net.connect(51413, "127.0.0.1");

  socket.on("error", done).pipe(connection).on("error", done).pipe(socket);

  connection.handshake();

  connection.on("infoHash", function(infoHash) {
    console.log("infoHash", infoHash);
  });

  connection.on("peerId", function(peerId) {
    console.log("peerId", peerId);
  });

  connection.on("bitfield", function(bitfield) {
    console.log("bitfield", bitfield);

    return done(null, connection);

    connection.bitfield(self.bitfield.toBuffer()).interested();
  });

  connection.on("choked", function() {
    console.log("choked");
  });

  connection.on("unchoked", function() {
    console.log("unchoked");
  });

  connection.on("interested", function() {
    console.log("interested");
  });

  connection.on("notInterested", function() {
    console.log("notInterested");
  });

  connection.on("piece", function(piece) {
    console.log(piece);
  });
};

var session = new TorrentSession();

session.on("torrent", function(torrent) {
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

var decoder = new bencode.Decoder(),
    accumulator = new bencode.Accumulator(),
    objectifier = new bencode.Objectifier();

fs.createReadStream("./random.torrent").pipe(decoder).pipe(accumulator).pipe(objectifier).on("data", function(torrent) {
  session.loadFromObject(torrent, function(err) {
    if (err) {
      return console.warn(err);
    }

    /*
    session.connectTo({host: "127.0.0.1", port: 51413}, function(err, connection) {
      if (err) {
        return console.warn(err);
      }

      console.log("connected");
    });
    */

    console.log(session);
  });
});
