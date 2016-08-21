// Replacement for the decorator that ships with current reflect-metadata
function metadata(key, value) {
  return function decorate(element) {
    if (element.kind === 'property') {
      element.finisher = function addMetaData(klass) {
        Reflect.defineMetadata(key, value, klass.prototype, element.key);
      };
    } else if (element.kind === 'class') {
      element.finisher = function addMetaData(klass) {
        Reflect.defineMetadata(key, value, klass, undefined);
      };
    }
    return element;
  };
}

@metadata('class-key', 'class-value')
class C {
  @metadata('method-key', 'method-value')
  method() {
  }
}

var obj = new C();

var metadataValue = Reflect.getMetadata('method-key', obj, 'method');
assert.equal('method-value', metadataValue);

var classValue = Reflect.getMetadata('class-key', C);
assert.equal('class-value', classValue);
