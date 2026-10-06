import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { load, seed, services, unwrap, deepFreeze } from './helpers.mjs'
const {createAgentCommands}=load('application/agents/agentCommands')
const {createCharacterCommands}=load('application/characters/characterCommands')
const {decodeState}=load('application/state/StateCodec')
const {cloneData}=load('domain/shared/cloneData')

describe('atomic application commands',()=>{
  it('adds a specialist to a detached state without mutating its base',()=>{
    const state=deepFreeze(seed()),before=JSON.stringify(state)
    const out=unwrap(createAgentCommands(services()).addSpecialist(state,state.agents[0].id))
    assert.equal(JSON.stringify(state),before)
    assert.equal(out.state.agents.length,state.agents.length+1)
    assert.equal(out.state.agents.at(-1).variantOf,state.agents[0].id)
    assert.equal(out.selectedAgentId,out.state.agents.at(-1).id)
    unwrap(decodeState(out.state))
  })
  it('adds inheritance and generates unique slugs for repeated variant labels',()=>{
    const commands=createAgentCommands(services()),state=seed(),id=state.agents[0].id
    const one=unwrap(commands.addVariant(state,id,'Review')),two=unwrap(commands.addVariant(one.state,id,'Review'))
    assert.notEqual(one.state.agents.at(-1).slug,two.state.agents.at(-1).slug)
    assert.equal(two.state.relations.at(-1).toAgentId,id)
    unwrap(decodeState(two.state))
  })
  it('uses only the supplied clock and IDs for snapshots and snapshots before bumping',()=>{
    const state=deepFreeze(seed()),agent=state.agents[0],commands=createAgentCommands(services())
    const result=unwrap(commands.snapshotAgent(state,agent.id,'Before release'))
    assert.equal(result.state.versions[0].createdAt,'2026-10-05T10:11:12.000Z')
    assert.equal(result.state.versions[0].id,'ver-test-1')
    assert.equal(result.state.versions[0].snapshot.version,agent.version)
    assert.notEqual(result.state.agents[0].version,agent.version)
    result.state.agents[0].goals.push('Future goal')
    assert.notDeepEqual(result.state.agents[0].goals,result.state.versions[0].snapshot.goals)
  })
  it('makes equivalent inputs and deterministic services produce equivalent outputs',()=>{
    const state=seed()
    assert.deepEqual(createAgentCommands(services()).addVariant(state,state.agents[0].id),createAgentCommands(services()).addVariant(state,state.agents[0].id))
  })
  it('rejects missing agents without changing live state',()=>{
    const state=deepFreeze(seed()),result=createAgentCommands(services()).addVariant(state,'missing')
    assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'agent.not-found')
    assert.equal('value' in result,false)
  })
  for(const label of ['', '  ', 'x'.repeat(121)]) it(`rejects invalid variant name of length ${label.length}`,()=>{
    const state=deepFreeze(seed());assert.equal(createAgentCommands(services()).addVariant(state,state.agents[0].id,label).ok,false)
  })
  it('detects a broken ID provider instead of creating duplicate entities',()=>{
    const state=deepFreeze(seed()),ports=services();ports.ids.next=()=>state.agents[0].id
    const result=createAgentCommands(ports).addVariant(state,state.agents[0].id)
    assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'id.unavailable')
  })
  it('rejects invalid clock values without a partial snapshot or version bump',()=>{
    const state=deepFreeze(seed()),ports=services();ports.clock.now=()=> 'not a timestamp'
    const result=createAgentCommands(ports).snapshotAgent(state,state.agents[0].id)
    assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'clock.invalid')
  })
  it('does not partially commit when a dependency throws after draft construction',()=>{
    const state=deepFreeze(seed()),ports=services();ports.clock.now=()=>{throw new Error('clock unavailable')}
    assert.equal(createAgentCommands(ports).snapshotAgent(state,state.agents[0].id).ok,false)
    assert.equal(state.versions.length,seed().versions.length)
  })
  it('rejects invalid versions instead of silently repairing them during snapshot',()=>{
    const state=seed();state.agents[0].version='oops'
    assert.equal(createAgentCommands(services()).snapshotAgent(state,state.agents[0].id).ok,false)
  })
  it('rejects dangling, self and duplicate relations',()=>{
    const state=seed(),commands=createAgentCommands(services()),rel=state.relations[0]
    const {id,...duplicate}=rel
    assert.equal(commands.addRelation(state,duplicate).ok,false)
    assert.equal(commands.addRelation(state,{...duplicate,toAgentId:rel.fromAgentId}).ok,false)
    assert.equal(commands.addRelation(state,{...duplicate,toAgentId:'missing'}).ok,false)
  })
  it('rejects inheritance cycles',()=>{
    const state=seed(),base=state.agents[0],child=state.agents.find(agent=>agent.variantOf===base.id)
    assert.ok(child)
    const result=createAgentCommands(services()).addRelation(state,{fromAgentId:base.id,toAgentId:child.id,type:'inherits-from',description:''})
    assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'relation.cycle')
  })
})

