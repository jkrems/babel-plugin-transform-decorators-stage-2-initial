function d(e) {
  return {
    kind: 'property',
    key: e.key,
    descriptor: e.descriptor,
    isStatic: e.isStatic,
    extras: [
      {
        kind: 'property',
        key: 'dMethod',
        isStatic: true,
        descriptor: {
          enumerable: true,
          writeable: true,
          configurable: true,
          value: e.key,
        }
      }
    ]
  };
}

class X {
  @d m() { return 42; }
}

assert.equal('m', X.dMethod);
assert.hasType(Function, X.prototype.m);
assert.equal(42, new X().m());
