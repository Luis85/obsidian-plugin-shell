import assert from 'node:assert/strict';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { generationPlan as relocatedPlan, generateSourcePlan as relocatedSourcePlan } from '../../bin/adapters/framework/generation.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../..');
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'generation-plan-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}


test('relocated source generation rejects invalid output kind before filesystem work', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedSourcePlan({ command: 'generate', args: [], options: { 'output-kind': 'desktop-app' } }, context), { code: 'INVALID_OUTPUT_KIND' });
});

test('source generation rejects removed output-location options', async t => {
  const context = await fixture(t);
  for (const options of [{ vault: 'elsewhere' }, { target: 'elsewhere' }]) {
    await assert.rejects(relocatedSourcePlan({ command: 'generate', args: [], options }, context), { code: 'INVALID_OPTION' });
  }
});

test('relocated managed generation preserves setup/import prerequisite on empty projects', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedPlan({ command: 'generate', args: [], options: {} }, context), { code: 'CONFIG_REQUIRED' });
});
