// Shared concept application actions. Vue Flow never owns semantic graph mutations.
const interactionUi={componentQuery:'',binding:null,form:null,error:'',settingsOwner:null};
function validIntentFields(n){return (n.intent===undefined||typeof n.intent==='string'&&n.intent.length<=1000)&&(n.goals===undefined||Array.isArray(n.goals)&&n.goals.length<=12&&n.goals.every(g=>typeof g==='string'&&g.trim().length>0&&g.length<=300));}
function validLinkFields(e){return Object.hasOwn(LINK_TYPES,e.kind)&&(e.condition===undefined||typeof e.condition==='string'&&e.condition.length<=1000)&&(e.description===undefined||typeof e.description==='string'&&e.description.length<=1500)&&(e.sourceHandle===undefined||['out-right','out-bottom'].includes(e.sourceHandle))&&(e.targetHandle===undefined||['in-left','in-top'].includes(e.targetHandle));}
function validCanvasPreferences(p){return p===undefined||p&&p.schema===1&&['pan','zoom','page'].includes(p.wheel)&&['panOnDrag','pinch','grid','labels'].every(k=>typeof p[k]==='boolean')&&['bezier','smoothstep','straight'].includes(p.curve)&&['guides','guideSnap'].every(k=>p[k]===undefined||typeof p[k]==='boolean');}
function canvasPreferences(){return canvasState().interaction;}
function allowedLinkKinds(n){if(!n||n.kind==='group')return [];return n.kind==='modal'?['open','data']:n.kind==='settings'?['configure','data']:n.kind==='action'?['execute','data']:['navigate','return','conditional','data'];}
function nForFocus(){return selectedNode();}
function connectionError(from,to,sourceHandle='out-right',targetHandle='in-left'){
 if(dsIsNode(from)||dsIsNode(to))return dsConnectionError({source:from,target:to,sourceHandle,targetHandle});
 const d=design(),a=d.nodes.find(n=>n.id===from),b=d.nodes.find(n=>n.id===to);
 if(!a||!b||a.kind==='group'||b.kind==='group')return 'Choose two existing screens, dialogs or actions.';
 if(from===to)return 'Connect to another surface. Self-connections are not supported.';
 if(!['out-right','out-bottom'].includes(sourceHandle)||!['in-left','in-top'].includes(targetHandle))return 'Draw from an outgoing handle to an incoming handle.';
 return '';
}
function openTypedConnection(edge,overrides={}){
 if(state.activeRun){notify('Finish the active simulation before editing a connection.');return;}
 designUi.form={...designCopy(edge),sourceHandle:edge.sourceHandle||'out-right',targetHandle:edge.targetHandle||'in-left',condition:edge.condition||'',description:edge.description||'',...overrides,editing:true,edgeSnapshot:JSON.stringify(connectionEditIdentity(edge)),owner:designOwner(),baseRevision:design().revision};
 designUi.error='';showModal('design-connect');
}
function reviewFlowConnection(connection,edgeId=null){
 const {source,target,sourceHandle,targetHandle}=connection;
 if(dsIsNode(source)||dsIsNode(target))return dsReviewConnection(connection);
 const error=connectionError(source,target,sourceHandle,targetHandle);if(error){notify(error);return false;}
 if(state.activeRun){notify('Finish the active simulation before connecting surfaces.');return false;}
 const old=edgeId?design().links.find(e=>e.id===edgeId):null;
 if(edgeId&&!old){notify('That connection no longer exists.');return false;}
 const n=design().nodes.find(n=>n.id===target),kind=old&&allowedLinkKinds(n).includes(old.kind)?old.kind:linkKind(n);
 designUi.form={...(old?designCopy(old):{}),from:source,to:target,sourceHandle,targetHandle,kind,label:old?.label||'Open '+n.label,condition:old?.condition||'',description:old?.description||'',editing:!!old,edgeSnapshot:old?JSON.stringify(connectionEditIdentity(old)):null,owner:designOwner(),baseRevision:design().revision};
 designUi.error='';canvasUi.connecting=null;showModal('design-connect');return true;
}
function saveTypedConnection(){
 const f=designUi.form,d=design();const fail=message=>{designUi.error=message;redrawModal();};
 if(state.activeRun)return fail('Finish the active simulation before saving.');
 if(!f||f.owner!==designOwner()||f.baseRevision!==d.revision)return fail('This connection draft is stale. Reopen it against the current project.');
 if(f.editing&&(!d.links.some(e=>e.id===f.id)||f.edgeSnapshot!==JSON.stringify(connectionEditIdentity(d.links.find(e=>e.id===f.id)))))return fail('This connection changed. Copy your draft and reopen it.');
 const sh=f.sourceHandle||'out-right',th=f.targetHandle||'in-left',error=connectionError(f.from,f.to,sh,th);if(error)return fail(error);
 const kind=f.kind||linkKind(d.nodes.find(n=>n.id===f.to));
 if(!allowedLinkKinds(d.nodes.find(n=>n.id===f.to)).includes(kind))return fail('Select a connection type compatible with the destination.');
 if(!f.label?.trim()||f.label.length>120)return fail('Give this connection an action label of 1–120 characters.');
 if(kind==='conditional'&&!f.condition?.trim())return fail('Describe the condition for this transition. It will not be inferred or executed.');
 if(!f.editing&&d.links.length>=DESIGN_LIMITS.links)return fail('The concept supports at most 120 connections.');
 if(d.links.some(e=>e.id!==f.id&&e.from===f.from&&e.to===f.to&&e.kind===kind&&e.label===f.label.trim()))return fail('That typed connection already exists. Edit the existing line instead.');
 if(f.editing&&!d.links.some(e=>e.id===f.id))return fail('The original connection no longer exists.');
 const edge={id:f.editing?f.id:'edge-'+d.nextId,from:f.from,to:f.to,label:f.label.trim(),kind,sourceHandle:sh,targetHandle:th,condition:kind==='conditional'?f.condition.trim():'',description:(f.description||'').trim()};
 if(!validLinkFields(edge))return fail('Connection details exceed their limits.');
 if(f.editing&&JSON.stringify(connectionEditIdentity(d.links.find(e=>e.id===f.id)))===JSON.stringify(connectionEditIdentity(edge))){closeModal();return;}
 recordDesign();if(f.editing)d.links=d.links.map(e=>e.id===edge.id?edge:e);else{d.nextId++;d.links.push(edge);}designChanged();selectSitemapItem('surface',edge.from);canvasUi.edge=edge.id;canvasUi.inspector='links';closeModal();render();canvasAnnounce('Connection saved. '+LINK_TYPES[kind].label+'. Containment is unchanged.');
}
function deselectFlow(){
 brickUi.selected=null;brickUi.node=null;
 if(flowUi.dragging)return;selectSitemapItem('empty');canvasUi.connecting=null;canvasUi.placing=null;paintMapSelection();
 document.querySelectorAll('.outline-node').forEach(n=>{n.classList.remove('selected');n.setAttribute('aria-pressed','false');});
 const focus=document.querySelector('[data-action="canvas-focus"]');if(focus)focus.disabled=true;
 document.getElementById('map-viewport')?.focus({preventScroll:true});canvasAnnounce('Selection cleared. Click a surface or drag an outgoing handle.');
}
function editSurfaceIntent(id){
 const n=design().nodes.find(n=>n.id===id);if(!n)return;
 interactionUi.form={owner:designOwner(),revision:design().revision,node:id,intent:n.intent||'',goals:(n.goals||[]).join('\n')};interactionUi.error='';showModal('flow-intent');
}
function saveSurfaceIntent(){
 const f=interactionUi.form,d=design(),n=d.nodes.find(n=>n.id===f?.node);const fail=m=>{interactionUi.error=m;redrawModal();};
 if(!n||f.owner!==designOwner()||f.revision!==d.revision)return fail('The surface changed. Reopen the intent editor.');
 const next={...n,intent:f.intent.trim(),goals:f.goals.split('\n').map(s=>s.trim()).filter(Boolean)};
 if(!validIntentFields(next))return fail('Use at most 1,000 characters for intent and 12 goals of up to 300 characters each.');
 if(JSON.stringify([n.intent||'',n.goals||[]])===JSON.stringify([next.intent,next.goals])){closeModal();return;}
 recordDesign();n.intent=next.intent;n.goals=next.goals;designChanged();selectSitemapItem('surface',n.id);canvasUi.inspector='intent';closeModal();render();canvasAnnounce('User intent and goals saved. This is design context, not verified behavior.');
}
function beginBindingReview(nodeId,componentId){beginLibraryBrick(nodeId,componentId);}

