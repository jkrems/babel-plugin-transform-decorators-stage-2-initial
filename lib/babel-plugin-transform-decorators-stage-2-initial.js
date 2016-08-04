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

function decorateClass(ctor, target, elements, classDecorators) {
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
    var kind = hasGetter ? 'get' : 'set';
    if (entry) {
      var otherKind = hasGetter ? 'set' : 'get';
      entry.descriptor[kind] = element.descriptor[kind];
      if (element.decorators) {
        if (entry.$decoratorSource === otherKind) {
          throw new Error('Cannot decorate both getter and setter of the same property');
        }
        entry.$decoratorSource = kind;
        entry.decorators = element.decorators;
      } else if (entry.$decoratorSource === kind) {
        entry.$decoratorSource = null;
        entry.decorators = null;
      }
      return false;
    }
    element.$decoratorSource = element.decorators ? kind : null;
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

  var parent = null;

  function applyClassDecorator(prevDescriptor, classDecorator) {
    var result = classDecorator(prevDescriptor);
    if (!result || result.kind !== 'class') {
      throw new TypeError('Only "class" descriptors can be returned from class decorators');
    }
    if (result.finisher) {
      finishers.push(result.finisher);
    }
    if (result.constructor !== ctor) {
      // See: https://github.com/tc39/proposal-decorators/issues/18
      throw new Error('Switching out the constructor not implemented yet');
    }
    return {
      kind: 'class',
      constructor: result.constructor,
      parent: parent,
      members: result.members || prevDescriptor.members
    };
  }

  if (ctor) {
    var classDescriptor = {
      kind: 'class',
      constructor: ctor,
      parent: parent,
      members: elementDescriptors
    };
    if (ctor && classDecorators) {
      classDescriptor = classDecorators.reduce(applyClassDecorator, classDescriptor);
    }

    // TOOD: Create actual class
    var klass = classDescriptor.constructor;
    var proto = klass.prototype;

    classDescriptor.members.forEach(function defineElement(element) {
      var propTarget = element.isStatic ? klass : proto;
      Object.defineProperty(propTarget, element.key, element.descriptor);
    });

    for (var i = 0; i < finishers.length; ++i) {
      finishers[i](ctor);
    }

    return klass;
  }

  elementDescriptors.forEach(function defineElement(element) {
    if (element.isStatic) {
      throw new Error('Static elements can only exist on classes');
    }
    Object.defineProperty(target, element.key, element.descriptor);
  });

  return target;
}

var buildClassDecorator =
  template('(' + decorateClass.toString() + ')(CTOR, TARGET, ELEMENTS, DECORATORS);');

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

  function collectMembers(iter, isObjectProp) {
    var elements = [];

    function processMember(path) {
      var member = path.node;
      var propField = member.kind === 'method' ? 'value' : member.kind;
      var propValue;
      if (!propField && member.type === 'ObjectProperty') {
        propField = 'value';
        propValue = member.value;
      } else if (member.kind === 'method' || propField === 'get' || propField === 'set') {
        propValue =
          t.functionExpression(keyToFnName(member), member.params, member.body,
            member.generator, member.async);
      } else {
        return;
      }
      path.remove();

      var decorators = cleanDecorators(member.decorators);

      var propDescriptor = [
        t.objectProperty(t.identifier('writable'), t.booleanLiteral(true)),
        // TODO: Object properties should be enumerable
        t.objectProperty(t.identifier('enumerable'), t.booleanLiteral(isObjectProp)),
        t.objectProperty(t.identifier('configurable'), t.booleanLiteral(true)),
        t.objectProperty(t.identifier(propField), propValue)
      ];

      elements.push(t.objectExpression([
        t.objectProperty(t.identifier('kind'), t.stringLiteral('property')),
        t.objectProperty(t.identifier('isStatic'), t.booleanLiteral(!!member.static)),
        t.objectProperty(t.identifier('key'), keyToPropKey(member)),
        t.objectProperty(t.identifier('decorators'),
          decorators ? t.arrayExpression(decorators) : t.nullLiteral()),
        t.objectProperty(t.identifier('descriptor'), t.objectExpression(propDescriptor))
      ]));
    }
    iter.forEach(processMember);

    return elements;
  }

  function transformClass(path, ref) {
    var elements = collectMembers(path.get('body.body'), false);

    var classDecorators = cleanDecorators(path.node.decorators);
    path.node.decorators = null;
    if (classDecorators || elements.length) {
      var decorate = buildClassDecorator({
        CTOR: ref,
        TARGET: t.nullLiteral(),
        ELEMENTS: t.arrayExpression(elements),
        DECORATORS: classDecorators ? t.arrayExpression(classDecorators) : t.nullLiteral()
      }).expression;
      return [t.assignmentExpression('=', ref, decorate)];
    }

    return [];
  }

  function transformObject(path) {
    var elements = collectMembers(path.get('properties'), true);
    return buildClassDecorator({
      CTOR: t.nullLiteral(),
      TARGET: path.node,
      ELEMENTS: t.arrayExpression(elements),
      DECORATORS: t.nullLiteral()
    }).expression;
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
        var nodes = transformClass(path, ref, state).map(toExprStmt);
        path.insertAfter(nodes);
      },

      ObjectExpression: function onObjectExpression(path, state) {
        if (!hasDecorators(path)) return;
        path.replaceWith(transformObject(path, state));
      }
    }
  };
}
module.exports = transformDecorator;
