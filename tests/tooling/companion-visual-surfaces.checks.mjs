// Sitemap surfaces referenced by visual designs: removal, blueprint replacement and the missing-surface repair, over the
// real shared contracts and ve-* sources (see companion-visual-entry-fixture.mjs). Published revisions are never edited:
// removal and repair delete those that nothing pins and are blocked by pinned ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, plain, snapshot } from './companion-visual-entry-fixture.mjs';

const go = (id, label, surfaceId) => ({ id, event: 'click', label, actions: [{ kind: 'navigate', surfaceId }], notes: '', acceptance: '' });
// Publish SearchField, then Toolbar (which pins it). Toolbar's revision navigates to surface-b; the live Toolbar no
// longer does, so only published revisions name surface-b. Options add navigation to SearchField's revision, drop it
// from Toolbar's, and pin Toolbar's revision from the Customers page.
function published({ searchNavigates = false, toolbarNavigates = true, pinFromPage = false } = {}) {
  const ctx = load(), store = ctx.host.design.visualDesigns, [search, toolbar] = store.components, bar = toolbar.template[0];
  store.nextId = 100;
  if (searchNavigates) search.template[1].events.push(ctx.realm(go('vi-50', 'Open editor', 'surface-b')));
  if (toolbarNavigates) bar.events = ctx.realm([go('vi-51', 'Edit customer', 'surface-b')]);
  const searchRevision = ctx.visualPublish(store, 'vc-1', '1.0.0'), toolbarRevision = ctx.visualPublish(store, 'vc-3', '1.0.0');
  bar.events = ctx.realm([]); search.template[1].events = search.template[1].events.filter(i => i.id !== 'vi-50');
  if (pinFromPage) store.pages[0].root[2].ref.revisionId = toolbarRevision.id;
  ctx.validateVisualDesigns(store, ctx.veContext(ctx.host.design));
  return { ctx, store, searchRevision, toolbarRevision };
}
const ids = revisions => plain(revisions.map(r => r.id));