function reviewExistingBinding(value){
 const [node,id,slot]=value.split(':'),n=design().nodes.find(n=>n.id===node),binding=n?.components.find(b=>b.id===id&&b.slot===slot);if(!binding)return;
 interactionUi.binding={owner:designOwner(),revision:design().revision,node,id,originalSlot:slot,slot,version:binding.version};interactionUi.error='';showModal('flow-binding');
}
function saveBindingRegion(){
 const f=interactionUi.binding,d=design(),n=d.nodes.find(n=>n.id===f?.node);if(!n||f.owner!==designOwner()||f.revision!==d.revision){interactionUi.error='The binding changed; reopen it.';redrawModal();return;}
 const b=n.components.find(b=>b.id===f.id&&b.slot===f.originalSlot);if(!b||!componentSlots(n).includes(f.slot)||n.components.some(x=>x!==b&&x.id===f.id&&x.slot===f.slot)){interactionUi.error='Choose an available region for this component.';redrawModal();return;}
 if(b.slot===f.slot){closeModal();return;}recordDesign();b.slot=f.slot;designChanged();closeModal();render();
}

function connectionEditIdentity(e){return [e.id,e.from,e.to,e.label,e.kind,e.sourceHandle||'out-right',e.targetHandle||'in-left',e.condition||'',e.description||''];}
