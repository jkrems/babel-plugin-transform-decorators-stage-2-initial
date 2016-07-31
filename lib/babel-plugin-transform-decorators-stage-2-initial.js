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
        extras = extras.concat(extrasObject); // TODO: handle iterator
      }
    }

    elementDescriptors = elementDescriptors.concat([prevDescriptor], extras);
  }

  elements.forEach(decorateElement);

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

function secondNode(a, b) {
  var startA = a.loc.start;
  var startB = b.loc.start;
  if (startA.line === startB.line) {
    return startA.column > startB.column ? a : b;
  }
  return startA.line > startB.line ? a : b;
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
    return decorators.reverse().map(function getExpr(dec) { return dec.expression; });
  }

  function transformClass(path, ref, state) {
    var lastGetterSetterKey = undefined;
    var coalesced = [];

    path.get('body.body').forEach(function processMethod(method) {
      var node = method.node;

      var entry = {};
      entry[node.kind] = node;

      switch (node.kind) {
        case 'get':
        case 'set':
          method.remove();

          var alias = t.toKeyAlias(node);
          if (lastGetterSetterKey === alias) {
            // check if merge is possible
            entry = coalesced[coalesced.length - 1];
            entry[node.kind] = node;
          } else {
            lastGetterSetterKey = alias;
            coalesced.push(entry);
          }
          break;

        case 'method':
          method.remove();

          lastGetterSetterKey = undefined;
          coalesced.push(entry);
          break;

        default:
          // Keep node. Maybe throw..?
          break;
      }
    });

    var elements = [];

    coalesced.forEach(function addDecoratedElement(coalescedEntry) {
      var decoratedElement;
      if (coalescedEntry.get && coalescedEntry.set) {
        if (nodeHasDecorators(coalescedEntry.get)) {
          // Verify: not both are decorated
          if (nodeHasDecorators(coalescedEntry.set)) {
            throw state.buildCodeFrameError(
              secondNode(coalescedEntry.get, coalescedEntry.set),
              'Cannot decorate both getter and setter for the same property');
          }
          decoratedElement = coalescedEntry.get;
        } else {
          decoratedElement = coalescedEntry.set;
        }
      } else {
        decoratedElement = coalescedEntry.method || coalescedEntry.get || coalescedEntry.set;
      }

      var decorators = cleanDecorators(decoratedElement.decorators || []);

      var propDescriptor = [
        t.objectProperty(t.identifier('writable'), t.booleanLiteral(true)),
        t.objectProperty(t.identifier('enumerable'), t.booleanLiteral(false)),
        t.objectProperty(t.identifier('configurable'), t.booleanLiteral(true))
      ];

      if (coalescedEntry.method) {
        var method = coalescedEntry.method;
        propDescriptor.push(t.objectProperty(t.identifier('value'),
          t.functionExpression(keyToFnName(method), method.params, method.body,
            method.generator, method.async)
        ));
      }
      if (coalescedEntry.get) {
        var getter = coalescedEntry.get;
        propDescriptor.push(t.objectProperty(t.identifier('get'),
          t.functionExpression(keyToFnName(getter), getter.params, getter.body,
            getter.generator, getter.async)
        ));
      }
      if (coalescedEntry.set) {
        var setter = coalescedEntry.set;
        propDescriptor.push(t.objectProperty(t.identifier('set'),
          t.functionExpression(keyToFnName(setter), setter.params, setter.body,
            setter.generator, setter.async)
        ));
      }

      elements.push(
        t.objectExpression([
          t.objectProperty(t.identifier('kind'), t.stringLiteral('property')),
          t.objectProperty(t.identifier('isStatic'), t.booleanLiteral(decoratedElement.static)),
          // TODO: handle symbol properties etc.
          t.objectProperty(t.identifier('key'), keyToPropKey(decoratedElement)),
          t.objectProperty(t.identifier('decorators'), t.arrayExpression(decorators)),
          t.objectProperty(t.identifier('descriptor'), t.objectExpression(propDescriptor))
        ])
      );
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
