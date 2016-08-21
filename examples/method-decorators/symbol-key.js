const m = Symbol('m');

function d(element) {
  assert.equal(element.key, m);
  // Even though we can't detect this statically, we should be coalescing.
  assert.hasType(Function, element.descriptor.get);
  assert.hasType(Function, element.descriptor.set);
  return element;
}

// To force a "complex" expression in the bracket
function id(x) {
  return x;
}

class X {
  // Using a symbol because syntax-decorators can't deal with symbol methods
  @d get [id(m)]() {}
  set [m](n) {}
}
