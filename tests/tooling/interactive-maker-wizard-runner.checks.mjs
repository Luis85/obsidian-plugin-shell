import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { checkedCatalog, loadCatalog } from '../../src/cli/adapters/wizard-catalog.ts';
import { runFields, runForm } from '../../src/cli/presentation/form-runner.ts';
import { runWizard } from '../../src/cli/presentation/wizard-runner.ts';
import { composeRegistry, hookNames, startForm, wizardModules, wizardRegistry } from '../../src/cli/presentation/wizards/registry.ts';
import { launchDefinition } from '../../src/cli/presentation/wizards/launch.ts';
import { Back } from '../../src/cli/presentation/prompts.ts';
import { readForm } from '../../src/cli/domain/form.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'wizard-runner-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Plain prompts answer strictly in order; every question is recorded. */
function plain(lines) {
  const questions = [], writes = [];
  return { questions, writes, left: () => lines.length, ui: { write: value => writes.push(value), ask: async question => {
    questions.push(question); assert.ok(lines.length, 'No scripted line left for: ' + question);
    const value = lines.shift(); if (value === BACK) throw new Back(); return value;
  } } };
}
/** Rich prompts answer by title; validators run like the terminal session and rejected values are recorded. */
function rich(answers) {
  const events = [], rejected = [], contexts = [], reviews = [];
  const next = title => { const queue = answers[title]; assert.ok(queue?.length, 'Unexpected prompt: ' + title); const value = queue.shift(); if (value === BACK) throw new Back(); return value; };
  return { events, rejected, contexts, reviews, ui: { write: () => {}, ask: async () => { throw new Error('plain prompt'); }, rich: {
    context: value => contexts.push(value), busy: () => {}, review: async (title, sections) => { reviews.push({ title, sections }); },
    select: async (title, items, initial) => { events.push(['select', title, initial]); const value = next(title) ?? initial; assert.ok(items.some(item => item.id === value)); return value; },
    multi: async (title, _items, selected) => next(title) ?? selected,
    text: async request => {
      events.push(['text', request.title, request.initial, Boolean(request.multiline)]);
      while (true) { const value = next(request.title) ?? request.initial; const error = request.validate?.(value); if (!error) return value; rejected.push([request.title, error]); }
    },
  } } };
}
const env = async () => ({ catalog: await loadCatalog(), hooks: wizardRegistry.hooks, data: {} });

test('plain forms keep defaults on Enter, re-ask invalid answers and honor conditions, sections and records', async () => {
  const form = readForm({ schemaVersion: 1, id: 'sample', version: 1, title: 'Sample', fields: [
    { id: 'name', kind: 'title', label: 'Name', maxLength: 10 },
    { id: 'port', kind: 'number', label: 'Port', integer: true, min: 1, max: 9, default: 4 },
    { id: 'mode', kind: 'select', label: 'Mode', choices: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }], default: 'a' },
    { id: 'extra', kind: 'text', label: 'Extra', when: { field: 'mode', equals: 'b' } },
    { id: 'tags', kind: 'list', label: 'Tags', separator: ';', suffix: ' (semicolons)', bind: 'meta.tags' },
    { id: 'more', kind: 'section', label: 'More', gate: 'Edit folders?', fields: [{ id: 'folders', kind: 'record', label: 'Folder: ', bind: 'folders' }] },
    { id: 'agree', kind: 'confirm', label: 'Agree?', transient: true },
  ] });
  const f = plain(['', 'A name that is too long', 'Short', 'nine', '4.5', '12', '', 'b', 'More', ' x ; y ;', 'y', 'docs/a', '', 'n']);
  const value = { folders: { a: 'docs/a0', b: 'docs/b0' } };
  await runForm(f.ui, form, value, await env());
  assert.deepEqual(value, { folders: { a: 'docs/a', b: 'docs/b0' }, name: 'Short', port: 4, mode: 'b', extra: 'More', meta: { tags: ['x', 'y'] } });
  assert.deepEqual(f.questions.slice(0, 3), ['Name: ', 'Name: ', 'Name: ']);
  assert.ok(f.questions.includes('Tags (semicolons): ') && f.questions.includes('Folder: a [docs/a0]: ') && f.questions.includes('Agree? (y/N): '));
  assert.ok(f.writes.some(text => /SKETCH_TITLE/.test(text)) && f.writes.some(text => /Port: enter a number/.test(text)) && f.writes.some(text => /whole number/.test(text)) && f.writes.some(text => /between 1 and 9/.test(text)));
  assert.equal(f.left(), 0);
});

