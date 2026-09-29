import { defaultVaultConfigDirectory } from '../domain/host-paths.ts';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.mjs';
import { hash, readBounded } from '../../scripts/framework/files.ts';
import { projectPath } from '../domain/user-settings.ts';
import { requireSketch } from '../domain/errors.ts';
export interface MigrationFile { path: string; bytes: Buffer; sha256: string }
const rebuildable = new Set(['node_modules', 'dist', '.compiled', '.prototype-build']);
async function inspect(root: string, path: string) {
  try { return await lstat(join(root, path)); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null; throw error; }
}
/** Binary-safe snapshots. Dependencies/build products stay behind and must be rebuilt at the new location. */
export async function migrationFiles(root: string, path: string, folder: boolean) {
  await createFilePlan(root, [{ path: folder ? path + '/.migration-probe' : path, content: null }]);
  const files: MigrationFile[] = [], retained: string[] = [];
  let count = 0, total = 0;
  async function visit(name: string, depth: number): Promise<void> {
    requireSketch(depth <= 30 && ++count <= 5000, 'MIGRATION_LIMIT', 'Migration exceeds its directory or entry limit.');
    const stat = await inspect(root, name);
    if (!stat) return;
    requireSketch(!stat.isSymbolicLink(), 'MIGRATION_SYMLINK', 'Migration refuses symbolic links: ' + name);
    if (stat.isDirectory()) {
      for (const item of (await readdir(join(root, name))).sort()) await child(name, item, depth);
      return;
    }
    requireSketch(stat.isFile(), 'MIGRATION_FILE', 'Migration accepts regular files only.');
    total += stat.size; requireSketch(total <= 64_000_000, 'MIGRATION_LIMIT', 'Migration exceeds 64 MB of source data.');
    const bytes = await readBounded(join(root, name), 8_000_000);
    files.push({ path: name, bytes, sha256: hash(bytes) });
  }
  async function child(parent: string, item: string, depth: number): Promise<void> {
    const name = projectPath(parent + '/' + item);
    requireSketch(!['.git', defaultVaultConfigDirectory, '.codex-authoring.lock', '.shell-first-run.lock'].includes(item.toLowerCase()), 'MIGRATION_HOST', 'Nested host/worktree data must not be moved.');
    if (rebuildable.has(item)) { retained.push(name); return; }
    await visit(name, depth + 1);
  }
  const initial = await inspect(root, path);
  requireSketch(!initial || (folder ? initial.isDirectory() : initial.isFile()), 'MIGRATION_KIND', 'Configured path has an unexpected kind: ' + path);
  await visit(path, 0);
  return { files, retained };
}
