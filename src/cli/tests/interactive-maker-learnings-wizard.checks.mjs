import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { collectionWizard } from '../presentation/collection.ts';
import { Back } from '#tui/prompts.ts';
import { execute, parseArguments } from '../adapters/commands.ts';
import { collectionCreate } from '../domain/collection-record.ts';
import { loadCollection } from '../adapters/collection-catalog.ts';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'learnings-wizard-'));
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
const run = (session, root, action, flags = {}) => collectionWizard(session.ui, 'learning', action, { root, frameworkRoot, flags: { 'as-of': '2026-10-04', ...flags } });
const cli = (root, ...argv) => execute(parseArguments(['learning', ...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot, input: process.stdin });
const folder = root => join(root, 'docs/learnings');
const path = 'docs/learnings/LRN-0001-pin-the-toolchain.md';
// title, context, insight, status, category, impact, tags (numbers), source, applies to, related risks, follow-up, due, owner, observed, evidence
const newLearning = ['Pin the toolchain', 'CI broke after a silent npm upgrade.', 'Pin exact Node and npm versions.', '', 'tooling', 'high', '3,4', 'PR #65', 'CI, setup', 'RISK-0003', '', '', '', '', 'Build log 2026-09-30.'];
const machine = { title: 'Pin the toolchain', context: 'CI broke after a silent npm upgrade.', insight: 'Pin exact Node and npm versions.', category: 'tooling', impact: 'high',
  tags: ['ci', 'dependencies'], source: 'PR #65', appliesTo: ['CI', 'setup'], relatedRisks: ['RISK-0003'], evidence: 'Build log 2026-09-30.' };

test('learning new asks the data-driven form, previews the note and writes exactly the machine plan after approval', async () => scratch(async root => {
  const declined = plain([...newLearning, '']);
  assert.equal(await run(declined, root, 'new'), 'Nothing was written.\n');
  await assert.rejects(() => readdir(folder(root)), /ENOENT/);
  assert.ok(declined.questions.includes('Apply this reviewed plan? (y/N): ') && declined.writes.some(text => text.includes(`${path}:\n---\ntype: "Learning"`)));
  assert.ok(declined.writes.some(text => text.includes('Dependencies') && text.includes('Code review')), 'tags are offered from the definition vocabulary');
  assert.ok(!declined.questions.some(text => text.startsWith('Superseded by')), 'superseded-by is asked only for superseded learnings');
  const session = plain([...newLearning, 'y']);
  assert.equal(await run(session, root, 'new'), `Created LRN-0001 in ${path}.\n`);
  assert.equal(session.left(), 0);
  const { definition } = await loadCollection(root, 'learning'), expected = collectionCreate(definition, undefined, machine, 'LRN-0001', '2026-10-04');
  const written = await readFile(join(root, path), 'utf8');
  assert.ok(written.endsWith(expected.body) && written.includes('related-risks:\n  - "RISK-0003"') && written.includes('status: "draft"'));
  assert.equal((await cli(root, 'show', '--id', 'LRN-0001')).content, written);
}));

test('an invalid risk reference is reported and the form is asked again with the previous answers', async () => scratch(async root => {
  const answers = [...newLearning]; answers[9] = 'RISK-3';
  const again = Array(15).fill(''); again[9] = 'RISK-0003';
  const session = plain([...answers, ...again, 'y']);
  assert.match(await run(session, root, 'new'), /Created LRN-0001/);
  assert.ok(session.writes.some(text => text.includes('COLLECTION_VALUE: related-risks must name ids like RISK-0001.')));
  assert.ok(session.questions.includes('Learning title [Pin the toolchain]: '));
  assert.equal(session.left(), 0);
}));

test('learning edit validates a draft with its follow-up, offers only allowed transitions and keeps everything else', async () => scratch(async root => {
  await run(plain([...newLearning, 'y']), root, 'new');
  await writeFile(join(root, path), (await readFile(join(root, path), 'utf8')).replace('schema_version: 1\n', 'schema_version: 1\nproject: "[[Atlas]]"\n') + 'Hand notes.\n');
  // Validating without a follow-up is refused by the engine; the retry adds follow-up, due and owner.
  // title, context, insight, status, category, impact, tags, source, applies to, related risks, follow-up, due, owner
  const missing = ['', '', '', 'validated', '', '', '', '', '', '', '', '', ''];
  const session = plain([...missing, '', '', '', '', '', '', '', '', '', '', 'Add an engines check', '2026-10-20', 'Alex', 'y']);
  assert.equal(await run(session, root, 'edit', { id: 'LRN-0001' }), `Updated LRN-0001 in ${path}.\n`);
  assert.ok(session.writes.some(text => text.includes('COLLECTION_REQUIRED: Missing followUp, due (required while validated).')));
  const offered = session.writes.find(text => text.includes('\nStatus\n'));
  assert.ok(offered.includes('Draft (current)') && offered.includes('Validated') && offered.includes('Archived') && !offered.includes('Applied'), 'only allowed transitions are offered');
  const note = await readFile(join(root, path), 'utf8');
  assert.match(note, /status: "validated"/); assert.match(note, /follow-up: "Add an engines check"/); assert.match(note, /owner: "Alex"/);
  assert.ok(note.includes('project: "[[Atlas]]"') && note.endsWith('Hand notes.\n') && note.includes('created: "2026-10-04"') && note.includes('  - "RISK-0003"'));
  // Without --id the learning is chosen from a list; declining the review writes nothing.
  const pick = plain(['LRN-0001', '', '', '', '', '', '', '', '', '', '', '', '', 'Zoe', 'n']);
  assert.equal(await run(pick, root, 'edit'), 'Nothing was written.\n');
  assert.equal(await readFile(join(root, path), 'utf8'), note);
  await assert.rejects(() => run(plain([]), root, 'edit', { id: 'LRN-0404' }), /No Learning note with id LRN-0404/);
  assert.equal(await run(plain([BACK]), root, 'edit', { id: 'LRN-0001' }), undefined, 'Back at the first question cancels quietly');
}));

test('learning review walks validated high-impact and overdue learnings, records the review date and applies them', async () => scratch(async root => {
  assert.equal(await run(plain([]), root, 'review'), 'Nothing to review in docs/learnings.\n');
  const seed = async value => {
    await writeFile(join(root, 'seed.json'), JSON.stringify(value));
    const plan = await cli(root, 'new', '--input', 'seed.json');
    return cli(root, 'new', '--input', 'seed.json', '--apply', plan.planHash);
  };
  const base = { title: 'Pin the toolchain', context: 'c', insight: 'i', category: 'tooling', impact: 'high', tags: ['ci'], status: 'validated', followUp: 'Add engines', due: '2026-10-20' };
  await seed(base);
  await seed({ ...base, title: 'Late follow-up', impact: 'low', due: '2026-09-01' });
  await seed({ ...base, title: 'Fine', impact: 'medium' });
  await seed({ ...base, title: 'Draft only', status: 'draft', impact: 'high' });
  // LRN-0001: review, keep follow-up and due, apply it; LRN-0002 (overdue): skip.
  const session = plain(['', '', '', 'applied', 'y', 'skip']);
  assert.equal(await run(session, root, 'review'), 'Reviewed 1 of 2 learnings.\n');
  assert.ok(session.writes.some(text => text.includes('LRN-0001 — Pin the toolchain (high impact, follow-up due 2026-10-20)')));
  const shown = await cli(root, 'show', '--id', 'LRN-0001');
  assert.deepEqual([shown.noteStatus, shown.values.reviewed, shown.values.applied], ['applied', '2026-10-04', '2026-10-04']);
  assert.equal((await cli(root, 'show', '--id', 'LRN-0002')).values.reviewed, undefined);
  assert.equal(await run(plain(['stop']), root, 'review'), 'Reviewed 0 of 1 learnings.\n');
  const invalid = plain(['', '', 'next week', '', 'review', '', '2026-11-01', '', 'y']);
  assert.equal(await run(invalid, root, 'review'), 'Reviewed 1 of 1 learnings.\n');
  assert.ok(invalid.writes.some(text => text.includes('due must be a date')));
  assert.equal((await cli(root, 'show', '--id', 'LRN-0002')).values.due, '2026-11-01');
  await assert.rejects(() => collectionWizard(plain([]).ui, 'learning', 'archive', { root, frameworkRoot }), /has no archive wizard/);
}));
