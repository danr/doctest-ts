# doctest-ts: doctests for TypeScript

Say you have a file src/main.ts with a function like hasFoo:

```typescript
function hasFoo(s: string): boolean {
  return null != s.match(/foo/i)
}
```

You can now make documentation and unit tests for this function in one go:

```typescript
/** Does this string contain foo, ignoring case?

    hasFoo('___foo__') // => true
    hasFoo('   fOO  ') // => true
    hasFoo('Foo.') // => true
    hasFoo('bar') // => false
    hasFoo('fo') // => false
    hasFoo('oo') // => false

*/
function hasFoo(s: string): boolean {
  return null != s.match(/foo/i)
}
```

Since the function is not exported we can only test this by either editing  or copying the entire file and gluing on tests at the end.
This is what this library does.

```sh
$ doctest-ts src/hasFoo.ts
Writing src/hasFoo.doctest.ts
```

The contents of `src/hasFoo.doctest.ts` is the original file prepended to the doctests rewritten as unit tests.

```typescript
/** Does this string contain foo, ignoring case?

    hasFoo('___foo__') // => true
    hasFoo('   fOO  ') // => true
    hasFoo('Foo.') // => true
    hasFoo('bar') // => false
    hasFoo('fo') // => false
    hasFoo('oo') // => false

*/
function hasFoo(s: string): boolean {
  return null != s.match(/foo/i)
}

import * as __test from "tape"
__test("hasFoo", t => {t.deepEqual(hasFoo("___foo__"), true, "true")
t.deepEqual(hasFoo("   fOO  "), true, "true")
t.deepEqual(hasFoo("Foo."), true, "true")
t.deepEqual(hasFoo("bar"), false, "false")
t.deepEqual(hasFoo("fo"), false, "false")
t.deepEqual(hasFoo("oo"), false, "false")
;t.end()})
```

This can now be run with the tape runner or ts-node:

```
$ ts-node src/hasFoo.doctest.ts | tap-diff
  hasFoo
    ✔  true
    ✔  true
    ✔  true
    ✔  false
    ✔  false
    ✔  false
        Done in 0.37s.

passed: 6  failed: 0  of 6 tests  (171ms)

All of 6 tests passed!
```

The default is to use tape output but it can also create ava output. Pull requests for other test runners are welcome.

## Watching file changes

We can tell `doctest-ts` to watch for file changes and report which files it has written.
It tries to be a good unix citizen and thus writes the files it has created on stdout (and some info on stderr).
This makes it possible to run test runners on each line on stdout like so:

```sh
ts-node src/main.ts --watch src/hasFo.ts |
while read file; do echo running tape on $file; ts-node $file | tap-diff; done
```

Let's say we remove the ignore case `i` flag from the regex in `hasFoo`. We get this output (automatically):
```
Writing src/hasFoo.doctest.ts
running tape on src/hasFoo.doctest.ts

  hasFoo
    ✔  true
    ✖  true at Test.t (src/hasFoo.doctest.ts:18:3)
        [-false-][+true+]
    ✖  true at Test.t (src/hasFoo.doctest.ts:19:3)
        [-false-][+true+]
    ✔  false
    ✔  false
    ✔  false

passed: 4  failed: 2  of 6 tests  (264ms)

2 of 6 tests failed.
```

# License

MIT