test('rich forms validate in place, use custom messages and revisit the previous field on Back', async () => {
  const fields = readForm({ schemaVersion: 1, id: 'sample', version: 1, title: 'Sample', fields: [
    { id: 'purpose', kind: 'text', label: 'Purpose', required: true, multiline: true, message: 'Enter a description.' },
    { id: 'actors', kind: 'list', label: 'Actors', multiline: true },
    { id: 'kind', kind: 'boolean', label: 'Public?', yes: 'Public', no: 'Private' },
    { id: 'picks', kind: 'multi', label: 'Picks', choices: ['a', 'b'] },
  ] }).fields;
  const f = rich({ Purpose: ['  ', 'First', 'Second'], Actors: [BACK, ' Ann \n\nBo ', undefined], 'Public?': [BACK, 'yes'], Picks: [['b']] });
  const value = {};
  await runFields(f.ui, fields, value, await env());
  assert.deepEqual(value, { purpose: 'Second', actors: ['Ann', 'Bo'], kind: true, picks: ['b'] });
  assert.deepEqual(f.rejected, [['Purpose', 'Enter a description.']]);
  assert.deepEqual(f.events.filter(event => event[1] === 'Purpose').map(event => event[2]), ['', 'First']);
  assert.deepEqual(f.events.filter(event => event[1] === 'Actors').map(event => event[2]), ['', '', 'Ann\nBo']);
  await assert.rejects(() => runFields(rich({ Purpose: [BACK] }).ui, fields, {}, { catalog: { forms: new Map(), wizards: new Map() }, hooks: wizardRegistry.hooks }), Back);
});

test('documentation settings reset folders only for a changed root and commit through the owner validator', async () => {
  const { defaultSettings } = await import('../../src/cli/domain/user-settings.ts');
  // Five paths, the risk register, learnings, release items and release candidates folders and the author keep their defaults.
  const f = plain(['', '', '', '', '', '', '', '', '', '', 'auto', 'yes', 'y', '', '', '', '', '', '', '', '', '', '', '', 'y', 'manual', 'y', '', '', '', '', '', 'n']);
  const result = await startForm(f.ui, 'user-settings', structuredClone(defaultSettings));
  const documentation = result.documentation;
  assert.equal(documentation.root, 'manual'); assert.ok(Object.values(documentation.paths).every(path => path.startsWith('manual/')));
  assert.deepEqual([documentation.preserveAuthoredContent, documentation.conflictPolicy, documentation.deleteMissing], [true, 'review', false]);
  assert.ok(f.questions.includes('Reset documentation folders beneath the new root? (y/N): '));
  assert.equal(f.left(), 0);
});

test('a new guided process needs only JSON: a data-only wizard collects, reviews and saves through a reviewed plan', async () => scratch(async root => {
  const configs = join(root, 'configs');
  await mkdir(join(configs, 'forms'), { recursive: true }); await mkdir(join(configs, 'wizards'));
  await writeFile(join(configs, 'forms/contact.json'), JSON.stringify({ schemaVersion: 1, id: 'contact', version: 1, title: 'Contact', fields: [
    { id: 'name', kind: 'title', label: 'Contact name' }, { id: 'channel', kind: 'select', label: 'Channel', choices: ['mail', 'chat'], default: 'mail' }] }));
  await writeFile(join(configs, 'wizards/onboarding.json'), JSON.stringify({ schemaVersion: 1, id: 'onboarding', version: 1, title: 'Onboarding',
    context: { title: 'Onboarding {{contact.name}}', details: ['Nothing is written before review.'] }, steps: [
      { id: 'contact', kind: 'form', form: 'contact', bind: 'contact', title: 'Contact' },
      { id: 'chat-note', kind: 'message', text: 'Chat for {{contact.name}}.', when: { path: 'contact.channel', equals: 'chat' } },
      { id: 'review', kind: 'action', action: 'wizard.review', with: { value: 'contact' } },
      { id: 'agree', kind: 'action', action: 'wizard.agree', with: { label: 'Save {{contact.name}}?' } },
      { id: 'save', kind: 'action', action: 'wizard.save-json', with: { value: 'contact', file: 'answers/{{contact.channel}}.json' }, barrier: true },
      { id: 'done', kind: 'end', text: 'Saved {{contact.name}}.' }] }));
  const catalog = await checkedCatalog(hookNames(), configs), options = { root, frameworkRoot };
  const f = plain(['Ada', 'chat', 'y', 'y']);
  assert.equal(await runWizard(f.ui, catalog, wizardRegistry, 'onboarding', options), 'Saved Ada.\n');
  assert.equal(await readFile(join(root, 'answers/chat.json'), 'utf8'), JSON.stringify({ name: 'Ada', channel: 'chat' }, null, 2) + '\n');
  assert.deepEqual(f.questions, ['Contact name: ', 'Choose number or ID [mail]: ', 'Save Ada? (y/N): ', 'Apply this reviewed plan? (y/N): ']);
  assert.ok(f.writes.includes('Chat for Ada.\n') && f.writes.some(text => text.includes('Review your answers')));
  const declined = plain(['Bo', '', 'y', 'n']);
  assert.equal(await runWizard(declined.ui, catalog, wizardRegistry, 'onboarding', options), undefined);
  const notAgreed = plain(['Cy', '', '']);
  assert.equal(await runWizard(notAgreed.ui, catalog, wizardRegistry, 'onboarding', options), undefined);
  assert.deepEqual(await readdir(join(root, 'answers')), ['chat.json'], 'declined and unagreed runs write nothing');
  const tui = rich({ 'Contact name': ['Di'], Channel: ['mail'], 'Save Di?': ['no'] });
  assert.equal(await runWizard(tui.ui, catalog, wizardRegistry, 'onboarding', options), undefined);
  assert.deepEqual([tui.contexts[0].title, tui.contexts[0].location, tui.contexts[0].details], ['Onboarding ', 'Contact', ['Nothing is written before review.']]);
}));

