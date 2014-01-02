var Connection = require("../../connection"),
    Parser = require("./parser"),
    Serialiser = require("./serialiser");

var TCPConnection = module.exports = function TCPConnection(options) {
  Connection.call(this, options);
};
TCPConnection.prototype = Object.create(Connection.prototype, {constructor: {value: TCPConnection}});

TCPConnection.prototype.Parser = Parser;
TCPConnection.prototype.Serialiser = Serialiser;
