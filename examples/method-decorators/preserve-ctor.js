const id = a => a;

class C {
  constructor() {
    this._x = 'foo';
  }

  @id
  get x() { return this._x; }
}

assert.equal(new C().x, 'foo');
assert.include('Preserves constructor body when possible',
  'this._x =', C.toString());
