import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { inspectSitemapSummary } from '../../scripts/companion/sitemap/summary.ts';
import { applySitemapCommand } from '../../scripts/companion/sitemap/commands.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const relative = 'docs/concepts/companion/companion-project.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// These tests require the real checkout and installed framework dependencies, not the local subset harness.
test('the real companion self-project uses the same read-only sitemap validator without data rewriting', async () => {
  const before = await readFile(resolve(root, relative));
  const document = validateCompanionDocument(JSON.parse(before.toString('utf8')));
  const original = structuredClone(document), summary = inspectSitemapSummary(document.design);
  assert.equal(summary.surfaces, document.design.nodes.length);
  assert.equal(summary.transitions, document.design.links.length);
  assert.equal(summary.nativeViews, 1);
  assert.equal(summary.acceptance, 'structure-only-not-product-acceptance');
  assert.deepEqual(document, original);
  assert.equal(digest(await readFile(resolve(root, relative))), digest(before));
});

test('a route-preserving label edit on the real self-project retains all visual definitions and revisions', async () => {
  const document = validateCompanionDocument(JSON.parse(await readFile(resolve(root, relative), 'utf8')));
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
  const folder = resolve(root, 'docs/concepts/companion/starters');
  const catalog = JSON.parse(await readFile(resolve(folder, 'catalog.json'), 'utf8'));
  for (const entry of catalog.starters) {
    // Starter files may carry optional tooling defaults; the starter contract validates those separately.
    const { tooling: _tooling, ...stored } = JSON.parse(await readFile(resolve(folder, entry.file), 'utf8'));
    const document = validateCompanionDocument(stored);
    const original = JSON.stringify(document);
    const summary = inspectSitemapSummary(document.design);
    assert.equal(summary.surfaces, document.design.nodes.length, entry.id);
    assert.equal(summary.declared.sitemap, Object.hasOwn(document.design, 'sitemap'), entry.id);
    assert.equal(JSON.stringify(document), original, entry.id);
  }
});

test('the actual project inspect operation includes sitemap diagnostics and no private review keys', async () => {
  const response = await executeOperation({ command: 'project inspect', args: [], options: { input: relative } },
    { root, frameworkRoot: root });
  assert.equal(response.status, 'ok', JSON.stringify(response.diagnostics));
  const source = JSON.parse(await readFile(resolve(root, relative), 'utf8'));
  assert.deepEqual(response.data.sitemap, inspectSitemapSummary(source.design));
  assert.equal(JSON.stringify(response.data.sitemap).includes('beforeKey'), false);
  assert.equal(JSON.stringify(response.data.sitemap).includes('afterKey'), false);
});
