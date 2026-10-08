import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { createWorkspace, planThenApply, readyFragment } from './support/increment-workspace.mjs';
import { parseIncrement } from '../domain/increments/increment-document.ts';
import { parseIssue } from '../domain/increments/issue-document.ts';
import { guidedIncrement } from '../presentation/terminal/increment-terminal.ts';
import { continueIteration } from '../adapters/increments/iteration-terminal-flow.ts';
import { parseCliArguments } from '../adapters/framework/catalog.ts';
import { createFakeHostingRemote } from './support/fake-hosting-remote.mjs';

const fail = (r, code) => { assert.equal(r.status, 'failed', JSON.stringify(r)); assert.equal(r.diagnostics[0].code, code, JSON.stringify(r)); };
const applied = r => assert.equal(r.status, 'applied', JSON.stringify(r));
async function workspace(body, options = {}) {
  const ws = createWorkspace({ delivery: true, ...options });
  ws.git('config', 'user.name', 'Iteration Test'); ws.git('config', 'user.email', 'iteration@example.invalid');
  try { await body(ws); } finally { ws.remove(); }
}
async function plan(ws, id = 'delivery', ready = true) {
  ws.write('meeting.md', ready ? readyFragment : '# Unrefined meeting\n');
  applied(await planThenApply(ws, 'increment plan', [id], { title: id, owner: 'Luis', input: 'meeting.md' }));
}

test('iteration alias and planning interview record scope without offering premature branch creation', async () => {
  assert.equal(parseCliArguments(['iteration', 'plan', 'next', '--title', 'Next']).command, 'increment plan');
  assert.equal(parseCliArguments(['--json', 'iteration', 'list']).command, 'increment list');
  const questions = [], answers = ['Next', 'Luis', 'M', 'optional', ''];
  const request = await guidedIncrement({ command: 'increment plan', args: ['next'], options: {} }, async q => { questions.push(q); return answers.shift(); });
  assert.equal(request.options.title, 'Next'); assert.equal(questions.length, 5);
  assert.ok(questions.every(q => !q.includes('branch')));
  const declined = await guidedIncrement({ command: 'increment commit', args: ['next'], options: {} }, async () => '');
  assert.equal(declined.options['no-branch'], true);
});

