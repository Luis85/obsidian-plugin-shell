import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Document } from 'yaml';
import { loadYaml, yamlRuntime } from './yaml-runtime.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { projectPath } from '../domain/user-settings.ts';
import type { CollectionValue } from '../domain/collection-record.ts';
import { renderNote } from './fake-data-plan.ts';
import { guardedText } from './user-settings.ts';
/** Note frontmatter split from its body; `body` is everything after the closing `---` line, byte for byte. */
export interface CollectionNoteParts { document: Document; properties: Record<string, unknown>; body: string }
const collectionNoteLimit = 1_000_000;
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor', '<<']);
function safe(document: Document): boolean {
  if (document.errors.length || document.warnings.length || !yamlRuntime().isMap(document.contents)) return false;
  let unsafe = false;
  yamlRuntime().visit(document, (key, node, path) => {
    const tagged = yamlRuntime().isScalar(node) && Boolean(node.tag);
    if (path.length > 30 || yamlRuntime().isAlias(node) || tagged || (yamlRuntime().isScalar(node) && key === 'key' && (typeof node.value !== 'string' || unsafeKeys.has(node.value)))) { unsafe = true; return yamlRuntime().visit.BREAK; }
    return undefined;
  });
  return !unsafe;
}
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
/**
 * The same inert YAML reading as the plugin's note repository (src/infrastructure/markdown.ts): core schema, unique
 * keys, no aliases, tags or prototype keys. Returns null for Markdown without frontmatter; malformed YAML throws.
 */
export function parseCollectionNote(markdown: string): CollectionNoteParts | null {
  requireSketch(Buffer.byteLength(markdown) <= collectionNoteLimit && !markdown.includes('\0'), 'COLLECTION_NOTE_SIZE', 'Notes are UTF-8 text under 1 MB without NUL.');
  if (!/^---\r?\n/.test(markdown)) return null;
  const block = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/.exec(markdown);
  requireSketch(block, 'COLLECTION_NOTE_YAML', 'Unclosed frontmatter.');
  let document: Document;
  try { document = yamlRuntime().parseDocument(block[1] ?? '', { uniqueKeys: true, strict: true, version: '1.2', schema: 'core', prettyErrors: false }); }
  catch { throw new SketchError('COLLECTION_NOTE_YAML', 'Malformed YAML frontmatter.'); }
  requireSketch(safe(document), 'COLLECTION_NOTE_YAML', 'Frontmatter must be a plain YAML mapping without aliases, tags or duplicate keys.');
  const properties: unknown = document.toJS({ maxAliasCount: 0 });
  requireSketch(plain(properties), 'COLLECTION_NOTE_YAML', 'Frontmatter must be a plain mapping.');
  return { document, properties, body: markdown.slice(block[0].length) };
}
/** A new note with the same serializer and options as fake-data and the plugin's note repository. */
export function renderCollectionNote(path: string, frontmatter: Record<string, CollectionValue>, body: string): string {
  return renderNote({ path, frontmatter, body });
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
/**
 * Sets and removes only the named keys in the existing YAML document, so unrelated properties keep their values,
 * order and comments, and the body keeps its exact bytes. The candidate is parsed again and compared before it is
 * offered for review.
 */
export function patchCollectionNote(markdown: string, set: Readonly<Record<string, CollectionValue>>, remove: readonly string[]): string {
  const parts = parseCollectionNote(markdown);
  requireSketch(parts, 'COLLECTION_NOTE_YAML', 'The note lost its frontmatter.');
  const { document, properties, body } = parts;
  for (const [key, value] of Object.entries(set)) {
    if (same(properties[key], value)) continue;
    const node = document.createNode(value);
    if (yamlRuntime().isScalar(node) && typeof value === 'string') node.type = 'QUOTE_DOUBLE';
    document.set(key, node);
  }
  for (const key of remove) if (Object.hasOwn(properties, key)) document.delete(key);
  const candidate = `---\n${document.toString({ lineWidth: 0 })}---\n${body}`;
  const expected: Record<string, unknown> = { ...properties, ...set };
  for (const key of remove) delete expected[key];
  verifyCandidate(candidate, expected, body);
  return candidate;
}
/** Prevalidation of the complete candidate bytes: exactly the expected properties and the original body. */
function verifyCandidate(candidate: string, expected: Record<string, unknown>, body: string): void {
  const check = parseCollectionNote(candidate);
  const exact = check !== null && check.body === body && same(Object.keys(expected).sort(), Object.keys(check.properties).sort());
  requireSketch(exact && Object.keys(expected).every(key => same(expected[key], check.properties[key])), 'COLLECTION_NOTE_CANDIDATE', 'The updated note would not read back exactly; nothing was written.');
}
export interface CollectionFile { path: string; content: string | null; beforeHash: string; problem?: string }
const scanLimits = { depth: 8, entries: 5000 };
/** Markdown files under the folder (hidden entries skipped, symbolic links refused), each read once behind its hash guard. */
export async function scanCollectionFolder(root: string, folder: string): Promise<CollectionFile[]> {
  await loadYaml();
  await guardedText(root, folder + '/.collection-scan');
  const files: CollectionFile[] = [];
  let count = 0;
  async function walk(path: string, depth: number): Promise<void> {
    let names: string[];
    try { names = (await readdir(join(root, path))).sort(); }
    catch (error) { if (depth === 0 && (error as { code?: string }).code === 'ENOENT') return; throw error; }
    for (const name of names.filter(item => !item.startsWith('.'))) {
      requireSketch(++count <= scanLimits.entries, 'COLLECTION_LIMIT', `A collection folder is limited to ${scanLimits.entries} entries.`);
      const child = projectPath(`${path}/${name}`), stat = await lstat(join(root, child));
      requireSketch(!stat.isSymbolicLink(), 'COLLECTION_SYMLINK', 'Collection folders refuse symbolic links: ' + child);
      if (stat.isDirectory() && depth < scanLimits.depth) await walk(child, depth + 1);
      if (stat.isFile() && /\.md$/i.test(name)) files.push(await readFile(root, child, stat.size));
    }
  }
  await walk(folder, 0);
  return files;
}
async function readFile(root: string, path: string, size: number): Promise<CollectionFile> {
  if (size > collectionNoteLimit) return { path, content: null, beforeHash: '', problem: 'larger than 1 MB' };
  try {
    const read = await guardedText(root, path);
    return { path, content: read.content, beforeHash: read.beforeHash! };
  } catch (error) {
    if (error instanceof SketchError) throw error;
    return { path, content: null, beforeHash: '', problem: 'unreadable (not UTF-8 text)' };
  }
}
