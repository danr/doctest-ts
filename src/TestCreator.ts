import UnitTest from "./UnitTest";
import * as ts from "typescript";
import ExtractComments from "./ExtractComments";
import * as fs from 'fs'
import * as path from 'path'

/**
 * Responsible for creating a '.doctest.ts'-file
 */
export default class TestCreator {
    private _originalFilepath: string;

    constructor(originalFilepath: string) {
        this._originalFilepath = originalFilepath;
        if (originalFilepath.includes('doctest')) {
            throw "Not creating a doctest for a file which already is a doctest"
        }
    }

    private static exposePrivates(s: string): string {
        const ast = ts.createSourceFile('_.ts', s, ts.ScriptTarget.Latest) as ts.SourceFile

        const transformer = <T extends ts.Node>(context: ts.TransformationContext) =>
            (rootNode: T) => {
                function visit(node: ts.Node): ts.Node {
                    if (node.kind === ts.SyntaxKind.PrivateKeyword) {
                        return ts.createModifier(ts.SyntaxKind.PublicKeyword)
                    }
                    return ts.visitEachChild(node, visit, context);
                }

                return ts.visitNode(rootNode, visit);
            };

        const transformed = ts.transform(ast, [transformer]).transformed[0]

        const pwoc = ts.createPrinter({removeComments: false})
        return pwoc.printNode(ts.EmitHint.Unspecified, transformed, ast)
    }


    private static testCode(tests: UnitTest[]): string[] {
        const code: string[] = []
        const exportedTests = new Set<UnitTest>()
       
        function show(s: string) {
            return JSON.stringify(s)
        }

        function emit(test: UnitTest, indent: string = "") {
            if (exportedTests.has(test)) {
                return;
            }
            const testCode = "\n" + test.generateCode()
            code.push(testCode.replace(/\n/g, "\n" + indent))
            exportedTests.add(test)
        }

        function emitAllForFunction(functionname: string | undefined, indent: string) {
            tests.filter(t => t.context.functionname === functionname).forEach(c => emit(c, "    " + indent))
        }

        function emitAllForClass(classname: string | undefined, indent: string) {
            const forClass: UnitTest[] = tests.filter(t => t.context.classname === classname)
            for (const test of forClass) {
                if (exportedTests.has(test)) {
                    continue
                }  
                
                if (test.context.functionname !== undefined) {
                    code.push(indent+"describe(" + show(test.context.functionname) + ", () => {")
                    emitAllForFunction(test.context.functionname, "    " + indent)
                    code.push(indent+"})")
                }
                
            }
            emitAllForFunction(undefined, indent)
        }

        for (const test of tests) {
            if (exportedTests.has(test)) {
                continue
            }
            if (test.context.classname !== undefined) {
                code.push("describe(" + show(test.context.classname) + ", () => {")
                emitAllForClass(test.context.classname, "    ")
                code.push("})")
            }
        }

        emitAllForClass(undefined, "")
        return code
    }

    /**
     * Creates a new file with the doctests.
     *
     * Returns the number of found tests
     */
    public createTest(): number {
        const file = this._originalFilepath
        const {base, ext, ...u} = path.parse(file)
        const buffer = fs.readFileSync(file, {encoding: 'utf8'})
        const comments = new ExtractComments(file, buffer).getComments()
        const tests: UnitTest[] = UnitTest.FromComments(comments)

        const outfile = path.format({...u, ext: '.doctest' + ext})
        if (tests.length == 0) {
            return 0
        }

        const code = []
        const imports = new Set<string>()
        for (const test of tests) {
            test.getImports().forEach(i => imports.add(i))
        }

        // Add imports needed by the tests
        code.push(...Array.from(imports))
        // Adds the original code where the private keywords are removed
        code.push(TestCreator.exposePrivates(buffer))

        // At last, we add all the doctests
        code.push(...TestCreator.testCode(tests))

        fs.writeFileSync(outfile, code.join("\n"))
        return tests.length
    }


}