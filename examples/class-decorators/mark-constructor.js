var meta = new Map();

function mark(klass) {
  klass.finisher = ctor => {
    meta.set(ctor, 'marked');
  };
  return klass;
}

@mark class X { g() { return 42; } }

assert.equal('marked', meta.get(X));
assert.equal(42, new X().g());
