import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { compileCore, projectRoot } from './compile-core.mjs'
const require = createRequire(import.meta.url)
const build = compileCore()
try {
  const { stateShape } = require(path.join(build.output, 'application/validation/stateShapes.js'))
  const { packShape } = require(path.join(build.output, 'application/validation/characterShapes.js'))
  const { CURRENT_SCHEMA_VERSION } = require(path.join(build.output, 'application/state/migratePluginState.js'))
  const state = stateShape().jsonSchema
  state.properties.schemaVersion = { const: CURRENT_SCHEMA_VERSION }
  const generated = [
    ['agent-definition.schema.json', `agent-definition-${CURRENT_SCHEMA_VERSION}`, 'Agents Plugin Definition', state],
    ['character-pack.schema.json', 'character-pack-1', 'Agents Character Pack', packShape.jsonSchema]
  ]
  for (const [name, id, title, shape] of generated) {
    const text = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `https://agents.local/schema/${id}.json`, title,
      $comment: 'Generated from application runtime shapes. Runtime validation additionally checks references, recipe compatibility, input size/depth, and reserved keys.',
      ...shape
    }, null, 2) + '\n'
    const file = path.join(projectRoot, 'schema', name)
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) throw new Error(`Generated schema is stale: ${name}. Run npm run schema:generate.`)
    } else fs.writeFileSync(file, text)
  }
  console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} ${generated.length} schemas from strict runtime shapes.`)
} finally { build.cleanup() }
