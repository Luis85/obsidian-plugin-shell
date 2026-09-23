import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { sha256 } from '../../scripts/testing/source-inputs.mjs';
import { vendorArchive } from '../../scripts/styles/vendor-policy.mjs';

const cli = resolve('scripts/quality/check-maintainability.mjs');
const composition = 'export function present(values: readonly number[]) {\n  return values.map(value => value * 2);\n}\n';
async function fixture(action) {
  const root = await mkdtemp(join(tmpdir(), 'maintainability-fixture-'));
  try {
    for (const directory of ['src', 'scripts', 'tests', 'harness']) await mkdir(join(root, directory));
    for (const file of ['package.json', 'package-lock.json', '.fallowrc.json']) await writeFile(join(root, file), await readFile(resolve(file)));
    await symlink(resolve('node_modules'), join(root, 'node_modules'), 'junction');
    await writeFile(join(root, 'src/main.ts'), composition);
    await action(root);
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + '\\') || resolve(root).startsWith(resolve(tmpdir()) + '/'));
    await rm(root, { recursive: true, force: true });
  }
}
function run(root, args = []) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  assert.ifError(result.error);
  return result;
}
function packet(result) { return JSON.parse(result.stdout); }

test('maintainability CLI measures valid composition and rejects actual excess complexity including Vue scripts', async () => {
  await fixture(async root => {
    const good = run(root); assert.equal(good.status, 0, good.stderr);
    assert.equal(run(root, ['--check', packet(good).output]).status, 0);
    const decisions = Array.from({ length: 11 }, (_, index) => `  if (value === ${index}) return ${index};`).join('\n');
    await writeFile(join(root, 'src/main.ts'), `export function excessive(value: number) {\n${decisions}\n  return -1;\n}\n`);
    const bad = run(root); assert.equal(bad.status, 1, bad.stderr);
    assert.ok(packet(bad).failures.some(failure => failure.includes('excessive')));
    const excessive = await readFile(join(root, 'src/main.ts'), 'utf8');
    await writeFile(join(root, 'src/main.ts'), `// fallow-ignore-next-line complexity -- deliberate suppression probe\n${excessive}`);
    assert.match(run(root).stderr, /METRIC_REPORT_SUPPRESSION/);
    await writeFile(join(root, 'src/main.ts'), composition);
    await writeFile(join(root, 'src/Probe.vue'), `<script setup lang="ts">\nfunction excessive(value: number) {\n${decisions}\n return -1;\n}\n</script>\n<template><div>{{ excessive(1) }}</div></template>\n`);
    const vue = run(root); assert.equal(vue.status, 1, vue.stderr);
    assert.ok(packet(vue).failures.some(failure => failure.includes('Probe.vue')));
  });
});

test('maintainability CLI rejects meaningful production clones with a measured production denominator', async () => {
  await fixture(async root => {
    const block = `export function evaluate(values: number[]) {\n  const total = values.reduce((sum, value) => sum + value, 0);\n  const minimum = Math.min(...values);\n  const maximum = Math.max(...values);\n  const count = values.length;\n  const average = total / count;\n  return { total, minimum, maximum, count, average };\n}\n`;
    await writeFile(join(root, 'src/main.ts'), block);
    const good = run(root); assert.equal(good.status, 0, good.stderr);
    await writeFile(join(root, 'src/copy.ts'), block);
    const bad = run(root); assert.equal(bad.status, 1, bad.stderr);
    assert.ok(packet(bad).failures.includes('PRODUCTION_DUPLICATION_ABOVE_3_PERCENT'));
    const report = JSON.parse(await readFile(join(packet(bad).output, 'report.json'), 'utf8'));
    assert.equal(report.views.production.duplication.total_files, 2);
    assert.ok(report.views.production.duplication.duplication_percentage > 3);
    const rawPath = join(packet(bad).output, 'production-dupes.json');
    const raw = JSON.parse(await readFile(rawPath, 'utf8'));
    raw.stats.duplicated_lines = 0; raw.stats.duplication_percentage = 0;
    const changed = JSON.stringify(raw); await writeFile(rawPath, changed);
    report.views.production.execution.dupes.sha256 = sha256(changed);
    await writeFile(join(packet(bad).output, 'report.json'), JSON.stringify(report));
    assert.match(run(root, ['--check', packet(bad).output]).stderr, /METRIC_REPORT_DUPLICATION_GATE/);
    raw.gate_outcomes['duplication-threshold'] = { status: 'pass', enforced: true, observed: 0, threshold: 3 };
    const contradictory = JSON.stringify(raw); await writeFile(rawPath, contradictory);
    report.views.production.execution.dupes.sha256 = sha256(contradictory);
    await writeFile(join(packet(bad).output, 'report.json'), JSON.stringify(report));
    assert.match(run(root, ['--check', packet(bad).output]).stderr, /METRIC_REPORT_CLONE_TOTALS/);
    raw.stats.duplicated_lines = 1; raw.stats.duplication_percentage = 100 / raw.stats.total_lines;
    raw.gate_outcomes['duplication-threshold'].observed = raw.stats.duplication_percentage;
    raw.gate_outcomes['duplication-threshold'].status = raw.stats.duplication_percentage > 3 ? 'fail' : 'pass';
    const understated = JSON.stringify(raw); await writeFile(rawPath, understated);
    report.views.production.execution.dupes.sha256 = sha256(understated);
    await writeFile(join(packet(bad).output, 'report.json'), JSON.stringify(report));
    assert.match(run(root, ['--check', packet(bad).output]).stderr, /METRIC_REPORT_CLONE_TOTALS/);
  });
});

