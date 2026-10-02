import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makerFixture, makerSourceRoot } from './maker-fixture.mjs';
import { parseArguments } from '../../scripts/makers/arguments.mjs';
import { planMaker } from '../../scripts/makers/plan.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';

async function seedRegistry(root) {
  await mkdir(join(root, 'plugins'), { recursive: true });
  await writeFile(join(root, 'plugins/api.ts'), 'export interface WorkbenchPluginObject {}\n');
  await writeFile(join(root, 'plugins/runtime.ts'), 'export function createPluginRuntime() {}\n');
  await writeFile(join(root, 'plugins/registry.ts'), `import type { WorkbenchPluginObject } from './api.ts';
import { PluginObject as ExistingPlugin } from './existing/src/index.ts';
export const pluginRegistry: readonly WorkbenchPluginObject[] = Object.freeze([ExistingPlugin]);
`);
}

test('[MAKER-PLUGIN] make plugin requires the Workbench SDK source checkout', () => makerFixture(async root => {
  await assert.rejects(planMaker(root, parseArguments(['plugin', 'metrics'])), /PLUGIN_SDK_REQUIRED/);
}));

test('[MAKER-PLUGIN] make plugin creates one self-contained registered extension and reruns safely', () => makerFixture(async root => {
  await seedRegistry(root);
  const shell = spawnSync(process.execPath, [
    resolve(makerSourceRoot, 'bin/app'), 'make', 'plugin', 'metrics',
    '--root', root, '--dry-run', '--json', '--no-interaction',
  ], { cwd: makerSourceRoot, encoding: 'utf8', timeout: 30000 });
  assert.equal(shell.status, 0, shell.stdout + shell.stderr);
  const shellPreview = JSON.parse(shell.stdout);
  assert.equal(shellPreview.status, 'planned');
  assert.ok(shellPreview.data.changes.some(change => change.path === 'plugins/metrics/manifest.json'));

  const cli = spawnSync(process.execPath, [
    resolve(makerSourceRoot, 'bin/app'), 'make', 'plugin', 'metrics', '--root', root, '--dry-run', '--json',
  ], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  const preview = JSON.parse(cli.stdout);
  assert.equal(preview.status, 'planned'); assert.equal(preview.command, 'make');
  assert.ok(preview.data.changes.some(change => change.path === 'plugins/metrics/manifest.json'));
  const request = parseArguments(['plugin', 'metrics']);
  const planned = await planMaker(root, request);
  const paths = planned.plan.changes.map(change => change.path);
  for (const path of [
    'plugins/metrics/manifest.json',
    'plugins/metrics/config.json',
    'plugins/metrics/src/index.ts',
    'plugins/metrics/tests/plugin.test.ts',
    'plugins/metrics/README.md',
    'plugins/registry.ts',
  ]) assert.ok(paths.includes(path), path);
  assert.ok(planned.checks.some(check => check.args.includes('scripts/quality/check-workbench-plugins.mjs')));
  assert.ok(planned.checks.some(check => check.args.includes('workbench-plugins')));
  await applyFilePlan(planned.plan);
  const registry = await readFile(join(root, 'plugins/registry.ts'), 'utf8');
  assert.match(registry, /PluginObject as MetricsPlugin/);
  assert.match(registry, /ExistingPlugin, MetricsPlugin/);
  const manifest = JSON.parse(await readFile(join(root, 'plugins/metrics/manifest.json'), 'utf8'));
  const config = JSON.parse(await readFile(join(root, 'plugins/metrics/config.json'), 'utf8'));
  assert.equal(manifest.id, 'metrics');
  assert.equal(config.enabled, false);
  const source = await readFile(join(root, 'plugins/metrics/src/index.ts'), 'utf8');
  assert.match(source, /definePluginEvent\('metrics\.ready'/);
  assert.match(source, /id: 'metrics-info'/);
  const repeated = await planMaker(root, request);
  assert.ok(repeated.plan.changes.every(change => change.status === 'unchanged'));
}));

test('[MAKER-PLUGIN] edited plugin source or inconsistent registration conflicts instead of overwriting', () => makerFixture(async root => {
  await seedRegistry(root);
  const request = parseArguments(['plugin', 'metrics']);
  await applyFilePlan((await planMaker(root, request)).plan);
  const sourcePath = join(root, 'plugins/metrics/src/index.ts');
  const edited = (await readFile(sourcePath, 'utf8')) + '// developer edit\n';
  await writeFile(sourcePath, edited);
  await assert.rejects(planMaker(root, request), /MAKER_CONFLICT/);
  assert.equal(await readFile(sourcePath, 'utf8'), edited);
}));
