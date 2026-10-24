import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { newDocument, documentText, openDocument } from '../domain/document.ts';
import { hash } from '../adapters/framework/files.ts';
import { readFeatureBrainstorm } from '../domain/brainstorm.ts';
import { brainstormFeaturePlan } from '../adapters/brainstorm.ts';
import { applyPrepared } from '../adapters/storage.ts';
import { firstRunInventory, firstRunInputLimit, firstRunEntryLimit } from '../adapters/first-run-inventory.ts';
import { exampleStarterIds, starterDocumentText } from '#shared/testing/starter-documents.mjs';

/**
 * Generated source that first run and brainstorm verification inventory (firstRunInventory) must stay this far below its
 * byte bound. Growth past the margin fails here, naming the largest contributors, while makers still work; the fix is to keep
 * framework-maintainer content out of generated projects (framework-scope.ts, framework-docs.ts). Raising the bound itself
 * needs an explicit owner decision, never this test's margin.
 */
const byteMargin = 500_000, entryMargin = 1000;
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const request = { schemaVersion: 1, name: 'Inventory probe', purpose: 'Measure generated prototype source',
  actors: ['Member'], entities: ['Probe'], acceptance: ['A probe can be reopened'],
  pages: [
    { title: 'Probe list', kind: 'view', purpose: 'Review probes', interactions: [{ kind: 'navigate', label: 'Open probe', target: 'Probe details' }] },
    { title: 'Probe details', kind: 'page', purpose: 'Inspect a probe', interactions: [] },
  ], output: 'prototype', verification: 'test' };
const out = 'brainstorms/inventory-probe', source = out + '/source';
async function scratch(document, fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'inventory-budget-'));
  try {
    await mkdir(join(root, 'design'));
    await writeFile(join(root, 'design/project.json'), documentText(document));
    return await fn({ root, frameworkRoot, project: 'design/project.json', input: Readable.from([]) });
  } finally { await rm(root, { recursive: true, force: true }); }
}
/** The planned prototype source exactly as the inventory walks it: every file's bytes, and every file and folder entry. */
async function plannedSource(document, written) {
  return scratch(document, async options => {
    const plan = await brainstormFeaturePlan(readFeatureBrainstorm({ ...request, projectId: document.project.id,
      baseSha256: hash(documentText(document)) }), options);
    const files = plan.plan.changes.filter(change => change.path.startsWith(source + '/'))
      .map(change => ({ path: change.path, bytes: Buffer.byteLength(change.content ?? '', change.encoding ?? 'utf8') }));
    const folders = new Set(files.flatMap(file => file.path.slice(source.length + 1).split('/').slice(0, -1)
      .map((_, index, parts) => parts.slice(0, index + 1).join('/'))));
    const measured = { files, bytes: files.reduce((sum, file) => sum + file.bytes, 0), entries: files.length + folders.size };
    if (written) { await applyPrepared(plan, plan.planHash); await written(options.root, measured); }
    return measured;
  });
}
function contributors(files) {
  const totals = new Map();
  for (const file of files) {
    const key = file.path.slice(source.length + 1).split('/').slice(0, 2).join('/');
    totals.set(key, (totals.get(key) ?? 0) + file.bytes);
  }
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([path, bytes]) => `${path} ${(bytes / 1e6).toFixed(2)} MB`).join(', ');
}
function assertWithinBudget(label, measured) {
  assert.ok(measured.bytes + byteMargin <= firstRunInputLimit, `${label}: generated prototype source is ${measured.bytes} bytes, `
    + `${firstRunInputLimit - measured.bytes} below the ${firstRunInputLimit}-byte first-run inventory bound; keep at least ${byteMargin}. `
    + `Largest: ${contributors(measured.files)}.`);
  assert.ok(measured.entries + entryMargin <= firstRunEntryLimit, `${label}: ${measured.entries} inventory entries; keep ${entryMargin} below ${firstRunEntryLimit}.`);
}

test('[GENERATOR-BUDGET-01] the planned size is what first run counts, and a fresh project prototype keeps its margin', { timeout: 180000 }, async () => {
  const measured = await plannedSource(newDocument('Inventory project'), async (root, planned) => {
    // The real guard walks the written source: the same files, bytes and entries as planned.
    const inventory = await firstRunInventory(root, source);
    assert.equal(inventory.length, planned.files.length);
    const sizes = await Promise.all(inventory.map(async item => (await stat(join(root, item.path))).size));
    assert.equal(sizes.reduce((sum, size) => sum + size, 0), planned.bytes);
  });
  assertWithinBudget('fresh project', measured);
});
test('[GENERATOR-BUDGET-02] a prototype added to any example starter project keeps the same margin', { timeout: 600000 }, async () => {
  const ids = exampleStarterIds();
  assert.ok(ids.includes('quick-capture') && ids.length >= 10);
  for (const id of ids) assertWithinBudget(id, await plannedSource(openDocument(JSON.parse(starterDocumentText(id)))));
});
