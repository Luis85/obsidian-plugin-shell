import { createRequire } from 'node:module'
import path from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
export const load = name => require(path.join(process.env.AGENTS_CORE_BUILD, `${name}.js`))
export const seed = () => structuredClone(load('application/bootstrap/seedState').seedState)
export function services() {
  let next = 0
  return { clock: { now: () => '2026-10-05T10:11:12.000Z' }, ids: { next: prefix => `${prefix}-test-${++next}` } }
}
export function unwrap(result) { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.value }
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze) }
  return value
}
export const errorCodes = result => result.diagnostics.filter(issue=>issue.severity==='error').map(issue=>issue.code)
export const tick = () => new Promise(resolve=>setImmediate(resolve))
