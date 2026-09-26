// Component editor shell: Structure | Insert child with Dependency graph and Publish revision, a canvas with Design /
// Preview / Compare / Review plus variant and state selectors, and the contract (root) or child inspector.
// Views only read; "Start design" and "Customize as component" are the writes that create a component definition.
const VE_COMPONENT_LEFT = [['outline', 'Structure'], ['insert', 'Insert child']];
const VE_COMPONENT_MODES = [['design', 'Design'], ['preview', 'Preview'], ['compare', 'Compare'], ['review', 'Review']];
function veCurrentComponent(d = design()) { return veUi.library ? veStore(d).components.find(c => c.libraryId === veUi.library) ?? null : null; }
// Keep the session aligned with the design (undo/redo may remove the component, a variant or a slot target).
function veSyncComponent() {
  const component = veCurrentComponent();
  veUi.ref = component ? { kind: 'component', id: component.id } : null;
  veRepair();
  if (veUi.variant && !component?.variants.some(v => v.id === veUi.variant)) veUi.variant = '';
  if (!VISUAL_STATES.includes(veUi.state)) veUi.state = 'default';
  if (veUi.slotTarget && !(component && visualLocate(component.template, veUi.slotTarget.nodeId))) veUi.slotTarget = null;
  return component;
}
function vePascal(text) {
  const base = String(text).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('') || 'Component';
  return (/^[A-Z]/.test(base) ? base : 'C' + base).slice(0, 56);
}
function veUniqueName(base, taken) { let name = base, i = 2; while (taken.has(name)) name = base + i++; return name; }
// Opening never writes. The Back stack remembers the previous view and which page or component it showed.
function veOpenComponent(libraryId, { push = state.view !== 'component-editor' } = {}) {
  const d = design();
  if (!d.library.some(l => l.id === libraryId) && !veStore(d).components.some(c => c.libraryId === libraryId)) throw Error('That library component no longer exists.');
  if (state.view === 'component-editor' && veUi.library === libraryId) return;
  if (push) veUi.back = [...veUi.back, veBackEntry()].slice(-12);
  Object.assign(veUi, { library: libraryId, selected: null, scenario: null, variant: '', state: 'default', mode: 'design', query: '', left: 'outline', pane: 'canvas', after: false, more: false, error: '', slotTarget: null, depForm: null });
  if (state.view === 'component-editor') render(); else setView('component-editor');
}
function veOpenDefinition(componentId) {
  const target = veStore().components.find(c => c.id === componentId);
  if (!target) throw Error('The component definition no longer exists.');
  veOpenComponent(target.libraryId, { push: true });
}
function veStartComponent(libraryId) {
  const lib = design().library.find(l => l.id === libraryId);
  if (!lib) throw Error('Choose a component from the library.');
  veCommit(store => { visualCreateComponent(store, { libraryId: lib.id, exportName: veUniqueName(vePascal(lib.name), new Set(store.components.map(c => c.exportName))), description: String(lib.description || '').slice(0, 2000) }); });
  Object.assign(veUi, { library: lib.id, left: 'insert', insertTab: 'basic', error: '' }); render();
  notify('Component design started. The library entry is unchanged.');
}
// "Customize as component": a project library entry plus a component definition that wraps the chosen primitive, both
// written in one veCommit (one undo step). The contract is seeded from the catalog entry by visualCreateComponent.
function veLibraryEntryFor(entry, name, library) {
  const base = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const id = veUniqueName(base, new Set(library.map(l => l.id)));
  const props = entry.props.filter(p => VISUAL_PROP_TYPES.includes(p.type)).slice(0, 16).map(p => p.name + '?:' + p.type).join('\n');
  const preview = { Forms: 'form', Feedback: 'notice', Navigation: 'toolbar', Actions: 'toolbar' }[entry.category] || 'record';
  return { id, name, category: entry.category, preview, description: 'Project component customized from Nuxt UI ' + entry.component + '.', props, events: '', slots: entry.slots.map(s => s.name).join(', '), variants: 'default', a11y: '', version: '0.1.0', revision: 1, status: 'draft', origin: 'project', replacement: '', tokens: '' };
}
function veCustomize(entryId) {
  const entry = visualCatalogEntry(entryId);
  if (!entry) throw Error('Choose a Nuxt UI component to customize.');
  if (design().library.length >= LIBRARY_LIMIT) throw Error('The component library holds at most ' + LIBRARY_LIMIT + ' components. Nothing was created.');
  let created = null;
  veCommit((store, d) => {
    const name = veUniqueName('App' + entry.component.replace(/^U(?=[A-Z])/, ''), new Set([...store.components.map(c => c.exportName), ...d.library.map(l => l.name)]));
    const lib = veLibraryEntryFor(entry, name, d.library);
    d.library.push(lib);
    created = visualCreateComponent(store, { libraryId: lib.id, exportName: name, description: 'Reusable ' + entry.label.toLowerCase() + ' based on Nuxt UI ' + entry.component + '.', implementation: { catalog: 'nuxt-ui', entryId: entry.id } });
  });
  veOpenComponent(created.libraryId, { push: true });
  notify(created.exportName + ' was created from ' + entry.component + ' with its props, slots and emits. Undo is available.');
}
function veComponentKind(component) {
  if (component.implementation) return 'Customized ' + (visualCatalogEntry(component.implementation.entryId)?.component || component.implementation.entryId);
  return visualDependencies(component.template).length ? 'Composite' : 'Component';
}
function veComponentLeft(component) {
  const root = `<button type="button" class="ve-tree-root${veUi.selected ? '' : ' is-selected'}" data-action="ve-select-root" aria-pressed="${!veUi.selected}">${icon('box')}<span>${esc(component.exportName)}</span><span class="ve-tree-kind">Contract</span></button>`;
  const body = veUi.left === 'insert' ? veInsertHtml('component')
    : `${root}<input class="ve-search" type="search" data-field="ve-outline-search" value="${esc(veUi.query)}" placeholder="Find in template" aria-label="Find in component outline" maxlength="160" autocomplete="off"><div id="ve-outline">${veOutlineHtml(component)}</div>`;
  const head = `<div class="ve-pane-head">${button('Back', 've-back', '', 'small ghost', '', 'aria-label="Back"')}<div class="ve-head-title"><span class="ve-eyebrow">${esc('Component editor · ' + veComponentKind(component))}</span><strong>${esc(component.exportName)}</strong></div></div>`;
  const foot = `<div class="ve-left-foot">${button('Dependency graph', 've-deps', '', 'small', 'layers')}${button('Publish revision', 've-publish', '', 'small primary', 'check')}</div>`;
  return `${head}${veSegment('Structure tools', 've-left', VE_COMPONENT_LEFT, veUi.left === 'insert' ? 'insert' : 'outline')}<div class="ve-pane-body">${body}</div>${foot}`;
}
function veInlineSelect(label, field, options, value) {
  return `<label class="ve-inline-field"><span>${esc(label)}</span><select data-field="${field}" aria-label="${esc(label)}">${options.map(([id, name]) => `<option value="${esc(id)}"${value === id ? ' selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
}
function veComponentToolbar(component) {
  const variants = [['', 'Default'], ...component.variants.map(v => [v.id, v.name])];
  const selectors = veUi.mode === 'compare' ? '' : veInlineSelect('Variant', 've-variant', variants, veUi.variant) + veInlineSelect('State', 've-state', VISUAL_STATES.map(s => [s, s]), veUi.state);
  return `<div class="ve-toolbar" role="toolbar" aria-label="Canvas">${veSegment('Editor mode', 've-mode', VE_COMPONENT_MODES, veUi.mode)}${selectors}<span class="ve-grow"></span>${veSegment('Canvas width', 've-viewport', VE_VIEWPORT_LABELS, veUi.viewport)}${button('Health', 've-health', '', 'small ghost', 'shield', 'aria-label="Project health"')}</div>`;
}
function veVariantValues(component, variantId) { return component.variants.find(v => v.id === variantId)?.values || {}; }
// Compare: every variant (Default first) in every preview state, as read-only previews at the chosen width.
function veCompareHtml(component) {
  const variants = [{ id: '', name: 'Default', values: {} }, ...component.variants];
  const cells = variants.flatMap(v => VISUAL_STATES.map(s => `<li class="ve-compare-cell"><p class="ve-compare-label">${esc(v.name)} · ${esc(s)}</p>${veCanvasHtml(component, visualSession({ state: s }), { mode: 'preview', viewport: veUi.viewport, props: v.values })}</li>`));
  return `<ul class="ve-compare" aria-label="${esc(variants.length + ' variants in ' + VISUAL_STATES.length + ' states')}">${cells.join('')}</ul>`;
}
function veComponentCanvas(component) {
  if (veUi.mode === 'compare') return veCompareHtml(component);
  return veCanvasHtml(component, visualSession({ state: veUi.state }), { mode: veUi.mode, selected: veUi.mode === 'preview' ? null : veUi.selected, viewport: veUi.viewport, props: veVariantValues(component, veUi.variant) });
}
function veComponentFooter(component, findings) {
  const trail = veOutlineTrail(component, veUi.selected), ready = veReadiness(component, findings);
  const crumbs = [component.exportName, ...trail.map(n => veNodeLabel(n))].map((label, i, all) => i === all.length - 1 ? `<strong>${esc(label)}</strong>` : `<span>${esc(label)}</span>`).join('<span aria-hidden="true">›</span>');
  const children = visualDependencies(component.template).length, packages = (component.dependencies || []).length;
  let cycles = 'No cycles';
  try { visualCompositionGraph(veStore()); } catch { cycles = 'Cycle detected'; }
  const facts = [children + ' child component' + (children === 1 ? '' : 's'), packages + ' package' + (packages === 1 ? '' : 's'), cycles].map(t => `<span>${esc(t)}</span>`).join('<span aria-hidden="true">·</span>');
  return `<div class="ve-footer"><nav class="ve-crumbs" aria-label="Selected element path">${crumbs}</nav><span class="ve-grow"></span>${facts}<span aria-hidden="true">·</span><span class="ve-readiness ${ready.ready ? 'is-ready' : 'is-blocked'}" role="status">${ready.ready ? '✓' : '!'} ${esc(ready.text)}</span></div>`;
}
function veComponentEmpty(lib, error) {
  if (!veUi.library) return `<section class="ve-empty card"><h1>Component editor</h1><p>Choose a component in the library, or customize a Nuxt UI component from a page's Insert pane.</p>${button('Open component library', 'nav', 'components', 'primary', 'grid')}</section>`;
  return `<section class="ve-empty card">${button('Back', 've-back', '', 'small ghost')}<span class="ve-eyebrow">Library component · Not designed</span><h1>${esc(lib?.name || 'Missing component')}</h1>${error}<p>${lib ? 'This library component has no visual design yet. Start one to compose its template and typed contract. Opening it did not change the project.' : 'This library component no longer exists.'}</p>${lib ? button('Start design', 've-start-component', lib.id, 'primary', 'plus') : button('Open component library', 'nav', 'components', 'primary', 'grid')}</section>`;
}
function veComponentEditorView() {
  const component = veSyncComponent(), lib = design().library.find(l => l.id === veUi.library);
  const error = `<p id="ve-error" class="error ve-error" role="alert" tabindex="-1">${esc(veUi.error)}</p>`;
  if (!component) return veComponentEmpty(lib, error);
  const findings = veReviewFindings(veStore(), { kind: 'component', id: component.id });
  const node = veUi.selected ? visualLocate(component.template, veUi.selected)?.node ?? null : null;
  const pane = id => 've-pane ve-pane-' + id + (veUi.pane === id ? ' is-active' : '');
  const inspector = node ? veChildInspectorHtml(component, node) : veContractHtml(component);
  return `<section class="ve-page-editor ve-component-editor" aria-label="${esc('Component editor · ' + component.exportName)}">${vePaneTabs()}<div class="ve-editor">
    <aside class="${pane('left')}" aria-label="Component structure">${veComponentLeft(component)}</aside>
    <section class="${pane('canvas')}" aria-label="Canvas">${veComponentToolbar(component)}<div class="ve-canvas-area">${veComponentCanvas(component)}</div>${veComponentFooter(component, findings)}</section>
    <aside class="${pane('inspector')}" aria-label="Inspector"><div class="ve-pane-body">${error}${inspector}${veReviewHtml(findings)}</div></aside></div></section>`;
}
const VE_COMPONENT_SESSION_ACTIONS = {
  've-select-root': () => { veUi.selected = null; veUi.slotTarget = null; },
  've-map-slot': value => {
    if (!value) { veUi.slotTarget = null; return; }
    const node = veUi.selected ? visualLocate(veCurrentComponent()?.template ?? [], veUi.selected)?.node : null;
    if (!node || node.kind !== 'component' || !veChildSlots(node).some(s => s.name === value)) throw Error('Select a child component with that slot first.');
    Object.assign(veUi, { slotTarget: { nodeId: node.id, slot: value }, left: 'insert', pane: 'left' });
  },
  ...VE_CONTRACT_SESSION_ACTIONS, ...VE_CHILD_SESSION_ACTIONS,
};
const VE_COMPONENT_ACTIONS = {
  've-start-component': veStartComponent, 've-customize': veCustomize, 've-open-definition': veOpenDefinition,
  ...VE_CONTRACT_ACTIONS, ...VE_CHILD_ACTIONS, ...VE_PUBLISH_ACTIONS,
};
const VE_COMPONENT_FIELDS = [...VE_CONTRACT_FIELDS, ...VE_CHILD_FIELDS];
// Field dispatch for the component editor: canvas selectors, contract and dependency rows, child bindings.
function veComponentField(el, commit, after) {
  const field = el.dataset.field;
  if (field === 've-variant') { veUi.variant = veCurrentComponent()?.variants.some(v => v.id === el.value) ? el.value : ''; render(); return true; }
  if (field === 've-state') { veUi.state = VISUAL_STATES.includes(el.value) ? el.value : 'default'; render(); return true; }
  return veContractField(el, commit, after) || veChildField(el, commit, after);
}
