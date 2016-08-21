'use strict';
var fs = require('fs');
var vm = require('vm');

var assert = require('assertive');
var babel = require('babel-core');
require('core-js/library/es6/reflect');
var Reflect = require('core-js/library/es7/reflect');

var babelPluginTransformDecoratorsStage2Initial = require('../');

var TEST_DIR = __dirname + '/../examples/class-decorators';
var TEST_CASES = fs.readdirSync(TEST_DIR);

function toES6Code(source) {
  return babel.transform(source, {
    plugins: [
      babelPluginTransformDecoratorsStage2Initial,
      'transform-es2015-classes'
    ]
  }).code;
}

describe('class-decorators', function () {
  TEST_CASES.forEach(function (filename) {
    var fullPath = TEST_DIR + '/' + filename;

    describe(filename.replace(/\.js$/, ''), function () {
      var es6Code;
      before('compile', function () {
        var source = fs.readFileSync(fullPath, 'utf8');
        es6Code = toES6Code(source);
      });

      it('runs successfully', function () {
        vm.runInNewContext('"use strict";\n' + es6Code, {
          assert: assert,
          console: console,
          Reflect: Reflect
        }, { filename: fullPath });
      });
    });
  });
});
