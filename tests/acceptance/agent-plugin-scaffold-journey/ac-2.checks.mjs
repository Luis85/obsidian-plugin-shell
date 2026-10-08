// Increment: [[docs/increments/agent-plugin-scaffold-journey]]
// AC-2: A batch with an unknown field, an excluded recipe or a child step before its feature is refused before any write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makerFixture, installMakerFoundation } from '../../tooling/maker-fixture.mjs';
import { planMakerBatch } from '../../../src/cli/adapters/makers/batch.ts';

const batch = (...steps) => ({ schemaVersion: 1, steps });
const feature = { recipe: 'feature', name: 'documents', bare: true };

test('[AC-2] malformed batches are refused with the failing step named and nothing is written', { timeout: 120000 }, () => makerFixture(async root => {
  await installMakerFoundation(root);
  const registry = join(root, 'src/bootstrap/native-integrations.ts'), before = await readFile(registry, 'utf8');
  const features = async () => (await readdir(join(root, 'src/features'))).sort();
  const existing = await features();
  const cases = [
    [{ steps: [feature] }, /schemaVersion/],
    [{ ...batch(feature), extra: true }, /Unknown batch field: extra/],
    [batch(), /1 to 40 steps/],
    [batch(...Array.from({ length: 41 }, (_, index) => ({ recipe: 'feature', name: `f${index}`, bare: true }))), /1 to 40 steps/],
    [batch(feature, { recipe: 'file-extension', name: 'board', feature: 'documents', extension: 'board', colour: 'red' }), /steps\[1\]: unknown field colour/],
    [batch({ recipe: 'plugin', name: 'helper' }), /steps\[0\]\.recipe must be a built-in recipe other than maker, plugin, locale/],
    [batch({ recipe: 'feature', name: 'documents', bare: 'yes' }), /steps\[0\]\.bare must be true or false/],
    [batch({ recipe: 'context-menu', name: 'inspect', feature: 'documents', extensions: ['md'] }, feature),
      /steps\[0\] \(context-menu inspect\): Feature documents does not exist\. Add a \{ "recipe": "feature", "name": "documents", "bare": true \} step before it\./],
    [batch(feature, { recipe: 'feature', name: 'documents', bare: true }), /steps\[1\] \(feature documents\): Feature documents already exists/],
  ];
  for (const [input, message] of cases) await assert.rejects(planMakerBatch(root, input), { message }, String(message));
  assert.equal(await readFile(registry, 'utf8'), before, 'no registration changed');
  assert.deepEqual(await features(), existing, 'no feature folder was created');
}));
