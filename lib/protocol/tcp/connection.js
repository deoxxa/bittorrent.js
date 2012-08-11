var net = require("net"),
    events = require("events"),
    util = require("util");

var Stream = require("./stream");

var Connection = module.exports = function Connection(info_hash, host, port) {
  this.info_hash = info_hash;
  this.host = host;
  this.port = port;

  this.local_choked = null;
  this.local_interested = null;
  this.remote_choked = null;
  this.remote_interested = null;

  this.socket = net.createConnection(this.port, this.host);
  this.stream = new Stream();

  this.socket.pipe(this.stream);
  this.stream.pipe(this.socket);

  this.stream.on("keep_alive", this.emit.bind(this, "keep_alive"));
  this.stream.on("handshake", this.emit.bind(this, "handshake"));
  this.stream.on("peer_id", this.emit.bind(this, "peer_id"));
  this.stream.on("bitfield", this.emit.bind(this, "bitfield"));
  this.stream.on("message", this.emit.bind(this, "message"));

  this.stream.on("choked", function() {
    this.remote_choked = true;
    this.emit("choked");
  }.bind(this));

  this.stream.on("unchoked", function() {
    this.remote_choked = false;
    this.emit("unchoked");
  }.bind(this));

  this.stream.on("interested", function() {
    this.remote_interested = true;
    this.emit("interested");
  }.bind(this));

  this.stream.on("uninterested", function() {
    this.remote_interested = false;
    this.emit("uninterested");
  }.bind(this));

  this.keep_alive_timeout = null;
  this.socket.on("connect", function() {
    this.stream.handshake("BitTorrent protocol", Buffer([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), this.info_hash);
    this.stream.peer_id("BTJS0000-00000000000");
    this.stream.once("handshake", function() { this.emit("connect"); }.bind(this));
    this.keep_alive_timeout = setInterval(this.stream.keep_alive.bind(this.stream), 600000);
  }.bind(this));
}

util.inherits(Connection, events.EventEmitter);

Connection.prototype.choke = function() {
  if (!this.local_choked) {
    this.local_choked = true;
    this.stream.choked();
  }
};

Connection.prototype.unchoke = function() {
  if (!this.local_unchoked) {
    this.local_choked = false;
    this.stream.unchoked();
  }
};

Connection.prototype.interested = function() {
  if (!this.local_interested) {
    this.local_interested = true;
    this.stream.interested();
  }
};

Connection.prototype.uninterested = function() {
  if (!this.local_uninterested) {
    this.local_interested = false;
    this.stream.uninterested();
  }
};
