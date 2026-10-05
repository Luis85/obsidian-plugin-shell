import type { Diagnostic } from '../shared/Result'

/** Runtime validators carry their structural schema, so exported contracts cannot drift. */
export type JsonSchema = Record<string, unknown>
export type Shape = ((value: unknown, path: string, issues: Diagnostic[]) => void) & {
  readonly jsonSchema: JsonSchema
  readonly isOptional?: boolean
}
const define = (jsonSchema: JsonSchema, validate: (value: unknown, path: string, issues: Diagnostic[]) => void): Shape =>
  Object.assign(validate, { jsonSchema })
const issue = (issues: Diagnostic[], path: string, message: string) => {
  issues.push({ code: 'validation.structure', severity: 'error', path, message })
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const text = define({ type: 'string', maxLength: 100_000 }, (value, path, issues) => {
  if (typeof value !== 'string' || value.length > 100_000) issue(issues, path, 'Expected a string of at most 100,000 characters.')
})
export const boolean = define({ type: 'boolean' }, (value, path, issues) => {
  if (typeof value !== 'boolean') issue(issues, path, 'Expected a boolean.')
})
export const matching = (pattern: RegExp, description: string): Shape =>
  define({ type: 'string', pattern: pattern.source, description }, (value, path, issues) => {
    if (typeof value !== 'string' || !pattern.test(value)) issue(issues, path, description)
  })
export const oneOf = (...values: readonly string[]): Shape =>
  define({ type: 'string', enum: [...values] }, (value, path, issues) => {
    if (typeof value !== 'string' || !values.includes(value)) issue(issues, path, `Expected one of: ${values.join(', ')}.`)
  })
export const number = (min = -Number.MAX_VALUE, max = Number.MAX_VALUE, integer = false): Shape =>
  define({ type: integer ? 'integer' : 'number', minimum: min, maximum: max }, (value, path, issues) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      issue(issues, path, `Expected a finite ${integer ? 'integer' : 'number'} between ${min} and ${max}.`)
    }
  })
export const optional = (shape: Shape): Shape => Object.assign(
  define(shape.jsonSchema, (value, path, issues) => { if (value !== undefined) shape(value, path, issues) }),
  { isOptional: true }
)
export const array = (item: Shape, max = 10_000): Shape =>
  define({ type: 'array', items: item.jsonSchema, maxItems: max }, (value, path, issues) => {
    if (!Array.isArray(value) || value.length > max) {
      issue(issues, path, `Expected an array with at most ${max} entries.`)
      return
    }
    value.forEach((entry, index) => item(entry, `${path}[${index}]`, issues))
  })
export const object = (fields: Record<string, Shape>): Shape => define({
  type: 'object',
  properties: Object.fromEntries(Object.entries(fields).map(([key, shape]) => [key, shape.jsonSchema])),
  required: Object.entries(fields).filter(([, shape]) => !shape.isOptional).map(([key]) => key),
  additionalProperties: false
}, (value, path, issues) => {
  if (!isRecord(value)) { issue(issues, path, 'Expected an object.'); return }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(fields, key)) issue(issues, `${path}.${key}`, 'Unknown field; check the schema version.')
  }
  for (const [key, shape] of Object.entries(fields)) shape(value[key], path ? `${path}.${key}` : key, issues)
})
export const partial = (fields: Record<string, Shape>): Shape =>
  object(Object.fromEntries(Object.entries(fields).map(([key, shape]) => [key, optional(shape)])))
export const jsonObject = define({ type: 'object', additionalProperties: true }, (value, path, issues) => {
  if (!isRecord(value)) issue(issues, path, 'Expected a JSON object.')
})
export function checkShape(shape: Shape, value: unknown, path = ''): Diagnostic[] {
  const issues: Diagnostic[] = []
  shape(value, path, issues)
  return issues
}

/** Reject hostile keys, cycles, non-JSON objects and pathological input before walking schemas. */
export function inspectData(value: unknown): Diagnostic[] {
  const issues: Diagnostic[] = []
  const ancestors = new WeakSet<object>()
  let nodes = 0
  const visit = (item: unknown, path: string, depth: number) => {
    if (issues.length) return
    if (++nodes > 200_000 || depth > 60) { issue(issues, path, 'Input exceeds the supported size or nesting depth.'); return }
    if (item === null || item === undefined || typeof item === 'string' || typeof item === 'boolean') return
    if (typeof item === 'number' && Number.isFinite(item)) return
    if (typeof item !== 'object') { issue(issues, path, 'Only finite, serializable plain data is supported.'); return }
    if (ancestors.has(item)) { issue(issues, path, 'Cyclic data is not supported.'); return }
    const prototype = Object.getPrototypeOf(item)
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) { issue(issues, path, 'Expected a plain data object.'); return }
    ancestors.add(item)
    for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) { issue(issues, `${path}.${key}`, 'Unsafe property name.'); return }
      visit(child, `${path}.${key}`, depth + 1)
    }
    ancestors.delete(item)
  }
  visit(value, '', 0)
  return issues
}
