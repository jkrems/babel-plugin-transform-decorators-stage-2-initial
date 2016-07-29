'use strict';
var assert = require('assertive');

var babelPluginTransformDecoratorsStage2Initial = require('../');

describe('babel-plugin-transform-decorators-stage-2-initial', function () {
  it('is empty', function () {
    assert.deepEqual({}, babelPluginTransformDecoratorsStage2Initial);
  });
});
