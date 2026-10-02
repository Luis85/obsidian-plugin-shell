import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

test('compiler public exports are recognized without exempting private compiler implementations', async () => {
  const config = JSON.parse(await readFile('configs/quality/fallow.json', 'utf8'));
  assert.ok(config.entry.includes('scripts/compiler/index.ts'));
  assert.ok(config.entry.includes('scripts/compiler/build-clickdummy.mjs'));
  await archiveCommandFixture(async ({ scratch, command }) => {
    await mkdir(join(scratch, 'scripts/compiler'), { recursive: true });
    await mkdir(join(scratch, 'bin/compiler/application'), { recursive: true });
    await mkdir(join(scratch, 'scripts/quality'), { recursive: true });
    await writeFile(join(scratch, 'package.json'), '{"name":"compiler-analysis","private":true,"type":"module"}');
    await mkdir(join(scratch, 'configs/quality'), { recursive: true });
    await writeFile(join(scratch, 'configs/quality/fallow.json'), JSON.stringify({ ...config, plugins: [],
      entry: ['scripts/compiler/index.ts', 'scripts/quality/check-analyzer.mjs', 'scripts/quality/fallow-contract.mjs'] }));
    for (const script of ['check-analyzer.mjs', 'fallow-contract.mjs'])
      await copyFile(`scripts/quality/${script}`, join(scratch, 'scripts/quality', script));
    await symlink(resolve('node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    await writeFile(join(scratch, 'scripts/compiler/index.ts'),
      'export { compile } from "../../bin/compiler/application/internal";\nexport type { CompilerDiagnostic } from "../../bin/compiler/application/internal";\n');
    const internal = 'export const compile = () => 1;\nexport interface CompilerDiagnostic { readonly message: string }\n';
    await writeFile(join(scratch, 'bin/compiler/application/internal.ts'), internal);
    const check = () => command(process.execPath, ['scripts/quality/check-analyzer.mjs'], scratch,
      { ...process.env, FALLOW_TELEMETRY_DISABLED: '1' });
    const clean = check();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    await writeFile(join(scratch, 'bin/compiler/application/internal.ts'), internal + 'export const unusedPrivate = 2;\n');
    await writeFile(join(scratch, 'bin/compiler/application/orphan.ts'), 'export const orphan = 1;\n');
    const bad = check();
    assert.equal(bad.status, 1, bad.stdout + bad.stderr);
    const report = JSON.parse(await readFile(join(scratch, 'reports/analyzer/fallow.json'), 'utf8'));
    assert.ok(report.unused_exports.some(item => item.export_name === 'unusedPrivate'));
    assert.ok(report.unused_files.some(item => item.path.endsWith('/orphan.ts')));
  }, { outputRoot: resolve('reports/compiler-analysis') });
});
