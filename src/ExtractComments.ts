import * as ts from "typescript";
import {JSDocComment} from "typescript";
import {SyntaxKind} from "typescript/lib/tsserverlibrary";

export interface Context {
    filepath: string,
    linenumber?: number,
    classname?: string,
    functionname?: string,
    testname?: string
}

/**
 * Responsible for extracting the testfiles from the .ts files
 *
 */
export default class ExtractComments {

    private readonly results: { comment: string, context: Context }[] = []
    private readonly code: string;

    constructor(filepath: string, code: string) {
        this.code = code;
        const ast = ts.createSourceFile('_.ts', code, ts.ScriptTarget.Latest)
        this.traverse(ast, {filepath: filepath})
    }

    /**
     * Gets the actual comments and their context.
     */
    public getComments(): { comment: string, context: Context }[] {
        return this.results
    }

    private getLineNumber(pos: number) {
        let line = 0;
        for (let i = 0; i < pos; i++) {
            if (this.code[i] === "\n") {
                line++
            }
        }
        return line;
    }

    private registerComment(context: Context, comment: string | ts.NodeArray<JSDocComment> | undefined, position: number) {
        if (comment === undefined) {
            return
        }
        context = {...context, linenumber: this.getLineNumber(position)}
        if (typeof comment === "string") {
            this.results.push({comment: comment || '', context});
        } else {
            comment.forEach(jsDocComment => {
                this.results.push({comment: jsDocComment.text || '', context});
            })
        }
    }

    private traverse(node: ts.Node, context: Context) {
        if (SyntaxKind.ClassDeclaration === node.kind) {
            context = {...context, classname: (node as any)["name"].escapedText};
        }
        const jsdocs = (node as any).jsDoc || []
        if (jsdocs.length > 0) {
            let declName = undefined
            try {
                declName = (node as any).name.escapedText
            } catch (e) {
                try {
                    const decls = (node as any).declarationList.declarations
                    if (decls.length == 1) {
                        declName = decls[0].name.escapedText || null
                    }
                } catch (e) {
                    declName = ts.isConstructorDeclaration(node) ? 'constructor' : undefined
                }
            }

            context = {...context, functionname: declName}

            jsdocs.forEach((doc: ts.JSDoc) => {
                this.registerComment(context, doc.comment, doc.pos)

                // A part of the comment might be in the tags; we simply add those too and figure out later if they contain doctests
                const tags = doc.tags;
                if (tags !== undefined) {
                    tags.forEach(tag => {
                        this.registerComment(context, tag.comment, tag.pos)
                    });
                }
            })

        }


        ts.forEachChild(node, n => this.traverse(n, context))
    }


}