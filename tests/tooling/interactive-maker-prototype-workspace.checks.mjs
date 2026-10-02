import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  loadPrototypeWorkspace as relocatedLoad,
  readPrototypeDocument as relocatedReadDocument,
  readPrototypeBundle as relocatedReadBundle,
} from '../../bin/adapters/framework/prototype-workspace.ts';
import * as legacy from '../../bin/adapters/framework/prototype-workspace.ts';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
/** Registers cleanup under either runner: node:test exposes t.after, vitest onTestFinished. */
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');

async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'prototype-workspace-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  return { root, frameworkRoot };
}

test('relocated prototype workspace preserves compatibility and empty-workspace reads', async t => {
  assert.equal(legacy.loadPrototypeWorkspace, relocatedLoad);
  assert.equal(legacy.readPrototypeDocument, relocatedReadDocument);
  const context = await fixture(t);
  const loaded = await relocatedLoad(context);
  assert.equal(loaded.workspace, null);
  assert.equal(loaded.files.size, 0);
});

test('relocated prototype workspace reads bounded authoring documents', async t => {
  const context = await fixture(t);
  await writeFile(join(context.root, 'project.json'), projectText);
  const document = await relocatedReadDocument(context, 'project.json');
  assert.equal(document.kind, 'obsidian-companion-project');
  assert.ok(document.project?.id);
});

test('relocated prototype workspace rejects malformed bundle input', async t => {
  const context = await fixture(t);
  await writeFile(join(context.root, 'bundle.json'), '{"schemaVersion":999}');
  await assert.rejects(relocatedReadBundle(context, 'bundle.json'));
});
