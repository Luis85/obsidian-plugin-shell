const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { renderManagedBlock } from '../domain/increments/remote-body.ts';
import { createSyncRecord, parseSyncRecord, recordDigest, remoteRevision, serializeSyncRecord, syncRecordPath } from '../domain/increments/sync-record.ts';
import { azureRemoteState, githubRemoteState, isTerminalState, localStatus, statusFromRemote } from '../domain/increments/remote-state.ts';
import { syncPullRequest } from '../domain/increments/sync-merge.ts';
import { samplePullRequestView, sha256 } from './support/fake-hosting-remote.mjs';

const links = { platform: 'github', web: 'https://github.com/octo/demo', ref: 'feature/hosting-set' };
const hashing = { hash: sha256 };
const codeOf = code => error => error.message.startsWith(`${code}:`);
function published(state = 'Draft', remoteState = 'draft') {
  const view = samplePullRequestView(), body = renderManagedBlock(view, { links });
  const base = createSyncRecord({ view, state, platform: 'github', repository: 'octo/demo', number: 7, remoteRevision: 'rev', body, links, syncedAt: '2026-10-05T08:00:00Z' }, hashing);
  return { local: structuredClone(view), localStatus: state, base, remote: { title: view.title, body, state: remoteState, head: view.head, base: view.base } };
}
const sync = (state, extra = {}) => syncPullRequest({ local: state.local, localStatus: state.localStatus, record: state.base, remote: state.remote,
  platform: 'github', body: { links }, hashing, today: '2026-10-08', ...extra });
const keys = outcome => outcome.conflicts.map(conflict => [conflict.key, conflict.code]);

test('the sync record keeps hashes only, serializes stably and refuses corrupt or future records', () => {
  const { base } = published();
  assert.equal(syncRecordPath('delivery-1'), '.workbench/pull-requests/delivery-1.sync.json');
  const text = serializeSyncRecord(base);
  assert.ok(text.endsWith('}\n')); assert.deepEqual(parseSyncRecord(text), base); assert.equal(serializeSyncRecord(parseSyncRecord(text)), text);
  assert.ok(!text.includes('hosting set planner'), 'no document text is copied into the record');
  assert.deepEqual(Object.keys(base.tasks), ['T-1', 'T-2']); assert.deepEqual(base.taskOrder, ['T-1', 'T-2']);
  assert.equal(base.tasks['T-2'].checked, true); assert.match(base.regions.summary, /^[0-9a-f]{64}$/);
  assert.equal(recordDigest(base, sha256), sha256(text));
  const variants = [
    'not json', '[]', JSON.stringify({ ...base, schemaVersion: 2 }), JSON.stringify({ ...base, extra: 1 }), JSON.stringify({ ...base, platform: 'gitlab' }),
    JSON.stringify({ ...base, number: 0 }), JSON.stringify({ ...base, state: 'Open' }), JSON.stringify({ ...base, taskOrder: ['X-1'] }),
    JSON.stringify({ ...base, tasks: { 'T-1': { text: 'h', checked: 'yes' } } }), JSON.stringify({ ...base, amendments: { 'B-1': 'h' } }),
    JSON.stringify({ ...base, regions: { summary: 'h' } }), JSON.stringify({ ...base, title: '' }),
  ];
  for (const variant of variants) assert.throws(() => parseSyncRecord(variant), codeOf('PR_SYNC_RECORD_INVALID'), variant.slice(0, 60));
});

test('remote revisions ignore line-ending differences but change with every canonical field', () => {
  const fields = { title: 'T', body: 'a\nb', state: 'draft', head: 'h', base: 'main' };
  const revision = remoteRevision(fields, sha256);
  assert.equal(remoteRevision({ ...fields, body: 'a\r\nb' }, sha256), revision);
  for (const change of [{ title: 'U' }, { body: 'a' }, { state: 'open' }, { head: 'x' }, { base: 'dev' }]) assert.notEqual(remoteRevision({ ...fields, ...change }, sha256), revision);
});

test('platform states map to local statuses; a reopen is accepted and leaving Merged is reported', () => {
  const github = [[{ state: 'open', draft: true, merged: false }, 'draft'], [{ state: 'open', draft: false, merged: false }, 'open'],
    [{ state: 'closed', draft: false, merged: true }, 'merged'], [{ state: 'closed', draft: true, merged: false }, 'closed'], [{ state: 'locked', draft: false, merged: false }, null]];
  for (const [pull, state] of github) assert.equal(githubRemoteState(pull), state, JSON.stringify(pull));
  const azure = [[{ status: 'active', isDraft: true }, 'draft'], [{ status: 'active', isDraft: false }, 'open'], [{ status: 'completed', isDraft: false }, 'merged'],
    [{ status: 'abandoned', isDraft: true }, 'closed'], [{ status: 'notSet', isDraft: false }, null]];
  for (const [pull, state] of azure) assert.equal(azureRemoteState(pull), state, JSON.stringify(pull));
  assert.deepEqual(['draft', 'open', 'merged', 'closed'].map(localStatus), ['Draft', 'Ready', 'Merged', 'Closed']);
  assert.deepEqual(['draft', 'open', 'merged', 'closed'].map(isTerminalState), [false, false, true, true]);
  assert.deepEqual(statusFromRemote('Closed', 'open', 'Closed'), { before: 'Closed', after: 'Ready', reopened: true, warning: null });
  assert.equal(statusFromRemote('Merged', 'open', 'Merged').warning, 'PR_REMOTE_STATE_REGRESSED');
  assert.equal(statusFromRemote('Ready', 'draft', 'Draft').warning, 'PR_LOCAL_STATUS_OVERWRITTEN');
  assert.equal(statusFromRemote('Draft', 'open', 'Draft').warning, null, 'the CLI never marks ready, but the platform may');
});

