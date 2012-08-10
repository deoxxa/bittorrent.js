//
// TCP protocol producer
//
// See [theory.org](http://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29)
// for more information.
//

var stream = require("stream"),
    util = require("util");

//
// This is the main object. It's a [`ReadableStream`](http://nodejs.org/docs/latest/api/all.html#all_readable_stream),
// so you can `.pipe()` from it. It has a bunch of methods for creating messages
// based on the names of those messages.
//

var TCPProtocolProducer = module.exports = function TCPProtocolProducer() {
  this.readable = true;
}

util.inherits(TCPProtocolProducer, stream.Stream);

TCPProtocolProducer.prototype.handshake = function(protocol_string, reserved, info_hash, peer_id) {
  this.emit("data", Buffer.concat([
    Buffer([protocol_string.length]),
    Buffer(protocol_string),
    reserved,
    Buffer.isBuffer(info_hash) ? info_hash : Buffer(info_hash, "hex"),
  ], 1 + protocol_string.length + 8 + 20));
};

TCPProtocolProducer.prototype.peer_id = function(peer_id) {
  this.emit("data", Buffer.isBuffer(peer_id) ? peer_id : Buffer(peer_id));
};

TCPProtocolProducer.prototype.keep_alive = function() {
  this.emit("data", Buffer([0x00, 0x00, 0x00, 0x00]));
};

TCPProtocolProducer.prototype.choked = function() {
  this.emit("data", Buffer([0x00, 0x00, 0x00, 0x01, 0x00]));
};

TCPProtocolProducer.prototype.unchoked = function() {
  this.emit("data", Buffer([0x00, 0x00, 0x00, 0x01, 0x01]));
};

TCPProtocolProducer.prototype.interested = function() {
  this.emit("data", Buffer([0x00, 0x00, 0x00, 0x01, 0x02]));
};

TCPProtocolProducer.prototype.uninterested = function() {
  this.emit("data", Buffer([0x00, 0x00, 0x00, 0x01, 0x03]));
};

TCPProtocolProducer.prototype.have = function(index) {
  var b = Buffer([0x00, 0x00, 0x00, 0x05, 0x04, 0x00, 0x00, 0x00, 0x00]);

  b.writeUInt32BE(5, index);

  this.emit("data", b);
};

TCPProtocolProducer.prototype.bitfield = function(bitfield) {
  this.emit("data", Buffer.concat([
    Buffer([0x00, 0x00, 0x00, 0x01 + bitfield.length, 0x05]),
    bitfield,
  ], 5 + bitfield.length));
};

TCPProtocolProducer.prototype.request = function(index, begin, length) {
  var b = Buffer([0x00, 0x00, 0x00, 0x0d, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

  b.writeUInt32BE(5, index);
  b.writeUInt32BE(9, begin);
  b.writeUInt32BE(14, length);

  this.emit("data", b);
};

TCPProtocolProducer.prototype.block = function(index, begin, block) {
  var b = Buffer.concat([
    Buffer([0x00, 0x00, 0x00, 0x09 + block.length, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
    block,
  ], 13 + block.length);

  b.writeUInt32BE(5, index);
  b.writeUInt32BE(9, begin);
  b.writeUInt32BE(14, length);

  this.emit("data", b);
};

TCPProtocolProducer.prototype.cancel = function(index, begin, length) {
  var b = Buffer([0x00, 0x00, 0x00, 0x0d, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

  b.writeUInt32BE(5, index);
  b.writeUInt32BE(9, begin);
  b.writeUInt32BE(14, length);

  this.emit("data", b);
};

TCPProtocolProducer.prototype.port = function(port) {
  var b = Buffer([0x00, 0x00, 0x00, 0x05, 0x09, 0x00, 0x00, 0x00, 0x00]);

  b.writeUInt32BE(5, port);

  this.emit("data", b);
};
