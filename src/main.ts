import * as fs from 'fs'
import * as chokidar from 'chokidar'
import * as minimist from 'minimist'
import * as ts from 'typescript'

////////////////////////////////////////////////////////////
// Types

export interface Equality {
  tag: '=='
  lhs: string
  rhs: string
}

export interface Statement {
  tag: 'Statement'
  stmt: string
}

export type Script = (Statement | Equality)[]

export type Context = string | null

export interface Comment {
  comment: string
  context: Context
}

////////////////////////////////////////////////////////////
// Extracting docstrings from program

export function Comments(s: string): Comment[] {
  const out: Comment[] = []
  function add_comment(c: string, context: string | null) {
  }

  function traverse(node: ts.Node) {
    const jsdocs = (node as any).jsDoc || []
    if (jsdocs.length > 0) {
      let context: string | null = null
      try {
        context = (node as any).name.escapedText || null
      } catch (e) {
      try {
        const decls = (node as any).declarationList.declarations
        if (decls.length == 1) {
          context = decls[0].name.escapedText || null
        }
      } catch (e) {
        // console.dir(node)
        context =ts.isConstructorDeclaration(node) ? 'constructor' : null
      }
      }
      jsdocs.forEach((doc: ts.JSDoc) => {
        out.push({comment: doc.comment || '', context})
      })
    }
    ts.forEachChild(node, traverse)
  }

  const ast = ts.createSourceFile('_.ts', s, ts.ScriptTarget.Latest)
  traverse(ast)

  return out
}

////////////////////////////////////////////////////////////
// Extracting test scripts from docstrings

/**

  is_doctest('// => true') // => true
  is_doctest('// true') // => false

*/
const is_doctest = (s: string) => s.match(     /\/\/[ \t]*=>/) != null



/**

  const m = doctest_rhs('// => true') || []
  m[1] // => ' true'

*/
const doctest_rhs = (s: string) => s.match(/^\s*\/\/[ \t]*=>([^\n]*)/m)

/**

  extractScript('s') // => [{tag: 'Statement', stmt: 's;'}]

  extractScript('e // => 1') // => [{tag: '==', lhs: 'e', rhs: '1'}]

  extractScript('s; e // => 1') // => [{tag: 'Statement', stmt: 's;'}, {tag: '==', lhs: 'e', rhs: '1'}]

*/
export function extractScript(s: string): Script {
  const pwoc = ts.createPrinter({removeComments: true})
  const ast = ts.createSourceFile('_.ts', s, ts.ScriptTarget.Latest)
  return ast.statements.map(
      (stmt, i): Statement | Equality => {
        if (ts.isExpressionStatement(stmt)) {
          const next = ast.statements[i+1] // zip with next
          const [a, z] = next ? [next.pos, next.end] : [stmt.end, ast.end]
          const after = ast.text.slice(a, z)
          const m = doctest_rhs(after)
          if (m && m[1]) {
            const lhs = pwoc.printNode(ts.EmitHint.Expression, stmt.expression, ast)
            const rhs = m[1].trim()
            return { tag: '==', lhs, rhs }
          }
        }

      return {tag: 'Statement', stmt: pwoc.printNode(ts.EmitHint.Unspecified, stmt, ast)}
      })

}

export function extractScripts(docstring: string): Script[] {
  const out = [] as Script[]
  docstring.split(/\n\n+/m).forEach(s => {
    if (is_doctest(s)) {
      out.push(extractScript(s))
    }
  })
  return out
}

////////////////////////////////////////////////////////////
// Showing test scripts
export interface ShowScript {
  showImports: string
  showScript(script: Script, c: Context): string
}

/** show("hello") // => '"hello"' */
export function show(s: any) {
  return JSON.stringify(s)
}

export function showContext(c: Context) {
  return show(c || 'doctest')
}

const ava: ShowScript = {
  showImports: 'import {test as __test} from "ava"',
  showScript(script, c) {
    const t = `__t`
    const body = script.map(s => {
      if (s.tag == 'Statement') {
        return s.stmt
      } else {
        return `${t}.deepEqual(${s.lhs}, ${s.rhs}, ${show(s.rhs)})`
      }
    }).join('\n')
    return `__test(${showContext(c)}, ${t} => {${body}})`
  }
}

const tape: ShowScript = {
  showImports: 'import * as __test from "tape"',
  showScript: ava.showScript
}

const showScriptInstances = {ava, tape}

import * as path from 'path'

function instrument(d: ShowScript, file: string): void {
  const {base, ext, ...u} = path.parse(file)
  if (base.includes('doctest')) {
    return
  }
  const buffer = fs.readFileSync(file, {encoding: 'utf8'})
  const tests = Doctests(d, buffer)
  const outfile = path.format({...u, ext: '.doctest' + ext})
  console.log('Writing', outfile)
  fs.writeFileSync(outfile, d.showImports + '\n' + buffer + '\n' + tests)
}

function Doctests(d: ShowScript, buffer: string): string {
  let s = ''
  for (const c of Comments(buffer)) {
    for (const script of extractScripts(c.comment)) {
      s += '\n' + d.showScript(script, c.context)
    }
  }
  return s
}

function main() {
  const opts = minimist(process.argv.slice(2), {boolean: ['tape', 'ava', 'watch']})
  const d = showScriptInstances[opts.tape == true ? 'tape' : 'ava']
  const files = opts._
  if (files.length == 0) {
    console.error(`No files specified!

      Usage:

        [-w|--watch] [--ava|--tape] files globs...

    Your options were:`, opts)
    process.exit(1)
  }
  files.forEach(file => instrument(d, file))
  if (opts.w == true || opts.watch == true) {
    const watcher = chokidar.watch(files)
    watcher.on('change', file => instrument(d, file))
  }
}

~process.argv[1].indexOf('test-worker.js') || main()

