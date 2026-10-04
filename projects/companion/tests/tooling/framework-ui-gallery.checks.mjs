import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { expandMatrix, fileName, slug, GALLERY_NOTICE } from '../../scripts/ui/gallery-matrix.ts';
import { escapeHtml, renderGalleryHtml } from '../../scripts/ui/gallery-report.ts';
import { runGallery } from '../../scripts/ui/gallery-run.ts';

const surface = (id, variants, label = id) => ({ id, label, variants });
const plain = [{ state: 'default', scenario: null }];
const bytes = job => Buffer.from(`png:${job.file}`);
const clock = () => new Date('2026-01-02T03:04:05.000Z');
function fakeSession(surfaces, capture = async job => bytes(job)) {
  const log = { captured: [], closed: 0 };
  return { log, surfaces: async () => surfaces,
    async capture(job) { log.captured.push(job.file); return capture(job); },
    async close() { log.closed++; } };
}
async function inTemp(t, body) {
  const root = await mkdtemp(join(tmpdir(), 'ui-gallery-')); t.after(() => rm(root, { recursive: true, force: true }));
  return body(root);
}

test('matrix expands surface x state x scenario x theme x width exactly once each', () => {
  const surfaces = [surface('home', [{ state: 'default', scenario: null }, { state: 'loading', scenario: null }, { state: 'loading', scenario: 'busy' }])];
  const jobs = expandMatrix(surfaces);
  assert.equal(jobs.length, 3 * 2 * 2);
  assert.equal(new Set(jobs.map(job => job.file)).size, jobs.length);
  assert.deepEqual([...new Set(jobs.map(job => job.theme))].sort(), ['dark', 'light']);
  assert.deepEqual([...new Set(jobs.map(job => job.width))].sort((a, b) => b - a), [1280, 360]);
  assert.ok(jobs.every(job => /^home__[a-z]+__(none|s-busy)__(light|dark)__(1280|360)\.png$/.test(job.file)));
});

test('matrix order is deterministic whatever the discovery order', () => {
  const variants = [{ state: 'error', scenario: null }, { state: 'default', scenario: null }, { state: 'default', scenario: 'a' }];
  const forward = expandMatrix([surface('b', variants), surface('a', plain)]);
  const reversed = expandMatrix([surface('a', plain), surface('b', [...variants].reverse())]);
  assert.deepEqual(forward.map(job => job.file), reversed.map(job => job.file));
  assert.deepEqual(forward.slice(0, 4).map(job => [job.surfaceId, job.theme, job.width]),
    [['a', 'light', 1280], ['a', 'light', 360], ['a', 'dark', 1280], ['a', 'dark', 360]]);
  const states = forward.filter(job => job.surfaceId === 'b' && job.theme === 'light' && job.width === 1280).map(job => `${job.state}/${job.scenario}`);
  assert.deepEqual(states, ['default/null', 'default/a', 'error/null']);
});

test('matrix honours explicit themes and widths and rejects colliding file names', () => {
  assert.equal(expandMatrix([surface('a', plain)], { themes: ['dark'], widths: [800] }).length, 1);
  assert.throws(() => expandMatrix([surface('a', plain), surface('a', plain)]), /GALLERY_DUPLICATE_ENTRY/);
});

test('file names are portable and ids that differ only by case or punctuation never collide', () => {
  assert.equal(slug('plain-id'), 'plain-id');
  assert.notEqual(slug('Home Page'), slug('home-page'));
  assert.notEqual(slug('a/b'), slug('a-b'));
  const name = fileName({ surfaceId: '../Évil <x>', state: 'default', scenario: 'S 1', theme: 'light', width: 360 });
  assert.match(name, /^[a-z0-9._-]+$/);
  assert.ok(!name.includes('..') && !name.includes('/'));
});

