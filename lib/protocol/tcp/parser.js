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
      self.emit("peer_id", vars.peer_id);
      this.flush();

      this.loop(function(end, vars) {
        this.word32bu("plen").buffer("packet", "plen").tap(function(vars) {
          if (vars.plen === 0) {
            self.emit("keep_alive");
          } else {
            binary.parse(vars.packet).word8("id").buffer("data", vars.plen - 1).tap(function(vars) {
              if (vars.id === 0) {
                self.emit("choked");
              }

              if (vars.id === 1) {
                self.emit("unchoked");
              }

              if (vars.id === 2) {
                self.emit("interested");
              }

              if (vars.id === 3) {
                self.emit("uninterested");
              }

              if (vars.id === 4) {
                binary.parse(vars.data).word32bu("index").tap(function(vars) {
                  self.emit("have", {index: vars.index});

                  this.flush();
                });
              }

              if (vars.id === 5) {
                self.emit("bitfield", vars.data);
              }

              if (vars.id === 6) {
                binary.parse(vars.data).word32bu("index").word32bu("begin").word32bu("length").tap(function(vars) {
                  self.emit("request", {index: vars.index, begin: vars.begin, length: vars.length});

                  this.flush();
                });
              }

              if (vars.id === 7) {
                binary.parse(vars.data).word32bu("index").word32bu("begin").buffer("block", vars.data.length - 8).tap(function(vars) {
                  self.emit("piece", {index: vars.index, begin: vars.begin, block: vars.block});

                  this.flush();
                });
              }

              if (vars.id === 8) {
                binary.parse(vars.data).word32bu("index").word32bu("begin").word32bu("length").tap(function(vars) {
                  self.emit("cancel", {index: vars.index, begin: vars.begin, length: vars.length});

                  this.flush();
                });
              }

              if (vars.id === 9) {
                binary.parse(vars.data).word32bu("port").tap(function(vars) {
                  self.emit("port", {port: vars.port});

                  this.flush();
                });
              }

              self.emit("packet", {id: vars.id, data: vars.data});

              this.flush();
            });
          }

          self.emit("data", vars.packet);

          this.flush();
        });
      });
    });
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
