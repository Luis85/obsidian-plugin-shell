import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, copyFile, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { archiveCommandFixture } from './archive-command-fixture.mjs';

const implementation = 'export interface PublicContract { readonly title: string }\nexport const retained = () => 1;\n';
async function analyzerProject(scratch, configure = config => config) {
  const config = JSON.parse(await readFile('configs/quality/fallow.json', 'utf8'));
  const source = join(scratch, 'src/plugin'); const scripts = join(scratch, 'tooling/quality');
  await mkdir(join(source, 'features'), { recursive: true }); await mkdir(join(source, 'application'), { recursive: true }); await mkdir(scripts, { recursive: true });
  await writeFile(join(scratch, 'package.json'), JSON.stringify({ name: 'framework-api-analysis', private: true, type: 'module' }));
  await mkdir(join(scratch, 'configs/quality'), { recursive: true });
  await writeFile(join(scratch, 'configs/quality/fallow.json'), JSON.stringify(configure({ ...config,
    entry: [...config.entry.filter(path => ['src/plugin/main.ts', 'src/plugin/features/api.ts'].includes(path)), 'tooling/quality/check-analyzer.mjs', 'tooling/quality/fallow-contract.mjs'], plugins: [],
  })));
  for (const script of ['check-analyzer.mjs', 'fallow-contract.mjs']) await copyFile(`tooling/quality/${script}`, join(scripts, script));
  await symlink(resolve('node_modules'), join(scratch, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(source, 'main.ts'), 'import { retained } from "./application/internal"; console.log(retained());\n');
  await writeFile(join(source, 'application/internal.ts'), implementation);
  await writeFile(join(source, 'features/api.ts'), 'export type { PublicContract } from "../application/internal";\n');
  return source;
}
const report = async scratch => JSON.parse(await readFile(join(scratch, 'reports/analyzer/fallow.json'), 'utf8'));

test('[FRAMEWORK-API-ANALYSIS] the declared public API survives without examples while unrelated source and private exports remain checked', async () => {
  await archiveCommandFixture(async ({ scratch, command }) => {
    const source = await analyzerProject(scratch);
    const check = () => command(process.execPath, ['tooling/quality/check-analyzer.mjs'], scratch,
      { ...process.env, FALLOW_TELEMETRY_DISABLED: '1' });
    const clean = check();
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /zero findings/);
    await writeFile(join(source, 'features/orphan.ts'), 'export const unrelatedFeature = 1;\n');
    await writeFile(join(source, 'application/internal.ts'), implementation
      + 'export const unusedImplementation = 2;\nexport interface PrivateUnused { readonly hidden: boolean }\n');
    const rejected = check();
    assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
    const found = await report(scratch);
    assert.ok(found.unused_files.some(item => item.path === 'src/plugin/features/orphan.ts'));
    assert.ok(found.unused_exports.some(item => item.path === 'src/plugin/application/internal.ts' && item.export_name === 'unusedImplementation'));
    assert.ok(found.unused_types.some(item => item.path === 'src/plugin/application/internal.ts' && item.export_name === 'PrivateUnused'));
    assert.ok(!found.unused_types.some(item => item.export_name === 'PublicContract'));
    assert.match(rejected.stderr, /ANALYZER_FAILED: 3/);
  }, { outputRoot: resolve('reports/analyzer-public-api') });
});

test('[ANALYZER-CONTRACT] consumed deprecated exports, degraded parsing and a missing parse gate fail the real analyzer', async () => {
  for (const [label, configure, change, expected] of [
    ['deprecated', config => config, async source => {
      await writeFile(join(source, 'application/internal.ts'), `${implementation}/** @deprecated use retained */\nexport const legacy = () => 0;\n`);
      await writeFile(join(source, 'main.ts'), 'import { legacy, retained } from "./application/internal"; console.log(retained(), legacy());\n');
    }, /ANALYZER_FAILED: 1/],
    ['parse', config => config, source => writeFile(join(source, 'application/internal.ts'), `${implementation}export function broken( {\n`), /ANALYZER_PARSE_ERROR/],
    ['ungated', ({ failOnParseError, ...config }) => { assert.equal(failOnParseError, true); return config; }, async () => {}, /ANALYZER_GATE_parse-error/],
  ]) {
    await archiveCommandFixture(async ({ scratch, command }) => {
      const source = await analyzerProject(scratch, configure);
      await change(source);
      const rejected = command(process.execPath, ['tooling/quality/check-analyzer.mjs'], scratch, { ...process.env, FALLOW_TELEMETRY_DISABLED: '1' });
      assert.equal(rejected.status, 1, `${label}: ${rejected.stdout}${rejected.stderr}`);
      assert.match(rejected.stderr, expected, label);
      if (label === 'deprecated') assert.deepEqual((await report(scratch)).deprecated_exports_in_use.map(item => [item.export_name, item.consumer_count]), [['legacy', 1]]);
    }, { outputRoot: resolve('reports/analyzer-contract') });
  }
});
