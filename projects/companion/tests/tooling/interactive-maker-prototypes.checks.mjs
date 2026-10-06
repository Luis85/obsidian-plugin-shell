import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prototypesRead as relocatedRead, prototypesCompare as relocatedCompare, prototypesPlan as relocatedPlan } from '../../bin/adapters/framework/prototypes.ts';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { starterDocumentText } from '../support/starter-documents.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = starterDocumentText('companion-plugin');
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'prototype-commands-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}

test('relocated prototype commands preserve compatibility and empty listing', async t => {
  const result = await relocatedRead(await fixture(t));
  assert.deepEqual(result.prototypes, []);
  assert.equal(result.active, null);
});

test('relocated prototype create plans and loads a managed workspace', async t => {
  const context = await fixture(t);
  await writeFile(join(context.root, 'project.json'), projectText);
  const request = { command: 'prototypes create', args: ['alpha'], options: { input: 'project.json', name: 'Alpha' } };
  const planned = await relocatedPlan(request, context);
  assert.ok(planned.plan.changes.some(change => change.path === 'docs/concepts/prototypes.json'));
  await applyFilePlan(planned.plan);
  const loaded = await relocatedRead(context);
  assert.equal(loaded.prototypes.length, 1);
  assert.equal(loaded.prototypes[0].id, 'alpha');
});

test('relocated prototype compare and export require an existing workspace', async t => {
  const context = await fixture(t);
  await assert.rejects(relocatedCompare({ command: 'prototypes compare', args: ['alpha'], options: { version: 'v1', variant: 'main', 'with-variant': 'other' } }, context), { code: 'PROTOTYPE_REQUIRED' });
  await assert.rejects(relocatedPlan({ command: 'prototypes export', args: [], options: { out: 'prototype.json' } }, context), { code: 'PROTOTYPE_REQUIRED' });
});
