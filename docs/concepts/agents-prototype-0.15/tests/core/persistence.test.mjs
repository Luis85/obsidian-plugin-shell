import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { load, seed, unwrap, tick } from './helpers.mjs'
const {BrowserStateRepository}=load('infrastructure/persistence/BrowserStateRepository')
const {PersistenceCoordinator}=load('application/state/PersistenceCoordinator')
const {success,failure}=load('application/shared/Result')
const key='agents-test'
const memoryStorage = (initial=null) => {
  let value=initial,writes=0
  return {getItem:()=>value,setItem:(_key,next)=>{value=next;writes++},get value(){return value},get writes(){return writes}}
}

describe('browser persistence diagnostics',()=>{
  it('distinguishes missing storage from a missing saved workspace',async()=>{
    assert.equal(unwrap(await new BrowserStateRepository(key,()=>memoryStorage()).load()),undefined)
    const missing=await new BrowserStateRepository(key,()=>undefined).load()
    assert.equal(missing.ok,false);assert.equal(missing.diagnostics[0].code,'storage.unavailable')
  })
  it('round-trips valid state and preserves the input',async()=>{
    const storage=memoryStorage(),repo=new BrowserStateRepository(key,()=>storage),state=seed(),before=structuredClone(state)
    unwrap(await repo.save(state));const loaded=unwrap(await repo.load())
    assert.deepEqual(loaded,JSON.parse(JSON.stringify(state)));assert.deepEqual(state,before)
    assert.equal(storage.writes,1)
  })
  for(const raw of ['', '{oops', 'null', '{"schemaVersion":"2.0.0"}', '{"schemaVersion":"1.4.0"}'])it(`preserves unreadable stored data ${JSON.stringify(raw)}`,async()=>{
    const storage=memoryStorage(raw),repo=new BrowserStateRepository(key,()=>storage)
    const result=await repo.load();assert.equal(result.ok,false);assert.equal(storage.value,raw);assert.equal(storage.writes,0)
    assert.ok(result.diagnostics.every(issue=>issue.operation==='load'))
  })
  it('surfaces denied access even when the localStorage property getter throws',async()=>{
    const repo=new BrowserStateRepository(key,()=>{throw new DOMException('denied','SecurityError')})
    assert.equal((await repo.load()).diagnostics[0].code,'storage.access-denied')
    assert.equal((await repo.save(seed())).diagnostics[0].code,'storage.access-denied')
  })
  it('reports quota failures without erasing the previous save',async()=>{
    let raw='original'
    const repo=new BrowserStateRepository(key,()=>({getItem:()=>raw,setItem:()=>{throw new DOMException('full','QuotaExceededError')}}))
    const result=await repo.save(seed())
    assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'storage.quota-exceeded');assert.equal(raw,'original')
  })
  it('returns generic read/write failures for other host exceptions',async()=>{
    const repo=new BrowserStateRepository(key,()=>({getItem:()=>{throw new Error('unavailable')},setItem:()=>{throw new Error('unavailable')}}))
    assert.equal((await repo.load()).diagnostics[0].code,'storage.load-failed')
    assert.equal((await repo.save(seed())).diagnostics[0].code,'storage.save-failed')
  })
  it('does not write malformed state over a valid workspace',async()=>{
    const storage=memoryStorage(JSON.stringify(seed())),repo=new BrowserStateRepository(key,()=>storage),before=storage.value
    const state=seed();state.agents[0].appearance.scale=Infinity
    assert.equal((await repo.save(state)).ok,false);assert.equal(storage.writes,0);assert.equal(storage.value,before)
  })
  it('migrates at load without silently rewriting storage',async()=>{
    const state=seed();state.schemaVersion='1.3.0';delete state.characterStyles;delete state.characterPacks
    const storage=memoryStorage(JSON.stringify(state)),repo=new BrowserStateRepository(key,()=>storage),result=await repo.load()
    assert.equal(unwrap(result).schemaVersion,'1.4.0');assert.equal(storage.writes,0)
    assert.ok(result.diagnostics.some(issue=>issue.code==='state.migrated'))
  })
  it('rejects cyclic live data before serialization',async()=>{
    const storage=memoryStorage('keep'),state=seed();state.self=state
    const result=await new BrowserStateRepository(key,()=>storage).save(state)
    assert.equal(result.ok,false);assert.equal(storage.value,'keep')
  })
})

describe('async repository coordination',()=>{
  it('serializes snapshots in request order and detaches them at enqueue time',async()=>{
    const writes=[],pending=[]
    const repo={load:async()=>success(undefined),save:state=>new Promise(resolve=>{writes.push(state.project.name);pending.push(resolve)})}
    const coordinator=new PersistenceCoordinator(repo),state=seed()
    state.project.name='first';const first=coordinator.save(state)
    state.project.name='second';const second=coordinator.save(state)
    state.project.name='not queued'
    await tick();assert.deepEqual(writes,['first'])
    pending[0](success(undefined));unwrap(await first);await tick()
    assert.deepEqual(writes,['first','second'])
    pending[1](success(undefined));unwrap(await second)
  })
  it('continues after a repository rejects a save instead of poisoning the queue',async()=>{
    let calls=0
    const coordinator=new PersistenceCoordinator({load:async()=>success(undefined),save:async()=>{if(++calls===1)throw new Error('offline');return success(undefined)}})
    const a=coordinator.save(seed()),b=coordinator.save(seed())
    assert.equal((await a).ok,false);unwrap(await b);assert.equal(calls,2)
  })
  it('continues after typed storage failures',async()=>{
    let calls=0
    const coordinator=new PersistenceCoordinator({load:async()=>success(undefined),save:async()=>++calls===1?failure('full','Full'):success(undefined)})
    assert.equal((await coordinator.save(seed())).ok,false);unwrap(await coordinator.save(seed()))
  })
  it('contains rejected loads without treating them as an empty workspace',async()=>{
    const coordinator=new PersistenceCoordinator({load:async()=>{throw new Error('lost')},save:async()=>success(undefined)})
    const result=await coordinator.load();assert.equal(result.ok,false);assert.equal(result.diagnostics[0].code,'repository.load-failed')
  })
})

it('never saves a workspace larger than the reader can reload', async () => {
  const storage = memoryStorage('preserve me'), repo = new BrowserStateRepository(key, () => storage), state = seed()
  state.agents[0].goals = Array.from({ length: 60 }, () => 'x'.repeat(90_000))
  const result = await repo.save(state)
  assert.equal(result.ok, false)
  assert.equal(result.diagnostics[0].code, 'storage.too-large')
  assert.equal(storage.value, 'preserve me')
  assert.equal(storage.writes, 0)
})

it('returns a typed snapshot failure instead of throwing before a write is queued', async () => {
  let writes = 0
  const state = seed()
  state.cycle = state
  const coordinator = new PersistenceCoordinator({ load: async () => success(undefined), save: async () => { writes++; return success(undefined) } })
  const result = await coordinator.save(state)
  assert.equal(result.ok, false)
  assert.equal(result.diagnostics[0].code, 'state.snapshot-failed')
  assert.equal(writes, 0)
  assert.equal((await coordinator.save(seed())).ok, true)
  assert.equal(writes, 1)
})
