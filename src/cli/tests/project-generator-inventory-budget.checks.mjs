import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { newDocument, openDocument } from '../domain/document.ts';
import { firstRunInventory } from '../adapters/first-run-inventory.ts';
import { exampleStarterIds, starterDocumentText } from '#shared/testing/starter-documents.mjs';
import { plannedPrototype, assertWithinBudget, prototypeSource } from './support/inventory-budget.mjs';

test('[GENERATOR-BUDGET-01] the planned size is what first run counts, and a fresh project prototype keeps its margin', { timeout: 180000 }, async () => {
  const measured = await plannedPrototype(newDocument('Inventory project'), async (root, planned) => {
    // The real guard walks the written source: the same files, bytes and entries as planned.
    const inventory = await firstRunInventory(root, prototypeSource);
    assert.equal(inventory.length, planned.files.length);
    const sizes = await Promise.all(inventory.map(async item => (await stat(join(root, item.path))).size));
    assert.equal(sizes.reduce((sum, size) => sum + size, 0), planned.bytes);
  });
  assertWithinBudget('fresh project', measured);
});
test('[GENERATOR-BUDGET-02] a prototype added to any example starter project keeps the same margin', { timeout: 600000 }, async () => {
  const ids = exampleStarterIds();
  assert.ok(ids.includes('quick-capture') && ids.length >= 10);
  for (const id of ids) assertWithinBudget(id, await plannedPrototype(openDocument(JSON.parse(starterDocumentText(id)))));
});
