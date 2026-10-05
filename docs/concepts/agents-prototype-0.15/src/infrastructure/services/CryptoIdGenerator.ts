import type { IdGenerator } from '../../application/ports/IdGenerator'
/** No timestamp IDs: several commands in one millisecond must remain independent. */
export class CryptoIdGenerator implements IdGenerator {
  next(prefix: string): string {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return `${prefix}-${Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')}`
  }
}
