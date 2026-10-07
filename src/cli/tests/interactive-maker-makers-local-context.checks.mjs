const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { makerFixture, makerSourceRoot } from './maker-fixture.mjs';
import { applyFilePlan } from '#shared/platform/file-plan.ts';
import { parseArguments } from '../adapters/makers/arguments.ts';
import { planMaker } from '../adapters/makers/plan.ts';
import { createMakerContext } from '../adapters/makers/engine.ts';
import { action } from '../adapters/makers/primitives.ts';
import { localRecipeContext } from '../adapters/makers/custom-contract.ts';
import { executeOperation } from '../adapters/framework/operations.ts';

// The runner-injected local recipe context and the read-only `make locale <name> --check` boundary that
// generated consumer checks use instead of importing framework internals (src/cli/adapters/makers, framework operations).
const outputs = async context => (await context.finish()).changes.map(change => [change.path, change.status, change.afterHash]);

test('a local recipe receives a frozen context whose only primitive composes the same bytes as the built-in action', () => makerFixture(async root => {
  const direct = createMakerContext(root);
  await action(direct, { owner: 'sample', name: 'example', kind: 'command' });
  const injected = localRecipeContext(createMakerContext(root));
  assert.deepEqual(Object.keys(injected).sort(), ['action', 'add', 'editArray', 'read', 'tests']);
  assert.ok(Object.isFrozen(injected));
  assert.throws(() => { injected.add = async () => undefined; }, TypeError);
  for (const forbidden of ['root', 'edit', 'finish']) assert.equal(forbidden in injected, false, forbidden);
  await injected.action({ owner: 'sample', name: 'example', kind: 'command' });
  assert.deepEqual([...injected.tests], ['tests/runtime/generated/sample-example-command.test.ts']);
  const recorded = createMakerContext(root);
  await localRecipeContext(recorded).action({ owner: 'sample', name: 'example', kind: 'command' });
  assert.deepEqual(await outputs(recorded), await outputs(direct));
  assert.ok((await outputs(direct)).some(([path]) => path === 'src/features/sample/example.command.ts'));
}));

test('the injected primitive revalidates untyped recipe requests before composing anything', () => makerFixture(async root => {
  const context = localRecipeContext(createMakerContext(root));
  for (const request of [null, { owner: 'sample', name: 'example' }, { owner: 'sample', name: 'example', kind: 'command', preference: 1 }, { owner: 'sample', name: 'example', kind: 'command', event: false }])
    await assert.rejects(context.action(request), { message: 'CUSTOM_ACTION_INVALID' });
  await assert.rejects(context.action({ owner: '../x', name: 'example', kind: 'command' }), /Invalid action owner/);
  await assert.rejects(context.action({ owner: 'sample', name: 'Bad', kind: 'command' }), /Invalid action name/);
  await assert.rejects(context.action({ owner: 'sample', name: 'example', kind: 'unknown' }), /Unsupported action primitive: unknown/);
  assert.equal(context.tests.size, 0);
}));

test('the injected primitive applies the built-in event slug, preference allowlist and per-kind requirements', () => makerFixture(async root => {
  const recorded = createMakerContext(root), context = localRecipeContext(recorded);
  const base = { owner: 'sample', name: 'example' };
  for (const event of ['../../outside', 'sample/../x', 'Bad', 'constructor', 'x'.repeat(49)])
    await assert.rejects(context.action({ ...base, kind: 'listener', event }), /Invalid existing event name/, event);
  for (const preference of ["notifySuccess'; process.exit(1); '", '__proto__', 'readonly', ''])
    await assert.rejects(context.action({ ...base, kind: 'setting', preference }), { message: 'Unknown --preference; select notifySuccess|hideObsidianViewHeader' }, preference);
  await assert.rejects(context.action({ ...base, kind: 'setting' }), /MAKER_PREFERENCE_REQUIRED/);
  await assert.rejects(context.action({ ...base, kind: 'listener' }), /Invalid existing event name/);
  await assert.rejects(context.action({ ...base, kind: 'command', preference: 'notifySuccess' }), /MAKER_OPTION_UNSUPPORTED: preference/);
  await assert.rejects(context.action({ ...base, kind: 'event', event: 'example' }), /MAKER_OPTION_UNSUPPORTED: event/);
  // The built-in action rejects the same requests: one validator, not a second custom-only copy.
  for (const request of [{ ...base, kind: 'listener', event: '../x' }, { ...base, kind: 'setting', preference: 'other' }, { ...base, kind: 'setting' }])
    await assert.rejects(action(createMakerContext(root), request), /Invalid existing event name|Unknown --preference|MAKER_PREFERENCE_REQUIRED/);
  assert.equal(context.tests.size, 0);
  assert.deepEqual((await recorded.finish()).changes, [], 'rejected requests compose no outputs');
}));

