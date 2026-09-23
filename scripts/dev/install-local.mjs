import { readFile, mkdir, lstat, mkdtemp, copyFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve, relative, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { runNode } from '../shared/process.mjs';
const assets = ['main.js', 'styles.css', 'manifest.json'];
async function absent(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function contained(root, target) {
  const path = relative(root, target);
  if (path.startsWith('..') || path.includes(`..${sep}`) || resolve(root, path) !== target) throw new Error('UNSAFE_TARGET');
  let current = root;
  for (const part of path.split(sep).filter(Boolean)) {
    current = join(current, part); const stat = await absent(current);
    if (stat?.isSymbolicLink()) throw new Error('SYMLINK_TARGET');
    if (stat && current !== target && !stat.isDirectory()) throw new Error('TARGET_PARENT_NOT_DIRECTORY');
  }
}
export async function installLocal({ root = process.cwd(), vault = '.dev-vault', configDir = '.obsidian', dryRun = false, beforePromote, beforeRestore } = {}) {
  root = resolve(root);
  if (!/^\.[a-zA-Z0-9_-]+$/.test(configDir)) throw new Error('INVALID_CONFIG_DIRECTORY');
  const manifest = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8'));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) throw new Error('INVALID_PLUGIN_ID');
  const vaultPath = resolve(root, vault); await contained(root, vaultPath);
  const target = join(vaultPath, configDir, 'plugins', manifest.id); await contained(root, target);
  const plan = []; const snapshot = new Map();
  for (const name of assets) {
    const source = join(root, 'dist', name); const stat = await lstat(source);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('INVALID_ARTIFACT');
    const bytes = await readFile(source); if (!bytes.length) throw new Error('EMPTY_ARTIFACT');
    const previous = await absent(join(target, name)); if (previous && (!previous.isFile() || previous.isSymbolicLink())) throw new Error('UNSAFE_EXISTING_ASSET');
    snapshot.set(name, bytes);
    plan.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  async function checkInstalledIdentity() {
    if (!await absent(join(target, 'manifest.json'))) return;
    const installed = JSON.parse(await readFile(join(target, 'manifest.json'), 'utf8'));
    if (installed.id !== manifest.id) throw new Error('INSTALLED_IDENTITY_CONFLICT');
  }
  await checkInstalledIdentity();
  if (dryRun) return { target, assets: plan, written: false };
  await mkdir(target, { recursive: true }); await contained(root, target);
  const lock = join(target, '.shell-install-lock');
  await mkdir(lock); // EEXIST prevents overlapping installs; never delete another install's lock.
  let stage;
  let recoveryRequired = false;
  const changed = [];
  try {
    await checkInstalledIdentity();
    stage = await mkdtemp(join(target, '.shell-stage-'));
    for (const name of assets) {
      await writeFile(join(stage, name), snapshot.get(name));
      if (await absent(join(target, name))) await copyFile(join(target, name), join(stage, `${name}.previous`));
    }
    for (const [index, name] of assets.entries()) {
      await beforePromote?.(name, index); await contained(root, target);
      await rename(join(stage, name), join(target, name)); changed.push(name);
    }
  } catch (error) {
    const report = { restored: [], preserved: [], recoveryPath: stage ?? null };
    if (stage) for (const name of [...changed].reverse()) {
      try {
        await contained(root, target); await beforeRestore?.(name);
        const destination = join(target, name); const current = await absent(destination);
        if (!current?.isFile() || current.isSymbolicLink() || !(await readFile(destination)).equals(snapshot.get(name))) {
          recoveryRequired = true; report.preserved.push(name); continue;
        }
        const backup = join(stage, `${name}.previous`);
        if (await absent(backup)) await copyFile(backup, destination); else await rm(destination);
        report.restored.push(name);
      } catch { recoveryRequired = true; report.preserved.push(name); }
    }
    if (recoveryRequired) {
      await writeFile(join(lock, 'recovery.json'), JSON.stringify(report, null, 2) + '\n');
      const recovery = new Error(`INSTALL_RECOVERY_REQUIRED: preserved backups at ${stage}`);
      recovery.report = report; throw recovery;
    }
    throw error;
  } finally {
    if (!recoveryRequired) { if (stage) await rm(stage, { recursive: true, force: true }); await rm(lock, { recursive: true }); }
  }
  return { target, assets: plan, written: true };
}
async function cli() {
  const args = process.argv.slice(2); let vault = '.dev-vault'; let configDir = '.obsidian'; let build = true; let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--vault') vault = args[++i] ?? '';
    else if (arg === '--config-dir') configDir = args[++i] ?? '';
    else if (arg === '--no-build') build = false;
    else if (arg === '--dry-run') dryRun = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (build && !dryRun) await runNode('scripts/bundling/build.mjs');
  console.log(JSON.stringify(await installLocal({ vault, configDir, dryRun }), null, 2));
  const identity = JSON.parse(await readFile('manifest.json', 'utf8'));
  console.log(`Open the selected vault in Obsidian. Enable ${identity.name} manually, then run “Open capability showcase”. Restricted Mode was not changed.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) cli().catch(error => { console.error(error.message); process.exitCode = 1; });
