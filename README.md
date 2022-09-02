Unfuckify
=========
A collection of tools and utilities to "unfuck" minified and webpack'd javascript sources.

## Utility Functions

### Loop Till Stable
```js
loopTillStable(input, processor, limit = 10)
```

Recursively applies a text processor until the output is stable or the limit is reached. Returns the last output from the processor.

#### Parameters
- `input` - The input string.
- `processor` - A function that takes the input string as it's first parameter and returns the processed output.
- `limit` - Optional. Defaults to 10. The maximum number of iterations.

### Split Webpack Modules
```js
splitWebpackModules(input)
```

Splits a webpack'd file into it's modules. Returns a map of module ids to the module contents. Throws a `RangeError` if the input was not recognized.

Note, this doesn't generate any shim code - the modules will not be able to resolve each other without additional changes.

#### Parameters
- `input` - The input string.

#### Output
```ts
Map(3) {
    1 => "{ foo() }"
    2 => "{ bar() }"
    3 => "{ baz() }"
}
```

## ESLint Auto-fixers
A collection of auto-fixers for ESLint to un-minify code or increase it's readability.

### no-short-circuit-if
Disallows using short-circuit logical expressions as if statements.

For example:
```js
{
    foo && bar()
}
```
Will be fixed to:
```js
{
    if (foo) bar()
}
```

### no-ternary-if
Disallows using ternary expressions as if/else statements.

For example:
```js
{
    foo ? bar() : baz()
}
```

Will be fixed to:
```js
{
    if (foo) { bar() } else { baz() }
}
```

### no-short-scientific
Disallows using scientific notation for small numbers.

For example:
```js
1E3
```

Will be fixed to:
```js
1000
```

### no-unused-sequence
Disallows using the comma operator to join expression statements into a sequence.

For example:
```js
{
    foo(), bar(), baz();
}
```

Will be fixed to:
```js
{
    foo(); bar(); baz();
}
```

### operator-parens
Adds parentheses around operators where operator precidence may be confusing (This one's opinionated).

For example:
```js
32 << 5 >> 3 & 5 + 3 - 4
```

Will be fixed to:
```js
((32 << 5) >> 3) & (5 + 3 - 4)
```

### no-variable-reuse
Disallows reusing variables for other assignments.

For example:
```js
let foo = 0
log(foo)
foo = 1
log(foo)
```

Will be fixed to:
```js
let foo = 0
log(foo)
let foo_2 = 1
log(foo_2)
```

## ESLint Utilities
TODO

## ESTree Utilities
TODO

## Typescript AST Utilities
TODO
