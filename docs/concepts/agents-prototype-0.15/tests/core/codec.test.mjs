import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { load, seed, unwrap, deepFreeze } from './helpers.mjs'
const {decodeState,decodeStateJson,decodeCharacterPack,parseJson,MAX_IMPORT_CHARACTERS}=load('application/state/StateCodec')

describe('untrusted state boundary',()=>{
  it('round-trips the supplied 0.14 seed without any data loss',()=>{
    const state=deepFreeze(seed())
    assert.deepEqual(unwrap(decodeStateJson(JSON.stringify(state))),JSON.parse(JSON.stringify(state)))
  })
  it('never returns a shared mutable import object',()=>{
    const state=seed(),out=unwrap(decodeState(state));out.agents[0].goals.push('Changed')
    assert.notDeepEqual(out.agents[0].goals,state.agents[0].goals)
  })
  for(const value of [null,[],{},true,'text',42,{schemaVersion:'1.4.0'}])it(`rejects malformed root ${JSON.stringify(value)}`,()=>{
    const result=decodeState(value);assert.equal(result.ok,false);assert.ok(result.diagnostics.length)
  })
  for(const version of ['0.9.0','1.4.1','1.5.0','2.0.0','latest'])it(`does not downgrade unsupported schema ${version}`,()=>{
    const state=seed();state.schemaVersion=version;const result=decodeState(state)
    assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'schema.unsupported')
    assert.equal(state.schemaVersion,version)
  })
  for(const [label,mutate] of [
    ['nested null',s=>s.agents[0].invocation=null],
    ['missing settings',s=>delete s.settings],
    ['missing role array',s=>delete s.roles],
    ['unknown numeric string',s=>s.agents[0].autonomy.maxSteps='20'],
    ['non-finite number',s=>s.agents[0].appearance.scale=NaN],
    ['invalid scale',s=>s.agents[0].appearance.scale=8],
    ['invalid color',s=>s.agents[0].appearance.primaryColor='red'],
    ['invalid expression',s=>s.agents[0].appearance.expression='evil'],
    ['unknown field',s=>s.extra='wrong schema'],
    ['empty agents',s=>s.agents=[]],
    ['duplicate IDs',s=>s.runtimeAdapters[0].id=s.agents[0].id],
    ['unknown layer',s=>s.agents[0].instructionLayerIds.push('missing')],
    ['unknown role skill',s=>s.roles[0].defaultSkillIds.push('missing')],
    ['invalid model',s=>s.agents[0].appearance.modelId='unknown'],
    ['invalid part',s=>s.agents[0].appearance.parts.head='unknown'],
    ['incompatible part',s=>s.agents[0].appearance.parts.head='head-dog'],
    ['invalid accessory',s=>s.agents[0].appearance.accessoryIds.push('not-real')],
    ['duplicate accessory',s=>s.agents[0].appearance.accessoryIds.push(s.agents[0].appearance.accessoryIds[0])],
    ['missing current appearance',s=>delete s.agents[0].appearance],
    ['missing current packs',s=>delete s.characterPacks],
    ['broken version snapshot',s=>s.versions.push({id:'ver-bad',agentId:'agent-klaus',version:'1.0.0',createdAt:'bad',note:'',snapshot:s.agents[1]})]
  ])it(`rejects ${label} without throwing or changing input`,()=>{
    const state=seed();mutate(state);const before=structuredClone(state)
    const result=decodeState(state)
    assert.equal(result.ok,false,`${label} was accepted`);assert.ok(result.diagnostics[0].path!==undefined||result.diagnostics[0].code)
    assert.deepEqual(state,before)
  })
  it('rejects prototype-pollution keys recursively before migration',()=>{
    const state=seed(),raw=JSON.stringify(state).replace('"project":{','"project":{"__proto__":{"polluted":true},')
    const result=decodeStateJson(raw);assert.equal(result.ok,false);assert.equal({}.polluted,undefined)
  })
  it('bounds input nesting and detects cycles',()=>{
    const state=seed();state.extra=state;assert.equal(decodeState(state).ok,false)
    const deep={};let cursor=deep;for(let i=0;i<70;i++)cursor=cursor.child={}
    assert.equal(decodeState(deep).ok,false)
  })
  it('reports malformed JSON rather than rendering it as a valid document',()=>{
    assert.equal(decodeStateJson('{"agents":').ok,false)
    assert.equal(parseJson(' ').ok,false)
  })
  it('rejects oversized text before parsing',()=>{
    const result=parseJson(' '.repeat(MAX_IMPORT_CHARACTERS+1));assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'import.too-large')
  })
})

describe('explicit legacy migrations',()=>{
  for(const version of ['1.0.0','1.1.0','1.2.0','1.3.0'])it(`migrates supported ${version} appearance defaults without mutating the input`,()=>{
    const state=seed();state.schemaVersion=version;delete state.characterStyles;delete state.characterPacks
    for(const agent of state.agents){delete agent.appearance;agent.model='voxel-human-v1'}
    for(const version of state.versions){delete version.snapshot.appearance;version.snapshot.model='voxel-human-v1'}
    const before=structuredClone(state),result=decodeState(state),out=unwrap(result)
    assert.equal(out.schemaVersion,'1.4.0');assert.ok(out.characterPacks.length);assert.equal(out.agents[0].appearance.modelId,'voxel-human-v2')
    assert.ok(result.diagnostics.some(issue=>issue.code==='state.migrated'));assert.deepEqual(state,before)
    assert.deepEqual(unwrap(decodeState(out)),out)
  })
  it('migrates version snapshots as well as live agents',()=>{
    const state=seed();state.schemaVersion='1.3.0'
    const snapshot=structuredClone(state.agents[0]);delete snapshot.appearance;snapshot.model='voxel-human-v1'
    state.versions.push({id:'ver-legacy',agentId:snapshot.id,version:snapshot.version,createdAt:'2026-01-01T00:00:00.000Z',note:'Legacy',snapshot})
    const out=unwrap(decodeState(state));assert.equal(out.versions.at(-1).snapshot.appearance.modelId,'voxel-human-v2')
  })
  it('does not silently replace unknown legacy models',()=>{
    const state=seed();state.schemaVersion='1.3.0';delete state.agents[0].appearance;state.agents[0].model='unknown-legacy-model'
    assert.equal(decodeState(state).ok,false)
  })
})

describe('character pack validation',()=>{
  it('accepts built-in pack definitions',()=>{for(const pack of seed().characterPacks)unwrap(decodeCharacterPack(pack))})
  it('rejects missing nested appearance instead of throwing',()=>{
    const pack=seed().characterPacks[0];pack.savedLooks=[{id:'look-bad',name:'Bad',appearance:null}]
    assert.equal(decodeCharacterPack(pack).ok,false)
  })
  it('rejects unknown model and part declarations',()=>{
    const pack=seed().characterPacks[0];pack.modelIds.push('unknown');pack.partIds.push('missing')
    assert.equal(decodeCharacterPack(pack).ok,false)
  })
})
