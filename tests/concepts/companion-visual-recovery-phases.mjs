// Recovery phases of the visual-editors browser suite (companion-visual-editors.browser.mjs owns the harness and the
// report): a project whose one-time upgrade failed keeps its legacy detail designs through the export it is told to
// use, and designs that name a missing sitemap surface are protected against removal and stay repairable. `h` is the
// suite harness; page.evaluate is used only for canonical readback and labelled controlled fixtures.
import { readFileSync } from 'node:fs';

// Valid legacy data the one-way upgrade cannot hold: a 120-element page whose list options each add two elements.
function unmigratable(store) {
  const s = structuredClone(store), doc = s.documents.find(d => d.kind === 'page'), root = doc.nodes.find(n => n.parentId === null);
  const base = { kind: 'text', label: 'Filler', text: 'x', parentId: root.id, layout: 'stack', position: { x: 0, y: 0 }, size: { width: 80, height: 80 }, component: null, props: {}, binding: null, a11y: '', visibleIn: ['default', 'loading', 'empty', 'error', 'disabled'], sourceBrickId: null };
  doc.nodes.push({ ...base, id: 'detail-node-' + s.nextId++, kind: 'list', label: 'Options', options: ['a', 'b'] });
  while (doc.nodes.length < 120) doc.nodes.push({ ...base, id: 'detail-node-' + s.nextId++ });
  return s;
}

export async function failedUpgradeRecovery(h) {
  const v4 = JSON.parse(readFileSync(h.FIXTURES + 'detail-v4.json', 'utf8')), store = unmigratable(v4.design.detailDesigns), key = await h.js(() => STORAGE_KEY);
  const saved = await h.js(({ design, detailDesigns }) => {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)), old = { ...s.project.design, ...design, detailDesigns };
    delete old.visualDesigns; old.history = []; old.future = []; s.project.design = old; s.view = 'pages'; return JSON.stringify(s);
  }, { design: v4.design, detailDesigns: store });
  await h.load({ [key]: saved });
  const notice = await h.toast(), kept = await h.js(() => ({ legacy: JSON.stringify(design().detailDesigns), visual: 'visualDesigns' in design(), stored: localStorage.getItem(STORAGE_KEY).includes('"detailDesigns"'), view: state.view }));
  const card = h.page().locator('section[aria-label="Legacy detail designs"]'), shown = await card.isVisible();
  await card.locator('[data-action="project-export"]').click(); await h.opened();
  const title = await h.modalText(), exported = JSON.parse(await h.js(() => modalData.text)); await h.escape();
  const refusal = await h.js(() => { try { importDesign('{}'); return ''; } catch (error) { return error.message; } });
  h.check('failed upgrade keeps the legacy store; the Pages view offers the export that keeps it at its legacy version', notice.includes('could not be upgraded') && notice.includes('Use Export project JSON on the Pages view')
    && kept.legacy === JSON.stringify(store) && !kept.visual && kept.stored && kept.view === 'pages' && shown && title.includes('Legacy version') && exported.schemaVersion === 4 && exported.design.schema === 4
    && JSON.stringify(exported.design.detailDesigns) === JSON.stringify(store) && !('visualDesigns' in exported.design) && refusal.includes('A blueprint import would discard them') && kept.legacy === await h.js(() => JSON.stringify(design().detailDesigns)),
  { notice, kept: { ...kept, legacy: kept.legacy.length }, shown, title, schema: exported.schemaVersion, refusal }, 'Seeded failed-upgrade browser storage, real startup restore and Export control; blueprint import called directly');
}

export async function surfaceRemovalAndOrphans(h) {
  const owner = await h.js(() => veStore().pages.find(p => !design().nodes.some(n => n.parent === p.ownerId)).ownerId), page = h.page();
  await h.navigate('sitemap');
  const card = page.locator(`.map-node[data-node="${owner}"]`); await card.focus(); await page.keyboard.press('Delete'); await h.opened();
  const before = await h.snapshot(), dialog = await h.modalText(), confirm = await page.locator('#modal [data-action="design-remove-confirm"]').count(); await h.escape();
  h.check('removing a designed sitemap surface is refused, naming its page design', dialog.includes('Cannot remove') && dialog.includes('In use by page and component designs: page design') && confirm === 0 && before === await h.snapshot(), { dialog, confirm });
  // Controlled imported-orphan fixture: the surface disappears outside the editors (as in imported data).
  const blocked = await h.js(id => { const d = design(); d.nodes = d.nodes.filter(n => n.id !== id); d.links = d.links.filter(e => e.from !== id && e.to !== id); save(); try { companionJson(); return ''; } catch (error) { return error.message; } }, owner);
  await h.navigate('pages');
  const section = page.locator('section[aria-label="Designs with a missing surface"]'), listed = await section.isVisible();
  await section.locator(`[data-action="ve-open-page"][data-value="${owner}"]`).click();
  const opened = await h.js(id => state.view === 'page-editor' && veCurrentPage()?.ownerId === id, owner);
  await h.navigate('pages'); const history = await h.js(() => design().history.length);
  await section.locator('[data-action="ve-orphans"]').click(); await h.opened();
  const review = await h.modalText(); await h.act('ve-orphans-confirm', undefined, '#modal'); await h.closed();
  const after = await h.js(() => { try { validateVisualDesigns(veStore(), veContext(design())); companionJson(); return { ok: true, orphans: veStore().pages.filter(p => !veContext(design()).surfaces.has(p.ownerId)).length, history: design().history.length }; } catch (error) { return { ok: false, error: error.message }; } });
  h.check('an orphaned page design opens and is removed with one reviewed write that makes the project valid again', /owner surface is missing/.test(blocked) && listed && opened && review.includes('Delete the page design') && after.ok && after.orphans === 0 && after.history === history + 1
    && !(await page.locator('section[aria-label="Designs with a missing surface"]').count()), { blocked, listed, opened, review, after }, 'Controlled imported-orphan fixture, real Pages controls');
}
