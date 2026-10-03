import type { Artifact } from './contracts.ts';
import { CompilerError, diagnostic } from './diagnostics.ts';

const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function portableArtifactPath(path: string): boolean {
  return path.length > 0 && path.length <= 500 && path.split('/').every(part => part !== '.' && part !== '..'
    && /^[A-Za-z0-9._-][A-Za-z0-9 _.-]*$/.test(part) && !/[. ]$/.test(part) && !reserved.test(part)
    && !['.git', 'node_modules'].includes(part.toLowerCase()));
}
/** Pure output validation; neither this function nor an artifact grants filesystem authority. */
export function validateArtifacts(files: readonly Artifact[]): void {
  const seen = new Map<string, string>();
  if (files.length > 5000) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'Generated output exceeds 5,000 files.'));
  for (const file of files) {
    if (!portableArtifactPath(file.path)) throw new CompilerError(diagnostic('COMPILER_PATH_COLLISION', 'emit', 'Unsafe artifact path: ' + file.path));
    const key = file.path.toLowerCase(), previous = seen.get(key);
    if (previous) throw new CompilerError(diagnostic('COMPILER_PATH_COLLISION', 'emit', `Artifact ${file.path} conflicts with ${previous}.`));
    seen.set(key, file.path);
  }
  for (const [key, path] of seen) {
    const segments = key.split('/');
    for (let index = 1; index < segments.length; index++) {
      const parent = seen.get(segments.slice(0, index).join('/'));
      if (parent) throw new CompilerError(diagnostic('COMPILER_PATH_COLLISION', 'emit', `${path} is nested beneath the file ${parent}.`));
    }
  }
}
/** Framework overlays and placeholder replacement are explicit, never Map.set last-writer wins. */
export function artifactCollector(initial: readonly Artifact[]) {
  validateArtifacts(initial);
  const files = new Map(initial.map(file => [file.path, { ...file }]));
  function add(file: Artifact, replaceProducer?: string): void {
    const old = files.get(file.path);
    if (old && (replaceProducer === undefined || old.producer !== replaceProducer)) {
      throw new CompilerError(diagnostic('COMPILER_PATH_COLLISION', 'emit',
        `${file.path}: ${file.producer ?? 'unknown'} would replace ${old.producer ?? 'unknown'} without an explicit replacement.`));
    }
    files.set(file.path, file);
  }
  return { add, get: (path: string) => files.get(path), values: () => [...files.values()].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
}
/** Canonical object keys; array order remains semantic. Inputs are already bounded JSON. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key,v]) => JSON.stringify(key) + ':' + canonicalJson(v)).join(',') + '}';
  }
  return JSON.stringify(value);
}