test('planning and commitment preview without writes; apply creates a branch and commits only the iteration records', () => workspace(async ws => {
  await plan(ws);
  assert.deepEqual(ws.branches(), ['main']);
  assert.equal(parseIncrement(ws.read('docs/increments/delivery.md')).pullRequests[0], 'delivery-kickoff');
  const before = ws.read('docs/increments/delivery.md');
  const preview = await ws.run('increment commit', ['delivery'], { branch: true });
  assert.equal(preview.status, 'planned', JSON.stringify(preview));
  assert.ok(preview.data.summary.commitPaths.includes('docs/issues/delivery.md'));
  assert.equal(ws.read('docs/increments/delivery.md'), before); assert.deepEqual(ws.branches(), ['main']);
  applied(await ws.run('increment commit', ['delivery'], { branch: true, apply: preview.data.planHash }));
  assert.equal(ws.git('branch', '--show-current'), 'increment/delivery');
  const committed = ws.git('show', 'HEAD:docs/increments/delivery.md');
  assert.match(committed, /^status: Ready$/m); assert.match(committed, /## Iteration commitment/);
  assert.match(ws.git('status', '--porcelain'), /\?\? meeting.md/);
  assert.ok(!ws.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').includes('meeting.md'));
  fail(await ws.run('pr new', ['delivery'], { title: 'Escaped work', base: 'main' }), 'PR_BASE_MISMATCH');
  ws.git('branch', 'unrelated-work', 'main');
  fail(await ws.run('pr new', ['delivery'], { title: 'Wrong ancestry', head: 'unrelated-work' }), 'PR_BRANCH_MISMATCH');
  applied(await planThenApply(ws, 'pr new', ['delivery'], { title: 'Iteration work', switch: true }));
  fail(await ws.run('pr edit', ['delivery-1'], { base: 'main' }), 'PR_BASE_MISMATCH');
  fail(await ws.run('pr edit', ['delivery-1'], { head: 'unrelated-work' }), 'PR_BRANCH_MISMATCH');
  assert.match(ws.read('docs/pull-requests/delivery-1.md'), /^base: increment\/delivery$/m);
}));

test('unresolved scope, missing branch choice and unrelated staged work block commitment', () => workspace(async ws => {
  await plan(ws, 'unready', false);
  fail(await ws.run('increment commit', ['unready'], { branch: true }), 'INCREMENT_NOT_READY');
  await plan(ws);
  fail(await ws.run('increment commit', ['delivery']), 'ITERATION_BRANCH_CHOICE_REQUIRED');
  ws.git('add', 'meeting.md');
  fail(await ws.run('increment commit', ['delivery'], { branch: true }), 'GIT_INDEX_NOT_CLEAN');
  assert.deepEqual(ws.branches(), ['main']);
}));

test('changing a referenced planning record invalidates the reviewed commitment before branching', () => workspace(async ws => {
  await plan(ws);
  const preview = await ws.run('increment commit', ['delivery'], { branch: true });
  ws.write('docs/issues/delivery.md', ws.read('docs/issues/delivery.md') + '\nA new planning decision.\n');
  fail(await ws.run('increment commit', ['delivery'], { branch: true, apply: preview.data.planHash }), 'PLAN_STALE');
  assert.deepEqual(ws.branches(), ['main']);
}));

test('local-only commitment makes no branch and a presentation persists completed evidence and open items', () => workspace(async ws => {
  await plan(ws);
  applied(await planThenApply(ws, 'increment commit', ['delivery'], { 'no-branch': true }));
  assert.deepEqual(ws.branches(), ['main']);
  applied(await planThenApply(ws, 'increment ac set', ['delivery', 'AC-1'], { status: 'done' }));
  const preview = await ws.run('increment present', ['delivery']);
  assert.equal(preview.status, 'planned'); assert.ok(!ws.read('docs/increments/delivery.md').includes('## Iteration review'));
  applied(await ws.run('increment present', ['delivery'], { apply: preview.data.planHash }));
  const text = ws.read('docs/increments/delivery.md');
  assert.match(text, /### Delivered criteria and evidence\n\n- AC-1:/);
  assert.match(text, /### Unfinished criteria\n\n- AC-2:/);
  assert.match(text, /\[\[docs\/issues\/delivery\]\] — New/);
}));

test('carry-over copies open issues with remapped ACs, preserves history and completed issues, and is repeat-safe', () => workspace(async ws => {
  await plan(ws);
  applied(await planThenApply(ws, 'issue ac add', ['delivery', 'AC-2']));
  applied(await planThenApply(ws, 'issue ac add', ['delivery', 'Keep the custom acceptance criterion']));
  const authored = 'Review this together before checking the criteria.\n\n```text\nExample acceptance text stays here.\n```\n';
  ws.write('docs/issues/delivery.md', ws.read('docs/issues/delivery.md').replace('## Acceptance criteria\n', `## Acceptance criteria\n\n${authored}`));
  applied(await planThenApply(ws, 'issue new', ['delivery'], { id: 'finished', title: 'Delivered item' }));
  applied(await planThenApply(ws, 'issue status', ['finished', 'In progress']));
  applied(await planThenApply(ws, 'issue status', ['finished', 'Done']));
  applied(await planThenApply(ws, 'increment status', ['delivery', 'Cancelled']));
  await plan(ws, 'next');
  const finished = ws.read('docs/issues/finished.md'), source = ws.read('docs/increments/delivery.md');
  const preview = await ws.run('increment carry-over', ['delivery', 'next']);
  assert.equal(preview.status, 'planned', JSON.stringify(preview));
  const copied = preview.data.summary.copied;
  assert.equal(copied.length, 1); assert.deepEqual(preview.data.summary.criteria, { 'AC-2': 'AC-3' });
  assert.equal(ws.exists(`docs/issues/${copied[0].to}.md`), false);
  applied(await ws.run('increment carry-over', ['delivery', 'next'], { apply: preview.data.planHash }));
  const item = parseIssue(ws.read(`docs/issues/${copied[0].to}.md`));
  assert.equal(item.increment, 'next'); assert.equal(item.status, 'New'); assert.deepEqual(item.pullRequests, []);
  assert.deepEqual(item.acceptance.map(ac => ac.id), ['AC-3', 'IC-1']);
  assert.ok(ws.read(`docs/issues/${copied[0].to}.md`).includes(authored), 'authored prose and examples survive carry-over');
  assert.match(item.regions.notes, /Carried from \[\[docs\/issues\/delivery\]\]/);
  assert.match(ws.read('docs/issues/delivery.md'), /Carried forward to/);
  assert.equal(ws.read('docs/increments/delivery.md'), source);
  assert.equal(ws.read('docs/issues/finished.md'), finished);
  assert.ok(ws.exists('tests/acceptance/next/ac-3.checks.mjs'));
  assert.ok(parseIncrement(ws.read('docs/increments/next.md')).issues.includes(item.id));
  fail(await ws.run('increment carry-over', ['delivery', 'next']), 'INCREMENT_UNCHANGED');
  assert.equal((await ws.run('increment validate')).status, 'ok');
}));

test('carry-over refuses an active source and a target whose planning has finished', () => workspace(async ws => {
  await plan(ws); await plan(ws, 'next');
  fail(await ws.run('increment carry-over', ['delivery', 'next']), 'ITERATION_NOT_FINISHED');
  applied(await planThenApply(ws, 'increment status', ['next', 'Ready']));
  fail(await ws.run('increment carry-over', ['delivery', 'next']), 'ITERATION_CARRY_OVER_INVALID');
}));

test('configured folders are honored by planning, commitment and presentation', () => workspace(async ws => {
  const config = JSON.parse(ws.read('configs/delivery/delivery.json'));
  config.handoff.glob = 'planning/iterations/*.md'; config.handoff.ignore = ['planning/iterations/README.md'];
  config.pullRequests.glob = 'planning/reviews/*.md'; config.pullRequests.ignore = ['planning/reviews/README.md'];
  config.issues.glob = 'planning/items/*.md'; config.issues.ignore = ['planning/items/README.md'];
  ws.write('configs/delivery/delivery.json', JSON.stringify(config));
  ws.write('configs/user-settings.json', JSON.stringify({ schemaVersion: 1, paths: { increments: 'planning/iterations', pullRequests: 'planning/reviews', issues: 'planning/items' } }));
  await plan(ws);
  applied(await planThenApply(ws, 'increment commit', ['delivery'], { 'no-branch': true }));
  applied(await planThenApply(ws, 'increment present', ['delivery']));
  assert.ok(ws.exists('planning/iterations/delivery.md')); assert.ok(ws.exists('planning/reviews/delivery-kickoff.md')); assert.ok(ws.exists('planning/items/delivery.md'));
  assert.ok(!ws.exists('docs/increments/delivery.md'));
}));

test('after commitment hosting offers a separately approved draft; declining never publishes', () => workspace(async ws => {
  await plan(ws);
  const outcome = await planThenApply(ws, 'increment commit', ['delivery'], { branch: true }); applied(outcome);
  const fake = createFakeHostingRemote(); ws.services.remote = () => fake.remote;
  const request = { command: 'increment commit', args: ['delivery'], options: { branch: true } }, prompts = [];
  const declined = await continueIteration(request, outcome, ws.context, { confirm: async q => { prompts.push(q); return false; } });
  assert.equal(declined, outcome); assert.match(prompts[0], /draft pull request on GitHub/); assert.equal(fake.calls.length, 0);
  const accepted = await continueIteration(request, outcome, ws.context, { confirm: async () => true, render: () => {} });
  applied(accepted); assert.equal(fake.pulls.get(1).state, 'draft');
  assert.match(ws.read('docs/increments/delivery.md'), /https:\/\/github.com\/octo\/demo\/pull\/1/);
}, { origin: true }));


test('a failed Git commit reports saved records and never offers remote publication', () => workspace(async ws => {
  await plan(ws);
  ws.git('config', 'user.name', '');
  const outcome = await planThenApply(ws, 'increment commit', ['delivery'], { branch: true });
  fail(outcome, 'ITERATION_COMMIT_FAILED');
  assert.match(outcome.diagnostics[0].message, /records were saved/);
  assert.equal(ws.git('branch', '--show-current'), 'increment/delivery');
  assert.match(ws.read('docs/increments/delivery.md'), /## Iteration commitment/);
  const continued = await continueIteration({ command: 'increment commit', args: ['delivery'], options: { branch: true } }, outcome, ws.context,
    { confirm: async () => assert.fail('failed commitment cannot offer publication') });
  assert.equal(continued, outcome);
}));
