import { describe, expect, it } from 'vitest'
import { createAgentCommands } from '../src/application/agents/agentCommands'
import { createCharacterCommands } from '../src/application/characters/characterCommands'
import type { CommandServices } from '../src/application/ports/ApplicationServices'
import type { Result } from '../src/application/shared/Result'
import { seedState } from '../src/application/bootstrap/seedState'
import { cloneData } from '../src/domain/shared/cloneData'

function services(): CommandServices {
  let sequence = 0
  return { clock: { now: () => '2026-10-05T10:00:00.000Z' }, ids: { next: prefix => `${prefix}-test-${++sequence}` } }
}
function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
  return result.value
}

describe('agent application commands', () => {
  it('adds a specialist to a new state without mutating the caller', () => {
    const state = cloneData(seedState), base = state.agents.find(agent => agent.kind === 'general')!
    const before = JSON.stringify(state)
    const result = value(createAgentCommands(services()).addSpecialist(state, base.id))
    expect(result.state.agents.find(agent => agent.id === result.selectedAgentId)?.variantOf).toBe(base.id)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('adds a variant and its inheritance relation in one transition', () => {
    const state = cloneData(seedState)
    const result = value(createAgentCommands(services()).addVariant(state, state.agents[0].id, 'Review'))
    expect(result.state.relations.some(relation => relation.fromAgentId === result.selectedAgentId && relation.type === 'inherits-from')).toBe(true)
    expect(state.agents.length).toBe(seedState.agents.length)
  })
  it('uses the injected clock and snapshots before incrementing the live version', () => {
    const state = cloneData(seedState), agent = state.agents[0]
    const result = value(createAgentCommands(services()).snapshotAgent(state, agent.id))
    expect(result.state.versions[0].snapshot.version).toBe(agent.version)
    expect(result.state.versions[0].createdAt).toBe('2026-10-05T10:00:00.000Z')
    expect(result.state.agents[0].version).not.toBe(agent.version)
  })
  it('returns a typed failure instead of partially committing invalid commands', () => {
    const state = cloneData(seedState), before = JSON.stringify(state)
    const result = createAgentCommands(services()).addVariant(state, 'missing-agent')
    expect(result.ok).toBe(false)
    expect(result.diagnostics[0].code).toBe('agent.not-found')
    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('character application commands', () => {
  it('saves a model-independent reusable team style', () => {
    const state = cloneData(seedState)
    const result = value(createCharacterCommands(services()).saveStyle(state, state.agents[0].id, 'Platform'))
    const style = result.state.characterStyles.find(item => item.id === result.value)!
    expect(style.name).toBe('Platform')
    expect(style).not.toHaveProperty('modelId')
    expect(result.state.agents[0].appearance.teamStyleId).toBe(style.id)
    expect(state.characterStyles).toEqual(seedState.characterStyles)
  })
  it('creates portable packs from the current agent look', () => {
    const state = cloneData(seedState)
    const result = value(createCharacterCommands(services()).createPack(state, state.agents[0].id, 'Core team custom'))
    const pack = result.state.characterPacks.find(item => item.id === result.value)!
    expect(pack.savedLooks).toHaveLength(1)
    expect(pack.partIds.length).toBeGreaterThan(0)
    expect(pack.builtIn).toBe(false)
    expect(pack.savedLooks[0].appearance.packId).toBe(pack.id)
  })
  it('applies a look without overwriting team identity or operational permissions', () => {
    const state = cloneData(seedState), agent = state.agents[0], look = state.agents[1].appearance
    const result = value(createCharacterCommands(services()).applyLook(state, agent.id, look))
    const changed = result.state.agents[0]
    expect(changed.appearance.teamNickname).toBe(agent.appearance.teamNickname)
    expect(changed.appearance.modelId).toBe(look.modelId)
    expect(changed.toolIds).toEqual(agent.toolIds)
    expect(changed.autonomy).toEqual(agent.autonomy)
  })
})
