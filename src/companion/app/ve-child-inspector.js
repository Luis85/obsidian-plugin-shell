// Child inspector of the component editor: Props (Literal / Parent prop / Form value), Slots (content count and
// "Map slot content"), Events (the child's emits and DOM events → emit a parent event or a local action), Element
// (name, layout, visibility, accessibility) and "Open definition" for project children. Writes capture the element the
// fieldset was rendered for and run once through veCommit; Preview is read-only.
const VE_CHILD_INSPECTOR_TABS = [['props', 'Props'], ['slots', 'Slots'], ['events', 'Events'], ['element', 'Element']];
const VE_CHILD_KINDS = [['literal', 'Literal'], ['prop', 'Parent prop'], ['state', 'Form value']];
const VE_CHILD_FIELDS = ['ve-child-kind', 've-child-prop', 've-child-adapter', 've-child-add-prop', 've-child-emit', 've-child-event'];
const VE_ADAPTER_EVENT = /^[a-zA-Z][a-zA-Z0-9:_-]*$/;
// Declared slots of a child component (catalog entry, pinned revision or live project component).
function veChildSlots(node) { return node.kind === 'component' ? (veNodeContract(veStore(), node)?.slots ?? []) : []; }
// Pure: apply one child field to the node in a copied store.
function veApplyChildField(store, ref, nodeId, field, key, raw) {
  const component = visualDefinition(store, ref), node = component ? visualLocate(visualRoot(component), nodeId)?.node : null;
  visualAssert(node, 'The element no longer exists.');
  if (field === 've-child-adapter') return visualUpdateNode(store, ref, nodeId, { adapter: String(raw).trim() });
  if (field === 've-child-add-prop') {
    const name = String(raw).trim();
    visualAssert(node.kind === 'external', 'Only external library elements take free props.');
    visualAssert(visualIsKey(name), 'Adapter prop names start with a lowercase letter and use only letters and digits.');
    visualAssert(!Object.hasOwn(node.props, name), name + ' is already passed to the adapter.');
    return visualUpdateNode(store, ref, nodeId, { props: { ...node.props, [name]: visualLiteral(null) } });
  }
  if (field === 've-child-emit') {
    if (!raw) return node;
    visualAssert(component.emits?.some(e => e.name === raw), 'Declare the emit ' + raw + ' in Contract → Emits first.');
    return visualAddInteraction(store, ref, nodeId, { event: key, label: 'Emit ' + raw + ' on ' + key, actions: [{ kind: 'emit', event: raw, payload: { kind: 'event' } }] });
  }
  const spec = veValueSpec(store, node, key);
  if (field === 've-child-prop') return veSetExpr(store, ref, node, key, { kind: 'prop', name: String(raw) });
  visualAssert(field === 've-child-kind', 'Unknown child field.');
  if (raw === 'prop') {
    const parent = component.props?.find(p => p.name === key) ?? component.props?.[0];
    visualAssert(parent, 'Declare a prop in Contract → Props first.');
    return veSetExpr(store, ref, node, key, { kind: 'prop', name: parent.name });
  }
  // External props have no catalog default: back to Literal keeps the prop as a null literal.
  if (raw === 'literal' && node.kind === 'external') return veSetExpr(store, ref, node, key, visualLiteral(null));
  return veSetExpr(store, ref, node, key, veBindingExpr(raw, spec, component, node));
}
// External adapters define their own event names. A named event is listed for this session until it is mapped to an
// emit or a local action, which persists it as an interaction.
function veAdapterEvents(node) { return [...new Set([...node.events.map(i => i.event), ...(veUi.adapterEvents[node.id] || [])])]; }
function veAddAdapterEvent(nodeId, raw) {
  const name = String(raw).trim(), component = veCurrentComponent(), node = component ? visualLocate(component.template, nodeId)?.node : null;
  if (node?.kind !== 'external') throw Error('Only external library elements declare adapter events.');
  if (name.length > 60 || !VE_ADAPTER_EVENT.test(name)) throw Error('Adapter event names start with a letter and use only letters, digits, colon, underscore or hyphen (at most 60).');
  if (veAdapterEvents(node).includes(name)) throw Error(name + ' is already listed for adapter ' + node.adapter + '.');
  veUi.adapterEvents = { ...veUi.adapterEvents, [node.id]: [...(veUi.adapterEvents[node.id] || []), name] };
}
function veChildField(el, commit, after = render) {
  if (!VE_CHILD_FIELDS.includes(el.dataset.field)) return false;
  if (!commit) return true;
  veEditable();
  if (el.dataset.field === 've-child-event') { veAddAdapterEvent(el.closest?.('[data-inspected]')?.dataset.inspected || veSelectedId(), el.value); veUi.error = ''; after(); return true; }
  const edit = veCaptureField(el);
  veCommit(store => { veApplyChildField(store, edit.ref, edit.nodeId, edit.field, edit.key, edit.raw); });
  veUi.error = ''; after();
  return true;
}
function veRemoveAdapterProp(key) {
  const id = veSelectedId();
  veWrite((store, ref) => {
    const node = visualLocate(visualRoot(visualDefinition(store, ref)), id)?.node;
    visualAssert(node?.kind === 'external' && Object.hasOwn(node.props, key), 'That adapter prop no longer exists.');
    const props = { ...node.props }; delete props[key];
    return visualUpdateNode(store, ref, id, { props }).id;
  });
}
const VE_CHILD_SESSION_ACTIONS = {
  've-child-tab': value => { veUi.childTab = VE_CHILD_INSPECTOR_TABS.some(([id]) => id === value) ? value : 'props'; },
};
const VE_CHILD_ACTIONS = {
  've-child-local': value => veOpenInteraction('', value),
  've-child-remove-prop': veRemoveAdapterProp,
};
// Markup.
function veKeep(options, value, label) { return value === undefined || options.some(([k]) => k === value) ? options : [[value, label], ...options]; }
function veChildPropRow(component, node, spec) {
  const expr = veCurrentExpr(node, spec.key), kind = expr?.kind ?? 'literal', kinds = kind === 'source' ? [...VE_CHILD_KINDS, ['source', 'Source']] : VE_CHILD_KINDS;
  let value;
  if (kind === 'prop') value = veSelectHtml('Parent prop', 've-child-prop', spec.key, veKeep(component.props.map(p => [p.name, p.name + ' · ' + p.type]), expr.name, expr.name + ' (not declared)'), expr.name);
  else if (kind === 'state') value = veSelectHtml('Form control', 've-bind-state', spec.key, veKeep(veControls(component, node.id).map(n => [n.id, veNodeLabel(n)]), expr.nodeId, expr.nodeId + ' (missing)'), expr.nodeId);
  else if (kind === 'source') value = `<p class="ve-pane-note">${esc(veBindingText(expr, component))}</p>`;
  else value = veControlHtml('ve-prop', { ...spec, label: spec.label + ' value' }, expr ? expr.value : spec.kind === 'boolean' ? spec.default ?? false : undefined);
  const remove = node.kind === 'external' ? button('Remove', 've-child-remove-prop', spec.key, 'small ghost', 'trash', `aria-label="${esc('Stop passing ' + spec.key)}"`) : '';
  return `<div class="ve-binding">${veSelectHtml(spec.label + ' · binding', 've-child-kind', spec.key, kinds, kind)}${value}${remove}</div>`;
}
function veChildPropsTab(component, node) {
  const specs = veValueSpecs(veStore(), node), rows = specs.map(spec => veChildPropRow(component, node, spec)).join('');
  if (node.kind === 'external') {
    const adapter = `<div class="field"><label for="ve-child-adapter-adapter">Adapter name</label><input id="ve-child-adapter-adapter" data-field="ve-child-adapter" data-key="adapter" type="text" value="${esc(node.adapter)}" maxlength="60" spellcheck="false" autocomplete="off"></div>`;
    const add = `<div class="field"><label for="ve-child-add-prop-add">Pass another prop to the adapter</label><input id="ve-child-add-prop-add" data-field="ve-child-add-prop" data-key="add" type="text" value="" placeholder="content" maxlength="60" spellcheck="false" autocomplete="off"></div>`;
    const file = 'presentation/components/library/' + component.libraryId + '/' + node.adapter + '.adapter.ts';
    return `${adapter}<p class="ve-pane-note">${esc('Implemented in code: ' + file + ' mounts ' + node.package + '. Regeneration never overwrites an edited adapter.')}</p>${rows || '<p class="ve-pane-note">No props passed yet.</p>'}${add}`;
  }
  if (node.kind === 'element') {
    const names = [...new Set([...(VE_ELEMENT_ATTRS[node.tag] || []), ...Object.keys(node.attrs)])].filter(k => !node.attrs[k] || node.attrs[k].kind === 'literal');
    return names.map(name => veControlHtml('ve-attr', { key: name, label: 'Attribute ' + name, kind: 'string', type: 'string', options: [] }, node.attrs[name]?.value)).join('') || '<p class="ve-pane-note">This element has no properties. Use Element for its layout.</p>';
  }
  if (node.kind === 'slot') return `<p class="ve-pane-note">${esc('Slot ' + node.name + ' shows what callers pass. Its fallback shows when they pass nothing.')}</p>`;
  const help = component.props.length ? '' : '<p class="ve-pane-note">Declare props in the contract to bind values to them.</p>';
  return help + (rows || '<p class="ve-pane-note">This child declares no properties.</p>');
}
function veChildSlotsTab(component, node) {
  if (node.kind === 'slot') {
    const options = veKeep(component.slots.map(s => [s.name, '#' + s.name]), node.name, '#' + node.name + ' (not declared)');
    return veSelectHtml('Public slot', 've-name', 'name', options, node.name) + `<p class="ve-pane-note">${node.fallback.length} fallback element${node.fallback.length === 1 ? '' : 's'}. Declare more slots in Contract → Slots.</p>`;
  }
  const slots = veChildSlots(node);
  if (!slots.length) return '<p class="ve-pane-note">This element has no slots.</p>';
  return `<ul class="ve-interactions">${slots.map(s => {
    const count = node.slots[s.name]?.length || 0, target = veUi.slotTarget?.nodeId === node.id && veUi.slotTarget.slot === s.name;
    return `<li class="ve-interaction"><div class="ve-interaction-head"><code>#${esc(s.name)}</code>${badge(count ? count + ' element' + (count === 1 ? '' : 's') : 'empty')}${target ? badge('Insert target', 'good') : ''}</div>${s.description ? `<p class="ve-pane-note">${esc(s.description)}</p>` : ''}${button('Map slot content', 've-map-slot', s.name, 'small', 'plus', `aria-label="${esc('Map content into slot ' + s.name)}"`)}</li>`;
  }).join('')}</ul>`;
}
function veChildEventsTab(component, node) {
  if (!Array.isArray(node.events)) return '<p class="ve-pane-note">Text and slots have no events.</p>';
  const external = node.kind === 'external', emits = component.emits.map(e => [e.name, 'Emit ' + e.name]);
  const events = [...new Set([...(external ? veAdapterEvents(node) : []), ...veEventChoices(veStore(), node), ...node.events.map(i => i.event)])];
  const adapter = external ? `<div class="field"><label for="ve-child-event-add">Adapter event name</label><input id="ve-child-event-add" data-field="ve-child-event" data-key="add" type="text" value="" placeholder="update:content" maxlength="60" spellcheck="false" autocomplete="off" aria-describedby="ve-child-event-hint"><p id="ve-child-event-hint" class="ve-pane-note">The adapter defines its own events, for example update:content. Name one, then map it to an emit or a local action.</p></div>` : '';
  return `<ul class="ve-interactions">${events.map(event => {
    const mapped = node.events.filter(i => i.event === event).map(i => `<li><strong>${esc(i.label)}</strong> <span class="ve-pane-note">${esc(i.actions.length ? i.actions.map(a => veActionSummary(a, component)).join(', ') : 'Implementation required')}</span><span class="ve-inspector-actions">${button('Edit', 've-interaction-edit', i.id, 'small', '', `aria-label="${esc('Edit ' + i.label)}"`)}${button('Remove', 've-interaction-remove', i.id, 'small ghost', 'trash', `aria-label="${esc('Remove ' + i.label)}"`)}</span></li>`).join('');
    const emit = emits.length ? veSelectHtml('Emit parent event', 've-child-emit', event, [['', 'Choose an emit…'], ...emits], '') : '';
    return `<li class="ve-interaction"><div class="ve-interaction-head">${badge('@' + event)}</div>${mapped ? `<ul>${mapped}</ul>` : ''}${emit}${button('Local action…', 've-child-local', event, 'small', 'spark', `aria-label="${esc('Add a local action on ' + event)}"`)}</li>`;
  }).join('')}</ul>${adapter}${emits.length ? '' : '<p class="ve-pane-note">Declare an emit in Contract → Emits to forward child events with their payload.</p>'}`;
}
function veChildElementTab(node) {
  const name = node.kind === 'slot' ? '' : veControlHtml('ve-name', { key: 'name', label: 'Name', kind: 'string', type: 'string', options: [], default: veKindLabel(node) }, node.name);
  const kind = node.kind === 'element' ? veSelectHtml('Element', 've-tag', 'tag', VISUAL_TAGS.map(t => [t, t + ' · ' + (VE_TAG_LABELS[t] || t)]), node.tag) : node.kind === 'text' ? veSelectHtml('Text role', 've-role', 'role', VISUAL_TEXT_ROLES.map(r => [r, r]), node.role) : '';
  const a11y = `<div class="field"><label for="ve-a11y-a11y">Accessibility notes</label><textarea id="ve-a11y-a11y" data-field="ve-a11y" data-key="a11y" rows="2" maxlength="2000">${esc(node.a11y ?? '')}</textarea></div>`;
  return name + kind + veSection('Layout', veLayoutHtml(node)) + veSection('Visibility', veVisibilityHtml(node)) + veSection('Accessibility', a11y);
}
function veChildInspectorHtml(component, node) {
  const tab = VE_CHILD_INSPECTOR_TABS.some(([id]) => id === veUi.childTab) ? veUi.childTab : 'props', locked = veUi.mode === 'preview';
  const tabs = `<div class="ve-tabs" role="tablist" aria-label="Child sections">${VE_CHILD_INSPECTOR_TABS.map(([id, label]) => `<button type="button" role="tab" id="ve-chtab-${id}" aria-controls="ve-chtabpanel" aria-selected="${tab === id}" data-action="ve-child-tab" data-value="${id}">${label}</button>`).join('')}</div>`;
  const panel = tab === 'slots' ? veChildSlotsTab(component, node) : tab === 'events' ? veChildEventsTab(component, node) : tab === 'element' ? veChildElementTab(node) : veChildPropsTab(component, node);
  const open = node.kind === 'component' && node.ref.kind === 'project' ? button('Open definition', 've-open-definition', node.ref.componentId, 'small ghost', 'arrow', `aria-label="${esc('Open definition of ' + veNodeLabel(node))}"`) : '';
  const note = locked ? '<p id="ve-preview-note" class="ve-pane-note">Preview is read-only. Switch to Design to edit.</p>' : '';
  return `<span class="ve-eyebrow">Child · ${esc(veKindLabel(node))}</span><div class="ve-child-head"><h2>${esc(veNodeLabel(node))}</h2>${open}</div>${note}${tabs}<fieldset class="ve-inspector-body" data-inspected="${esc(node.id)}"${locked ? ' disabled aria-describedby="ve-preview-note"' : ''}><legend class="ve-sr">Edit ${esc(veNodeLabel(node))}</legend>${veStructureActions()}<div id="ve-chtabpanel" role="tabpanel" aria-labelledby="ve-chtab-${tab}">${panel}</div></fieldset>`;
}
