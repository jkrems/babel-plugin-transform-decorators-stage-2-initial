var logs = [];
function log(msg) {
  logs.push(msg);
}

function deprecate(message) {
  return desc => {
    const PrevCtor = desc.constructor;
    desc.constructor = function Deprecated() {
      log(message);
      return Reflect.construct(PrevCtor, arguments, this.constructor);
    };
    return desc;
  };
}

@deprecate('Stop using Base')
class Base {
  constructor(arg) {
    this.base = arg;
  }

  static staticBase() { return 'base7'; }
}

@deprecate('Stop using Derived')
@deprecate('Seriously, stop!')
class Derived extends Base {
  constructor(derivedArg, baseArg) {
    super(baseArg);
    this.derived = derivedArg;
  }

  static s() { return 7; }

  f() { return 13; }
}

logs = [];
const baseInst = new Base(42);
assert.equal(42, baseInst.base);
assert.expect('baseInst is a Base', baseInst instanceof Base);
assert.deepEqual(['Stop using Base'], logs);

logs = [];
const inst = new Derived('x', 'y');
assert.equal('x', inst.derived);
assert.equal('y', inst.base);
assert.equal(13, inst.f());
assert.expect('inst is a Base', inst instanceof Base);
assert.expect('inst is a Derived', inst instanceof Derived);
assert.deepEqual(['Stop using Derived', 'Seriously, stop!', 'Stop using Base'], logs);

assert.equal('Preserves static methods', 7, Derived.s());
assert.equal('Preserves static method inheritance', 'base7', Derived.staticBase());

assert.equal('The .name stays the same', 'Base', Base.name);
assert.equal('The .name stays the same', 'Derived', Derived.name);

assert.throws('Calling the wrapper as a function should throw', () => Base());
assert.throws('Calling the wrapper as a function should throw', () => Derived());
