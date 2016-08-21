var finishCalled = [];
var finishArgs = [];

function finish(element) {
  element.finisher = function runFinisher(target) {
    finishArgs.push(target);
    finishCalled.push(element.key);
  };
  return element;
}

class X {
  @finish x() {}
  @finish static a() {}
  @finish y() {}
}

assert.deepEqual(['x', 'a', 'y'], finishCalled);
assert.deepEqual([X, X, X], finishArgs);
