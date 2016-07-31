var callCount = 0;
function decorate(element) {
  ++callCount;
  assert.hasType(Function, element.descriptor.get);
  assert.hasType(Function, element.descriptor.set);
  return element;
}

class X {
  @decorate
  get a() { return 42; }
  set a(v) {}
}

assert.equal(1, callCount);
