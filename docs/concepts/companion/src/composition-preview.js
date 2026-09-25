// Inert review by default; Play executes only the bounded, declared UI effects.
function cpSession(doc) {
  if (!cpUi.session || cpUi.sessionDoc !== doc.id) {
    cpUi.session = compositionSession(doc.scenarios?.find(s => s.id === cpUi.scenario)); cpUi.sessionDoc = doc.id; cpUi.instances = {};
    cpUi.session.state = dtUi.previewState; cpUi.session.width = dtUi.width;
  }
  return cpUi.session;
}
function cpPreview(doc) {
  const session = cpSession(doc); cpUi.rendered = {};
  const owner = dtOwner(doc), variants = doc.kind === 'component' && owner ? componentVariants(owner) : [];
  const chosenScenario=doc.scenarios?.find(s=>s.id===cpUi.scenario);
  const controls = `${chosenScenario?.recipe?`<p class="small">Captured recipe ${esc(chosenScenario.recipe.operationId)} · seed ${chosenScenario.recipe.seed} · ${chosenScenario.recipe.fingerprint===cpRecipeFingerprint()?'Matches current recipe settings':'Recipe settings changed — captured values are retained'}</p>`:''}<div class="cp-preview-toolbar"><div class="row wrap">${button(cpUi.play ? 'Stop interaction preview' : 'Play interactions', 'cp-play', '', cpUi.play ? 'small primary' : 'small')}${button('Reset preview', 'cp-reset', '', 'small')}${button('New fixture scenario', 'cp-scenario', '', 'small')}${button('Export UI effect tests', 'cp-tests', '', 'small')}${button(cpUi.compare ? 'Single preview' : 'Compare frames', 'cp-compare', '', 'small')}</div>
    <div class="row wrap">${cpField('Fixture scenario', 'preview-scenario', cpUi.scenario, [['', 'No fixture — authored content'], ...(doc.scenarios || []).map(s => [s.id, s.name])])}${cpUi.scenario ? button('Edit fixture', 'cp-scenario', cpUi.scenario, 'small') : ''}</div></div>`;
  const states = `<div class="dt-preview-tools"><div class="row wrap" aria-label="Preview state">${DETAIL_STATES.map(s => button(s, 'dt-state', s, 'small' + (session.state === s ? ' selected' : ''), '', `aria-pressed="${session.state === s}"`)).join('')}</div><div class="row">${['wide', 'narrow'].map(w => button(w, 'dt-width', w, 'small' + (session.width === w ? ' selected' : ''))).join('')}</div></div>`;
  const render = (props, scope, frameSession = session) => cpRenderNodes(doc, null, { session:frameSession, props, slots: {}, system: design().designSystem, stack: [], scope, budget: { count: 0 } });
  const props = Object.fromEntries((variants.find(v => v.id === cpUi.variantA)?.props ? Object.entries(variants.find(v => v.id === cpUi.variantA).props) : []));
  let content = render(props, 'root');
  if (cpUi.compare && (cpUi.comparison || (variants.length>1?'variants':'widths')) === 'variants' && variants.length > 1) {
    const a = variants.find(v => v.id === cpUi.variantA) || variants[0], b = variants.find(v => v.id === cpUi.variantB) || variants[1];
    content = `<div class="cp-compare"><section>${cpField('First variant', 'preview-variantA', a.id, variants.map(v => [v.id, v.name]))}${render(a.props || {}, 'compare-a')}</section><section>${cpField('Second variant', 'preview-variantB', b.id, variants.map(v => [v.id, v.name]))}${render(b.props || {}, 'compare-b')}</section></div>`;
  }
  if(cpUi.compare && (cpUi.comparison|| (variants.length>1?'variants':'widths')) !== 'variants') {
    const states = cpUi.comparison==='states', a={...session,state:states?'default':session.state,width:states?session.width:'wide'},b={...session,state:states?'error':session.state,width:states?session.width:'narrow'};
    content=`<div class="cp-compare"><section><h3>${states?'Default state':'Wide container'}</h3>${render(props,'compare-a',a)}</section><section><h3>${states?'Error state':'Narrow container'}</h3>${render(props,'compare-b',b)}</section></div>`;
  }
  const comparison=cpUi.compare ? cpField('Compare','preview-comparison',cpUi.comparison||(variants.length>1?'variants':'widths'),[...(variants.length>1?[['variants','Component variants']]:[]),['widths','Wide and narrow'],['states','Default and error']]):'';
  return `<section class="dt-preview-shell" aria-label="Detail design preview">${controls}${comparison}${states}<p class="small muted">${cpUi.play ? 'Interaction preview uses local fixture state only. No source provider, vault write or business handler runs.' : 'Review mode · Controls are inert. Enable Play to exercise declared UI effects.'} · Narrow rules use the container width. Pinned components use their published internals and token values.</p><p role="status" class="cp-preview-message">${esc(cpUi.message)}</p><div class="dt-wireframe ${session.width === 'narrow' ? 'is-narrow' : ''}" data-preview-state="${session.state}" style="${esc(Object.entries(compositionTheme(design().designSystem,state.settings.theme==='dark')).map(([k,v])=>k+':'+v).join(';'))}">${content || '<p>No elements visible in this scenario.</p>'}</div>${session.emitted.length ? `<p role="status">Emitted: ${esc(session.emitted.map(e => e.name).join(', '))}</p>` : ''}</section>`;
}
function cpRenderNodes(doc, parent, ctx) {
  return doc.nodes.filter(n => n.parentId === parent && compositionVisible(doc, ctx.session, n)).map(n => cpRenderNode(doc, n, ctx)).join('');
}
function cpRenderNode(doc, n, ctx) {
  if (++ctx.budget.count > 500 || ctx.stack.length > 12) return '<p class="warning">Preview limit reached. Inspect a smaller design.</p>';
  const key = ctx.scope + ':' + n.id; cpUi.rendered[key] = { doc, node: n, session: ctx.session, scope: ctx.scope, parent: ctx.parent };
  const value = cpNodeValue(doc, n, ctx.session, ctx.props), text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  const disabled = !cpUi.play || ['loading', 'disabled'].includes(ctx.session.state), label = esc(n.label), id = 'cp-' + key;
  const attrs = `data-cp-key="${esc(key)}" data-design-node="${esc(n.id)}" style="${cpStyleAttr(n, ctx.system, ctx.session.width === 'narrow')}"`;
  const input = `id="${esc(id)}" aria-label="${label}" data-cp-key="${esc(key)}" ${disabled ? 'disabled' : ''}`;
  const children = () => cpRenderNodes(doc, n.id, ctx);
  if (n.kind === 'region') return `<section ${attrs} class="dt-wire-region layout-${ctx.session.width === 'narrow' ? n.ui?.narrow.layout || 'stack' : n.layout}">${children()}</section>`;
  if (n.kind === 'component') {
    const resolved = cpResolved(n), props = Object.fromEntries(dtPropRows(n).filter(p => p.value !== undefined).map(p => [p.name, p.value]));
    if (!resolved || ctx.stack.includes(n.component.revisionId || n.component.id)) return `<section ${attrs} class="warning">${label}: reusable definition unavailable; reference retained.</section>`;
    const nestedScope = key, session = cpUi.instances[nestedScope] ||= { ...compositionSession(), state: ctx.session.state, width: ctx.session.width, bindings: ctx.session.bindings };
    if(!cpUi.play){session.state=ctx.session.state;session.width=ctx.session.width;}
    const slots = Object.fromEntries([...new Set(doc.nodes.filter(c => c.parentId === n.id).map(c => c.slotName))].map(name => [name, () => doc.nodes.filter(c => c.parentId === n.id && c.slotName === name && compositionVisible(doc, ctx.session, c)).map(c => cpRenderNode(doc, c, ctx)).join('')]));
    const content = cpRenderNodes(resolved.document, null, { ...ctx, props, session, slots, scope: nestedScope, parent: { doc, node: n, session: ctx.session, scope: ctx.scope, parent: ctx.parent }, system: resolved.designSystem, stack: [...ctx.stack, n.component.revisionId || n.component.id] });
    return `<section ${attrs} class="dt-wire-component"><div style="${esc(Object.entries(compositionTheme(resolved.designSystem,state.settings.theme==='dark')).map(([k,v])=>k+':'+v).join(';'))}"><div class="dt-wire-component-title"><strong>${label}</strong><small>${esc(n.component.revisionId || 'Working definition')} · ${esc(n.component.variantId)}</small></div>${Object.keys(props).length?`<p class="small muted dt-wire-props">${Object.entries(props).map(([key,value])=>esc(key)+': '+esc(String(value))).join(' · ')}</p>`:''}${content}</div></section>`;
  }
  if (n.kind === 'slot') return `<div ${attrs} class="dt-wire-slot">${ctx.slots[n.label] ? ctx.slots[n.label]() : children() || esc(text || 'Slot: ' + n.label)}</div>`;
  if (n.kind === 'heading') return `<h3 ${attrs}>${esc(text || n.label)}</h3>`;
  if (n.kind === 'divider') return `<hr ${attrs}>`;
  if (n.kind === 'image') return `<div ${attrs} role="img" aria-label="${label}" class="cp-image-placeholder">${label}<small>Asset placeholder · ${esc(text)}</small></div>`;
  if (n.kind === 'button') return `<button ${attrs} type="button" class="dt-wire-button" ${disabled ? 'disabled' : ''}>${esc(text || n.label)}</button>`;
  if (n.kind === 'input' || n.kind === 'number') return `<label ${attrs} class="dt-wire-input"><span>${label}</span><input ${input} type="${n.kind === 'number' ? 'number' : 'text'}" ${!cpUi.play ? 'readonly tabindex="-1"' : ''} value="${esc(Object.hasOwn(ctx.session.values,n.id)||n.binding||n.contentProp ? text : '')}" placeholder="${esc(text)}"></label>`;
  if (n.kind === 'textarea') return `<label ${attrs} class="dt-wire-input">${label}<textarea ${input} placeholder="${esc(n.text)}">${esc(Object.hasOwn(ctx.session.values,n.id)||n.binding||n.contentProp ? text : '')}</textarea></label>`;
  if (n.kind === 'checkbox') return `<label ${attrs} class="cp-checkbox"><input ${input} type="checkbox" ${value === true || value === 'true' ? 'checked' : ''}>${label}</label>`;
  if (n.kind === 'tabs') return `<div ${attrs}><span>${label}</span><div class="cp-tabs" role="tablist" aria-label="${label}">${(n.options || []).map((o,i) => `<button type="button" role="tab" data-cp-key="${esc(key)}" data-tab-value="${esc(o)}" aria-selected="${o === value || !value && i===0}" ${disabled?'disabled':''}>${esc(o)}</button>`).join('')}</div></div>`;
  if (n.kind === 'select') return `<label ${attrs} class="dt-wire-input">${label}<select ${input}>${(n.options || []).map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  if (n.kind === 'table') {
    const rows = Array.isArray(value) ? value.slice(0, 50) : [], columns = n.options?.length ? n.options : Object.keys(rows[0] || {});
    return `<div ${attrs} class="cp-table-scroll"><table><caption>${label}</caption><thead><tr>${columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${esc(row?.[c] == null ? '' : String(row[c]))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${Math.max(1, columns.length)}">${esc(n.text || 'No fixture rows. Add a scenario to preview records.')}</td></tr>`}</tbody></table></div>`;
  }
  if (n.kind === 'list') return `<section ${attrs}><strong>${label}</strong><ul>${(Array.isArray(value) ? value : n.options || [text]).slice(0, 50).map(v => `<li>${esc(typeof v === 'object' ? JSON.stringify(v) : String(v))}</li>`).join('')}</ul></section>`;
  return `<${n.kind === 'alert' ? 'aside' : 'p'} ${attrs} class="${n.kind === 'alert' ? 'warning' : 'dt-wire-text'}">${esc(text || n.label)}</${n.kind === 'alert' ? 'aside' : 'p'}>`;
}
function cpPreviewEvent(event) {
  if (!cpUi.play || dtUi.mode !== 'preview') return;
  const el = event.target.closest('[data-cp-key]'), item = el && cpUi.rendered?.[el.dataset.cpKey]; if (!item) return;
  if (event.type === 'input') {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) && !event.target.disabled) item.session.values[item.node.id] = event.target.type === 'checkbox' ? event.target.checked : event.target.type==='number' && event.target.value!=='' ? Number(event.target.value) : event.target.value;
    return;
  }
  const eventName=event.target.dataset.tabValue!==undefined?'change':event.type;
  if (event.target.dataset.tabValue !== undefined) { item.session.values[item.node.id] = event.target.dataset.tabValue; if (!item.doc.edges.some(e => e.source===item.node.id && e.event===eventName)) { render(); return; } }
  const edge = item.doc.edges.find(e => e.source === item.node.id && e.event === eventName); if (!edge) return;
  event.preventDefault();
  try {
    let owner = item, currentEdge = edge, next;
    for (let depth = 0; depth < 13; depth++) {
      next = compositionTransition(owner.doc, owner.session, currentEdge.id); Object.assign(owner.session, next);
      const parent = owner.parent;
      if (currentEdge.effect?.type !== 'emit' || !parent) break;
      const consumer = parent.doc.edges.find(e => e.source === parent.node.id && e.event === currentEdge.effect.value);
      if (!consumer) break;
      owner = parent; currentEdge = consumer;
    }
    cpUi.message = next.navigation ? 'Navigation requested: ' + (design().nodes.find(n => n.id === next.navigation)?.label || next.navigation) + '. Open the target from its editor link.' : 'Executed UI effect: ' + edge.label;
    if (next.navigation) { const target=design().nodes.find(n=>n.id===next.navigation); if(target && dtPageEligible(target)) { dtOpen('page',target.id);dtUi.mode='preview';cpUi.play=true; cpUi.message='Navigated to '+target.label+' in the local preview.'; } }
    render(); if (next.focused) { const target=document.querySelector('[data-design-node="' + next.focused + '"]'); (target?.matches('button,input,select,textarea')?target:target?.querySelector('input,select,textarea,button'))?.focus(); }
  } catch (error) { cpUi.message = error.message; const out = document.querySelector('.cp-preview-message'); if (out) out.textContent = cpUi.message; }
}
for (const type of ['click', 'change', 'input']) document.addEventListener(type, cpPreviewEvent);
