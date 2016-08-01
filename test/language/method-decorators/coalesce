var descriptors = [];
function d(element) {
  var descriptor = element.descriptor;
  descriptors.push(descriptor);
  return element;
}

class X {
  @d get a() {}

  @d a() {}

  @d set a(n) {}
  b() {} // should not reset
  static a() {} // should not reset
  get a() {}

  a() {} // reset

  @d get a() {}
  get a() {} // overrides earlier `get`
  @d set a(n) {}

  a() {} // reset
}

function hasFunctions(descriptor, fns) {
  ['value','get','set'].forEach(function check(key) {
    if (fns.indexOf(key) !== -1) {
      assert.hasType(Function, descriptor[key]);
    } else {
      assert.equal('Descriptor has no ' + key, 'undefined', typeof descriptor[key]);
    }
  });
}

// There's no setter before the first descriptor gets "reset"
hasFunctions(descriptors[0], ['get']);

// The next descriptor is for the method
hasFunctions(descriptors[1], ['value']);

// The next descriptor combines the annotated setter and the following getter
hasFunctions(descriptors[2], ['get', 'set']);

// The first getter gets dropped, the following gets combined with the setter.
// This means that *in the end* only one of the getter/setters is decorated
hasFunctions(descriptors[3], ['get', 'set']);
