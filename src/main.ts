#!/usr/bin/env node
import * as ts from 'typescript'
import * as fs from 'fs'

const is_doctest = (s: string) => s.match(     /\/\/[ \t]*=>/) != null
const doctest_rhs = (s: string) => s.match(/^\s*\/\/[ \t]*=>([^\n]*)/m)

function replicate<A>(i: number, x: A): A[] {
  const out = [] as A[]
  while (i-- > 0) out.push(x);
  return out
}

function flatMap<A, B>(xs: A[], f: (a: A) => B[]): B[] {
  return ([] as B[]).concat(...xs.map(f))
}

function flatten<A>(xss: A[][]): A[] {
  return ([] as A[]).concat(...xss)
}

type Top = {filename: string, defs: Defs}[]

type Defs = Def[]

interface Def {
  name: string,
  type?: string,
  doc: string,
  exported: boolean,
  typedef: boolean,
  flags: string[],
  children: Defs,
  kind: string,
}

function walk<A>(defs: Defs, f: (def: Def, d: number) => A[], d0: number = 0): A[] {
  return flatten(defs.map(d => f(d, d0).concat(...walk(d.children, f, d0 + 1))))
}

/** Generate documentation for all classes in a set of .ts files

Adapted from TS wiki about using the compiler API */
function generateDocumentation(program: ts.Program, filenames: string[]): Top {
  const checker = program.getTypeChecker()
  const printer = ts.createPrinter()
  return program.getSourceFiles()
    .filter(file => -1 != filenames.indexOf(file.fileName))
    .map(file => ({
      filename: file.fileName,
      defs: flatten(file.statements.map(visits))
    }))

  function isNodeExported(node: ts.Node): boolean {
     return (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0
  }

  function visits(node: ts.Node): Defs {
    if (ts.isVariableStatement(node)) {
      // top-level const
      return flatten(node.declarationList.declarations.map(visits))
    // } else if (ts.isExportAssignment(node)) {
    //   return { exAss: ts.forEachChild(node, visit) }
    // } else if (ts.isExportDeclaration(node)) {
    //   return { exDecl: ts.forEachChild(node, visit) }
    } if (
      (  ts.isInterfaceDeclaration(node)
      || ts.isClassDeclaration(node)
      || ts.isFunctionDeclaration(node)
      || ts.isMethodDeclaration(node)
      || ts.isPropertyDeclaration(node)  // fields in classes
      || ts.isTypeElement(node)          // fields in interface records
      || ts.isTypeAliasDeclaration(node) // type A = ...
      || ts.isVariableDeclaration(node)  // top-level const
      || ts.isModuleDeclaration(node)
    ) && node.name) {
      const symbol = checker.getSymbolAtLocation(node.name);
      const doc = (((node as any).jsDoc || [])[0] || {}).comment || ''
      if (symbol) {
        const out: Def = {
          name: symbol.name,
          doc,
          exported: isNodeExported(node),
          kind: ts.SyntaxKind[node.kind],
          flags: [
            ts.ModifierFlags.None,
            ts.ModifierFlags.Export,
            ts.ModifierFlags.Ambient,
            ts.ModifierFlags.Public,
            ts.ModifierFlags.Private,
            ts.ModifierFlags.Protected,
            ts.ModifierFlags.Static,
            ts.ModifierFlags.Readonly,
            ts.ModifierFlags.Abstract,
            ts.ModifierFlags.Async,
            ts.ModifierFlags.Default,
            ts.ModifierFlags.Const
          ].map(flag => ts.ModifierFlags[symbol.flags & flag])
           .filter(flag => flag != 'None'),
          typedef: ts.isInterfaceDeclaration(node)
                 || ts.isClassDeclaration(node)
                 || ts.isTypeAliasDeclaration(node),
          type:
            (symbol.valueDeclaration && !ts.isClassDeclaration(node))
            ? checker.typeToString(checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration), node, 65535)
            : undefined,
          children: []
        }
        if ( ts.isInterfaceDeclaration(node) ) {
          out.children = flatten(node.members.map(visits))
        }
        if ( ts.isClassDeclaration(node) ) {
          out.children = flatten(node.members.map(visits))
        }
        if ( ts.isModuleDeclaration(node) && node.body ) {
          const b = node.body
          if (b.kind == ts.SyntaxKind.ModuleBlock) {
            out.children = flatten(b.statements.map(visits))
          }
        }
        return [out]
      }
      return []
    } else if (ts.isModuleBlock(node)) {
      return flatten(node.getChildren().map(visits))
    } else {
      console.error("Ignoring " + ts.SyntaxKind[node.kind])
      return []
    }
  }
}

