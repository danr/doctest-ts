import * as main from '../src/main'
import {test} from 'ava'

const c = (comment: string, context: string | null) => ({comment, context})

test('tests', t => {
  t.deepEqual(
    main.tests(`*

  foo // => 1

  `),
    [[{tag: '==', lhs: `foo`, rhs: `1`}]]
  )
})

test('tests', t => {
  t.deepEqual(
    main.tests(`*

    a
    b /* => 1 +
    2 +
    3
    */
    c // => 1
    d

    `),
    [
      [
        {tag: 'Statement', stmt: 'a;'},
        {tag: '==', lhs: 'b', rhs: '1+2+3'},
        {tag: '==', lhs: 'c', rhs: '1'},
        {tag: 'Statement', stmt: 'd;'},
      ],
    ]
  )
})

test.failing('modules and namespace', t => {
  const cs = main.Comments(`
    /** ns */
    namespace ns {}
  `)
  t.deepEqual(cs, [c('* m ', 'm'), c('* ns ', 'ns')])
})

test('const', t => {
  const cs = main.Comments(`
    /** u */
    const u = 1
  `)
  t.deepEqual(cs, [c('* u ', 'u')])
})

test('const object', t => {
  const cs = main.Comments(`
    /** k */
    const k = {
      /** a */
      a: 1,
      /** b */
      b(x: string) { return x+x }
    }
  `)
  t.deepEqual(cs, [c('* k ', 'k'), c('* a ', 'a'), c('* b ', 'b')])
})

test('object deconstruction', t => {
  const cs = main.Comments(`
    /** hello */
    const {u, v} = {u: 1, v: 2}
  `)
  t.deepEqual(cs, [c('* hello ', null)])
})

test('function', t => {
  const cs = main.Comments(`
    /** v */
    function v(s: string): number {
      return s.length + 1
    }
  `)
  t.deepEqual(cs, [c('* v ', 'v')])
})

test('class', t => {
  const cs = main.Comments(`
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
  t.deepEqual(cs, [
    c('* C ', 'C'),
    c('* constructor ', 'constructor'),
    c('* m ', 'm'),
    c('* p ', 'p'),
  ])
})

test('interface', t => {
  const cs = main.Comments(`
    /** I */
    interface I<A> {
      /** i */
      i: A,
      /** j */
      j(a: A): string
    }
  `)
  t.deepEqual(cs, [c('* I ', 'I'), c('* i ', 'i'), c('* j ', 'j')])
})

test('type', t => {
  const cs = main.Comments(`
    /** T */
    type T = number
  `)
  t.deepEqual(cs, [c('* T ', 'T')])
})

test('anywhere', t => {
  const cs = main.Comments(`
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
  t.deepEqual(cs, [c('* test1 ', 'w'), c('* test2 ', 'f'), c('* test3 ', null)])
})
