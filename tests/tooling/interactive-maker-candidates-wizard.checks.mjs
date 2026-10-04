import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { startWizard } from '../../bin/presentation/wizards/registry.ts';
import { Back } from '../../bin/presentation/prompts.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { parseCollectionNote } from '../../bin/adapters/collection-notes.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'candidates-wizard-'));
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
/** `node bin/app candidate new` in a terminal starts exactly this wizard with the command flags. */
const wizard = (session, root, flags = {}) => startWizard(session.ui, 'candidate-new', { root, frameworkRoot, flags: { 'as-of': '2026-10-04', ...flags } });
const cli = (root, ...argv) => execute(parseArguments([...argv, '--as-of', '2026-10-04'], []), { root, frameworkRoot, input: process.stdin });
async function seed(root) {
  const base = { summary: 'Users notice it.', kind: 'feature', status: 'ready', acceptance: ['It works'], sources: ['prototypes/checkout'] };
  for (const value of [{ ...base, title: 'Checkout redesign' }, { ...base, title: 'Fix rounding', kind: 'fix' }, { ...base, title: 'Idea', status: 'proposed', acceptance: [] }]) {
    await writeFile(join(root, 'seed.json'), JSON.stringify(value));
    const plan = await cli(root, 'release-item', 'new', '--input', 'seed.json');
    await cli(root, 'release-item', 'new', '--input', 'seed.json', '--apply', plan.planHash);
  }
}
const readme = 'docs/releases/candidates/1.0.0/README.md';
// version, target date, owner, include ready release items?, release items (numbers), goal
const answers = ['1.0.0', '2026-11-01', 'Alex', 'yes', '1,2', 'Ship the faster checkout.'];

test('candidate new asks the form, offers only ready release items and writes exactly the machine plan after approval', async () => scratch(async root => {
  await seed(root);
  const declined = plain([...answers, '']);
  assert.equal(await wizard(declined, root), 'Nothing was written.\n');
  await assert.rejects(() => readdir(join(root, 'docs/releases/candidates')), /ENOENT/);
  const offered = declined.writes.find(text => text.includes('Ready release items to include'));
  assert.ok(offered.includes('ITEM-0001 — Checkout redesign (feature)') && offered.includes('ITEM-0002 — Fix rounding (fix)') && !offered.includes('ITEM-0003'), 'only ready release items are offered');
  assert.ok(declined.writes.some(text => text.includes('ITEM-0001 → included (docs/releases/items/ITEM-0001-checkout-redesign.md)')), 'the review lists every moved release item');
  assert.ok(declined.questions.includes('Apply this reviewed plan? (y/N): '));
  await writeFile(join(root, 'c.json'), JSON.stringify({ targetDate: '2026-11-01', owner: 'Alex', items: ['ITEM-0001', 'ITEM-0002'], goal: 'Ship the faster checkout.' }));
  const machine = await cli(root, 'candidate', 'new', '--version', '1.0.0', '--input', 'c.json');
  const session = plain([...answers, 'y']);
  assert.equal(await wizard(session, root), `Created release candidate 1.0.0 in ${readme}.\n`);
  assert.equal(session.left(), 0);
  assert.equal(await readFile(join(root, readme), 'utf8'), machine.content, 'the wizard writes the same bytes as the agent command');
  for (const id of ['ITEM-0001-checkout-redesign', 'ITEM-0002-fix-rounding']) {
    const { properties } = parseCollectionNote(await readFile(join(root, `docs/releases/items/${id}.md`), 'utf8'));
    assert.deepEqual([properties.status, properties.candidate], ['included', '1.0.0']);
  }
}));

test('--version skips the version question, a taken version is asked again, and without ready release items nothing is offered', async () => scratch(async root => {
  await assert.rejects(() => wizard(plain([]), root, { version: '1.0' }), /x\.y\.z or x\.y\.z-rc\.N/);
  // No release items exist: the include question is not asked.
  const empty = plain(['', '', '', 'y']);
  assert.equal(await wizard(empty, root, { version: '0.1.0' }), 'Created release candidate 0.1.0 in docs/releases/candidates/0.1.0/README.md.\n');
  assert.ok(!empty.questions.some(text => text.startsWith('Version')) && !empty.writes.some(text => text.includes('Include ready release items now?')));
  const { properties } = parseCollectionNote(await readFile(join(root, 'docs/releases/candidates/0.1.0/README.md'), 'utf8'));
  assert.deepEqual([properties.status, properties.items, properties['target-date']], ['draft', [], undefined]);
  // A taken --version is reported and then asked as a normal question.
  const taken = plain(['', '', '', '0.2.0', '', '', '', 'y']);
  assert.equal(await wizard(taken, root, { version: '0.1.0' }), 'Created release candidate 0.2.0 in docs/releases/candidates/0.2.0/README.md.\n');
  assert.ok(taken.writes.some(text => text.includes('CANDIDATE_EXISTS: Release candidate 0.1.0 already exists')));
  assert.ok(taken.questions.includes('Version (x.y.z or x.y.z-rc.N, such as 1.0.0) [0.1.0]: '));
  // An invalid target date is reported and the form is asked again; Back at the first question cancels quietly.
  const invalid = plain(['0.3.0', 'next week', '', '', '', '2026-12-24', '', '', 'y']);
  assert.match(await wizard(invalid, root), /Created release candidate 0\.3\.0/);
  assert.ok(invalid.writes.some(text => text.includes('targetDate must be a date written as YYYY-MM-DD.')));
  assert.equal(await wizard(plain([BACK]), root), undefined);
  assert.deepEqual((await cli(root, 'candidate', 'list')).candidates.map(item => item.version), ['0.1.0', '0.2.0', '0.3.0']);
}));
