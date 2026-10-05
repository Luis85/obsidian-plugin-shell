import { cloneAgent, createVariant, nextPatch } from '../../domain/agents/agent'
import type { AgentRelation } from '../../domain/relations/types'
import type { ReadonlyState } from '../../domain/shared/ReadonlyState'
import type { CommandServices } from '../ports/ApplicationServices'
import { CommandError, nextId, requireAgent, requireName, transact } from '../shared/transaction'

export function createAgentCommands({ clock, ids }: CommandServices) {
  return {
    addSpecialist: (state: ReadonlyState, baseId: string) => transact(state, draft => {
      const base = requireAgent(draft, baseId)
      const copy = createVariant(base, 'New Specialist', nextId(ids, 'agent', draft))
      copy.name = 'New Specialist'
      let suffix = draft.agents.length + 1
      while (draft.agents.some(agent => agent.slug === `specialist-${suffix}`)) suffix++
      copy.slug = `specialist-${suffix}`
      delete copy.variantLabel
      draft.agents.push(copy)
      return { value: copy.id, selectedAgentId: copy.id }
    }),
    addVariant: (state: ReadonlyState, sourceId: string, label = 'Variant') => transact(state, draft => {
      const source = requireAgent(draft, sourceId)
      const copy = createVariant(source, requireName(label, 'variantLabel'), nextId(ids, 'agent', draft))
      const baseSlug = copy.slug
      let suffix = 2
      while (draft.agents.some(agent => agent.slug === copy.slug)) copy.slug = `${baseSlug}-${suffix++}`
      draft.agents.push(copy)
      draft.relations.push({ id: nextId(ids, 'rel', draft), fromAgentId: copy.id, toAgentId: source.id, type: 'inherits-from', description: `Variant of ${source.name}` })
      return { value: copy.id, selectedAgentId: copy.id }
    }),
    snapshotAgent: (state: ReadonlyState, agentId: string, note = 'Manual snapshot') => transact(state, draft => {
      const agent = requireAgent(draft, agentId)
      if (!/^\d+\.\d+\.\d+$/.test(agent.version)) throw new CommandError('agent.invalid-version', 'Use a numeric semantic version before creating a snapshot.', `agents.${agentId}.version`)
      const id = nextId(ids, 'ver', draft)
      const createdAt = clock.now()
      if (!/^\d{4}-\d{2}-\d{2}T/.test(createdAt) || !Number.isFinite(Date.parse(createdAt))) throw new CommandError('clock.invalid', 'The clock service did not return a valid timestamp.')
      draft.versions.unshift({ id, agentId, version: agent.version, createdAt, note, snapshot: cloneAgent(agent) })
      agent.version = nextPatch(agent.version)
      return { value: id }
    }),
    addRelation: (state: ReadonlyState, relation: Omit<AgentRelation, 'id'>) => transact(state, draft => {
      const source = requireAgent(draft, relation.fromAgentId)
      requireAgent(draft, relation.toAgentId)
      if (relation.fromAgentId === relation.toAgentId) throw new CommandError('relation.self', 'Choose two different agents for a relation.')
      const types: AgentRelation['type'][] = ['delegates-to', 'consults', 'supervises', 'inherits-from', 'shares-memory-with', 'uses-output-of', 'reviews']
      if (!types.includes(relation.type)) throw new CommandError('relation.type', 'Choose a supported relation type.')
      if (draft.relations.some(item => item.fromAgentId === relation.fromAgentId && item.toAgentId === relation.toAgentId && item.type === relation.type)) throw new CommandError('relation.duplicate', 'This relation already exists.')
      if (relation.type === 'inherits-from') {
        if (source.variantOf && source.variantOf !== relation.toAgentId) throw new CommandError('relation.inheritance', 'This agent already inherits from a different base.')
        const visited = new Set([source.id])
        let parent: string | undefined = relation.toAgentId
        while (parent) {
          if (visited.has(parent)) throw new CommandError('relation.cycle', 'Inheritance must not contain a cycle.')
          visited.add(parent)
          parent = draft.agents.find(agent => agent.id === parent)?.variantOf
        }
        const base = requireAgent(draft, relation.toAgentId)
        source.variantOf = base.id
        source.inheritance = { baseAgentId: base.id, baseVersion: base.version, overridePaths: source.inheritance?.overridePaths ?? [] }
      }
      const value = { ...relation, id: nextId(ids, 'rel', draft) }
      draft.relations.push(value)
      return { value: value.id }
    })
  }
}
