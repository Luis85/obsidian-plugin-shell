import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assertNoOrphanedPrototypes as relocated } from '../../bin/adapters/framework/prototype-integrity.ts';
import * as legacy from '../../scripts/framework/prototype-integrity.ts';

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'prototype-integrity-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot: resolve(import.meta.dirname, '../..') };
}

test('relocated prototype integrity preserves compatibility identity and empty-workspace success', async t => {
  assert.equal(legacy.assertNoOrphanedPrototypes, relocated);
  const context = await fixture(t);
  await relocated(context);
});

test('relocated prototype integrity accepts ordinary concept folders without managed manifests', async t => {
  const context = await fixture(t);
  await mkdir(join(context.root, 'docs/concepts/reference'), { recursive: true });
  await writeFile(join(context.root, 'docs/concepts/readme.txt'), 'unmanaged concept note');
  await relocated(context);
});

test('relocated prototype integrity blocks orphaned managed manifests and pre-existing registry', async t => {
  const context = await fixture(t);
  await mkdir(join(context.root, 'docs/concepts/demo'), { recursive: true });
  await writeFile(join(context.root, 'docs/concepts/demo/prototype.json'), '{}');
  await assert.rejects(relocated(context), /PROTOTYPE_REGISTRY_MISSING/);
  await writeFile(join(context.root, 'docs/concepts/prototypes.json'), '{}');
  await assert.rejects(relocated(context), /PLAN_STALE/);
});

test('relocated prototype integrity respects pre-start cancellation', async t => {
  const context = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(relocated({ ...context, signal: controller.signal }), /CANCELLED/);
});
