import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectConcept as relocatedInspect, conceptImportPlan as relocatedImport } from '../../bin/adapters/framework/concepts.ts';
import * as legacy from '../../scripts/framework/concepts.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'concept-adapter-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs/concepts'), { recursive: true });
  return { root, frameworkRoot };
}
const request = (command, input) => ({ command, args: [], options: input ? { input } : {} });

test('relocated concept adapter preserves compatibility identity and requires a base without input', async t => {
  assert.equal(legacy.inspectConcept, relocatedInspect);
  assert.equal(legacy.conceptImportPlan, relocatedImport);
  await assert.rejects(relocatedInspect(request('concept inspect'), await fixture(t)), /CONCEPT_BASE_REQUIRED/);
});

test('relocated concept inspection keeps ordinary HTML reference-only', async t => {
  const context = await fixture(t);
  await writeFile(join(context.root, 'docs/concepts/reference.html'), '<!doctype html><h1>Reference</h1>');
  const result = await relocatedInspect(request('concept inspect', 'docs/concepts/reference.html'), context);
  assert.equal(result.disposition, 'reference-only');
  assert.equal(result.execution, 'not-run');
});

test('relocated concept inspection accepts canonical project data without writing', async t => {
  const context = await fixture(t);
  await writeFile(join(context.root, 'docs/concepts/project.json'), projectText);
  const result = await relocatedInspect(request('concept inspect', 'docs/concepts/project.json'), context);
  assert.equal(result.disposition, 'data-compatible');
  assert.match(result.sourceSha256, /^[a-f0-9]{64}$/);
  assert.match(result.candidateSha256, /^[a-f0-9]{64}$/);
});

test('relocated concept import refuses reference-only HTML before planning writes', async t => {
  const context = await fixture(t);
  await writeFile(join(context.root, 'docs/concepts/reference.html'), '<html><body>Reference</body></html>');
  await assert.rejects(relocatedImport(request('concept import', 'docs/concepts/reference.html'), context), /CONCEPT_REFERENCE_ONLY/);
});
