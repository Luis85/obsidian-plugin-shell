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
const scaffoldSuite = (name: string) => ({ name: `source:${name}`, purpose: `Tests of the ${name} source project (src/${name}).`, level: 'unit', runner: { type: 'node-test' },
  include: [`src/${name}/tests/**/*.test.ts`], verify: 'opt-in' });

/** Rename the registered suite and its paths, preserving custom runner options and unrelated suite entries. */
export async function renameSuite(root: string, from: string, to: string, fromPath: string, toPath: string): Promise<SuiteChange> {
  const file = await readJsonFile(root, manifestPath).catch(() => null), value = file?.value as Json | undefined;
  if (!file || !value || !Array.isArray(value.suites)) return { entries: [], suite: null, manual: [] };
  const suite = `source:${from}`, renamed = `source:${to}`;
  if ((value.suites as Json[]).some(item => item?.name === renamed))
    return { entries: [], suite, manual: [`${manifestPath} already has a ${renamed} suite; reconcile ${suite} by hand.`] };
  const replacePath = (path: unknown): unknown => typeof path === 'string' && (path === fromPath || path.startsWith(`${fromPath}/`)) ? toPath + path.slice(fromPath.length) : path;
  const next: Json = { ...value, suites: (value.suites as Json[]).map(item => {
    const updated = { ...item };
    for (const key of ['include', 'exclude']) if (Array.isArray(item[key])) updated[key] = (item[key] as unknown[]).map(replacePath);
    if (item.name === suite) {
      updated.name = renamed;
      if (item.purpose === scaffoldSuite(from).purpose) updated.purpose = scaffoldSuite(to).purpose;
    }
    return updated;
  }) };
  for (const key of ['roots', 'helperRoots']) if (Array.isArray(value[key])) next[key] = (value[key] as Json[]).map(item => ({ ...item, path: replacePath(item.path) }));
  return { entries: isDeepStrictEqual(value, next) ? [] : [{ path: manifestPath, content: json(next) }], suite: renamed, manual: [] };
}

/** Remove only the unchanged suite source add created; edited suites require an explicit review. */
export async function removeSuite(root: string, name: string): Promise<SuiteChange> {
  const file = await readJsonFile(root, manifestPath).catch(() => null), value = file?.value as Json | undefined;
  const suite = `source:${name}`;
  if (!file || !value || !Array.isArray(value.suites)) return { entries: [], suite: null, manual: [] };
  const entry = (value.suites as Json[]).find(item => item?.name === suite);
  if (!entry) return { entries: [], suite: null, manual: [] };
  if (!isDeepStrictEqual(entry, scaffoldSuite(name))) return { entries: [], suite, manual: [`Review the customized ${suite} suite in ${manifestPath}; it was retained.`] };
  return { entries: [{ path: manifestPath, content: json({ ...value, suites: value.suites.filter(item => item !== entry) }) }], suite, manual: [] };
}

export async function withSuite(root: string, name: string): Promise<SuiteChange> {
  const file = await readJsonFile(root, manifestPath).catch(() => null), suite = `source:${name}`, folder = `src/${name}/tests`;
  const value = file?.value as Json | undefined;
  if (!file || !value || !Array.isArray(value.suites) || !Array.isArray(value.roots))
    return { entries: [], suite: null, manual: [`No usable ${manifestPath}: register ${folder} with your test runner by hand.`] };
  if ((value.suites as Json[]).some(item => item?.name === suite)) return { entries: [], suite, manual: [`${manifestPath} already has a ${suite} suite; review it.`] };
  const entry = scaffoldSuite(name);
  const reached = (value.roots as Json[]).some(item => typeof item?.path === 'string' && (posix.matchesGlob(folder, item.path) || folder.startsWith(`${item.path}/`)));
  const additions: Array<[string, unknown]> = [...(reached ? [] : [['roots', { path: folder }] as [string, unknown]]), ['suites', entry]];
  const expected = { ...value, roots: [...value.roots as unknown[], ...(reached ? [] : [{ path: folder }])], suites: [...value.suites as unknown[], entry] };
  return { entries: [{ path: manifestPath, content: edited(file.text, expected, additions) }], suite,
    manual: typeof value.documentation === 'string' ? [`Add a ${suite} row to ${value.documentation} (the suite table).`] : [] };
}