describe('character commands and pack operations',()=>{
  it('saves styles without adding a model dependency',()=>{
    const state=deepFreeze(seed()),out=unwrap(createCharacterCommands(services()).saveStyle(state,state.agents[0].id,'Platform'))
    const style=out.state.characterStyles.at(-1)
    assert.equal(style.name,'Platform');assert.equal('modelId' in style,false)
    assert.equal(out.state.agents[0].appearance.teamStyleId,style.id)
    assert.notEqual(out.state.characterStyles,state.characterStyles)
    unwrap(decodeState(out.state))
  })
  it('applies a look without changing team-facing social identity or operational authority',()=>{
    const state=deepFreeze(seed()),agent=state.agents[0],look=state.agents[1].appearance
    const out=unwrap(createCharacterCommands(services()).applyLook(state,agent.id,look)),changed=out.state.agents[0]
    assert.equal(changed.appearance.modelId,look.modelId)
    for(const field of ['teamNickname','greeting','motto','favoriteSymbol'])assert.equal(changed.appearance[field],agent.appearance[field])
    for(const field of ['roleId','skillIds','toolIds','guardrailIds','autonomy','pathPolicies','evals'])assert.deepEqual(changed[field],agent[field])
    unwrap(decodeState(out.state))
  })
  it('creates a portable pack with injected unique IDs and model/part declarations',()=>{
    const state=deepFreeze(seed()),out=unwrap(createCharacterCommands(services()).createPack(state,state.agents[0].id,'My team'))
    const pack=out.state.characterPacks.at(-1)
    assert.equal(pack.builtIn,false);assert.equal(pack.savedLooks.length,1)
    assert.equal(pack.savedLooks[0].appearance.packId,pack.id)
    unwrap(decodeState(out.state))
  })
  it('imports a duplicate pack with remapped pack and look identifiers without changing its source',()=>{
    const commands=createCharacterCommands(services()),one=unwrap(commands.createPack(seed(),'agent-klaus','My team'))
    const original=deepFreeze(structuredClone(one.state.characterPacks.at(-1)))
    const imported=unwrap(commands.importPack(one.state,original)),copy=imported.state.characterPacks.at(-1)
    assert.notEqual(copy.id,original.id)
    assert.notEqual(copy.savedLooks[0].id,original.savedLooks[0].id)
    assert.equal(copy.savedLooks[0].appearance.packId,copy.id)
    assert.equal(copy.builtIn,false)
    unwrap(decodeState(imported.state))
  })
  it('rejects malformed packs and appearances atomically',()=>{
    const state=deepFreeze(seed()),commands=createCharacterCommands(services())
    assert.equal(commands.importPack(state,{name:'Broken'}).ok,false)
    assert.equal(commands.applyLook(state,state.agents[0].id,{modelId:'unknown'}).ok,false)
  })
  it('clones ordinary reactive-style proxies without structuredClone DataCloneError',()=>{
    const state=seed(),proxy=new Proxy(state,{get:Reflect.get})
    assert.deepEqual(cloneData(proxy),state)
    const out=unwrap(createAgentCommands(services()).addVariant(proxy,state.agents[0].id))
    assert.equal(out.state.agents.length,state.agents.length+1)
  })
})
