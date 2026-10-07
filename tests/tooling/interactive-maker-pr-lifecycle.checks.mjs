import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { createWorkspace, planThenApply, readyFragment } from '../support/increment-workspace.mjs';
import { createFakeHostingRemote } from '../support/fake-hosting-remote.mjs';
import { exitCode } from '../../src/cli/adapters/framework-cli.ts';
import { createGitHubRemote } from '../../src/cli/adapters/increments/github-remote.ts';
import { createAzureRemote } from '../../src/cli/adapters/increments/azure-remote.ts';
import { readFileSync } from 'node:fs';

const applied = r => assert.equal(r.status, 'applied', JSON.stringify(r));
const fail = (r, code) => { assert.equal(r.status, 'failed', JSON.stringify(r)); assert.equal(r.diagnostics[0].code, code, JSON.stringify(r)); return r; };
const record = 'docs/pull-requests/delivery-kickoff.md';
async function published(body) {
  const ws = createWorkspace({ delivery: true, origin: true }), fake = createFakeHostingRemote();
  ws.services.remote = () => fake.remote;
  ws.git('config', 'user.name', 'Iteration Test'); ws.git('config', 'user.email', 'iteration@example.invalid');
  try {
    ws.write('meeting.md', readyFragment);
    applied(await planThenApply(ws, 'increment plan', ['delivery'], { owner: 'Luis', input: 'meeting.md' }));
    applied(await planThenApply(ws, 'increment commit', ['delivery'], { branch: true }));
    applied(await planThenApply(ws, 'pr publish', ['delivery-kickoff']));
    fake.pulls.get(1).headCommit = ws.git('rev-parse', 'HEAD');
    await body(ws, fake);
  } finally { ws.remove(); }
}
async function finish(ws, fake) {
  for (const id of ['AC-1', 'AC-2']) {
    ws.write(`tests/acceptance/delivery/${id.toLowerCase()}.checks.mjs`, `// ${id}\nimport assert from 'node:assert/strict';\nimport { test } from 'node:test';\ntest('sample delivery', () => assert.equal(typeof process.version, 'string'));\n`);
    applied(await planThenApply(ws, 'increment ac set', ['delivery', id], { status: 'done' }));
  }
  applied(await planThenApply(ws, 'issue status', ['delivery', 'In progress']));
  applied(await planThenApply(ws, 'issue status', ['delivery', 'Done']));
  // Completion evaluates real delivery rules; it is never replaced by a gate stub.
  applied(await planThenApply(ws, 'increment complete', ['delivery']));
  applied(await planThenApply(ws, 'increment present', ['delivery']));
  ws.git('add', '-A'); ws.git('commit', '-m', 'Finish iteration');
  fake.pulls.get(1).headCommit = ws.git('rev-parse', 'HEAD');
}

test('close is a read-only preview, then a verified remote close cancels the kickoff and preserves the sync baseline', () => published(async (ws, fake) => {
  const syncPath = '.workbench/pull-requests/delivery-kickoff.sync.json', syncBefore = ws.read(syncPath);
  const preview = await ws.run('pr close', ['delivery-kickoff']);
  assert.equal(preview.status, 'planned', JSON.stringify(preview)); assert.equal(fake.pulls.get(1).state, 'draft');
  applied(await ws.run('pr close', ['delivery-kickoff'], { apply: preview.data.planHash }));
  assert.equal(fake.pulls.get(1).state, 'closed'); assert.match(ws.read(record), /^status: Closed$/m);
  assert.match(ws.read('docs/increments/delivery.md'), /^status: Cancelled$/m);
  assert.equal(ws.read(syncPath), syncBefore);
}));

test('moving the remote source commit invalidates an approved close even when the body is unchanged', () => published(async (ws, fake) => {
  const preview = await ws.run('pr close', ['delivery-kickoff']);
  fake.pulls.get(1).headCommit = 'f'.repeat(40);
  fail(await ws.run('pr close', ['delivery-kickoff'], { apply: preview.data.planHash }), 'PLAN_STALE');
  assert.equal(fake.calls.filter(c => c[0] === 'transition').length, 0);
}));

test('an uncertain close is never retried and a fresh read repairs the local record', () => published(async (ws, fake) => {
  fake.failNext('transition', 'uncertain', { applied: true });
  const failed = fail(await ws.run('pr close', ['delivery-kickoff'], { yes: true }), 'PR_REMOTE_UNCERTAIN');
  assert.equal(exitCode(failed), 2); assert.match(ws.read(record), /^status: Draft$/m);
  assert.equal(fake.calls.filter(c => c[0] === 'transition').length, 1);
  applied(await planThenApply(ws, 'pr close', ['delivery-kickoff']));
  assert.equal(fake.calls.filter(c => c[0] === 'transition').length, 1);
  assert.match(ws.read(record), /^status: Closed$/m);
}));

