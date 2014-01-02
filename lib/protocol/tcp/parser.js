//
// TCP protocol parser
//
// See [theory.org](http://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29)
// for more info.
//

var Dissolve = require("dissolve");

var TCPProtocolParser = module.exports = function TCPProtocolParser(options) {
  options = options || {};
  options.objectMode = true;

  Dissolve.call(this, options);

  this.uint8("protocolLength").buffer("protocol", "protocolLength").buffer("reserved", 8).buffer("infoHash", 20).tap(function() {
    this.push({
      type: "handshake",
      protocol: this.vars.protocol,
      reserved: this.vars.reserved,
      infoHash: this.vars.infoHash,
    });

    this.buffer("peerId", 20).tap(function() {
      this.push({
        type: "peerId",
        peerId: this.vars.peerId,
      });

      this.loop(function(end) {
        this.uint32be("messageLength").tap(function() {
          if (this.vars.messageLength === 0) {
            this.push({
              type: "keepAlive",
            });
          } else {
            this.uint8("messageId").tap(function() {
              switch (this.vars.messageId) {
                case 0: {
                  return this.push({
                    type: "choked",
                  });
                }
                case 1: {
                  return this.push({
                    type: "unchoked",
                  });
                }
                case 2: {
                  return this.push({
                    type: "interested",
                  });
                }
                case 3: {
                  return this.push({
                    type: "notInterested",
                  });
                }
                case 4: {
                  return this.uint32be("index").tap(function() {
                    return this.push({
                      type: "have",
                      index: this.vars.index,
                    });
                  });
                }
                case 5: {
                  return this.buffer("bitfield", this.vars.messageLength - 1).tap(function() {
                    return this.push({
                      type: "bitfield",
                      bitfield: this.vars.bitfield,
                    });
                  });
                }
                case 6: {
                  return this.uint32be("index").uint32be("begin").uint32be("length").tap(function() {
                    return this.push({
                      type: "request",
                      index: this.vars.index,
                      begin: this.vars.begin,
                      length: this.vars.length,
                    });
                  });
                }
                case 7: {
                  return this.uint32be("index").uint32be("begin").buffer("piece", this.vars.messageLength - 9).tap(function() {
                    return this.push({
                      type: "piece",
                      index: this.vars.index,
                      begin: this.vars.begin,
                      piece: this.vars.piece,
                    });
                  });
                }
                case 8: {
                  return this.uint32be("index").uint32be("begin").uint32be("length").tap(function() {
                    return this.push({
                      type: "cancel",
                      index: this.vars.index,
                      begin: this.vars.begin,
                      length: this.vars.length,
                    });
                  });
                }
                case 9: {
                  return this.uint32be("port").tap(function() {
                    return this.push({
                      type: "port",
                      port: this.vars.port,
                    });
                  });
                }
                case 20: {
                  return this.uint8("extendedId").buffer("payload", this.vars.length - 2).tap(function() {
                    return this.push({
                      type: "extended",
                      id: this.vars.messageId,
                      extendedId: this.vars.extendedId,
                      payload: this.vars.payload,
                    });
                  });
                }
                default: {
                  return this.buffer("messageData", this.vars.length - 1).tap(function() {
                    return this.push({
                      type: "message",
                      id: this.vars.messageId,
                      data: this.vars.messageData,
                    });
                  });
                }
              }
            });
          }
        });
      });
    });
  });
};
TCPProtocolParser.prototype = Object.create(Dissolve.prototype, {constructor: {value: TCPProtocolParser}});
