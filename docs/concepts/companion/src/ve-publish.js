// Component dialogs: Publish revision (usages affected, confirmation), Dependency graph (read-only) and the adapter-name
// prompt for an External library element. Drafts live in veUi and are written once, on confirm, through veCommit.
function veSemver(version) { return String(version).split('.').map(Number); }
function veNewer(a, b) { const [x, y] = [veSemver(a), veSemver(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }
function veLatestRevision(store, componentId) { return store.revisions.filter(r => r.componentId === componentId).reduce((best, r) => (!best || veNewer(r.version, best.version) ? r : best), null); }
// Next patch after the newest published revision; a first publication starts at 1.0.0.
function veNextPatch(store, componentId) {
  const latest = veLatestRevision(store, componentId);
  if (!latest) return '1.0.0';
  const [major, minor, patch] = veSemver(latest.version);
  return major + '.' + minor + '.' + (patch + 1);
}
function veComponentOrThrow() { const c = veCurrentComponent(); if (!c) throw Error('Open a component design first.'); return c; }
// Every place that renders this component: live instances follow the next revision's source, pinned ones keep theirs
// (published revisions of other components always pin).
function veUsageRows(store, component) {
  return visualUsages(store, component.id).filter(u => u.definitionId !== component.id).map(u => {
    const definition = u.kind === 'revision' ? store.revisions.find(r => r.id === u.definitionId) : visualDefinition(store, { kind: u.kind, id: u.definitionId }), node = visualLocate(visualRoot(definition), u.nodeId)?.node;
    const pinned = node?.ref.revisionId ? store.revisions.find(r => r.id === node.ref.revisionId) : null;
    return { where: u.kind[0].toUpperCase() + u.kind.slice(1) + ' ' + u.definitionName + ' / ' + (node ? veNodeLabel(node) : u.nodeId), pinned };
  });
}
function veOpenPublish() {
  const component = veComponentOrThrow();
  veUi.publishForm = { componentId: component.id, version: veNextPatch(veStore(), component.id), confirm: false, error: '', token: smToken() };
  showModal('ve-publish');
}
function veComponentDialogField(el) {
  const form = veUi.publishForm;
  if (el.dataset.field === 've-external') { if (veUi.externalForm) veUi.externalForm.adapter = el.value; return true; }
  if (el.dataset.field !== 've-publish') return false;
  if (form && el.dataset.key === 'version') form.version = el.value;
  if (form && el.dataset.key === 'confirm') form.confirm = el.checked === true;
  return true;
}
function vePublishDialog() {
  const form = veUi.publishForm, store = veStore(), component = form ? store.components.find(c => c.id === form.componentId) : null;
  if (!component) return dialogBody('Publish unavailable', '<p>The component no longer exists. Close this dialog; nothing was changed.</p>', button('Close', 'close'));
  const usages = veUsageRows(store, component), latest = veLatestRevision(store, component.id);
  const rows = usages.map(u => `<li>${esc(u.where)} · ${esc(u.pinned ? 'pinned to v' + u.pinned.version + ', unchanged' : 'live, follows the component')}</li>`).join('');
  const body = `<p id="ve-publish-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p>
    <p>${esc(component.exportName)} · ${esc(latest ? 'latest published v' + latest.version : 'not published yet')}. A revision is an immutable snapshot of the contract, template and dependencies that pages and components can pin.</p>
    ${uiInput('Version (x.y.z)', 've-publish-version', form.version, { field: 've-publish', extra: 'data-key="version" maxlength="40" required autocomplete="off" spellcheck="false" autofocus' })}
    <section aria-label="Usages affected"><h3>Usages affected · ${usages.length}</h3>${rows ? `<ul class="ve-usages">${rows}</ul>` : '<p class="ve-pane-note">No page, layout or component uses it yet.</p>'}</section>
    <label class="ve-check"><input type="checkbox" id="ve-publish-confirm" data-field="ve-publish" data-key="confirm"${form.confirm ? ' checked' : ''}><span>I reviewed the usages. Publish this revision.</span></label>`;
  return dialogBody('Publish revision · ' + component.exportName, body, button('Cancel', 'close', '', 'ghost') + button('Publish revision', 've-publish-confirm', '', 'primary', 'check'));
}
function vePublishConfirm() {
  const form = veUi.publishForm;
  if (!form) throw Error('Open Publish revision again.');
  veEditable();
  if (!form.confirm) throw Error('Confirm that you reviewed the usages before publishing.');
  let revision = null;
  veCommit(store => { revision = visualPublish(store, form.componentId, form.version.trim()); }, form.token);
  veUi.publishForm = null; modalOriginal = null; closeModal(); render();
  notify('Revision v' + revision.version + ' published. Pinned usages are unchanged; undo is available.');
}
function veDepsDialog() {
  const store = veStore(), component = veCurrentComponent();
  if (!component) return dialogBody('Dependency graph', '<p>Open a component design first.</p>', button('Close', 'close'));
  const children = [];
  visualWalk(component.template, n => { if (n.kind === 'component' && n.ref.kind === 'project') { const c = store.components.find(x => x.id === n.ref.componentId), r = n.ref.revisionId ? store.revisions.find(x => x.id === n.ref.revisionId) : null; children.push((c?.exportName || n.ref.componentId) + (r ? ' · pinned v' + r.version : ' · live') + ' as ' + veNodeLabel(n)); } });
  const packages = (component.dependencies || []).map(d => d.package + '@' + d.version + (d.purpose ? ' · ' + d.purpose : ''));
  const usages = veUsageRows(store, component).map(u => u.where + (u.pinned ? ' · pinned v' + u.pinned.version : ' · live'));
  const revisions = store.revisions.filter(r => r.componentId === component.id).map(r => 'v' + r.version);
  let graph = 'No cycles · composition depth within ' + VISUAL_LIMITS.composition;
  try { visualCompositionGraph(store); } catch (error) { graph = veErrorText(error); }
  const list = (title, items, empty) => `<section aria-label="${esc(title)}"><h3>${esc(title)} · ${items.length}</h3>${items.length ? `<ul class="ve-usages">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="ve-pane-note">${esc(empty)}</p>`}</section>`;
  const body = `<p role="status">${esc(graph)}</p>${list('Uses components', children, 'No child project components.')}${list('npm dependencies', packages, 'No declared packages.')}${list('Used by', usages, 'Not used by any page, layout or component.')}${list('Published revisions', revisions, 'Not published yet.')}`;
  return dialogBody('Dependency graph · ' + component.exportName, body, button('Close', 'close', '', 'ghost'));
}
// External library: choose the adapter name, then insert the element where Insert would place it.
function veAdapterName(pkg, component) {
  const base = (pkg.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^[^a-z]+/, '').replace(/-+$/, '') || 'adapter').slice(0, 52);
  return veUniqueName(base, new Set(visualNodes(component.template).filter(n => n.kind === 'external').map(n => n.adapter)));
}
function veOpenExternal(pkg) {
  veEditable();
  const component = veComponentOrThrow();
  if (!(component.dependencies || []).some(d => d.package === pkg)) throw Error('Declare a dependency first (Dependencies tab), then insert it as an External library element.');
  veUi.externalForm = { package: pkg, adapter: veAdapterName(pkg, component), error: '', token: smToken() };
  showModal('ve-external');
}
function veExternalDialog() {
  const form = veUi.externalForm, component = veCurrentComponent(), dep = component?.dependencies?.find(d => d.package === form?.package);
  if (!form || !dep) return dialogBody('External library unavailable', '<p>The dependency is no longer declared. Close this dialog; nothing was changed.</p>', button('Close', 'close'));
  const body = `<p id="ve-external-error" class="error" role="alert" tabindex="-1">${esc(form.error)}</p>
    <p>${esc(dep.package + '@' + dep.version)} is never loaded here. The canvas shows a placeholder; a hand-owned adapter mounts the library in the generated project.</p>
    ${uiInput('Adapter name', 've-external-adapter', form.adapter, { field: 've-external', hint: 'Lowercase kebab-case, unique in this component, e.g. rich-text.', extra: 'data-key="adapter" maxlength="60" required autocomplete="off" spellcheck="false" autofocus' })}`;
  return dialogBody('Insert external library · ' + dep.package, body, button('Cancel', 'close', '', 'ghost') + button('Insert', 've-external-confirm', '', 'primary', 'plus'));
}
function veExternalConfirm() {
  const form = veUi.externalForm;
  if (!form) throw Error('Choose the external library again.');
  veEditable();
  let id = null;
  veCommit(store => {
    const ref = veEditorRef(), node = visualExternal(visualAllocate(store, 'vn'), form.package, form.adapter.trim());
    visualInsert(store, ref, veTargetFor(visualDefinition(store, ref)), [node]); id = node.id;
  }, form.token);
  veUi.externalForm = null; modalOriginal = null; closeModal();
  Object.assign(veUi, { selected: id, after: false, slotTarget: null, left: 'outline', childTab: 'props', error: '' }); render();
  notify('External element inserted. Implement adapter ' + form.adapter.trim() + ' in code.');
}
const VE_PUBLISH_ACTIONS = {
  've-publish': veOpenPublish, 've-publish-confirm': vePublishConfirm, 've-deps': () => showModal('ve-deps'), 've-external-confirm': veExternalConfirm,
};
