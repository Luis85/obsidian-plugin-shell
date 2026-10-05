import type { PluginState } from '../../domain/shared/PluginState'
import type { ReadonlyState } from '../../domain/shared/ReadonlyState'
import type { Result } from '../shared/Result'

/** Async from day one so a Vault implementation does not change the store contract.
 * undefined means no saved state; failures must return diagnostics, not masquerade as empty storage.
 */
export interface StateRepository {
  load(): Promise<Result<PluginState | undefined>>
  save(state: ReadonlyState): Promise<Result<void>>
}
