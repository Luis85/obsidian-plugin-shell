import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateAuthoringDocument as validateCompanionDocument } from '#shared/companion/authoring-contract.ts';
import { companionStarterIds, starterDocument, starterDocumentText, starterPath } from '#shared/testing/starter-documents.mjs';
import { executeOperation } from '../adapters/framework/operations.ts';
import { inspectSitemapSummary } from '#shared/companion/sitemap/summary.ts';
import { applySitemapCommand } from '#shared/companion/sitemap/commands.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
// The current self-project is the embedded document of the golden Companion starter.
const relative = starterPath('companion-plugin');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// These tests require the real checkout and installed framework dependencies, not the local subset harness.
test('the real companion self-project uses the same read-only sitemap validator without data rewriting', async () => {
  const before = await readFile(resolve(root, relative));
  const document = validateCompanionDocument(JSON.parse(before.toString('utf8')).generator.document);
  const original = structuredClone(document), summary = inspectSitemapSummary(document.design);
  assert.equal(summary.surfaces, document.design.nodes.length);
  assert.equal(summary.transitions, document.design.links.length);
  assert.equal(summary.nativeViews, 1);
  assert.equal(summary.acceptance, 'structure-only-not-product-acceptance');
  assert.deepEqual(document, original);
  assert.equal(digest(await readFile(resolve(root, relative))), digest(before));
});

test('a route-preserving label edit on the real self-project retains all visual definitions and revisions', async () => {
  const document = validateCompanionDocument(starterDocument('companion-plugin'));
  const selected = document.design.nodes.find(node => node.kind === 'page');
  assert.ok(selected);
  const next = applySitemapCommand(document.design, { type: 'rename', surface: selected.id, label: selected.label + ' edited' });
  validateCompanionDocument({ ...document, design: next });
  assert.deepEqual(next.visualDesigns, document.design.visualDesigns);
  assert.deepEqual(next.links, document.design.links);
  assert.deepEqual(next.prds, document.design.prds);
  assert.equal(next.nodes.find(node => node.id === selected.id).slug, selected.slug);
});

test('all checked-in starters pass the shared sitemap core without synthesizing routing metadata', async () => {
  for (const id of companionStarterIds()) {
    const entry = { id }, document = validateCompanionDocument(starterDocument(id));
    const original = JSON.stringify(document);
    const summary = inspectSitemapSummary(document.design);
    assert.equal(summary.surfaces, document.design.nodes.length, entry.id);
    assert.equal(summary.declared.sitemap, Object.hasOwn(document.design, 'sitemap'), entry.id);
    assert.equal(JSON.stringify(document), original, entry.id);
  }
});

test('the actual project inspect operation includes sitemap diagnostics and no private review keys', async () => {
  const response = await executeOperation({ command: 'project inspect', args: [], options: { input: '-' } },
    { root, frameworkRoot: root, inputText: starterDocumentText('companion-plugin') });
  assert.equal(response.status, 'ok', JSON.stringify(response.diagnostics));
  const source = starterDocument('companion-plugin');
  assert.deepEqual(response.data.sitemap, inspectSitemapSummary(source.design));
  assert.equal(JSON.stringify(response.data.sitemap).includes('beforeKey'), false);
  assert.equal(JSON.stringify(response.data.sitemap).includes('afterKey'), false);
});
