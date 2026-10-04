import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { createWorkspace, planThenApply, readyFragment } from '../support/increment-workspace.mjs';
import { editPullRequest, parsePullRequest, renderPullRequest, validatePullRequest } from '../../bin/domain/increments/pull-request-document.ts';

const fails = (outcome, code) => { assert.equal(outcome.status, 'failed', JSON.stringify(outcome)); assert.equal(outcome.diagnostics[0].code, code, outcome.diagnostics[0].message); };
async function withIncrement(options, body) {
  const ws = createWorkspace({ delivery: true, ...options });
  try {
    ws.write('handoff.md', readyFragment);
    const created = await planThenApply(ws, 'increment new', ['delivery'], { owner: 'Luis', input: 'handoff.md' });
    assert.equal(created.status, 'applied', JSON.stringify(created.diagnostics));
    await body(ws);
  } finally { ws.remove(); }
}

test('pr new plans a change pull request stacked on the increment branch and creates its branch from the increment branch', () => withIncrement({}, async ws => {
  ws.git('switch', '-q', 'increment/delivery'); ws.write('work.md', 'increment work\n'); ws.git('add', 'work.md'); ws.git('commit', '-q', '-m', 'increment work'); ws.git('switch', '-q', 'main');
  const preview = await ws.run('pr new', ['delivery'], { title: 'Hosting set command', delivers: 'AC-1' });
  assert.equal(preview.status, 'planned', JSON.stringify(preview.diagnostics));
  assert.deepEqual(preview.data.steps, [{ kind: 'git-branch', name: 'pr/delivery/delivery-1', start: 'increment/delivery', commit: ws.git('rev-parse', 'increment/delivery'), switch: false, fetch: null }]);
  assert.deepEqual(preview.data.summary.acceptance, ['tests/acceptance/delivery/ac-1.checks.mjs']);
  const applied = await ws.run('pr new', ['delivery'], { title: 'Hosting set command', delivers: 'AC-1', apply: preview.data.planHash });
  assert.equal(applied.status, 'applied');
  assert.equal(ws.git('rev-parse', 'pr/delivery/delivery-1'), ws.git('rev-parse', 'increment/delivery'), 'the change branch starts at the increment branch tip');
  const pull = ws.read('docs/pull-requests/delivery-1.md');
  assert.match(pull, /^kind: change\nincrement: delivery\nstatus: New\ndelivers: \[AC-1\]\nhead: "pr\/delivery\/delivery-1"\nbase: increment\/delivery\n---/m);
  assert.match(ws.read('docs/increments/delivery.md'), /^pullRequests: \[delivery-kickoff, delivery-1\]$/m);
  fails(await ws.run('pr new', ['delivery'], { title: 'Unknown', delivers: 'AC-9' }), 'PR_DOCUMENT_INVALID');
  fails(await ws.run('pr new', ['delivery'], { title: 'Duplicate', id: 'delivery-1' }), 'PR_EXISTS');
  fails(await ws.run('pr new', ['missing'], { title: 'x' }), 'INCREMENT_NOT_FOUND');
  fails(await ws.run('pr new', ['delivery'], {}), 'PR_DOCUMENT_INVALID');
}));

test('an explicit base other than the increment branch is a warning; the default base never differs', () => withIncrement({}, async ws => {
  const explicit = await ws.run('pr new', ['delivery'], { title: 'Hotfix', base: 'main', 'no-branch': true });
  assert.equal(explicit.status, 'planned');
  assert.deepEqual(explicit.data.summary.warnings.map(warning => warning.code), ['PR_BASE_MISMATCH']);
  const defaults = await ws.run('pr new', ['delivery'], { title: 'Normal', 'no-branch': true });
  assert.deepEqual(defaults.data.summary.warnings, []); assert.equal(defaults.data.summary.base, 'increment/delivery');
}));

