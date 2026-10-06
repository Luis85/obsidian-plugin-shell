import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SitemapSession } from '../../scripts/companion/sitemap/session.ts';
import { canonicalKey } from '../../scripts/companion/sitemap/safety.ts';

function fixture() {
  return { schema: 5, nodes: [
    { id: 'view', kind: 'view', label: 'Workbench', parent: null },
    { id: 'page', kind: 'page', label: 'Page', parent: 'view' },
  ], links: [], notes: ['Preserve'], canvas: { positions: {} } };
}
function host() {
  let current = { revision: '1', writable: true, design: fixture() }, count = 0;
  const port = {
    read: async () => structuredClone(current),
    validate: () => {},
    async save(request) {
      count++;
      if (request.expectedRevision !== current.revision || request.beforeKey !== canonicalKey(current.design))
        return { status: 'conflict' };
      current = { revision: String(Number(current.revision) + 1), writable: true, design: structuredClone(request.design) };
      return { status: 'committed', snapshot: structuredClone(current) };
    },
  };
  return { port, state: () => current, calls: () => count,
    external: () => { current = { ...current, revision: String(Number(current.revision) + 1), design: { ...current.design, notes: ['External edit'] } }; } };
}
const rename = label => ({ type: 'rename', surface: 'page', label });

async function connected(h = host()) { const session = new SitemapSession(h.port); await session.load(); return { h, session }; }

test('session is empty until the canonical host is loaded; reads and results are detached', async () => {
  const h = host(), session = new SitemapSession(h.port);
  assert.equal(session.snapshot(), null);
  assert.equal(session.state().loaded, false);
  assert.deepEqual(await session.load(), { status: 'loaded' });
  const snapshot = session.snapshot(); snapshot.design.nodes[1].label = 'External mutation';
  assert.equal(session.snapshot().design.nodes[1].label, 'Page');
  assert.equal(h.state().design.nodes[1].label, 'Page');
});

test('only a confirmed durable save advances the per-view snapshot and undo history', async () => {
  const { session, h } = await connected();
  const review = session.plan(rename('Edited'));
  assert.equal(h.calls(), 0);
  assert.equal(session.snapshot().design.nodes[1].label, 'Page');
  assert.equal((await session.apply(review)).status, 'committed');
  assert.equal(session.snapshot().design.nodes[1].label, 'Edited');
  assert.equal(h.calls(), 1);
  assert.equal(session.state().canUndo, true);
});

test('full project validation can reject a staged sitemap extension before persistence', async () => {
  const { session, h } = await connected();
  h.port.validate = candidate => { if (candidate.sitemap) throw Error('Full envelope is still v5'); };
  const review = session.plan({ type: 'route', route: { id: 'route', surface: 'page', path: '/page' } });
  const result = await session.apply(review);
  assert.equal(result.status, 'blocked');
  assert.equal(h.calls(), 0);
  assert.equal(session.state().canUndo, false);
  assert.equal(session.snapshot().design.sitemap, undefined);
});

test('known unchanged save failure preserves the previous project and history', async () => {
  const { session, h } = await connected();
  h.port.save = async () => ({ status: 'failed', certainty: 'unchanged' });
  assert.equal((await session.apply(session.plan(rename('Edited')))).status, 'failed');
  assert.equal(session.snapshot().design.nodes[1].label, 'Page');
  assert.equal(session.state().canUndo, false);
  assert.equal(session.state().requiresReload, false);
});

test('uncertain persistence freezes further writes without automatic retry or false rollback', async () => {
  const { session, h } = await connected(); let attempts = 0;
  const review = session.plan(rename('Edited'));
  h.port.save = async () => { attempts++; return { status: 'failed', certainty: 'unknown' }; };
  assert.equal((await session.apply(review)).status, 'uncertain');
  assert.equal((await session.apply(review)).status, 'blocked');
  assert.equal(attempts, 1);
  assert.equal(session.state().requiresReload, true);
  assert.equal(session.state().canUndo, false);
});

test('a thrown persistence error is uncertain and never exposed as raw sensitive error text', async () => {
  const { session, h } = await connected();
  h.port.save = async () => { throw Error('TOKEN AND PRIVATE NOTE CONTENT'); };
  const result = await session.apply(session.plan(rename('Edited')));
  assert.equal(result.status, 'uncertain');
  assert.equal(JSON.stringify(result).includes('TOKEN'), false);
  assert.equal(session.state().requiresReload, true);
});

test('a rejected stale host write does not replace newer canonical state', async () => {
  const { session, h } = await connected(); const review = session.plan(rename('Edited'));
  h.external();
  assert.equal((await session.apply(review)).status, 'conflict');
  assert.equal(h.state().design.nodes[1].label, 'Page');
  assert.deepEqual(h.state().design.notes, ['External edit']);
  assert.equal(session.state().requiresReload, true);
  assert.equal(session.state().canUndo, false);
});

test('explicit reload adopts a settled canonical revision and drops only per-view undo history', async () => {
  const { session, h } = await connected(); await session.apply(session.plan(rename('Edited')));
  h.external();
  assert.equal((await session.load()).status, 'loaded');
  assert.deepEqual(session.snapshot().design.notes, ['External edit']);
  assert.equal(session.state().canUndo, false);
  assert.equal(session.state().requiresReload, false);
});

