import { describe, expect, it } from 'vitest'
import { createVariant, nextPatch } from '../src/domain/agents/agent'
import { validateState } from '../src/domain/shared/validateState'
import { seedState } from '../src/application/bootstrap/seedState'
import { modelAppearance, applyCharacterStyle } from '../src/domain/characters/appearance'
import { partsForAppearance, CHARACTER_MODELS } from '../src/presentation/character-catalog/catalog'
import { BUILTIN_CHARACTER_STYLES, BUILTIN_CHARACTER_PACKS } from '../src/application/bootstrap/characterDefaults'
import { requirements } from '../src/presentation/character-catalog/requirements'

describe('agent domain', () => {
  it('creates independently versioned variants with inheritance metadata', () => {
    const base = seedState.agents[0]
    const variant = createVariant(base, 'Strict', 'agent-test-strict')
    expect(variant.id).not.toBe(base.id)
    expect(variant.variantOf).toBe(base.id)
    expect(variant.inheritance?.baseAgentId).toBe(base.id)
    expect(variant.version).toBe('0.1.0')
  })
  it('keeps appearance independent from operational capability', () => {
    const agent = structuredClone(seedState.agents[0])
    const skills = [...agent.skillIds], tools = [...agent.toolIds], role = agent.roleId
    agent.appearance.modelId = 'voxel-dog-v1'
    agent.appearance.category = 'pet'
    expect(agent.skillIds).toEqual(skills)
    expect(agent.toolIds).toEqual(tools)
    expect(agent.roleId).toBe(role)
  })
  it('increments patch versions', () => expect(nextPatch('1.2.3')).toBe('1.2.4'))
  it('keeps the teaching catalog broad and data-driven', () => {
    expect(requirements.length).toBeGreaterThan(18)
    expect(requirements.every(r => r.id && r.need && r.why && r.fulfill && r.checks.length)).toBe(true)
  })
  it('seed state passes core structural validation', () => {
    expect(validateState(seedState).filter(x => x.severity === 'error')).toEqual([])
  })
  it('high-risk seed tools require approval', () => {
    expect(seedState.tools.filter(t => t.risk === 'high').every(t => t.approval !== 'never')).toBe(true)
  })
})

describe('character design system', () => {
  it('treats preset models as composable recipes', async () => {
    const appearance = modelAppearance('voxel-dog-v1')
    expect(appearance.parts.head).toBeTruthy()
    expect(appearance.parts.body).toBeTruthy()
    const ears = partsForAppearance(appearance, 'ears')
    expect(ears.length).toBeGreaterThan(1)
    appearance.parts.ears = ears.at(-1)!.id
    expect(appearance.modelId).toBe('voxel-dog-v1')
  })

  it('applies a team style without changing embodiment recipe', async () => {
    const appearance = modelAppearance('voxel-owl-v1')
    const before = structuredClone(appearance.parts)
    applyCharacterStyle(appearance, BUILTIN_CHARACTER_STYLES[2])
    expect(appearance.parts).toEqual(before)
    expect(appearance.category).toBe('animal')
    expect(appearance.primaryColor).toBe(BUILTIN_CHARACTER_STYLES[2].primaryColor)
  })

  it('ships multiple built-in character packs across embodiment families', async () => {
    expect(BUILTIN_CHARACTER_PACKS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(CHARACTER_MODELS.map(model => model.category))).toEqual(new Set(['human','pet','animal','item']))
  })
})
