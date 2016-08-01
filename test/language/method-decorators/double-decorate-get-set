function d(e) { return e; }

var err = assert.throws(function () {
  class X {
    @d get a() {}
    @d set a(n) {}
  }
});

assert.equal(
  'Cannot decorate both getter and setter of the same property',
  err.message);
