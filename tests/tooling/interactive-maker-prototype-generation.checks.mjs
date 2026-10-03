import assert from 'node:assert/strict';
import { mkdtemp, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { managedGenerationPlan as relocated } from '../../bin/adapters/framework/prototype-generation.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../..');
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'prototype-generation-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}

test('relocated managed generation preserves compatibility and explicit-input passthrough', async t => {
  const context = await fixture(t);
  const request = { command: 'generate', args: [], options: { input: 'project.json' } };
  let seen;
  const result = await relocated(request, context, async (next, ctx) => {
    seen = { next, ctx };
    return { marker: 'compiled' };
  });
  assert.equal(result.marker, 'compiled');
  assert.equal(seen.next, request);
  assert.equal(seen.ctx, context);
});

test('relocated managed generation falls back to ordinary generation without a registry', async t => {
  const context = await fixture(t);
  const request = { command: 'generate', args: [], options: {} };
  let calls = 0;
  const result = await relocated(request, context, async next => {
    calls++;
    assert.equal(next, request);
    return { marker: 'ordinary' };
  });
  assert.equal(calls, 1);
  assert.equal(result.marker, 'ordinary');
});

test('relocated managed generation respects cancellation while discovering workspace state', async t => {
  const context = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(relocated({ command: 'generate', args: [], options: {} }, { ...context, signal: controller.signal }, async () => ({ marker: 'unexpected' })), { code: 'CANCELLED' });
});
