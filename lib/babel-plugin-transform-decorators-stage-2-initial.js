/*
 * Copyright (c) 2016, Jan Krems
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
'use strict';
var template = require('babel-template');
var syntaxDecorators = require('babel-plugin-syntax-decorators');

function decorateClass(ctor, target, elements) {
  if (target === null) { target = ctor.prototype; }

  var instanceProps = {};
  var staticProps = {};

  var extras = [];
  var finishers = [];

  function cleanPropertyDescriptor(prop) {
    return {
      value: prop.value, // omit if not set
      writable: prop.writable,
      // get: desc.getter, // omit if not set
      // set: desc.setter, // omit if not set
      enumerable: prop.enumerable,
      configurable: prop.configurable
    };
  }

  function cleanElementDescriptor(e) {
    if (e.kind !== 'property') {
      throw new TypeError('Only "property" descriptors are supported');
    }
    return {
      kind: e.kind,
      isStatic: e.isStatic,
      key: e.key,
      descriptor: cleanPropertyDescriptor(e.descriptor)
    };
  }

  function decorateElement(element) {
    if (!element || element.kind !== 'property') {
      throw new TypeError('element.kind has to be "property"');
    }

    var decorators = element.decorators || [];
    var prevDescriptor = cleanElementDescriptor(element);
    for (var i = 0; i < decorators.length; ++i) {
      var result = decorators[0](prevDescriptor);
      if (result.finisher !== undefined) {
        finishers.push(result.finisher);
        // result.finisher will be dropped via cleanElementDescriptor
      }
      prevDescriptor = cleanElementDescriptor(result);
      var extrasObject = result.extras;
      if (extrasObject !== undefined) {
        extras = extras.concat(extrasObject); // TODO: handle iterator
        throw new Error('Not implemented yet (extras)');
      }
    }

    var bucket = prevDescriptor.isStatic ? staticProps : instanceProps;
    bucket[prevDescriptor.key] = prevDescriptor.descriptor;
  }

  elements.forEach(decorateElement);

  // TODO: Apply class decorators

  if (ctor) Object.defineProperties(ctor, staticProps);
  Object.defineProperties(target, instanceProps);

  for (var i = 0; i < finishers.length; ++i) {
    finishers[i](ctor);
  }

  return ctor;
}

var buildClassDecorator = template('(' + decorateClass.toString() + ')(CTOR, TARGET, ELEMENTS);');

function transformDecorator(input) {
  var t = input.types;

  function cleanDecorators(decorators) {
    return decorators.reverse().map(function getExpr(dec) { return dec.expression; });
  }

  function transformClass(path, ref) {
    var map = Object.create(null);

    path.get('body.body').forEach(function processMethod(method) {
      var decorators = method.node.decorators;
      if (!decorators) return;

      var alias = t.toKeyAlias(method.node);
      map[alias] = map[alias] || [];
      map[alias].push(method.node);

      method.remove();
    });

    var elements = [];

    /* eslint guard-for-in: 0, no-restricted-syntax: 0 */
    for (var alias in map) {
      var items = map[alias];
      var method = items[0]; // TODO: getter/setter handling

      var decoratorExpressions = cleanDecorators(method.decorators);

      elements.push(
        t.objectExpression([
          t.objectProperty(t.identifier('kind'), t.stringLiteral('property')),
          t.objectProperty(t.identifier('isStatic'), t.booleanLiteral(method.static)),
          t.objectProperty(t.identifier('key'), t.stringLiteral(method.key.name)),
          t.objectProperty(t.identifier('decorators'), t.arrayExpression(decoratorExpressions)),
          t.objectProperty(t.identifier('descriptor'),
            t.objectExpression([
              t.objectProperty(t.identifier('writable'), t.booleanLiteral(true)),
              t.objectProperty(t.identifier('enumerable'), t.booleanLiteral(false)),
              t.objectProperty(t.identifier('configurable'), t.booleanLiteral(true)),
              t.objectProperty(t.identifier('value'),
                t.functionExpression(method.key, method.params, method.body,
                  method.generator, method.async)
              )
            ])
          )
        ])
      );
    }

    var classDecorators = path.node.decorators;
    path.node.decorators = null;
    if (classDecorators || elements.length) {
      var decorate = buildClassDecorator({
        CTOR: ref,
        TARGET: t.nullLiteral(),
        ELEMENTS: t.arrayExpression(elements)
      }).expression;
      return [t.assignmentExpression('=', ref, decorate)];
    }

    return [];
  }

  function someDecoratorsProp(arr) {
    return arr.some(function checkElement(e) {
      return !!e.decorators;
    });
  }

  function hasDecorators(path) {
    if (path.isClass()) {
      if (path.node.decorators) return true;

      return someDecoratorsProp(path.node.body.body);
    } else if (path.isObjectExpression()) {
      return someDecoratorsProp(path.node.properties);
    }

    return false;
  }

  function toExprStmt(expr) {
    return t.expressionStatement(expr);
  }

  return {
    inherits: syntaxDecorators,

    visitor: {
      ClassExpression: function onClassExpression(path) {
        if (!hasDecorators(path)) return;
        throw new Error('Not implemented');
      },

      ClassDeclaration: function onClassDeclaration(path) {
        if (!hasDecorators(path)) return;

        var ref = path.node.id;
        var nodes = [];

        nodes = nodes.concat(transformClass(path, ref, this).map(toExprStmt));
        path.insertAfter(nodes);
      },

      ObjectExpression: function onObjectExpression(path) {
        if (!hasDecorators(path)) return;
        throw new Error('Not implemented yet');
      }
    }
  };
}
module.exports = transformDecorator;
