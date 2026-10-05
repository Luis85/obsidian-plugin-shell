import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { useAgentsStore } from '../src/presentation/stores/agents'
import { agentsContextKey } from '../src/presentation/stores/applicationContext'
import { seedState } from '../src/application/bootstrap/seedState'
import type { StateRepository } from '../src/application/ports/StateRepository'
import type { PluginState } from '../src/domain/shared/PluginState'
import { cloneData } from '../src/domain/shared/cloneData'
import { failure, success } from '../src/application/shared/Result'

const cleanups: Array<() => void> = []
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers() })
function workspace(repository: StateRepository) {
  const app = createApp({}), pinia = createPinia()
  let sequence = 0
  app.use(pinia)
  app.provide(agentsContextKey, {
    initialState: cloneData(seedState),
    services: { repository, clock: { now: () => '2026-10-05T10:00:00.000Z' }, ids: { next: prefix => `${prefix}-test-${++sequence}` } }
  })
  const store = app.runWithContext(() => useAgentsStore(pinia))
  cleanups.push(() => disposePinia(pinia))
  return store
}
const repository = (): StateRepository => ({ load: async () => success(undefined), save: async () => success(undefined) })

describe('Pinia application boundary with injected services', () => {
  it('initializes an empty repository without immediately overwriting storage', async () => {
    const port = repository(), save = vi.spyOn(port, 'save'), store = workspace(port)
    await store.initialize()
    expect(store.ready).toBe(true)
    expect(store.dirty).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })
  it('coalesces repeated startup calls into one repository load', async () => {
    const port = repository(), load = vi.spyOn(port, 'load'), store = workspace(port)
    await Promise.all([store.initialize(), store.initialize(), store.initialize()])
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('protects unreadable storage until replacement is explicitly authorized', async () => {
    vi.useFakeTimers()
    const port = repository()
    port.load = async () => failure('storage.corrupt', 'Stored data is unreadable.')
    const save = vi.spyOn(port, 'save'), store = workspace(port)
    await store.initialize()
    store.state.agents[0].name = 'Unsaved recovery session'
    await vi.advanceTimersByTimeAsync(1000)
    expect(store.recoveryRequired).toBe(true)
    expect(save).not.toHaveBeenCalled()
    expect((await store.saveNow()).ok).toBe(false)
    expect((await store.saveNow(true)).ok).toBe(true)
    expect(store.recoveryRequired).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
  })
  it('debounces reactive edits and stores the latest state', async () => {
    vi.useFakeTimers()
    const saved: PluginState[] = [], port = repository()
    port.save = async state => { saved.push(cloneData(state) as PluginState); return success(undefined) }
    const store = workspace(port)
    await store.initialize()
    store.state.settings.autoSave = true
    store.state.project.description = 'First change'
    await vi.advanceTimersByTimeAsync(200)
    store.state.project.description = 'Latest change'
    await vi.advanceTimersByTimeAsync(200)
    expect(saved).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(151)
    expect(saved).toHaveLength(1)
    expect(saved[0].project.description).toBe('Latest change')
    expect(store.dirty).toBe(false)
  })
  it('does not mark newer edits clean when an earlier save completes', async () => {
    let complete!: () => void
    const port = repository()
    port.save = () => new Promise(resolve => { complete = () => resolve(success(undefined)) })
    const store = workspace(port)
    await store.initialize()
    store.state.settings.autoSave = false
    const pending = store.saveNow()
    // The coordinator deliberately starts writes on its serialized promise chain.
    await Promise.resolve(); await Promise.resolve()
    store.state.project.description = 'Changed during save'
    complete(); await pending
    expect(store.dirty).toBe(true)
    expect(store.persistenceStatus).toBe('unsaved')
  })
  it('commits selected-agent commands without cloning Vue proxies through structuredClone', async () => {
    const store = workspace(repository())
    await store.initialize()
    store.state.settings.autoSave = false
    const count = store.state.agents.length
    expect(store.variantSelected('Review').ok).toBe(true)
    expect(store.state.agents).toHaveLength(count + 1)
    expect(store.selectedAgent?.variantLabel).toBe('Review')
  })
  it('rejects invalid imports without replacing live state or selection', async () => {
    const store = workspace(repository())
    await store.initialize()
    const before = JSON.stringify(store.state), selected = store.selectedAgentId
    expect(store.replaceState({ schemaVersion: '9.0.0' }).ok).toBe(false)
    expect(JSON.stringify(store.state)).toBe(before)
    expect(store.selectedAgentId).toBe(selected)
  })
  it('cancels pending autosave on disposal', async () => {
    vi.useFakeTimers()
    const port = repository(), save = vi.spyOn(port, 'save'), store = workspace(port)
    await store.initialize()
    store.state.settings.autoSave = true
    store.state.project.description = 'Not queued yet'
    store.$dispose()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
  })
})
