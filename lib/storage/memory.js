var Storage = require("../storage");

var MemoryStorage = module.exports = function MemoryStorage(options) {
  options = options || {};

  Storage.call(this, options);
};
MemoryStorage.prototype = Object.create(Storage.prototype, {constructor: {value: MemoryStorage}});

MemoryStorage.prototype.initialise = function initialise(done) {
  this.buffer = Buffer(this.length);

  return done();
};

MemoryStorage.prototype.read = function read(offset, length, done) {
  return done(null, this.buffer.slice(offset, offset + length));
};

MemoryStorage.prototype.write = function write(offset, buffer, done) {
  buffer.copy(this.buffer, offset);

  return done();
};
