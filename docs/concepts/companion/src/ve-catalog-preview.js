// Static, inert Nuxt UI-styled previews for pinned catalog entries (keyed by entry.preview).
// Every value is escaped; nothing is compiled, executed or fetched. Image sources are never loaded.
const VE_TONES = ['primary', 'neutral', 'success', 'warning', 'error', 'info'];
const VE_VARIANTS = ['solid', 'outline', 'soft', 'subtle', 'ghost', 'link'];
const VE_ROW_LIMIT = 50, VE_COLUMN_LIMIT = 12, VE_ITEM_LIMIT = 12;
// Resolved prop value: a preview value set by an interaction, then the authored expression, then the catalog default.
function veProp(node, entry, name, ctx) {
  if (name === 'modelValue' && Object.hasOwn(ctx.session.values, node.id)) return ctx.session.values[node.id];
  const expr = node.props?.[name];
  if (expr) { const value = visualValue(ctx.session, expr, ctx.props); if (value !== undefined) return value; }
  return entry.props.find(p => p.name === name)?.default;
}
function veShow(value) {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
// A short, escaped description of an unresolved binding; shown only while designing.
function veExprHint(expr) {
  if (!expr || expr.kind === 'literal') return '';
  if (expr.kind === 'prop') return '{' + expr.name + '}';
  if (expr.kind === 'state') return '{value of ' + expr.nodeId + '}';
  return '{' + [expr.sourceId, expr.operationId, expr.field].filter(Boolean).join(' · ') + '}';
}
function veHintHtml(expr, ctx) {
  const hint = ctx.design ? veExprHint(expr) : '';
  return hint ? `<span class="ve-bind" title="Bound value">${esc(hint)}</span>` : '';
}
// Escaped text for a prop, or its binding hint when the current scenario provides no value.
function vePropText(node, entry, name, ctx) {
  const text = veShow(veProp(node, entry, name, ctx));
  return text ? esc(text) : veHintHtml(node.props?.[name], ctx);
}
function veTone(value, fallback = 'primary') { return VE_TONES.includes(value) ? value : fallback; }
function veVariant(value, fallback) { return VE_VARIANTS.includes(value) ? value : fallback; }
function veItemLabel(item) {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return String(item);
  return veShow(item.label ?? item.name ?? item.title ?? item.value ?? '');
}
function veItems(value) { return (Array.isArray(value) ? value.flat() : []).slice(0, VE_ITEM_LIMIT).map(veItemLabel).filter(Boolean); }
function veIconHtml(value) { return value ? '<span class="ve-u-icon" aria-hidden="true"></span>' : ''; }
function veSlotHtml(node, name, ctx) { return veRenderList(node.slots?.[name] || [], ctx); }
// Slot content, or a dashed hint naming the empty slot while designing.
function veSlotOrHint(node, name, ctx) {
  const html = veSlotHtml(node, name, ctx);
  return html || (ctx.design ? `<span class="ve-slot-hint">#${esc(name)}</span>` : '');
}
function veButtonPreview(node, entry, ctx) {
  const variant = veVariant(veProp(node, entry, 'variant', ctx), 'solid');
  const disabled = veProp(node, entry, 'disabled', ctx) === true || ctx.session.state === 'disabled', loading = veProp(node, entry, 'loading', ctx) === true;
  const label = vePropText(node, entry, 'label', ctx), content = veSlotHtml(node, 'default', ctx);
  return `<span class="ve-u-btn ve-tone-${veTone(veProp(node, entry, 'color', ctx))} ve-v-${variant}${disabled ? ' is-disabled' : ''}">${loading ? '<span class="ve-u-spinner" aria-hidden="true"></span>' : veIconHtml(veProp(node, entry, 'icon', ctx))}${veSlotHtml(node, 'leading', ctx)}${content || label || (ctx.design ? esc(entry.label) : '')}${veSlotHtml(node, 'trailing', ctx)}</span>`;
}
function veInputPreview(node, entry, ctx) {
  const value = veShow(veProp(node, entry, 'modelValue', ctx)), placeholder = vePropText(node, entry, 'placeholder', ctx);
  const disabled = veProp(node, entry, 'disabled', ctx) === true || ctx.session.state === 'disabled', type = veShow(veProp(node, entry, 'type', ctx));
  return `<span class="ve-u-input${disabled ? ' is-disabled' : ''}" data-type="${esc(type)}">${veIconHtml(veProp(node, entry, 'icon', ctx))}${value ? `<span class="ve-u-value">${esc(value)}</span>` : `<span class="ve-u-placeholder">${placeholder}</span>`}</span>`;
}
function veTextareaPreview(node, entry, ctx) {
  const rows = Math.min(12, Math.max(1, Number(veProp(node, entry, 'rows', ctx)) || 3)), value = veShow(veProp(node, entry, 'modelValue', ctx));
  return `<span class="ve-u-input ve-u-textarea" style="--ve-rows:${rows}">${value ? `<span class="ve-u-value">${esc(value)}</span>` : `<span class="ve-u-placeholder">${vePropText(node, entry, 'placeholder', ctx)}</span>`}</span>`;
}
function veSelectPreview(node, entry, ctx) {
  const value = veProp(node, entry, 'modelValue', ctx), items = veItems(veProp(node, entry, 'items', ctx));
  const shown = value !== undefined && value !== null && value !== '' ? esc(veItemLabel(value)) : '';
  return `<span class="ve-u-input ve-u-select">${shown ? `<span class="ve-u-value">${shown}</span>` : `<span class="ve-u-placeholder">${vePropText(node, entry, 'placeholder', ctx) || esc(items[0] || '')}</span>`}<span class="ve-u-chevron" aria-hidden="true"></span></span>`;
}
function veTogglePreview(node, entry, ctx, kind) {
  const on = veProp(node, entry, 'modelValue', ctx) === true;
  return `<span class="ve-u-toggle"><span class="ve-u-${kind}${on ? ' is-on' : ''}" aria-hidden="true"></span><span>${vePropText(node, entry, 'label', ctx)}</span></span>`;
}
function veTableColumns(value, rows) {
  const list = Array.isArray(value) ? value : [];
  const columns = list.map(c => typeof c === 'string' ? { key: c, header: c } : { key: veShow(c?.accessorKey ?? c?.key ?? ''), header: veShow(c?.header ?? c?.label ?? c?.accessorKey ?? '') }).filter(c => c.key);
  if (columns.length) return columns.slice(0, VE_COLUMN_LIMIT);
  const first = rows.find(r => r && typeof r === 'object' && !Array.isArray(r));
  return Object.keys(first || {}).slice(0, VE_COLUMN_LIMIT).map(key => ({ key, header: key }));
}
// Rows come only from the scenario: visualValue over the node's data expression. Nothing is invented.
function veTablePreview(node, entry, ctx) {
  const value = node.props?.data ? visualValue(ctx.session, node.props.data, ctx.props) : undefined;
  const rows = Array.isArray(value) ? value.slice(0, VE_ROW_LIMIT) : [], columns = veTableColumns(veProp(node, entry, 'columns', ctx), rows);
  const loading = veProp(node, entry, 'loading', ctx) === true || ctx.session.state === 'loading';
  const head = columns.map(c => `<span class="ve-u-th">${esc(c.header)}</span>`).join('') || `<span class="ve-u-th">${ctx.design ? 'No columns declared' : ''}</span>`;
  const body = loading ? '<span class="ve-u-skeleton-row" aria-hidden="true"></span>'.repeat(3)
    : rows.map(row => `<div class="ve-u-tr">${columns.map(c => `<span class="ve-u-td">${esc(veShow(visualRead(row, c.key)))}</span>`).join('')}</div>`).join('');
  const empty = loading || rows.length ? '' : `<div class="ve-u-table-empty">${veSlotHtml(node, 'empty', ctx) || 'No rows in this scenario'}</div>`;
  const more = Array.isArray(value) && value.length > VE_ROW_LIMIT ? `<div class="ve-u-table-more">${value.length - VE_ROW_LIMIT} more rows not shown</div>` : '';
  return `<div class="ve-u-table" style="--ve-cols:${Math.max(1, columns.length)}"><div class="ve-u-tr ve-u-thead">${head}</div>${body}${empty}${more}${value === undefined ? veHintHtml(node.props?.data, ctx) : ''}</div>`;
}
function veCardPreview(node, entry, ctx) {
  const header = veSlotHtml(node, 'header', ctx), footer = veSlotHtml(node, 'footer', ctx);
  return `<div class="ve-u-card">${header ? `<div class="ve-u-card-header">${header}</div>` : ''}<div class="ve-u-card-body">${veSlotOrHint(node, 'default', ctx)}</div>${footer ? `<div class="ve-u-card-footer">${footer}</div>` : ''}</div>`;
}
function veBadgePreview(node, entry, ctx) {
  const variant = veVariant(veProp(node, entry, 'variant', ctx), 'subtle');
  return `<span class="ve-u-badge ve-tone-${veTone(veProp(node, entry, 'color', ctx))} ve-v-${variant}">${veSlotHtml(node, 'default', ctx) || vePropText(node, entry, 'label', ctx) || (ctx.design ? 'Badge' : '')}</span>`;
}
function veAvatarPreview(node, entry, ctx) {
  const text = veShow(veProp(node, entry, 'text', ctx)) || veShow(veProp(node, entry, 'alt', ctx));
  const initials = text.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return `<span class="ve-u-avatar" title="${esc(veShow(veProp(node, entry, 'alt', ctx)))}">${esc(initials) || '<span class="ve-u-icon" aria-hidden="true"></span>'}</span>`;
}
function veTabsPreview(node, entry, ctx) {
  const items = veItems(veProp(node, entry, 'items', ctx)), current = veShow(veProp(node, entry, 'modelValue', ctx));
  const active = Math.max(0, items.indexOf(current));
  return `<span class="ve-u-tabs">${items.map((label, i) => `<span class="ve-u-tab${i === active ? ' is-active' : ''}">${esc(label)}</span>`).join('') || `<span class="ve-u-tab is-active">${ctx.design ? 'No tabs declared' : ''}</span>`}</span>`;
}
function veBreadcrumbPreview(node, entry, ctx) {
  const items = veItems(veProp(node, entry, 'items', ctx));
  return `<span class="ve-u-breadcrumb">${items.map((label, i) => `<span class="${i === items.length - 1 ? 'is-current' : ''}">${esc(label)}</span>`).join('<span class="ve-u-sep" aria-hidden="true">›</span>') || (ctx.design ? veHintHtml(node.props?.items, ctx) || 'Breadcrumb' : '')}</span>`;
}
function veMenuPreview(node, entry, ctx) {
  const palette = node.ref.entryId === 'u-command-palette', groups = palette ? veProp(node, entry, 'groups', ctx) : null;
  const items = palette ? veItems((Array.isArray(groups) ? groups : []).flatMap(g => g?.items || [g])) : veItems(veProp(node, entry, 'items', ctx));
  const trigger = palette ? `<span class="ve-u-input"><span class="ve-u-placeholder">${vePropText(node, entry, 'placeholder', ctx) || 'Type a command…'}</span></span>` : veSlotHtml(node, 'default', ctx) || `<span class="ve-u-btn ve-tone-neutral ve-v-outline">${esc(entry.label)}<span class="ve-u-chevron" aria-hidden="true"></span></span>`;
  return `<div class="ve-u-menu">${trigger}<div class="ve-u-menu-list">${items.map(label => `<span class="ve-u-menu-item">${esc(label)}</span>`).join('') || (ctx.design ? '<span class="ve-u-menu-item is-empty">No items declared</span>' : '')}</div></div>`;
}
// Overlays render inline where they are declared so their content stays selectable.
function veOverlayPreview(node, entry, ctx) {
  const title = vePropText(node, entry, 'title', ctx), description = entry.props.some(p => p.name === 'description') ? vePropText(node, entry, 'description', ctx) : '';
  const footer = veSlotHtml(node, 'footer', ctx);
  return `<div class="ve-u-overlay ve-u-${node.ref.entryId === 'u-drawer' ? 'drawer' : 'modal'}"><span class="ve-u-overlay-kind">${esc(entry.label)}</span><div class="ve-u-overlay-header"><strong>${title || (ctx.design ? esc(entry.label) : '')}</strong>${description ? `<span class="ve-muted">${description}</span>` : ''}</div><div class="ve-u-overlay-body">${veSlotOrHint(node, 'body', ctx)}</div>${footer ? `<div class="ve-u-overlay-footer">${footer}</div>` : ''}</div>`;
}
function veAlertPreview(node, entry, ctx) {
  const description = vePropText(node, entry, 'description', ctx);
  return `<div class="ve-u-alert ve-tone-${veTone(veProp(node, entry, 'color', ctx))}"><span class="ve-u-icon" aria-hidden="true"></span><div><strong>${vePropText(node, entry, 'title', ctx) || (ctx.design ? 'Alert' : '')}</strong>${description ? `<p>${description}</p>` : ''}</div></div>`;
}
function veProgressPreview(node, entry, ctx) {
  const value = Number(veProp(node, entry, 'modelValue', ctx)), max = Number(veProp(node, entry, 'max', ctx)) || 100;
  const known = Number.isFinite(value), percent = known ? Math.round(Math.min(100, Math.max(0, value / max * 100))) : 0;
  return `<span class="ve-u-progress${known ? '' : ' is-indeterminate'}"><span style="width:${known ? percent : 40}%"></span></span>`;
}
function veFieldPreview(node, entry, ctx) {
  const description = vePropText(node, entry, 'description', ctx), required = veProp(node, entry, 'required', ctx) === true;
  return `<div class="ve-u-field"><span class="ve-u-label">${vePropText(node, entry, 'label', ctx)}${required ? '<span class="ve-u-required" aria-hidden="true">*</span>' : ''}</span>${veSlotOrHint(node, 'default', ctx)}${description ? `<span class="ve-u-help">${description}</span>` : ''}</div>`;
}
// The node's layout style lands on the preview's root element, the Nuxt component root in the generated app.
// Preview roots carry only escaped attributes, so the first '>' closes the root tag.
function veRootStyle(html, style) {
  if (!style) return html;
  const end = html.indexOf('>'), head = html.slice(0, end);
  return (head.includes(' style="') ? head.replace(' style="', ` style="${style};`) : head + ` style="${style}"`) + html.slice(end);
}
function veCatalogPreview(node, entry, ctx, style = '') { return veRootStyle(vePreviewFor(node, entry, ctx), style); }
function vePreviewFor(node, entry, ctx) {
  switch (entry.preview) {
    case 'button': return veButtonPreview(node, entry, ctx);
    case 'input': return veInputPreview(node, entry, ctx);
    case 'textarea': return veTextareaPreview(node, entry, ctx);
    case 'select': return veSelectPreview(node, entry, ctx);
    case 'checkbox': case 'switch': return veTogglePreview(node, entry, ctx, entry.preview);
    case 'table': return veTablePreview(node, entry, ctx);
    case 'card': return veCardPreview(node, entry, ctx);
    case 'badge': return veBadgePreview(node, entry, ctx);
    case 'avatar': return veAvatarPreview(node, entry, ctx);
    case 'tabs': return veTabsPreview(node, entry, ctx);
    case 'breadcrumb': return veBreadcrumbPreview(node, entry, ctx);
    case 'menu': return veMenuPreview(node, entry, ctx);
    case 'overlay': return veOverlayPreview(node, entry, ctx);
    case 'alert': return veAlertPreview(node, entry, ctx);
    case 'progress': return veProgressPreview(node, entry, ctx);
    case 'skeleton': return '<span class="ve-u-skeleton" aria-hidden="true"><span></span><span></span></span>';
    case 'separator': return `<span class="ve-u-separator${veProp(node, entry, 'orientation', ctx) === 'vertical' ? ' is-vertical' : ''}" aria-hidden="true"></span>`;
    case 'form': return `<div class="ve-u-form">${veSlotOrHint(node, 'default', ctx)}</div>`;
    case 'field': return veFieldPreview(node, entry, ctx);
    default: return `<span class="ve-muted">${esc(entry.label)}</span>`;
  }
}
