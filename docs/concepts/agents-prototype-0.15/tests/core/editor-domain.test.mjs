import {describe,it} from 'node:test'
import assert from 'node:assert/strict'
import {load,seed} from './helpers.mjs'
const catalog=load('presentation/character-catalog/catalog')
const editor=load('presentation/character-catalog/editorCategories')
const appearance=load('domain/characters/appearance')
const rules=load('domain/characters/modelRules')
const defaults=load('application/bootstrap/characterDefaults')

describe('preserved editor and catalog contracts',()=>{
  it('retains eleven unique editor categories',()=>{assert.equal(editor.CHARACTER_EDITOR_CATEGORIES.length,11);assert.equal(new Set(editor.CHARACTER_EDITOR_CATEGORIES.map(item=>item.id)).size,11)})
  it('distinguishes incomplete configuration from behavioral evidence',()=>{const agent=seed().agents[0];agent.evals=[];assert.ok(editor.agentConfigurationCoverage(agent)<100);assert.equal(editor.categoryReadiness(agent,seed(),'evals'),0)})
  it('toggles membership without mutating the collection',()=>{const values=['a','b'];assert.deepEqual(editor.toggleMembership(values,'b'),['a']);assert.deepEqual(values,['a','b'])})
  it('keeps presentation copy out of domain recipes',()=>{
    for(const model of rules.CHARACTER_MODEL_RULES){assert.equal('name' in model,false);assert.equal('description' in model,false);assert.equal('tags' in model,false)}
    for(const model of catalog.CHARACTER_MODELS){assert.ok(model.name);assert.ok(model.description);assert.ok(Array.isArray(model.tags))}
  })
  it('retains all fifteen recipes and four embodiment categories',()=>{assert.equal(catalog.CHARACTER_MODELS.length,15);assert.deepEqual(new Set(catalog.CHARACTER_MODELS.map(model=>model.category)),new Set(['human','pet','animal','item']))})
  it('keeps part composition independent of model choice',()=>{
    const look=appearance.modelAppearance('voxel-dog-v1'),ears=catalog.partsForAppearance(look,'ears')
    assert.ok(ears.length>1);look.parts.ears=ears.at(-1).id;assert.equal(look.modelId,'voxel-dog-v1')
  })
  it('styles preserve the current silhouette and part recipe',()=>{
    const look=appearance.modelAppearance('voxel-owl-v1'),parts=structuredClone(look.parts)
    appearance.applyCharacterStyle(look,defaults.BUILTIN_CHARACTER_STYLES[2])
    assert.deepEqual(look.parts,parts);assert.equal(look.category,'animal')
  })
  it('retains the broad teaching catalog',()=>{const {requirements}=load('presentation/character-catalog/requirements');assert.ok(requirements.length>18);assert.ok(requirements.every(r=>r.id&&r.need&&r.why&&r.fulfill&&r.checks.length))})
})

// Quoted Vue delimiters belong in a formatter, not inline template expressions.
it('formats repeated runtime-adapter placeholders without changing other path text', () => {
  const { formatRuntimeTargetPath } = load('presentation/formatters/runtimeTargetPath')
  assert.equal(formatRuntimeTargetPath('agents/{{slug}}/{{slug}}.md', 'klaus'), 'agents/klaus/klaus.md')
  assert.equal(formatRuntimeTargetPath('AGENTS.md', 'klaus'), 'AGENTS.md')
})
