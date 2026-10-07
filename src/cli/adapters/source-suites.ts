/**
 * The test-suite entry `source add` registers in tests/suites.json: one node-test suite `source:<name>` for the new
 * project's tests (and a root when no declared root reaches them). The file keeps its hand formatting: the entry is
 * inserted as text and the result is verified against the parsed expectation before it enters the plan.
 */
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { FilePlanEntry } from '#shared/platform/file-plan.ts';
import { serializeJson as json } from '#shared/contracts/serialization.ts';
import { readJsonFile } from './source-workspace.ts';

const manifestPath = 'tests/suites.json';
type Json = Record<string, unknown>;
const skipSpace = (text: string, at: number): number => { while (at < text.length && /\s/.test(text[at]!)) at++; return at; };
function stringEnd(text: string, start: number): number {
  let at = start + 1;
  while (at < text.length && text[at] !== '"') at += text[at] === '\\' ? 2 : 1;
  return at + 1;
}
function primitiveEnd(text: string, start: number): number {
  let at = start;
  while (at < text.length && !/[\s,\]}]/.test(text[at]!)) at++;
  return at;
}
function containerEnd(text: string, start: number): number {
  let depth = 0, at = start;
  do {
    const char = text[at]!;
    if (char === '"') { at = stringEnd(text, at); continue; }
    depth += char === '[' || char === '{' ? 1 : char === ']' || char === '}' ? -1 : 0;
    at++;
  } while (depth > 0 && at < text.length);
  return at;
}
/** Index just past the JSON value starting at `start`, skipping nested strings. */
function valueEnd(text: string, start: number): number {
  if (text[start] === '"') return stringEnd(text, start);
  return text[start] === '[' || text[start] === '{' ? containerEnd(text, start) : primitiveEnd(text, start);
}
/** Start and end of the array value of a top-level key, or null. */
function topLevelArray(text: string, key: string): [number, number] | null {
  let at = skipSpace(text, 0);
  if (text[at] !== '{') return null;
  at = skipSpace(text, at + 1);
  while (text[at] === '"') {
    const close = valueEnd(text, at), name = JSON.parse(text.slice(at, close)) as string;
    const start = skipSpace(text, skipSpace(text, close) + 1), end = valueEnd(text, start);
    if (name === key) return text[start] === '[' ? [start, end] : null;
    at = skipSpace(text, end);
    if (text[at] === ',') at = skipSpace(text, at + 1);
  }
  return null;
}
/** The text with `value` appended to a top-level array, indented like its existing elements. */
function appendToArray(text: string, key: string, value: unknown): string | null {
  const range = topLevelArray(text, key);
  if (!range) return null;
  const [start, end] = range, body = text.slice(start + 1, end - 1);
  const lastContent = start + 1 + body.trimEnd().length;
  const indent = /\n([ \t]*)\S/.exec(body)?.[1] ?? '    ';
  const item = JSON.stringify(value, null, 2).split('\n').join(`\n${indent}`);
  const separator = body.trim() ? ',' : '';
  return text.slice(0, lastContent) + `${separator}\n${indent}${item}` + text.slice(lastContent);
}
function edited(text: string, expected: Json, additions: Array<[string, unknown]>): string {
  let next: string | null = text;
  for (const [key, value] of additions) next = next === null ? null : appendToArray(next, key, value);
  try { if (next !== null && isDeepStrictEqual(JSON.parse(next), expected)) return next; } catch { /* fall back below */ }
  return json(expected);
}
export interface SuiteChange { entries: FilePlanEntry[]; suite: string | null; manual: string[] }
export async function withSuite(root: string, name: string): Promise<SuiteChange> {
  const file = await readJsonFile(root, manifestPath).catch(() => null), suite = `source:${name}`, folder = `src/${name}/tests`;
  const value = file?.value as Json | undefined;
  if (!file || !value || !Array.isArray(value.suites) || !Array.isArray(value.roots))
    return { entries: [], suite: null, manual: [`No usable ${manifestPath}: register ${folder} with your test runner by hand.`] };
  if ((value.suites as Json[]).some(item => item?.name === suite)) return { entries: [], suite, manual: [`${manifestPath} already has a ${suite} suite; review it.`] };
  const entry = { name: suite, purpose: `Tests of the ${name} source project (src/${name}).`, level: 'unit', runner: { type: 'node-test' },
    include: [`${folder}/**/*.test.ts`], verify: 'opt-in' };
  const reached = (value.roots as Json[]).some(item => typeof item?.path === 'string' && (posix.matchesGlob(folder, item.path) || folder.startsWith(`${item.path}/`)));
  const additions: Array<[string, unknown]> = [...(reached ? [] : [['roots', { path: folder }] as [string, unknown]]), ['suites', entry]];
  const expected = { ...value, roots: [...value.roots as unknown[], ...(reached ? [] : [{ path: folder }])], suites: [...value.suites as unknown[], entry] };
  return { entries: [{ path: manifestPath, content: edited(file.text, expected, additions) }], suite,
    manual: typeof value.documentation === 'string' ? [`Add a ${suite} row to ${value.documentation} (the suite table).`] : [] };
}
