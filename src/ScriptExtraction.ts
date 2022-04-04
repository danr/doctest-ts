import * as ts from "typescript";
import {Equality, Script, Statement} from "./UnitTest";


export class ScriptExtraction {
    /**
     * ScriptExtraction.is_doctest('// => true') // => true
     * ScriptExtraction.is_doctest('// true') // => false
     */
    public static is_doctest(s: string): boolean {
        return s.match(/\/\/[ \t]*=>/) != null
    }

    /**
     * Extracts the expected value
     *
     * const m = ScriptExtraction.doctest_rhs('// => true') || []
     * m[1] // => ' true'
     */
    public static doctest_rhs(s: string) {
        return s.match(/^\s*\/\/[ \t]*=>([^\n]*)/m);
    }

    public static extractImports(docstring: string) {
        return docstring.split("\n").filter(s => s.startsWith("import "));
    }

    public static extractScripts(docstring: string): { script: Script, name?: string, line: number }[] {
        const out = [] as { script: Script, name?: string, line: number }[]
        
        function lineIndexOf(part: string): number {
            const index = docstring.indexOf(part)
            const before = docstring.slice(0, index)
            return before.split(/\r\n|\r|\n/).length - 1
        }
        
        for (const s of docstring.split(/\n\n+/m)) {

            if (!ScriptExtraction.is_doctest(s)) {
                continue;
            }

            const line = lineIndexOf(s)
            const script = ScriptExtraction.extractScript(s, line)
            let name = undefined
            const match = s.match(/^[ \t]*\/\/([^\n]*)/)
            if (match !== null) {
                name = match[1].trim()
            }
            out.push({script, name, line})
        }
        return out
    }

    /**
     * ScriptExtraction.extractScript('s', 0) // => [{tag: 'Statement', stmt: 's;'}]
     * ScriptExtraction.extractScript('e // => 1', 0) // => [{tag: '==', lhs: 'e', rhs: '1', line: 0}]
     * ScriptExtraction.extractScript('s; e // => 1', 0) // => [{tag: 'Statement', stmt: 's;'}, {tag: '==', lhs: 'e', rhs: '1', line: 1}]
     */
    private static extractScript(s: string, linestart: number): Script {
        const pwoc = ts.createPrinter({removeComments: true})
        const ast = ts.createSourceFile('_.ts', s, ts.ScriptTarget.Latest)
        return ast.statements.map((stmt, i): Statement | Equality => {
            if (ts.isExpressionStatement(stmt)) {
                const next = ast.statements[i + 1] // zip with next
                const [a, z] = next ? [next.pos, next.end] : [stmt.end, ast.end]
                const after = ast.text.slice(a, z)
                const m = ScriptExtraction.doctest_rhs(after)
                if (m && m[1]) {
                    const lhs = pwoc.printNode(ts.EmitHint.Expression, stmt.expression, ast)
                    const rhs = m[1].trim()
                    return {tag: '==', lhs, rhs, line: linestart + i}
                }
            }


            return {tag: 'Statement', stmt: pwoc.printNode(ts.EmitHint.Unspecified, stmt, ast)}
        })
    }
}