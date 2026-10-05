import type { ApplicationServices } from '../application/ports/ApplicationServices'
import { BrowserStateRepository } from '../infrastructure/persistence/BrowserStateRepository'
import { SystemClock } from '../infrastructure/services/SystemClock'
import { CryptoIdGenerator } from '../infrastructure/services/CryptoIdGenerator'

/** Preserve the existing storage key so 0.14 workspaces remain discoverable. */
export const BROWSER_STORAGE_KEY = 'agents-klaus-editor-prototype-v3'
export function createBrowserServices(): ApplicationServices {
  return {
    repository: new BrowserStateRepository(BROWSER_STORAGE_KEY, () => globalThis.localStorage),
    clock: new SystemClock(), ids: new CryptoIdGenerator()
  }
}
