var logs = [];
function log(msg) {
  logs.push(msg);
}

function deprecate(message) {
  return desc => {
    let FinalCtor = null;
    const OriginalCtor = desc.constructor;
    desc.finisher = klass => { FinalCtor = klass; };
    desc.constructor = function Deprecated() {
      log(message);
      const self = Reflect.construct(OriginalCtor, arguments, FinalCtor);
      return self;
    };
    return desc;
  };
}

@deprecate('Stop using Base')
class Base {
  constructor(arg) {
    this.base = arg;
  }
}

@deprecate('Stop using Derived')
@deprecate('Seriously, stop!')
class Derived extends Base {
  constructor(derivedArg, baseArg) {
    super(baseArg);
    this.derived = derivedArg;
  }
}

logs = [];
const baseInst = new Base(42);
assert.equal(42, baseInst.base);
assert.deepEqual(['Stop using Base'], logs);

logs = [];
const inst = new Derived('x', 'y');
assert.equal('x', inst.derived);
assert.equal('y', inst.base);
assert.deepEqual(['Stop using Derived', 'Seriously, stop!', 'Stop using Base'], logs);

assert.throws('Calling the wrapper as a function should throw', () => Base());
assert.throws('Calling the wrapper as a function should throw', () => Derived());
