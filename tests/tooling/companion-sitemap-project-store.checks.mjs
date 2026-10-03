import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JourneyProjectStore, importJourneyProject, projectFilePath } from '../../scripts/companion/journey/project-store.ts';
import { SitemapSession } from '../../scripts/companion/sitemap/session.ts';
import { canonicalKey } from '../../scripts/companion/sitemap/safety.ts';
import { editorBindings } from '../../scripts/companion/sitemap/editor-bindings.ts';
import { journeyVaultFiles } from '../../templates/companion/runtime/journey-vault.ts';
const seed = await readFile(new URL('../../docs/concepts/companion/starters/quick-capture.companion.json', import.meta.url), 'utf8');
function fixture(t) {
  let raw = seed, writes = 0, outcome = null, release = null;
  const port = { async read() { return raw; }, async create(_path, content) {
    if (raw !== null) return { status: 'conflict' }; raw = content; writes++; return { status: 'committed', content };
  }, async replace(_path, expected, content) {
    if (release) await new Promise(resolve => { release.resolve = resolve; });
    if (outcome) return outcome;
    if (expected !== raw) return { status: 'conflict' };
    raw = content; writes++; return { status: 'committed', content };
  } };
  const owner = new JourneyProjectStore(port); t.after(() => owner.dispose());
  return { owner, port, raw: () => raw, writes: () => writes, external: value => { raw = value; },
    fail: value => { outcome = value; }, hold: () => { release = {}; return release; } };
}
async function session(f) { const document = f.owner.connect('project.companion.json'), session = new SitemapSession(document); await session.load(); return { document, session }; }
function rename(session, label) { return session.plan({ type: 'rename', surface: session.snapshot().design.nodes[0].id, label }); }
test('native editor saves the entire project, reopens and exports unchanged sibling subsystems', async t => {
  const f = fixture(t), first = await session(f), original = importJourneyProject(seed);
  const result = await first.session.apply(rename(first.session, 'Native edited project'));
  assert.equal(result.status, 'committed'); assert.equal(f.writes(), 1);
  const expected = structuredClone(original); expected.design.nodes[0].label = 'Native edited project';
  assert.deepEqual(JSON.parse(f.raw()), expected);
  first.session.dispose(); first.document.dispose();
  const reopened = await session(f); assert.deepEqual(JSON.parse(reopened.document.export()), expected);
});
test('separate leaves reject stale writes without overwriting the first writer', async t => {
  const f = fixture(t), a = await session(f), b = await session(f);
  const old = rename(b.session, 'Stale'); await a.session.apply(rename(a.session, 'Current'));
  assert.equal((await b.session.apply(old)).status, 'conflict'); assert.equal(f.writes(), 1);
  assert.equal(JSON.parse(f.raw()).design.nodes[0].label, 'Current');
  assert.equal(b.session.state().requiresReload, true);
});
test('exact-byte changes outside the runtime reject save even when canonical JSON is identical', async t => {
  const f = fixture(t), a = await session(f); f.external(seed + '\n');
  assert.equal((await a.session.apply(rename(a.session, 'No'))).status, 'conflict'); assert.equal(f.writes(), 0);
});
test('uncertain writes block all leaves until explicit inspected-file recovery', async t => {
  const f = fixture(t), a = await session(f), b = await session(f);
  f.fail({ status: 'failed', certainty: 'unknown' });
  assert.equal((await a.session.apply(rename(a.session, 'Unknown'))).status, 'uncertain');
  f.fail(null); assert.equal((await b.session.apply(rename(b.session, 'Blocked'))).status, 'failed');
  assert.equal((await a.document.read()).writable, false);
  await a.document.recover(); await a.session.load();
  assert.equal((await a.session.apply(rename(a.session, 'Recovered'))).status, 'committed');
});
test('invalid or future stored data remains untouched and cannot restore write authority', async t => {
  const f = fixture(t), a = await session(f); f.fail({ status: 'failed', certainty: 'unknown' });
  await a.session.apply(rename(a.session, 'Unknown')); f.external('{not json');
  await assert.rejects(a.document.recover()); assert.equal(f.raw(), '{not json'); assert.equal(f.writes(), 0);
  assert.equal(f.owner.writable('project.companion.json'), false);
});
test('create and replace imports are explicit, full-validated and preserve the current file on conflicts', async t => {
  const f = fixture(t), a = await session(f); const next = importJourneyProject(seed); next.project.name = 'Imported';
  assert.equal((await a.document.importProject(JSON.stringify(next), 'create')).status, 'conflict');
  assert.equal((await a.document.importProject(JSON.stringify(next), 'replace')).status, 'committed');
  assert.deepEqual(JSON.parse(f.raw()), next); await assert.rejects(a.document.importProject('{}', 'replace')); assert.equal(f.writes(), 1);
});
test('a missing file is only created through explicit initialization, never through failed opening', async t => {
  const f = fixture(t); f.external(null); const document = f.owner.connect('project.companion.json');
  await assert.rejects(document.read()); assert.equal(f.writes(), 0);
  assert.equal((await document.importProject(seed, 'create')).status, 'committed'); assert.equal(f.writes(), 1);
});
test('closing a leaf while saving retains the committed fact and does not publish into another owner', async t => {
  const f = fixture(t), a = await session(f); let events = 0; const stop = a.document.subscribe(() => events++);
  const held = f.hold(), pending = a.session.apply(rename(a.session, 'Settled'));
  await new Promise(resolve => setImmediate(resolve)); a.session.dispose(); a.document.dispose(); held.resolve();
  const result = await pending; assert.equal(result.status, 'committed'); assert.equal(result.detached, true);
  assert.equal(events, 1); stop(); assert.equal(f.writes(), 1);
});
test('undo and redo persist exact full-project snapshots without identity regeneration', async t => {
  const f = fixture(t), a = await session(f), before = importJourneyProject(seed);
  await a.session.apply(rename(a.session, 'New')); const after = JSON.parse(f.raw());
  await a.session.undo(); assert.deepEqual(JSON.parse(f.raw()), before);
  await a.session.redo(); assert.deepEqual(JSON.parse(f.raw()), after);
});
test('all source paths are bounded visible vault paths, not traversal, hidden data or portable device names', () => {
  for (const path of ['../p.json', '.obsidian/p.json', '/p.json', 'C:/p.json', 'a//p.json', 'a/../p.json', 'CON.json', 'a\\b.json', 'note.md', 'dir./p.json']) assert.throws(() => projectFilePath(path));
  assert.equal(projectFilePath('Plans/My project.companion.json'), 'Plans/My project.companion.json');
});
test('untrusted editor bindings cannot supply code, file permissions, duplicate targets or unknown engines', () => {
  const document = importJourneyProject(seed), page = document.design.nodes.find(node => node.kind === 'page');
  document.design.editors = { schema: 1, bindings: [{ surface: page.id, editor: 'journey-lens' }] };
  assert.deepEqual(editorBindings(document.design), document.design.editors.bindings);
  assert.doesNotThrow(() => importJourneyProject(JSON.stringify(document)));
  for (const change of [{ editor: 'eval' }, { surface: 'missing' }, { file: '/tmp/untrusted' }]) {
    const bad = structuredClone(document); Object.assign(bad.design.editors.bindings[0], change);
    assert.throws(() => importJourneyProject(JSON.stringify(bad)));
  }
  document.design.editors.bindings.push(document.design.editors.bindings[0]); assert.throws(() => editorBindings(document.design));
});
test('native port uses process and compares bytes again inside its callback; renamed files are rejected', async () => {
  let raw = seed, calls = 0, file = { path: 'project.json', stat: { size: seed.length } };
  const vault = { getFileByPath: path => path === file.path ? file : null, read: async () => raw,
    async process(_file, update) { calls++; raw = update(raw); return raw; } };
  const port = journeyVaultFiles(vault);
  assert.equal((await port.replace('project.json', seed + ' ', 'lost')).status, 'conflict'); assert.equal(raw, seed);
  assert.equal((await port.replace('project.json', seed, 'saved')).status, 'committed'); assert.equal(raw, 'saved');
  vault.process = async (_file, update) => { file.path = 'moved.json'; return update(raw); };
  assert.equal((await port.replace('project.json', 'saved', 'lost')).status, 'conflict'); assert.equal(raw, 'saved'); assert.equal(calls, 2);
});
test('native write errors are uncertain, not a successful save or a guessed safe retry', async () => {
  const vault = { getFileByPath: () => ({ path: 'project.json', stat: { size: 3 } }),
    async process() { throw Error('private path'); } };
  assert.deepEqual(await journeyVaultFiles(vault).replace('project.json', 'old', 'new'), { status: 'failed', certainty: 'unknown' });
});
test('stale public revisions and changed before-keys do not even reach a write adapter', async t => {
  const f = fixture(t), a = await session(f), snap = a.session.snapshot();
  for (const request of [{ expectedRevision: 'stale', beforeKey: canonicalKey(snap.design) }, { expectedRevision: snap.revision, beforeKey: 'changed' }]) {
    assert.equal((await a.document.save({ ...request, design: snap.design })).status, 'conflict');
  }
  assert.equal(f.writes(), 0);
});
