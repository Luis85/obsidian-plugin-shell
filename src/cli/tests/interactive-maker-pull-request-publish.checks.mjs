import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { createWorkspace, planThenApply, readyFragment } from '../../../tests/support/increment-workspace.mjs';
import { createFakeHostingRemote } from './support/fake-hosting-remote.mjs';
import { parseSyncRecord } from '../domain/increments/sync-record.ts';
import { remoteLockPath } from '../adapters/increments/remote-lock.ts';
import { exitCode } from '../adapters/framework-cli.ts';

const fails = (outcome, code) => { assert.equal(outcome.status, 'failed', JSON.stringify(outcome)); assert.equal(outcome.diagnostics[0].code, code, outcome.diagnostics[0].message); return outcome; };
/** A Ready increment with its kick-off pull request, an origin naming octo/demo (pushes go to a local bare repository) and the fake platform. */
async function published(body, { ready = true, origin = true, branches = ['main'] } = {}) {
  const ws = createWorkspace({ delivery: true, origin }), fake = createFakeHostingRemote({ branches });
  ws.services.remote = () => fake.remote;
  try {
    ws.write('handoff.md', readyFragment);
    assert.equal((await planThenApply(ws, 'increment new', ['delivery'], { owner: 'Luis', input: 'handoff.md' })).status, 'applied');
    if (ready) assert.equal((await planThenApply(ws, 'increment status', ['delivery', 'Ready'])).status, 'applied');
    await body(ws, fake);
  } finally { ws.remove(); }
}
const kickoff = 'docs/pull-requests/delivery-kickoff.md', record = '.workbench/pull-requests/delivery-kickoff.sync.json';