test('wizard steps go Back to the previous interactive step, stop at barriers and retry or report failures', async () => scratch(async root => {
  const calls = [];
  const registry = composeRegistry([...wizardModules, { actions: {
    'test.count': ({ state }) => { calls.push('count'); state.count = (state.count ?? 0) + 1; },
    'test.fail': ({ state }) => { calls.push('fail'); if (!state.retried) { state.retried = true; throw Object.assign(new Error('Temporary.'), { code: 'TEMP' }); } },
    'test.back': () => { throw new Back(); },
  } }]);
  const configs = join(root, 'configs'); await mkdir(join(configs, 'wizards'), { recursive: true }); await mkdir(join(configs, 'forms'));
  const write = (id, value) => writeFile(join(configs, 'wizards', id + '.json'), JSON.stringify({ schemaVersion: 1, id, version: 1, title: id, ...value }));
  await write('flow', { steps: [
    { id: 'first', kind: 'form', fields: [{ id: 'first', kind: 'text', label: 'First' }] },
    { id: 'count', kind: 'action', action: 'test.count' },
    { id: 'second', kind: 'form', fields: [{ id: 'second', kind: 'text', label: 'Second' }] },
    { id: 'fail', kind: 'action', action: 'test.fail', retry: 'second' },
    { id: 'end', kind: 'end', text: '{{first}} {{second}} {{count}}' }] });
  await write('fenced', { cancelMessage: 'Cancelled.', reportErrors: true, steps: [
    { id: 'first', kind: 'form', fields: [{ id: 'first', kind: 'text', label: 'First' }] },
    { id: 'fence', kind: 'action', action: 'test.count', barrier: true },
    { id: 'second', kind: 'form', fields: [{ id: 'second', kind: 'text', label: 'Second' }] },
    { id: 'boom', kind: 'action', action: 'test.fail' }] });
  await write('cancelled', { steps: [{ id: 'back', kind: 'action', action: 'test.back' }] });
  const names = { ...hookNames(registry), actions: new Set(Object.keys(registry.actions)) };
  const catalog = await checkedCatalog(names, configs), options = { root, frameworkRoot };
  const flow = plain(['a', 'b', ':back', 'a2', 'b2']);
  assert.equal(await runWizard(flow.ui, catalog, registry, 'flow', options), 'a2 b2 2\n');
  assert.deepEqual(calls, ['count', 'fail', 'count', 'fail']);
  assert.ok(flow.writes.some(text => text.includes('Temporary.')));
  const fenced = plain(['a', ':back']);
  assert.equal(await runWizard(fenced.ui, catalog, registry, 'fenced', options), undefined);
  assert.deepEqual(fenced.writes, ['Cancelled.\n']);
  const failing = plain(['a', 'b']); delete catalog.wizards.get('fenced').cancelMessage;
  const state = { retried: false };
  assert.equal(await runWizard(failing.ui, catalog, registry, 'fenced', options, state), undefined);
  assert.ok(failing.writes.some(text => text.includes('Temporary.')));
  await assert.rejects(() => runWizard(plain([]).ui, catalog, registry, 'cancelled', options), Back);
  await assert.rejects(() => runWizard(plain([]).ui, catalog, registry, 'missing', options), /Unknown wizard missing/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => runWizard(plain([]).ui, catalog, registry, 'flow', { ...options, signal: controller.signal }), /cancelled/);
}));

test('the form command fills a shipped form and saves it through a reviewed plan; declining writes nothing', async () => scratch(async root => {
  const options = { root, frameworkRoot };
  const saved = plain(['Demo', 'A demo project', 'Ship it', 'y']);
  const args = { command: 'form', action: '', flags: { name: 'project-identity', out: 'answers/identity.json' } };
  assert.equal(await launchDefinition(saved.ui, args, options), 'Form project-identity saved to answers/identity.json.\n');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'answers/identity.json'), 'utf8')), { name: 'Demo', description: 'A demo project', product: 'Ship it' });
  const chosen = plain(['project-identity', 'Other', 'Other project', 'Outcome', 'n']);
  assert.equal(await launchDefinition(chosen.ui, { command: 'form', action: '', flags: { out: 'answers/other.json' } }, options), undefined);
  assert.deepEqual(await readdir(join(root, 'answers')), ['identity.json']);
  const review = plain(['Third', 'Desc', 'Outcome']);
  assert.equal(await launchDefinition(review.ui, { command: 'form', action: '', flags: { name: 'project-identity' } }, options), undefined);
  assert.ok(review.writes.some(text => text.includes('"name": "Third"')));
  const wizard = plain(['first-run', '']);
  assert.equal(await launchDefinition(wizard.ui, { command: 'wizard', action: '', flags: {} }, options), undefined);
  assert.deepEqual(wizard.questions, ['Choose number or ID: ', 'Choose number or ID [skip]: ']);
}));
