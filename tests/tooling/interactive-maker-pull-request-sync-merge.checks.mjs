const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { renderManagedBlock } from '../../bin/domain/increments/remote-body.ts';
import { canonicalWikilinks } from '../../bin/domain/increments/remote-links.ts';
import { createSyncRecord } from '../../bin/domain/increments/sync-record.ts';
import { syncPullRequest } from '../../bin/domain/increments/sync-merge.ts';
import { samplePullRequestView, sha256 } from '../support/fake-hosting-remote.mjs';

const links = { platform: 'github', web: 'https://github.com/octo/demo', ref: 'feature/hosting-set' };
const hashing = { hash: sha256 };
const clone = value => structuredClone(value);
function record(view, body, state = 'Draft') {
  return createSyncRecord({ view, state, platform: 'github', repository: 'octo/demo', number: 7, remoteRevision: 'rev', body, links, syncedAt: '2026-10-05T08:00:00Z' }, hashing);
}
/** A freshly published pull request: local view, base record and remote snapshot agree. */
function published(view = samplePullRequestView()) {
  const body = renderManagedBlock(view, { links });
  return { local: clone(view), base: record(view, body), remote: { title: view.title, body, state: 'draft', head: view.head, base: view.base } };
}
function sync(state, extra = {}) {
  return syncPullRequest({ local: state.local, localStatus: state.localStatus ?? 'Draft', record: state.base, remote: state.remote, platform: 'github',
    body: { links }, hashing, today: '2026-10-08', ...extra });
}
/** Writes the patch to the "remote", records the result and proves the next sync is a no-op. */
function settleAndResync(state, outcome) {
  const remote = { ...state.remote, title: outcome.remotePatch?.title ?? state.remote.title, body: outcome.remotePatch?.body ?? state.remote.body };
  const next = { local: outcome.view, localStatus: outcome.localStatus, remote, base: record(outcome.view, remote.body, outcome.localStatus) };
  const again = sync(next);
  assert.equal(again.status, 'unchanged', JSON.stringify(again.conflicts));
  assert.equal(again.remotePatch, null); assert.equal(again.localChanged, false);
  return next;
}
const edit = (state, from, to) => { state.remote.body = state.remote.body.replace(from, to); };
const keys = outcome => outcome.conflicts.map(conflict => [conflict.key, conflict.code]);

test('an unchanged pull request syncs as a no-op with zero planned writes', () => {
  const outcome = sync(published());
  assert.equal(outcome.status, 'unchanged'); assert.equal(outcome.remotePatch, null); assert.equal(outcome.localChanged, false);
  assert.deepEqual(outcome.conflicts, []); assert.deepEqual(outcome.warnings, []);
  assert.equal(outcome.report.title, 'unchanged'); assert.equal(outcome.unmanagedChars, 0);
});

test('local-only task changes are pushed: ticks, text edits and new tasks; a second sync is a no-op', () => {
  const state = published();
  state.local.tasks[0].done = true;
  state.local.tasks[1].text = 'Document the hosting platforms page';
  state.local.tasks.push({ id: 'T-3', text: 'Add tests', done: false });
  state.local.amendments.push({ id: 'A-2', date: '2026-10-08', markdown: 'Added tests.' });
  const outcome = sync(state);
  assert.equal(outcome.status, 'changed'); assert.equal(outcome.localChanged, false);
  assert.deepEqual(outcome.report.tasks, { pulled: [], pushed: ['T-1', 'T-2', 'T-3'], imported: [], restored: [], removed: [] });
  assert.deepEqual(outcome.report.amendments.pushed, ['A-2']);
  assert.equal(outcome.remotePatch.title, undefined);
  assert.ok(outcome.remotePatch.body.includes('- [x] T-1: Add the hosting set planner\n- [x] T-2: Document the hosting platforms page\n- [ ] T-3: Add tests'));
  assert.ok(outcome.remotePatch.body.includes('### A-2 · 2026-10-08\n\nAdded tests.'));
  settleAndResync(state, outcome);
});

test('remote-only edits are pulled: title, summary, ticks, id-less tasks and amendments get new ids and are pushed back', () => {
  const state = published();
  state.remote.title = 'Hosting set command (rev 2)';
  edit(state, 'Adds `hosting set`;', 'Adds the `hosting set` command;');
  edit(state, '- [x] T-2:', '- [ ] T-2:');
  edit(state, '- [ ] T-1: Add the hosting set planner', '- [ ] T-1: Add the hosting set planner\n- [ ] Write the migration note');
  edit(state, 'Split the docs task.', 'Split the docs task in two.');
  edit(state, 'Smaller diff.', 'Smaller diff.\n\n### 2026-10-07\n\nReviewer follow-up.');
  const outcome = sync(state);
  assert.equal(outcome.status, 'changed'); assert.equal(outcome.localChanged, true);
  assert.equal(outcome.view.title, 'Hosting set command (rev 2)'); assert.equal(outcome.report.title, 'pull');
  assert.equal(outcome.report.regions.summary, 'pull'); assert.match(outcome.view.summary, /^Adds the `hosting set` command;/);
  assert.deepEqual(outcome.view.tasks.map(task => [task.id, task.done]), [['T-1', false], ['T-2', false], ['T-3', false]]);
  assert.deepEqual(outcome.report.tasks, { pulled: ['T-2'], pushed: [], imported: ['T-3'], restored: [], removed: [] });
  assert.deepEqual(outcome.view.amendments.map(entry => [entry.id, entry.date, entry.markdown.split('\n')[0]]),
    [['A-1', '2026-10-05', 'Split the docs task in two.'], ['A-2', '2026-10-07', 'Reviewer follow-up.']]);
  assert.deepEqual([outcome.report.amendments.pulled, outcome.report.amendments.imported], [['A-1'], ['A-2']]);
  assert.ok(outcome.remotePatch.body.includes('- [ ] T-3: Write the migration note'), 'imported tasks are pushed back with their id');
  assert.equal(outcome.remotePatch.title, undefined, 'the remote title already matches');
  settleAndResync(state, outcome);
});

