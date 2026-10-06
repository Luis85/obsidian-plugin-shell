import type { StateRepository } from '../ports/StateRepository'
import type { ReadonlyState } from '../../domain/shared/ReadonlyState'
import { cloneData } from '../../domain/shared/cloneData'
import { failure, type Result } from '../shared/Result'

/** Serializes async writes; a slower old save cannot overwrite a newer workspace revision. */
export class PersistenceCoordinator {
  private tail: Promise<void> = Promise.resolve()
  constructor(private readonly repository: StateRepository) {}

  async load() {
    try { return await this.repository.load() }
    catch { return failure('repository.load-failed', 'The repository failed to load. Saved data has not been replaced.', undefined, 'load') }
  }

  save(state: ReadonlyState): Promise<Result<void>> {
    let snapshot: ReadonlyState
    try { snapshot = cloneData(state) }
    catch { return Promise.resolve(failure('state.snapshot-failed', 'The workspace could not be copied for saving. No write was queued.', undefined, 'save')) }
    const result = this.tail.then(async () => {
      try { return await this.repository.save(snapshot) }
      catch { return failure('repository.save-failed', 'The repository failed to save. Your changes remain in memory.', undefined, 'save') }
    })
    this.tail = result.then(() => undefined)
    return result
  }
}
