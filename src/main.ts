import * as babylon from 'babylon'
import * as babel from 'babel-types'
import generate from 'babel-generator'
import * as fs from 'fs'

import * as util from 'util'

util.inspect.defaultOptions.depth = 5
util.inspect.defaultOptions.colors = true
const pp = (x: any) => (console.dir(x), console.log())

const opts: babylon.BabylonOptions = {
  plugins: [
    'estree',
    'jsx',
    'flow',
    'classConstructorCall',
    'doExpressions',
    'objectRestSpread',
    'decorators',
    'classProperties',
    'exportExtensions',
    'asyncGenerators',
    'functionBind',
    'functionSent',
    'dynamicImport',
  ],
}

const is_doctest = (s: string) => s.match(/\/\/[ \t]*=>/) != null
const doctest_rhs = (s: string) => s.match(/^\s*[ \t]*=>((.|\n)*)$/m)

interface Equality {
  tag: '=='
  lhs: string
  rhs: string
}

interface Statement {
  tag: 'Statement'
  stmt: string
}

type Script = (Statement | Equality)[]

export function test(s: string): Script {
  const lin = (ast: babel.Node) => generate(ast, {comments: false, compact: true}).code
  const ast = babylon.parse(s, opts)
  return ast.program.body.map((stmt): Statement | Equality => {
    const comment = (stmt.trailingComments || [{value: ''}])[0].value
    const rhs = doctest_rhs(comment)
    if (babel.isExpressionStatement(stmt) && rhs) {
      const rhs = babylon.parseExpression(comment.replace(/^\s*=>/, ''))
      return {
        tag: '==',
        lhs: lin(stmt.expression),
        rhs: lin(rhs),
      }
    } else {
      return {tag: 'Statement', stmt: lin(stmt)}
    }
  })
}

export function tests(docstring: string): Script[] {
  const out = [] as Script[]
  docstring.split(/\n\n+/m).forEach(s => {
    if (is_doctest(s)) {
      out.push(test(s))
    }
  })
  return out
}

export interface Comment {
  comment: string
  context: string | null
}

export function Comments(s: string): Comment[] {
  const out: Comment[] = []
  function add_comment(c: babel.Comment, context: string | null) {
    out.push({comment: c.value, context})
  }

  const ast = babylon.parse(s, opts)

  traverse(ast, node => {
    let context: null | string = null
    function has_key(x: any): x is {key: babel.Identifier} {
      return isObject(x) && 'key' in x && babel.isIdentifier((x as any).key)
    }
    function has_id(x: any): x is {id: babel.Identifier} {
      return isObject(x) && 'id' in x && babel.isIdentifier((x as any).id)
    }
    if (babel.isVariableDeclaration(node)) {
      const ds = node.declarations
      if (ds.length == 1) {
        const d = ds[0]
        if (has_id(d)) {
          context = d.id.name
        }
      }
    } else if (has_id(node)) {
      context = node.id.name
    } else if (has_key(node)) {
      context = node.key.name
    }
    if (isObject(node)) {
      function add_comments(s: string) {
        if (s in node && Array.isArray(node[s])) {
          ;(node[s] as any[]).forEach(c => {
            if ('type' in c) {
              if (c.type == 'CommentBlock' || c.type == 'CommentLine') {
                add_comment(c, context)
                if (context == null) {
                  // pp({c, node})
                }
              }
            }
          })
        }
      }
      if (isObject(node)) {
        add_comments('leadingComments')
        add_comments('innerComments')
        // add_comments('trailingComments')
      }
    }
  })

  return out
}

function isObject(x: any): x is object {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

function traverse(x: any, f: (x: any) => void): void {
  f(x)
  if (Array.isArray(x)) {
    x.map(y => traverse(y, f))
  }
  if (isObject(x)) {
    for (const k in x) {
      traverse((x as any)[k], f)
    }
  }
}

/*
function test_script_one(filename: string, d: Def): string[] {
  const out = [] as string[]
  let tests = 0
  d.doc.split(/\n\n+/m).map(s => {
    if (is_doctest(s)) {
      // todo: typecheck s now
      out.push(
        'test(' + JSON.stringify(d.name + ' ' + ++tests) + ', t => {',
        ...script(filename, s).map(l => '  ' + l),
        '})',
        ''
      )
    }
  })
  return out
}

function test_script(top: Top) {
  return ["import {test} from 'ava'"].concat(...top.map(
    ({filename, defs}) => walk(defs, (d) => test_script_one(filename, d)))
  )
}

const filenames = [] as string[]
const argv = process.argv.slice(2)
const outputs = [] as ((top: Top) => string[])[]

{
  let program: ts.Program
  let verbose = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg == '-t' || arg == '--test-script') {
      outputs.push(test_script)
    } else if (arg == '-d' || arg == '--doc') {
      outputs.push(doc)
    } else if (arg == '--toc' || arg == '--toc') {
      outputs.push(toc)
    } else if (arg == '-i' || arg == '--include') {
      outputs.push(_top => [fs.readFileSync(argv[++i]).toString()])
    } else if (arg == '-s' || arg == '--string') {
      outputs.push(_top => [argv[++i]])
    } else {
      filenames.push(arg)
    }
  }

  if (outputs.length == 0) {
    console.log(`typescript-doctests <args>
      Each entry in <args> may be:
        [-t|--test-script]        // write tape test script on stdout
        [-d|--doc]                // write markdown api documentation on stdout
        [--toc]                   // write markdown table of contents on stdout
        [-i|--include] FILENAME   // write the contents of a file on stdout
        [-s|--string] STRING      // write a string literally on stdout
        FILENAME                  // typescript files to look for docstrings in

      Example usages:

        typescript-doctests src/*.ts -s 'import * as App from "../src/App"' -t > test/App.doctest.ts

        typescript-doctests src/*.ts -i Header.md --toc --doc -i Footer.md > README.md
    `)
    process.exit(1)
  } else {
    program = ts.createProgram(filenames, {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS
    })
    const top = generateDocumentation(program, filenames)

    outputs.forEach(m => m(top).forEach(line => console.log(line)))
  }
}
*/