test('the same change on both sides is no conflict and needs no write', () => {
  const state = published();
  state.local.tasks[0].done = true; edit(state, '- [ ] T-1:', '- [x] T-1:');
  state.local.summary = 'Same new summary.'; edit(state, /Adds `hosting set`;[^\n]*/, 'Same new summary.');
  state.local.tasks.push({ id: 'T-3', text: 'Twin', done: false }); edit(state, '- [x] T-2:', '- [ ] T-3: Twin\n- [x] T-2:');
  const outcome = sync(state);
  assert.deepEqual(outcome.conflicts, []); assert.equal(outcome.report.regions.summary, 'unchanged');
  assert.deepEqual(outcome.view.tasks.map(task => task.id), ['T-1', 'T-2', 'T-3']);
});

test('different changes on both sides conflict per field and per task until --prefer or a resolution decides', () => {
  const state = published();
  state.local.tasks[0].text = 'Local wording'; edit(state, 'T-1: Add the hosting set planner', 'T-1: Remote wording');
  state.local.summary = 'Local summary.'; edit(state, /Adds `hosting set`;[^\n]*/, 'Remote summary.');
  state.local.tasks.push({ id: 'T-3', text: 'Local T-3', done: false }); edit(state, '- [x] T-2:', '- [ ] T-3: Remote T-3\n- [x] T-2:');
  const blocked = sync(state);
  assert.equal(blocked.status, 'blocked'); assert.equal(blocked.remotePatch, null); assert.deepEqual(blocked.view, state.local);
  assert.deepEqual(keys(blocked), [['region:summary', 'PR_SYNC_CONFLICT'], ['task:T-1:text', 'PR_SYNC_CONFLICT'], ['task:T-3:text', 'PR_SYNC_CONFLICT']]);
  assert.deepEqual(blocked.conflicts[1], { key: 'task:T-1:text', kind: 'both-changed', code: 'PR_SYNC_CONFLICT', local: 'Local wording', remote: 'Remote wording', allowed: ['local', 'remote'] });
  const local = sync(state, { prefer: 'local' });
  assert.equal(local.status, 'changed'); assert.equal(local.view.tasks[0].text, 'Local wording'); assert.equal(local.view.summary, 'Local summary.');
  assert.ok(local.remotePatch.body.includes('T-1: Local wording') && local.remotePatch.body.includes('T-3: Local T-3'));
  const remote = sync(state, { prefer: 'remote' });
  assert.equal(remote.view.tasks[0].text, 'Remote wording'); assert.equal(remote.view.summary, 'Remote summary.'); assert.equal(remote.view.tasks[2].text, 'Remote T-3');
  const mixed = sync(state, { resolutions: { 'region:summary': 'remote', 'task:T-1:text': 'local' } });
  assert.deepEqual(keys(mixed), [['task:T-3:text', 'PR_SYNC_CONFLICT']], 'unresolved keys stay conflicts');
  const resolved = sync(state, { prefer: 'remote', resolutions: { 'task:T-1:text': 'local' } });
  assert.deepEqual([resolved.view.tasks[0].text, resolved.view.summary], ['Local wording', 'Remote summary.'], 'a resolution beats --prefer');
  settleAndResync(state, resolved);
});

test('a hand edit of a locked region is refused; only the remote text can restore it', () => {
  const state = published();
  state.local.summary = 'Edited after publish.'; state.local.title = 'Renamed locally';
  const blocked = sync(state);
  assert.deepEqual(keys(blocked), [['title:local-edit-locked', 'PR_LOCKED_REGION_EDITED'], ['region:summary:local-edit-locked', 'PR_LOCKED_REGION_EDITED']]);
  assert.deepEqual(blocked.conflicts[1].allowed, ['remote']);
  assert.deepEqual(keys(sync(state, { prefer: 'local' })), keys(blocked), '--prefer local cannot push a locked edit');
  const restored = sync(state, { prefer: 'remote' });
  assert.equal(restored.status, 'changed'); assert.equal(restored.view.summary, samplePullRequestView().summary);
  assert.equal(restored.view.title, 'Hosting set command'); assert.equal(restored.remotePatch, null);
  assert.deepEqual(restored.report.regions, { summary: 'pull', scope: 'unchanged', documents: 'unchanged', notes: 'unchanged' });
});

