/* @transform class-properties */
function id(a) {
  return a;
}

class X {
  x = 2;

  @id f() { return this.x; }
}

assert.equal(2, new X().f());
