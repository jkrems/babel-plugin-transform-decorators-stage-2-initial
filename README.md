# `babel-plugin-transform-decorators-stage-2-initial`

**Warning:** This transform currently tries to optimize for matching the spec as closely as possible. It is not fast or produces pretty output.

Babel transform for the [stage 2 decorators proposal](http://tc39.github.io/proposal-decorators/#sec-decorate-element).

```
npm install --save-dev babel-plugin-transform-decorators-stage-2-initial
```

### Known Gaps

The following are a few parts of the spec that are hard (or impossible) to properly fake in a babel transform.

#### `MakeClassConstructor`

When a class decorators wraps the original constructor, calling the wrapper function as a function will *not* throw.

```js
function wrap(decl) {
  var orig = decl.constructor;
  decl.constructor = function oops() {
    console.log('This works just fine');
  }
  return decl;
}

@wrap class X {}
X(); // Should fail but doesn't!
```

In general: anything involving wrapping or switching out the constructor is unlikely to work 100% the way the spec describes it.

Because we can't prevent the original class from setting the "real" constructor's function kind to `classConstructor`,
class decorators will generally not work without also transforming the class declaration itself, e.g. with [`transform-es2015-classes`](https://www.npmjs.com/package/babel-plugin-transform-es2015-classes).
