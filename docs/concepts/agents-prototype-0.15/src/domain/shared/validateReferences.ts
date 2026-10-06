import type { PluginState } from './PluginState'
import type { ValidationIssue } from './ValidationIssue'
import { validateAppearance, validateCharacterPack } from '../characters/validateAppearance'

/** Referential integrity that was missing from the original configuration validator. */
export function validateReferences(state: PluginState): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const error = (id: string, path: string, message: string) => issues.push({ id, severity: 'error', path, message })
  if (!state.agents.length) error('state.agents-empty', 'agents', 'The editor requires at least one agent in a workspace.')
  const ids = new Set<string>()
  for (const [collection, value] of Object.entries(state)) if (Array.isArray(value)) {
    for (const entry of value) {
      if (ids.has(entry.id)) error('entity.duplicate', `${collection}.${entry.id}`, `Duplicate global entity ID: ${entry.id}.`)
      ids.add(entry.id)
    }
  }
  const agentIds = new Set(state.agents.map(item => item.id))
  const known = (collection: readonly { id: string }[], values: readonly string[], path: string) => {
    const available = new Set(collection.map(item => item.id))
    for (const id of values) if (!available.has(id)) error('reference.unknown', path, `Unknown reference: ${id}.`)
  }
  const slugs = new Set<string>()
  for (const agent of state.agents) {
    if (!agent.name.trim()) error('agent.name', `agents.${agent.id}.name`, 'An agent needs a name.')
    if (!agent.slug.trim() || slugs.has(agent.slug)) error('agent.slug', `agents.${agent.id}.slug`, 'Agent slugs must be nonempty and unique.')
    slugs.add(agent.slug)
    known(state.instructionLayers, agent.instructionLayerIds, `agents.${agent.id}.instructionLayerIds`)
    issues.push(...validateAppearance(agent.appearance, `agents.${agent.id}.appearance`))
    if (agent.model !== agent.appearance.modelId || agent.color !== agent.appearance.primaryColor) error('agent.appearance-alias', `agents.${agent.id}`, 'Legacy model/color fields must agree with appearance.')
    if (agent.inheritance && agent.inheritance.baseAgentId !== agent.variantOf) error('agent.inheritance', `agents.${agent.id}.inheritance`, 'Inheritance metadata must match variantOf.')
    const visited = new Set<string>([agent.id])
    let parent = agent.variantOf
    while (parent) {
      if (visited.has(parent)) { error('agent.inheritance-cycle', `agents.${agent.id}.variantOf`, 'Inheritance cannot contain a cycle.'); break }
      visited.add(parent)
      parent = state.agents.find(item => item.id === parent)?.variantOf
    }
  }
  for (const role of state.roles) {
    known(state.skills, role.defaultSkillIds, `roles.${role.id}.defaultSkillIds`)
    known(state.tools, role.defaultToolIds, `roles.${role.id}.defaultToolIds`)
  }
  for (const skill of state.skills) known(state.tools, skill.allowedToolIds, `skills.${skill.id}.allowedToolIds`)
  for (const guardrail of state.guardrails) known(state.tools, guardrail.toolIds ?? [], `guardrails.${guardrail.id}.toolIds`)
  for (const tool of state.tools) if (tool.mcpServerId) known(state.mcpServers, [tool.mcpServerId], `tools.${tool.id}.mcpServerId`)
  for (const pack of state.characterPacks) issues.push(...validateCharacterPack(pack).map(issue => ({ ...issue, path: `characterPacks.${pack.id}.${issue.path}` })))
  const relations = new Set<string>()
  for (const relation of state.relations) {
    const key = `${relation.fromAgentId}|${relation.type}|${relation.toAgentId}`
    if (relations.has(key)) error('relation.duplicate', `relations.${relation.id}`, 'Duplicate relation.')
    relations.add(key)
    if (relation.fromAgentId === relation.toAgentId) error('relation.self', `relations.${relation.id}`, 'A relation must connect two different agents.')
    if (relation.type === 'inherits-from' && state.agents.find(agent => agent.id === relation.fromAgentId)?.variantOf !== relation.toAgentId) error('relation.inheritance', `relations.${relation.id}`, 'An inheritance relation must agree with variantOf.')
  }
  for (const version of state.versions) {
    if (!agentIds.has(version.agentId) || version.snapshot.id !== version.agentId) error('version.agent', `versions.${version.id}`, 'A snapshot must identify an existing agent.')
    if (version.version !== version.snapshot.version) error('version.version', `versions.${version.id}`, 'The snapshot version must match its envelope.')
    if (!Number.isFinite(Date.parse(version.createdAt))) error('version.timestamp', `versions.${version.id}.createdAt`, 'Expected a valid timestamp.')
    issues.push(...validateAppearance(version.snapshot.appearance, `versions.${version.id}.snapshot.appearance`))
  }
  return issues
}
