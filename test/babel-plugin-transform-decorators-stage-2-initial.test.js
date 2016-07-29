'use strict';
var fs = require('fs');
var vm = require('vm');

var assert = require('assertive');
var babel = require('babel-core');

var babelPluginTransformDecoratorsStage2Initial = require('../');

var TEST_DIR = __dirname + '/language/decorators';
var TEST_CASES = fs.readdirSync(TEST_DIR);

describe('apply decorators', function () {
  TEST_CASES.forEach(function (filename) {
    var fullPath = TEST_DIR + '/' + filename;

    describe(filename, function () {
      var result;
      before('compile', function () {
        var source = fs.readFileSync(fullPath, 'utf8');
        result = babel.transform(source, {
          plugins: [
            babelPluginTransformDecoratorsStage2Initial,
            'transform-es2015-classes'
          ]
        });
      });

      it('runs successfully', function () {
        vm.runInNewContext('"use strict";\n' + result.code, {
          assert: assert,
          console: console
        }, { filename: fullPath });
      });
    });
  });
});
