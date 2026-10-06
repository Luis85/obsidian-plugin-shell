import { computed, inject, onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { AgentRelation } from '../../domain/relations/types'
import type { CharacterAppearance } from '../../domain/characters/types'
import type { PluginState } from '../../domain/shared/PluginState'
import { cloneData } from '../../domain/shared/cloneData'
import { createAgentCommands } from '../../application/agents/agentCommands'
import { createCharacterCommands } from '../../application/characters/characterCommands'
import { decodeState, parseJson } from '../../application/state/StateCodec'
import { PersistenceCoordinator } from '../../application/state/PersistenceCoordinator'
import { failure, type Diagnostic, type Result } from '../../application/shared/Result'
import type { StateTransition } from '../../application/shared/transaction'
import { agentsContextKey } from './applicationContext'

export const useAgentsStore = defineStore('agents', () => {
  const context = inject(agentsContextKey)
  if (!context) throw new Error('Agents application services must be provided by the composition root.')
  const state = ref<PluginState>(cloneData(context.initialState))
  const selectedAgentId = ref(state.value.agents[0]?.id ?? '')
  const selectedAgent = computed(() => state.value.agents.find(agent => agent.id === selectedAgentId.value) ?? state.value.agents[0])
  const generalAgent = computed(() => state.value.agents.find(agent => agent.kind === 'general'))
  const diagnostics = ref<Diagnostic[]>([])
  const persistenceStatus = ref<'loading' | 'ready' | 'unsaved' | 'saving' | 'saved' | 'error'>('loading')
  const dirty = ref(false)
  const recoveryRequired = ref(false)
  const ready = ref(false)
  const lastSavedAt = ref<string>()
  const persistence = new PersistenceCoordinator(context.services.repository)
  const agents = createAgentCommands(context.services)
  const characters = createCharacterCommands(context.services)
  let revision = 0
  let saveRequest = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  const cancelAutosave = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  const publish = (items: Diagnostic[]) => { diagnostics.value = items.slice(0, 100) }

  let initialization: Promise<void> | undefined
  function initialize(): Promise<void> {
    if (ready.value || disposed) return Promise.resolve()
    initialization ??= loadInitialState()
    return initialization
  }

  async function loadInitialState() {
    const result = await persistence.load()
    if (disposed) return
    if (result.ok && result.value !== undefined) {
      state.value = cloneData(result.value)
      selectedAgentId.value = state.value.agents[0]?.id ?? ''
    }
    publish(result.diagnostics)
    recoveryRequired.value = !result.ok
    persistenceStatus.value = result.ok ? 'ready' : 'error'
    dirty.value = false
    ready.value = true
  }

  async function saveNow(replaceStoredData = false): Promise<Result<void>> {
    cancelAutosave()
    if (disposed) return failure('state.closed', 'This workspace has been disposed.')
    if (!ready.value) return failure('state.loading', 'The workspace is still loading.')
    if (recoveryRequired.value && !replaceStoredData) return failure('storage.recovery-required', 'Export or review this session before explicitly replacing unreadable stored data.')
    const request = ++saveRequest
    const savedRevision = revision
    persistenceStatus.value = 'saving'
    const result = await persistence.save(state.value)
    if (disposed || request !== saveRequest) return result
    publish(result.diagnostics)
    if (result.ok) {
      recoveryRequired.value = false
      dirty.value = revision !== savedRevision
      persistenceStatus.value = dirty.value ? 'unsaved' : 'saved'
      try { lastSavedAt.value = context!.services.clock.now() }
      catch {
        lastSavedAt.value = undefined
        publish([...result.diagnostics, { code: 'clock.unavailable', severity: 'warning', message: 'The workspace was saved, but its display timestamp is unavailable.' }])
      }
    } else {
      dirty.value = true
      persistenceStatus.value = 'error'
    }
    return result
  }

  watch(state, () => {
    if (!ready.value || disposed) return
    revision++
    dirty.value = true
    if (persistenceStatus.value !== 'saving') persistenceStatus.value = 'unsaved'
    cancelAutosave()
    if (state.value.settings.autoSave && !recoveryRequired.value) timer = setTimeout(() => { void saveNow() }, 350)
  }, { deep: true, flush: 'sync' })

  function commit<T>(result: Result<StateTransition<T>>): Result<StateTransition<T>> {
    publish(result.diagnostics)
    if (result.ok) {
      state.value = result.value.state
      if (result.value.selectedAgentId) selectedAgentId.value = result.value.selectedAgentId
    }
    return result
  }
  function selectAgent(id: string) { if (state.value.agents.some(agent => agent.id === id)) selectedAgentId.value = id }
  const addSpecialist = () => {
    const base = generalAgent.value ?? selectedAgent.value
    return base ? commit(agents.addSpecialist(state.value, base.id)) : failure('agent.not-found', 'There is no base agent to duplicate.')
  }
  const variantSelected = (label = 'Variant') => commit(agents.addVariant(state.value, selectedAgentId.value, label))
  const snapshotSelected = (note = 'Manual snapshot') => commit(agents.snapshotAgent(state.value, selectedAgentId.value, note))
  const addRelation = (relation: Omit<AgentRelation, 'id'>) => commit(agents.addRelation(state.value, relation))
  const saveCharacterStyle = (agentId: string, name: string) => commit(characters.saveStyle(state.value, agentId, name))
  const applySavedLook = (agentId: string, look: CharacterAppearance) => commit(characters.applyLook(state.value, agentId, look))
  const createCharacterPack = (agentId: string, name: string) => commit(characters.createPack(state.value, agentId, name))
  const importCharacterPack = (raw: unknown) => commit(characters.importPack(state.value, raw))
  function importPackText(text: string) {
    const parsed = parseJson(text)
    if (!parsed.ok) { publish(parsed.diagnostics); return parsed }
    return importCharacterPack(parsed.value)
  }
  function replaceState(raw: unknown): Result<PluginState> {
    const result = decodeState(raw)
    publish(result.diagnostics)
    if (result.ok) {
      state.value = result.value
      selectedAgentId.value = state.value.agents[0]?.id ?? ''
    }
    return result
  }
  const reset = () => replaceState(context!.initialState)
  const reportDiagnostics = (items: Diagnostic[]) => publish(items)
  onScopeDispose(() => { disposed = true; cancelAutosave() })
  return { state, selectedAgentId, selectedAgent, generalAgent, diagnostics, persistenceStatus, dirty,
    recoveryRequired, ready, lastSavedAt, initialize, saveNow, selectAgent, addSpecialist, variantSelected,
    snapshotSelected, addRelation, replaceState, reset, saveCharacterStyle, applySavedLook,
    createCharacterPack, importCharacterPack, importPackText, reportDiagnostics }
})
