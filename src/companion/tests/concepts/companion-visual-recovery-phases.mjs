// Recovery phases of the visual-editors browser suite (companion-visual-editors.browser.mjs owns the harness and the
// report): saved and previous-workspace state restores only as schema 6, and designs that name a missing sitemap surface
// are protected against removal and stay repairable. `h` is the suite harness; page.evaluate is used only for canonical
// readback and labelled controlled fixtures.
import { readFileSync } from 'node:fs';

let savedDesign = null;

// Saved browser state: a schema 6 self-project with undo history restores unchanged; a saved design of a retired
// schema is not loaded and its storage is preserved until an explicit reset.
export async function savedSelfProject(h) {
  const golden = JSON.parse(readFileSync(new URL('../../../../configs/starters/companion-plugin.json', import.meta.url), 'utf8')).generator.document, key = await h.js(() => STORAGE_KEY);
  const saved = await h.js(document => {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY)), current = { ...s.project.design, ...document.design };
    current.history = [designSnapshot(current), designSnapshot(current)]; current.future = [designSnapshot(current)];
    s.project.design = current; s.view = 'pages'; return JSON.stringify(s);
  }, golden);
  savedDesign = JSON.parse(saved).project.design;
  const retired = JSON.parse(saved); retired.project.design.schema = 5;
  await h.load({ [key]: JSON.stringify(retired) });
  const refused = await h.js(stored => ({ project: project(), warning: storageWarning, kept: localStorage.getItem(STORAGE_KEY) === stored }), JSON.stringify(retired));
  h.check('a saved retired-schema design is not loaded and its storage is preserved', refused.project === null && refused.warning.includes('original storage preserved') && refused.kept, refused, 'Seeded retired-schema browser storage, real startup restore');
  await h.load({ [key]: saved });
  const restored = await h.js(() => ({ schema: design().schema, history: design().history.length, future: design().future.length, pages: veStore().pages.length, valid: validSavedDesign(design()), stored: localStorage.getItem(STORAGE_KEY) }));
  await h.act('ve-open-page', 'node-50');
  const undo = await h.page().locator('.ve-toolbar [data-action="ve-undo"]').isEnabled();
  h.check('a saved schema 6 self-project restores unchanged with its history', restored.schema === 6 && restored.history === 2 && restored.future === 1 && restored.pages === savedDesign.visualDesigns.pages.length && restored.pages > 20 && restored.valid
    && JSON.parse(restored.stored).project.design.visualDesigns.pages.length === restored.pages && undo, { ...restored, stored: restored.stored.length, undo }, 'Seeded browser storage, real startup restore and editor controls');
}

// A previous multi-project workspace: only outlines that are valid current designs are offered; the original is kept.
export async function previousWorkspaceAdoption(h) {
  const key = await h.js(() => LEGACY_STORAGE_KEY), outline = { ...savedDesign, history: [], future: [] };
  const previous = JSON.stringify({ schema: 1, projects: [{ name: 'Retired outline', id: 'retired-outline', author: 'Concept test', description: 'Saved in a retired schema', version: '0.1.0', design: { ...outline, schema: 4 } },
    { name: 'Current outline', id: 'current-outline', author: 'Concept test', description: 'Saved as schema 6', version: '0.1.0', design: outline }] });
  await h.load({ [key]: previous });
  await h.act('vault-legacy'); await h.opened();
  const offered = await h.page().locator('#legacy-choice option').allInnerTexts();
  await h.act('vault-legacy-adopt', undefined, '#modal'); await h.closed();
  const adopted = await h.js(() => ({ id: project().id, schema: design().schema, pages: veStore().pages.length, valid: validSavedDesign(design()), original: localStorage.getItem(LEGACY_STORAGE_KEY) }));
  h.check('previous-workspace adoption offers only current outlines, copies one and keeps the original', offered.length === 1 && offered[0].includes('Current outline') && adopted.id === 'current-outline' && adopted.schema === 6
    && adopted.pages === outline.visualDesigns.pages.length && adopted.valid && adopted.original === previous, { offered, adopted: { ...adopted, original: adopted.original === previous } }, 'Seeded previous-workspace storage, real recovery dialog');
}

