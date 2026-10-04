import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { collectionWizard } from '../../bin/presentation/collection.ts';
import { Back } from '../../bin/presentation/prompts.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { settingsMigrationPlan } from '../../bin/adapters/settings-migration.ts';
import { settingsPlan, loadSettings } from '../../bin/adapters/user-settings.ts';
import { documentationSettings } from '../../bin/adapters/settings-documentation.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { collectionPathDefaults, defaultSettings, effectivePaths, readSettings, settingsSchema, withoutImplicitPaths } from '../../bin/domain/user-settings.ts';
import { wizardRegistry } from '../../bin/presentation/wizards/registry.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'risk-wizard-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Plain prompts answer strictly in order; running out cancels, so no prompt loop can spin. */
function plain(lines) {
  const questions = [], writes = [];
  return { questions, writes, left: () => lines.length, ui: { write: value => writes.push(value), ask: async question => {
    questions.push(question);
    if (!lines.length) throw Object.assign(new Error('No scripted line left for: ' + question + '\n' + writes.slice(-3).join('')), { code: 'CANCELLED' });
    const value = lines.shift(); if (value === BACK) throw new Back(); return value;
  } } };
}
const run = (session, root, action, flags = {}) => collectionWizard(session.ui, 'risk', action, { root, frameworkRoot, flags: { 'as-of': '2026-10-04', ...flags } });
const cli = (root, ...argv) => execute(parseArguments(['risk', ...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot, input: process.stdin });
const folder = root => join(root, 'docs/risks');
async function seed(root, value) {
  await writeFile(join(root, 'seed.json'), JSON.stringify(value));
  const plan = await cli(root, 'new', '--input', 'seed.json');
  return cli(root, 'new', '--input', 'seed.json', '--apply', plan.planHash);
}
const base = { title: 'Vendor late', description: 'The vendor may ship late.', nextAction: 'Call the vendor', due: '2026-10-20', dimension: 'schedule', category: 'external', probability: 3, impact: 4 };
// title, description, status, dimension, category, probability, impact, next action, due, owner, identified, mitigation, notes
const newRisk = ['Vendor late', 'The vendor may ship late.', '', 'schedule', 'external', '3', '4', 'Call the vendor', '2026-10-20', '', '', 'Keep the v1 adapter.', ''];

test('risk new asks the data-driven form, previews the note and writes exactly the machine plan after approval', async () => scratch(async root => {
  const declined = plain([...newRisk, '']);
  assert.equal(await run(declined, root, 'new'), 'Nothing was written.\n');
  await assert.rejects(() => readdir(folder(root)), /ENOENT/);
  assert.ok(declined.questions.includes('Apply this reviewed plan? (y/N): ') && declined.writes.some(text => text.includes('docs/risks/RISK-0001-vendor-late.md:\n---\ntype: "Risk"')));
  assert.ok(declined.writes.some(text => text.includes('3 — Possible')), 'scale choices come from the model');
  const session = plain([...newRisk, 'y']);
  assert.equal(await run(session, root, 'new'), 'Created RISK-0001 in docs/risks/RISK-0001-vendor-late.md.\n');
  assert.equal(session.left(), 0);
  const written = await readFile(join(folder(root), 'RISK-0001-vendor-late.md'), 'utf8');
  await writeFile(join(root, 'same.json'), JSON.stringify({ ...base, mitigation: 'Keep the v1 adapter.' }));
  const { collectionCreate } = await import('../../bin/domain/collection-record.ts');
  const { loadCollection } = await import('../../bin/adapters/collection-catalog.ts');
  const { definition, hook } = await loadCollection(root, 'risk');
  const expected = collectionCreate(definition, hook, { ...base, mitigation: 'Keep the v1 adapter.' }, 'RISK-0001', '2026-10-04');
  assert.ok(written.endsWith(expected.body) && written.includes('score: 12\nlevel: "high"'));
}));

test('an invalid answer is reported and the form is asked again with the previous answers', async () => scratch(async root => {
  const answers = [...newRisk]; answers[8] = '20.10.2026';
  const session = plain([...answers, '', '', '', '', '', '', '', '', '2026-10-20', '', '', '', '', 'y']);
  assert.match(await run(session, root, 'new'), /Created RISK-0001/);
  assert.ok(session.writes.some(text => text.includes('COLLECTION_VALUE: due must be a date written as YYYY-MM-DD.')));
  assert.ok(session.questions.includes('Risk title [Vendor late]: '));
}));

test('risk edit pre-fills the note, offers only allowed transitions and keeps everything else', async () => scratch(async root => {
  const { path } = await seed(root, base);
  await writeFile(join(root, path), (await readFile(join(root, path), 'utf8')).replace('schema_version: 1\n', 'schema_version: 1\nproject: "[[Atlas]]"\n') + 'Hand notes.\n');
  // title, description, status, dimension, category, probability, impact, next action, due, owner, approve
  const session = plain(['', '', 'mitigating', '', '', '5', '', '', '', 'Alex', 'y']);
  assert.equal(await run(session, root, 'edit', { id: 'RISK-0001' }), `Updated RISK-0001 in ${path}.\n`);
  const note = await readFile(join(root, path), 'utf8');
  assert.match(note, /status: "mitigating"/); assert.match(note, /score: 20\nlevel: "critical"/); assert.match(note, /owner: "Alex"/);
  assert.ok(note.includes('project: "[[Atlas]]"') && note.endsWith('Hand notes.\n') && note.includes('created: "2026-10-04"'));
  // Without --id the risk is chosen from a list; declining the review writes nothing.
  const pick = plain(['RISK-0001', '', '', '', '', '', '', '', '', '', 'Zoe', 'n']);
  assert.equal(await run(pick, root, 'edit'), 'Nothing was written.\n');
  assert.equal(await readFile(join(root, path), 'utf8'), note);
  const offered = pick.writes.find(text => text.includes('\nStatus\n'));
  assert.ok(offered.includes('Mitigating (current)') && offered.includes('Accepted') && !offered.includes('Identified'), 'only allowed transitions are offered');
  await assert.rejects(() => run(plain([]), root, 'edit', { id: 'RISK-0404' }), /No Risk note with id RISK-0404/);
  assert.equal(await run(plain([BACK]), root, 'edit', { id: 'RISK-0001' }), undefined, 'Back at the first question cancels quietly');
}));

test('risk review walks open high and overdue risks, records the review date and supports skip and stop', async () => scratch(async root => {
  assert.equal(await run(plain([]), root, 'review'), 'Nothing to review in docs/risks.\n');
  await seed(root, base);
  await seed(root, { ...base, title: 'Late invoices', probability: 1, impact: 2, due: '2026-09-01' });
  await seed(root, { ...base, title: 'Small thing', probability: 1, impact: 1 });
  // RISK-0001: review (keep action and due, move to assessed), approve; RISK-0002 (overdue): skip.
  const session = plain(['', '', '', 'assessed', 'y', 'skip']);
  assert.equal(await run(session, root, 'review'), 'Reviewed 1 of 2 risks.\n');
  assert.ok(session.writes.some(text => text.includes('RISK-0001 — Vendor late (high, score 12, due 2026-10-20)')));
  const shown = await cli(root, 'show', '--id', 'RISK-0001');
  assert.deepEqual([shown.noteStatus, shown.values.reviewed], ['assessed', '2026-10-04']);
  assert.equal((await cli(root, 'show', '--id', 'RISK-0002')).values.reviewed, undefined);
  assert.equal(await run(plain(['stop']), root, 'review'), 'Reviewed 0 of 2 risks.\n');
  const invalid = plain(['', '', 'tomorrow', '', 'review', '', '2026-11-01', '', 'n', 'stop']);
  assert.equal(await run(invalid, root, 'review'), 'Reviewed 0 of 2 risks.\n');
  assert.ok(invalid.writes.some(text => text.includes('due must be a date')));
  await assert.rejects(() => collectionWizard(plain([]).ui, 'risk', 'archive', { root, frameworkRoot }), /has no archive wizard/);
}));

test('paths.risks is an optional, validated settings path that migrates like other folders', async () => scratch(async root => {
  assert.equal(collectionPathDefaults.risks, 'docs/risks');
  assert.equal(effectivePaths(defaultSettings.paths).risks, 'docs/risks');
  assert.equal(defaultSettings.paths.risks, undefined, 'existing settings keep their exact path set');
  assert.ok(settingsSchema.properties.paths.properties.risks);
  assert.equal(readSettings({ schemaVersion: 1, paths: { risks: 'registers/risks' } }).paths.risks, 'registers/risks');
  for (const risks of ['docs/prds/risks', '../risks', '.obsidian/risks', 'node_modules/x', 'docs/design'])
    assert.throws(() => readSettings({ schemaVersion: 1, paths: { risks } }), /SETTINGS|overlap|path|protected/i, risks);
  assert.throws(() => readSettings({ schemaVersion: 1, paths: { prds: 'docs/risks' } }), /must not overlap/);
  const shown = readSettings({ schemaVersion: 1, paths: { risks: 'docs/risks' } });
  assert.equal(withoutImplicitPaths(shown, defaultSettings).paths.risks, undefined, 'an untouched default shown by the form is not written');
  assert.equal(withoutImplicitPaths(shown, shown).paths.risks, 'docs/risks');
  assert.throws(() => documentationSettings({ ...defaultSettings, documentation: { root: 'docs/risks/app' } }), /overlap/i);
  assert.equal(wizardRegistry.hooks.choices['collection.notes']({ definition: {} }).length, 0);
  // A configured folder is used by every risk command; changing it later is a reviewed file migration.
  await mkdir(join(root, 'configs'), { recursive: true });
  const settings = await settingsPlan(root, { schemaVersion: 1, paths: { risks: 'registers/risks' } });
  await applyPrepared(settings, settings.planHash);
  const { path } = await seed(root, base);
  assert.equal(path, 'registers/risks/RISK-0001-vendor-late.md');
  const migration = await settingsMigrationPlan(root, { schemaVersion: 1, paths: { risks: 'governance/risks' } });
  assert.deepEqual(migration.data.moves.map(move => [move.key, move.from, move.to]), [['risks', 'registers/risks', 'governance/risks']]);
  await applyPrepared(migration, migration.planHash);
  assert.deepEqual(await readdir(join(root, 'governance/risks')), ['RISK-0001-vendor-late.md']);
  assert.equal((await loadSettings(root)).settings.paths.risks, 'governance/risks');
  assert.equal((await cli(root, 'list')).notes[0].path, 'governance/risks/RISK-0001-vendor-late.md');
}));

test('the fake-data risk preset generates a register that risk check accepts', async () => scratch(async root => {
  const fake = (...argv) => execute(parseArguments(['fake-data', '--config', 'risks-demo', ...argv], []), { root, frameworkRoot, input: process.stdin });
  const plan = await fake();
  await fake('--apply', plan.planHash);
  const checked = await cli(root, 'check');
  assert.equal(checked.status, 'ok'); assert.equal(checked.notes, 25); assert.equal(checked.errors, 0);
  assert.ok(checked.issues.every(item => item.code === 'COLLECTION_OVERDUE'));
  assert.deepEqual(checked.ignored, []);
  const next = await seed(root, base);
  assert.equal(next.id, 'RISK-0026', 'generated ids are reserved');
  const report = await cli(root, 'report');
  assert.equal(report.notes, 26);
}));
