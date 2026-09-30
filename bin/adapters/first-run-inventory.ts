import { defaultVaultConfigDirectory } from '../domain/host-paths.ts';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.ts';
import { hash, readBounded } from '../../scripts/framework/files.ts';
import { requireSketch } from '../domain/errors.ts';
import { projectPath } from '../domain/user-settings.ts';
const generated = new Set(['node_modules', 'dist', '.compiled', '.prototype-build']);
/** The approval includes all local application inputs, not merely package.json. Build/dependency outputs are excluded. */
export async function firstRunInventory(root: string, app: string): Promise<{ path: string; sha256: string }[]> {
  await createFilePlan(root, [{ path: app + '/package.json', content: null }]);
  const files: { path: string; sha256: string }[] = []; let bytes = 0, count = 0;
  async function walk(folder: string, depth: number): Promise<void> {
    requireSketch(depth < 30, 'FIRST_RUN_LIMIT', 'Application inventory exceeds 30 levels.');
    for (const item of (await readdir(join(root, folder), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      requireSketch(++count <= 5000, 'FIRST_RUN_LIMIT', 'Application inventory exceeds 5000 entries.');
      const path = projectPath(folder + '/' + item.name), stat = await lstat(join(root, path));
      requireSketch(!stat.isSymbolicLink(), 'FIRST_RUN_SYMLINK', 'First run refuses symlinks in application inputs or output roots.');
      if (depth === 0 && generated.has(item.name)) {
        requireSketch(stat.isDirectory(), 'FIRST_RUN_OUTPUT', 'Build/dependency output roots must be directories.'); continue;
      }
      requireSketch(item.name !== '.git' && item.name !== defaultVaultConfigDirectory, 'FIRST_RUN_NESTED_HOST', 'A generated application cannot contain nested Git or Obsidian data.');
      if (stat.isDirectory()) await walk(path, depth + 1);
      else {
        requireSketch(stat.isFile(), 'FIRST_RUN_INPUT', 'Only regular application files are accepted.');
        bytes += stat.size; requireSketch(bytes <= 32_000_000, 'FIRST_RUN_LIMIT', 'Application input inventory exceeds 32 MB.');
        files.push({ path, sha256: hash(await readBounded(join(root, path), 8_000_000)) });
      }
    }
  }
  await walk(app, 0); return files;
}
