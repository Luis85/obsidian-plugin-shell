// Selection and clipboard are session-only. Every mutation uses the same guarded transaction.
function cpSelection(doc = dtDocument()) { return doc ? doc.nodes.filter(n => (cpUi.selection || []).includes(n.id)) : []; }
function cpToggleSelection(id) { const ids = new Set(cpUi.selection || []); ids.has(id) ? ids.delete(id) : ids.add(id); cpUi.selection = [...ids]; render(); }
function cpSelectionTools(doc) {
  const count = cpSelection(doc).length;
  return `<div class="cp-selection-tools row wrap" role="group" aria-label="Selected elements"><span>${count} selected</span>${button('Clear selection','cp-selection-clear','','small ghost')}${button('Align left','cp-align','left','small','',count<2?'disabled':'')}${button('Align top','cp-align','top','small','',count<2?'disabled':'')}${button('Group in region','cp-group','','small','',!count?'disabled':'')}${button('Copy selection','cp-copy','','small','',!count?'disabled':'')}${button('Paste into design','cp-paste','','small','',cpUi.clipboard?'':'disabled')}</div>`;
}
function cpGroup(doc, store, selected) {
  const nodes = doc.nodes.filter(n => selected.includes(n.id)); if (!nodes.length) throw Error('Select sibling elements first.');
  const parent = nodes[0].parentId, slot = nodes[0].slotName;
  if (!nodes.every(n => n.parentId === parent && n.slotName === slot)) throw Error('Group sibling elements in the same region or named slot.');
  const region = dtNewNode(store,'region',parent); region.label='Grouped region'; region.ui=compositionDefaultUI();
  if (slot) region.slotName=slot;
  doc.nodes.splice(doc.nodes.indexOf(nodes[0]),0,region);
  for(const n of nodes){n.parentId=region.id;delete n.slotName;}
  cpArrange(doc);return region.id;
}
function cpCopySelection() {
  const doc=dtDocument(), selected=cpSelection(doc), ids=new Set();
  for(const n of selected) for(const id of dtDescendants(doc,n.id)) ids.add(id);
  if(!ids.size)throw Error('Select content to copy.');
  cpUi.clipboard={owner:designOwner(),nodes:dtCopy(doc.nodes.filter(n=>ids.has(n.id))),edges:dtCopy(doc.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)))};
  notify('Selection copied in this workspace session. Paste never changes a shared definition.');render();
}
function cpPaste(store,doc) {
  const source=cpUi.clipboard;if(!source||source.owner!==designOwner())throw Error('Copy from this project again before pasting.');
  const selected=doc.nodes.find(n=>n.id===dtUi.selected),parent=selected?.kind==='region'?selected.id:null;
  const ids=new Map(source.nodes.map(n=>[n.id,dtNext(store,'node')]));
  const nodes=dtCopy(source.nodes).map(n=>({...n,id:ids.get(n.id),parentId:ids.get(n.parentId)||parent,position:{x:n.position.x+32,y:n.position.y+32},sourceBrickId:null}));
  for(const n of nodes)if(n.parentId===parent)delete n.slotName;
  doc.nodes.push(...nodes);doc.edges.push(...dtCopy(source.edges).map(e=>({...e,id:dtNext(store,'edge'),source:ids.get(e.source),target:ids.get(e.target)})));
  cpUi.selection=nodes.filter(n=>n.parentId===parent).map(n=>n.id);return nodes[0]?.id;
}
function cpToolAction(action,value) {
  if(action==='cp-multi'){cpToggleSelection(value);return true;}
  if(action==='cp-selection-clear'){cpUi.selection=[];render();return true;}
  if(action==='cp-copy'){cpCopySelection();return true;}
  if(action==='cp-paste'){dtUpdate((store,doc)=>{dtUi.selected=cpPaste(store,doc);});return true;}
  if(action==='cp-group'){dtUpdate((store,doc)=>{dtUi.selected=cpGroup(doc,store,cpUi.selection||[]);cpUi.selection=[dtUi.selected];});return true;}
  if(action==='cp-align'){
    dtUpdate((_store,doc)=>{const nodes=cpSelection(doc);if(nodes.length<2||!nodes.every(n=>n.parentId===nodes[0].parentId))throw Error('Select at least two siblings to align.');const axis=value==='left'?'x':'y',at=Math.min(...nodes.map(n=>n.position[axis]));for(const n of nodes)n.position[axis]=at;});return true;
  }
  if(action==='cp-capture-recipe'){cpCaptureRecipe();return true;}
  return false;
}
function cpRecipeFingerprint() { let hash=2166136261; for(const char of tdFingerprint())hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash>>>0).toString(16); }
function cpCaptureRecipe() {
  const f=cpUi.form;if(!f||f.type!=='scenario')throw Error('Open a scenario draft first.');
  const manifest=tdManifest(),generated=createFixtureEngine().generate(manifest),op=generated.operations.find(o=>o.id===f.recipe);
  if(!op||op.outputValue===undefined)throw Error('Select an enabled recipe with a declared output.');
  const source=design().dataSources.sources.find(s=>s.operations.some(o=>o.id===op.id));
  const bindings=JSON.parse(f.bindingsText);const value={sourceId:source.id,operationId:op.id,value:op.outputValue};
  f.bindingsText=JSON.stringify([...bindings.filter(b=>!(b.sourceId===source.id&&b.operationId===op.id)),value],null,2);
  f.record.recipe={sourceId:source.id,operationId:op.id,engine:generated.engine,seed:generated.seed,count:generated.count,fingerprint:cpRecipeFingerprint()};
  f.error='Captured deterministic output into this draft. Save explicitly; no files or source providers were written.';redrawModal();
}
function cpRevisionChanges(doc,node=null) {
  const ownerId=node?.component?.id||doc.ownerId, current=design().library.find(c=>c.id===ownerId), previous=node?.component?.revisionId?dtStore().revisions?.find(r=>r.id===node.component.revisionId):[...(dtStore().revisions||[])].reverse().find(r=>r.ownerId===ownerId);
  const working=dtFind(dtStore(),'component',ownerId);
  if(!current||!working)return '<p class="error">The working component or its internals are missing. Restore them before upgrading.</p>';
  const rows=['props','events','slots'].map(key=>`<tr><th scope="row">${esc(key)}</th><td><pre>${esc(previous?.library[key]||'No earlier snapshot')}</pre></td><td><pre>${esc(current[key])}</pre></td></tr>`).join('');
  return `<div class="cp-table-scroll"><table><caption>Review published → working contract</caption><thead><tr><th>Contract</th><th>${esc(previous?.id||'Unpublished')}</th><th>Working v${esc(current.version)}</th></tr></thead><tbody>${rows}</tbody></table></div><p>${previous?.document.nodes.length||0} published → ${working.nodes.length} working elements. ${previous&&JSON.stringify(previous.document)!==JSON.stringify(working)?'Internal design changed.':'Internal design matches or has not been published.'} Existing pinned consumers retain the old snapshot.</p>`;
}
function cpCoverage(d=design()) {
  const pages=d.nodes.filter(dtPageEligible), docs=dtStore(d).documents;
  return `<p class="dt-page-coverage"><strong>${pages.filter(p=>dtFind(dtStore(d),'page',p.id)).length}/${pages.length} page designs</strong> · ${d.library.filter(c=>dtFind(dtStore(d),'component',c.id)).length}/${d.library.length} component designs · ${dtStore(d).revisions?.length||0} published snapshots. Design coverage is not native implementation or test acceptance.</p>`;
}
function cpPalette(doc,locked) {
  const groups=[['Structure',['region','heading','text','divider','component',...(doc.kind==='component'?['slot']:[])]],['Input and actions',['input','textarea','number','checkbox','select','button','tabs']],['Data and feedback',['table','list','alert','image']]];
  return groups.map(([label,kinds])=>`<h3>${label}</h3><div class="dt-palette-buttons">${kinds.map(kind=>button(({component:'Component instance',slot:'Named slot',input:'Text input',image:'Asset placeholder'})[kind]||kind[0].toUpperCase()+kind.slice(1),'dt-add',kind,'small','plus',locked)).join('')}</div>`).join('');
}
