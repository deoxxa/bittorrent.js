var fs = require("fs");

var Storage = require("../storage");

var FileStorage = module.exports = function FileStorage(options) {
  options = options || {};

  Storage.call(this, options);

  this.filename = options.filename;
  this.fd = null;
};
FileStorage.prototype = Object.create(Storage.prototype, {constructor: {value: FileStorage}});

FileStorage.prototype.initialise = function initialise(done) {
  var self = this;

  return fs.open(this.filename, "a+", function(err, fd) {
    if (err) {
      return done(err);
    }

    self.fd = fd;

    return fs.ftruncate(fd, self.length, done);
  });
};

FileStorage.prototype.read = function read(offset, length, done) {
  return fs.read(this.fd, new Buffer(length), 0, length, offset, function(err, nread, data) {
    if (err) {
      return done(err);
    }

    return done(null, data);
  });
};

FileStorage.prototype.write = function write(offset, buffer, done) {
  return fs.write(this.fd, buffer, 0, buffer.length, offset, function(err, nwrote) {
    if (err) {
      return done(err);
    }

    return done();
  });
};
