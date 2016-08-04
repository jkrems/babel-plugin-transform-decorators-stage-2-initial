function d(e) {
  return e;
}

var obj = {
  a: 10,
  @d f() { return 42; },
  b: 20
};
assert.hasType(Function, obj.f);
assert.equal(42, obj.f());
assert.equal(10, obj.a);
assert.equal(20, obj.b);
// We should not be changing the order of properties
assert.deepEqual(['a', 'f', 'b'], Object.keys(obj));
