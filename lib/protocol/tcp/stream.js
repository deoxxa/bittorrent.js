var stream = require("stream"),
    util = require("util");

var parser_events = ["handshake", "peer_id", "keep_alive", "message", "choked", "unchoked", "interested", "uninterested", "have", "bitfield", "request", "block", "cancel", "port"],
    producer_functions = ["handshake", "peer_id", "keep_alive", "message", "choked", "unchoked", "interested", "uninterested", "have", "bitfield", "request", "block", "cancel", "port"];

var Parser = require("./parser"),
    Producer = require("./producer");

var TCPProtocolStream = module.exports = function TCPProtocolStream() {
  this.writable = true;
  this.readable = true;

  this.parser = new Parser();
  parser_events.forEach(function(name) {
    this.parser.on(name, this.emit.bind(this, name));
  }.bind(this));

  this.producer = new Producer();
  this.producer.on("data", this.emit.bind(this, "data"));
}

util.inherits(TCPProtocolStream, stream.Stream);

TCPProtocolStream.prototype.write = function(chunk) {
  return this.parser.write(chunk);
};

TCPProtocolStream.prototype.end = function() {
  this.emit("end");
};

TCPProtocolStream.prototype.destroy = function() {
  this.emit("close");
};

producer_functions.forEach(function(name) {
  TCPProtocolStream.prototype[name] = function() {
    this.producer[name].apply(this.producer, arguments);
  };
});
