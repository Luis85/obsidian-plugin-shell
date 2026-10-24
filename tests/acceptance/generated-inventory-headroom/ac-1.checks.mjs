// Increment: [[docs/increments/generated-inventory-headroom]]
// AC-1: A brainstorm prototype from a fresh project and from every example starter stays at least 500 KB and 1,000 entries below the unchanged first-run inventory bounds, measured exactly as `firstRunInventory` counts them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newDocument, openDocument } from '../../../src/cli/domain/document.ts';
import { firstRunInputLimit, firstRunEntryLimit } from '../../../src/cli/adapters/first-run-inventory.ts';
import { exampleStarterIds, starterDocumentText } from '../../../src/shared/testing/starter-documents.mjs';
import { plannedPrototype, assertWithinBudget, byteMargin, entryMargin } from '../../../src/cli/tests/support/inventory-budget.mjs';

test('[AC-1] fresh and example starter prototypes stay a stated margin below the unchanged first-run bounds', { timeout: 600000 }, async () => {
  assert.deepEqual([firstRunInputLimit, firstRunEntryLimit, byteMargin, entryMargin], [32_000_000, 5000, 500_000, 1000]);
  assertWithinBudget('fresh project', await plannedPrototype(newDocument('Inventory project')));
  for (const id of exampleStarterIds()) assertWithinBudget(id, await plannedPrototype(openDocument(JSON.parse(starterDocumentText(id)))));
});
