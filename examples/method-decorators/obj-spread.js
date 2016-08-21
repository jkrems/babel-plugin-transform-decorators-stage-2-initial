/* @transform object-rest-spread */
function id(a) {
  return a;
}

var old = {
  a: 5,
  b: 9,
  @id f() { return 'foo'; },
  @id g() { return 7; },
  c: 13
}
var obj = {
  a: 10,
  ...old,
  @id f() { return 42; },
  b: 20
};

assert.equal(42, obj.f());
assert.equal(20, obj.b);
assert.equal(7, obj.g());
assert.equal(13, obj.c);

// `.a` should be overwritten with the value from `old`
assert.equal(5, obj.a);
