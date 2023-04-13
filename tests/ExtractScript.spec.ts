import {describe} from 'mocha'
import {expect} from 'chai'
import ExtractComments from "../src/ExtractComments";
import {ScriptExtraction} from "../src/ScriptExtraction";

describe("ExtractComments", () => {

    describe("getComments", () => {
        it("should return correct line numbers", () => {

            const code = `
            class A {
            
            /**
            * some actual comment about x()
            * 
            * A.x() // => 42
            *
            * A.x() + 1 // => 43
            * A.x() - 1 // => 41
            *
            * // should equal 2 * 21
            * A.x() // => 21 * 2
            */
            static x() {
              return 42
            }
            }
            `

            const comments = new ExtractComments("testfile.ts", code).getComments()
            expect(comments.length).to.eq(1)
            expect(comments[0].context).to.deep.eq(
                {
                    filepath: "testfile.ts",
                    classname: "A",
                    functionname: "x",
                    linenumber: 3
                }
            )
        })
    })
})

describe("ScriptExtraction", () => {
    describe("extractScripts", () => {
        it("Should have correct line numbers", () => {

            const comment = `some actual comment about x()

A.x() // => 42

A.x() + 1 // => 43
A.x() - 1 // => 41

// should equal 2 * 21
A.x() // => 21 * 2`


            const scripts = ScriptExtraction.extractScripts(comment)
            expect(scripts.length).eq(3)
            const [doctest0, doctest1, doctest2shouldEqual] = scripts;
            expect(doctest0).to.deep.eq({
                script: [{tag: '==', lhs: 'A.x()', rhs: "42", line: 0}],
                name: undefined,
                line: 2
            })

            expect(doctest1).to.deep.eq({
                script: [{tag: '==', lhs: 'A.x() + 1', rhs: "43", line: 0}, {
                    tag: '==',
                    lhs: 'A.x() - 1',
                    rhs: "41",
                    line: 1
                }],
                name: undefined,
                line: 4
            })

            expect(doctest2shouldEqual).to.deep.eq({
                script: [{tag: '==', lhs: 'A.x()', rhs: "21 * 2", line: 0}],
                name: "should equal 2 * 21",
                line: 7
            })
        })
    })
})