test('pr publish previews read-only, then pushes the missing head, creates the draft and records it with the increment In progress', () => published(async (ws, fake) => {
  const preview = await ws.run('pr publish', ['delivery-kickoff']);
  assert.equal(preview.status, 'planned', JSON.stringify(preview.diagnostics));
  assert.equal(fake.writes(), 0); assert.deepEqual(ws.pushed(), ['main']); assert.match(ws.read(kickoff), /^status: New$/m);
  assert.deepEqual(Object.keys(preview.data), ['planHash', 'mode', 'pullRequest', 'remote', 'rendered', 'changes', 'increment', 'warnings', 'push']);
  assert.deepEqual(preview.data.remote.steps, ['push-head', 'create', 'readback', 'record']);
  assert.deepEqual([preview.data.remote.action, preview.data.remote.needsPush, preview.data.push], ['create', true, 'git push -u origin increment/delivery']);
  assert.deepEqual(preview.data.increment, { statusBefore: 'Ready', statusAfter: 'In progress' });
  assert.equal(preview.data.rendered.limit, 65536); assert.ok(preview.data.rendered.bodyChars > 0);
  assert.equal((await ws.run('pr publish', ['delivery-kickoff'])).data.planHash, preview.data.planHash, 'the preview is stable');
  const applied = await ws.run('pr publish', ['delivery-kickoff'], { apply: preview.data.planHash });
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  assert.deepEqual([applied.data.remote.number, applied.data.remote.url, applied.data.remote.state, applied.data.pushed], [1, 'https://github.com/octo/demo/pull/1', 'Draft', true]);
  assert.deepEqual(ws.pushed(), ['increment/delivery', 'main']);
  assert.deepEqual(fake.calls.filter(([method]) => ['create', 'update'].includes(method)).map(([method]) => method), ['create']);
  const pull = ws.read(kickoff);
  assert.match(pull, /^status: Draft\nhead: "increment\/delivery"\nbase: main\nplatform: github\nrepository: "octo\/demo"\nnumber: 1\nurl: "https:\/\/github\.com\/octo\/demo\/pull\/1"\npublishedAt: 2026-10-04T12:00:00Z\nlastSyncedAt: 2026-10-04T12:00:00Z\n---/m);
  assert.match(ws.read('docs/increments/delivery.md'), /^status: In progress$/m);
  assert.match(ws.read('docs/increments/delivery.md'), /Kick-off: Delivery pipeline\]\] · Draft · \[#1\]\(https:\/\/github\.com\/octo\/demo\/pull\/1\)/);
  const synced = parseSyncRecord(ws.read(record));
  assert.deepEqual([synced.number, synced.state, synced.head, synced.base], [1, 'Draft', 'increment/delivery', 'main']);
  assert.match(fake.pulls.get(1).body, /^<!-- wb:pr v1 id=delivery-kickoff increment=delivery kind=kickoff -->\nHandoff: docs\/increments\/delivery\.md\n/);
  fails(await ws.run('pr publish', ['delivery-kickoff']), 'PR_ALREADY_PUBLISHED');
  fails(await ws.run('pr edit', ['delivery-kickoff'], { title: 'Renamed' }), 'PR_LOCKED');
  assert.equal((await planThenApply(ws, 'pr task add', ['delivery-kickoff', 'Review the handoff'])).status, 'applied', 'tasks stay editable after publication');
  assert.equal((await planThenApply(ws, 'pr amend', ['delivery-kickoff', 'Scope narrowed.'])).status, 'applied');
  assert.match(ws.read(kickoff), /### A-1 · 2026-10-04\n\nScope narrowed\.\n/);
}));

test('a head already on the remote needs no push; --no-push refuses a missing head; the remote moving makes the plan stale', () => published(async (ws, fake) => {
  fails(await ws.run('pr publish', ['delivery-kickoff'], { 'no-push': true }), 'PR_HEAD_NOT_PUSHED');
  const preview = await ws.run('pr publish', ['delivery-kickoff']);
  fake.pushBranch('increment/delivery');
  fails(await ws.run('pr publish', ['delivery-kickoff'], { apply: preview.data.planHash }), 'PLAN_STALE');
  assert.equal(fake.writes(), 0);
  const fresh = await ws.run('pr publish', ['delivery-kickoff'], { 'no-push': true });
  assert.deepEqual([fresh.data.remote.needsPush, fresh.data.remote.steps], [false, ['create', 'readback', 'record']]);
  assert.equal((await ws.run('pr publish', ['delivery-kickoff'], { 'no-push': true, yes: true })).status, 'applied');
  assert.deepEqual(ws.pushed(), ['main'], 'nothing was pushed');
}));

test('an uncertain create exits 2 and is never retried; the rerun adopts the pull request by its marker', () => published(async (ws, fake) => {
  fake.failNext('create', 'uncertain', { applied: true });
  const lost = fails(await ws.run('pr publish', ['delivery-kickoff'], { yes: true }), 'PR_REMOTE_UNCERTAIN');
  assert.equal(lost.data.uncertain, true); assert.equal(lost.data.step, 'create'); assert.equal(exitCode(lost), 2);
  assert.equal(fake.calls.filter(([method]) => method === 'create').length, 1); assert.match(ws.read(kickoff), /^status: New$/m);
  const preview = await ws.run('pr publish', ['delivery-kickoff']);
  assert.equal(preview.data.remote.action, 'adopt'); assert.equal(preview.data.remote.existing.number, 1);
  const adopted = await ws.run('pr publish', ['delivery-kickoff'], { apply: preview.data.planHash });
  assert.equal(adopted.status, 'applied'); assert.equal(fake.calls.filter(([method]) => method === 'create').length, 1, 'adopted, not created twice');
  assert.match(ws.read(kickoff), /^number: 1$/m);
}));

test('a read-back mismatch or a local record that fails after the remote write is uncertain (exit 2)', () => published(async (ws, fake) => {
  const get = fake.remote.get;
  fake.remote.get = async number => ({ ...await get(number), title: 'Edited meanwhile' });
  const mismatch = fails(await ws.run('pr publish', ['delivery-kickoff'], { yes: true }), 'PR_READBACK_MISMATCH');
  assert.deepEqual([mismatch.data.uncertain, mismatch.data.step, exitCode(mismatch)], [true, 'readback', 2]);
  fake.remote.get = get;
  const create = fake.remote.create;
  fake.remote.create = async input => { ws.write(kickoff, ws.read(kickoff) + '\nEdited during the write.\n'); return create(input); };
  fake.pulls.clear();
  const local = fails(await ws.run('pr publish', ['delivery-kickoff'], { yes: true }), 'PR_REMOTE_UNCERTAIN');
  assert.deepEqual([local.data.step, exitCode(local)], ['local-record', 2]);
  assert.match(ws.read(kickoff), /^status: New$/m, 'the edited document is not overwritten');
}));

test('publish refuses a held lock, a saved plan, unconfigured hosting and unresolved links', () => published(async (ws) => {
  const lock = remoteLockPath(ws.root, 'delivery-kickoff', ws.services.lockDirectory);
  mkdirSync(lock);
  fails(await ws.run('pr publish', ['delivery-kickoff'], { yes: true }), 'PR_SYNC_LOCKED');
  fails(await ws.run('pr publish', ['delivery-kickoff'], { 'plan-out': 'publish.plan.json' }), 'REMOTE_PLAN_NOT_PORTABLE');
  fails(await ws.run('pr publish', ['delivery-kickoff'], { platform: 'none' }), 'PR_HOSTING_NONE');
  ws.write(kickoff, ws.read(kickoff).replace('## Notes\n', '## Notes\n\nSee [[docs/missing]].\n'));
  fails(await ws.run('pr publish', ['delivery-kickoff']), 'WIKILINK_UNRESOLVED');
  fails(await ws.run('pr sync', ['delivery-kickoff']), 'PR_NOT_PUBLISHED');
}));

test('without a hosting platform or origin publish refuses before contacting anything', () => published(async (ws, fake) => {
  fails(await ws.run('pr publish', ['delivery-kickoff']), 'PR_HOSTING_UNCONFIGURED');
  assert.equal(fake.calls.length, 0);
}, { origin: false }));

test('pr sync pulls remote ticks and new tasks, pushes local ones, blocks on conflicts and is a no-op the second time', () => published(async (ws, fake) => {
  assert.equal((await ws.run('pr publish', ['delivery-kickoff'], { yes: true })).status, 'applied');
  assert.equal((await ws.run('pr sync', ['delivery-kickoff'])).status, 'unchanged');
  const refine = 'T-1: Refine the increment until the Definition of Ready passes.';
  fake.editBody(1, body => body.replace(`- [ ] ${refine}`, `- [x] ${refine}\n- [ ] Added on the platform`));
  await planThenApply(ws, 'pr task add', ['delivery-kickoff', 'Local follow-up']);
  const preview = await ws.run('pr sync', ['delivery-kickoff']);
  assert.equal(preview.status, 'planned'); assert.equal(fake.writes(), 1);
  assert.deepEqual(preview.data.merge.tasks.imported, ['T-4']); assert.deepEqual(preview.data.remoteWrite, { title: false, body: true });
  const applied = await ws.run('pr sync', ['delivery-kickoff'], { apply: preview.data.planHash });
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  assert.match(ws.read(kickoff), /- \[x\] T-1: Refine the increment until the Definition of Ready passes\.\n- \[ \] T-2: .*\n- \[ \] T-3: Local follow-up\n- \[ \] T-4: Added on the platform\n/);
  assert.match(fake.pulls.get(1).body, /- \[ \] T-4: Added on the platform/);
  assert.equal((await ws.run('pr sync', ['delivery-kickoff'])).status, 'unchanged', 'a second sync is a no-op');
  fake.editBody(1, body => body.replace('T-3: Local follow-up', 'T-3: Remote wording'));
  await planThenApply(ws, 'pr task set', ['delivery-kickoff', 'T-3'], { text: 'Local wording' });
  const conflict = await ws.run('pr sync', ['delivery-kickoff'], { yes: true });
  assert.equal(conflict.status, 'blocked'); assert.equal(conflict.diagnostics[0].code, 'PR_SYNC_CONFLICT'); assert.equal(exitCode(conflict), 1);
  assert.deepEqual(conflict.data.conflicts.map(item => item.key), ['task:T-3:text']);
  const resolved = await ws.run('pr sync', ['delivery-kickoff'], { resolutions: '{"task:T-3:text":"remote"}', yes: true });
  assert.equal(resolved.status, 'applied', JSON.stringify(resolved.diagnostics)); assert.match(ws.read(kickoff), /T-3: Remote wording/);
  fake.setState(1, 'merged');
  assert.equal((await ws.run('pr sync', ['delivery-kickoff'], { prefer: 'remote', yes: true })).status, 'applied');
  assert.match(ws.read(kickoff), /^status: Merged$/m); assert.match(ws.read('docs/increments/delivery.md'), /· Merged · \[#1\]/);
  fails(await ws.run('pr task add', ['delivery-kickoff', 'Too late']), 'PR_TERMINAL');
  fails(await ws.run('pr sync', ['delivery-kickoff'], { prefer: 'both' }), 'INVALID_OPTION');
}));
