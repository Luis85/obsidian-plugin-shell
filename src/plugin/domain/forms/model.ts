import { plainRecord } from '../entity';

/** Shared vocabulary of runtime data-driven forms: bound paths, conditions and validated value shapes. */
export type FormScalar = string | number | boolean | readonly string[];
export type DataFormValue = FormScalar | DataFormValues;
export interface DataFormValues { [key: string]: DataFormValue }
/** `target` is the resolved scope-relative path: the `path` itself, or the binding of the referenced `field`. */
export interface DataFormCondition {
  readonly field?: string;
  readonly path?: string;
  readonly target: string;
  readonly equals?: FormScalar;
  readonly notEquals?: FormScalar;
  readonly present?: boolean;
}
export type DataFormKind = 'text' | 'title' | 'number' | 'select' | 'multi' | 'boolean' | 'list' | 'section';
export interface DataFormChoice { readonly id: string; readonly label: string }
export interface DataFormField {
  readonly id: string;
  readonly kind: DataFormKind;
  readonly label: string;
  readonly help?: string;
  readonly message?: string;
  readonly bind?: string;
  readonly when?: DataFormCondition;
  readonly default?: FormScalar;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly multiline?: boolean;
  readonly integer?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly maxItems?: number;
  readonly choices?: readonly DataFormChoice[];
  readonly fields?: readonly DataFormField[];
}
export interface DataFormDefinition {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly description?: string;
  readonly fields: readonly DataFormField[];
}
const reserved = new Set(['__proto__', 'constructor', 'prototype']);
const segment = /^[A-Za-z][A-Za-z0-9]*$/;

/** A dotted path of identifier segments. Prototype keys can never be addressed. */
export function isFormPath(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200
    && value.split('.').every(part => segment.test(part) && !reserved.has(part));
}
/** Reads own plain-object properties only; inherited members resolve to undefined. */
export function valueAt(source: unknown, path: string): unknown {
  let current = source;
  for (const part of path.split('.')) {
    if (!plainRecord(current) || !Object.hasOwn(current, part)) return undefined;
    current = current[part];
  }
  return current;
}
const nested = (value: DataFormValue | undefined): value is DataFormValues => typeof value === 'object' && !Array.isArray(value);
/** Writes into fresh plain intermediate objects; refuses any path that is not a safe form path. */
export function assignAt(target: DataFormValues, path: string, value: DataFormValue): void {
  if (!isFormPath(path)) throw new Error('FORM_PATH');
  const parts = path.split('.');
  const last = String(parts.pop());
  let current = target;
  for (const part of parts) {
    const existing = Object.hasOwn(current, part) ? current[part] : undefined;
    const child = nested(existing) ? existing : {};
    current[part] = child;
    current = child;
  }
  current[last] = value;
}
/** Exactly one comparison applies: `present`, `equals` or `notEquals` (structural equality). */
export function conditionHolds(condition: DataFormCondition, current: unknown): boolean {
  if (condition.present !== undefined) return (current !== undefined && current !== null) === condition.present;
  const expected = condition.equals ?? condition.notEquals;
  const same = JSON.stringify(current) === JSON.stringify(expected);
  return condition.equals !== undefined ? same : !same;
}
/** C0/C1 controls; multiline text may keep tab, line feed and carriage return. */
export function hasControlCharacters(value: string, multiline: boolean): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (multiline && (code === 9 || code === 10 || code === 13)) continue;
    if (code < 32 || (code >= 127 && code <= 159)) return true;
  }
  return false;
}
