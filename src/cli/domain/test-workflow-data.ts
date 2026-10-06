import { keys, object, text } from './data.ts';
import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import { definitionId, getPath } from './form-model.ts';
import { fillTestWorkflowTemplates, testWorkflowText } from './test-workflow-locator.ts';
/**
 * Test data of a workflow: inline values and seeded fake-data records. `{{data.path}}` templates in step values and
 * locator texts read this data; the fake-data generator supplies records offline from its seed, so runs repeat.
 */
export type TestWorkflowValue = string | number | boolean | TestWorkflowValues;
export interface TestWorkflowValues { [key: string]: TestWorkflowValue }
/** A generation config (its entity, seed and reference date) or an entity with an optional seed; `index` picks one record. */
export interface TestWorkflowFakeSource { config?: string; entity?: string; seed?: number; index: number }
export interface TestWorkflowData { values?: TestWorkflowValues; fakeData?: Record<string, TestWorkflowFakeSource> }
const dataLimits = { depth: 4, entries: 200, aliases: 10, index: 999, seed: 2147483647 };
const keyPattern = /^[A-Za-z][A-Za-z0-9]*$/;
const reserved = new Set(['constructor', 'prototype']);
function dataKey(key: string, name: string): string {
  requireSketch(keyPattern.test(key) && !reserved.has(key), 'WORKFLOW_DATA', `${name}: data keys are letters and digits starting with a letter.`);
  return key;
}
function readValues(value: unknown, name: string, depth: number, count: { entries: number }): TestWorkflowValues {
  requireSketch(depth < dataLimits.depth, 'WORKFLOW_DATA', `${name}: values nest at most ${dataLimits.depth} levels.`);
  const result: TestWorkflowValues = {};
  for (const [key, item] of Object.entries(object(value))) {
    requireSketch(++count.entries <= dataLimits.entries, 'WORKFLOW_DATA', `data.values holds at most ${dataLimits.entries} entries.`);
    const path = `${name}.${dataKey(key, name)}`;
    if (typeof item === 'string') result[key] = testWorkflowText(item, path, 1000, true);
    else if (typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) result[key] = item;
    else result[key] = readValues(item, path, depth + 1, count);
  }
  return result;
}
function bounded(value: unknown, name: string, max: number): number {
  requireSketch(Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= max, 'WORKFLOW_DATA', `${name} must be 0 to ${max}.`);
  return Number(value);
}
function readFakeSource(value: unknown, name: string): TestWorkflowFakeSource {
  const item = object(value); keys(item, ['config', 'entity', 'seed', 'index']);
  requireSketch((item.config === undefined) !== (item.entity === undefined), 'WORKFLOW_DATA', `${name} names exactly one of config (a saved generation config) or entity.`);
  requireSketch(item.seed === undefined || item.entity !== undefined, 'WORKFLOW_DATA', `${name}.seed applies to entity sources; a config keeps its own seed.`);
  const id = text(item.config ?? item.entity, name, 80);
  requireSketch(definitionId.test(id), 'WORKFLOW_DATA', `${name} must name a kebab-case fake-data id.`);
  const index = bounded(item.index ?? 0, name + '.index', dataLimits.index), seed = item.seed === undefined ? {} : { seed: bounded(item.seed, name + '.seed', dataLimits.seed) };
  return { ...item.config === undefined ? { entity: id } : { config: id }, ...seed, index };
}
export function readTestWorkflowData(value: unknown): TestWorkflowData {
  const item = object(value); keys(item, ['values', 'fakeData']);
  const values = item.values === undefined ? undefined : readValues(item.values, 'data.values', 0, { entries: 0 });
  const sources = item.fakeData === undefined ? undefined : Object.entries(object(item.fakeData));
  requireSketch(!sources || sources.length <= dataLimits.aliases, 'WORKFLOW_DATA', `data.fakeData names at most ${dataLimits.aliases} records.`);
  const fakeData = sources ? Object.fromEntries(sources.map(([alias, source]) => {
    requireSketch(!values || !Object.hasOwn(values, alias), 'WORKFLOW_DATA', `data.fakeData.${alias} collides with data.values.${alias}.`);
    return [dataKey(alias, 'data.fakeData'), readFakeSource(source, `data.fakeData.${alias}`)];
  })) : undefined;
  return { ...values ? { values } : {}, ...fakeData ? { fakeData } : {} };
}
/** One generated record's properties, as the fake-data generator rendered them into frontmatter. */
export type TestWorkflowRecord = Readonly<Record<string, string | number | boolean | readonly string[]>>;
/** The object templates read: inline values plus one record per fake-data alias. */
export function testWorkflowDataContext(data: TestWorkflowData | undefined, records: ReadonlyMap<string, TestWorkflowRecord>): Record<string, unknown> {
  return { ...data?.values, ...Object.fromEntries(records) };
}
function display(value: unknown, path: string): string {
  const shown = Array.isArray(value) ? value.map(String).join(', ') : value;
  requireSketch(['string', 'number', 'boolean'].includes(typeof shown), 'WORKFLOW_DATA_MISSING', `{{data.${path}}} does not name a text, number or boolean in the workflow data.`);
  return String(shown);
}
/** Resolves every `{{data.path}}`; a missing value fails closed instead of typing an empty string. */
export function resolveTestWorkflowText(value: string, context: Record<string, unknown>): string {
  return fillTestWorkflowTemplates(value, path => display(getPath(context, path), path));
}
