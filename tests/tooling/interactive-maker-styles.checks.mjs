import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectStyles as relocatedInspect, styleExportPlan as relocatedPlan } from '../../bin/adapters/framework/styles.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'style-plan-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot, inputText: projectText };
}
const request = (command, options = {}) => ({ command, args: [], options: { input: '-', ...options } });

test('relocated style adapter preserves compatibility and inspect output', async t => {
  const result = await relocatedInspect(request('styles inspect'), await fixture(t));
  assert.deepEqual(result.formats, ['css', 'json', 'markdown', 'html']);
  assert.match(result.inputHash, /^[a-f0-9]{64}$/);
  assert.ok(result.cssBytes > 0);
  assert.ok(result.manifest);
});

test('relocated style adapter plans reviewed exports without writing', async t => {
  const context = await fixture(t);
  const planned = await relocatedPlan(request('styles export', { format: 'json', out: 'exports/design-system.json' }), context);
  assert.equal(planned.plan.changes.length, 1);
  assert.equal(planned.plan.changes[0].path, 'exports/design-system.json');
  assert.equal(planned.plan.changes[0].status, 'create');
  assert.equal(planned.summary.format, 'json');
  assert.equal(planned.summary.network, 'none');
});

test('relocated style adapter refuses protected and mismatched output targets', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedPlan(request('styles export', { format: 'json', out: '.framework/design-system.json' }), context), { code: 'STYLE_OUTPUT_PATH' });
  await assert.rejects(relocatedPlan(request('styles export', { format: 'json', out: 'exports/design-system.css' }), context), { code: 'STYLE_OUTPUT_FORMAT' });
});
