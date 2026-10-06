/** One explicitly shipped agent skill, not a recursive copy of a user's .claude directory. */
import type { Stats } from 'node:fs';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../../../../scripts/shared/hash.ts';
export const prototypeSkillRoot = '.claude/skills/companion-prototype-design';
export const prototypeCodexSkillPath = '.agents/skills/companion-prototype-design/SKILL.md';
export interface SkillFile { path: string; bytes: Buffer }
interface Collected { found: Map<string, Buffer>; total: number }
type Fields = Record<string, unknown>;

const inventoryName = 'PACKAGE-INVENTORY.json';
const entrypointLimit = 16_000;
const blockedExtension = /\.(?:ttf|otf|woff2?|eot|pem|key|p12|pfx)$/i;
const reservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value);
const missing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const safePart = (part: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part) && !/[. ]$/.test(part) && !reservedName.test(part);
const safeName = (name: string): boolean => name.split('/').every(safePart);
const decodeUtf8 = (bytes: Buffer): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const recorded = (bytes: Buffer, record: Fields): boolean => bytes.length === record.bytes && sha256(bytes) === record.sha256;

async function entrypointStat(file: string, name: string): Promise<Stats | null> {
  try { return await lstat(file); } catch (error) {
    if (missing(error)) return null;
    throw new Error('PROTOTYPE_SKILL_ENTRYPOINT_MISSING: ' + name, { cause: error });
  }
}
function checkEntrypointPart(stat: Stats, last: boolean, name: string): void {
  if (stat.isSymbolicLink() || (last ? !stat.isFile() : !stat.isDirectory())) throw new Error('PROTOTYPE_SKILL_LINK: ' + name);
  if (last && stat.size > entrypointLimit) throw new Error('PROTOTYPE_SKILL_LIMIT: ' + name);
}
/** An optional allowlisted file outside the skill folder: absent is null, a link or oversized file is refused. */
async function entrypoint(root: string, name: string): Promise<SkillFile | null> {
  let file = root;
  const parts = name.split('/');
  for (const [index, part] of parts.entries()) {
    file = join(file, part);
    const stat = await entrypointStat(file, name);
    if (!stat) return null;
    checkEntrypointPart(stat, index === parts.length - 1, name);
  }
  const bytes = await readFile(file);
  if (bytes.length > entrypointLimit) throw new Error('PROTOTYPE_SKILL_LIMIT: ' + name);
  decodeUtf8(bytes);
  return { path: name, bytes };
}

/** The canonical skill folder, or null when the kit ships none. */
async function skillFolder(root: string): Promise<string | null> {
  let parent = root;
  for (const part of prototypeSkillRoot.split('/')) {
    parent = join(parent, part);
    let stat: Stats;
    try { stat = await lstat(parent); } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PROTOTYPE_SKILL_LINK');
  }
  return parent;
}

async function collectFile(parent: string, path: string, stat: Stats, state: Collected): Promise<void> {
  if (!stat.isFile() || stat.size > 1_000_000 || state.found.size >= 200) throw new Error('PROTOTYPE_SKILL_LIMIT');
  state.total += stat.size;
  if (state.total > 8_000_000) throw new Error('PROTOTYPE_SKILL_LIMIT');
  const bytes = await readFile(join(parent, path));
  if (bytes.length !== stat.size || blockedExtension.test(path)) throw new Error('PROTOTYPE_SKILL_FILE: ' + path);
  decodeUtf8(bytes);
  state.found.set(path, bytes);
}
async function walk(parent: string, relative: string, state: Collected): Promise<void> {
  for (const name of (await readdir(join(parent, relative))).sort()) {
    if (name === '__pycache__') continue;
    const path = relative ? `${relative}/${name}` : name;
    if (!safeName(path)) throw new Error('PROTOTYPE_SKILL_PATH: ' + path);
    const stat = await lstat(join(parent, path));
    if (stat.isSymbolicLink()) throw new Error('PROTOTYPE_SKILL_LINK: ' + path);
    if (stat.isDirectory()) await walk(parent, path, state);
    else await collectFile(parent, path, stat, state);
  }
}

function readInventory(found: Map<string, Buffer>): { files: unknown[]; entrypoints: unknown } {
  const raw = found.get(inventoryName);
  if (!raw) throw new Error('PROTOTYPE_SKILL_INVENTORY: missing inventory');
  const inventory: unknown = JSON.parse(raw.toString('utf8'));
  if (!isFields(inventory) || inventory.kind !== 'agent-skill-package-inventory' || inventory.schemaVersion !== 1 ||
      !Array.isArray(inventory.files) || inventory.files.length !== found.size - 1) throw new Error('PROTOTYPE_SKILL_INVENTORY: count or format');
  return { files: inventory.files, entrypoints: inventory.entrypoints };
}
function verifyRecords(records: unknown[], found: Map<string, Buffer>): void {
  const names = new Set<string>();
  for (const record of records) {
    if (!isFields(record) || typeof record.path !== 'string' || !safeName(record.path) || record.path === inventoryName ||
        names.has(record.path.toLowerCase())) throw new Error('PROTOTYPE_SKILL_INVENTORY: path');
    names.add(record.path.toLowerCase());
    const bytes = found.get(record.path);
    if (!bytes || !recorded(bytes, record)) throw new Error('PROTOTYPE_SKILL_INTEGRITY: ' + record.path);
  }
}
/** A single allowlisted external entrypoint, never a recursive read of .agents. Legacy packages without entrypoints remain readable; an orphan adapter does not. */
async function codexAdapter(root: string, entrypoints: unknown): Promise<SkillFile | null> {
  const adapter = await entrypoint(root, prototypeCodexSkillPath);
  if (entrypoints === undefined) {
    if (adapter) throw new Error('PROTOTYPE_SKILL_INVENTORY: unlisted Codex entrypoint');
    return null;
  }
  const record: unknown = Array.isArray(entrypoints) && entrypoints.length === 1 ? entrypoints[0] : undefined;
  if (!isFields(record) || record.path !== prototypeCodexSkillPath) throw new Error('PROTOTYPE_SKILL_INVENTORY: entrypoint allowlist');
  if (!adapter) throw new Error('PROTOTYPE_SKILL_ENTRYPOINT_MISSING: ' + prototypeCodexSkillPath);
  if (!recorded(adapter.bytes, record)) throw new Error('PROTOTYPE_SKILL_INTEGRITY: ' + prototypeCodexSkillPath);
  return adapter;
}
const byPath = (a: SkillFile, b: SkillFile): number => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

/** Missing skill is valid for legacy framework kits; a partial/tampered package is not. */
export async function prototypeSkillFiles(root: string): Promise<SkillFile[]> {
  const parent = await skillFolder(root);
  if (!parent) {
    if (await entrypoint(root, prototypeCodexSkillPath)) throw new Error('PROTOTYPE_SKILL_INCOMPLETE: Codex adapter without canonical skill');
    return [];
  }
  const state: Collected = { found: new Map(), total: 0 };
  await walk(parent, '', state);
  const { files: records, entrypoints } = readInventory(state.found);
  verifyRecords(records, state.found);
  if (!state.found.has('SKILL.md') || !state.found.has('scripts/prototype.mjs')) throw new Error('PROTOTYPE_SKILL_INCOMPLETE');
  const files = [...state.found.entries()].map(([path, bytes]) => ({ path: `${prototypeSkillRoot}/${path}`, bytes }));
  const adapter = await codexAdapter(root, entrypoints);
  if (adapter) files.push(adapter);
  return files.sort(byPath);
}
