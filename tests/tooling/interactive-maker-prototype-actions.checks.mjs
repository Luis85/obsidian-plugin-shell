import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { prototypesRead, prototypesCompare, prototypesPlan } from '../../bin/adapters/framework/prototypes.ts';
import { applyFilePlan } from '../../scripts/shared/file-plan.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');
const code = async pending => { try { await pending; return 'resolved'; } catch (error) { return error.code ?? error.message.split(':')[0]; } };
/** A project with one managed prototype (alpha / v1 / main) created through the reviewed plan. */
async function withWorkspace(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'prototype-actions-')));
  try {
    const context = { root, frameworkRoot };
    await writeFile(join(root, 'project.json'), projectText);
    await applyFilePlan((await prototypesPlan({ command: 'prototypes create', args: ['alpha'], options: { input: 'project.json', name: 'Alpha' } }, context)).plan);
    await check(context);
  } finally { await rm(root, { recursive: true, force: true }); }
}
const plan = (context, command, args = [], options = {}) => prototypesPlan({ command: 'prototypes ' + command, args, options }, context);
const apply = async (context, command, args, options) => applyFilePlan((await plan(context, command, args, options)).plan);
const main = { version: 'v1', variant: 'main' };

test('workspace edits apply through reviewed plans and are reflected in the listing', () => withWorkspace(async context => {
  await apply(context, 'prototype-details', ['alpha'], { name: 'Alpha Prime', description: 'Renamed.' });
  await apply(context, 'version-details', ['alpha'], { version: 'v1', label: 'First' });
  await apply(context, 'fork', ['alpha'], { ...main, as: 'bold', hypothesis: 'Bolder copy.' });
  await apply(context, 'details', ['alpha'], { version: 'v1', variant: 'bold', name: 'Bold', hypothesis: 'Changed.' });
  await apply(context, 'status', ['alpha'], { version: 'v1', variant: 'bold', status: 'review' });
  await apply(context, 'save', ['alpha'], { ...main, input: 'project.json' });
  await apply(context, 'status', ['alpha'], { ...main, status: 'approved' });
  await apply(context, 'activate', ['alpha'], main);
  await apply(context, 'version', ['alpha'], { version: 'v2', from: 'v1' });
  await apply(context, 'seal', ['alpha'], { version: 'v1' });
  let listed = await prototypesRead(context);
  const alpha = listed.prototypes[0];
  assert.equal(alpha.name, 'Alpha Prime'); assert.deepEqual(alpha.versions.map(version => version.id).sort(), ['v1', 'v2']);
  assert.ok(alpha.versions.find(version => version.id === 'v1').sealed);
  assert.deepEqual(listed.active, { prototypeId: 'alpha', versionId: 'v1', variantId: 'main' });
  const comparison = await prototypesCompare({ command: 'prototypes compare', args: ['alpha'], options: { ...main, 'with-variant': 'bold' } }, context);
  assert.equal(comparison.after.variantId, 'bold');
  await apply(context, 'deactivate');
  await apply(context, 'archive', ['alpha']);
  listed = await prototypesRead(context);
  assert.equal(listed.active, null); assert.equal(listed.prototypes[0].archived, true);
  await apply(context, 'restore', ['alpha']);
  assert.equal((await prototypesRead(context)).prototypes[0].archived, false);
}));

test('invalid statuses, missing options and unknown commands are refused before planning writes', () => withWorkspace(async context => {
  assert.equal(await code(plan(context, 'status', ['alpha'], { ...main, status: 'active' })), 'PROTOTYPE_STATUS');
  assert.equal(await code(plan(context, 'version', ['alpha'], { version: 'v2' })), 'PROTOTYPE_OPTION');
  assert.equal(await code(plan(context, 'create', [], { input: 'project.json' })), 'PROTOTYPE_REQUIRED');
  assert.equal(await code(plan(context, 'unknown', ['alpha'])), 'PROTOTYPE_COMMAND');
  assert.equal(await code(plan(context, 'export', [], { out: 'docs/concepts/copy.json' })), 'PROTOTYPE_OUTPUT_COLLISION');
}));

test('export, import and restore-snapshot round-trip the workspace without overwriting other files', () => withWorkspace(async context => {
  const exported = await plan(context, 'export', [], { out: 'exports/prototype.json' });
  assert.equal(exported.summary.output, 'exports/prototype.json');
  await applyFilePlan(exported.plan);
  assert.equal(await code(plan(context, 'export', [], { out: 'exports/prototype.json' })), 'resolved');
  await writeFile(join(context.root, 'exports/other.json'), '{}');
  assert.equal(await code(plan(context, 'export', [], { out: 'exports/other.json' })), 'PROTOTYPE_EXPORT_EXISTS');
  const imported = await plan(context, 'import', [], { input: 'exports/prototype.json' });
  assert.ok(Array.isArray(imported.plan.changes));
  await apply(context, 'version', ['alpha'], { version: 'v2', from: 'v1' });
  const changed = JSON.parse(projectText); changed.design.goal = 'A different goal for the second version.';
  await writeFile(join(context.root, 'changed.json'), JSON.stringify(changed));
  await apply(context, 'save', ['alpha'], { version: 'v2', variant: 'main', input: 'changed.json' });
  const restored = await plan(context, 'restore-snapshot', ['alpha'], { version: 'v2', variant: 'main', 'from-version': 'v1', 'from-variant': 'main', 'recovery-version': 'v3' });
  assert.ok(restored.plan.changes.length > 0);
}));

test('adopting and generating bind the active variant and record its provenance', () => withWorkspace(async context => {
  assert.equal(await code(plan(context, 'adopt')), 'PROTOTYPE_ACTIVE_REQUIRED');
  await apply(context, 'status', ['alpha'], { ...main, status: 'approved' });
  await apply(context, 'activate', ['alpha'], main);
  const adopted = await plan(context, 'adopt');
  assert.ok(adopted.plan.changes.some(change => change.path === 'design/project.json'));
  assert.equal(await code(plan(context, 'generate')), 'PROTOTYPE_IMPORT_REQUIRED');
  const generated = await plan(context, 'generate', [], { target: 'out' });
  const receipt = generated.plan.changes.find(change => change.path === 'out/.companion/prototype-selection.json');
  assert.ok(receipt); assert.equal(JSON.parse(receipt.content).prototypeId, 'alpha');
  assert.deepEqual(generated.summary.prototypeSelection.variantId, 'main');
}));
