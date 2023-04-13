#!/usr/bin/env node
import {lstatSync, readdirSync} from "fs";
import TestCreator from "./TestCreator";


function readDirRecSync(path: string, maxDepth = 999): string[] {
    const result = []
    if (maxDepth <= 0) {
        return []
    }
    for (const entry of readdirSync(path)) {
        const fullEntry = path + "/" + entry
        const stats = lstatSync(fullEntry)
        if (stats.isDirectory()) {
            // Subdirectory
            // @ts-ignore
            result.push(...readDirRecSync(fullEntry, maxDepth - 1))
        } else {
            result.push(fullEntry)
        }
    }
    return result;
}

function main() {

    const args = process.argv
    console.log(args.join(","))
    const directory = args[2].replace(/\/$/, "")
    if (directory === "--require") {
        console.error("Probably running the testsuite, detects '--require' as second argument. Quitting now")
        return;
    }

    const argv = require('process-yargs-parser')(process.argv.slice(2),  { "duplicate-arguments-array": true})
    if (directory === undefined) {
        console.log("Usage: doctest-ts-improved <directory under test> [--ignore regexp]. This will automatically scan recursively for '.ts'-files, excluding 'node_modules' and '*.doctest.ts'-files.")
    }

    let blacklistPatterns: string | string[] = argv["ignore"]

    let files = readDirRecSync(argv._[0])
        .filter(p => p.endsWith(".ts"))
        .filter(p => p.indexOf("/node_modules/") < 0 && !p.endsWith(".doctest.ts"))

    if (blacklistPatterns !== undefined) {
        if(typeof blacklistPatterns === "string"){
            blacklistPatterns = [blacklistPatterns]
        }
        const ignored: string[] = []
        files = files.filter(p => {
            const isIgnored = (<string[]>blacklistPatterns).some(blacklistPattern => p.match(new RegExp(blacklistPattern)) !== null);
            if (isIgnored) {
                ignored.push(p)
            }
            return !isIgnored
        })
        if(argv.verbose){
            console.log("Ignored the following files as they match the ignore pattern",blacklistPatterns.join(","),"\n", ignored.join(", "))
        }
    }

    const noTests: string[] = []
    let totalTests = 0
    let totalFilesWithTests = 0
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        process.stdout.write(`\r (${i}/${files.length}) inspecting ${file}                                     \r`)
        const generated = new TestCreator(file).createTest()
        if (generated === 0) {
            noTests.push(file)
        } else {
            totalFilesWithTests++
            totalTests += generated
            console.log("Generated tests for " + file + " (" + generated + " tests found)")
        }
    }
    console.log(`Generated tests for ${totalFilesWithTests} containing ${totalTests} tests in total. ${Math.round(100 * totalFilesWithTests / (totalFilesWithTests + noTests.length))}% of the files have test`)
    if (noTests.length > 0) {
        const i = Math.round(Math.random() * noTests.length)
        const randomFile = noTests[i]
        console.log(`No tests found in ${noTests.length} files. We suggest making a test for ${randomFile} - it'll benefit from it?`)
    }
}

main()