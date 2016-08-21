'use strict';
var fs = require('fs');
var vm = require('vm');

var assert = require('assertive');
var babel = require('babel-core');
var glob = require('glob');
require('core-js/library/es6/reflect');
var Reflect = require('core-js/library/es7/reflect');

var babelPluginTransformDecoratorsStage2Initial = require('../');

var TEST_CASES = glob.sync('examples/**/*.js');

var HAS_NATIVE_REFLECT =
  Reflect.construct.toString().indexOf('{ [native code] }') !== -1;

function toES6Code(source, useNativeClasses) {
  return babel.transform(source, {
    plugins: [
      babelPluginTransformDecoratorsStage2Initial
    ].concat(useNativeClasses ? [] : ['transform-es2015-classes'])
  }).code;
}

describe('decorators', function () {
  TEST_CASES.forEach(function (filename) {
    describe(filename, function () {
      var source;
      before('load', function () {
        source = fs.readFileSync(filename, 'utf8');
      });

      function runFile(useNativeClasses) {
        var es6Code = toES6Code(source, useNativeClasses);
        vm.runInNewContext('"use strict";\n' + es6Code, {
          assert: assert,
          console: console,
          Reflect: Reflect
        }, { filename: filename });
      }

      it('runs successfully', function () {
        runFile();
      });

      it('runs without class transform', function () {
        if (!HAS_NATIVE_REFLECT) {
          this.skip();
          return;
        }
        runFile(true);
      });
    });
  });
});
