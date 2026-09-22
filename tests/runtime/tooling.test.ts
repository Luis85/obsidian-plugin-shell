import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
// @ts-expect-error The dependency-free .mjs CLI helper has no emitted declarations.
import { installLocal } from '../../scripts/dev/install-local.mjs';
const root = process.cwd();
async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), 'shell-iteration-'));
  await mkdir(join(dir, 'dist'));
  await writeFile(join(dir, 'dist/manifest.json'), JSON.stringify({ id: 'plugin-shell', version: '0.1.0' }));
  await writeFile(join(dir, 'dist/main.js'), 'module.exports = class {};'); await writeFile(join(dir, 'dist/styles.css'), '.plugin-shell{}');
  return dir;
}
describe('Real tooling boundaries', () => {
  it('[TOOL-I01] staged installation preserves data, notes and security configuration', async () => {
    const dir = await workspace();
    try {
      const target = join(dir, '.dev-vault/.obsidian/plugins/plugin-shell'); await mkdir(target, { recursive: true });
      await writeFile(join(target, 'data.json'), 'existing data'); await writeFile(join(dir, '.dev-vault/Note.md'), 'user note');
      await writeFile(join(dir, '.dev-vault/.obsidian/community-plugins.json'), '["other"]');
      await installLocal({ root: dir });
      expect(await readFile(join(target, 'data.json'), 'utf8')).toBe('existing data');
      expect(await readFile(join(dir, '.dev-vault/Note.md'), 'utf8')).toBe('user note');
      expect(await readFile(join(dir, '.dev-vault/.obsidian/community-plugins.json'), 'utf8')).toBe('["other"]');
      expect(await readFile(join(target, 'main.js'), 'utf8')).toContain('module.exports');
      await installLocal({ root: dir }); expect(await readFile(join(target, 'data.json'), 'utf8')).toBe('existing data');
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('[TOOL-I02] dry run, unsafe target and overlapping install never overwrite data', async () => {
    const dir = await workspace();
    try {
      const result = await installLocal({ root: dir, dryRun: true }); expect(result.written).toBe(false);
      await expect(readFile(join(dir, '.dev-vault/.obsidian/plugins/plugin-shell/main.js'))).rejects.toThrow();
      await expect(installLocal({ root: dir, vault: '../escape' })).rejects.toThrow('UNSAFE_TARGET');
      const target = join(dir, '.dev-vault/.obsidian/plugins/plugin-shell'); await mkdir(join(target, '.shell-install-lock'), { recursive: true });
      await expect(installLocal({ root: dir })).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('[TOOL-I03] setup help and dry run execute without node_modules', async () => {
    const dir = await workspace();
    try {
      await cp(join(root, 'scripts/setup.mjs'), join(dir, 'setup.mjs'));
      await cp(join(root, 'scripts/shared'), join(dir, 'shared'), { recursive: true });
      await writeFile(join(dir, 'manifest.json'), JSON.stringify({ name: 'Plugin Shell', id: 'plugin-shell' }));
      await writeFile(join(dir, 'package-lock.json'), '{}');
      for (const args of [['--help'], ['--dry-run']]) {
        const result = spawnSync(process.execPath, [join(dir, 'setup.mjs'), ...args], { cwd: dir, encoding: 'utf8', timeout: 5000 });
        expect(result.status, result.stderr).toBe(0);
      }
      const bad = spawnSync(process.execPath, [join(dir, 'setup.mjs'), '--unknown'], { cwd: dir, encoding: 'utf8', timeout: 5000 }); expect(bad.status).not.toBe(0);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('[TOOL-I04] the real fallow analyzer rejects forbidden edges and unclassified files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'shell-boundary-'));
    try {
      await mkdir(join(dir, 'src/application'), { recursive: true }); await mkdir(join(dir, 'src/infrastructure'), { recursive: true });
      await cp(join(root, '.fallowrc.json'), join(dir, '.fallowrc.json'));
      await writeFile(join(dir, 'package.json'), '{"name":"boundary-fixture","type":"module"}');
      await writeFile(join(dir, 'src/main.ts'), "import './application/bad'; import './unclassified';");
      await writeFile(join(dir, 'src/application/bad.ts'), "import { leak } from '../infrastructure/leak'; export const value = leak;");
      await writeFile(join(dir, 'src/infrastructure/leak.ts'), 'export const leak = 1;');
      await writeFile(join(dir, 'src/unclassified.ts'), 'export const unknown = 1;');
      const result = spawnSync(process.execPath, [resolve('node_modules/fallow/bin/fallow'), '--format', 'json', 'dead-code', '--boundary-violations'], { cwd: dir, encoding: 'utf8', timeout: 15000 });
      const report = JSON.parse(result.stdout); expect(result.status).not.toBe(0);
      expect(report.summary.boundary_violations).toBeGreaterThan(0); expect(report.summary.boundary_coverage_violations).toBeGreaterThan(0);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 20000);
});
