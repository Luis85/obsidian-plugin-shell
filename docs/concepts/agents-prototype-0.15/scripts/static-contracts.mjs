import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { selectedCode, fingerprint } from './source-contract-utils.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/model-builder-contracts.json'), 'utf8'))
const failures = []
for (const contract of fixture.contracts) {
  const hash = fingerprint(selectedCode(path.join(root, contract.file), contract.selector), contract.replacements)
  if (hash !== contract.baseline) failures.push(contract.label)
}
if (failures.length) throw new Error(`Preserved authored model contracts changed: ${failures.join(', ')}. Review intended changes against the renderer tests before updating the baseline.`)
console.log(`Static model contracts passed: ${fixture.contracts.length} authored bodies match the uploaded baseline. This does not execute Three.js.`)