test('definite refusal and missing readback never record successful closure', () => published(async (ws, fake) => {
  fake.failNext('transition', 'rejected');
  fail(await ws.run('pr close', ['delivery-kickoff'], { yes: true }), 'PR_REMOTE_REJECTED');
  assert.match(ws.read(record), /^status: Draft$/m);
  const transition = fake.remote.transition;
  fake.remote.transition = async (...args) => { await transition(...args); fake.failNext('get', 'timeout'); };
  const failed = fail(await ws.run('pr close', ['delivery-kickoff'], { yes: true }), 'PR_REMOTE_UNCERTAIN');
  assert.equal(exitCode(failed), 2); assert.match(ws.read(record), /^status: Draft$/m);
}));

test('review refuses dirty work and incomplete delivery; draft merge is refused without writing', () => published(async (ws, fake) => {
  fail(await ws.run('pr review', ['delivery-kickoff']), 'PR_REVIEW_CHECKOUT_REQUIRED');
  ws.git('add', '-A'); ws.git('commit', '-m', 'Record draft'); fake.pulls.get(1).headCommit = ws.git('rev-parse', 'HEAD');
  fail(await ws.run('pr review', ['delivery-kickoff']), 'INCREMENT_NOT_DONE');
  fail(await ws.run('pr merge', ['delivery-kickoff']), 'PR_STATUS_TRANSITION');
  assert.equal(fake.calls.filter(c => c[0] === 'transition').length, 0);
}));

test('completed delivery presents its work, enters review and merges the pinned source commit', () => published(async (ws, fake) => {
  await finish(ws, fake);
  const preview = await ws.run('pr review', ['delivery-kickoff']);
  assert.equal(preview.status, 'planned', JSON.stringify(preview));
  applied(await ws.run('pr review', ['delivery-kickoff'], { apply: preview.data.planHash }));
  assert.match(ws.read(record), /^status: Ready$/m); assert.equal(fake.pulls.get(1).state, 'open');
  ws.git('add', '-A'); ws.git('commit', '-m', 'Record review'); fake.pulls.get(1).headCommit = ws.git('rev-parse', 'HEAD');
  applied(await planThenApply(ws, 'pr merge', ['delivery-kickoff']));
  assert.match(ws.read(record), /^status: Merged$/m);
  assert.deepEqual(fake.calls.filter(c => c[0] === 'transition').map(c => c[2]), ['review', 'merge']);
}));

const ok = value => ({ status: 0, stdout: JSON.stringify(value), stderr: '', timedOut: false, overflow: false });
test('GitHub lifecycle uses ready, close and a SHA-pinned merge commit without force options', async () => {
  const calls = [], sha = 'a'.repeat(40);
  const remote = createGitHubRemote({ repository: 'octo/demo', run: async (cmd, args, options) => { calls.push({ cmd, args, body: options.input && JSON.parse(options.input) }); return ok({ merged: true }); } });
  await remote.transition(12, 'review', sha); await remote.transition(12, 'close', sha); await remote.transition(12, 'merge', sha);
  assert.deepEqual(calls[0].args, ['pr', 'ready', '12', '--repo', 'octo/demo']);
  assert.deepEqual(calls[1].body, { state: 'closed' });
  assert.deepEqual(calls[2].body, { sha, merge_method: 'merge' });
  assert.ok(calls[2].args.includes('PUT')); assert.ok(calls[2].args.includes('repos/octo/demo/pulls/12/merge'));
});

test('Azure lifecycle preserves branch policies and pins completion to the reviewed commit', async () => {
  const calls = [], sha = 'b'.repeat(40);
  const remote = createAzureRemote({ organization: 'https://dev.azure.com/contoso', project: 'Demo', repository: 'demo', windows: false,
    run: async (cmd, args) => { const index = args.indexOf('--in-file'); calls.push({ cmd, args, body: index < 0 ? null : JSON.parse(readFileSync(args[index + 1], 'utf8')) }); return ok({}); } });
  await remote.transition(12, 'review', sha); await remote.transition(12, 'close', sha); await remote.transition(12, 'merge', sha);
  assert.ok(calls[0].args.includes('--draft')); assert.ok(calls[0].args.includes('false'));
  assert.ok(calls[1].args.includes('abandoned'));
  assert.deepEqual(calls[2].body, { status: 'completed', lastMergeSourceCommit: { commitId: sha }, completionOptions: { mergeStrategy: 'noFastForward', deleteSourceBranch: false, bypassPolicy: false } });
  assert.ok(calls[2].args.includes('pullRequestId=12'));
});