test('maintainability CLI rejects TypeScript and Vue script methods impersonating template aggregates', async () => {
  await fixture(async root => {
    const good = run(root); assert.equal(good.status, 0, good.stderr);
    const decisions = Array.from({ length: 11 }, (_, index) => `if (value === ${index}) return ${index};`).join('\n');
    for (const name of ["'<template>'", "['<template>']"]) {
      await writeFile(join(root, 'src/spoof.ts'), `export class Probe { ${name}(value: number) {\n${decisions}\nreturn -1; } }\n`);
      const bad = run(root); assert.equal(bad.status, 1); assert.match(bad.stderr, /METRIC_REPORT_HEALTH_TEMPLATE_CATEGORY/);
    }
    await rm(join(root, 'src/spoof.ts'));
    await writeFile(join(root, 'src/Probe.vue'), `<script lang="ts">\nexport default class Probe { ['<template>'](value: number) {\n${decisions}\nreturn -1; } }\n</script>\n<template><div>Static markup</div></template>\n`);
    const vue = run(root); assert.equal(vue.status, 1); assert.match(vue.stderr, /METRIC_REPORT_HEALTH_TEMPLATE_CATEGORY/);
    await writeFile(join(root, 'src/Probe.vue'), '<template><div>Static markup</div></template>\n');
    const restored = run(root); assert.equal(restored.status, 0, restored.stderr);
  });
});

test('maintainability CLI rejects omitted inventory, changed source, malformed reports and degraded parsing', async () => {
  await fixture(async root => {
    const good = run(root); assert.equal(good.status, 0, good.stderr);
    const output = packet(good).output;
    const path = join(output, 'report.json'); const original = await readFile(path, 'utf8');
    const report = JSON.parse(original); report.views.production.inputs = [];
    await writeFile(path, JSON.stringify(report));
    assert.match(run(root, ['--check', output]).stderr, /METRIC_OMITTED_INPUT/);
    await writeFile(path, original);
    const rawPath = join(output, 'production-health.json');
    const raw = JSON.parse(await readFile(rawPath, 'utf8')); raw.schema_version = 999;
    const changed = JSON.stringify(raw); await writeFile(rawPath, changed);
    const amended = JSON.parse(original); amended.views.production.execution.health.sha256 = sha256(changed);
    await writeFile(path, JSON.stringify(amended));
    assert.match(run(root, ['--check', output]).stderr, /METRIC_REPORT_SCHEMA/);
    await writeFile(path, original);
    await writeFile(join(root, 'src/new.ts'), 'export const newInput = 1;\n');
    assert.match(run(root, ['--check', output]).stderr, /METRIC_STALE_INVENTORY/);
    await writeFile(join(root, 'src/new.ts'), 'export function broken( {');
    const invalid = run(root); assert.equal(invalid.status, 1, invalid.stdout);
    assert.match(invalid.stderr, /METRIC_REPORT_INCOMPLETE/);
    await writeFile(join(root, 'src/new.ts'), composition);
    await writeFile(join(root, 'src/unclassified.svelte'), '<script>export let value = 1;</script>');
    assert.match(run(root).stderr, /METRIC_UNCLASSIFIED_INPUT/);
  });
});

test('maintainability inventories exact immutable vendor data and refuses changed vendor bytes', async () => {
  await fixture(async root => {
    await mkdir(join(root, 'harness/styles/vendor'), { recursive: true });
    await writeFile(join(root, vendorArchive), await readFile(resolve(vendorArchive)));
    const valid = run(root); assert.equal(valid.status, 0, valid.stderr);
    const report = JSON.parse(await readFile(join(packet(valid).output, 'report.json'), 'utf8'));
    assert.equal(report.inventory.files.find(file => file.path === vendorArchive).view, 'unsupported');
    await writeFile(join(root, vendorArchive), 'not the approved immutable archive');
    assert.equal(run(root).status, 1);
  });
});
