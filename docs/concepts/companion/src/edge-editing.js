// Reviewed reconnection uses Vue Flow's updater gesture, never a second graph database.
const edgeEditing={reconnect:null,detach:null,error:''};
function beginEdgeReconnect(edge){
 if(state.activeRun)return;
 closeConnectionMenu(false);flowUi.cancelled=false;connectionUi.committed=false;
 edgeEditing.reconnect={id:edge.id,structure:edge.id.startsWith('contains-'),owner:designOwner(),revision:design().revision};
 setFlowConnecting(true);document.getElementById('vf-root')?.setAttribute('data-reconnecting','true');
}
function endEdgeReconnect(){
 edgeEditing.reconnect=null;setFlowConnecting(false);document.getElementById('vf-root')?.removeAttribute('data-reconnecting');
}
function normalizeStructureConnection(c){
 const side=(id,prefix)=>String(id||'').replace(/^structure-/,'').replace(new RegExp('^'+prefix+'-'),'');
 return {source:c.source,target:c.target,sourceHandle:'structure-out-'+side(c.sourceHandle,'out'),targetHandle:'structure-in-'+side(c.targetHandle,'in')};
}
function validStructureReconnect(connection){
 const c=normalizeStructureConnection(connection),d=design();
 if(!/^structure-out-(left|right|top|bottom)$/.test(c.sourceHandle)||!/^structure-in-(left|right|top|bottom)$/.test(c.targetHandle))return false;
 const parent=d.nodes.find(n=>n.id===c.source),child=d.nodes.find(n=>n.id===c.target);
 return !!parent&&!!child&&['view','page','group'].includes(parent.kind)&&parent.id!==child.id&&!nodeDescendants(d,child.id).has(parent.id);
}
function reviewEdgeReconnect(edge,connection){
 const review=edgeEditing.reconnect;
 if(!review||flowUi.cancelled||review.id!==edge.id||review.owner!==designOwner()||review.revision!==design().revision){endEdgeReconnect();return;}
 connectionUi.committed=true;
 if(!review.structure){endEdgeReconnect();reviewFlowConnection(connection,edge.id);return;}
 if(!validStructureReconnect(connection)){endEdgeReconnect();notify('That structural attachment would be invalid. The original is retained.');return;}
 const c=normalizeStructureConnection(connection),old=design().nodes.find(n=>'contains-'+n.id===edge.id);
 // Structural identity belongs to its child. Retargeting to a different child would delete a different fact.
 if(!old||c.target!==old.id){endEdgeReconnect();notify('A Contains relationship belongs to its child. Change the parent or choose another anchor on this child.');return;}
 endEdgeReconnect();openStructureRelationship(old.id);
 Object.assign(connectionUi.structure,{parent:c.source,sourceHandle:c.sourceHandle,targetHandle:c.targetHandle});redrawModal();
}
function requestEdgeRemoval(id){
 if(askDiscardForm())return;
 if(!id.startsWith('contains-')){showModal('canvas-edge-remove',id);return;}
 const d=design(),child=d.nodes.find(n=>'contains-'+n.id===id);if(!child?.parent)return;
 const alternatives=structureDetachParents(d,child);
 edgeEditing.detach={id,child:child.id,owner:designOwner(),revision:d.revision,parent:child.parent,replacement:alternatives[0]?.id||''};edgeEditing.error='';
 showModal('edge-detach');
}
function structureDetachParents(d,child){
 return d.nodes.filter(n=>n.id!==child.parent&&['view','page','group'].includes(n.kind)&&!nodeDescendants(d,child.id).has(n.id)).filter(n=>{const test=designCopy(d);test.nodes.find(x=>x.id===child.id).parent=n.id;return !newDesignErrors(d,test).length;});
}
function edgeDetachDialog(){
 const f=edgeEditing.detach,d=design(),child=d.nodes.find(n=>n.id===f?.child);if(!child)return dialogBody('Relationship unavailable','Select a current line.');
 const needsOwner=child.kind==='page',alternatives=structureDetachParents(d,child);
 const choices=(needsOwner?[]:[['','Plugin root — detach only']]).concat(alternatives.map(n=>[n.id,n.label+' · '+NODE_KINDS[n.kind]]));
 return dialogBody('Remove this structural relationship?',`<p>Remove <strong>${esc(d.nodes.find(n=>n.id===child.parent)?.label||'Parent')} → ${esc(child.label)}</strong>. The screen, components and user-flow connections are kept.</p>${needsOwner?'<p>Internal screens still need a view container. Choose a replacement owner to remove the old relationship safely.</p>':''}${choices.length?`<label class="field">${needsOwner?'Replacement parent':'Keep this surface under'}<select id="detach-parent">${choices.map(([id,label])=>`<option value="${esc(id)}" ${id===f.replacement?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`:'<p class="callout warn">No other valid owner exists. Add a view container first; a screen cannot be left orphaned.</p>'}<p class="error" role="alert">${esc(edgeEditing.error)}</p>`,button('Keep relationship','close','','ghost')+button('Remove relationship','edge-detach-confirm','','danger','trash',choices.length?'':'disabled'));
}
function confirmStructureRemoval(){
 const d=design(),f=edgeEditing.detach,child=d.nodes.find(n=>n.id===f?.child);
 const fail=m=>{edgeEditing.error=m;redrawModal();};
 if(!child||state.activeRun||f.owner!==designOwner()||f.revision!==d.revision||child.parent!==f.parent)return fail('This review is stale. Reopen the current relationship.');
 const parent=document.getElementById('detach-parent')?.value||null,candidate=designCopy(d);candidate.nodes.find(n=>n.id===child.id).parent=parent;
 const errors=newDesignErrors(d,candidate);if(errors.length)return fail(errors[0].message);
 if(parent===child.parent)return fail('Choose a different parent.');
 recordDesign();child.parent=parent;delete canvasState().anchors[f.id];ensureStructureAnchors(d);designChanged();canvasUi.edge=null;closeModal();render();
 canvasAnnounce('Old containment removed; surfaces and content preserved. Undo restores it.');
}
function handleEdgeEditingAction(action,value){
 if(action==='edge-remove'){requestEdgeRemoval(value);return true;}
 if(action==='edge-detach-confirm'){confirmStructureRemoval();return true;}
 return false;
}