export async function surfaceRemovalAndOrphans(h) {
  // A designed leaf surface that no sitemap route, journey step or feature names: the imported-orphan fixture below leaves
  // only the page design dangling (schema 6 sitemap records are validated against the surfaces too).
  const owner = await h.js(() => { const d = design(), named = id => (d.sitemap?.routes ?? []).some(r => r.surface === id) || (d.sitemap?.journeys ?? []).some(j => j.steps.some(s => s.surface === id)) || (d.features?.items ?? []).some(f => f.surfaces.includes(id));
    return veStore().pages.find(p => !d.nodes.some(n => n.parent === p.ownerId) && !named(p.ownerId)).ownerId; }), page = h.page();
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

// Published revisions are never edited: a surface only an unpinned revision navigates to is removed together with
// that revision (named first, one undoable write), and the blueprint dialog names page-design blockers up front.
export async function revisionSurfaceAndBlueprint(h) {
  const page = h.page();
  // Controlled fixture: a new leaf surface (a copy of an existing one) and an unpinned published revision that
  // navigates to it; nothing else names the surface.
  const fixture = await h.js(() => {
    const d = design(), store = veStore(), surfaces = veContext(d).surfaces, pins = new Set();
    for (const def of [...store.pages, ...store.components, ...store.layouts, ...store.revisions]) visualWalk(def.root ?? def.template, n => { if (n.kind === 'component' && n.ref.kind === 'project' && n.ref.revisionId) pins.add(n.ref.revisionId); });
    const base = d.nodes.find(n => surfaces.has(n.id) && !d.nodes.some(c => c.parent === n.id)), target = { ...structuredClone(base), id: 'node-' + d.nextId++, label: 'Retired screen' };
    d.nodes.push(target);
    const eventful = n => Array.isArray(n.events) && !['text', 'slot'].includes(n.kind), revision = store.revisions.find(r => !pins.has(r.id) && visualNodes(r.template).some(eventful));
    visualNodes(revision.template).find(eventful).events.push({ id: visualAllocate(store, 'vi'), event: 'click', label: 'Open retired', actions: [{ kind: 'navigate', surfaceId: target.id }], notes: '', acceptance: '' });
    validateVisualDesigns(store, veContext(d)); save();
    return { target: target.id, revision: revision.id, name: veRevisionName(store, revision), revisions: store.revisions.length };
  });
  await h.navigate('sitemap');
  const card = page.locator(`.map-node[data-node="${fixture.target}"]`); await card.focus(); await page.keyboard.press('Delete'); await h.opened();
  const dialog = await h.modalText(), history = await h.js(() => design().history.length);
  await h.act('design-remove-confirm', fixture.target, '#modal'); await h.closed();
  const notice = await h.toast();
  const after = await h.js(({ target, revision }) => { try { validateVisualDesigns(veStore(), veContext(design())); companionJson(); return { ok: true, node: design().nodes.some(n => n.id === target), revision: veStore().revisions.some(r => r.id === revision), history: design().history.length }; } catch (error) { return { ok: false, error: error.message }; } }, fixture);
  await h.js(() => designHistory('undo'));
  const undone = await h.js(({ target, revision }) => ({ node: design().nodes.some(n => n.id === target), revision: veStore().revisions.some(r => r.id === revision) }), fixture);
  h.check('a surface only an unpinned published revision navigates to is removed with that revision in one undoable write', dialog.includes('Also deletes 1 published revision that navigates here and that nothing pins: ' + fixture.name)
    && notice.includes('Deleted unpinned published revision(s): ' + fixture.name) && after.ok && !after.node && !after.revision && after.history === history + 1 && undone.node && undone.revision,
  { fixture, dialog, notice, after, undone }, 'Controlled fixture (new leaf surface, navigate action added to an unpinned revision), real sitemap Delete and confirm controls');
  await h.navigate('blueprints');
  await page.locator('#content [data-action="blueprint-choose"]').first().click(); await h.opened();
  const replace = await h.modalText(), apply = await page.locator('#modal [data-action="blueprint-apply"]').count(); await h.escape();
  h.check('the blueprint dialog names page-design blockers up front and offers no apply while they exist', replace.includes('In use by page and component designs: page design') && replace.includes('The sitemap cannot be replaced until then.') && apply === 0,
    { replace: replace.slice(0, 400), apply }, 'Real blueprint chooser on the self-project');
}
