// Search and drill-down are transient; they never author or filter saved designs.
function dtSearchField(label, field, value) {
  return uiInput(label, field, value || '', { type: 'search', extra: 'maxlength="160" autocomplete="off"' });
}
function dtPageCards(d = design()) {
  const q = (dtUi.pageQuery || '').trim().toLowerCase(), all = d.nodes.filter(dtPageEligible);
  const pages = all.filter(p => [p.label, p.kind, p.slug].join(' ').toLowerCase().includes(q));
  return `<p class="small muted" role="status">${pages.length} of ${all.length} surfaces</p><div class="dt-page-grid">${pages.map(page => {
    const doc = dtFind(dtStore(d), 'page', page.id);
    return `<article class="card dt-page-card"><span class="dt-eyebrow">${esc(page.kind)} · ${doc ? 'Detail design' : 'Shell only'}</span><h2>${esc(page.label)}</h2><p>${esc(page.purpose || page.description || 'Design content, behavior and states inside this surface.')}</p><p class="small muted">${doc ? doc.nodes.length + ' elements · ' + doc.edges.length + ' interactions' : 'Opening this page does not create data.'}</p>${button(doc ? 'Open page editor' : 'Design page', 'dt-page', page.id, doc ? 'small' : 'small primary', 'grid')}</article>`;
  }).join('') || `<div class="card"><h2>${all.length ? 'No matching surfaces' : 'Start with a surface'}</h2><p>${all.length ? 'Search another name, kind or slug. No designs have been removed.' : 'Add a Page, Modal or Settings surface in the sitemap. Views and groups are containers.'}</p></div>`}</div>`;
}
function dtOutlineMatches(doc, query) {
  const q = query.trim().toLowerCase(); if (!q) return new Set(doc.nodes.map(n => n.id));
  const ids = new Set(), byId = new Map(doc.nodes.map(n => [n.id, n]));
  for (const node of doc.nodes) if ([node.label, node.kind, node.text, node.component?.label].join(' ').toLowerCase().includes(q)) {
    let n = node; while (n && !ids.has(n.id)) { ids.add(n.id); n = byId.get(n.parentId); }
  }
  return ids;
}
function dtSearchInput(el) {
  if (el.dataset.field === 'dt-page-search') { dtUi.pageQuery = el.value; document.getElementById('dt-pages-results').innerHTML = dtPageCards(); return true; }
  if (el.dataset.field !== 'dt-outline-search') return false;
  dtUi.query = el.value; const doc = dtDocument(); if (!doc) return true;
  const compact = document.getElementById('dt-tree'), full = document.getElementById('dt-outline-tree');
  if (compact) compact.innerHTML = dtOutline(doc, true); if (full) full.innerHTML = dtOutline(doc);
  return true;
}
function dtAncestorTrail(doc, node) {
  const trail = [], byId = new Map(doc.nodes.map(n => [n.id, n])); let parent = byId.get(node.parentId);
  while (parent) { trail.unshift(parent); parent = byId.get(parent.parentId); }
  return `<nav class="dt-ancestor-trail" aria-label="Selected element ancestors"><span>Root</span>${trail.map(n => ' / ' + button(n.label, 'dt-select', n.id, 'small ghost')).join('')} / <strong>${esc(node.label)}</strong></nav>`;
}
function dtOpenUse(value) {
  const [documentId, nodeId] = value.split('/'), doc = dtStore().documents.find(d => d.id === documentId);
  if (!doc || !doc.nodes.some(n => n.id === nodeId)) throw Error('That usage no longer exists.');
  dtOpen(doc.kind, doc.ownerId); dtUi.mode = 'outline'; dtUi.query = ''; dtUi.selected = nodeId; render();
  document.querySelector('.dt-outline-main .is-selected button')?.focus();
}
function dtJumpFinding(value) {
  const [type, id] = value.split('/');
  if (type === 'notes') return dtBegin('notes');
  if (type === 'node') dtUi.selected = id; else dtUi.edge = id;
  dtBegin(type, id);
}
function dtZoom(value) {
  const api = dtUi.api; if (!api) return;
  const current = dtUi.viewports[dtDocument().id] || { x: 0, y: 0, zoom: 1 };
  api.zoomTo(value === 'reset' ? 1 : Math.max(.2, Math.min(1.5, current.zoom + Number(value))), { duration: 0 });
}
