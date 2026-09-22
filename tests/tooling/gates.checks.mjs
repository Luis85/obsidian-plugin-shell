import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
test('[GATE-02-01] full analyzer fails for real unused files and exports', async () => {
  const root = await mkdtemp(join(tmpdir(), 'shell-analysis-'));
  try {
    await writeFile(join(root, '.fallowrc.json'), JSON.stringify({ entry: ['entry.ts'], rules: { 'policy-violation': 'off' } }));
    await writeFile(join(root, 'package.json'), '{"name":"analyzer-probe","type":"module"}');
    await writeFile(join(root, 'entry.ts'), 'import { used } from "./module"; console.log(used);');
    await writeFile(join(root, 'module.ts'), 'export const used = 1; export const unused = 2;');
    await writeFile(join(root, 'dead.ts'), 'export const unreachable = 1;');
    const run = spawnSync(process.execPath, [resolve('node_modules/fallow/bin/fallow'), '--format', 'json', 'dead-code'], { cwd: root, encoding: 'utf8', timeout: 15000 });
    const report = JSON.parse(run.stdout); assert.equal(run.status, 1);
    assert.ok(report.summary.unused_files > 0); assert.ok(report.summary.unused_exports > 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('[GATE-02-02] ESLint 10 executes the real TypeScript, Obsidian and Vue rules/parsers', async () => {
  const root = await mkdtemp(resolve('src/infrastructure/ui/lint-probe-'));
  try {
    const ts = join(root, 'probe.ts'); const vue = join(root, 'LintProbe.vue');
    await writeFile(ts, "export function probe() { Promise.resolve(1); return '.obsidian/config'; }\n");
    await writeFile(vue, '<script setup lang="ts">const items: number[] = [1, 2];</script><template><div v-for="item in items">{{ item }}</div></template>');
    const run = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', ts, vue, '--format', 'json'], { encoding: 'utf8', timeout: 30000 });
    assert.equal(run.status, 1, run.stderr);
    const reports = JSON.parse(run.stdout); const rules = reports.flatMap(file => file.messages.map(message => message.ruleId));
    assert.ok(rules.includes('@typescript-eslint/no-floating-promises'), run.stdout);
    assert.ok(rules.includes('obsidianmd/hardcoded-config-path'), run.stdout);
    assert.ok(rules.includes('vue/require-v-for-key'), run.stdout);
    assert.ok(!reports.some(file => file.fatalErrorCount), 'Parsers must run, not fail before checking rules');
  } finally { await rm(root, { recursive: true, force: true }); }
});
