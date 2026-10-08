// iteration-lifecycle AC-2: hosted lifecycle writes require verified outcomes.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspace, planThenApply } from '../../support/increment-workspace.mjs';
import { createFakeHostingRemote } from '../../support/fake-hosting-remote.mjs';

test('AC-2: uncertain rejection is reported and a fresh remote read recovers without repeating it', async () => {
  const ws = createWorkspace({ delivery: true, origin: true }), fake = createFakeHostingRemote();
  ws.services.remote = () => fake.remote;
  try {
    assert.equal((await planThenApply(ws, 'increment plan', ['delivery'], { title: 'Delivery' })).status, 'applied');
    assert.equal((await planThenApply(ws, 'pr publish', ['delivery-kickoff'])).status, 'applied');
    fake.pulls.get(1).headCommit = ws.git('rev-parse', 'HEAD');
    fake.failNext('transition', 'uncertain', { applied: true });
    const failed = await ws.run('pr close', ['delivery-kickoff'], { yes: true });
    assert.equal(failed.status, 'failed'); assert.equal(failed.data.uncertain, true);
    assert.match(ws.read('docs/pull-requests/delivery-kickoff.md'), /^status: Draft$/m);
    assert.equal((await planThenApply(ws, 'pr close', ['delivery-kickoff'])).status, 'applied');
    assert.equal(fake.calls.filter(call => call[0] === 'transition').length, 1);
    assert.match(ws.read('docs/increments/delivery.md'), /^status: Cancelled$/m);
  } finally { ws.remove(); }
});