function script(filename: string, s: string): string[] {
  const pwoc = ts.createPrinter({removeComments: true})
  const f = ts.createSourceFile('_doctest_' + filename, s, ts.ScriptTarget.ES5, true, ts.ScriptKind.TS)
  const out =
    f.statements.map(
      (now, i) => {
        if (ts.isExpressionStatement(now)) {
          const next = f.statements[i+1] // zip with next
          const [a, z] = next ? [next.pos, next.end] : [now.end, f.end]
          const after = f.text.slice(a, z)
          const m = doctest_rhs(after)
          if (m && m[1]) {
            const lhs = pwoc.printNode(ts.EmitHint.Expression, now.expression, f)
            const rhs = m[1].trim()
            return 'assert.deepEqual(' + lhs + ', ' + rhs + ', ' + JSON.stringify(rhs) + ')'
          }
        }
        return pwoc.printNode(ts.EmitHint.Unspecified, now, f)
      })
  return out
}

function test_script_one(filename: string, d: Def): string[] {
  const out = [] as string[]
  let tests = 0
  d.doc.split(/\n\n+/m).map(s => {
    if (is_doctest(s)) {
      // todo: typecheck s now
      out.push(
        'test(' + JSON.stringify(d.name + ' ' + ++tests) + ', assert => {',
        ...script(filename, s).map(l => '  ' + l),
        '  assert.end()',
        '})',
        ''
      )
    }
  })
  return out
}

function test_script(top: Top) {
  return ["import * as test from 'tape'"].concat(...top.map(
    ({filename, defs}) => walk(defs, (d) => test_script_one(filename, d)))
  )
}


function prettyKind(kind: string) {
  return kind.replace('Declaration', '').toLowerCase()
}

function toc_one(def: Def, i: number): string[] {
  if (def.exported || i > 0) {
    return [
      replicate(i, '  ').join('') +
      '* ' +
      (def.children.length == 0 ? '' : (prettyKind(def.kind) + ' ')) +
      def.name
    ]
  } else {
    return []
  }
}

function toc(top: Top): string[] {
  return flatten(top.map(({defs}) => walk(defs, toc_one)))
}

function doc_one(def: Def, i: number): string[] {
  const out = [] as string[]
  if (def.exported || i > 0) {
    let indent = ''
    if (def.children.length == 0) {
      //const method = (def.kind == 'MethodDeclaration') ? 'method ' : ''
      out.push('* ' + '**' + def.name + '**: `' + def.type + '`')
      indent = '  '
    } else {
      out.push('### ' + prettyKind(def.kind) + ' ' + def.name)
    }
    def.doc.split(/\n\n+/).forEach(s => {
      out.push('')
      if (is_doctest(s)) {
        out.push(indent + '```typescript')
      }
      const lines = s.split('\n')
      lines.forEach(line => out.push(indent + line))
      if (is_doctest(s)) {
        out.push(indent + '```')
      }
    })
  }
  return out
}

function doc(top: Top) {
  return flatten(top.map(({defs}) => walk(defs, doc_one)))
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
  } else {
    program = ts.createProgram(filenames, {
      target: ts.ScriptTarget.ES5,
      module: ts.ModuleKind.CommonJS
    })
    const top = generateDocumentation(program, filenames)

    outputs.forEach(m => m(top).forEach(line => console.log(line)))
  }
}
