//
// TCP protocol parser
//
// See [theory.org](http://wiki.theory.org/BitTorrentSpecification#Peer_wire_protocol_.28TCP.29)
// for more info.
//

//
// We're using [binary](http://github.com/SubStack/node-binary) to implement
// the guts of the parser. It provides a really nice chainable API for defining
// binary data parsing operations.
//

var binary = require("binary"),
    stream = require("stream"),
    util = require("util");

//
// This is the main object. It's a [`WritableStream`](http://nodejs.org/docs/latest/api/all.html#all_writable_stream),
// so you can `.pipe()` to it. It also emits a bunch of events named for the
// messages it can parse.
//

var TCPProtocolParser = module.exports = function TCPProtocolParser() {
  this.writable = true;

  var self = this;

  this.handler = binary().word8("pstrlen").buffer("pstr", "pstrlen").buffer("reserved", 8).buffer("info_hash", 20).tap(function(vars) {
    self.emit("handshake", {
      pstr: vars.pstr.toString(),
      reserved: vars.reserved,
      info_hash: vars.info_hash.toString("hex"),
    });
    this.flush();

    this.buffer("peer_id", 20).tap(function(vars) {
      self.emit("peer_id", vars.peer_id.toString());
      this.flush();

      this.loop(function(end, vars) {
        this.word32bu("length").tap(function(vars) {
          if (vars.length === 0) {
            // The keep_alive message is special - it's a message without a
            // message. The message length is 0, so there's no ID to be handled
            // by a downstream handler.
            self.emit("keep_alive");
            this.flush();
          } else {
            this.word8("id").buffer("data", vars.length - 1).tap(function(vars) {
              // We emit a `message` event here and handle it later on for more
              // processing. This allows for easy extension of parsing capabilities
              // by handing the `message` event in different ways.
              self.emit("message", vars.id, vars.data);
              this.flush();
            });
          }
        });
      });
    });
  });

  // This is where we emit all the more useful message events. You can easily hook
  // into this event from elsewhere and add additional message parsing capabilities.
  this.on("message", function(id, data) {
    if (id === 0) {
      self.emit("choked");
    }

    if (id === 1) {
      self.emit("unchoked");
    }

    if (id === 2) {
      self.emit("interested");
    }

    if (id === 3) {
      self.emit("uninterested");
    }

    if (id === 4) {
      binary.parse(data).word32bu("index").tap(function(vars) {
        self.emit("have", {index: vars.index});
        this.flush();
      });
    }

    if (id === 5) {
      self.emit("bitfield", data);
    }

    if (id === 6) {
      binary.parse(data).word32bu("index").word32bu("begin").word32bu("length").tap(function(vars) {
        self.emit("request", {index: vars.index, begin: vars.begin, length: vars.length});
        this.flush();
      });
    }

    if (id === 7) {
      binary.parse(data).word32bu("index").word32bu("begin").buffer("block", data.length - 8).tap(function(vars) {
        self.emit("piece", {index: vars.index, begin: vars.begin, block: vars.block});
        this.flush();
      });
    }

    if (id === 8) {
      binary.parse(data).word32bu("index").word32bu("begin").word32bu("length").tap(function(vars) {
        self.emit("cancel", {index: vars.index, begin: vars.begin, length: vars.length});
        this.flush();
      });
    }

    if (id === 9) {
      binary.parse(data).word32bu("port").tap(function(vars) {
        self.emit("port", {port: vars.port});
        this.flush();
      });
    }
  });
};

util.inherits(TCPProtocolParser, stream.Stream);

TCPProtocolParser.prototype.write = function(data) {
  return this.handler.write(data);
};

TCPProtocolParser.prototype.end = function() {
  this.emit("end");
};

TCPProtocolParser.prototype.destroy = function() {
  this.emit("close");
};