test('a New pull request takes plan edits: title, summary, scope, tasks, documents and notes', () => withIncrement({}, async ws => {
  await planThenApply(ws, 'pr new', ['delivery'], { title: 'Hosting set command', 'no-branch': true });
  const edited = await planThenApply(ws, 'pr edit', ['delivery-1'], { title: 'Hosting set', summary: 'Adds hosting set.' });
  assert.equal(edited.status, 'applied'); assert.deepEqual(edited.data.applied.written.sort(), ['docs/increments/delivery.md', 'docs/pull-requests/delivery-1.md']);
  assert.match(ws.read('docs/increments/delivery.md'), /\[\[docs\/pull-requests\/delivery-1\|Hosting set\]\] · New/, 'the increment list follows the title');
  await planThenApply(ws, 'pr scope add', ['delivery-1', 'The planner']);
  await planThenApply(ws, 'pr out-of-scope add', ['delivery-1', 'Azure']);
  const task = await planThenApply(ws, 'pr task add', ['delivery-1', 'Add the planner']);
  assert.deepEqual(task.data.summary.edits, [{ section: 'Tasks', action: 'add', itemId: 'T-1' }]);
  await planThenApply(ws, 'pr task set', ['delivery-1', 'T-1'], { status: 'done', text: 'Add the hosting planner' });
  await planThenApply(ws, 'pr doc add', ['delivery-1', 'README.md'], { label: 'Read me' });
  ws.write('notes.md', 'Reviewed with the team.\n');
  await planThenApply(ws, 'pr notes', ['delivery-1'], { input: 'notes.md' });
  const pull = ws.read('docs/pull-requests/delivery-1.md');
  assert.match(pull, /^# Hosting set\n\n## Summary\n\nAdds hosting set\.\n\n## Scope\n\n### In scope\n\n- The planner\n\n### Out of scope\n\n- Azure\n\n## Tasks\n\n- \[x\] T-1: Add the hosting planner\n\n## Documents\n\n- \[\[docs\/increments\/delivery\|Increment: Delivery pipeline\]\]\n- \[\[README\|Read me\]\]\n\n## Notes\n\nReviewed with the team\.\n/m);
  fails(await ws.run('pr doc add', ['delivery-1', 'docs/missing.md']), 'WIKILINK_UNRESOLVED');
  fails(await ws.run('pr task set', ['delivery-1', 'T-9'], { status: 'done' }), 'PR_TASK_NOT_FOUND');
  fails(await ws.run('pr task set', ['delivery-1', 'T-1'], {}), 'PR_DOCUMENT_INVALID');
  fails(await ws.run('pr notes', ['delivery-1'], {}), 'PR_DOCUMENT_INVALID');
  fails(await ws.run('pr amend', ['delivery-1', 'Too early']), 'PR_NOT_PUBLISHED');
  fails(await ws.run('pr edit', ['delivery-1'], {}), 'PR_DOCUMENT_INVALID');
  fails(await ws.run('pr show', ['missing']), 'PR_NOT_FOUND');
}));

test('a pull request with a Definition of Done Completion record keeps validating and editing in place', () => {
  const rendered = renderPullRequest({ id: 'x-1', title: 'X', increment: { id: 'x', title: 'X', path: 'docs/increments/x.md' } });
  const text = rendered.replace('## Notes\n\n', '').trimEnd() + '\n\n## Completion record\n\n- Recorded by the Definition of Done.\n';
  assert.deepEqual(validatePullRequest(text).map(problem => problem.message), ['## Notes is missing.']);
  const edited = editPullRequest(editPullRequest(text, { kind: 'notes', body: 'Reviewed.' }).text, { kind: 'task-add', text: 'Ship it' }).text;
  assert.match(edited, /## Tasks\n\n- \[ \] T-1: Ship it\n\n## Documents\n\n.*\n\n## Notes\n\nReviewed\.\n\n## Amendments\n\n.*\n\n## Completion record\n\n- Recorded by the Definition of Done\.\n$/s);
  assert.deepEqual(validatePullRequest(edited), []); assert.equal(parsePullRequest(edited).regions.notes, 'Reviewed.');
});

test('pr status closes and reopens an unpublished pull request; Closed locks edits; the increment list shows the status', () => withIncrement({}, async ws => {
  await planThenApply(ws, 'pr new', ['delivery'], { title: 'Hosting set', 'no-branch': true });
  const closed = await planThenApply(ws, 'pr status', ['delivery-1', 'closed']);
  assert.deepEqual([closed.data.summary.statusBefore, closed.data.summary.statusAfter], ['New', 'Closed']);
  assert.match(ws.read('docs/increments/delivery.md'), /\[\[docs\/pull-requests\/delivery-1\|Hosting set\]\] · Closed/);
  fails(await ws.run('pr task add', ['delivery-1', 'More']), 'PR_TERMINAL');
  fails(await ws.run('pr status', ['delivery-1', 'Merged']), 'PR_STATUS_TRANSITION');
  assert.equal((await planThenApply(ws, 'pr status', ['delivery-1', 'New'])).status, 'applied');
}));

test('pr issue add links both documents; issue commands create, edit, reference criteria and move status', () => withIncrement({}, async ws => {
  await planThenApply(ws, 'pr new', ['delivery'], { title: 'Hosting set', 'no-branch': true });
  const issue = await planThenApply(ws, 'issue new', ['delivery'], { title: 'Publish command' });
  assert.equal(issue.status, 'applied'); assert.equal(issue.data.summary.document.path, 'docs/issues/delivery-1.md');
  assert.match(ws.read('docs/increments/delivery.md'), /^issues: \[delivery, delivery-1\]$/m);
  await planThenApply(ws, 'pr issue add', ['delivery-1', 'delivery-1']);
  assert.match(ws.read('docs/pull-requests/delivery-1.md'), /^issues: \[delivery-1\]$/m);
  assert.match(ws.read('docs/issues/delivery-1.md'), /^pullRequests: \[delivery-1\]$/m);
  await planThenApply(ws, 'issue ac add', ['delivery-1', 'AC-2']);
  await planThenApply(ws, 'issue ac add', ['delivery-1', 'Errors name the next step']);
  await planThenApply(ws, 'issue edit', ['delivery-1'], { summary: 'The publish command.' });
  const text = ws.read('docs/issues/delivery-1.md');
  assert.match(text, /## Summary\n\nThe publish command\.\n\n## Acceptance criteria\n\n- \[ \] AC-2: A missing head branch is refused without a push\n- \[ \] IC-1: Errors name the next step\n/);
  fails(await ws.run('issue ac add', ['delivery-1', 'AC-9']), 'ISSUE_CRITERION_NOT_FOUND');
  fails(await ws.run('issue status', ['delivery-1', 'Done']), 'ISSUE_STATUS_TRANSITION');
  await planThenApply(ws, 'issue status', ['delivery-1', 'in-progress']);
  await planThenApply(ws, 'issue ac set', ['delivery-1', 'AC-2'], { status: 'done' });
  await planThenApply(ws, 'issue ac set', ['delivery-1', 'IC-1'], { status: 'done' });
  const done = await planThenApply(ws, 'issue status', ['delivery-1', 'Done']);
  assert.deepEqual([done.data.summary.statusBefore, done.data.summary.statusAfter], ['In progress', 'Done']);
  assert.match(ws.read('docs/increments/delivery.md'), /\[\[docs\/issues\/delivery-1\|Publish command\]\] · Done/);
  fails(await ws.run('issue edit', ['delivery-1'], { title: 'Locked' }), 'ISSUE_LOCKED');
  fails(await ws.run('issue new', ['delivery'], { id: 'delivery-1' }), 'ISSUE_EXISTS');
  fails(await ws.run('issue show', ['nope']), 'ISSUE_NOT_FOUND');
}));

test('list, show and validate return the documented JSON shapes and never write', () => withIncrement({}, async ws => {
  await planThenApply(ws, 'pr new', ['delivery'], { title: 'Hosting set', 'no-branch': true });
  await planThenApply(ws, 'pr task add', ['delivery-1', 'First task']);
  const list = await ws.run('increment list', [], { status: 'new' });
  assert.equal(list.status, 'ok');
  assert.deepEqual(Object.keys(list.data), ['folder', 'increments', 'drift']);
  const [entry] = list.data.increments;
  assert.deepEqual(Object.keys(entry), ['id', 'title', 'status', 'size', 'owner', 'path', 'branch', 'pullRequests', 'issues', 'problems']);
  assert.deepEqual(entry.pullRequests.map(pull => [pull.id, pull.kind, pull.status, pull.head, pull.base]),
    [['delivery-1', 'change', 'New', 'pr/delivery/delivery-1', 'increment/delivery'], ['delivery-kickoff', 'kickoff', 'New', 'increment/delivery', 'main']]);
  assert.deepEqual((await ws.run('increment list', [], { status: 'Done' })).data.increments, []);
  const show = await ws.run('increment show', ['delivery']);
  assert.deepEqual(Object.keys(show.data), ['increment', 'validation', 'readiness', 'transitions', 'next']);
  assert.deepEqual(show.data.transitions, ['Refining', 'Ready', 'Cancelled']); assert.equal(show.data.readiness, true);
  assert.deepEqual(show.data.increment.acceptance.map(item => [item.id, item.checked, item.evidence]), [['AC-1', false, ['tests/acceptance/delivery/ac-1.checks.mjs']], ['AC-2', false, ['tests/acceptance/delivery/ac-2.checks.mjs']]]);
  const pulls = await ws.run('pr list', [], { increment: 'delivery' });
  assert.deepEqual(pulls.data.pullRequests.find(pull => pull.id === 'delivery-1').tasks, { total: 1, done: 0 });
  const pull = await ws.run('pr show', ['delivery-1']);
  assert.equal(pull.data.remote, 'not-contacted'); assert.equal(pull.data.next, 'node bin/app pr publish delivery-1 --dry-run');
  const issues = await ws.run('issue list', [], { increment: 'delivery' });
  assert.deepEqual(issues.data.issues.map(issue => issue.id), ['delivery']);
  assert.equal((await ws.run('issue show', ['delivery'])).data.issue.increment, 'delivery');
  const valid = await ws.run('pr validate');
  assert.equal(valid.status, 'ok'); assert.equal(valid.data.problems, 0);
  ws.write('docs/pull-requests/delivery-1.md', ws.read('docs/pull-requests/delivery-1.md').replace('## Notes', '## Notes\n\nSee [[docs/missing]].'));
  const broken = await ws.run('pr validate', ['delivery-1']);
  assert.equal(broken.status, 'blocked'); assert.equal(broken.diagnostics[0].code, 'WIKILINK_UNRESOLVED');
  assert.equal((await ws.run('increment validate', ['delivery'])).status, 'blocked');
}));
