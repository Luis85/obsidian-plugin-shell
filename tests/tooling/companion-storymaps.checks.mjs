import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { emptyStorymaps, validateStorymaps } from '../../scripts/companion/storymap-contract.mjs';
import { parseCompanionDocument, validateCompanionDocument } from '../../scripts/companion/project-contract.mjs';

const seed = JSON.parse(await readFile('docs/concepts/companion/companion-project.json', 'utf8'));
const source = await readFile('docs/concepts/companion/src/storymap-model.js', 'utf8');
const ctx = vm.createContext({ emptyStorymaps, validateStorymaps });
vm.runInContext(source + '\n' + await readFile('docs/concepts/companion/src/storymap-export.js', 'utf8'), ctx);
const copy = value => JSON.parse(JSON.stringify(value));
const fixture = () => copy(seed.design.storymaps);
const plain = value => JSON.parse(JSON.stringify(value));

// Shared validator is embedded from these exact source bytes into the browser.
test('[STORYMAP-SCHEMA] empty and self-project collections have bounded stable identities', () => {
  assert.equal(validateStorymaps(emptyStorymaps()).maps.length, 0);
  assert.equal(validateStorymaps(fixture()).maps[0].stories.length, 5);
  assert.equal(seed.schemaVersion, 3); assert.equal(seed.design.schema, 3);
  assert.deepEqual(parseCompanionDocument(JSON.stringify(seed)), seed);
});
for (const [name, mutate] of [
  ['future collection version', s => s.schema = 2],
  ['invalid counter', s => s.nextId = 1],
  ['unsafe counter', s => s.nextId = Number.MAX_SAFE_INTEGER],
  ['duplicate story ID', s => s.maps[0].stories[1].id = s.maps[0].stories[0].id],
  ['duplicate map ID', s => s.maps.push(copy(s.maps[0]))],
  ['blank title', s => s.maps[0].title = '  '],
  ['multiline title', s => s.maps[0].stories[0].title = 'one\ntwo'],
  ['oversized description', s => s.maps[0].stories[0].description = 'x'.repeat(8001)],
  ['missing activity', s => s.maps[0].steps[0].activityId = 'activity-999'],
  ['missing step', s => s.maps[0].stories[0].stepId = 'step-999'],
  ['missing release', s => s.maps[0].stories[0].releaseId = 'release-999'],
  ['foreign renderer position', s => s.maps[0].stories[0].position = { x: 1, y: 2 }],
  ['duplicate surface reference', s => s.maps[0].stories[0].surfaces.push(copy(s.maps[0].stories[0].surfaces[0]))],
  ['malformed reference', s => s.maps[0].stories[0].surfaces[0].id = 'invalid\nid'],
  ['no UI with surface links', s => s.maps[0].stories[0].ui = 'none'],
  ['unsupported map state', s => s.maps[0].status = 'implemented'],
  ['invalid date', s => s.maps[0].updatedAt = 'yesterday'],
  ['too many maps', s => s.maps = Array.from({ length: 13 }, () => copy(s.maps[0]))],
]) test('[STORYMAP-REJECT] ' + name, () => {
  const s = fixture(); validateStorymaps(s); mutate(s); assert.throws(() => validateStorymaps(s), /STORYMAP_INVALID/);
});
test('[STORYMAP-MOVE] stories move across steps and release lanes without changing identity or links', () => {
  const s = fixture(), m = s.maps[0], story = m.stories[0], refs = copy(story.surfaces), id = story.id;
  ctx.smMove(m, id, { stepId: m.steps[2].id, releaseId: m.releases[1].id, beforeId: null });
  assert.equal(story.id, id); assert.equal(story.stepId, m.steps[2].id); assert.equal(story.releaseId, m.releases[1].id);
  assert.deepEqual(story.surfaces, refs); validateStorymaps(s);
});
test('[STORYMAP-NOOP] dropping at the existing end of a cell preserves the exact document', () => {
  const s = fixture(), m = s.maps[0], r = m.stories[0], before = JSON.stringify(s);
  ctx.smMove(m, r.id, { stepId: r.stepId, releaseId: r.releaseId, beforeId: null });
  assert.equal(JSON.stringify(s), before);
});
test('[STORYMAP-ORDER] insert-before retains the order of unrelated stories', () => {
  const s = fixture(), m = s.maps[0], first = m.stories[0], second = m.stories[1];
  ctx.smMove(m, second.id, { stepId: first.stepId, releaseId: first.releaseId, beforeId: first.id });
  assert.deepEqual(m.stories.filter(r => r.stepId === first.stepId).map(r => r.id), [second.id, first.id]); validateStorymaps(s);
});
test('[STORYMAP-PARENTS] moving activities and steps preserves contained story references', () => {
  const s = fixture(), m = s.maps[0], initial = copy(m.stories), a = m.activities[1];
  ctx.smMove(m, a.id, { beforeId: m.activities[0].id }); assert.equal(m.activities[0].id, a.id);
  ctx.smMove(m, m.steps[0].id, { activityId: a.id, beforeId: null });
  assert.deepEqual(m.stories, initial); validateStorymaps(s);
});
test('[STORYMAP-STALE] invalid insertion and cross-cell insertion fail', () => {
  const m = fixture().maps[0], r = m.stories[0];
  assert.throws(() => ctx.smMove(m, r.id, { stepId: r.stepId, releaseId: r.releaseId, beforeId: 'story-999' }), /no longer exists/);
  assert.throws(() => ctx.smMove(m, r.id, { stepId: r.stepId, releaseId: r.releaseId, beforeId: m.stories[1].id }), /destination cell/);
});
test('[STORYMAP-RELEASE] removing a release retains its stories as Unplanned', () => {
  const s = fixture(), m = s.maps[0], id = m.releases[0].id, planned = m.stories.filter(r => r.releaseId === id).map(r => r.id), count = m.stories.length;
  ctx.smRemove(m, 'release', id); assert.equal(m.stories.length, count);
  assert.ok(m.stories.filter(r => planned.includes(r.id)).every(r => r.releaseId === null)); validateStorymaps(s);
});
test('[STORYMAP-CASCADE] activity removal removes only its descendants inside the map', () => {
  const s = fixture(), m = s.maps[0], external = JSON.stringify(seed.design.nodes), a = m.activities[0].id;
  const children = new Set(m.steps.filter(r => r.activityId === a).map(r => r.id));
  const keep = m.stories.filter(r => !children.has(r.stepId)).map(r => r.id);
  ctx.smRemove(m, 'activity', a); assert.deepEqual(m.stories.map(r => r.id), keep);
  assert.equal(JSON.stringify(seed.design.nodes), external); validateStorymaps(s);
});
test('[STORYMAP-DUPLICATE] copies get fresh internal IDs and retain external references', () => {
  const s = fixture(), before = copy(s.maps[0]), clone = ctx.smDuplicate(s, before.id, '2026-09-25T00:00:00.000Z');
  const ids = new Set([before.id, ...['activities', 'steps', 'stories', 'releases'].flatMap(key => before[key].map(r => r.id))]);
  assert.ok(!ids.has(clone.id)); assert.ok(['activities', 'steps', 'stories', 'releases'].every(key => clone[key].every(r => !ids.has(r.id))));
  assert.deepEqual(plain(clone.stories[0].surfaces), before.stories[0].surfaces); assert.deepEqual(s.maps[0], before); validateStorymaps(s);
});
test('[STORYMAP-GEOMETRY] layout and drop targets derive deterministically from semantics', () => {
  const m = fixture().maps[0], before = JSON.stringify(m), layout = plain(ctx.smLayout(m));
  assert.deepEqual(plain(ctx.smLayout(m)), layout); assert.equal(JSON.stringify(m), before);
  const column = layout.columns[2], lane = layout.lanes[1];
  assert.deepEqual(plain(ctx.smDropTarget(m, m.stories[0].id, { x: column.x, y: lane.y + 16 })), { stepId: column.id, releaseId: lane.id, beforeId: null });
  assert.equal(ctx.smDropTarget(m, m.stories[0].id, { x: -500, y: -500 }), null);
});
test('[STORYMAP-MISSING] missing external targets stay valid, visible and exportable', () => {
  const d = copy(seed.design), story = d.storymaps.maps[0].stories[0]; story.surfaces[0].id = 'node-missing';
  validateStorymaps(d.storymaps); assert.ok(ctx.smIssues(d).some(i => i.message.includes('missing sitemap target')));
  const md = ctx.smMarkdown(d.storymaps.maps[0], d); assert.match(md, /target missing/);
  assert.equal(ctx.smSurfaceUses('node-missing', d).length, 1);
});
test('[STORYMAP-MARKDOWN] authored content is escaped and release order is retained', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0]; m.title = '<script>alert(1)</script>'; m.stories[0].description = '[click](javascript:bad)';
  const out = ctx.smMarkdown(m, d); assert.ok(!out.includes('<script>')); assert.ok(!out.includes('[click]'));
  assert.ok(out.indexOf('First usable experience') < out.indexOf('Refine and review')); assert.match(out, /Unplanned/);
  assert.equal(out, ctx.smMarkdown(m, d));
});
test('[STORYMAP-VERSION] legacy projects remain readable; old-version envelopes cannot conceal storymaps', () => {
  const legacy = copy(seed); legacy.schemaVersion = 1; legacy.design.schema = 1; delete legacy.design.storymaps; delete legacy.design.detailDesigns;
  assert.deepEqual(validateCompanionDocument(legacy), legacy);
  legacy.design.storymaps = fixture(); assert.throws(() => validateCompanionDocument(legacy), /version 2/);
  const future = copy(seed); future.schemaVersion = 4; assert.throws(() => validateCompanionDocument(future), /Unsupported companion/);
});
test('[STORYMAP-LARGE] 500-story layout remains deterministic without coordinate persistence', () => {
  const s = fixture(), m = s.maps[0], example = copy(m.stories[0]); m.stories = [];
  for (let i = 0; i < 500; i++) m.stories.push({ ...copy(example), id: 'story-' + s.nextId++, title: 'Story ' + (i + 1), stepId: m.steps[i % 3].id, releaseId: i % 2 ? null : m.releases[0].id });
  validateStorymaps(s); const layout = ctx.smLayout(m); assert.equal(layout.nodes.filter(n => n.kind === 'story').length, 500);
  assert.deepEqual(plain(layout), plain(ctx.smLayout(m))); assert.ok(m.stories.every(r => !Object.hasOwn(r, 'position')));
});

