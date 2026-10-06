import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { startWizard, wizardRegistry } from '../presentation/wizards/registry.ts';
import { Back } from '#tui/prompts.ts';
import { fakeDataCommand } from '../adapters/fake-data-command.ts';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'fake-data-wizard-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Plain prompts answer strictly in order; every question and write is recorded. Running out cancels, so no prompt loop can spin. */
function plain(lines) {
  const questions = [], writes = [];
  return { questions, writes, left: () => lines.length, ui: { write: value => writes.push(value), ask: async question => {
    questions.push(question);
    if (!lines.length) throw Object.assign(new Error('No scripted line left for: ' + question + '\n' + writes.slice(-3).join('')), { code: 'CANCELLED' });
    const value = lines.shift(); if (value === BACK) throw new Back(); return value;
  } } };
}
const run = (session, root, flags = {}) => startWizard(session.ui, 'fake-data', { root, frameworkRoot, flags });
const list = async folder => (await readdir(folder)).sort();

test('declining the reviewed write (default No) writes nothing and ends the wizard', async () => scratch(async root => {
  // start, entity, count, out, seed, base, apply?
  const session = plain(['', 'contact', '3', '', '', 'no', '']);
  assert.equal(await run(session, root), 'No notes written.\n');
  assert.deepEqual(await list(root), []); assert.equal(session.left(), 0);
  assert.ok(session.writes.some(text => text.includes('Sample note Fake Data/Contacts/')) && session.questions.includes('Apply this reviewed plan? (y/N): '));
}));

test('an approved run writes exactly the planned notes and Bases file, then saves a reusable generation config', async () => scratch(async root => {
  // start, entity, count, out, seed, base, apply, save config?, config id, config title, apply config
  const session = plain(['entity', 'contact', '3', 'People', '5', 'yes', 'y', 'yes', '', 'Team', 'y']);
  const completion = await run(session, root);
  assert.equal(completion, 'Generated 3 contact notes in People (seed 5).\n'); assert.equal(session.left(), 0);
  const notes = await list(join(root, 'People'));
  assert.equal(notes.length, 4); assert.ok(notes.includes('contact.base'));
  const plan = await fakeDataCommand({ command: 'fake-data', action: '', flags: { entity: 'contact', count: '3', out: 'People', seed: '5', base: true } },
    { root, frameworkRoot }, async () => ({}));
  assert.ok(plan.changes.every(change => change.status === 'unchanged'), 'the wizard wrote byte-identical notes to the machine plan');
  const config = JSON.parse(await readFile(join(root, 'configs/fake-data/generations/contact-demo.json'), 'utf8'));
  assert.deepEqual({ ...config, $schema: undefined }, { $schema: undefined, schemaVersion: 1, id: 'contact-demo', title: 'Team', entity: 'contact', count: 3, out: 'People', seed: 5, base: true, referenceDate: '2026-01-01' });
  assert.ok(session.questions.includes('Config id (lowercase kebab-case) [contact-demo]: '));
  // Re-running the saved config with an overridden count from the start menu.
  const rerun = plain(['config', 'contact-demo', '2', '', '', '', 'y', '']);
  assert.match(await run(rerun, root), /Generated 2 contact notes in People/);
  assert.ok(rerun.writes.some(text => /unchanged\s+People\/contact\.base/.test(text)) && rerun.left() === 0);
}));

test('a new entity is defined property by property, saved through review and used for generation', async () => scratch(async root => {
  const session = plain(['define', 'Recipe', 'Dinner ideas',
    'bad key', '', 'lorem.words', '', '',
    'dish', '', 'commerce.productName', '', 'yes', 'y',
    'minutes', 'number', 'number.int', 'no', '', 'y',
    'level', 'number', 'choices', '1;2;3', '', '', 'y',
    'labels', 'tags', 'choices', 'Quick;Slow', '', '', 'n',
    'dish', 'y',
    '2', '', '', 'no', 'y',
    '']);
  assert.match(await run(session, root), /Generated 2 recipe notes in Fake Data\/Recipe/);
  assert.equal(session.left(), 0); assert.ok(session.writes.some(text => /FAKE_DATA_KEY/.test(text)), 'an invalid key is reported and asked again');
  const saved = JSON.parse(await readFile(join(root, 'configs/fake-data/entities/recipe.json'), 'utf8'));
  assert.deepEqual(saved.properties.map(item => [item.key, item.type, JSON.stringify(item.generator), item.required, item.unique]), [
    ['dish', 'text', '{"faker":"commerce.productName","args":{}}', true, true], ['minutes', 'number', '{"faker":"number.int","args":{"min":0,"max":100}}', false, false],
    ['level', 'number', '{"choices":[1,2,3]}', true, false], ['labels', 'tags', '{"choices":["Quick","Slow"]}', true, false]]);
  assert.deepEqual([saved.titleProperty, saved.description, saved.body], ['dish', 'Dinner ideas', '# {{dish}}\n']);
  const notes = await list(join(root, 'Fake Data/Recipe'));
  assert.equal(notes.length, 2);
  const note = await readFile(join(root, 'Fake Data/Recipe', notes[0]), 'utf8');
  const properties = parse(/^---\n([\s\S]*?)---/.exec(note)[1]);
  assert.ok([1, 2, 3].includes(properties.level) && properties.labels.every(tag => ['quick', 'slow'].includes(tag)));
}));