test('host read or validation failure preserves the previously loaded snapshot', async () => {
  const { session, h } = await connected(); const before = session.snapshot();
  h.port.read = async () => { throw Error('Unavailable'); };
  assert.equal((await session.load()).status, 'failed');
  assert.deepEqual(session.snapshot(), before);
  assert.equal(session.state().requiresReload, true);
});

test('host read-only/uncertain ownership state cannot be bypassed by a session reload', async () => {
  const h = host(); h.port.read = async () => ({ revision: '2', writable: false, design: fixture() });
  const { session } = await connected(h);
  assert.equal(session.state().writable, false);
  assert.equal((await session.apply(session.plan(rename('Edited')))).status, 'blocked');
  assert.equal(h.calls(), 0);
});

test('busy saves refuse duplicate writes and reloads; no queue races canonical state', async () => {
  const { session, h } = await connected(); let settle;
  const original = h.port.save; h.port.save = request => new Promise(resolve => { settle = async () => resolve(await original(request)); });
  const review = session.plan(rename('Edited')), pending = session.apply(review);
  assert.equal(session.state().busy, true);
  assert.equal((await session.apply(review)).status, 'blocked');
  assert.equal((await session.load()).status, 'blocked');
  await settle(); assert.equal((await pending).status, 'committed');
  assert.equal(h.calls(), 1);
});

test('disposal during a write preserves committed fact without updating detached view state', async () => {
  const { session, h } = await connected(); let settle;
  const original = h.port.save; h.port.save = request => new Promise(resolve => { settle = async () => resolve(await original(request)); });
  const pending = session.apply(session.plan(rename('Edited'))); session.dispose();
  await settle(); const result = await pending;
  assert.equal(result.status, 'committed'); assert.equal(result.detached, true);
  assert.equal(h.state().design.nodes[1].label, 'Edited');
  assert.equal(session.snapshot().design.nodes[1].label, 'Page');
  assert.equal(session.state().canUndo, false);
  assert.equal((await session.load()).status, 'disposed');
});

test('disposal during a read does not hydrate a detached view', async () => {
  const h = host(); let settle; h.port.read = () => new Promise(resolve => { settle = () => resolve(h.state()); });
  const session = new SitemapSession(h.port), pending = session.load(); session.dispose(); settle();
  assert.equal((await pending).status, 'disposed'); assert.equal(session.snapshot(), null);
});

test('undo and redo are durable guarded writes, not mutations of a presentation cache', async () => {
  const { session, h } = await connected();
  await session.apply(session.plan(rename('Edited')));
  assert.equal((await session.undo()).status, 'committed');
  assert.equal(h.state().design.nodes[1].label, 'Page');
  assert.equal(session.state().canRedo, true);
  assert.equal((await session.redo()).status, 'committed');
  assert.equal(h.state().design.nodes[1].label, 'Edited');
  assert.equal(h.calls(), 3);
});

test('failed undo keeps the committed document and original undo entry', async () => {
  const { session, h } = await connected(); await session.apply(session.plan(rename('Edited')));
  h.port.save = async () => ({ status: 'failed', certainty: 'unchanged' });
  assert.equal((await session.undo()).status, 'failed');
  assert.equal(session.snapshot().design.nodes[1].label, 'Edited');
  assert.equal(session.state().canUndo, true); assert.equal(session.state().canRedo, false);
});

test('no-op operations and empty history cause zero writes', async () => {
  const { session, h } = await connected();
  assert.equal((await session.apply(session.plan(rename('Page')))).status, 'unchanged');
  assert.equal((await session.undo()).status, 'unchanged');
  assert.equal((await session.redo()).status, 'unchanged');
  assert.equal(h.calls(), 0);
});

test('a committed but mismatched receipt is not relabelled a failed save or accepted silently', async () => {
  const { session, h } = await connected(); const original = h.port.save;
  h.port.save = async request => { const result = await original(request); result.snapshot.design.notes = ['Unexpected']; return result; };
  const outcome = await session.apply(session.plan(rename('Edited')));
  assert.equal(outcome.status, 'committed'); assert.equal(outcome.requiresReload, true);
  assert.equal(session.state().requiresReload, true); assert.equal(session.state().canUndo, false);
  assert.equal(h.state().design.nodes[1].label, 'Edited');
});

test('a malformed host result is uncertain rather than fabricated committed success', async () => {
  for (const value of [null, {}, { status: 'made-up' }]) {
    const { session, h } = await connected(); h.port.save = async () => value;
    assert.equal((await session.apply(session.plan(rename('Edited')))).status, 'uncertain');
    assert.equal(session.state().requiresReload, true);
  }
});

test('a host status accessor is not evaluated or allowed to assert successful persistence', async () => {
  const { session, h } = await connected(); let invoked = false;
  const value = {}; Object.defineProperty(value, 'status', { get() { invoked = true; return 'committed'; } });
  h.port.save = async () => value;
  assert.equal((await session.apply(session.plan(rename('Edited')))).status, 'uncertain');
  assert.equal(invoked, false);
});