async function snapshot(root, folder = '') {
  const entries = await readdir(join(root, folder), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = folder ? `${folder}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return snapshot(root, path);
    return [[path, createHash('sha256').update(await readFile(join(root, path))).digest('hex')]];
  }));
  return nested.flat().sort(([left], [right]) => left.localeCompare(right));
}
const check = (root, args, options = {}) => executeOperation({ command: 'make', args, options: { check: true, ...options } }, { root, frameworkRoot: makerSourceRoot });
async function localeProject(root) {
  await mkdir(join(root, 'src/locales'), { recursive: true });
  await cp(join(makerSourceRoot, 'src/locales/en.json'), join(root, 'src/locales/en.json'));
  await applyFilePlan((await planMaker(root, parseArguments(['locale', 'fr']))).plan);
}

test('make locale --check compares draft keys read-only and reports drift without writing', () => makerFixture(async root => {
  await localeProject(root);
  const before = await snapshot(root);
  const ok = await check(root, ['locale', 'fr'], { json: true, 'dry-run': true });
  assert.equal(ok.status, 'ok', JSON.stringify(ok.diagnostics));
  assert.deepEqual(ok.data, { locale: 'fr', missing: [], extra: [], selectable: false });
  assert.deepEqual(await snapshot(root), before, 'a passing check writes nothing');
  const draftPath = join(root, 'src/locales/pending/fr.json');
  const draft = JSON.parse(await readFile(draftPath, 'utf8'));
  const [section] = Object.keys(draft);
  const [removed] = Object.keys(draft[section]);
  delete draft[section][removed];
  await writeFile(draftPath, JSON.stringify({ ...draft, [section]: { ...draft[section], invented: 'Inventé' } }, null, 2) + '\n');
  const statusPath = join(root, 'src/locales/pending/fr.status.json');
  await writeFile(statusPath, JSON.stringify({ ...JSON.parse(await readFile(statusPath, 'utf8')), selectable: true }));
  const edited = await snapshot(root);
  const drift = await check(root, ['locale', 'fr']);
  assert.equal(drift.status, 'failed');
  assert.equal(drift.diagnostics[0].code, 'LOCALE_DRAFT_DRIFT');
  assert.deepEqual(drift.data, { locale: 'fr', missing: [`${section}.${removed}`], extra: [`${section}.invented`], selectable: true });
  assert.deepEqual(await snapshot(root), edited, 'a failing check writes nothing either');
}));

test('make --check is limited to an existing locale draft and refuses write options', () => makerFixture(async root => {
  await localeProject(root);
  const before = await snapshot(root);
  const code = async (args, options) => (await check(root, args, options)).diagnostics[0]?.code;
  assert.equal(await code(['command', 'later']), 'MAKER_CHECK_UNSUPPORTED');
  assert.equal(await code(['locale']), 'MAKER_CHECK_UNSUPPORTED');
  for (const options of [{ yes: true }, { apply: 'a'.repeat(64) }, { 'plan-out': 'plan.json' }, { feature: 'sample' }])
    assert.equal(await code(['locale', 'fr'], options), 'MAKER_CHECK_OPTIONS', JSON.stringify(options));
  assert.equal((await check(root, ['locale', 'Bad'])).status, 'failed');
  assert.equal(await code(['locale', 'de']), 'ENOENT');
  assert.deepEqual(await snapshot(root), before);
}));
