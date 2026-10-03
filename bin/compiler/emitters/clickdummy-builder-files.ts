/** The offline click-dummy build worker is the one runtime part of the framework's prototype skill that a
 * generated project needs (`node bin/app clickdummy build`). The skill itself (instructions, references, evidence
 * and its repository-specific description) is not copied; only the worker and the helpers it imports are, under
 * scripts/clickdummy/ with their relative layout intact. */
import { posix } from 'node:path';
import type { Artifact } from '../domain/contracts.ts';

const skillScripts = '.claude/skills/companion-prototype-design/scripts/';
const clickdummyBuilderRoot = 'scripts/clickdummy/';
const relativeImports = /(?:\bfrom\s*|\bimport\s*\(?\s*)'(\.{1,2}\/[^']+)'/g;
/** The worker plus every file it reaches through relative imports, in stable order. Empty when the checkout ships no skill. */
export function clickdummyBuilderFiles(skillFiles: readonly Artifact[]): Artifact[] {
  const available = new Map(skillFiles.filter(file => file.path.startsWith(skillScripts)).map(file => [file.path.slice(skillScripts.length), file]));
  const pending = ['lib/build-worker.mjs'], found = new Map<string, Artifact>();
  for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
    if (found.has(path)) continue;
    const file = available.get(path);
    if (!file) { if (found.size === 0) return []; throw new Error('GENERATOR_CLICKDUMMY_BUILDER_IMPORT: ' + path); }
    found.set(path, file);
    for (const [, specifier] of file.content.matchAll(relativeImports)) pending.push(posix.normalize(posix.join(posix.dirname(path), specifier!)));
  }
  return [...found].sort(([a], [b]) => a < b ? -1 : 1).map(([path, file]) => ({ ...file, path: clickdummyBuilderRoot + path }));
}
