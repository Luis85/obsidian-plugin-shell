import { mkdtemp, mkdir, lstat, readFile, copyFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { build as viteBuild } from 'vite';
const names = ['main.js', 'styles.css', 'manifest.json'];
async function exists(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
/** Build and validate the whole candidate before replacing the last good directory. */
export async function stagedBuild({ root = process.cwd(), build = viteBuild } = {}) {
  root = resolve(root);
  const target = join(root, 'dist'); const lock = join(root, '.shell-build-lock');
  const previous = await exists(target);
  if (previous && (!previous.isDirectory() || previous.isSymbolicLink())) throw new Error('UNSAFE_BUILD_TARGET');
  await mkdir(lock); // Refuse overlapping processes; never remove another process's lock.
  let stage; let backup; let moved = false;
  try {
    stage = await mkdtemp(join(root, '.shell-build-'));
    const output = join(stage, 'candidate');
    await build({ root, configFile: join(root, 'vite.config.mjs'), build: { outDir: output, emptyOutDir: true } });
    await copyFile(join(root, 'manifest.json'), join(output, 'manifest.json'));
    for (const name of names) {
      const stat = await lstat(join(output, name));
      if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) throw new Error(`INCOMPLETE_BUILD: ${name}`);
    }
    const manifest = JSON.parse(await readFile(join(output, 'manifest.json'), 'utf8'));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('INVALID_BUILD_IDENTITY');
    if (previous) { backup = join(stage, 'previous'); await rename(target, backup); }
    try { await rename(output, target); moved = true; }
    catch (error) { if (backup) { await rename(backup, target); backup = undefined; } throw error; }
    return { directory: target, version: manifest.version };
  } finally {
    // A failed rollback leaves its backup for manual recovery; never delete the last good bytes.
    if (stage && (moved || !backup)) await rm(stage, { recursive: true, force: true });
    await rm(lock, { recursive: true });
  }
}
