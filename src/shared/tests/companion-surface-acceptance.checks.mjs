// Optional per-surface UX acceptance block: validator behavior, defaults and the schema 6 only boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateAuthoringDocument } from '../companion/authoring-contract.ts';
import { resolveSurfaceAcceptance, validateSurfaceAcceptance } from '../companion/sitemap/acceptance.ts';
import { companionProjectSchema } from '../companion/schema/project.mjs';

const starter = JSON.parse(readFileSync(new URL('../../../configs/starters/feature-showcase.json', import.meta.url), 'utf8')).generator.document;
const withBlock = acceptance => { const document = structuredClone(starter); document.design.nodes[1].acceptance = acceptance; return document; };
const code = fn => { try { fn(); } catch (error) { return error; } return null; };

test('documents without the block validate unchanged and the block stays optional in the published schema', () => {
  const bare = structuredClone(starter);
  for (const node of bare.design.nodes) delete node.acceptance;
  const before = JSON.stringify(bare);
  validateAuthoringDocument(bare);
  assert.equal(JSON.stringify(bare), before);
  const surface = companionProjectSchema().$defs.surface;
  assert.ok(surface.properties.acceptance); assert.ok(!surface.required.includes('acceptance'));
  assert.deepEqual(surface.properties.acceptance.required, []); assert.equal(surface.properties.acceptance.additionalProperties, false);
});
test('the starter worked example and every documented member validate', () => {
  validateAuthoringDocument(structuredClone(starter));
  assert.deepEqual(starter.design.nodes.filter(node => node.acceptance).map(node => node.id), ['node-2', 'node-6']);
  validateAuthoringDocument(withBlock({ states: ['default', 'loading', 'empty', 'error', 'disabled'], keyboardPath: ['Save', 'vn-4'], focusReturn: false, minWidth: 120, themes: ['light'], notes: '' }));
  validateAuthoringDocument(withBlock({}));
});
test('a retired schema 5 envelope is refused even when it carries the block; it is never migrated', () => {
  const legacy = structuredClone(starter); legacy.schemaVersion = 5; legacy.design.schema = 5;
  assert.throws(() => validateAuthoringDocument(legacy), { message: /^COMPANION_VERSION: Unsupported project schemaVersion 5; only schema 6 is supported/ });
});
const invalid = [
  ['unknown state', { states: ['sleeping'] }, /unsupported value; use default, loading, empty, error, disabled/],
  ['duplicate state', { states: ['empty', 'empty'] }, /lists a value twice/],
  ['states not a list', { states: 'default' }, /Acceptance states must list/],
  ['empty themes', { themes: [] }, /themes must list at least one of light, dark/],
  ['unknown theme', { themes: ['sepia'] }, /themes contains an unsupported value/],
  ['non-numeric width', { minWidth: '360' }, /minWidth must be a whole number of pixels from 120 to 4000/],
  ['width below range', { minWidth: 119 }, /minWidth must be a whole number/],
  ['width above range', { minWidth: 4001 }, /minWidth must be a whole number/],
  ['fractional width', { minWidth: 360.5 }, /minWidth must be a whole number/],
  ['blank keyboard step', { keyboardPath: [' '] }, /non-empty single-line/],
  ['multiline keyboard step', { keyboardPath: ['a\nb'] }, /non-empty single-line/],
  ['non-string keyboard step', { keyboardPath: [3] }, /non-empty single-line/],
  ['too many keyboard steps', { keyboardPath: Array.from({ length: 41 }, (_, i) => 'step ' + i) }, /at most 40/],
  ['focusReturn not boolean', { focusReturn: 1 }, /focusReturn must be true or false/],
  ['unknown member', { timeoutMs: 5 }, /Unknown acceptance member "timeoutMs"/],
  ['notes too long', { notes: 'x'.repeat(2001) }, /notes must be text of at most 2000/],
  ['array instead of object', ['default'], /must be an object/],
];
for (const [name, block, message] of invalid) test('invalid acceptance block is rejected with a clear error: ' + name, () => {
  const direct = code(() => validateSurfaceAcceptance(block));
  assert.ok(direct, 'direct validation must throw'); assert.equal(direct.code, 'SITEMAP_ACCEPTANCE'); assert.match(direct.message, message);
  const complete = code(() => validateAuthoringDocument(withBlock(block)));
  assert.ok(complete, 'the complete project validator must reject it'); assert.equal(complete.code, 'SITEMAP_ACCEPTANCE');
});
test('null is not a block; absence is the only way to declare nothing', () => {
  assert.equal(code(() => validateAuthoringDocument(withBlock(null))).code, 'SITEMAP_ACCEPTANCE');
});
test('defaults: 360 px, both themes, no obligations; explicit members win and inputs are not mutated', () => {
  assert.deepEqual(resolveSurfaceAcceptance({}), { states: [], keyboardPath: [], focusReturn: false, minWidth: 360, themes: ['light', 'dark'], notes: '' });
  const block = { states: ['error'], keyboardPath: ['Save'], focusReturn: true, minWidth: 480, themes: ['dark'], notes: 'n' }, before = structuredClone(block);
  const resolved = resolveSurfaceAcceptance(block);
  assert.deepEqual(resolved, block); assert.deepEqual(block, before);
  resolved.states.push('empty'); assert.deepEqual(block, before);
});
test('the contract validator mirrors the schema constants it cannot import across the zone boundary', async () => {
  const schema = await import('../companion/schema/acceptance.mjs');
  const defaults = resolveSurfaceAcceptance({});
  assert.equal(defaults.minWidth, schema.SURFACE_ACCEPTANCE_MIN_WIDTH.default);
  assert.deepEqual(defaults.themes, [...schema.SURFACE_ACCEPTANCE_THEMES]);
  assert.doesNotThrow(() => validateSurfaceAcceptance({ states: [...schema.SURFACE_ACCEPTANCE_STATES], themes: [...schema.SURFACE_ACCEPTANCE_THEMES] }));
  assert.throws(() => validateSurfaceAcceptance({ states: ['hover'] }));
  const { minimum, maximum } = schema.SURFACE_ACCEPTANCE_MIN_WIDTH;
  for (const ok of [minimum, maximum]) assert.doesNotThrow(() => validateSurfaceAcceptance({ minWidth: ok }));
  for (const bad of [minimum - 1, maximum + 1]) assert.throws(() => validateSurfaceAcceptance({ minWidth: bad }));
  const { keyboardSteps, step, notes } = schema.SURFACE_ACCEPTANCE_LIMITS;
  assert.doesNotThrow(() => validateSurfaceAcceptance({ keyboardPath: Array(keyboardSteps).fill('x'.repeat(step)), notes: 'n'.repeat(notes) }));
  assert.throws(() => validateSurfaceAcceptance({ keyboardPath: Array(keyboardSteps + 1).fill('x') }));
  assert.throws(() => validateSurfaceAcceptance({ keyboardPath: ['x'.repeat(step + 1)] }));
  assert.throws(() => validateSurfaceAcceptance({ notes: 'n'.repeat(notes + 1) }));
});
