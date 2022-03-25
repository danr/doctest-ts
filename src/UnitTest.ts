import {Context} from "./ExtractComments";
import * as ts from "typescript";

type Script = (Statement | Equality)[]
interface Equality {
    tag: '=='
    lhs: string
    rhs: string
}

interface Statement {
    tag: 'Statement'
    stmt: string
}

class ScriptExtraction {
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

    public static extractImports(docstring: string){
        return docstring.split("\n").filter(s => s.startsWith("import "));
    }
    
    public static extractScripts(docstring: string): { script: Script, name?: string, line: number }[] {
        const out = [] as { script: Script, name?: string, line: number }[]
        let line = 0;
        for (const s of docstring.split(/\n\n+/m)) {
            const p: number = line;
            line += s.split(/\r\n|\r|\n/).length

            if (!ScriptExtraction.is_doctest(s)) {
                continue;
            }

            const script = ScriptExtraction.extractScript(s)
            let name = undefined
            const match = s.match(/^[ \t]*\/\/([^\n]*)/)
            if (match !== null) {
                name = match[1].trim()
            }
            out.push({script, name, line: p})
        }
        return out
    }

    /**
     * ScriptExtraction.extractScript('s') // => [{tag: 'Statement', stmt: 's;'}]
     * ScriptExtraction.extractScript('e // => 1') // => [{tag: '==', lhs: 'e', rhs: '1'}]
     * ScriptExtraction.extractScript('s; e // => 1') // => [{tag: 'Statement', stmt: 's;'}, {tag: '==', lhs: 'e', rhs: '1'}]
     */
    private static extractScript(s: string): Script {
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
                    return {tag: '==', lhs, rhs}
                }
            }



            return {tag: 'Statement', stmt: pwoc.printNode(ts.EmitHint.Unspecified, stmt, ast)}
        })
    }
}

/**
 * Represents a single unit test somewhere in a file.
 */
export default class UnitTest {


    public body: Script;
    public context: Context;
    private _extraImports: string[];

    private constructor(body: Script, context: Context, extraImports: string[]) {
        this.body = body;
        this.context = context;
        this._extraImports = extraImports;
    }

    public static FromComment(comment: string, context: Context): UnitTest[] {
        const imports = ScriptExtraction.extractImports(comment)
        return ScriptExtraction.extractScripts(comment).map(({script, line, name}, i) =>
            new UnitTest(script, {
                ...context,
                linenumber: (context.linenumber ?? 0) + line,
                testname: name ?? 'doctest ' + i
            },imports))
    }

    public static FromComments(comms: { comment: string, context: Context }[]): UnitTest[] {
        const result: UnitTest[] = []
        for (const comm of comms) {
            result.push(...UnitTest.FromComment(comm.comment, comm.context))
        }
        return result
    }

    public getImports(): string[] {
        return [...this._extraImports, 'import "mocha"', 'import {expect as __expect} from "chai"']
    }

    /**
     * Generates the mocha test code for this unit test.
     * Will only construct the 'it('should ....') { __expect(x).deep.eq(y) } part
     */
    public generateCode() {
        const script = this.body
            .map(s => {
                if (s.tag == 'Statement') {
                    return s.stmt
                } else {
                    return `__expect(${s.lhs}, "failed at ${this.context.functionname} (${this.context.filepath}:${this.context.linenumber}:1)").to.deep.equal(${s.rhs})`
                }
            })
            .map(x => '\n        ' + x)
            .join('')
        return `it(${this.getName()}, () => {${script}\n})`
    }

    private getName() {
        return JSON.stringify(this.context.testname ?? this.context.functionname)
    }


}