import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateStarterCatalog, customizeStarter } from '../../scripts/starters/companion.mjs';
import { STARTER_MAX_BYTES } from '../../scripts/starters/limits.ts';
const source = await readFile(new URL('../../configs/starters/blank.json', import.meta.url));
const definition = JSON.parse(source);
function catalog(version = 6) {
  const d = structuredClone(definition), document = d.generator.document;
  document.schemaVersion = version; document.design.schema = version;
  return { schemaVersion: 1, starters: [{ id: 'custom-template', name: d.name, category: d.category, level: d.level,
    summary: d.summary, outcome: d.outcome, version: d.version, includes: d.includes, implementation: d.implementation,
    tags: d.tags, file: 'custom-template.companion.json', sha256: createHash('sha256').update(source).digest('hex'), document }] };
}
test('current catalog permits empty libraries and does not require a blank definition', () => {
  assert.deepEqual(validateStarterCatalog({ schemaVersion: 1, starters: [] }), { schemaVersion: 1, starters: [] });
  assert.equal(validateStarterCatalog(catalog()).starters[0].id, 'custom-template');
});
test('customization preserves v6 and an independent immutable source', () => {
  const input = catalog(), before = JSON.stringify(input);
  const output = customizeStarter(input, 'custom-template', { id: 'created-project', name: 'Created Project' });
  assert.equal(output.schemaVersion, 6); assert.equal(output.design.schema, 6);
  assert.equal(output.project.id, 'created-project'); assert.equal(JSON.stringify(input), before);
  assert.notEqual(output.design, input.starters[0].document.design);
  assert.match(output.notes.at(-1), /Source SHA-256/);
});
test('v5 definitions remain at v5 rather than silently guessing new semantics', () => {
  assert.equal(customizeStarter(catalog(5), 'custom-template', {}).schemaVersion, 5);
});
test('unsupported authoring versions, fields and executable authority fail closed', () => {
  assert.throws(() => validateStarterCatalog(catalog(7)), /version|Version/);
  const input = catalog(); input.starters[0].document.executable = true;
  assert.throws(() => validateStarterCatalog(input));
  assert.throws(() => customizeStarter(catalog(), 'custom-template', { trusted: 'true' }), /Unknown configuration/);
});
test('full starter definitions share the existing authoring document byte budget', () => {
  assert.equal(STARTER_MAX_BYTES, 4_000_000);
});
