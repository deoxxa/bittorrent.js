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

TCPProtocolProducer.prototype.handshake = function(protocol_string, reserved, info_hash) {
  this.emit("data", Buffer.concat([
    Buffer([protocol_string.length]),
    Buffer(protocol_string),
    reserved,
    Buffer.isBuffer(info_hash) ? info_hash : Buffer(info_hash, "hex")
  ], 1 + protocol_string.length + 8 + 20));
};

TCPProtocolProducer.prototype.peer_id = function(peer_id) {
  this.emit("data", Buffer.isBuffer(peer_id) ? peer_id : Buffer(peer_id));
};

TCPProtocolProducer.prototype.keep_alive = function() {
  this.emit("data", Buffer([0x00, 0x00, 0x00, 0x00]));
};

//
// This method takes a type argument and an optional data argument.
// It triggers a "data" event with the constructed packet buffer.
//

TCPProtocolProducer.prototype.message = function(type, data) {
  var data_length = Buffer.isBuffer(data) ? data.length : 0;

  // The message buffer needs 4 bytes for the message length, 1 byte
  // for the type and enough space for the message body.
  var buffer = Buffer(5 + data_length);

  // the message length is the length of the id and the body
  buffer.writeUInt32BE(data_length + 1, 0);

  // message type
  buffer.writeUInt8(type, 4);

  // only copy into the buffer if there's data to copy
  if (data_length) {
    data.copy(buffer, 5);
  }

  this.emit("data", buffer);
};

TCPProtocolProducer.prototype.choked = function() {
  this.message(0);
};

TCPProtocolProducer.prototype.unchoked = function() {
  this.message(1);
};

TCPProtocolProducer.prototype.interested = function() {
  this.message(2);
};

TCPProtocolProducer.prototype.uninterested = function() {
  this.message(3);
};

TCPProtocolProducer.prototype.have = function(index) {
  var b = Buffer(4);

  b.writeUInt32BE(index, 0);

  this.message(4, b);
};

TCPProtocolProducer.prototype.bitfield = function(bitfield) {
  this.message(5, bitfield);
};

TCPProtocolProducer.prototype.request = function(index, begin, length) {
  var b = Buffer(12);

  b.writeUInt32BE(index, 0);
  b.writeUInt32BE(begin, 4);
  b.writeUInt32BE(length, 8);

  this.message(6, b);
};

TCPProtocolProducer.prototype.block = function(index, begin, block) {
  var b = Buffer(8 + block.length);

  b.writeUInt32BE(index, 0);
  b.writeUInt32BE(begin, 4);
  block.copy(b, 8);

  this.message(7, b);
};

TCPProtocolProducer.prototype.cancel = function(index, begin, length) {
  var b = Buffer(12);

  b.writeUInt32BE(index, 0);
  b.writeUInt32BE(begin, 4);
  b.writeUInt32BE(length, 8);

  this.message(8, b);
};

TCPProtocolProducer.prototype.port = function(port) {
  var b = Buffer(4);

  b.writeUInt32BE(port, 0);

  this.message(9, b);
};
