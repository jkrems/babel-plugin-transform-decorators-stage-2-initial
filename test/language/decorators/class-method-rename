function rename(newName) {
  return function decorate(element) {
    element.key = newName;
    return element;
  };
}

class X {
  @rename('b') a() { return 7; }
  @rename('y') static x() { return 42; }
}

assert.equal(7, new X().b());
assert.equal(42, X.y());