test('run writes PNGs, an index.json with the documented shape and a gallery.html, and closes the session', async t => inTemp(t, async root => {
  const session = fakeSession([surface('home', plain, 'Home'), surface('docs', plain, 'Docs')]);
  const result = await runGallery({ target: 'harness', outDirectory: join(root, 'out'), session, commit: 'abc123', clock });
  assert.equal(session.log.closed, 1);
  const names = (await readdir(join(root, 'out'))).sort();
  assert.equal(names.filter(name => name.endsWith('.png')).length, 8);
  assert.ok(names.includes('index.json') && names.includes('gallery.html'));
  const index = JSON.parse(await readFile(join(root, 'out/index.json'), 'utf8'));
  assert.deepEqual(index, result.index);
  assert.deepEqual(Object.keys(index), ['schemaVersion', 'notice', 'target', 'commit', 'generatedAt', 'entries', 'failures']);
  assert.equal(index.notice, GALLERY_NOTICE);
  assert.deepEqual(Object.keys(index.entries[0]), ['surfaceId', 'surfaceLabel', 'state', 'scenario', 'theme', 'width', 'file', 'sha256', 'commit', 'timestamp']);
  for (const entry of index.entries) {
    const png = await readFile(join(root, 'out', entry.file));
    assert.equal(entry.sha256, createHash('sha256').update(png).digest('hex'));
    assert.equal(entry.commit, 'abc123'); assert.equal(entry.timestamp, '2026-01-02T03:04:05.000Z');
  }
  assert.deepEqual(index.entries.map(entry => entry.surfaceId), ['docs', 'docs', 'docs', 'docs', 'home', 'home', 'home', 'home']);
}));

test('same inputs give byte-identical index.json and gallery.html; a missing commit is recorded as null', async t => inTemp(t, async root => {
  const run = async name => {
    await runGallery({ target: 'clickdummy', outDirectory: join(root, name), session: fakeSession([surface('s', plain)]), commit: null, clock });
    return Promise.all(['index.json', 'gallery.html'].map(file => readFile(join(root, name, file), 'utf8')));
  };
  const [first, second] = [await run('one'), await run('two')];
  assert.deepEqual(first, second);
  assert.equal(JSON.parse(first[0]).entries[0].commit, null);
}));

test('a failed capture is reported, other captures survive, stale files are removed and no failure is hidden', async t => inTemp(t, async root => {
  const out = join(root, 'out');
  await runGallery({ target: 'harness', outDirectory: out, session: fakeSession([surface('old', plain)]), commit: null, clock });
  await writeFile(join(out, 'keep.txt'), 'unrelated');
  const session = fakeSession([surface('new', plain)], async job => { if (job.theme === 'dark' && job.width === 360) throw new Error('boom'); return bytes(job); });
  const { index } = await runGallery({ target: 'harness', outDirectory: out, session, commit: null, clock });
  assert.equal(index.entries.length, 3);
  assert.deepEqual(index.failures, [{ file: 'new__default__none__dark__360.png', message: 'boom' }]);
  const names = await readdir(out);
  assert.ok(names.includes('keep.txt') && !names.some(name => name.startsWith('old__')));
  assert.match(await readFile(join(out, 'gallery.html'), 'utf8'), /role="alert"/);
}));

test('the session is closed even when discovery fails', async t => inTemp(t, async root => {
  const session = { ...fakeSession([]), surfaces: async () => { throw new Error('GALLERY_SERVER: down'); } };
  await assert.rejects(runGallery({ target: 'harness', outDirectory: join(root, 'out'), session, commit: null, clock }), /GALLERY_SERVER/);
  assert.equal(session.log.closed, 1);
}));

test('gallery.html escapes every authored string and has no remote resources', () => {
  const hostile = '"><script>alert(1)</script>&\'';
  const entry = { surfaceId: hostile, surfaceLabel: hostile, state: hostile, scenario: hostile, theme: 'light', width: 360, file: `${hostile}.png`, sha256: 'a'.repeat(64), commit: hostile, timestamp: hostile };
  const html = renderGalleryHtml({ schemaVersion: 1, notice: GALLERY_NOTICE, target: hostile, commit: hostile, generatedAt: hostile, entries: [entry], failures: [{ file: hostile, message: hostile }] });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(!html.includes(hostile));
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /(?:src|href)="https?:/);
  assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
});

test('gallery.html states the disclaimer, groups by surface and offers theme and width filters', async t => inTemp(t, async root => {
  const session = fakeSession([surface('home', plain, 'Home'), surface('docs', plain, 'Docs')]);
  const { index } = await runGallery({ target: 'harness', outDirectory: join(root, 'out'), session, commit: 'abc', clock });
  const html = renderGalleryHtml(index);
  assert.ok(html.includes('Evidence for human review — not acceptance, not a baseline'));
  assert.equal((html.match(/<section>/g) ?? []).length, 2);
  assert.ok(html.indexOf('<h2>Docs') < html.indexOf('<h2>Home'));
  for (const value of ['light', 'dark', '1280', '360']) assert.match(html, new RegExp(`data-filter="[a-z]+" value="${value}"`));
  assert.equal((html.match(/<figure /g) ?? []).length, 8);
  assert.match(html, /<figcaption>.*default · no scenario.*<\/figcaption>/);
  assert.match(html, /Content-Security-Policy/);
}));
