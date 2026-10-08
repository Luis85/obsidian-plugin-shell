import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

test('compiler public exports are recognized without exempting private compiler implementations', async () => {
  const config = JSON.parse(await readFile('configs/quality/fallow.json', 'utf8'));
  assert.ok(config.entry.includes('src/cli/compiler/index.ts'));
  assert.ok(!config.entry.includes('scripts/compiler/index.ts') && !config.entry.includes('tooling/compiler/index.ts'));
  assert.ok(config.entry.includes('tooling/compiler/build-clickdummy.mjs'));
  await archiveCommandFixture(async ({ scratch, command }) => {
    await mkdir(join(scratch, 'src/cli/compiler/application'), { recursive: true });
    await mkdir(join(scratch, 'tooling/quality'), { recursive: true });
    await writeFile(join(scratch, 'package.json'), '{"name":"compiler-analysis","private":true,"type":"module"}');
    await mkdir(join(scratch, 'configs/quality'), { recursive: true });
    await writeFile(join(scratch, 'configs/quality/fallow.json'), JSON.stringify({ ...config, plugins: [],
      entry: ['src/cli/compiler/index.ts', 'tooling/quality/check-analyzer.mjs', 'tooling/quality/fallow-contract.mjs'] }));
    for (const script of ['check-analyzer.mjs', 'fallow-contract.mjs'])
      await copyFile(`tooling/quality/${script}`, join(scratch, 'tooling/quality', script));
    await symlink(resolve('node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(join(scratch, 'src/cli/compiler/index.ts'),
      'export { compile } from "./application/internal";\nexport type { CompilerDiagnostic } from "./application/internal";\n');
    const internal = 'export const compile = () => 1;\nexport interface CompilerDiagnostic { readonly message: string }\n';
    await writeFile(join(scratch, 'src/cli/compiler/application/internal.ts'), internal);
    const check = () => command(process.execPath, ['tooling/quality/check-analyzer.mjs'], scratch,
      { ...process.env, FALLOW_TELEMETRY_DISABLED: '1' });
    const clean = check();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    await writeFile(join(scratch, 'src/cli/compiler/application/internal.ts'), internal + 'export const unusedPrivate = 2;\n');
    await writeFile(join(scratch, 'src/cli/compiler/application/orphan.ts'), 'export const orphan = 1;\n');
    const bad = check();
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    const report = JSON.parse(await readFile(join(scratch, 'reports/analyzer/fallow.json'), 'utf8'));
    assert.ok(report.unused_exports.some(item => item.export_name === 'unusedPrivate'));
    assert.ok(report.unused_files.some(item => item.path.endsWith('/orphan.ts')));
  }, { outputRoot: resolve('reports/compiler-analysis') });
});
