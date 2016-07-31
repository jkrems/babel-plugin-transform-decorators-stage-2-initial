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

  var elementDescriptors = [];
  var finishers = [];

  var lastInstanceGetSet = Object.create(null);
  var lastStaticGetSet = Object.create(null);

  function coalesceGetSet(element) {
    var lastGetSet = element.isStatic ? lastStaticGetSet : lastInstanceGetSet;
    if (element.descriptor.value) {
      delete lastGetSet[element.key];
      return true;
    }
    var hasGetter = !!element.descriptor.get;
    var entry = lastGetSet[element.key];
    if (entry) {
      if (hasGetter) {
        entry.descriptor.get = element.descriptor.get;
        if (element.decorators) {
          if (entry.$decoratorSource === 'set') {
            throw new Error('Cannot decorate both getter and setter of the same property');
          }
          entry.$decoratorSource = 'get';
          entry.decorators = element.decorators;
        } else if (entry.$decoratorSource === 'get') {
          entry.$decoratorSource = null;
          entry.decorators = null;
        }
      } else {
        entry.descriptor.set = element.descriptor.set;
        if (element.decorators) {
          if (entry.$decoratorSource === 'get') {
            throw new Error('Cannot decorate both getter and setter of the same property');
          }
          entry.$decoratorSource = 'set';
          entry.decorators = element.decorators;
        } else if (entry.$decoratorSource === 'set') {
          entry.$decoratorSource = null;
          entry.decorators = null;
        }
      }
      return false;
    }
    element.$decoratorSource = hasGetter ? 'get' : 'set';
    lastGetSet[element.key] = element;
    return true;
  }

  var coalesced = elements.filter(coalesceGetSet);

  function cleanPropertyDescriptor(prop) {
    var descriptor = {
      enumerable: prop.enumerable,
      configurable: prop.configurable
    };
    if ('value' in prop) {
      descriptor.value = prop.value;
      descriptor.writable = true;
    } else {
      if ('get' in prop) {
        descriptor.get = prop.get;
      }
      if ('set' in prop) {
        descriptor.set = prop.set;
      }
    }
    return descriptor;
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

    var extras = [];
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
        extras = extras.concat(Array.from(extrasObject));
      }
    }

    // TODO: merge extras with same key and static.
    // This should not have any observable effects though..?

    elementDescriptors = elementDescriptors.concat([prevDescriptor], extras);
  }

  coalesced.forEach(decorateElement);

  // TODO: Apply class decorators

  function defineElement(element) {
    var propTarget = element.isStatic ? ctor : target;
    Object.defineProperty(propTarget, element.key, element.descriptor);
  }

  elementDescriptors.forEach(defineElement);

  for (var i = 0; i < finishers.length; ++i) {
    finishers[i](ctor);
  }

  return ctor;
}

var buildClassDecorator = template('(' + decorateClass.toString() + ')(CTOR, TARGET, ELEMENTS);');

function nodeHasDecorators(e) {
  return !!e.decorators;
}

function transformDecorator(input) {
  var t = input.types;

  function keyToPropKey(node) {
    if (node.computed) {
      return node.key;
    }
    return t.stringLiteral(node.key.name);
  }

  function keyToFnName(node) {
    if (node.computed) {
      return null;
    }
    return node.key;
  }

  function cleanDecorators(decorators) {
    if (!decorators) return null;
    return decorators.reverse().map(function getExpr(dec) { return dec.expression; });
  }

  function transformClass(path, ref) {
    var elements = [];

    path.get('body.body').forEach(function processMethod(methodPath) {
      var method = methodPath.node;
      var propField = method.kind === 'method' ? 'value' : method.kind;
      if (propField !== 'value' && propField !== 'get' && propField !== 'set') {
        return;
      }
      methodPath.remove();

      var decorators = cleanDecorators(method.decorators);

      var propDescriptor = [
        t.objectProperty(t.identifier('writable'), t.booleanLiteral(true)),
        t.objectProperty(t.identifier('enumerable'), t.booleanLiteral(false)),
        t.objectProperty(t.identifier('configurable'), t.booleanLiteral(true)),
        t.objectProperty(t.identifier(method.kind === 'method' ? 'value' : method.kind),
          t.functionExpression(keyToFnName(method), method.params, method.body,
            method.generator, method.async)
        )
      ];

      elements.push(t.objectExpression([
        t.objectProperty(t.identifier('kind'), t.stringLiteral('property')),
        t.objectProperty(t.identifier('isStatic'), t.booleanLiteral(method.static)),
        t.objectProperty(t.identifier('key'), keyToPropKey(method)),
        t.objectProperty(t.identifier('decorators'),
          decorators ? t.arrayExpression(decorators) : t.nullLiteral()),
        t.objectProperty(t.identifier('descriptor'), t.objectExpression(propDescriptor))
      ]));
    });

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
    return arr.some(nodeHasDecorators);
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

      ClassDeclaration: function onClassDeclaration(path, state) {
        if (!hasDecorators(path)) return;

        var ref = path.node.id;
        var nodes = [];

        nodes = nodes.concat(transformClass(path, ref, state).map(toExprStmt));
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
