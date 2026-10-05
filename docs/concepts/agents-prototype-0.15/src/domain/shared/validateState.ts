import type { PluginState } from '../shared/PluginState'
import type { ValidationIssue } from '../shared/ValidationIssue'
import { CHARACTER_ACCESSORY_RULES as CHARACTER_ACCESSORIES } from '../characters/accessoryRules'
import { CHARACTER_MODEL_RULES as CHARACTER_MODELS } from '../characters/modelRules'
import { CHARACTER_PART_RULES as CHARACTER_PARTS } from '../characters/partRules'
import { characterModel } from '../characters/rules'

export const validateState = (state: PluginState): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  const error = (id: string, path: string, message: string) => issues.push({ id, severity: 'error', path, message })
  const warning = (id: string, path: string, message: string) => issues.push({ id, severity: 'warning', path, message })
  if (!/^\d+\.\d+\.\d+$/.test(state.schemaVersion)) error('schema.version', 'schemaVersion', 'Use an explicit semantic schema version.')

  const ids = new Set<string>()
  const entities: { id: string; path: string }[] = [
    ...state.agents.map(x => ({ id: x.id, path: `agents.${x.id}` })),
    ...state.roles.map(x => ({ id: x.id, path: `roles.${x.id}` })),
    ...state.skills.map(x => ({ id: x.id, path: `skills.${x.id}` })),
    ...state.tools.map(x => ({ id: x.id, path: `tools.${x.id}` })),
    ...state.dataSources.map(x => ({ id: x.id, path: `dataSources.${x.id}` })),
    ...state.guardrails.map(x => ({ id: x.id, path: `guardrails.${x.id}` })),
    ...(state.characterStyles??[]).map(x => ({ id: x.id, path: `characterStyles.${x.id}` })),
    ...(state.characterPacks??[]).map(x => ({ id: x.id, path: `characterPacks.${x.id}` }))
  ]
  for (const entity of entities) {
    if (!entity.id) error('entity.id', entity.path, 'Entity needs a stable ID.')
    else if (ids.has(entity.id)) error('entity.duplicate', entity.path, `Duplicate ID: ${entity.id}`)
    else ids.add(entity.id)
  }

  const agentIds = new Set(state.agents.map(a => a.id))
  const roleIds = new Set(state.roles.map(r => r.id))
  const skillIds = new Set(state.skills.map(s => s.id))
  const toolIds = new Set(state.tools.map(t => t.id))
  const sourceIds = new Set(state.dataSources.map(s => s.id))
  const guardrailIds = new Set(state.guardrails.map(g => g.id))
  const partIds = new Set(CHARACTER_PARTS.map(p=>p.id))
  const styleIds = new Set((state.characterStyles??[]).map(s=>s.id))
  const packIds = new Set((state.characterPacks??[]).map(p=>p.id))

  for (const agent of state.agents) {
    if (!roleIds.has(agent.roleId)) error('agent.role', `agents.${agent.id}.roleId`, `Unknown role: ${agent.roleId}`)
    agent.skillIds.filter(id => !skillIds.has(id)).forEach(id => error('agent.skill', `agents.${agent.id}.skillIds`, `Unknown skill: ${id}`))
    agent.toolIds.filter(id => !toolIds.has(id)).forEach(id => error('agent.tool', `agents.${agent.id}.toolIds`, `Unknown tool: ${id}`))
    agent.dataSourceIds.filter(id => !sourceIds.has(id)).forEach(id => error('agent.source', `agents.${agent.id}.dataSourceIds`, `Unknown data source: ${id}`))
    agent.guardrailIds.filter(id => !guardrailIds.has(id)).forEach(id => error('agent.guardrail', `agents.${agent.id}.guardrailIds`, `Unknown guardrail: ${id}`))
    if (agent.variantOf && !agentIds.has(agent.variantOf)) error('agent.variant', `agents.${agent.id}.variantOf`, `Unknown base agent: ${agent.variantOf}`)

    const model = CHARACTER_MODELS.find(item => item.id === agent.appearance.modelId)
    if (!model) error('agent.appearance.model', `agents.${agent.id}.appearance.modelId`, `Unknown character model: ${agent.appearance.modelId}`)
    else if (model.category !== agent.appearance.category) error('agent.appearance.category', `agents.${agent.id}.appearance.category`, `Model ${model.id} belongs to ${model.category}, not ${agent.appearance.category}.`)
    if (agent.appearance.packId && !packIds.has(agent.appearance.packId)) warning('agent.appearance.pack', `agents.${agent.id}.appearance.packId`, `Unknown character pack: ${agent.appearance.packId}`)
    if (agent.appearance.teamStyleId && !styleIds.has(agent.appearance.teamStyleId)) warning('agent.appearance.style', `agents.${agent.id}.appearance.teamStyleId`, `Unknown team style: ${agent.appearance.teamStyleId}`)
    if (agent.appearance.scale < 0.75 || agent.appearance.scale > 1.3) warning('agent.appearance.scale', `agents.${agent.id}.appearance.scale`, 'Character scale should remain between 0.75 and 1.3.')

    if(model){
      for(const [slot,id] of Object.entries(agent.appearance.parts??{})){
        const part=CHARACTER_PARTS.find(item=>item.id===id)
        if(!part) error('agent.appearance.part',`agents.${agent.id}.appearance.parts.${slot}`,`Unknown character part: ${id}`)
        else if(part.slot!==slot) error('agent.appearance.part-slot',`agents.${agent.id}.appearance.parts.${slot}`,`${part.id} belongs to ${part.slot}, not ${slot}.`)
        else if(!part.categories.includes(agent.appearance.category)||!part.silhouettes.includes(characterModel(agent.appearance.modelId).silhouette)) warning('agent.appearance.part-compatibility',`agents.${agent.id}.appearance.parts.${slot}`,`${part.id} is not compatible with ${agent.appearance.category}/${model.silhouette}.`)
      }
    }
    for(const requiredPart of Object.values(model?.defaultParts??{})) if(requiredPart&&!partIds.has(requiredPart)) error('character.model.recipe',`characterModels.${model?.id}`,`Preset references missing part ${requiredPart}.`)
    agent.appearance.accessoryIds.forEach(id => { const accessory = CHARACTER_ACCESSORIES.find(item => item.id === id); if (!accessory) error('agent.appearance.accessory', `agents.${agent.id}.appearance.accessoryIds`, `Unknown accessory: ${id}`); else if (!accessory.categories.includes(agent.appearance.category)) warning('agent.appearance.accessory-category', `agents.${agent.id}.appearance.accessoryIds`, `${accessory.id} is not compatible with ${agent.appearance.category}.`) })
    if (!agent.invocation.handoffDescription.trim()) warning('agent.routing', `agents.${agent.id}.invocation.handoffDescription`, 'Add a routing/handoff description so other agents know when to delegate here.')
    if (!agent.evals.length) warning('agent.evals', `agents.${agent.id}.evals`, 'No executable scenario evals are defined.')
  }

  for(const pack of state.characterPacks??[]){
    pack.modelIds.filter(id=>!CHARACTER_MODELS.some(model=>model.id===id)).forEach(id=>warning('character.pack.model',`characterPacks.${pack.id}.modelIds`,`Pack references unavailable model ${id}.`))
    pack.partIds.filter(id=>!partIds.has(id)).forEach(id=>warning('character.pack.part',`characterPacks.${pack.id}.partIds`,`Pack references unavailable part ${id}.`))
    pack.stylePresetIds.filter(id=>!styleIds.has(id)).forEach(id=>warning('character.pack.style',`characterPacks.${pack.id}.stylePresetIds`,`Pack references unavailable style ${id}.`))
  }

  for (const relation of state.relations) if (!agentIds.has(relation.fromAgentId) || !agentIds.has(relation.toAgentId)) error('relation.target', `relations.${relation.id}`, 'Relation references an unknown agent.')
  state.tools.filter(t => t.risk === 'high' && t.approval === 'never').forEach(t => warning('tool.approval', `tools.${t.id}`, 'High-risk tool has no approval policy.'))
  return issues
}
