'use strict';
var fs = require('fs');
var vm = require('vm');

var assert = require('assertive');
var babel = require('babel-core');

var babelPluginTransformDecoratorsStage2Initial = require('../');

var TEST_DIR = __dirname + '/language/decorators';
var TEST_CASES = fs.readdirSync(TEST_DIR);

function toES6Code(source) {
  return babel.transform(source, {
    plugins: [
      babelPluginTransformDecoratorsStage2Initial
    ]
  }).code;
}

describe('apply decorators', function () {
  TEST_CASES.forEach(function (filename) {
    var fullPath = TEST_DIR + '/' + filename;

    describe(filename, function () {
      var es6Code;
      before('compile', function () {
        var source = fs.readFileSync(fullPath, 'utf8');
        es6Code = toES6Code(source);
      });

      it('runs successfully', function () {
        vm.runInNewContext('"use strict";\n' + es6Code, {
          assert: assert,
          console: console
        }, { filename: fullPath });
      });
    });
  });

  describe('getter/setter both decorated', function () {
    it('triggers an error', function () {
      var err = assert.throws(function () {
        toES6Code('class X { @d get a() {} @d set a(v) {} }');
      });
      assert.hasType('Contains code snippet', String, err.codeFrame);
      assert.include('Cannot decorate both getter and setter for the same property', err.message);
    });
  });
});
