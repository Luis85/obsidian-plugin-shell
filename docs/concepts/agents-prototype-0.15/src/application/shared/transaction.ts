import type { PluginState } from '../../domain/shared/PluginState'
import type { ReadonlyState } from '../../domain/shared/ReadonlyState'
import type { Agent } from '../../domain/agents/types'
import type { IdGenerator } from '../ports/IdGenerator'
import { cloneData } from '../../domain/shared/cloneData'
import { failure, success, type Result } from './Result'

export interface StateTransition<T> { state: PluginState; value: T; selectedAgentId?: string }
export class CommandError extends Error {
  constructor(readonly code: string, message: string, readonly path?: string) { super(message) }
}
/** Commands mutate only a detached draft. A failure never exposes or commits that draft. */
export function transact<T>(state: ReadonlyState, change: (draft: PluginState) => Omit<StateTransition<T>, 'state'>): Result<StateTransition<T>> {
  try {
    const draft = cloneData(state) as PluginState
    const result = change(draft)
    return success({ state: draft, ...result })
  } catch (error) {
    return error instanceof CommandError
      ? failure(error.code, error.message, error.path, 'command')
      : failure('command.failed', 'The command could not complete. No changes were committed.', undefined, 'command')
  }
}
export function requireAgent(state: PluginState, id: string): Agent {
  const agent = state.agents.find(item => item.id === id)
  if (!agent) throw new CommandError('agent.not-found', 'The selected agent no longer exists.', `agents.${id}`)
  return agent
}
export function requireName(value: string, path = 'name'): string {
  const name = value.trim()
  if (!name || name.length > 120) throw new CommandError('command.invalid-name', 'Enter a name between 1 and 120 characters.', path)
  return name
}
export function nextId(ids: IdGenerator, prefix: string, state: PluginState): string {
  const used = new Set<string>()
  for (const value of Object.values(state)) if (Array.isArray(value)) {
    for (const entity of value) if (entity && typeof entity === 'object' && 'id' in entity) used.add(String(entity.id))
  }
  for (const pack of state.characterPacks) for (const look of pack.savedLooks) used.add(look.id)
  for (let attempt = 0; attempt < 16; attempt++) {
    const id = ids.next(prefix)
    if (/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/.test(id) && !used.has(id)) return id
  }
  throw new CommandError('id.unavailable', 'The ID service could not provide a unique identifier. No changes were committed.')
}