// A sitemap surface that owns a page design or is a navigation target cannot be removed; the uses are named.
test('[VISUAL-SURFACES] surface uses name owned page designs and navigate actions in every definition kind', () => {
  const ctx = load(), bar = ctx.host.design.visualDesigns.components[1].template[0];
  bar.events = ctx.realm([{ id: 'vi-29', event: 'click', label: 'Open editor', actions: [{ kind: 'navigate', surfaceId: 'surface-b' }], notes: '', acceptance: '' }]);
  ctx.validateVisualDesigns(ctx.host.design.visualDesigns, ctx.veContext(ctx.host.design));
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-a'])), ['page design Customers']);
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-b'])), ['interaction Open editor in component Toolbar']);
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-a', 'surface-b'])), ['page design Customers', 'interaction Open editor in component Toolbar']);
  assert.deepEqual(plain(ctx.veSurfaceUses(['elsewhere'])), []);
  assert.equal(ctx.veSurfaceBlock(['surface-b']), 'In use by page and component designs: interaction Open editor in component Toolbar. Delete those page designs and change those navigate actions first. No surface was removed.');
});
// Imported (or otherwise orphaned) designs that name a missing surface stay reachable: each opens, and one reviewed
// write removes them together with navigation to missing surfaces, after which every edit validates again.
test('[VISUAL-SURFACES] orphaned page designs are listed, openable and removable with dangling navigation in one write', () => {
  const ctx = load(), d = ctx.host.design, bar = d.visualDesigns.components[1].template[0];
  bar.events = ctx.realm([{ id: 'vi-29', event: 'click', label: 'Open <gone>', actions: [{ kind: 'navigate', surfaceId: 'surface-gone' }, { kind: 'set-state', state: 'loading' }], notes: '', acceptance: '' }]);
  d.nodes = d.nodes.filter(n => n.id !== 'surface-a'); ctx.view().view = 'pages';
  const html = ctx.vePagesView();
  assert.ok(html.includes('Designs with a missing surface') && html.includes('data-action="ve-open-page" data-value="surface-a"') && html.includes('data-action="ve-orphans"'), html);
  assert.ok(!html.includes('<gone>'), 'labels are escaped');
  ctx.handleVisualAction('ve-open-page', 'surface-a');
  assert.deepEqual([ctx.view().view, ctx.veCurrentPage()?.id], ['page-editor', 'vp-6']);
  const before = snapshot(ctx);
  ctx.ui().selected = 'vn-26'; ctx.handleVisualAction('ve-duplicate');
  assert.match(ctx.ui().error, /owner surface is missing/); assert.equal(snapshot(ctx), before);
  ctx.handleVisualAction('ve-orphans');
  const dialog = ctx.veOrphansDialog();
  assert.equal(ctx.modal().type, 've-orphans');
  assert.ok(dialog.includes('Delete the page design Customers') && dialog.includes('Remove navigation to a missing surface from Component Toolbar / Open &lt;gone&gt;'), dialog);
  const history = d.history.length;
  ctx.handleVisualAction('ve-orphans-confirm');
  const store = ctx.veStore();
  assert.deepEqual([store.pages.length, plain(store.components[1].template[0].events[0].actions), ctx.host.design.history.length, ctx.modal().type], [0, [{ kind: 'set-state', state: 'loading' }], history + 1, '']);
  ctx.validateVisualDesigns(store, ctx.veContext(ctx.host.design));
  assert.match(ctx.host.notices.at(-1), /^Removed 1 page design and 1 navigation to missing surfaces\. Undo is available\.$/);
  assert.ok(!ctx.vePagesView().includes('Designs with a missing surface'));
});
test('[VISUAL-SURFACES] a surface only an unpinned published revision navigates to can be removed with that revision', () => {
  const { ctx, toolbarRevision } = published(), d = ctx.host.design;
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-b'])), []);
  assert.equal(ctx.veSurfaceBlock(['surface-b']), '');
  assert.deepEqual(ids(ctx.veSurfacePlan(['surface-b']).revisions), [toolbarRevision.id]);
  assert.equal(ctx.veSurfaceRevisionNote(['surface-b']), 'Also deletes 1 published revision that navigates here and that nothing pins: Toolbar v1.0.0. Undo restores it.');
  const searchBefore = JSON.stringify(d.visualDesigns.revisions[0]);
  assert.deepEqual(plain(ctx.veRemoveSurfaceRevisions(d, ['surface-b'])), ['Toolbar v1.0.0']);
  assert.equal(d.visualDesigns.revisions.length, 1);
  assert.equal(JSON.stringify(d.visualDesigns.revisions[0]), searchBefore, 'other revisions are never edited');
  d.nodes = d.nodes.filter(n => n.id !== 'surface-b');
  ctx.validateVisualDesigns(d.visualDesigns, ctx.veContext(d));
});
test('[VISUAL-SURFACES] a pinned published revision blocks removal and names what pins it', () => {
  const { ctx, store } = published({ pinFromPage: true }), before = snapshot(ctx);
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-b'])), ['published revision Toolbar v1.0.0 (pinned by page Customers)']);
  assert.deepEqual(ids(ctx.veSurfacePlan(['surface-b']).revisions), []);
  assert.match(ctx.veSurfaceBlock(['surface-b']), /^In use by page and component designs: published revision Toolbar v1\.0\.0 \(pinned by page Customers\)\./);
  assert.deepEqual(plain(ctx.veRemoveSurfaceRevisions(ctx.host.design, ['surface-b'])), []);
  assert.equal(snapshot(ctx), before); assert.equal(store.revisions.length, 2);
});
test('[VISUAL-SURFACES] pins between published revisions: an unpinned chain goes together, a kept pinner blocks', () => {
  const both = published({ searchNavigates: true });
  assert.deepEqual(ids(both.ctx.veSurfacePlan(['surface-b']).revisions).sort(), [both.searchRevision.id, both.toolbarRevision.id].sort());
  assert.deepEqual(plain(both.ctx.veSurfaceUses(['surface-b'])), []);
  const kept = published({ searchNavigates: true, toolbarNavigates: false });
  assert.deepEqual(ids(kept.ctx.veSurfacePlan(['surface-b']).revisions), []);
  assert.deepEqual(plain(kept.ctx.veSurfaceUses(['surface-b'])), ['published revision SearchField v1.0.0 (pinned by revision Toolbar v1.0.0)']);
});
test('[VISUAL-SURFACES] saved layouts that navigate to a surface block it like pages and components', () => {
  const ctx = load(), store = ctx.host.design.visualDesigns;
  store.nextId = 100; store.layouts.push(ctx.realm({ id: 'vl-40', name: 'Shell', description: '', scope: 'page', category: 'custom', slots: [], root: [ctx.visualElement('vn-41', 'button', { name: 'Edit', events: [go('vi-42', 'Edit customer', 'surface-b')] })] }));
  ctx.validateVisualDesigns(store, ctx.veContext(ctx.host.design));
  assert.deepEqual(plain(ctx.veSurfaceUses(['surface-b'])), ['interaction Edit customer in layout Shell']);
});
test('[VISUAL-SURFACES] the blueprint warning names page-design and navigation blockers before replacing', () => {
  const ctx = load(), bar = ctx.host.design.visualDesigns.components[1].template[0];
  bar.events = ctx.realm([go('vi-29', 'Edit customer', 'surface-b')]);
  assert.equal(ctx.veReplaceNotice(ctx.host.design), 'In use by page and component designs: page design Customers; interaction Edit customer in component Toolbar. Delete those page designs and change those navigate actions first. The sitemap cannot be replaced until then.');
  const { ctx: only } = published();
  only.host.design.visualDesigns.pages = [];
  assert.equal(only.veReplaceNotice(only.host.design), 'Also deletes 1 published revision that navigates here and that nothing pins: Toolbar v1.0.0. Undo restores it.');
  assert.equal(load().veReplaceNotice({ ...only.host.design, nodes: [] }), '');
});
test('[VISUAL-SURFACES] the missing-surface repair deletes unpinned revisions instead of editing them and names new TODOs', () => {
  const { ctx, toolbarRevision } = published(), d = ctx.host.design, search = d.visualDesigns.components[0];
  search.template[1].events.push(ctx.realm(go('vi-60', 'Open gone', 'surface-b')));
  d.nodes = d.nodes.filter(n => n.id !== 'surface-b');
  ctx.handleVisualAction('ve-orphans');
  const dialog = ctx.veOrphansDialog();
  assert.ok(dialog.includes('Delete the published revision Toolbar v1.0.0: it navigates to a missing surface and nothing pins it.'), dialog);
  assert.ok(dialog.includes('Remove navigation to a missing surface from Component SearchField / Open gone; that interaction then has no actions and becomes an implementation TODO.'), dialog);
  ctx.handleVisualAction('ve-orphans-confirm');
  const store = ctx.veStore();
  assert.ok(!store.revisions.some(r => r.id === toolbarRevision.id));
  assert.deepEqual(plain(store.components[0].template[1].events.find(i => i.id === 'vi-60').actions), []);
  ctx.validateVisualDesigns(store, ctx.veContext(d));
  assert.equal(ctx.host.notices.at(-1), 'Removed 0 page designs, 1 navigation and 1 published revision to missing surfaces. 1 interaction now has no actions and is an implementation TODO. Undo is available.');
});
test('[VISUAL-SURFACES] a pinned revision that navigates to a missing surface blocks the repair without a write', () => {
  const { ctx } = published({ pinFromPage: true }), d = ctx.host.design;
  d.nodes = d.nodes.filter(n => n.id !== 'surface-b');
  ctx.handleVisualAction('ve-orphans');
  const dialog = ctx.veOrphansDialog(), before = snapshot(ctx), saves = ctx.host.saves;
  assert.ok(dialog.includes('Published revisions are never edited, and these are pinned: published revision Toolbar v1.0.0 (pinned by page Customers).'), dialog);
  assert.match(dialog, /data-action="ve-orphans-confirm"[^>]*disabled/);
  ctx.handleVisualAction('ve-orphans-confirm');
  assert.equal(snapshot(ctx), before); assert.equal(ctx.host.saves, saves);
});
