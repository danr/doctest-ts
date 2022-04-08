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

    /**
     * Extracts the scripts from a comment
     *
     * // should have correct line numbers
     * const extr = ScriptExtraction.extractScripts("some actual comment\n\n42 // => 42\n\n43 // => 43\n44 // => 44\n\n // should be named\n45 // => 45\n")
     * extr[0] // => {script: [{lhs: "42", rhs: "42", tag: '==', line: 2}]}
     * extr[1] // => {script: [{lhs: "43", rhs: "43", tag: '==', line: 4},{lhs: "44", rhs: "44", tag: '==', line: 5}]}
     * extr[2] // => {name: "should be named", script: [{lhs: "45", rhs: "45", tag: '==', line: 8}]}
     */
    public static extractScripts(docstring: string): { script: Script, name?: string }[] {
        const out = [] as { script: Script, name?: string }[]

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
            const match = s.match(/^[ \t]*\/\/([^\n]*)/)
            if (match !== null) {
                const name = match[1].trim()
                out.push({script, name})
            } else {
                out.push({script})
            }
        }
        return out
    }

    /**
     * ScriptExtraction.extractScript('s', 0) // => [{tag: 'Statement', stmt: 's;'}]
     * ScriptExtraction.extractScript('e // => 1', 0) // => [{tag: '==', lhs: 'e', rhs: '1', line: 0}]
     * ScriptExtraction.extractScript('s;\n e // => 1', 0) // => [{tag: 'Statement', stmt: 's;'}, {tag: '==', lhs: 'e', rhs: '1', line: 1}]
     * ScriptExtraction.extractScript('s0\n e0 // => 0 \n e // => 1', 42) // => [{tag: 'Statement', stmt: 's0;'}, {tag: '==', lhs: 'e0', rhs: '0', line: 43}, {tag: '==', lhs: 'e', rhs: '1', line: 44}]
     */
    private static extractScript(s: string, linestart: number): Script {
        function getLineNumber(pos: number) {
            let line = 0;
            for (let i = 0; i <= pos; i++) {
                if (s[i] === "\n") {
                    line++
                }
            }
            return line;
        }

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


                    return {tag: '==', lhs, rhs, line: linestart + getLineNumber(a)}
                }
            }


            return {tag: 'Statement', stmt: pwoc.printNode(ts.EmitHint.Unspecified, stmt, ast)}
        })
    }
}