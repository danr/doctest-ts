#!/usr/bin/env node
import * as ts from 'typescript'
import * as fs from "fs"

const is_doctest = (s: string) => s.match(/\/\/[ \t]*=>/) != null

function replicate<A>(i: number, x: A): A[] {
  const out = [] as A[]
  while (i-- > 0) out.push(x);
  return out
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

function walk(defs: Defs, f: (def: Def, d: number) => void, d0: number = 0): void {
  defs.forEach(d => (f(d, d0), walk(d.children, f, d0 + 1)))
}

function flatMap<A, B>(xs: A[], f: (a: A) => B[]): B[] {
  return ([] as B[]).concat(...xs.map(f))
}

function flatten<A>(xss: A[][]): A[] {
  return ([] as A[]).concat(...xss)
}

/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(fileNames: string[], options: ts.CompilerOptions): Top {
  const program = ts.createProgram(fileNames, options)
  const checker = program.getTypeChecker()
  const printer = ts.createPrinter()
  return program.getSourceFiles()
    .filter(file => -1 != fileNames.indexOf(file.fileName))
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

const pwoc = ts.createPrinter({removeComments: true})

function script(s: string): string[] {
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
  return out
}

const headers = ["import * as test from 'tape'"]
const filenames = [] as string[]
let fileout = null
const argv = process.argv
for (let i = 2; i < argv.length; i++) {
  const arg = argv[i]
  if (arg == '-o') {
    fileout = argv[++i]
  } else if (arg == '-i') {
    headers.push(argv[++i])
  } else {
    filenames.push(arg)
  }
}

const top = generateDocumentation(filenames, {
   target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS
})


if (fileout != null) {
  const out = headers.slice()

  top.forEach(({filename, defs}) => {
    walk(defs, d => {
      let tests = 0
      d.doc.split(/\n\n+/m).map(s => {
        if (is_doctest(s)) {
          out.push(
            'test(' + JSON.stringify(d.name + ' ' + ++tests) + ', assert => {',
            ...script(s).map(l => '  ' + l),
            '  assert.end()',
            '})',
            ''
          )
        }
      })
    })
  })

  fs.writeFileSync(fileout, out.join('\n'));
}

const readme = [] as string[]

readme.push('## API overview')

function prettyKind(kind: string) {
  return kind.replace('Declaration', '').toLowerCase()
}

top.forEach(({defs}) => {
  walk(defs, (def, i) => {
    if (def.exported || i > 0) {
      readme.push(
        replicate(i, '  ').join('') +
        '* ' +
        (def.children.length == 0 ? '' : (prettyKind(def.kind) + ' ')) +
        def.name)
    }
  })
})

top.forEach(({defs}) =>
  walk(defs, (def, i) => {
    if (def.exported || i > 0) {
      let indent = ''
      if (def.children.length == 0) {
        //const method = (def.kind == 'MethodDeclaration') ? 'method ' : ''
        readme.push('* ' + '**' + def.name + '**: `' + def.type + '`')
        indent = '  '
      } else {
        readme.push('### ' + prettyKind(def.kind) + ' ' + def.name)
      }
      def.doc.split(/\n\n+/).forEach(s => {
        readme.push('')
        if (is_doctest(s)) {
          readme.push(indent + '```typescript')
        }
        readme.push(indent + s.trim().split('\n').join('\n' + indent))
        if (is_doctest(s)) {
          readme.push(indent + '```')
        }
      })
    }
  })
)

console.log(readme.join('\n'))