test('new tasks on both sides are kept: local order first, then remote additions in remote order', () => {
  const state = published();
  state.local.tasks.push({ id: 'T-3', text: 'Local addition', done: false });
  edit(state, '- [x] T-2:', '- [ ] Remote one\n- [x] Remote two\n- [x] T-2:');
  const outcome = sync(state);
  assert.deepEqual(outcome.view.tasks.map(task => [task.id, task.text, task.done]), [['T-1', 'Add the hosting set planner', false],
    ['T-2', 'Document [[docs/development/HOSTING-PLATFORMS|Hosting platforms]]', true], ['T-3', 'Local addition', false], ['T-4', 'Remote one', false], ['T-5', 'Remote two', true]]);
  assert.deepEqual([outcome.report.tasks.pushed, outcome.report.tasks.imported], [['T-3'], ['T-4', 'T-5']]);
  settleAndResync(state, outcome);
});

test('a task deleted on one side conflicts: local restores it remotely, remote deletes it locally', () => {
  const state = published();
  edit(state, /- \[x\] T-2:[^\n]*\n?/, '');
  assert.deepEqual(keys(sync(state)), [['task:T-2:deleted-remotely', 'PR_SYNC_CONFLICT']]);
  const restored = sync(state, { prefer: 'local' });
  assert.deepEqual(restored.report.tasks.restored, ['T-2']); assert.ok(restored.remotePatch.body.includes('- [x] T-2:'));
  const removed = sync(state, { prefer: 'remote' });
  assert.deepEqual(removed.view.tasks.map(task => task.id), ['T-1']); assert.deepEqual(removed.report.tasks.removed, ['T-2']);
  settleAndResync(state, removed);
  const hand = published(); hand.local.tasks.pop();
  assert.deepEqual(keys(sync(hand)), [['task:T-2:deleted-locally', 'PR_SYNC_CONFLICT']]);
  assert.deepEqual(sync(hand, { prefer: 'remote' }).view.tasks.map(task => task.id), ['T-1', 'T-2']);
  assert.ok(!sync(hand, { prefer: 'local' }).remotePatch.body.includes('T-2:'));
});

test('an id-less remote line matching a task the remote no longer lists by id keeps that id instead of duplicating it', () => {
  const state = published();
  edit(state, '- [ ] T-1: Add the hosting set planner', '- [x] Add the hosting set planner');
  const outcome = sync(state);
  assert.deepEqual(outcome.view.tasks.map(task => [task.id, task.done]), [['T-1', true], ['T-2', true]]);
  assert.deepEqual(outcome.report.tasks.imported, []);
  const duplicate = published();
  edit(duplicate, '- [x] T-2:', '- [ ] T-1: Copy\n- [x] T-2:');
  const twice = sync(duplicate);
  assert.deepEqual(twice.view.tasks.map(task => [task.id, task.text]).at(-1), ['T-3', 'Copy']);
  assert.deepEqual(twice.warnings.map(warning => warning.code), ['PR_REMOTE_ID_DUPLICATE']);
});

test('amendments merge by id: remote edits are pulled, divergent edits conflict, nothing is lost', () => {
  const state = published();
  state.local.amendments[0].markdown = 'Local amendment text.';
  edit(state, 'Split the docs task.', 'Remote amendment text.');
  assert.deepEqual(keys(sync(state)), [['amendment:A-1:text', 'PR_SYNC_CONFLICT']]);
  assert.equal(sync(state, { prefer: 'remote' }).view.amendments[0].markdown.split('\n')[0], 'Remote amendment text.');
  const locallyGone = published(); locallyGone.local.amendments = [];
  assert.deepEqual(keys(sync(locallyGone)), [['amendment:A-1:deleted-locally', 'PR_SYNC_CONFLICT']]);
});

test('canonical wikilinks keep a basename link from reading as a local edit', () => {
  const view = samplePullRequestView();
  const resolve = target => target === 'HOSTING-PLATFORMS' ? 'docs/development/HOSTING-PLATFORMS.md' : `${target.replace(/\.md$/, '')}.md`;
  const canonical = text => canonicalWikilinks(text, resolve);
  const body = renderManagedBlock(view, { links, resolve });
  const base = createSyncRecord({ view, state: 'Draft', platform: 'github', repository: 'octo/demo', number: 7, remoteRevision: 'rev', body, links, syncedAt: 'now' }, { hash: sha256, canonical });
  const local = clone(view); local.tasks[1].text = 'Document [[HOSTING-PLATFORMS|Hosting platforms]]';
  const outcome = syncPullRequest({ local, localStatus: 'Draft', record: base, remote: { title: view.title, body, state: 'draft', head: view.head, base: view.base },
    platform: 'github', body: { links, resolve }, hashing: { hash: sha256, canonical }, today: '2026-10-08' });
  assert.equal(outcome.status, 'unchanged', JSON.stringify(outcome.report.tasks));
});
