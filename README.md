# `babel-plugin-transform-decorators-stage-2-initial`

**Warning:** This transform currently tries to optimize for matching the spec as closely as possible. It is not fast or produces pretty output.

**Warning:** The proposal is still very much in flux and contains some ambiguity. The implementation in this repo is just one person's interpretation.

Babel transform for the [stage 2 decorators proposal](http://tc39.github.io/proposal-decorators/#sec-decorate-element).

```
npm install --save-dev babel-plugin-transform-decorators-stage-2-initial
```

### Known Gaps

Class decorators will generally not work without also transforming the class declaration itself, e.g. with [`transform-es2015-classes`](https://www.npmjs.com/package/babel-plugin-transform-es2015-classes).
It *might* work when native `Reflect.construct` is used (e.g. node 6+) instead of a polyfill.
