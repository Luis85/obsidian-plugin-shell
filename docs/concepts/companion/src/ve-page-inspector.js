// Page inspector: Essentials | Data | Actions for the selected element, the page summary otherwise, and the review
// findings panel. Markup only; writes go through data-field / data-action handlers and veCommit. Preview is read-only.
const VE_INSPECTOR_TABS = [['essentials', 'Essentials'], ['data', 'Data'], ['actions', 'Actions']];
function veEditable() { if (veUi.mode === 'preview') throw Error('Preview is read-only. Switch to Design to change the page.'); }
function veStructureActions() {
  return `<div class="ve-inspector-actions" role="group" aria-label="Structure">${button('Move earlier', 've-move', 'earlier', 'small')}${button('Move later', 've-move', 'later', 'small')}${button('Duplicate', 've-duplicate', '', 'small', 'copy')}${button('Wrap in group', 've-wrap', '', 'small', 'box')}</div>`;
}
function veSection(title, body) { return `<section class="ve-inspector-section"><h3>${esc(title)}</h3>${body}</section>`; }
// Essentials: identity, catalog-schema values, layout, visibility, accessibility.
function veValuesHtml(definition, node) {
  const store = veStore(), specs = veValueSpecs(store, node);
  if (node.kind === 'slot') return `<p class="ve-pane-note">Slot ${esc(node.name)} receives content from the component's users.</p>`;
  if (node.kind === 'external') return '<p class="ve-pane-note">External library properties are edited in the component editor.</p>';
  const rows = specs.map(spec => {
    const expr = veCurrentExpr(node, spec.key);
    if (expr && expr.kind !== 'literal') return `<div class="field"><span class="ve-field-label">${esc(spec.label)}</span><p class="ve-bound">${icon('link')}<span>${esc(veBindingText(expr, definition))}</span></p>${button('Edit binding', 've-inspector', 'data', 'small ghost')}</div>`;
    return veControlHtml('ve-prop', spec, expr ? expr.value : spec.kind === 'boolean' ? spec.default ?? false : undefined);
  });
  if (node.kind === 'text') rows.push(veSelectHtml('Text role', 've-role', 'role', VISUAL_TEXT_ROLES.map(r => [r, r]), node.role));
  if (node.kind === 'element') {
    rows.unshift(veSelectHtml('Element', 've-tag', 'tag', VISUAL_TAGS.map(t => [t, t + ' · ' + (VE_TAG_LABELS[t] || t)]), node.tag));
    const names = [...new Set([...(VE_ELEMENT_ATTRS[node.tag] || []), ...Object.keys(node.attrs)])].filter(k => !node.attrs[k] || node.attrs[k].kind === 'literal');
    for (const name of names) rows.push(veControlHtml('ve-attr', { key: name, label: 'Attribute ' + name, kind: 'string', type: 'string', options: [] }, node.attrs[name]?.value));
  }
  return rows.join('') || '<p class="ve-pane-note">This component declares no properties.</p>';
}
function veLayoutHtml(node) {
  const layout = node.layout, ui = layout?.ui, mode = veSelectHtml('Layout', 've-layout-mode', 'mode', [['', 'No layout rules'], ...VISUAL_LAYOUT_MODES.map(m => [m, m])], layout?.mode ?? '');
  if (!ui) return mode;
  const read = key => key.split('.').reduce((v, k) => v?.[k], ui);
  const number = (label, key) => { const [min, max] = VE_LAYOUT_BOUNDS[key]; return `<div class="field"><label for="${veFieldId('ve-layout', key)}">${esc(label)}</label><input id="${veFieldId('ve-layout', key)}" data-field="ve-layout" data-key="${key}" type="number" min="${min}" max="${max}" step="1" value="${esc(read(key))}"></div>`; };
  const choice = (label, key) => veSelectHtml(label, 've-layout', key, VE_LAYOUT_CHOICES[key].map(v => [v, v]), read(key));
  const flag = (label, key) => veControlHtml('ve-layout', { key, label, kind: 'boolean', options: [] }, read(key));
  const tokens = Object.entries(VE_TOKEN_GROUPS).map(([key, group]) => veSelectHtml('Token · ' + key, 've-layout', 'tokens.' + key, [['', 'Literal / inherited'], ...(design().designSystem?.[group] || []).map(t => [t.id, t.name]), ...(ui.tokens[key] && !(design().designSystem?.[group] || []).some(t => t.id === ui.tokens[key]) ? [[ui.tokens[key], ui.tokens[key] + ' (missing)']] : [])], ui.tokens[key])).join('');
  const basics = `<div class="ve-field-pair">${number('Gap (px)', 'gap')}${number('Padding (px)', 'padding')}</div>${layout.mode === 'grid' ? number('Columns', 'columns') : ''}<div class="ve-field-pair">${choice('Align', 'align')}${choice('Justify', 'justify')}</div>${flag('Wrap row content', 'wrap')}`;
  const advanced = `<details class="ve-advanced"${veUi.advanced ? ' open' : ''}><summary data-action="ve-advanced">Advanced</summary><div class="ve-field-pair">${choice('Width', 'widthMode')}${number('Preferred width', 'width')}</div><div class="ve-field-pair">${number('Minimum width', 'minWidth')}${number('Maximum width', 'maxWidth')}</div>${choice('Overflow', 'overflow')}<p class="ve-pane-note">Narrow container (640 px or less)</p><div class="ve-field-pair">${choice('Narrow layout', 'narrow.layout')}${number('Narrow columns', 'narrow.columns')}</div>${flag('Hide on narrow', 'narrow.hidden')}${tokens}</details>`;
  return mode + basics + advanced;
}
function veVisibilityHtml(node) {
  const shown = node.visibleIn ?? VISUAL_STATES;
  return `<fieldset class="ve-states"><legend>Visible in states</legend>${VISUAL_STATES.map(s => veControlHtml('ve-visible', { key: s, label: s, kind: 'boolean', options: [] }, shown.includes(s))).join('')}</fieldset>`;
}
function veEssentialsTab(definition, node) {
  const name = `<div class="field"><label for="ve-name-name">Name</label><input id="ve-name-name" data-field="ve-name" data-key="name" type="text" value="${esc(node.name ?? '')}" placeholder="${esc(veKindLabel(node))}" maxlength="120" autocomplete="off"></div>`;
  const a11y = `<div class="field"><label for="ve-a11y-a11y">Accessibility notes</label><textarea id="ve-a11y-a11y" data-field="ve-a11y" data-key="a11y" rows="2" maxlength="2000">${esc(node.a11y ?? '')}</textarea></div>`;
  return name + veSection(node.kind === 'text' ? 'Content' : 'Properties', veValuesHtml(definition, node)) + veSection('Layout', veLayoutHtml(node)) + veSection('Visibility', veVisibilityHtml(node)) + veSection('Accessibility', a11y);
}
// Data: each value's binding kind, then source → operation → field or the form control.
function veBindingHtml(definition, node, spec, d = design()) {
  const expr = veCurrentExpr(node, spec.key), kind = expr?.kind === 'source' || expr?.kind === 'state' ? expr.kind : 'literal';
  let detail = kind === 'literal' ? `<p class="ve-pane-note">${expr ? 'Literal ' + esc(JSON.stringify(expr.value).slice(0, 80)) : 'Catalog default'} · edit the value in Essentials.</p>` : '';
  if (expr?.kind === 'prop') detail = `<p class="ve-pane-note">${esc(veBindingText(expr, definition))}</p>`;
  if (kind === 'source') {
    const reads = veReadSources(d), read = reads.find(x => x.source.id === expr.sourceId), fields = veOperationFields(expr.sourceId, expr.operationId, d);
    const keep = (list, value, label) => (list.some(([k]) => k === value) ? list : [[value, label], ...list]);
    detail = veSelectHtml('Source', 've-bind-source', spec.key, keep(reads.map(x => [x.source.id, x.source.name]), expr.sourceId, expr.sourceId + ' (missing)'), expr.sourceId)
      + veSelectHtml('Operation', 've-bind-operation', spec.key, keep((read?.operations || []).map(o => [o.id, o.name]), expr.operationId, expr.operationId + ' (missing)'), expr.operationId)
      + veSelectHtml('Field', 've-bind-field', spec.key, keep([['', 'Whole result'], ...fields.map(f => [f, f])], expr.field, expr.field + ' (not declared)'), expr.field);
  }
  if (kind === 'state') detail = veSelectHtml('Form control', 've-bind-state', spec.key, veControls(definition, node.id).map(n => [n.id, veNodeLabel(n)]), expr.nodeId);
  const kinds = expr?.kind === 'prop' ? [['prop', 'Component property'], ...VE_BINDING_KINDS] : VE_BINDING_KINDS;
  return `<div class="ve-binding">${veSelectHtml(spec.label + ' · binding', 've-bind-kind', spec.key, kinds, expr?.kind === 'prop' ? 'prop' : kind)}${detail}</div>`;
}
function veDataTab(definition, node) {
  const specs = veValueSpecs(veStore(), node);
  if (!specs.length) return '<p class="ve-pane-note">Bind data on text or on a component property. Elements keep literal attributes.</p>';
  const sources = veReadSources().length ? '' : '<p class="ve-pane-note">No data source declares a read operation yet. Add one in Data Sources to bind values.</p>';
  return sources + specs.map(spec => veBindingHtml(definition, node, spec)).join('');
}
// Actions: the element's interactions with their ordered actions and acceptance.
function veActionsTab(definition, node) {
  if (!Array.isArray(node.events)) return '<p class="ve-pane-note">Text and slots have no interactions. Select a button, control or element.</p>';
  const items = node.events.map(i => {
    const steps = i.actions.length ? `<ol>${i.actions.map(a => `<li>${esc(veActionSummary(a, definition))}</li>`).join('')}</ol>` : `<p class="ve-todo">${icon('alert')}<span>Implementation required</span></p>`;
    const acceptance = i.acceptance ? `<p class="ve-pane-note">${esc(i.acceptance.split('\n')[0].slice(0, 160))}</p>` : '';
    return `<li class="ve-interaction"><div class="ve-interaction-head">${badge(i.event)}<strong>${esc(i.label)}</strong></div>${steps}${acceptance}<div class="ve-inspector-actions">${button('Edit', 've-interaction-edit', i.id, 'small', '', `aria-label="${esc('Edit interaction ' + i.label)}"`)}${button('Remove', 've-interaction-remove', i.id, 'small ghost', 'trash', `aria-label="${esc('Remove interaction ' + i.label)}"`)}</div></li>`;
  }).join('');
  const full = node.events.length >= VISUAL_LIMITS.interactions;
  return `${items ? `<ul class="ve-interactions">${items}</ul>` : '<p class="ve-pane-note">No interactions yet.</p>'}${button('Add interaction', 've-interaction-add', '', 'small primary', 'plus', full ? 'disabled' : '')}`;
}
function vePageSummaryHtml(page) {
  return `<h2>${esc(page.name)}</h2><dl class="ve-facts"><dt>Elements</dt><dd>${visualNodes(page.root).length}/${VISUAL_LIMITS.nodes}</dd><dt>Scenarios</dt><dd>${page.scenarios.length}</dd></dl><p class="small muted">Select an element in the Outline or on the canvas to see its details.</p>`;
}
function vePageInspectorHtml(definition, node, findings = veReviewFindings(veStore(), { kind: 'page', id: definition.id })) {
  const locked = veUi.mode === 'preview', review = veReviewHtml(findings);
  const note = locked ? '<p id="ve-preview-note" class="ve-pane-note">Preview is read-only. Switch to Design to edit.</p>' : '';
  if (!node) return vePageSummaryHtml(definition) + review;
  const tab = VE_INSPECTOR_TABS.some(([id]) => id === veUi.inspector) ? veUi.inspector : 'essentials';
  const tabs = `<div class="ve-tabs" role="tablist" aria-label="Inspector sections">${VE_INSPECTOR_TABS.map(([id, label]) => `<button type="button" role="tab" id="ve-tab-${id}" aria-controls="ve-tabpanel" aria-selected="${tab === id}" data-action="ve-inspector" data-value="${id}">${label}</button>`).join('')}</div>`;
  const panel = tab === 'data' ? veDataTab(definition, node) : tab === 'actions' ? veActionsTab(definition, node) : veEssentialsTab(definition, node);
  const head = `<span class="ve-eyebrow">${esc(veKindLabel(node))}</span><h2>${esc(veNodeLabel(node))}</h2>`;
  return `${head}${note}${tabs}<fieldset class="ve-inspector-body" data-inspected="${esc(node.id)}"${locked ? ' disabled aria-describedby="ve-preview-note"' : ''}><legend class="ve-sr">Edit ${esc(veNodeLabel(node))}</legend>${veStructureActions()}<div id="ve-tabpanel" role="tabpanel" aria-labelledby="ve-tab-${tab}">${panel}</div></fieldset>${review}`;
}
