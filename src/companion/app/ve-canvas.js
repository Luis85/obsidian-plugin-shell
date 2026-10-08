// Visual IR canvas: one deterministic HTML string per definition, scenario session and viewport.
// Design mode shows every node (hidden ones dimmed with the reason); preview omits what visualVisible hides.
// Controls are inert markup; project components render their own template, external libraries a placeholder.
const VE_VIEWPORTS = ['desktop', 'tablet', 'mobile'];
const VE_MODES = ['design', 'preview', 'review', 'compare'];
const VE_RENDER_LIMIT = 600;
const VE_TAG_LABELS = { div: 'Group', section: 'Section', header: 'Header', main: 'Main content', footer: 'Footer', nav: 'Navigation', aside: 'Aside', button: 'Button', input: 'Input', label: 'Label', p: 'Paragraph', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', span: 'Inline text', ul: 'List', li: 'List item', img: 'Image' };
// Inline style text for a compositionStyle result (camelCase keys to CSS properties), escaped for an attribute.
function veStyleAttr(style) {
  return esc(Object.entries(style).map(([key, value]) => key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + value).join(';'));
}
// Layout rules become the same region style the generated runtime applies to the node's root (use-visual style()).
function veLayoutRules(node, ctx) { return node.layout ? compositionStyle({ kind: 'region', layout: node.layout.mode, ui: node.layout.ui }, ctx.system, ctx.narrow) : {}; }
function veLayoutStyle(node, ctx) { return veStyleAttr(veLayoutRules(node, ctx)); }
// Catalog nodes: the Nuxt component root gets the full style; the selectable wrapper around it keeps only sizing.
function veSizingStyle(node, ctx) {
  const rules = veLayoutRules(node, ctx);
  return veStyleAttr(Object.fromEntries(['boxSizing', 'width', 'minWidth', 'maxWidth'].filter(key => Object.hasOwn(rules, key)).map(key => [key, rules[key]])));
}
function veKindLabel(node) {
  if (node.kind === 'element') return VE_TAG_LABELS[node.tag] || node.tag;
  if (node.kind === 'text') return 'Text · ' + node.role;
  if (node.kind === 'slot') return 'Slot · ' + node.name;
  if (node.kind === 'external') return 'External · ' + node.package;
  if (node.ref?.kind === 'nuxt-ui') return visualCatalogEntry(node.ref.entryId)?.component || node.ref.entryId;
  return 'Component';
}
function veNodeLabel(node) { return node.name || veKindLabel(node); }
// The node's own rule that hides it in this session; ancestors report their own reason.
function veHiddenReason(node, session) {
  if (session.hidden[node.id] === true) return 'hidden by interaction';
  if (node.visibleIn && !node.visibleIn.includes(session.state)) return 'hidden in ' + session.state;
  if (session.width === 'narrow' && node.layout?.ui.narrow.hidden) return 'hidden on mobile';
  return '';
}
// Node wrapper. The canvas is not an accessible widget: the Outline is the one tree. While designing, a node is a
// click/focus target and the selected one carries aria-current plus a visible ring and label chip. Preview keeps only
// the node id, so assistive technology reads the rendered app. A component's internals are never targets here.
function veWrap(node, ctx, classes, inner, style = '') {
  const target = ctx.selectable && ctx.design, chosen = target && ctx.selected === node.id, reason = ctx.design ? veHiddenReason(node, ctx.session) : '';
  const attrs = !ctx.selectable ? '' : target ? ` data-ve-node="${esc(node.id)}" data-action="ve-select" data-value="${esc(node.id)}" tabindex="-1"${chosen ? ' aria-current="true"' : ''}` : ` data-ve-node="${esc(node.id)}"`;
  const chip = chosen ? `<span class="ve-chip" aria-hidden="true">${esc(veNodeLabel(node))}</span>` : '';
  const badge = reason ? `<span class="ve-hidden-badge">${esc(reason)}</span>` : '';
  return `<div class="ve-node ${classes}${reason ? ' ve-is-hidden' : ''}${chosen ? ' ve-is-selected' : ''}"${attrs}${style ? ` style="${style}"` : ''}>${chip}${badge}${inner}</div>`;
}
function veRenderList(nodes, ctx) { return (nodes || []).map(node => veRenderNode(node, ctx)).join(''); }
function veRenderNode(node, ctx) {
  if (!ctx.design && !visualVisible(ctx.def, ctx.session, node.id)) return '';
  if (++ctx.budget.count > VE_RENDER_LIMIT) return '';
  if (node.kind === 'element') return veElementHtml(node, ctx);
  if (node.kind === 'text') return veWrap(node, ctx, 've-text ve-t-' + node.role, veValueHtml(node.value, ctx), veLayoutStyle(node, ctx));
  if (node.kind === 'slot') return veSlotNodeHtml(node, ctx);
  if (node.kind === 'external') return veExternalHtml(node, ctx);
  if (node.ref?.kind === 'project') return veInstanceHtml(node, ctx);
  const entry = visualCatalogEntry(node.ref?.entryId);
  if (!entry) return veWrap(node, ctx, 've-missing', `<span>${esc('Unknown catalog entry ' + (node.ref?.entryId || ''))}</span>`);
  return veWrap(node, ctx, 've-ui ve-ui-' + entry.preview, veCatalogPreview(node, entry, ctx, veLayoutStyle(node, ctx)), veSizingStyle(node, ctx));
}
function veValueHtml(expr, ctx) {
  const text = veShow(visualValue(ctx.session, expr, ctx.props));
  return text ? esc(text) : veHintHtml(expr, ctx);
}
function veAttrText(node, name, ctx) { return node.attrs?.[name] ? veShow(visualValue(ctx.session, node.attrs[name], ctx.props)) : ''; }
function veElementHtml(node, ctx) {
  const style = veLayoutStyle(node, ctx), tag = node.tag;
  if (tag === 'img') {
    const alt = veAttrText(node, 'alt', ctx);
    return veWrap(node, ctx, 've-el ve-el-img', `<span class="ve-img-placeholder"><span class="ve-u-icon" aria-hidden="true"></span>${esc(alt || (ctx.design ? 'Image without alternative text' : ''))}</span>`, style);
  }
  if (tag === 'input') {
    const placeholder = veAttrText(node, 'placeholder', ctx), value = Object.hasOwn(ctx.session.values, node.id) ? veShow(ctx.session.values[node.id]) : veAttrText(node, 'value', ctx);
    return veWrap(node, ctx, 've-el ve-el-input', `<span class="ve-u-input">${value ? `<span class="ve-u-value">${esc(value)}</span>` : `<span class="ve-u-placeholder">${esc(placeholder)}</span>`}</span>`, style);
  }
  const children = veRenderList(node.children, ctx);
  const empty = !children && ctx.design ? `<span class="ve-empty-hint">Empty ${esc((VE_TAG_LABELS[tag] || tag).toLowerCase())}</span>` : '';
  return veWrap(node, ctx, 've-el ve-el-' + tag + (node.layout ? ' ve-has-layout' : ''), children + empty, style);
}
// Inside an instance, a slot shows the instance's content, rendered in the outer (selectable) definition's context.
// Otherwise it shows its fallback, labelled while designing.
function veSlotNodeHtml(node, ctx) {
  const fill = ctx.fills?.[node.name], style = veLayoutStyle(node, ctx);
  if (fill?.nodes.length) return `<div class="ve-slot-fill"${style ? ` style="${style}"` : ''}>${veRenderList(fill.nodes, fill.ctx)}</div>`;
  const label = ctx.design ? `<span class="ve-slot-label">Slot · ${esc(node.name)}${node.fallback.length ? ' · fallback' : ''}</span>` : '';
  return veWrap(node, ctx, 've-slot', label + veRenderList(node.fallback, ctx), style);
}
// External libraries (spec §13) are never loaded: the canvas shows what the hand-owned adapter will receive.
function veExternalHtml(node, ctx) {
  const version = (ctx.dependencies || []).find(d => d.package === node.package)?.version || '?';
  const props = Object.keys(node.props || {});
  const list = props.length ? `<ul class="ve-external-props">${props.map(name => `<li><code>${esc(name)}</code>${ctx.design ? ' ' + veValueHtml(node.props[name], ctx) : ''}</li>`).join('')}</ul>` : '<span class="ve-muted">No props passed to the adapter.</span>';
  return veWrap(node, ctx, 've-external', `<strong class="ve-external-title">${esc('External · ' + node.package + '@' + version + ' · adapter ' + node.adapter)}</strong><span class="ve-muted">Implemented in code by the adapter. The package is not loaded in this concept.</span>${list}`, veLayoutStyle(node, ctx));
}
// Instance props for a nested component: contract defaults, then the variant, then the instance's own expressions.
function veInstanceProps(node, contract, ctx) {
  const out = {};
  for (const p of contract.props) if (p.default !== undefined) out[p.name] = p.default;
  Object.assign(out, contract.variants.find(v => v.id === node.variantId)?.values || {});
  for (const [name, expr] of Object.entries(node.props || {})) { const value = visualValue(ctx.session, expr, ctx.props); if (value !== undefined) out[name] = value; }
  return out;
}
function veInstanceHtml(node, ctx) {
  const component = ctx.store.components.find(c => c.id === node.ref.componentId);
  const revision = node.ref.revisionId ? ctx.store.revisions.find(r => r.id === node.ref.revisionId) : null;
  const target = revision ? { ...revision.contract, template: revision.template, dependencies: revision.dependencies } : component;
  const name = component?.exportName || node.ref.componentId, tag = `<span class="ve-instance-tag">${esc(name)}${revision ? ' · v' + esc(revision.version) : ''}${node.variantId ? ' · ' + esc(target?.variants.find(v => v.id === node.variantId)?.name || node.variantId) : ''}</span>`;
  const key = node.ref.revisionId || node.ref.componentId;
  if (!target) return veWrap(node, ctx, 've-instance ve-missing', tag + '<span class="ve-muted">Component definition is missing. The reference is retained.</span>');
  if (ctx.stack.includes(key) || ctx.stack.length >= VISUAL_LIMITS.composition) return veWrap(node, ctx, 've-instance', tag + '<span class="ve-muted">Nested component preview limit reached.</span>');
  const fills = Object.fromEntries(Object.entries(node.slots || {}).map(([slot, nodes]) => [slot, { nodes, ctx }]));
  // The internals preview in the component's default state at the page's width; they belong to another definition.
  const inner = { ...ctx, def: target, props: veInstanceProps(node, target, ctx), session: { ...visualSession(), width: ctx.session.width }, selectable: false, fills, stack: [...ctx.stack, key], dependencies: target.dependencies || [] };
  return veWrap(node, ctx, 've-instance', tag + veRenderList(target.template, inner), veLayoutStyle(node, ctx));
}
function veDefinitionName(definition) { return definition.name || definition.exportName || definition.id; }
// Component definitions preview with their contract defaults unless the caller passes props (variant or scenario).
function veDefinitionProps(definition, props) {
  const defaults = Object.fromEntries((definition.props || []).filter(p => p.default !== undefined).map(p => [p.name, p.default]));
  return { ...defaults, ...(props || {}) };
}
function veCanvasHtml(definition, session, { mode = 'design', selected = null, viewport = 'desktop', props = {} } = {}) {
  const view = VE_VIEWPORTS.includes(viewport) ? viewport : 'desktop', kind = VE_MODES.includes(mode) ? mode : 'design', narrow = view === 'mobile';
  const d = design(), current = { ...session, width: narrow ? 'narrow' : 'wide' };
  const ctx = { def: definition, session: current, props: veDefinitionProps(definition, props), design: kind !== 'preview', selected, narrow, system: d.designSystem, store: veStore(d), selectable: true, fills: null, stack: [], budget: { count: 0 }, dependencies: definition.dependencies || [] };
  const content = veRenderList(visualRoot(definition), ctx);
  // Status messages follow the rendered nodes, never inside one of them.
  const empty = visualRoot(definition).length ? (content ? '' : '<p class="ve-canvas-empty">No elements are visible in this scenario.</p>')
    : `<p class="ve-canvas-empty">${ctx.design ? 'This design is empty. Insert a pattern, layout or component to start.' : 'Nothing to preview yet.'}</p>`;
  const limit = ctx.budget.count > VE_RENDER_LIMIT ? '<p class="ve-limit" role="status">Preview limit reached. Open a smaller part of this design.</p>' : '';
  const theme = veStyleAttr(compositionTheme(d.designSystem, typeof state !== 'undefined' && state.settings?.theme === 'dark'));
  return `<div class="ve-stage ve-mode-${kind}"><div class="ve-frame ve-vp-${view}" data-ve-canvas="${esc(definition.id)}" data-scenario-state="${esc(current.state)}" role="region" aria-label="${esc(veDefinitionName(definition) + ' canvas · ' + kind + ' · ' + view)}"${theme ? ` style="${theme}"` : ''}>${content}${empty}${limit}</div></div>`;
}
