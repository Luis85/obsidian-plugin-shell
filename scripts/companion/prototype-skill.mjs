/** One explicitly shipped agent skill, not a recursive copy of a user's .claude directory. */
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sha256 } from '../shared/hash.mjs';
export const prototypeSkillRoot = '.claude/skills/companion-prototype-design';
export const prototypeCodexSkillPath = '.agents/skills/companion-prototype-design/SKILL.md';

async function entrypoint(root, name, optional = false) {
  let file = root;
  const parts = name.split('/');
  for (const [index, part] of parts.entries()) {
    file = join(file, part);
    let stat;
    try { stat = await lstat(file); } catch (error) {
      if (optional && error.code === 'ENOENT') return null;
      throw new Error('PROTOTYPE_SKILL_ENTRYPOINT_MISSING: ' + name, { cause: error });
    }
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error('PROTOTYPE_SKILL_LINK: ' + name);
    if (index === parts.length - 1 && stat.size > 16_000) throw new Error('PROTOTYPE_SKILL_LIMIT: ' + name);
  }
  const bytes = await readFile(file);
  if (bytes.length > 16_000) throw new Error('PROTOTYPE_SKILL_LIMIT: ' + name);
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return { path: name, bytes };
}
const inventoryName = 'PACKAGE-INVENTORY.json';
const safeName = name => name.split('/').every(part => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(part) && !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
/** Missing skill is valid for legacy framework kits; a partial/tampered package is not. */
export async function prototypeSkillFiles(root) {
  let parent = root;
  for (const part of prototypeSkillRoot.split('/')) {
    parent = join(parent, part);
    let stat;
    try { stat = await lstat(parent); } catch (error) { if (error.code === 'ENOENT') {
      if (await entrypoint(root, prototypeCodexSkillPath, true)) throw new Error('PROTOTYPE_SKILL_INCOMPLETE: Codex adapter without canonical skill');
      return [];
    } throw error; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('PROTOTYPE_SKILL_LINK');
  }
  const found = new Map(); let total = 0;
  async function walk(relative = '') {
    for (const name of (await readdir(join(parent, relative))).sort()) {
      if (name === '__pycache__') continue;
      const path = relative ? `${relative}/${name}` : name;
      if (!safeName(path)) throw new Error('PROTOTYPE_SKILL_PATH: ' + path);
      const stat = await lstat(join(parent, path));
      if (stat.isSymbolicLink()) throw new Error('PROTOTYPE_SKILL_LINK: ' + path);
      if (stat.isDirectory()) { await walk(path); continue; }
      if (!stat.isFile() || stat.size > 1_000_000 || found.size >= 200 || (total += stat.size) > 8_000_000) throw new Error('PROTOTYPE_SKILL_LIMIT');
      const bytes = await readFile(join(parent, path));
      if (bytes.length !== stat.size || /\.(?:ttf|otf|woff2?|eot|pem|key|p12|pfx)$/i.test(path)) throw new Error('PROTOTYPE_SKILL_FILE: ' + path);
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      found.set(path, bytes);
    }
  }
  await walk();
  const raw = found.get(inventoryName);
  if (!raw) throw new Error('PROTOTYPE_SKILL_INVENTORY: missing inventory');
  const inventory = JSON.parse(raw.toString('utf8'));
  if (inventory.kind !== 'agent-skill-package-inventory' || inventory.schemaVersion !== 1 || !Array.isArray(inventory.files) || inventory.files.length !== found.size - 1) throw new Error('PROTOTYPE_SKILL_INVENTORY: count or format');
  const names = new Set();
  for (const record of inventory.files) {
    if (typeof record.path !== 'string' || !safeName(record.path) || record.path === inventoryName || names.has(record.path.toLowerCase())) throw new Error('PROTOTYPE_SKILL_INVENTORY: path');
    names.add(record.path.toLowerCase());
    const bytes = found.get(record.path);
    if (!bytes || bytes.length !== record.bytes || sha256(bytes) !== record.sha256) throw new Error('PROTOTYPE_SKILL_INTEGRITY: ' + record.path);
  }
  if (!found.has('SKILL.md') || !found.has('scripts/prototype.mjs')) throw new Error('PROTOTYPE_SKILL_INCOMPLETE');
  const files = [...found.entries()].map(([path, bytes]) => ({ path: `${prototypeSkillRoot}/${path}`, bytes }));
  // A single allowlisted external entrypoint, never a recursive read of .agents.
  // Legacy packages without entrypoints remain readable; an orphan adapter does not.
  const adapter = await entrypoint(root, prototypeCodexSkillPath, true);
  if (inventory.entrypoints === undefined) {
    if (adapter) throw new Error('PROTOTYPE_SKILL_INVENTORY: unlisted Codex entrypoint');
  } else {
    const entries = inventory.entrypoints;
    if (!Array.isArray(entries) || entries.length !== 1 || entries[0]?.path !== prototypeCodexSkillPath) throw new Error('PROTOTYPE_SKILL_INVENTORY: entrypoint allowlist');
    if (!adapter) throw new Error('PROTOTYPE_SKILL_ENTRYPOINT_MISSING: ' + prototypeCodexSkillPath);
    const record = entries[0];
    if (adapter.bytes.length !== record.bytes || sha256(adapter.bytes) !== record.sha256) throw new Error('PROTOTYPE_SKILL_INTEGRITY: ' + record.path);
    files.push(adapter);
  }
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
