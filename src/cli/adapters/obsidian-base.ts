import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { isAlias, isNode, parseDocument, visit } from 'yaml';
import { assertJsonData } from '../../../scripts/contracts/json-data.ts';
import { requireSketch } from '../domain/errors.ts';
import type { BaseNote, BaseValue } from '../domain/base-expression.ts';
import { readBase, requiredFolder, type BaseDefinition } from '../domain/obsidian-base.ts';
import type { BaseSource } from '../domain/base-collection.ts';
import { hash, readBounded } from './framework/files.ts';

/**
 * Reads an Obsidian `.base` file and the Markdown notes of the vault it belongs to. Read-only and bounded: links are
 * never followed, hidden folders and node_modules are skipped, and YAML is plain core-schema data.
 */
const VAULT_LIMITS = Object.freeze({ entries: 20000, notes: 5000, noteBytes: 1_048_576, totalBytes: 32 * 1_048_576, baseBytes: 262_144 });
export interface VaultScan { notes: BaseNote[]; scanned: { folder: string | null; entries: number; notes: number; bytes: number }; skipped: { links: string[]; invalidFrontmatter: string[] } }
export interface LoadedBase { definition: BaseDefinition; source: BaseSource }

/** Core-schema YAML only: no aliases, anchors, explicit tags or directives, and only JSON-compatible values. */
export function plainYaml(source: string, name: string): unknown {
  requireSketch(!/^%/m.test(source), 'BASE_YAML', `${name}: YAML directives are not supported.`);
  const document = parseDocument(source, { uniqueKeys: true, strict: true, version: '1.2', schema: 'core', stringKeys: true });
  requireSketch(!document.errors.length && !document.warnings.length, 'BASE_YAML', `${name}: ${document.errors[0]?.message ?? document.warnings[0]?.message}`);
  visit(document, (_key, node) => {
    requireSketch(!isAlias(node), 'BASE_YAML', `${name}: YAML aliases are not supported.`);
    if (isNode(node)) requireSketch(!node.tag && !('anchor' in node && node.anchor), 'BASE_YAML', `${name}: YAML tags and anchors are not supported.`);
  });
  const value: unknown = document.toJS({ maxAliasCount: 0 });
  try { assertJsonData(value ?? {}); } catch { requireSketch(false, 'BASE_YAML', `${name}: values must be plain JSON-compatible data.`); }
  return value ?? null;
}

const posixPath = (path: string): string => path.split(sep).join('/');
/** Resolves `path` (relative to `root`) and requires it to stay inside `vault`; returns the vault-relative path. */
function vaultRelative(vault: string, root: string, path: string): string {
  const inside = relative(vault, resolve(root, path));
  requireSketch(inside !== '' && !inside.startsWith('..') && !isAbsolute(inside), 'BASE_PATH', `${path} is not inside the vault ${vault}.`);
  return posixPath(inside);
}
export async function resolveVault(root: string, vault: string | undefined): Promise<string> {
  const path = resolve(root, vault ?? '.');
  const stat = await lstat(path).catch(() => null);
  requireSketch(stat?.isDirectory(), 'BASE_VAULT', `The vault folder ${path} does not exist.`);
  return realpath(path);
}

export async function loadBase(root: string, vault: string, file: string | undefined): Promise<LoadedBase> {
  requireSketch(file && /\.base$/i.test(file), 'BASE_PATH', 'Name the .base file, for example node bin/app base views Collections/Books.base.');
  const path = vaultRelative(vault, root, file);
  const bytes = await readBounded(join(vault, path), VAULT_LIMITS.baseBytes);
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { definition: readBase(plainYaml(source, path)), source: { path, sha256: hash(bytes) } };
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\s*(?:\r?\n|$)/;
function frontmatter(text: string, path: string): Record<string, BaseValue> | null {
  const match = FRONTMATTER.exec(text);
  if (!match) return {};
  try {
    const value = plainYaml(match[1]!, path);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, BaseValue> : null;
  } catch { return null; }
}
/** Frontmatter `tags`/`tag` plus inline `#tags` outside code. */
export function noteTags(properties: Record<string, BaseValue>, body: string): string[] {
  const declared = [properties.tags, properties.tag].flatMap(value => Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,]+/) : []);
  const prose = body.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g, '');
  const inline = [...prose.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu)].map(match => match[1]!);
  return [...new Set([...declared, ...inline].map(tag => String(tag).replace(/^#/, '')).filter(Boolean))].sort();
}

interface Walk { vault: string; result: VaultScan; total: number }
async function readNote(walk: Walk, path: string): Promise<void> {
  requireSketch(walk.result.notes.length < VAULT_LIMITS.notes, 'BASE_LIMIT', `Ingestion reads at most ${VAULT_LIMITS.notes} notes; narrow the base with file.inFolder().`);
  const bytes = await readBounded(join(walk.vault, path), VAULT_LIMITS.noteBytes);
  walk.total += bytes.length;
  requireSketch(walk.total <= VAULT_LIMITS.totalBytes, 'BASE_LIMIT', 'Ingestion reads at most 32 MB of Markdown.');
  const text = bytes.toString('utf8');
  const properties = frontmatter(text, path);
  if (properties === null) walk.result.skipped.invalidFrontmatter.push(path);
  const body = text.replace(FRONTMATTER, '');
  walk.result.notes.push({ path, properties: properties ?? {}, tags: noteTags(properties ?? {}, body), size: bytes.length });
}
async function walkFolder(walk: Walk, folder: string): Promise<void> {
  const entries = await readdir(join(walk.vault, folder), { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT' && folder === walk.result.scanned.folder) return [];
    throw error;
  });
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    requireSketch(++walk.result.scanned.entries <= VAULT_LIMITS.entries, 'BASE_LIMIT', `Ingestion visits at most ${VAULT_LIMITS.entries} vault entries; narrow the base with file.inFolder().`);
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) walk.result.skipped.links.push(path);
    else if (entry.isDirectory()) await walkFolder(walk, path);
    else if (entry.isFile() && /\.md$/i.test(entry.name)) await readNote(walk, path);
  }
}
/** All Markdown notes the base can match, in path order. Only the folder a top-level file.inFolder() requires is read. */
export async function scanVault(vault: string, base: BaseDefinition): Promise<VaultScan> {
  const folder = requiredFolder(base.filters);
  requireSketch(folder === null || !folder.split('/').some(part => part === '..' || part.startsWith('.')), 'BASE_PATH', `file.inFolder("${folder}") must name a visible vault folder.`);
  const result: VaultScan = { notes: [], scanned: { folder, entries: 0, notes: 0, bytes: 0 }, skipped: { links: [], invalidFrontmatter: [] } };
  const walk: Walk = { vault, result, total: 0 };
  await walkFolder(walk, folder ?? '');
  result.scanned.notes = result.notes.length; result.scanned.bytes = walk.total;
  return result;
}
