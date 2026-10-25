// Increment: [[docs/increments/publish-stale-hold]]
// AC-2: If the re-run completes with any conclusion other than success, Publish stops before merging with exit 1 and `HOLD_RERUN_FAILED`; if it is still running when the wait budget ends, Publish exits 2 (uncertain), and a later Publish waits for the run already in progress instead of requesting another re-run.
// Runs the real publish CLI against a fake GitHub remote (src/cli/tests/support/fake-gh.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishCli } from '../../../src/cli/tests/support/publish-cli-fixture.mjs';
import { addStaleHold } from '../../../src/cli/tests/support/release-publish-fixture.mjs';

const rerun = 'POST /actions/runs/700/rerun-failed-jobs';
const reruns = writes => writes.filter(write => write === rerun).length;

test('[AC-2] a re-run that fails stops before merging with exit 1', async t => {
  const cli = await publishCli(t, state => { addStaleHold(state); state.rerunOutcome = 'failure'; });
  const result = cli.run('--execute');
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.output.error, /^HOLD_RERUN_FAILED: CI run 700 attempt 2 concluded failure/);
  assert.deepEqual((await cli.state()).writes, ['pr ready', rerun]);
});

test('[AC-2] a re-run still running is uncertain; the next publish waits for it instead of re-running', async t => {
  const cli = await publishCli(t, state => { addStaleHold(state); state.rerunOutcome = 'running'; });
  const first = cli.run('--execute');
  assert.equal(first.status, 2, first.stderr);
  assert.deepEqual([first.output.status, first.output.failedStep], ['uncertain', 'requalify']);
  assert.match(first.output.error, /^HOLD_RERUN_TIMEOUT/);
  const waiting = cli.run('--execute');
  assert.equal(waiting.status, 2, waiting.stderr);
  assert.match(waiting.output.steps.find(step => step.id === 'requalify').detail, /^Wait for CI run 700/);
  assert.equal(reruns((await cli.state()).writes), 1, 'no second re-run while one is in progress');
  await cli.update(state => { Object.assign(state.workflowRuns[0], { status: 'completed', conclusion: 'success' }); });
  const done = cli.run('--execute');
  assert.equal(done.status, 0, done.stderr); assert.equal(done.output.status, 'published');
  assert.equal(reruns((await cli.state()).writes), 1);
});
