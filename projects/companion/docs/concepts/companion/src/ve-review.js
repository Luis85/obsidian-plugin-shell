// Review findings for one definition and the Project health slideover. Both only read the design.
// Errors come from the complete validation (the generator gate); warnings and info are authoring advice.
const VE_SEVERITY = { error: ['alert', 'Error'], warning: ['alert', 'Warning'], info: ['info', 'Info'] };
// The element a validation error belongs to, in this definition: the contract's `nodeId` when present, else the one
// element the message names. An ambiguous name (duplicates, wrap groups) links nowhere, so the finding opens Health.
function veFindingNode(definition, error) {
  const nodes = visualNodes(visualRoot(definition));
  if (typeof error?.nodeId === 'string') return nodes.some(n => n.id === error.nodeId) ? error.nodeId : null;
  const message = veErrorText(error);
  const prefix = (Object.hasOwn(definition, 'template') ? 'Component ' + JSON.stringify(definition.exportName) : 'Page ' + JSON.stringify(definition.name)) + ' / ';
  const match = message.startsWith(prefix) ? /^(.+?)(?: [:@][A-Za-z0-9-]+)?(?: → [^:]*)?: /.exec(message.slice(prefix.length)) : null;
  if (!match) return null;
  const hits = nodes.filter(n => n.name === match[1] || n.id === match[1]);
  return hits.length === 1 ? hits[0].id : null;
}
function veHasText(expr) { return !!expr && (expr.kind !== 'literal' || (typeof expr.value === 'string' ? expr.value.trim() !== '' : expr.value !== null)); }
// A control or button is labelled by its own label prop, an enclosing form field label, or accessibility notes.
function veLabelled(node, ancestors) {
  if (node.a11y?.trim() || veHasText(node.props?.label)) return true;
  return ancestors.some(a => a.kind === 'component' && a.ref.kind === 'nuxt-ui' && a.ref.entryId === 'u-form-field' && veHasText(a.props.label));
}
function veIsEmptyState(node) { return !!node.visibleIn?.includes('empty') && !node.visibleIn.includes('default'); }
// Top-most nodes that no scenario (nor the default state) ever shows; their descendants are implied.
function veHiddenEverywhere(definition) {
  const sessions = [visualSession(), ...definition.scenarios.map(s => visualSession(s))], hidden = new Set(), out = [];
  visualWalk(visualRoot(definition), (node, at) => {
    if (sessions.some(s => visualVisible(definition, s, node.id))) return;
    hidden.add(node.id);
    if (!(at.parent && hidden.has(at.parent.id))) out.push(node.id);
  });
  return out;
}
function veReviewFindings(store, ref, context = veContext(design())) {
  const definition = visualDefinition(store, ref), findings = [];
  const add = (severity, text, nodeId = null) => findings.push({ severity, text, nodeId });
  try { validateVisualDesigns(store, context); } catch (error) { add('error', veErrorText(error), definition ? veFindingNode(definition, error) : null); }
  if (!definition) return findings;
  const stack = [];
  visualWalk(visualRoot(definition), (node, at) => {
    stack.length = at.depth - 1; stack.push(node);
    const ancestors = stack.slice(0, -1), label = veNodeLabel(node);
    for (const i of node.events ?? []) if (!i.actions.length) add('warning', 'Implementation required: ' + label + ' → ' + i.label, node.id);
    const entry = node.kind === 'component' && node.ref.kind === 'nuxt-ui' ? node.ref.entryId : null;
    if ((visualIsControl(node) || entry === 'u-button') && !veLabelled(node, ancestors)) add('warning', label + ' needs a label or accessibility notes.', node.id);
    if (node.kind === 'element' && node.tag === 'button' && !node.children.length && !node.a11y?.trim()) add('warning', label + ' needs visible text or accessibility notes.', node.id);
    if (entry === 'u-table') {
      if (node.props.data?.kind !== 'source') add('warning', label + ' has no data binding. Bind its data to a source operation.', node.id);
      if (!node.slots.empty?.length && !at.list.some(n => n !== node && veIsEmptyState(n))) add('warning', label + ' has no empty state. Add a sibling shown only in the empty state.', node.id);
    }
    const image = (node.kind === 'element' && node.tag === 'img') || entry === 'u-avatar';
    if (image && !veHasText(node.kind === 'element' ? node.attrs.alt : node.props.alt) && !node.a11y?.trim()) add('warning', label + ' needs alternative text.', node.id);
    if (node.kind === 'external') add('info', 'Adapter ' + node.adapter + ' must be implemented in code.', node.id);
  });
  for (const id of veHiddenEverywhere(definition)) add('info', veNodeLabel(visualLocate(visualRoot(definition), id).node) + ' is hidden in every scenario.', id);
  return findings;
}
function veFindingHtml(f) {
  const [ico, label] = VE_SEVERITY[f.severity], text = `${icon(ico)}<span class="ve-sr">${label}: </span><span>${esc(f.text)}</span>`;
  const action = f.nodeId ? `data-action="ve-select" data-value="${esc(f.nodeId)}"` : 'data-action="ve-health"';
  return `<li><button type="button" class="ve-finding ve-finding-${f.severity}" ${action}>${text}</button></li>`;
}
function veReviewHtml(findings) {
  const count = n => findings.filter(f => f.severity === n).length, errors = count('error'), warnings = count('warning');
  const summary = findings.length ? badge(findings.length + ' finding' + (findings.length === 1 ? '' : 's'), errors ? 'bad' : warnings ? 'warn' : '') : badge('No findings', 'good');
  const list = findings.length ? `<ul class="ve-findings">${findings.map(veFindingHtml).join('')}</ul>` : '<p class="ve-pane-note">Nothing to review. The generator accepts this page.</p>';
  return `<section class="ve-review" aria-label="Review findings"><div class="ve-review-head"><h3>Review</h3>${summary}<span class="ve-grow"></span>${button('Project health', 've-health', '', 'small ghost', 'shield')}</div>${list}</section>`;
}
// Project health: full validation plus per-area checks. Each check: [label, pass, detail].
function veHealthChecks(d = design()) {
  const store = veStore(d), context = veContext(d), checks = [];
  let failure = '';
  try { validateVisualDesigns(store, context); } catch (error) { failure = String(error.message).replace(/^VISUAL_INVALID: /, ''); }
  const about = prefixes => (prefixes.some(p => failure.startsWith(p)) ? failure : '');
  const pinned = store.catalog.id === VISUAL_CATALOG.id && store.catalog.version === VISUAL_CATALOG.version;
  checks.push(['Full validation', !failure, failure || 'Every page, component, layout and revision passes the generator gate.']);
  checks.push(['Project schema', d.schema === COMPANION_VERSION && store.schema === VISUAL_SCHEMA, 'Companion v' + d.schema + ' · visual designs schema ' + store.schema]);
  checks.push(['Nuxt UI catalog', pinned, pinned ? 'Catalog nuxt-ui v1 pinned · @nuxt/ui ' + VISUAL_NUXT_UI_VERSION : 'Unsupported catalog ' + JSON.stringify(store.catalog)]);
  const dangling = store.pages.filter(p => !context.surfaces.has(p.ownerId)).length;
  const pageIssue = about(['Page ']);
  checks.push(['Page references', !dangling && !pageIssue, pageIssue || store.pages.length + ' page' + (store.pages.length === 1 ? '' : 's') + (dangling ? ' · ' + dangling + ' without a sitemap surface' : ' · no dangling references')]);
  const layoutIssue = about(['Layout ']);
  checks.push(['Layouts', !layoutIssue, layoutIssue || store.layouts.length + ' saved · ' + visualBuiltinLayouts.length + ' built-in · fresh-ID instantiation']);
  const contractIssue = /^(Component|Revision) "/.test(failure) ? failure : '';
  checks.push(['Component contracts', !contractIssue, contractIssue || store.components.length + ' component' + (store.components.length === 1 ? '' : 's') + ' · ' + store.revisions.length + ' published revision' + (store.revisions.length === 1 ? '' : 's') + ' · props, slots and emits valid']);
  let graph = '';
  try { visualCompositionGraph(store); } catch (error) { graph = String(error.message).replace(/^VISUAL_INVALID: /, ''); }
  checks.push(['Component graph', !graph, graph || 'No cycles · composition depth within ' + VISUAL_LIMITS.composition]);
  const scenarios = [...store.pages, ...store.components].reduce((n, x) => n + x.scenarios.length, 0), scenarioIssue = /scenario/i.test(failure) ? failure : '';
  checks.push(['Scenarios', !scenarioIssue, scenarioIssue || scenarios + ' scenario' + (scenarios === 1 ? '' : 's') + ' across ' + (store.pages.length + store.components.length) + ' definitions']);
  return checks;
}
function veHealthHtml() {
  if (!project()) return dialogBody('Project health', '<p>Open a project first.</p>', button('Close', 'close'));
  const checks = veHealthChecks(), passed = checks.filter(c => c[1]).length;
  const rows = checks.map(([label, pass, detail]) => `<li class="ve-health-check ${pass ? 'is-pass' : 'is-warn'}">${icon(pass ? 'check' : 'alert')}<div><strong>${esc(label)}</strong><span class="ve-sr">${pass ? ' passes' : ' needs attention'}</span><p>${esc(detail)}</p></div></li>`).join('');
  const body = `<p class="small muted" role="status">${passed} of ${checks.length} checks pass. Validation reads the saved design; nothing is changed.</p><ul class="ve-health">${rows}</ul>`;
  return dialogBody('Project health', body, button('Close', 'close', '', 'ghost') + button('Inspect project JSON', 'project-export', '', 'primary', 'code'));
}