test('remote status, head and base are authoritative; the platform marking the draft ready is pulled', () => {
  const state = published();
  state.remote.state = 'open'; state.remote.base = 'develop';
  const outcome = sync(state);
  assert.equal(outcome.status, 'changed'); assert.equal(outcome.localStatus, 'Ready'); assert.equal(outcome.view.base, 'develop');
  assert.deepEqual(outcome.report.status, { before: 'Draft', after: 'Ready' });
  const handChanged = published(); handChanged.localStatus = 'Ready';
  const reverted = sync(handChanged);
  assert.equal(reverted.localStatus, 'Draft'); assert.deepEqual(reverted.warnings.map(warning => warning.code), ['PR_LOCAL_STATUS_OVERWRITTEN']);
});

test('merged and closed pull requests sync pull-only: remote edits arrive, local edits are refused, nothing is written', () => {
  const merged = published('Draft', 'merged');
  merged.remote.body = merged.remote.body.replace('- [ ] T-1:', '- [x] T-1:');
  const pulled = sync(merged);
  assert.equal(pulled.status, 'changed'); assert.equal(pulled.pullOnly, true); assert.equal(pulled.remotePatch, null);
  assert.equal(pulled.localStatus, 'Merged'); assert.equal(pulled.view.tasks[0].done, true);
  const edited = published('Merged', 'merged');
  edited.local.tasks[1].done = false; edited.local.tasks.push({ id: 'T-3', text: 'Too late', done: false });
  const refused = sync(edited);
  assert.deepEqual(keys(refused), [['task:T-2:done:terminal', 'PR_TERMINAL'], ['task:T-3:terminal', 'PR_TERMINAL']]);
  assert.deepEqual(keys(sync(edited, { prefer: 'local' })), keys(refused), 'a terminal pull request never takes a local change');
  const discarded = sync(edited, { prefer: 'remote' });
  assert.equal(discarded.status, 'changed'); assert.equal(discarded.remotePatch, null);
  assert.deepEqual(discarded.view.tasks.map(task => [task.id, task.done]), [['T-1', false], ['T-2', true]]);
  const conflicted = published('Closed', 'closed');
  conflicted.local.summary = 'x';
  assert.deepEqual(keys(sync(conflicted, { prefer: 'local' })), [['region:summary:local-edit-locked', 'PR_LOCKED_REGION_EDITED']]);
  const reopened = published('Closed', 'open');
  assert.equal(sync(reopened).localStatus, 'Ready');
});

test('a missing or foreign managed block blocks the sync until local re-renders it in front of the remaining text', () => {
  const state = published();
  state.remote.body = 'Someone replaced the description.';
  const blocked = sync(state);
  assert.deepEqual(keys(blocked), [['body:markers', 'PR_REMOTE_MARKERS_MISSING']]);
  assert.equal(blocked.conflicts[0].remote, 'no wb:pr marker'); assert.deepEqual(blocked.conflicts[0].allowed, ['local']);
  assert.deepEqual(keys(sync(state, { prefer: 'remote' })), keys(blocked), 'remote cannot resolve missing markers');
  const restored = sync(state, { prefer: 'local' });
  assert.equal(restored.status, 'changed');
  assert.ok(restored.remotePatch.body.startsWith('<!-- wb:pr v1 id=delivery-1 increment=delivery kind=change -->'));
  assert.ok(restored.remotePatch.body.endsWith('<!-- /wb:pr -->\n\nSomeone replaced the description.'));
  const broken = published();
  broken.remote.body = `Intro\n${broken.remote.body.replace('<!-- /wb:tasks -->', '')}\nOutro`;
  const repaired = sync(broken, { resolutions: { 'body:markers': 'local' } });
  assert.ok(repaired.remotePatch.body.startsWith('Intro\n<!-- wb:pr') && repaired.remotePatch.body.endsWith('<!-- /wb:pr -->\nOutro'), 'the broken span is replaced in place');
  const foreign = published();
  foreign.remote.body = foreign.remote.body.replace('id=delivery-1 ', 'id=other-1 ');
  assert.equal(sync(foreign).conflicts[0].remote, 'the managed block belongs to other-1');
});

test('edits to derived regions are discarded with a warning and re-rendered from local', () => {
  const state = published();
  state.remote.body = state.remote.body.replace('- AC-2: apply writes the plan', '- AC-2: apply writes the plan (done)');
  const outcome = sync(state);
  assert.deepEqual(outcome.warnings.map(warning => warning.code), ['PR_REMOTE_DERIVED_EDIT_DISCARDED']);
  assert.ok(outcome.remotePatch.body.includes('- AC-2: apply writes the plan\n'));
  const acceptance = published();
  acceptance.local.acceptance[1].done = true;
  const rerendered = sync(acceptance);
  assert.deepEqual(rerendered.warnings, []); assert.ok(rerendered.remotePatch.body.includes('- AC-2: apply writes the plan (done)'));
});

test('a merged body over the platform limit is refused instead of truncated', () => {
  const state = published();
  state.local.amendments.push({ id: 'A-2', date: '2026-10-08', markdown: 'm'.repeat(9_999) });
  assert.throws(() => syncPullRequest({ local: state.local, localStatus: 'Draft', record: state.base, remote: state.remote, platform: 'azure-devops',
    body: { links }, hashing, today: '2026-10-08' }), codeOf('PR_BODY_TOO_LARGE'));
});