test('[STORYMAP-MARKDOWN-IDS] unresolved reference identities cannot inject Markdown or HTML', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], attack = '<img src=x onerror=alert(1)>';
  m.prds[0].id = attack; m.stories[0].surfaces[0].id = attack;
  m.stories[0].requirements = [{ id: attack, prdId: '[unsafe](javascript:bad)', label: 'Unresolved' }];
  validateStorymaps(d.storymaps);
  const out = ctx.smMarkdown(m, d);
  assert.ok(!out.includes(attack)); assert.ok(!out.includes('[unsafe](javascript:bad)'));
});

vm.runInContext(await readFile('docs/concepts/companion/src/storymap-review.js', 'utf8'), ctx);
test('[STORYMAP-REVIEW] findings are deterministic, actionable and read-only', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], before = JSON.stringify(d);
  const findings = plain(ctx.smReviewFindings(m, d));
  assert.ok(findings.some(f => f.code === 'acceptance'));
  assert.ok(findings.every(f => f.id === m.id || ctx.smItem(m, f.id)));
  assert.deepEqual(plain(ctx.smReviewFindings(m, d)), findings);
  assert.equal(JSON.stringify(d), before);
});
test('[STORYMAP-REVIEW-MISSING] map, story and requirement references expose repair identities', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0];
  m.prds.push({ id: 'missing-prd', label: 'Missing PRD' });
  m.stories[0].surfaces.push({ id: 'missing-screen', label: '<unsafe> screen' });
  m.stories[0].requirements.push({ id: 'missing-requirement', prdId: d.prds[0].id, label: 'Missing requirement' });
  const findings = ctx.smReviewFindings(m, d);
  for (const code of ['missing-prd', 'missing-surface', 'missing-requirement']) assert.ok(findings.some(f => f.code === code));
  assert.ok(findings.filter(f => f.code === 'missing-surface').every(f => f.id === m.stories[0].id));
});
test('[STORYMAP-REVIEW-NOUI] explicitly headless stories do not require surface mapping', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], r = m.stories[0]; r.ui = 'none'; r.surfaces = []; r.acceptance = 'The command reports the exported bytes.';
  assert.ok(!ctx.smReviewFindings(m, d).some(f => f.id === r.id));
  assert.ok(!ctx.smMatchingStories(m, d, { findingFilter: 'interface' }).some(s => s.id === r.id));
});
test('[STORYMAP-REVIEW-STRUCTURE] empty parents and missing outcomes remain advisory', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], store = d.storymaps;
  const a = ctx.smNewItem(store, 'activity'); a.title = 'Empty activity'; m.activities.push(a);
  const step = ctx.smNewItem(store, 'step', m.activities[0].id); step.title = 'Empty step'; m.steps.push(step);
  m.purpose = ''; m.audience = ''; m.releases[0].outcome = '';
  validateStorymaps(store);
  const codes = ctx.smReviewFindings(m, d).map(f => f.code);
  for (const code of ['empty-activity', 'empty-step', 'purpose', 'audience', 'outcome']) assert.ok(codes.includes(code));
});
test('[STORYMAP-SEARCH] linked current names and parent context are searchable without copying data', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], r = m.stories[0], surface = d.nodes.find(n => n.id === r.surfaces[0].id);
  surface.label = 'Distinct renamed surface';
  assert.ok(ctx.smMatchingStories(m, d, { itemQuery: '  DISTINCT renamed  ' }).some(s => s.id === r.id));
  const context = m.activities.find(a => a.id === m.steps.find(s => s.id === r.stepId).activityId).title;
  assert.ok(ctx.smMatchingStories(m, d, { itemQuery: context }).some(s => s.id === r.id));
  assert.ok(!r.surfaces[0].label.includes('Distinct'));
});
test('[STORYMAP-SEARCH-REQUIREMENTS] searches current requirement titles across PRDs', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], r = m.stories.find(s => s.requirements.length), ref = r.requirements[0];
  d.prds.find(p => p.id === ref.prdId).requirements.find(q => q.id === ref.id).title = 'Distinct acceptance contract';
  assert.deepEqual(plain(ctx.smMatchingStories(m, d, { itemQuery: 'distinct acceptance' })).map(s => s.id), [r.id]);
});
test('[STORYMAP-SEARCH-FILTERS] release, acceptance and missing-target filters compose without mutation', () => {
  const d = copy(seed.design), m = d.storymaps.maps[0], before = JSON.stringify(m);
  const result = ctx.smMatchingStories(m, d, { releaseFilter: m.releases[0].id, findingFilter: 'acceptance' });
  assert.ok(result.length > 0); assert.ok(result.every(s => s.releaseId === m.releases[0].id && !s.acceptance.trim()));
  assert.ok(ctx.smMatchingStories(m, d, { releaseFilter: 'unplanned' }).every(s => s.releaseId === null));
  assert.equal(ctx.smMatchingStories(m, d, { itemQuery: 'NO SUCH STORY' }).length, 0);
  assert.equal(ctx.smMatchingStories(m, d, { findingFilter: 'missing' }).length, 0);
  assert.equal(JSON.stringify(m), before);
});
test('[STORYMAP-RELEASE-SCOPE] step coverage is not inherited from another release or an activity link', () => {
  const m = fixture().maps[0]; const slice = plain(ctx.smReleaseSummary(m, m.releases[1].id));
  assert.equal(slice.stories, 1); assert.equal(slice.steps, 1); assert.equal(slice.totalSteps, 3); assert.equal(slice.emptySteps.length, 2);
  assert.equal(ctx.smReleaseSummary(m, null).stories, 1);
});
test('[STORYMAP-DRAG-CACHE] drag hit testing consumes the exact supplied geometry', () => {
  const m = fixture().maps[0], layout = ctx.smLayout(m), original = ctx.smLayout;
  ctx.smLayout = () => { throw Error('Unexpected layout recomputation'); };
  try { assert.equal(ctx.smDropTarget(m, m.stories[0].id, { x: layout.columns[2].x, y: layout.lanes[1].y + 16 }, layout).stepId, m.steps[2].id); }
  finally { ctx.smLayout = original; }
});
test('[STORYMAP-DRAG-INVALID] nonfinite positions cannot produce a semantic move', () => {
  const m = fixture().maps[0];
  for (const value of [Infinity, -Infinity, NaN]) assert.equal(ctx.smDropTarget(m, m.activities[0].id, { x: value, y: 10 }), null);
});
test('[STORYMAP-INDEX] layout never rescans the story collection per cell', () => {
  const m = fixture().maps[0]; let scans = 0;
  m.stories = new Proxy(m.stories, { get(target, key) { if (key === 'filter') scans++; return Reflect.get(target, key); } });
  assert.equal(ctx.smLayout(m).nodes.filter(n => n.kind === 'story').length, 5); assert.equal(scans, 0);
});
for (const timestamp of ['2026-02-30T00:00:00.000Z', '2025-02-29T00:00:00.000Z', '2026-09-25T24:00:00.000Z']) {
  test('[STORYMAP-DATE] refuses normalized rather than real timestamp ' + timestamp, () => {
    const store = fixture(); store.maps[0].updatedAt = timestamp; assert.throws(() => validateStorymaps(store), /Invalid map metadata/);
  });
}
test('[STORYMAP-DATE-LEAP] an actual leap-day timestamp remains accepted', () => {
  const store = fixture(); store.maps[0].updatedAt = '2024-02-29T23:59:59.999Z'; assert.equal(validateStorymaps(store), store);
});
