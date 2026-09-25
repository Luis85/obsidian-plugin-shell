// Safe symbolic wireframe. Imported strings are escaped, not compiled or executed.
function dtPreview(doc) {
  const budget = { remaining: 500 }, content = dtPreviewNodes(doc, null, [], dtUi.previewState, budget);
  return `<section class="dt-preview-shell" aria-label="Detail design preview"><div class="dt-preview-tools"><div class="row wrap" role="group" aria-label="Preview state">${DETAIL_STATES.map(s => button(s, 'dt-state', s, 'small' + (dtUi.previewState === s ? ' selected' : ''), '', `aria-pressed="${dtUi.previewState === s}"`)).join('')}</div><div class="row" role="group" aria-label="Preview width">${['wide', 'narrow'].map(w => button(w === 'wide' ? 'Wide' : 'Narrow', 'dt-width', w, 'small' + (dtUi.width === w ? ' selected' : ''), '', `aria-pressed="${dtUi.width === w}"`)).join('')}</div></div>
    <p class="small muted">Symbolic wireframe · State: ${esc(dtUi.previewState)} · Controls are intentionally inert. Layout follows parent regions and reading order, not canvas coordinates. ${dtVisibleIds(doc, dtUi.previewState).size}/${doc.nodes.length} local elements visible after ancestor rules.</p>
    <div class="dt-wireframe ${dtUi.width === 'narrow' ? 'is-narrow' : ''}" data-preview-state="${esc(dtUi.previewState)}">${content || '<p class="dt-empty">No elements are visible in this state.</p>'}${budget.remaining < 0 ? '<p class="warning">Preview element limit reached. Inspect smaller portions of this design.</p>' : ''}</div></section>`;
}
function dtPreviewNodes(doc, parent, stack, stateName, budget) {
  return doc.nodes.filter(n => n.parentId === parent && n.visibleIn.includes(stateName)).map(n => {
    if (--budget.remaining < 0) return '';
    const label = esc(n.label), content = esc(n.text || n.label);
    if (n.kind === 'region') return `<section class="dt-wire-region layout-${n.layout}"><span class="dt-wire-label">${label}</span>${dtPreviewNodes(doc, n.id, stack, stateName, budget)}</section>`;
    if (n.kind === 'text') return `<p class="dt-wire-text">${content}</p>`;
    if (n.kind === 'input') return `<label class="dt-wire-input"><span>${label}</span><input readonly tabindex="-1" placeholder="${esc(n.text)}" aria-label="${label}"></label>`;
    if (n.kind === 'button') return `<span class="dt-wire-button ${stateName === 'disabled' ? 'is-disabled' : ''}" role="img" aria-label="Button wireframe: ${label}">${content}</span>`;
    if (n.kind === 'slot') return `<div class="dt-wire-slot"><small>Slot: ${label}</small><p>${esc(n.text || 'Consumer-provided content')}</p></div>`;
    const c = design().library.find(c => c.id === n.component.id), detail = dtFind(dtStore(), 'component', n.component.id);
    const nested = detail && !stack.includes(n.component.id) && stack.length < 8 && c?.version === n.component.version;
    const rows = dtPropRows(n), props = Object.fromEntries(rows.filter(r => r.value !== undefined).map(r => [r.name, r.value]));
    return `<section class="dt-wire-component"><div class="dt-wire-component-title"><strong>${esc(c?.name || n.component.label)}</strong><small>v${esc(n.component.version)} · ${esc(n.component.variantId)}</small></div>${nested ? dtPreviewNodes(detail, null, [...stack, n.component.id], stateName, budget) : `<p class="small muted">${esc(!c ? 'Definition missing — reference retained.' : c.version !== n.component.version ? 'Contract version changed — review the instance before previewing current internals.' : 'Reusable component wireframe. Design its internals in the component editor.')}</p>`}${Object.keys(props).length ? `<dl class="dt-wire-props">${Object.entries(props).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(String(value))} <small class="muted">${esc(rows.find(r => r.name === key)?.source)}</small></dd>`).join('')}</dl>` : ''}</section>`;
  }).join('');
}
