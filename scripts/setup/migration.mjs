import { readFile, lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan } from '../shared/file-plan.mjs';
async function optional(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function safeRead(root, path) {
  const inspected = await createFilePlan(root, [{ path, content: null }]); // Validate/hash only; this inspection plan is never applied.
  if (!await optional(join(root, path))) return null;
  const bytes = await readFile(join(root, path)); const text = bytes.toString('utf8');
  if (createHash('sha256').update(bytes).digest('hex') !== inspected.changes[0].beforeHash) throw new Error('Migration inputs changed during inspection');
  if (!Buffer.from(text, 'utf8').equals(bytes)) throw new Error('Migration input is not lossless UTF-8; original bytes are preserved for manual inspection');
  return text;
}
export async function planMigration(root, { from, to, previousId, profile, expectedManifest, previousManifest, receipt }) {
  const vault = join(root, '.dev-vault');
  const config = join(vault, '.obsidian');
  const plugins = join(config, 'plugins');
  if (!await optional(vault)) { if (from) throw new Error('Migration source vault is missing'); return null; }
  if (!await optional(config)) { if (from) throw new Error('Migration source configuration is missing'); return null; }
  await createFilePlan(config, []); // Root realpath validation blocks symlink ancestors before any vault read.
  if (!await optional(plugins)) { if (from) throw new Error('Migration source installation is missing'); return null; }
  await createFilePlan(plugins, []);
  if (profile === 'native') {
    const target = await safeRead(plugins, `${to}/manifest.json`);
    if (target !== null) {
      const installed = JSON.parse(target);
      const same = value => value && JSON.stringify(Object.entries(installed).sort()) === JSON.stringify(Object.entries(value).sort());
      if (!same(expectedManifest) && !(previousId === to && same(previousManifest))) throw new Error('Destination installation conflicts with the reviewed identity; unrelated plugins are preserved');
    } else if (await optional(join(plugins, to))) {
      const contents = await readdir(join(plugins, to));
      if (contents.length && !(from && receipt?.status === 'verified' && receipt.from === from && receipt.to === to && contents.every(name => name === 'data.json'))) throw new Error('Destination plugin directory is occupied without a verified migration receipt');
    }
  }
  if (!from) {
    if (previousId !== to && await safeRead(plugins, `${previousId}/manifest.json`)) throw new Error('Installed identity requires explicit --migrate-from and --profile native');
    return null;
  }
  if (from === to) throw new Error('Migration source and destination ids must differ');
  if (profile !== 'native') throw new Error('Installed migration requires --profile native');
  const enabledText = await safeRead(config, 'community-plugins.json');
  const enabled = enabledText === null ? [] : JSON.parse(enabledText);
  if (!Array.isArray(enabled) || enabled.some(value => typeof value !== 'string')) throw new Error('Cannot validate enabled plugins');
  if (enabled.includes(from) || enabled.includes(to)) throw new Error('Disable both migration plugins in the contained vault before setup; security settings are never changed');
  const previous = await safeRead(plugins, `${from}/manifest.json`);
  if (!previous || JSON.parse(previous).id !== from) throw new Error('Migration source installation does not match its id');
  const data = await safeRead(plugins, `${from}/data.json`);
  const entries = [{ path: `${from}/manifest.json`, content: previous }, { path: `${from}/data.json`, content: data }];
  let destinationHash;
  if (data !== null) {
    const destination = `${to}/data.json`; const current = await safeRead(plugins, destination);
    if (current !== null && current !== data) throw new Error('Destination plugin data conflicts; neither copy is changed');
    destinationHash = current === null ? null : createHash('sha256').update(current).digest('hex');
    entries.push({ path: destination, content: data });
  }
  const plan = await createFilePlan(plugins, entries);
  if (plan.changes.some(change => change.path.startsWith(`${from}/`) && change.status !== 'unchanged')) throw new Error('Migration source changed during planning; review a new plan');
  if (data !== null && plan.changes.find(change => change.path === `${to}/data.json`).beforeHash !== destinationHash) throw new Error('Migration destination changed during planning; review a new plan');
  return { from, to, oldInstallationPreserved: true, plan };
}
