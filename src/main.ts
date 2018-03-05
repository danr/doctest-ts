#!/usr/bin/env node
import * as chokidar from 'chokidar'
import * as minimist from 'minimist'
import {instrument, showScriptInstances} from './internal'
function main() {
  const outputs = Object.keys(showScriptInstances)
  const flags = outputs.map(f => '--' + f)
  const boolean = ['watch'].concat(outputs)
  const opts = minimist(process.argv.slice(2), {boolean})
  let output: string | null = null
  let error: string | null = null
  outputs.forEach(k => {
    if (opts[k]) {
      if (output != null) {
        error = `Cannot output both ${output} and ${k}`
      }
      output = k
    }
  })
  if (output == null) {
    error = `Choose an output from ${flags.join(' ')}`
  }
  const files = opts._
  if (files.length == 0 || output == null) {
    console.error(
      `
      Error: ${error || `No files specified!`}

      Usage:

        ${flags.join('|')} [-w|--watch] files globs...

    Your options were:`,
      opts,
      `
    From:`,
      process.argv
    )
    return
  }
  const d = showScriptInstances[output]
  files.forEach(file => instrument(d, file))
  if (opts.w == true || opts.watch == true) {
    const watcher = chokidar.watch(files, {ignored: '*.doctest.*'})
    watcher.on('change', file => global.setTimeout(() => instrument(d, file, 'watch'), 25))
  }
}

main()
