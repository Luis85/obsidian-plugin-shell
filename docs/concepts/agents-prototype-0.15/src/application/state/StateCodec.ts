import type { PluginState } from '../../domain/shared/PluginState'
import type { CharacterPackDefinition } from '../../domain/characters/types'
import { validateState } from '../../domain/shared/validateState'
import { validateReferences } from '../../domain/shared/validateReferences'
import { validateCharacterPack } from '../../domain/characters/validateAppearance'
import { cloneData } from '../../domain/shared/cloneData'
import { failure, failureWith, success, type Diagnostic, type Result } from '../shared/Result'
import { inspectData, checkShape, isRecord } from '../validation/shape'
import { stateShape } from '../validation/stateShapes'
import { packShape } from '../validation/characterShapes'
import { CURRENT_SCHEMA_VERSION, migrateValidatedState } from './migratePluginState'

const currentShape = stateShape()
const legacyShape = stateShape(true)

export const MAX_IMPORT_CHARACTERS = 5 * 1024 * 1024
export function parseJson(text: string): Result<unknown> {
  if (text.length > MAX_IMPORT_CHARACTERS) return failure('import.too-large', 'The import exceeds the 5 Mi-character limit.', undefined, 'import')
  try { return success(JSON.parse(text) as unknown) }
  catch { return failure('import.invalid-json', 'This is not valid JSON. Check commas, quotes and closing brackets.', undefined, 'import') }
}
const diagnosticsFor = (issues: ReturnType<typeof validateState>): Diagnostic[] => issues.map(issue => ({ code: issue.id, severity: issue.severity, path: issue.path, message: issue.message }))
export function decodeState(input: unknown): Result<PluginState> {
  try {
    const safety = inspectData(input)
    if (safety.length) return failureWith(safety)
    if (!isRecord(input) || typeof input.schemaVersion !== 'string') return failure('schema.missing', 'A state import needs an explicit schemaVersion.', 'schemaVersion', 'import')
    const match = /^1\.([0-4])\.0$/.exec(input.schemaVersion)
    if (!match) return failure('schema.unsupported', `Supported schemas are 1.0.0 through ${CURRENT_SCHEMA_VERSION}; this version will not be downgraded.`, 'schemaVersion', 'import')
    const before = checkShape(input.schemaVersion === CURRENT_SCHEMA_VERSION ? currentShape : legacyShape, input)
    if (before.length) return failureWith(before)
    const migrated = migrateValidatedState(input as unknown as PluginState)
    const after = checkShape(currentShape, migrated.state)
    if (after.length) return failureWith(after)
    const issues = diagnosticsFor([...validateState(migrated.state), ...validateReferences(migrated.state)])
    if (issues.some(issue => issue.severity === 'error')) return failureWith(issues)
    return success(migrated.state, [...migrated.diagnostics, ...issues])
  } catch {
    return failure('import.unreadable', 'The state cannot be read as plain data. The current workspace was not changed.', undefined, 'import')
  }
}
export function decodeStateJson(text: string): Result<PluginState> {
  const parsed = parseJson(text)
  return parsed.ok ? decodeState(parsed.value) : parsed
}
export function decodeCharacterPack(input: unknown): Result<CharacterPackDefinition> {
  try {
    const safety = inspectData(input)
    if (safety.length) return failureWith(safety)
    const shapeIssues = checkShape(packShape, input)
    if (shapeIssues.length) return failureWith(shapeIssues)
    const pack = cloneData(input) as CharacterPackDefinition
    const issues = diagnosticsFor(validateCharacterPack(pack))
    return issues.some(issue => issue.severity === 'error') ? failureWith(issues) : success(pack, issues)
  } catch { return failure('pack.unreadable', 'The pack cannot be read as plain data. Nothing was imported.', undefined, 'import') }
}
