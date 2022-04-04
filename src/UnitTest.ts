import {Context} from "./ExtractComments";
import {ScriptExtraction} from "./ScriptExtraction";

export type Script = (Statement | Equality)[]
export interface Equality {
    tag: '=='
    lhs: string
    rhs: string,
    line: number
}

export interface Statement {
    tag: 'Statement'
    stmt: string
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
                    return `__expect(${s.lhs}, "failed at ${this.context.functionname} (${this.context.filepath}:${s.line}:1)").to.deep.equal(${s.rhs})`
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