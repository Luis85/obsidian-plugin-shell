import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

test('[FRAMEWORK-API-ANALYSIS] the declared public API survives without examples while unrelated source and private exports remain checked', async () => {
  const config = JSON.parse(await readFile('.fallowrc.json', 'utf8'));
  await archiveCommandFixture(async ({ scratch, command }) => {
    const source = join(scratch, 'src'); const scripts = join(scratch, 'scripts/quality');
    await mkdir(join(source, 'features'), { recursive: true }); await mkdir(join(source, 'application')); await mkdir(scripts, { recursive: true });
    await writeFile(join(scratch, 'package.json'), JSON.stringify({ name: 'framework-api-analysis', private: true, type: 'module' }));
    await writeFile(join(scratch, '.fallowrc.json'), JSON.stringify({ ...config,
      entry: [...config.entry.filter(path => ['src/main.ts', 'src/features/api.ts'].includes(path)), 'scripts/quality/check-analyzer.mjs'], plugins: [],
    }));
    await copyFile('scripts/quality/check-analyzer.mjs', join(scripts, 'check-analyzer.mjs'));
    await symlink(resolve('node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(join(source, 'main.ts'), 'import { retained } from "./application/internal"; console.log(retained());\n');
    const implementation = 'export interface PublicContract { readonly title: string }\nexport const retained = () => 1;\n';
    await writeFile(join(source, 'application/internal.ts'), implementation);
    await writeFile(join(source, 'features/api.ts'), 'export type { PublicContract } from "../application/internal";\n');
    const check = () => command(process.execPath, ['scripts/quality/check-analyzer.mjs'], scratch,
      { ...process.env, FALLOW_TELEMETRY_DISABLED: '1' });
    const clean = check();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /zero findings/);
    await writeFile(join(source, 'features/orphan.ts'), 'export const unrelatedFeature = 1;\n');
    await writeFile(join(source, 'application/internal.ts'), implementation
      + 'export const unusedImplementation = 2;\nexport interface PrivateUnused { readonly hidden: boolean }\n');
    const rejected = check();
    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
    const report = JSON.parse(await readFile(join(scratch, 'reports/analyzer/fallow.json'), 'utf8'));
    assert.ok(report.unused_files.some(item => item.path === 'src/features/orphan.ts'));
    assert.ok(report.unused_exports.some(item => item.path === 'src/application/internal.ts' && item.export_name === 'unusedImplementation'));
    assert.ok(report.unused_types.some(item => item.path === 'src/application/internal.ts' && item.export_name === 'PrivateUnused'));
    assert.ok(!report.unused_types.some(item => item.export_name === 'PublicContract'));
    assert.match(rejected.stderr, /ANALYZER_FAILED: 3/);
  }, { outputRoot: resolve('reports/analyzer-public-api') });
});
