// Review is advisory design evidence, never a test verdict or a readiness score.
function dtVisibleIds(doc, stateName) {
  const visible = new Set(), owners=new Map(doc.nodes.flatMap(n=>Object.values(n.slots || {}).flat().map(id=>[id,n.id])));
  for(const node of doc.nodes){let cursor=node;const seen=new Set();let ok=true;
    while(cursor){if(seen.has(cursor.id)||!cursor.visibleIn.includes(stateName)){ok=false;break;}seen.add(cursor.id);const parent=cursor.parentId || owners.get(cursor.id);if(!parent)break;cursor=doc.nodes.find(n=>n.id===parent);if(!cursor)ok=false;}
    if(ok)visible.add(node.id);
  }
  return visible;
}
function dtReviewItems(doc, d = design()) {
  const issues = dtIssues(d).filter(i => i.documentId === doc.id).map(i => ({ ...i, category: 'Reference or accessibility', target: i.detailNodeId ? 'node/' + i.detailNodeId : i.detailEdgeId ? 'edge/' + i.detailEdgeId : null }));
  const note = (message, target) => issues.push({ category: 'Design question', message, target });
  if (!doc.notes.trim()) note('Describe the purpose, constraints and decisions for this design.', 'notes/');
  for (const e of doc.edges) {
    if (!e.notes.trim()) note(e.label + ': describe behavior, conditions and recovery.', 'edge/' + e.id);
    if (!e.acceptance.trim()) note(e.label + ': describe an acceptance scenario. Authored text is not an executed test.', 'edge/' + e.id);
  }
  return issues;
}
function dtUsagePanel(doc, d = design()) {
  if (doc.kind !== 'component') return '';
  const uses = dtComponentUses(doc.ownerId, d), count = new Set(uses.map(u => u.doc.id)).size;
  return `<section class="dt-usage"><h3>Used by</h3><p class="small">${uses.length} direct instances in ${count} designs</p><p class="small muted">Internals are shared. Contract version pins are not immutable snapshots of earlier designs. Indirect transitive usage is not counted.</p>${uses.map(({ doc: parent, node }) => `<div class="dt-use-row">${button(dtOwnerLabel(parent, d) + ' / ' + node.label, 'dt-use', parent.id + '/' + node.id, 'small ghost')}<span class="small muted">${esc(parent.kind)} · ${esc(node.component.variantId)} · v${esc(node.component.version)}</span></div>`).join('') || '<p class="small muted">Not used in another detail design yet.</p>'}</section>`;
}
function dtReviewFinding(item) {
  return `<li class="dt-review-item"><div><span class="dt-eyebrow">${esc(item.category)}</span><p>${esc(item.message)}</p></div>${item.target ? button('Review ' + (item.target.startsWith('node') ? 'element' : item.target.startsWith('edge') ? 'interaction' : 'intent'), 'dt-finding', item.target, 'small') : '<span class="small muted">Restore the original owner in the sitemap or library.</span>'}</li>`;
}
function dtStateTable(doc) {
  const rows = DETAIL_STATES.map(name => { const ids = dtVisibleIds(doc, name); return { name, ids, special: doc.nodes.filter(n => ids.has(n.id) && n.visibleIn.length < DETAIL_STATES.length).length }; });
  const baseline = [...rows[0].ids].join('|');
  return `<div class="dt-table-scroll"><table class="dt-state-table"><caption>Authored visibility — local elements, with ancestor visibility applied</caption><thead><tr><th scope="col">State</th><th scope="col">Visible</th><th scope="col">State-specific</th><th scope="col">Inspection</th></tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${esc(r.name)}</th><td>${r.ids.size} / ${doc.nodes.length}</td><td>${r.special}</td><td>${button('Preview ' + r.name, 'dt-review-state', r.name, 'small ghost')}</td></tr>`).join('')}</tbody></table></div><p class="small muted">${rows.every(r => [...r.ids].join('|') === baseline) ? 'All five states show the same local elements. Decide whether distinct content is needed; equal states are not automatically an error.' : 'Different visibility is authored. Inspect content, recovery and controls in each relevant state.'} Nested reusable internals are not included in these counts. No runtime or accessibility tests have been executed by this review.</p>`;
}
function dtReviewView(doc) {
  const items = dtReviewItems(doc);
  return `<section class="dt-review" aria-label="Design review"><header class="page-heading"><div><span class="dt-eyebrow">Saved design only</span><h2>Review &amp; handoff</h2><p>Separate authored intent, symbolic previews and implementation evidence.</p></div>${button('Export design brief', 'dt-export-brief', '', 'small', 'download')}</header><div class="dt-review-grid"><section class="card"><h3>${items.length} review questions</h3><p class="small muted">Advisory findings, not a certification or a generator gate. Follow a question to its exact saved element or interaction.</p><ul class="dt-review-list">${items.map(dtReviewFinding).join('') || '<li>No automated review questions. Human review and implementation tests are still required.</li>'}</ul>${dtUsagePanel(doc)}</section><section class="card"><h3>State review</h3>${dtStateTable(doc)}<h3>Handoff boundary</h3><p class="small">The brief records stable IDs, reading order, property origins, bindings and acceptance notes. It does not compile Vue layouts, evaluate props or prove that behavior works. Full project JSON remains the portable source.</p></section></div></section>`;
}
