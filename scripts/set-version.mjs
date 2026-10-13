import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../plugins/unmean/.claude-plugin/plugin.json', import.meta.url)
writeFileSync(file, readFileSync(file, 'utf8').replace(/"version": "[^"]*"/, `"version": "${process.argv[2]}"`))
