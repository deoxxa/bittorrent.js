var Bitfield = require("opaque-bitfield"),
    crypto = require("crypto");

var Storage = module.exports = function Storage(options) {
  options = options || {};

  this.length = options.length;
  this.pieceHashes = options.pieceHashes;
  this.pieceCount = options.pieceCount;
  this.pieceLength = options.pieceLength;

  this.bitfield = new Bitfield(Math.ceil(options.pieces / 8));
};

Storage.Memory = require("./storage/memory");
Storage.File = require("./storage/file");

Storage.prototype.initialise = function initialise(done) {
  return cb(Error("not implemented"));
};

Storage.prototype.read = function read(offset, length, done) {
  return cb(Error("not implemented"));
};

Storage.prototype.write = function write(offset, buffer, done) {
  return cb(Error("not implemented"));
};

Storage.prototype.getBitfield = function getBitfield() {
  return this.bitfield;
};

Storage.prototype.getPiece = function getPiece(piece, done) {
  return this.read(this.pieceLength * piece, this.pieceLength, done);
};

Storage.prototype.getPieceHash = function getPieceHash(piece, done) {
  return this.getPiece(piece, function(err, data) {
    if (err) {
      return done(err);
    }

    return crypto.createHash("sha1").on("error", done).on("data", function(hash) {
      return done(null, hash);
    }).end(data);
  });
};

Storage.prototype.getExpectedHash = function getExpectedHash(piece, done) {
  return done(null, this.pieceHashes[piece]);
};

Storage.prototype.checkPieceHash = function checkPieceHash(piece, done) {
  var self = this;

  return this.getPieceHash(piece, function(err, hash) {
    if (err) {
      return done(err);
    }

    return self.getExpectedHash(piece, function(err, expected) {
      if (err) {
        return done(err);
      }

      return done(null, expected.toString("hex") === hash.toString("hex"));
    });
  });
};

Storage.prototype.fullHashCheck = function fullHashCheck(done) {
  var indexes = [];
  for (var i=0;i<this.pieceHashes.length;++i) {
    indexes.push(i);
  }

  var self = this;

  var next = function next() {
    if (!indexes.length) {
      return done();
    }

    var index = indexes.shift();

    self.checkPieceHash(index, function(err, correct) {
      if (err) {
        return done(err);
      }

      self.bitfield.set(index, correct);

      return next();
    });
  };

  next();
};
