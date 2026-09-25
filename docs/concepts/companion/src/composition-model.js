// Shared authoring transactions; published snapshots are append-only within a project.
function cpUpgradeStore(store) { store.schema = 2; store.revisions ||= []; return store; }
function cpRetainRevisions(store, previous) {
  if (!store || !previous?.revisions?.length) return;
  cpUpgradeStore(store);
  for (const old of previous.revisions) {
    const current = store.revisions.find(r => r.id === old.id);
    if (current && JSON.stringify(current) !== JSON.stringify(old)) throw Error('Published component revisions cannot be edited. Publish a new revision.');
    if (!current) store.revisions.push(dtCopy(old));
  }
  store.nextId = Math.max(store.nextId, previous.nextId);
}
function cpBoundHistory(candidate) {
  // Keep the complete current design. Trim only old undo entries before the storage cap.
  while (candidate.history.length && JSON.stringify(candidate).length > 3500000) candidate.history.shift();
  while (candidate.future.length && JSON.stringify(candidate).length > 3500000) candidate.future.shift();
}
function cpDefinition(node, d = design()) {
  const ref = node.component; if (!ref) return null;
  return ref.revisionId ? dtStore(d).revisions?.find(r => r.id === ref.revisionId)?.library || null : d.library.find(c => c.id === ref.id) || null;
}
function cpResolved(node, d = design()) {
  const ref = node.component;
  if (!ref) return null;
  if (ref.revisionId) return dtStore(d).revisions?.find(r => r.id === ref.revisionId) || null;
  const library = cpDefinition(node, d), document = dtFind(dtStore(d), 'component', ref.id);
  return library?.version === ref.version && document ? { library, document, designSystem: d.designSystem } : null;
}
function cpPublish(store, ownerId, d = design(), active = new Set()) {
  cpUpgradeStore(store);
  if (active.has(ownerId)) throw Error('Cannot publish recursive component composition.');
  const live = dtFind(store, 'component', ownerId), library = d.library.find(c => c.id === ownerId);
  if (!live || !library) throw Error('Design the component internals before publishing.');
  active.add(ownerId); const document = dtCopy(live);
  for (const n of document.nodes) if (n.component && !n.component.revisionId) {
    const child = cpPublish(store, n.component.id, d, active); n.component.revisionId = child.id; n.component.version = child.version;
  }
  active.delete(ownerId);
  const contract = { id: library.id, name: library.name, version: library.version, props: library.props, events: library.events, slots: library.slots, variantSpecs: dtCopy(componentVariants(library)) };
  const previous = [...store.revisions].reverse().find(r => r.ownerId === ownerId);
  if (previous && JSON.stringify([previous.document, previous.library, previous.designSystem]) === JSON.stringify([document, contract, d.designSystem || null])) return previous;
  const revision = { id: dtNext(store, 'revision'), ownerId, version: library.version, library: contract, designSystem: dtCopy(d.designSystem || null), document };
  store.revisions.push(revision); return revision;
}
function cpImpact(ownerId, d = design()) {
  const store=dtStore(d), contexts=[...store.documents.map(doc=>({doc,key:doc.kind==='component'?'live:'+doc.ownerId:doc.id,live:true})),...(store.revisions||[]).map(r=>({doc:r.document,key:r.id,live:false}))];
  const queue=[{key:'live:'+ownerId,path:[]},...(store.revisions||[]).filter(r=>r.ownerId===ownerId).map(r=>({key:r.id,path:[]}))], visited=new Set(), results=new Map();
  while(queue.length){
    const {key,path}=queue.shift();if(visited.has(key))continue;visited.add(key);
    for(const context of contexts)for(const node of context.doc.nodes){
      const ref=node.component;if(!ref || (ref.revisionId||'live:'+ref.id)!==key)continue;
      const chain=[...path,key];
      if(context.live && !results.has(context.doc.id+':'+node.id))results.set(context.doc.id+':'+node.id,{doc:context.doc,node,direct:path.length===0,path:chain,pinned:!!ref.revisionId});
      if(context.doc.kind==='component')queue.push({key:context.key,path:chain});
    }
  }
  return [...results.values()];
}
function cpArrange(doc) {
  const children = parent => doc.nodes.filter(n => n.parentId === parent);
  function arrange(parent){
    const list=children(parent),owner=doc.nodes.find(n=>n.id===parent);
    for(const node of list) if(children(node.id).length){const box=arrange(node.id);node.size={width:box.width+48,height:box.height+28};}
    const columns=owner && (owner.layout==='row' || owner.parentId===null && list.length>=6) ? Math.min(2,list.length) : 1;
    const cellWidth=Math.max(280,...list.map(n=>n.size.width));let y=68,width=280;
    for(let i=0;i<list.length;i+=columns){const row=list.slice(i,i+columns);for(const [col,node] of row.entries()){node.position={x:24+col*(cellWidth+28),y};width=Math.max(width,node.position.x-24+node.size.width);}y+=Math.max(...row.map(n=>n.size.height))+28;}
    return {width,height:y};
  }
  arrange(null);let x=24;for(const root of children(null)){root.position={x,y:24};x+=root.size.width+72;}
  if(doc.nodes.some(n=>n.size.height>4000||n.size.width>4000))throw Error('This design needs smaller regions before it can be arranged automatically.');
}
function cpNodeValue(doc, node, session, props = {}) {
  if (Object.hasOwn(session.values, node.id)) return session.values[node.id];
  if (node.contentProp && Object.hasOwn(props, node.contentProp)) return props[node.contentProp];
  const binding = node.binding && session.bindings.find(b => b.sourceId === node.binding.sourceId && b.operationId === node.binding.operationId);
  if (binding) { const value = compositionRead(binding.value, node.binding.field); if (value !== undefined) return value; }
  return node.text;
}
function cpStyleAttr(n, system, narrow) {
  return esc(Object.entries(compositionStyle(n, system, narrow)).map(([key, value]) => key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ':' + value).join(';'));
}
function cpTokenWarnings(doc, d = design()) {
  const fields = { gap: 'spacing', padding: 'spacing', color: 'colors', background: 'colors', radius: 'radii', typography: 'typography' };
  return doc.nodes.flatMap(n => Object.entries(n.ui?.tokens || {}).filter(([key, id]) => id && !d.designSystem?.[fields[key]]?.some(t => t.id === id)).map(([key, id]) => ({ node: n, message: `${n.label}: missing ${key} token ${id}. Literal fallback is used.` })));
}
function cpValidateLinks(store, d = design()) {
  const docs=[...store.documents,...(store.revisions||[]).map(r=>r.document)];
  for(const doc of docs) {
    const owner=doc.kind==='component' ? d.library.find(c=>c.id===doc.ownerId) : null;
    for(const scenario of doc.scenarios||[])for(const fixture of scenario.bindings){
      const op=d.dataSources?.sources.find(s=>s.id===fixture.sourceId)?.operations.find(o=>o.id===fixture.operationId);
      if(op && op.output.mode!=='unspecified' && op.output.mode!=='none' && !createFixtureEngine().matches(fixture.value,tdNormalizeSchema(dsResolveShape(op.output,d))))throw Error('Fixture '+scenario.name+' does not match the declared output of '+op.name+'.');
    }
    for(const node of doc.nodes) {
      if(node.kind==='slot' && owner && !owner.slots.split(/[,\n]/).map(s=>s.trim()).includes(node.label)) {
        // Historical documents carry their own frozen public contract.
        const historical=(store.revisions||[]).find(r=>r.document===doc);
        if(!historical?.library.slots.split(/[,\n]/).map(s=>s.trim()).includes(node.label)) throw Error('Declare named slot '+node.label+' in the component contract first.');
      }
      if(!node.component)continue;
      const ref=node.component,revision=ref.revisionId&&(store.revisions||[]).find(r=>r.id===ref.revisionId);
      const library=revision?.library||d.library.find(c=>c.id===ref.id),internal=revision?.document||dtFind(store,'component',ref.id);
      if(!library)continue;
      const slots=library.slots.split(/[,\n]/).map(s=>s.trim()).filter(Boolean),children=doc.nodes.filter(n=>n.parentId===node.id);
      for(const child of children) {
        if(!slots.includes(child.slotName))throw Error('Map '+child.label+' to a declared slot before saving.');
        const declaration=internal?.nodes.find(n=>n.kind==='slot'&&n.label===child.slotName);
        if(declaration?.slotKinds?.length&&!declaration.slotKinds.includes(child.kind))throw Error(child.label+' is not an allowed element kind in slot '+child.slotName+'.');
        if(declaration?.slotCapacity==='one'&&children.filter(n=>n.slotName===child.slotName).length>1)throw Error('Slot '+child.slotName+' accepts one root element. Group its content first.');
      }
    }
  }
}
