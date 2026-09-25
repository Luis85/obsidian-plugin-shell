function handleCompositionAction(action, value) {
  if (!action.startsWith('cp-')) return false;
  try {
    if (cpToolAction(action,value)) return true;
    const actions = {
      'cp-layout': () => cpBegin('layout', value), 'cp-scenario': () => cpBegin('scenario', value),
      'cp-publish': () => cpBegin('publish'), 'cp-pin': () => cpBegin('pin', value), 'cp-save': cpSave,
      'cp-arrange': () => dtUpdate((store, doc) => cpArrange(doc)),
      'cp-play': () => { cpUi.play = !cpUi.play; cpUi.message = ''; cpUi.session = null; render(); },
      'cp-reset': () => { cpUi.session = null; cpUi.message = ''; render(); },
      'cp-compare': () => { cpUi.compare = !cpUi.compare; cpUi.play = false; render(); },
      'cp-tests': () => { const doc = dtDocument(); showModal('copy', { title: 'Executable UI effect tests — not business acceptance', filename: doc.ownerId + '.ui-effects.checks.mjs', text: compositionTestSource(doc) }); },
      'cp-impact-open': () => { const [docId, nodeId] = value.split('|'), doc = dtStore().documents.find(d => d.id === docId); if (!doc) throw Error('Design no longer exists.'); dtOpen(doc.kind, doc.ownerId); dtUi.selected = nodeId; dtUi.mode = 'outline'; render(); },
      'cp-add-slot': () => { const doc = dtDocument(), n = doc?.nodes.find(n => n.id === dtUi.selected); if (!n?.component) throw Error('Select a component instance.'); const names = cpDefinition(n)?.slots.split(/[,\n]/).map(s => s.trim()).filter(Boolean) || []; if (!names.length) throw Error('Declare a slot on the component first.'); dtBegin('node', null, 'text'); dtUi.form.record.parentId = n.id; dtUi.form.record.slotName = names[0]; redrawModal(); },
      'cp-delete-scenario': () => { const f = cpUi.form; if (!f || f.type !== 'scenario') return; if (!f.remove) { f.remove = true; f.error = 'Click Remove fixture again to confirm. The design and other fixtures are retained.'; redrawModal(); return; } dtCommit(store => { const doc = store.documents.find(d => d.id === f.docId); doc.scenarios = doc.scenarios.filter(s => s.id !== f.record.id); }, f.token); modalOriginal = null; closeModal(); cpUi.scenario = ''; cpUi.session = null; render(); }
    };
    if (!Object.hasOwn(actions, action)) return false; actions[action]();
  } catch (error) { dtFail(error); }
  return true;
}
function cpReviewPanel(doc) {
  const revisions = doc.kind === 'component' ? dtStore().revisions?.filter(r => r.ownerId === doc.ownerId) || [] : [];
  const impact = doc.kind === 'component' ? cpImpact(doc.ownerId) : [];
  return `<section class="cp-review-section"><h2>Composition &amp; handoff</h2><div class="row wrap">${doc.kind === 'component' ? button('Publish revision', 'cp-publish', '', 'small') : ''}${button('Export UI effect tests', 'cp-tests', '', 'small')}${button('New fixture scenario', 'cp-scenario', '', 'small')}</div><p>${doc.scenarios?.length || 0} fixture scenarios · ${doc.edges.filter(e => e.effect || e.targetSurfaceId).length} declared executable UI effects · ${doc.edges.filter(e => !e.effect && !e.targetSurfaceId).length} business implementation points</p>
    ${cpTokenWarnings(doc).map(f => `<p class="warning">${esc(f.message)} ${button('Repair token', 'cp-layout', f.node.id, 'small')}</p>`).join('')}
    ${doc.kind === 'component' ? `<h3>Published revisions</h3>${revisions.map(r => `<p><code>${esc(r.id)}</code> · Contract ${esc(r.version)} · ${r.document.nodes.length} frozen elements</p>`).join('') || '<p>No published snapshots. Current unpinned instances use the working definition.</p>'}<h3>Direct and transitive usage</h3><p class="small muted">Pinned instances keep their snapshot. This is a dependency inventory, not automatic upgrade approval.</p>${impact.map(use => `<div class="dt-edge-row">${button(dtOwnerLabel(use.doc) + ' / ' + use.node.label, 'cp-impact-open', use.doc.id + '|' + use.node.id, 'small ghost')}<small>${use.direct ? 'Direct' : 'Transitive'} · ${use.pinned ? 'Pinned — unchanged until reviewed' : 'Working definition'} · ${esc(use.path.join(' → '))}</small></div>`).join('') || '<p>No consumers yet.</p>'}` : ''}</section>`;
}
