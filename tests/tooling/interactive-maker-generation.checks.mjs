import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generationPlan as relocatedPlan, generateSourcePlan as relocatedSourcePlan } from '../../bin/adapters/framework/generation.ts';
import * as legacy from '../../scripts/framework/generation.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'generation-plan-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}

test('relocated generation planner preserves compatibility identity', () => {
  assert.equal(legacy.generationPlan, relocatedPlan);
  assert.equal(legacy.generateSourcePlan, relocatedSourcePlan);
});

test('relocated source generation rejects invalid output kind before filesystem work', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedSourcePlan({ command: 'generate', args: [], options: { 'output-kind': 'desktop-app' } }, context), /INVALID_OUTPUT_KIND/);
});

test('relocated source generation keeps legacy vault authority behind explicit target', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedSourcePlan({ command: 'generate', args: [], options: { vault: 'elsewhere' } }, context), /TARGET_REQUIRED/);
});

test('relocated managed generation preserves setup/import prerequisite on empty projects', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedPlan({ command: 'generate', args: [], options: {} }, context), /CONFIG_REQUIRED/);
});
