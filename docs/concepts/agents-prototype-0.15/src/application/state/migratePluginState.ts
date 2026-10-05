import type { Agent } from '../../domain/agents/types'
import type { PluginState } from '../../domain/shared/PluginState'
import { cloneData } from '../../domain/shared/cloneData'
import { modelAppearance } from '../../domain/characters/appearance'
import { findCharacterModel } from '../../domain/characters/rules'
import { BUILTIN_CHARACTER_PACKS, BUILTIN_CHARACTER_STYLES } from '../bootstrap/characterDefaults'
import type { Diagnostic } from '../shared/Result'

export const CURRENT_SCHEMA_VERSION = '1.4.0'
const LEGACY_MODELS: Readonly<Record<string, string>> = {
  'voxel-human-v1': 'voxel-human-v2', 'voxel-operator-v1': 'voxel-operator-v2',
  'voxel-scholar-v1': 'voxel-scholar-v2', 'voxel-builder-v1': 'voxel-builder-v2'
}
/** Internal only: the codec performs a complete legacy shape check before this migration. */
export function migrateValidatedState(input: PluginState): { state: PluginState; diagnostics: Diagnostic[] } {
  const state = cloneData(input)
  const diagnostics: Diagnostic[] = []
  if (state.schemaVersion === CURRENT_SCHEMA_VERSION) return { state, diagnostics }
  const from = state.schemaVersion
  const migrateAppearance = (agent: Agent) => {
    const old = agent.appearance
    const requested = old?.modelId ?? agent.model
    const modelId = LEGACY_MODELS[requested] ?? requested
    // Unknown recipes remain visible to semantic validation; never silently replace a user's model.
    const model = findCharacterModel(modelId)
    if (!model) return
    agent.appearance = { ...modelAppearance(model.id, { primaryColor: agent.color }), ...old,
      modelId: model.id, category: old?.category ?? model.category,
      parts: { ...model.defaultParts, ...old?.parts } }
    agent.model = model.id
    agent.color = agent.appearance.primaryColor
  }
  state.agents.forEach(migrateAppearance)
  state.versions.forEach(version => migrateAppearance(version.snapshot))
  state.characterStyles ??= cloneData(BUILTIN_CHARACTER_STYLES) as PluginState['characterStyles']
  state.characterPacks ??= cloneData(BUILTIN_CHARACTER_PACKS) as PluginState['characterPacks']
  state.schemaVersion = CURRENT_SCHEMA_VERSION
  diagnostics.push({ code: 'state.migrated', severity: 'info', path: 'schemaVersion', message: `Migrated schema ${from} to ${CURRENT_SCHEMA_VERSION}. Existing fields were preserved.` })
  return { state, diagnostics }
}
