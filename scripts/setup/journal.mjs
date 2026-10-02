import { readFile, readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createFilePlan, applyFilePlan } from '../shared/file-plan.mjs';
const journalPath = '.template-state/setup.json';
export const digest = value => createHash('sha256').update(value).digest('hex');
async function present(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
export async function readJournal(root) {
  await createFilePlan(root, [{ path: journalPath, content: null }]);
  if (!await present(join(root, journalPath))) return null;
  const bytes = await readFile(join(root, journalPath));
  const journal = JSON.parse(bytes.toString('utf8'));
  const ids = new Set();
  if (!journal || journal.version !== 1 || !/^[a-f0-9]{64}$/.test(journal.fingerprint ?? '') || !Array.isArray(journal.stages)
    || !['running', 'failed', 'verified'].includes(journal.status) || !journal.options || typeof journal.options !== 'object' || Array.isArray(journal.options)
    || !journal.identity || typeof journal.identity !== 'object' || Array.isArray(journal.identity)
    || journal.stages.some(stage => {
      if (!stage || !['install', 'browser-provision', 'verify', 'native-install'].includes(stage.id) || ids.has(stage.id) || typeof stage.selected !== 'boolean'
        || !['pending', 'skipped', 'running', 'failed', 'verified'].includes(stage.status) || !Array.isArray(stage.command) || stage.command.some(value => typeof value !== 'string')) return true;
      ids.add(stage.id); return false;
    })) throw new Error('Invalid setup journal; preserve it for inspection');
  Object.defineProperty(journal, 'sourceHash', { value: digest(bytes), enumerable: false });
  return journal;
}
export async function writeJournal(root, journal, expectedHash) {
  const plan = await createFilePlan(root, [{ path: journalPath, content: `${JSON.stringify(journal, null, 2)}\n` }]);
  if (expectedHash !== undefined && plan.changes[0].beforeHash !== expectedHash) throw new Error('Setup journal changed externally; preserve it and review recovery');
  await applyFilePlan(plan); return plan.changes[0].afterHash;
}
export async function inputFingerprint(root, toolchain, options) {
  const files = [];
  async function visit(path) {
    const absolute = join(root, path); const stat = await present(absolute);
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error(`Setup input symlink: ${path}`);
    if (stat.isDirectory()) for (const name of (await readdir(absolute)).sort()) await visit(`${path}/${name}`);
    else if (stat.isFile()) files.push([path, digest(await readFile(absolute))]);
  }
  for (const path of ['src', 'scripts', 'harness', 'tests', '.github', 'package.json', 'package-lock.json', 'manifest.json', 'versions.json',
    'docs/testing/test-plan.json', 'docs/design/obsidian-tokens.json', 'tsconfig.json', 'eslint.config.mjs', '.fallowrc.json', '.oxlintrc.json', 'vite.config.mjs', 'vite.harness.config.mjs', 'vitest.config.mjs', 'vitest.production.config.mjs', 'playwright.config.ts']) await visit(path);
  return digest(JSON.stringify({ files, toolchain, profile: options.profile, skipInstall: Boolean(options['skip-install']), deferVerify: Boolean(options['defer-verify']), browser: Boolean(options['provision-browser']) }));
}
export async function artifactHashes(root, installedId) {
  const hashes = {};
  const base = installedId ? `.dev-vault/.obsidian/plugins/${installedId}` : 'dist';
  if (!await present(join(root, base))) return null;
  await createFilePlan(join(root, base), ['main.js', 'styles.css', 'manifest.json'].map(path => ({ path, content: null })));
  for (const name of ['main.js', 'styles.css', 'manifest.json']) {
    const path = join(root, base, name); const stat = await present(path);
    if (!stat?.isFile() || stat.isSymbolicLink()) return null;
    const bytes = await readFile(path); if (!bytes.length) return null;
    hashes[name] = digest(bytes);
  }
  return hashes;
}
export async function stageIsCurrent(root, stage, identity) {
  if (stage.status !== 'verified') return false;
  if (stage.id === 'install') {
    const hidden = await present(join(root, 'node_modules/.package-lock.json'));
    if (!hidden?.isFile() || hidden.isSymbolicLink() || (await lstat(join(root, 'node_modules'))).isSymbolicLink()) return false;
    const bytes = await readFile(join(root, 'node_modules/.package-lock.json'));
    if (stage.outputHash !== digest(bytes)) return false;
    const lock = JSON.parse(bytes);
    if (!lock.packages || typeof lock.packages !== 'object') return false;
    for (const [path, expected] of Object.entries(lock.packages)) {
      if (!path.startsWith('node_modules/') || path.split('/').some(segment => segment === '..' || segment === '.') || path.includes('\\')) return false;
      const folder = await present(join(root, path));
      if (!folder?.isDirectory() || folder.isSymbolicLink()) return false;
      const manifest = await present(join(root, path, 'package.json')); if (!manifest?.isFile() || manifest.isSymbolicLink()) return false;
      if (JSON.parse(await readFile(join(root, path, 'package.json'), 'utf8')).version !== expected.version) return false;
    }
    return true;
  }
  if (stage.id === 'native-install') {
    const current = await artifactHashes(root, identity.id);
    const candidate = await artifactHashes(root);
    return current !== null && JSON.stringify(current) === JSON.stringify(stage.assets) && JSON.stringify(current) === JSON.stringify(candidate);
  }
  return false; // Always re-run verification; saved outputs cannot certify today's dependency execution or browser cache.
}
