import * as internal from '../src/internal'
import * as test from 'tape'

test('tests', t => {
  t.plan(1)
  t.deepEqual(
    internal.extractScripts(`*

  foo // => 1

  `),
    [{ script: [{tag: '==', lhs: `foo`, rhs: `1`}], name: undefined }]
  )
})

test('tests', t => {
  t.plan(1)
  t.deepEqual(
    internal.extractScripts(`*

    a
    b // => 1 + 2 + 3
    c // => 1
    d

    */`).map(s => s.script),
    [
      [
        {tag: 'Statement', stmt: 'a;'},
        {tag: '==', lhs: 'b', rhs: '1 + 2 + 3'},
        {tag: '==', lhs: 'c', rhs: '1'},
        {tag: 'Statement', stmt: 'd;'},
      ],
    ]
  )
})

const c = (comment: string, context: string | null) => ({comment, context})

test('modules and namespace', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** m */
    namespace m {}

    /** ns */
    namespace ns {}
  `)
  t.deepEqual(cs, [c('m ', 'm'), c('ns ', 'ns')])
})

test('const', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** u */
    const u = 1
  `)
  t.deepEqual(cs, [c('u ', 'u')])
})

test('const object', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** k */
    const k = {
      /** a */
      a: 1,
      /** b */
      b(x: string) { return x+x }
    }
  `)
  t.deepEqual(cs, [c('k ', 'k'), c('a ', 'a'), c('b ', 'b')])
})

test('object deconstruction', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** hello */
    const {u, v} = {u: 1, v: 2}
  `)
  t.deepEqual(cs, [c('hello ', null)])
})

test('function', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** v */
    function v(s: string): number {
      return s.length + 1
    }
  `)
  t.deepEqual(cs, [c('v ', 'v')])
})

test('class', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** C */
    class C<A> {
      /** constructor */
      constructor() {}
      /** m */
      m(s: Array<number>): Array<string> {
      }
      /** p */
      p: Array<number>
    }
  `)
  t.deepEqual(cs, [c('C ', 'C'), c('constructor ', 'constructor'), c('m ', 'm'), c('p ', 'p')])
})

test('interface', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** I */
    interface I<A> {
      /** i */
      i: A,
      /** j */
      j(a: A): string
    }
  `)
  t.deepEqual(cs, [c('I ', 'I'), c('i ', 'i'), c('j ', 'j')])
})

test('type', t => {
  t.plan(1)
  const cs = internal.Comments(`
    /** T */
    type T = number
  `)
  t.deepEqual(cs, [c('T ', 'T')])
})

test('anywhere', t => {
  t.plan(1)
  const cs = internal.Comments(`
    const $ = () => {
      /** test1 */
      const w = 1

      /** test2 */
      function f(x) {
        return x * x
      }

      /** test3 */
      return f(f(w))
    }
  `)
  t.deepEqual(cs, [c('test1 ', 'w'), c('test2 ', 'f')])
})
