import { lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile, copyFile } from 'node:fs/promises';
import { join, relative, resolve, sep, isAbsolute } from 'node:path';

/** Contained real-Obsidian vaults: a persistent developer sandbox and per-case copies.
 * Never a personal vault, never a symlinked path, never .dev-vault. */
/** Only dedicated sandbox folders: never .dev-vault, .test-vault, .companion, .framework, .claude, .vscode or .obsidian. */
const sandboxName = /^\.obsidian-sandbox[a-zA-Z0-9_-]*$/;

async function entry(path) {
  try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
/** Every existing component between root and target must be a real directory (or the final file). */
export async function assertContained(root, target) {
  root = resolve(root); target = resolve(target);
  const path = relative(root, target);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) throw new Error('SANDBOX_PATH_ESCAPE');
  let current = root;
  for (const part of path.split(sep)) {
    current = join(current, part);
    const stat = await entry(current);
    if (!stat) return target;
    if (stat.isSymbolicLink()) throw new Error('SANDBOX_PATH_SYMLINK');
    if (current !== target && !stat.isDirectory()) throw new Error('SANDBOX_PATH_NOT_DIRECTORY');
  }
  return target;
}
export function sandboxDirectory(name) {
  if (typeof name !== 'string' || !sandboxName.test(name)) throw new Error('SANDBOX_NAME_INVALID');
  return name;
}
/** Copy regular files and directories only; any symlink or special file fails before the copy is used. */
export async function copyVaultTree(source, target) {
  const stat = await entry(source);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('VAULT_SOURCE_INVALID');
  if (await entry(target)) throw new Error('VAULT_TARGET_EXISTS');
  await mkdir(target);
  let files = 0;
  for (const name of (await readdir(source)).sort()) {
    const from = join(source, name); const to = join(target, name);
    const item = await lstat(from);
    if (item.isSymbolicLink()) throw new Error(`VAULT_SOURCE_SYMLINK: ${name}`);
    if (item.isDirectory()) files += await copyVaultTree(from, to);
    else if (item.isFile()) { await copyFile(from, to); files++; }
    else throw new Error(`VAULT_SOURCE_NOT_REGULAR: ${name}`);
  }
  return files;
}
/** Seed once; an existing sandbox vault is preserved byte-for-byte. */
export async function seedSandbox({ root = process.cwd(), source = 'tests/obsidian/vault', sandbox = '.obsidian-sandbox' } = {}) {
  root = resolve(root);
  const base = await assertContained(root, join(root, sandboxDirectory(sandbox)));
  const vault = await assertContained(root, join(base, 'vault'));
  const logs = await assertContained(root, join(base, 'logs'));
  const origin = await assertContained(root, resolve(root, source));
  await mkdir(base, { recursive: true }); await mkdir(logs, { recursive: true });
  await assertContained(root, logs);
  const existing = await entry(vault);
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error('SANDBOX_VAULT_INVALID');
    return { seeded: false, vault, logs, files: 0 };
  }
  const stage = await mkdtemp(join(base, '.seed-'));
  try {
    const files = await copyVaultTree(origin, join(stage, 'vault'));
    await rename(join(stage, 'vault'), vault);
    return { seeded: true, vault, logs, files };
  } finally { await rm(stage, { recursive: true, force: true }); }
}
/** Enable one plugin in this contained vault only; corrupt host data is preserved, not replaced. */
export async function enableVaultPlugin(root, vault, id) {
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('SANDBOX_PLUGIN_ID_INVALID');
  const folder = await assertContained(root, join(vault, '.obsidian'));
  await mkdir(folder, { recursive: true });
  const path = await assertContained(root, join(folder, 'community-plugins.json'));
  let enabled = [];
  if (await entry(path)) {
    try { enabled = JSON.parse(await readFile(path, 'utf8')); } catch { throw new Error('SANDBOX_COMMUNITY_PLUGINS_INVALID'); }
    if (!Array.isArray(enabled) || enabled.some(value => typeof value !== 'string')) throw new Error('SANDBOX_COMMUNITY_PLUGINS_INVALID');
    if (enabled.includes(id)) return { changed: false, enabled };
  }
  const next = [...enabled, id];
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, path);
  return { changed: true, enabled: next };
}
