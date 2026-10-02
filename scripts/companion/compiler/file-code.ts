import { posix } from 'node:path';
import { requireValue } from './model.ts';
export interface Entry { path: string; content: string; encoding?: 'base64'; ownership: 'managed' | 'extension' | 'framework' }
export type Add = (path: string, content: string, ownership?: Entry['ownership']) => void;
/** Vue component files need multi-word names (vue/multi-word-component-names): a single-word name gets its role as suffix. */
export function componentFile(name: string, role: 'screen' | 'component'): string { return name.includes('-') ? name : `${name}-${role}`; }
export function relativeImport(from: string, to: string): string { const path = posix.relative(posix.dirname(from),to); return path.startsWith('.') ? path : './'+path; }
/** Copied template text is rewritten by exact literals; a literal that drifted away fails generation instead of emitting stale text. */
export function rewriteTemplate(source: string, pairs: ReadonlyArray<readonly [string, string]>, file: string): string {
  for (const [from, to] of pairs) { requireValue(source.includes(from), `Template ${file} no longer contains ${from}.`); source = source.replaceAll(from, to); }
  return source;
}
/** First line of the tests/tooling suites that generated projects receive as Vitest suites; the generator removes it. */
export const copiedTemplateMarker = '// Copied template text: generated projects receive this suite with this line removed, a vitest import and rewritten runtime paths. Keep the plain node:test import.\n';
export function copiedTemplateTest(source: string, pairs: ReadonlyArray<readonly [string, string]>, file: string): string {
  return rewriteTemplate(source, [[copiedTemplateMarker, ''], ["import { test } from 'node:test';", "import { test } from 'vitest';"], ...pairs], file);
}
