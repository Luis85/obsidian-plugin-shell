import { object, keys, text } from './data.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
/** Shared vocabulary of data-driven forms and wizards: bound paths, conditions and inert text templates. */
export type FieldValue = string | number | boolean | string[];
export type FormValues = Record<string, unknown>;
export interface FormCondition { field?: string; path?: string; equals?: FieldValue; notEquals?: FieldValue; present?: boolean; changed?: boolean }
const unsafeSegments = new Set(['__proto__', 'constructor', 'prototype']);
const segmentPattern = /^[A-Za-z][A-Za-z0-9]*$/;
export const definitionId = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const fieldId = /^[a-z][a-zA-Z0-9]*$/;
/** A dotted path of safe identifier segments; prototype keys are never reachable. */
export function readPath(value: unknown, name: string): string {
  const path = text(value, name, 200);
  requireSketch(path.split('.').every(part => segmentPattern.test(part) && !unsafeSegments.has(part)), 'FORM_PATH', `${name} must be a dotted path of identifiers.`);
  return path;
}
export function getPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    current = (current as FormValues)[part];
  }
  return current;
}
/** Creates plain intermediate objects; prototype keys are unreachable because every path passed readPath. */
export function setPath(target: FormValues, path: string, value: unknown): void {
  const parts = path.split('.'), last = parts.pop()!;
  let current = target;
  for (const part of parts) {
    const next = Object.hasOwn(current, part) ? current[part] : undefined;
    if (next === null || typeof next !== 'object' || Array.isArray(next)) current[part] = {};
    current = current[part] as FormValues;
  }
  current[last] = value;
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
/** Exactly one comparison: equals, notEquals, present or changed. */
export function readCondition(value: unknown, name: string, scope: 'field' | 'path'): FormCondition {
  const item = object(value); keys(item, [scope, 'equals', 'notEquals', 'present', 'changed']);
  const target = scope === 'field' ? text(item.field, name + '.field', 60) : readPath(item.path, name + '.path');
  const comparisons = ['equals', 'notEquals', 'present', 'changed'].filter(key => item[key] !== undefined);
  requireSketch(comparisons.length === 1, 'FORM_CONDITION', `${name} needs exactly one of equals, notEquals, present or changed.`);
  for (const key of ['present', 'changed']) requireSketch(item[key] === undefined || typeof item[key] === 'boolean', 'FORM_CONDITION', `${name}.${key} must be boolean.`);
  requireSketch(item.changed === undefined || scope === 'field', 'FORM_CONDITION', `${name}.changed is only available inside forms.`);
  return { ...(item as FormCondition), [scope]: target };
}
/** `current` and `initial` resolve the compared value; `changed` compares both. */
export function matches(condition: FormCondition | undefined, current: unknown, initial?: unknown): boolean {
  if (!condition) return true;
  if (condition.present !== undefined) return (current !== undefined && current !== null) === condition.present;
  if (condition.changed !== undefined) return !same(current, initial) === condition.changed;
  return condition.equals !== undefined ? same(current, condition.equals) : !same(current, condition.notEquals);
}
/**
 * Literal `{{path}}` or `{{path|fallback}}` replacement. Definitions supply data, never executable code;
 * a missing value renders the fallback (or nothing), and arrays render as comma-separated text.
 */
export function renderText(template: string, data: unknown): string {
  return template.replace(/\{\{([A-Za-z][A-Za-z0-9.]*)(?:\|([^}]*))?\}\}/g, (_match, path: string, fallback?: string) => {
    const value = path.split('.').some(part => unsafeSegments.has(part)) ? undefined : getPath(data, path);
    if (value === undefined || value === null || value === '') return fallback ?? '';
    return Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}
