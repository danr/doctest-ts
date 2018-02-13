import * as ts from 'typescript'

const pwoc = ts.createPrinter({removeComments: true})

function script(s: string): string {
  const f = ts.createSourceFile('test.ts', s, ts.ScriptTarget.ES5, true, ts.ScriptKind.TS)
  const out =
    f.statements.map(
      (now, i) => {
        if (ts.isExpressionStatement(now)) {
          const next = f.statements[i+1] // zip with next
          const [a, z] = next ? [next.pos, next.end] : [now.end, f.end]
          const after = f.text.slice(a, z)
          const m = after.match(/^\s*\/\/[ \t]*=>([^\n]*)/m)
          if (m && m[1]) {
            const lhs = pwoc.printNode(ts.EmitHint.Expression, now.expression, f)
            const rhs = m[1].trim()
            return 'assert.deepEqual(' + lhs + ', ' + rhs + ', ' + JSON.stringify(rhs) + ')'
          }
        }
        return pwoc.printNode(ts.EmitHint.Unspecified, now, f)
      })
  return out.join('\n')
}

const s = `
  const a = 1
  a
  // one more
  // => 1
  let b = 2
  a + 1 // => 2
  // that's all
  a + b
  // that's all
  // => 3
  function apa(bepa) {
    return 1
  }
  a++
  b++
  // hehe // => 5
  a // => 4
`

console.log(script(s))
