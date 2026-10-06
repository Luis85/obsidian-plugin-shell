// The human views render the real results of the increment flow (scratch git repository, real operations, the in-memory
// hosting platform): new, check, status Ready, publish preview and apply, a sync conflict and an uncertain write.
import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { createWorkspace, planThenApply, readyFragment } from '../../../tests/support/increment-workspace.mjs';
import { createFakeHostingRemote } from './support/fake-hosting-remote.mjs';
import { renderHuman } from '../presentation/terminal/terminal-render.ts';

const plain = { color: false, unicode: false };
const human = result => renderHuman(result, plain);
const has = (text, parts) => { for (const part of parts) assert.ok(text.includes(part), `${part}\n--- in ---\n${text}`); };

test('the increment flow renders readable views from real results, from the kick-off to a sync conflict', async () => {
  const ws = createWorkspace({ delivery: true, origin: true }), fake = createFakeHostingRemote({ branches: ['main'] });
  ws.services.remote = () => fake.remote;
  try {
    const created = await ws.run('increment new', ['delivery'], { title: 'Delivery pipeline', owner: 'Luis' });
    has(human(created).text, ['increment new: planned', 'create  docs/pull-requests/delivery-kickoff.md', 'Document     increment delivery', 'Status       New (new document)',
      'Creates      increment docs/increments/delivery.md; pullRequest docs/pull-requests/delivery-kickoff.md; issue docs/issues/delivery.md; 2 acceptance test stubs',
      'Branch step  create increment/delivery from origin/main at']);
    assert.equal((await ws.run('increment new', ['delivery'], { title: 'Delivery pipeline', owner: 'Luis', apply: created.data.planHash })).status, 'applied');
    const notReady = await ws.run('increment check', ['delivery']);
    assert.equal(notReady.status, 'blocked');
    const brief = human(notReady);
    assert.equal(brief.diagnosticsShown, true);
    has(brief.text, ['Gate     Definition of Ready', 'Result   not passed (not-ready)', '[FAIL] DOR-04  No placeholders', 'fix: ', 'Refinement brief', 'Next: fix the failing rules']);
    for (const diagnostic of notReady.diagnostics) assert.ok(brief.text.includes(diagnostic.message.split(':')[0]), `the view names ${diagnostic.message}`);
    ws.write('handoff.md', readyFragment);
    assert.equal((await planThenApply(ws, 'increment edit', ['delivery'], { input: 'handoff.md' })).status, 'applied');
    has(human(await ws.run('increment check', ['delivery'])).text, ['Result   passed (ready)', 'Next: node bin/app increment status delivery Ready --dry-run']);
    assert.equal((await planThenApply(ws, 'increment status', ['delivery', 'Ready'])).status, 'applied');
    has(human(await ws.run('increment show', ['delivery'])).text, ['Delivery pipeline (delivery)', 'Status       Ready; can move to', 'Branch       increment/delivery → main',
      'delivery-kickoff  kickoff  New     increment/delivery → main  -']);

    const preview = await ws.run('pr publish', ['delivery-kickoff']);
    has(human(preview).text, ['pr publish: planned', 'Platform      github octo/demo', 'Head branch   increment/delivery is not on the remote; apply pushes it (git push -u origin increment/delivery)',
      'Steps         push-head → create → readback → record', 'of 65536 characters', 'Increment     Ready → In progress', `--apply ${preview.data.planHash}`]);
    const applied = await ws.run('pr publish', ['delivery-kickoff'], { apply: preview.data.planHash });
    has(human(applied).text, ['pr publish: applied', 'Published     #1 Draft https://github.com/octo/demo/pull/1; head pushed', 'Local records written', 'Next: node bin/app pr sync delivery-kickoff']);
    has(human(await ws.run('pr list')).text, ['delivery-kickoff  kickoff  Draft   delivery   increment/delivery → main  0/2    #1 https://github.com/octo/demo/pull/1']);
    has(human(await ws.run('pr sync', ['delivery-kickoff'])).text, ['pr sync: unchanged', 'Nothing to sync']);

    fake.editBody(1, body => body.replace('T-2: Review', 'T-2: Remote review'));
    await planThenApply(ws, 'pr task set', ['delivery-kickoff', 'T-2'], { text: 'Local review of the stubs' });
    const blocked = await ws.run('pr sync', ['delivery-kickoff']);
    assert.equal(blocked.status, 'blocked');
    has(human(blocked).text, ['Conflicts (1)', '[FAIL] task:T-2:text', 'local:  Local review of the stubs', 'remote: Remote review', 'Next: node bin/app pr sync delivery-kickoff --prefer local|remote']);

    fake.failNext('update', 'uncertain', { applied: true });
    const lost = await ws.run('pr sync', ['delivery-kickoff'], { prefer: 'local', yes: true });
    assert.equal(lost.data.uncertain, true, JSON.stringify(lost));
    has(human(lost).text, ['pr sync: failed', 'Outcome    uncertain at step update', 'Exit code  2 (nothing was retried)']);
  } finally { ws.remove(); }
});
