// iteration-lifecycle AC-1: planning remains local until readiness and branch commitment.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkspace, planThenApply, readyFragment } from '../../support/increment-workspace.mjs';

test('AC-1: scoped planning records become a committed iteration branch', async () => {
  const ws = createWorkspace({ delivery: true });
  try {
    ws.git('config', 'user.name', 'Acceptance Test'); ws.git('config', 'user.email', 'acceptance@example.invalid');
    ws.write('meeting.md', readyFragment);
    const planned = await planThenApply(ws, 'increment plan', ['delivery'], { input: 'meeting.md', owner: 'Luis' });
    assert.equal(planned.status, 'applied'); assert.deepEqual(ws.branches(), ['main']);
    const committed = await planThenApply(ws, 'increment commit', ['delivery'], { branch: true });
    assert.equal(committed.status, 'applied', JSON.stringify(committed));
    assert.equal(ws.git('branch', '--show-current'), 'increment/delivery');
    assert.match(ws.git('show', 'HEAD:docs/increments/delivery.md'), /## Iteration commitment/);
    assert.match(ws.git('show', 'HEAD:docs/pull-requests/delivery-kickoff.md'), /^head: "increment\/delivery"$/m);
  } finally { ws.remove(); }
});
