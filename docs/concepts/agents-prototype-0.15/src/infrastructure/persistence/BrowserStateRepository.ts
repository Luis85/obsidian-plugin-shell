import type { StateRepository } from '../../application/ports/StateRepository'
import type { ReadonlyState } from '../../domain/shared/ReadonlyState'
import { decodeState, decodeStateJson, MAX_IMPORT_CHARACTERS } from '../../application/state/StateCodec'
import { failure, success, type Failure } from '../../application/shared/Result'

export interface BrowserStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export type StorageProvider = () => BrowserStorage | undefined
const storageFailure = (error: unknown, operation: 'load' | 'save'): Failure => {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  if (name === 'QuotaExceededError') return failure('storage.quota-exceeded', 'Browser storage is full. Your changes are still in memory; export JSON or free storage and retry.', undefined, operation)
  if (name === 'SecurityError') return failure('storage.access-denied', 'This browser has denied storage access. Export JSON to preserve your work.', undefined, operation)
  return failure(`storage.${operation}-failed`, `Browser storage could not ${operation === 'load' ? 'load the workspace' : 'save your changes'}. No saved data was intentionally removed.`, undefined, operation)
}
/** Host storage is injected; constructing a repository does not access window or localStorage. */
export class BrowserStateRepository implements StateRepository {
  constructor(private readonly storageKey: string, private readonly storage: StorageProvider) {}

  async load() {
    try {
      const storage = this.storage()
      if (!storage) return failure('storage.unavailable', 'Browser storage is unavailable. This session is in memory only; export JSON before closing.', undefined, 'load')
      const raw = storage.getItem(this.storageKey)
      if (raw === null) return success(undefined)
      const result = decodeStateJson(raw)
      return result.ok ? result : { ...result, diagnostics: result.diagnostics.map(issue => ({ ...issue, operation: 'load' as const })) }
    } catch (error) { return storageFailure(error, 'load') }
  }

  async save(state: ReadonlyState) {
    try {
      const storage = this.storage()
      if (!storage) return failure('storage.unavailable', 'Browser storage is unavailable. Export JSON to preserve your work.', undefined, 'save')
      const validated = decodeState(state)
      if (!validated.ok) return { ...validated, diagnostics: validated.diagnostics.map(issue => ({ ...issue, operation: 'save' as const })) }
      const serialized = JSON.stringify(validated.value)
      if (serialized.length > MAX_IMPORT_CHARACTERS) {
        return failure('storage.too-large', 'This workspace exceeds the supported reload size. Export JSON and reduce its content before saving.', undefined, 'save')
      }
      storage.setItem(this.storageKey, serialized)
      return success(undefined, validated.diagnostics)
    } catch (error) { return storageFailure(error, 'save') }
  }
}