test('an unsaved entity is used for one run only and is never offered as a saved config; Back returns to the entity form', async () => scratch(async root => {
  // Back at the first property returns to the entity form; Back at a later property finishes the list.
  const session = plain(['define', 'Gadget', '', BACK, 'Gadget', '',
    'label', '', 'sequence', '', '', 'y', BACK,
    'label', '',
    '1', '', '', 'no', 'y']);
  assert.match(await run(session, root), /Generated 1 gadget notes/);
  assert.equal(session.left(), 0);
  assert.ok(session.writes.some(text => text.includes('Entity not saved')));
  assert.deepEqual(await list(root), ['Fake Data']);
  assert.match(await readFile(join(root, 'Fake Data/Gadget/label-0001.md'), 'utf8'), /^---\nlabel: "LABEL-0001"\n---\n\n# LABEL-0001\n$/);
  assert.ok(!session.writes.join('').includes('reusable generation config'));
}));

test('command-line flags preselect the saved config, and a generation conflict re-asks the run form', async () => scratch(async root => {
  const first = plain(['', '', '', '', '', '', 'y', '']);
  assert.match(await run(first, root, { generation: 'contacts-demo' }), /Generated 25 contact notes in Fake Data\/Contacts \(seed 42\)/);
  const { writeFile } = await import('node:fs/promises');
  const victim = join(root, 'Fake Data/Contacts', (await list(join(root, 'Fake Data/Contacts')))[0]);
  await writeFile(victim, 'edited\n');
  const second = plain(['', '', '', '', '', '', '', 'Fake Data/Elsewhere', '', '', 'n']);
  assert.equal(await run(second, root, { generation: 'contacts-demo' }), 'No notes written.\n');
  assert.ok(second.writes.some(text => /FAKE_DATA_CONFLICT/.test(text)) && second.left() === 0);
  assert.equal(await readFile(victim, 'utf8'), 'edited\n');
}));

test('the terminal UI shows the sample and review sections, and flags seed the run form', async () => scratch(async root => {
  const answers = { 'What do you want to generate?': 'entity', 'Target folder (relative to the project root)': 'Shelf',
    'Apply this reviewed plan?': 'yes', 'Save this run as a reusable generation config?': 'no' };
  const reviews = [], contexts = [], busy = [];
  const rich = { context: value => contexts.push(value.location), busy: label => busy.push(label), review: async title => { reviews.push(title); },
    select: async (title, items, initial) => { const value = answers[title] ?? initial; assert.ok(items.some(item => item.id === value), title); return value; },
    multi: async () => [], text: async request => { const value = answers[request.title] ?? request.initial; assert.equal(request.validate?.(value), undefined); return value; } };
  const ui = { rich, write: () => {}, ask: async () => { throw new Error('plain prompt'); } };
  const completion = await startWizard(ui, 'fake-data', { root, frameworkRoot, flags: { entity: 'book', count: '2', seed: '4', base: true } });
  assert.equal(completion, 'Generated 2 book notes in Shelf (seed 4).\n');
  const shelf = await list(join(root, 'Shelf'));
  assert.equal(shelf.length, 3); assert.ok(shelf.includes('book.base'));
  assert.deepEqual(reviews, ['Sample note', 'Review before writing']);
  assert.ok(contexts.includes('Amount and folder') && busy.some(label => label.includes('No files written yet')));
}));

test('going back to another entity refreshes the untouched default folder', async () => scratch(async root => {
  const session = plain(['', 'contact', BACK, 'book', '1', '', '', 'no', '']);
  assert.equal(await run(session, root), 'No notes written.\n');
  assert.ok(session.questions.includes('Target folder (relative to the project root) [Fake Data/Books]: ') && session.left() === 0);
}));

test('wizard hooks offer only what can be used', () => {
  const { choices, commit } = wizardRegistry.hooks;
  assert.deepEqual(choices['fake-data.starts']({ configs: [] }).map(item => item.id), ['entity', 'define']);
  assert.deepEqual(choices['fake-data.generators']({ property: { type: 'checkbox' } }).map(item => item.id), ['datatype.boolean']);
  assert.deepEqual(choices['fake-data.generators']({ property: { type: 'link' } }).slice(0, 2).map(item => item.id), ['choices', 'sequence']);
  const properties = [{ key: 'a', type: 'text', required: true }, { key: 'b', type: 'text', required: false }, { key: 'c', type: 'number', required: true }];
  assert.deepEqual(choices['fake-data.title-properties']({ properties }), [{ id: 'a', label: 'a' }]);
  assert.equal(commit['fake-data.property']({ key: 'done', type: 'checkbox', generator: 'datatype.boolean', required: true, unique: true }, {}).unique, false);
  assert.throws(() => commit['fake-data.property']({ key: 'x', type: 'date', generator: 'choices', choices: ['soon'] }, {}), /YYYY-MM-DD/);
});
