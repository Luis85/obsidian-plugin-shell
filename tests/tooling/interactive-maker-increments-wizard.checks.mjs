import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { collectionWizard } from '../../bin/presentation/collection.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { collectionCreate } from '../../bin/domain/collection-record.ts';
import { loadCollection } from '../../bin/adapters/collection-catalog.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'increments-wizard-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Plain prompts answer strictly in order; running out cancels, so no prompt loop can spin. */
function plain(lines) {
  const questions = [], writes = [];
  return { questions, writes, left: () => lines.length, ui: { write: value => writes.push(value), ask: async question => {
    questions.push(question);
    if (!lines.length) throw Object.assign(new Error('No scripted line left for: ' + question + '\n' + writes.slice(-3).join('')), { code: 'CANCELLED' });
    return lines.shift();
  } } };
}
const run = (session, root, action, flags = {}) => collectionWizard(session.ui, 'increment', action, { root, frameworkRoot, flags: { 'as-of': '2026-10-04', ...flags } });
const cli = (root, ...argv) => execute(parseArguments([...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot, input: process.stdin });
const path = 'docs/releases/increments/INC-0001-checkout-redesign.md';
// title, summary, kind, priority, status, sources, acceptance, risks, owner, target, proposed, notes
const answers = ['Checkout redesign', 'A two-step checkout replaces the five-step flow.', 'feature', 'high', 'ready', 'prototypes/checkout, docs/design/checkout, RISK-0002',
  'Payment completes in two steps; Saved cards still work', 'RISK-0002', 'Alex', '2026-11-01', '', 'Agreed in the design review.'];
const machine = { title: 'Checkout redesign', summary: 'A two-step checkout replaces the five-step flow.', kind: 'feature', priority: 'high', status: 'ready',
  sources: ['prototypes/checkout', 'docs/design/checkout', 'RISK-0002'], acceptance: ['Payment completes in two steps', 'Saved cards still work'], risks: ['RISK-0002'], owner: 'Alex',
  target: '2026-11-01', notes: 'Agreed in the design review.' };

test('increment new asks the data-driven form, offers only statuses people own and writes exactly the machine plan', async () => scratch(async root => {
  const declined = plain([...answers, '']);
  assert.equal(await run(declined, root, 'new'), 'Nothing was written.\n');
  await assert.rejects(() => readdir(join(root, 'docs')), /ENOENT/);
  const offered = declined.writes.find(text => text.includes('\nStatus\n'));
  assert.ok(offered.includes('Proposed') && offered.includes('Ready') && offered.includes('Dropped') && !offered.includes('Included') && !offered.includes('Shipped'), 'managed statuses are never offered');
  assert.ok(declined.writes.some(text => text.includes('Improvement') && text.includes('Documentation')), 'kinds come from the definition vocabulary');
  const session = plain([...answers, 'y']);
  assert.equal(await run(session, root, 'new'), `Created INC-0001 in ${path}.\n`);
  assert.equal(session.left(), 0);
  const { definition } = await loadCollection(root, 'increment'), expected = collectionCreate(definition, undefined, machine, 'INC-0001', '2026-10-04');
  const written = await readFile(join(root, path), 'utf8');
  assert.ok(written.endsWith(expected.body) && written.includes('status: "ready"') && written.includes('  - "Saved cards still work"'));
  assert.equal((await cli(root, 'increment', 'show', '--id', 'INC-0001')).content, written);
}));

test('an invalid source is reported and the form is asked again with the previous answers', async () => scratch(async root => {
  const first = [...answers]; first[5] = '../outside';
  const again = Array(12).fill(''); again[5] = 'prototypes/checkout';
  const session = plain([...first, ...again, 'y']);
  assert.match(await run(session, root, 'new'), /Created INC-0001/);
  assert.ok(session.writes.some(text => text.includes('COLLECTION_VALUE: sources must name a project-relative path or ids like RISK-0001, LRN-0001, INC-0001.')));
  assert.equal(session.left(), 0);
}));

test('increment edit keeps the managed candidate and offers no status change for an included increment', async () => scratch(async root => {
  await run(plain([...answers, 'y']), root, 'new');
  await writeFile(join(root, 'c.json'), JSON.stringify({ increments: ['INC-0001'] }));
  const plan = await cli(root, 'candidate', 'new', '--version', '1.0.0', '--input', 'c.json');
  await cli(root, 'candidate', 'new', '--version', '1.0.0', '--input', 'c.json', '--apply', plan.planHash);
  await writeFile(join(root, path), (await readFile(join(root, path), 'utf8')) + 'Hand notes.\n');
  // title, summary, kind, priority, status, sources, acceptance, risks, owner, target
  const session = plain(['', 'Two steps instead of five.', '', '', '', '', '', '', '', '', 'y']);
  assert.equal(await run(session, root, 'edit', { id: 'INC-0001' }), `Updated INC-0001 in ${path}.\n`);
  const offered = session.writes.find(text => text.includes('\nStatus\n'));
  assert.ok(offered.includes('Included (current)') && !offered.includes('Ready'), 'an included increment offers only its own status');
  const note = await readFile(join(root, path), 'utf8');
  assert.ok(note.includes('summary: "Two steps instead of five."') && note.includes('candidate: "1.0.0"') && note.includes('status: "included"') && note.endsWith('Hand notes.\n'));
}));

test('increment review walks ready high-priority and overdue increments and records the review', async () => scratch(async root => {
  assert.equal(await run(plain([]), root, 'review'), 'Nothing to review in docs/releases/increments.\n');
  const seed = async value => {
    await writeFile(join(root, 'seed.json'), JSON.stringify(value));
    const plan = await cli(root, 'increment', 'new', '--input', 'seed.json');
    return cli(root, 'increment', 'new', '--input', 'seed.json', '--apply', plan.planHash);
  };
  const base = { title: 'Checkout redesign', summary: 's', kind: 'feature', priority: 'high', status: 'ready', acceptance: ['works'] };
  await seed(base);
  await seed({ ...base, title: 'Late fix', kind: 'fix', priority: 'low', target: '2026-09-01' });
  await seed({ ...base, title: 'Proposal', status: 'proposed', acceptance: [] });
  // INC-0001: review with a target date and keep priority/status; INC-0002 (overdue): skip.
  const session = plain(['', '2026-12-01', '', '', 'y', 'skip']);
  assert.equal(await run(session, root, 'review'), 'Reviewed 1 of 2 increments.\n');
  assert.ok(session.writes.some(text => text.includes('INC-0001 — Checkout redesign (ready, high priority, target none)')));
  const shown = await cli(root, 'increment', 'show', '--id', 'INC-0001');
  assert.deepEqual([shown.values.reviewed, shown.values.target], ['2026-10-04', '2026-12-01']);
}));
