// Read-only deterministic Markdown. Escape authored markup and never run linked providers.
function dtMd(value) { return String(value ?? '').replace(/\\/g, '\\\\').replace(/([`*_{}\[\]<>#|!])/g, '\\$1').replace(/\r/g, '').replace(/\n/g, ' / '); }
function dtBrief(doc, d = design()) {
  const line = value => dtMd(value), out = ['# Design brief: ' + line(dtOwnerLabel(doc, d)), '', '> Authored design intent, not implementation or executed-test evidence.', '',
    'Kind: ' + doc.kind, 'Design ID: ' + doc.id, 'Owner ID: ' + line(doc.ownerId), '', '## Purpose and constraints', '', line(doc.notes || 'Not yet described.'), '',
    '## Structure in reading order', '', 'Canvas coordinates are intentionally excluded. Parent relationships and sibling order define this outline.', ''];
  for (const n of dtSortedNodes(doc)) {
    out.push('### ' + line(n.label), '', 'ID: ' + n.id + ' | Kind: ' + n.kind + ' | Parent: ' + (n.parentId || 'root'), 'Visible in: ' + n.visibleIn.join(', '));
    if (n.kind === 'region') out.push('Reading layout: ' + n.layout);
    if (n.text) out.push('Content: ' + line(n.text));
    if (n.component) {
      out.push('Reusable reference: ' + line(n.component.id) + ' | Contract: ' + line(n.component.version) + ' | Variant: ' + line(n.component.variantId));
      for (const p of dtPropRows(n, d)) out.push('Prop ' + line(p.name) + ': ' + (p.value === undefined ? 'not set' : line(JSON.stringify(p.value))) + ' [' + p.source + '; ' + line(p.type || 'undeclared') + ']');
    }
    if (n.binding) out.push('Binding declaration: ' + line(n.binding.sourceId) + ' / ' + line(n.binding.operationId) + ' / ' + line(n.binding.field || '(result root)'));
    out.push('Accessibility / validation: ' + line(n.a11y || 'Not yet described.'), '');
  }
  out.push('## Interaction contracts', '');
  if (!doc.edges.length) out.push('No interactions described.', '');
  for (const e of doc.edges) out.push('### ' + line(e.label), '', 'ID: ' + e.id, 'From: ' + e.source + ' | To: ' + e.target, 'Event: ' + line(e.event),
    'Navigation target: ' + line(e.targetSurfaceId || 'Stay on this surface'), 'Behavior: ' + line(e.notes || 'Not yet described.'), 'Acceptance intent: ' + line(e.acceptance || 'Not yet described.'), '');
  out.push('## Authored state visibility', '', 'Counts cover local nodes only; hidden ancestors hide descendants. Nested reusable internals are excluded.', '');
  for (const s of DETAIL_STATES) out.push('- ' + s + ': ' + dtVisibleIds(doc, s).size + ' of ' + doc.nodes.length + ' elements visible.');
  out.push('', '## Review questions', '');
  const items = dtReviewItems(doc, d); if (!items.length) out.push('No automatic findings. Human review and implementation tests remain required.');
  for (const item of items) out.push('- ' + line(item.message) + (item.target ? ' [' + line(item.target) + ']' : ''));
  if (doc.kind === 'component') {
    out.push('', '## Direct usage', '');
    const uses = dtComponentUses(doc.ownerId, d); if (!uses.length) out.push('No direct usages in detail designs.');
    for (const { doc: parent, node } of uses) out.push('- ' + line(dtOwnerLabel(parent, d)) + ' / ' + line(node.label) + ' [' + parent.id + ' / ' + node.id + ']');
  }
  out.push('', '## Implementation boundary', '', 'Contract pins do not archive old component internals. Defaults are shown only for the matching current contract and variant. Slots and props are declarations, not evaluated template bindings. Preview is symbolic; the shell compiler retains design data but does not implement this layout or behavior. This Markdown is a review artifact, not an import format. Use full-project JSON to transfer editable data.', '');
  return out.join('\n');
}
function dtExportBrief() {
  const doc = dtDocument(); if (!doc) throw Error('Open a saved detail design first.');
  const blob = new Blob([dtBrief(doc)], { type: 'text/markdown;charset=utf-8' }), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = doc.id + '.design-brief.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Saved design brief exported. It describes intent, not executed tests.');
}
