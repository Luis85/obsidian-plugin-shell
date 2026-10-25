// Increment: [[docs/increments/publish-stale-hold]]
// AC-1: Given a release head with a green "Release result" and a failed "CI result" from a `pull_request` run of `ci.yml`, Publish plans a pending `requalify` step before `merge`, executes it by re-running that run's failed jobs, waits until the run completes successfully and then merges, tags and publishes; with no such failure the step is already done and Publish makes no re-run or run-status call.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { head, addStaleHold, version } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

const rerun = 'POST /actions/runs/700/rerun-failed-jobs';

test('[AC-1] a stale CI result hold is re-run after ready and before the merge, then the release is published', async t => {
  const cli = await publishCli(t, state => addStaleHold(state));
  const plan = cli.run();
  assert.equal(plan.status, 0, plan.stderr);
  assert.deepEqual(plan.output.steps.map(step => `${step.id}:${step.status}`).slice(0, 3), ['ready:pending', 'requalify:pending', 'merge:pending']);
  const result = cli.run('--execute');
  assert.equal(result.status, 0, result.stderr); assert.equal(result.output.status, 'published');
  const remote = await cli.state();
  assert.deepEqual(remote.writes.slice(0, 3), ['pr ready', rerun, 'PUT /pulls/12/merge']);
  assert.equal(remote.refs[`tags/${version}`], head);
});

test('[AC-1] without a stale hold the step is done and no re-run or run lookup happens', async t => {
  const cli = await publishCli(t);
  const result = cli.run('--execute');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.output.steps.find(step => step.id === 'requalify').status, 'done');
  const { calls } = await cli.state();
  const holdCalls = calls.filter(call => call === 'GET /actions/runs' || /^GET \/actions\/runs\/\d+$/.test(call) || call.endsWith('/rerun-failed-jobs'));
  assert.deepEqual(holdCalls, []);
});
