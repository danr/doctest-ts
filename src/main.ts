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
    if (directory === undefined) {
        console.log("Usage: doctest-ts-improved <directory under test>. This will automatically scan recursively for '.ts'-files, excluding 'node_modules' '*.doctest.ts'-files")
    }

    const files = readDirRecSync(directory)
        .filter(p => p.endsWith(".ts"))
        .filter(p => p.indexOf("/node_modules/") < 0 && !p.endsWith(".doctest.ts"))
    const noTests: string[] = []
    for (let i = 0; i < files.length; i++){
        const file = files[i];
        process.stdout.write(`\r (${i}/${files.length}) inspecting ${file}                                     \r`)
        const generated = new TestCreator(file).createTest()
        if (generated === 0) {
            noTests.push(file)
        } else {
            console.log("Generated tests for " + file + " (" + generated + " tests found)")
        }
    }
    if (noTests.length > 0) {
        console.log(`No tests found in ${noTests.length} files: ${noTests.join(", ")}`)
    }
}

main()