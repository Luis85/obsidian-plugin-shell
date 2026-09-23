function connectedCardDialog(){
 const f=connectionUi.form,d=design(),origin=d.nodes.find(n=>n.id===f?.origin);if(!f||!origin)return dialogBody('Source no longer available','Cancel and choose a current card.');
 const target=f.direction==='incoming'?origin:{kind:f.kind},kinds=allowedLinkKinds(target),layouts=LAYOUTS.filter(l=>f.kind!=='modal'||['single','form','wizard'].includes(l.id));
 const parents=d.nodes.filter(n=>['view','page','group'].includes(n.kind)&&nodeOwner(d,n));
 const from=f.direction==='incoming'?f.label:origin.label,to=f.direction==='incoming'?origin.label:f.label;
 return dialogBody('Create a connected '+(f.kind==='page'?'screen':f.kind==='view'?'view':f.kind==='modal'?'dialog':'action'),`
  <div class="connection-review-strip"><span>${icon('link')} ${f.direction==='incoming'?'Leads into':'Continues from'} <strong>${esc(origin.label)}</strong></span><span>${esc(SIDE_NAMES[f.side])} handle</span></div>
  <p>One save creates the card and its editable user-flow connection. Cancel changes nothing.</p>
  <div class="grid2">${connectionInput('Card name','label',f.label)}${connectionInput('Code name','slug',f.slug)}</div>
  <div class="grid2">${connectionSelect('Layout template','layout',layouts.map(l=>[l.id,l.name]),f.layout)}${f.kind==='page'?connectionSelect('Lives inside','parent',parents.map(n=>[n.id,n.label]),f.parent):f.kind==='view'?connectionSelect('Initial placement','placement',Object.entries(PLACEMENTS),f.placement):'<div class="connection-kind-note">'+esc(NODE_KINDS[f.kind])+'<small>Separate surface; existing cards are not reparented.</small></div>'}</div>
  ${f.kind==='page'?`<label class="toggle-line"><input type="checkbox" data-field="connection-nav" ${f.nav?'checked':''}> Also list this screen in its parent navigation</label>`:''}
  <section class="connection-form-section"><h3>User-flow connection</h3><div class="connection-direction" id="connection-summary"><span>${esc(from)}</span>${icon('arrow')}<span>${esc(to)}</span></div>
  <div class="grid2">${connectionSelect('Connection type','linkKind',kinds.map(k=>[k,LINK_TYPES[k].label]),f.linkKind)}${connectionInput('Action label','actionLabel',f.actionLabel)}</div>
  ${f.linkKind==='conditional'?connectionInput('Condition','condition',f.condition,true):''}<p class="small muted">${esc(LINK_TYPES[f.linkKind]?.description||'')}</p></section>
  <details class="connection-intent-details"><summary>Describe user intent and goals</summary>${connectionInput('User intent','intent',f.intent,true)}${connectionInput('User goals — one per line','goals',f.goals,true)}</details>
  <p class="connection-save-note">${icon('shield')} Existing cards stay in place. No source code is written.</p><p class="error" id="connection-error" role="alert">${esc(connectionUi.error)}</p>`,button('Cancel','close','','ghost')+button('Create card & connection','connection-save','','primary','plus'));
}
function connectionInput(label,key,value,multi=false){return `<div class="field"><label for="connection-${key}">${label}</label>${multi?`<textarea id="connection-${key}" data-field="connection-${key}" rows="3" maxlength="${key==='goals'?4000:1000}">${esc(value)}</textarea>`:`<input id="connection-${key}" data-field="connection-${key}" maxlength="120" value="${esc(value)}">`}</div>`;}
function connectionSelect(label,key,options,value){return `<div class="field"><label for="connection-${key}">${label}</label><select id="connection-${key}" data-field="connection-${key}">${options.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`;}
function structureRelationshipDialog(){
 const f=connectionUi.structure,d=design(),child=d.nodes.find(n=>n.id===f?.child),parent=d.nodes.find(n=>n.id===child?.parent);
 if(!child||!parent)return dialogBody('Relationship unavailable','The parent or child no longer exists.');
 const excluded=nodeDescendants(d,child.id),parents=d.nodes.filter(n=>!excluded.has(n.id)&&['view','page','group'].includes(n.kind));
 return dialogBody('Edit structural relationship',`<div class="relationship-family">${icon('layers')} <strong>Contains</strong><span>Structure, not a user action</span></div>
 <div class="connection-direction"><span>${esc(parent.label)}</span>${icon('arrow')}<span>${esc(child.label)}</span></div>
 <p>This line records where <strong>${esc(child.label)}</strong> lives. It was created by <strong>Add inside</strong>, not by drawing a user-flow connection.</p>
 ${connectionInput('Connection label','structure-label',f.label||'Contains')}<p class="small muted">The caption is editable. The relationship remains structural containment.</p>${connectionSelect('Parent container','structure-parent',[['','Plugin root'],...parents.map(n=>[n.id,n.label+' · '+NODE_KINDS[n.kind]])],f.parent||'')}
 <p class="small muted">Reparenting updates the outline and source plan. Internal screens must still belong to a native view; cycles and incompatible parents are blocked.</p>
 <div class="connection-form-section"><h3>Looking for an editable action?</h3><p class="small muted">Use a separate typed connection for Navigate, Return, Open dialog or Pass context. Changing its type never changes containment.</p>${button('Add a user-flow connection…','connection-from-structure',child.id,'small','link')}</div>
 <div class="grid2">${connectionSelect('Origin connector','structure-source',Object.keys(SIDE_NAMES).map(s=>['structure-out-'+s,SIDE_NAMES[s]]),f.sourceHandle)}${connectionSelect('Destination connector','structure-target',Object.keys(SIDE_NAMES).map(s=>['structure-in-'+s,SIDE_NAMES[s]]),f.targetHandle)}</div><p class="connection-save-note">Attachment points stay fixed while cards move. Change them deliberately here; this does not change the relationship.</p><p class="error" id="connection-error" role="alert">${esc(connectionUi.error)}</p>`,button('Remove relationship','edge-remove','contains-'+child.id,'danger','trash')+button('Cancel','close','','ghost')+button('Save relationship','connection-structure-save','','primary','check'));
}
function structureInspector(d,n){
 const parent=d.nodes.find(x=>x.id===n.parent),children=d.nodes.filter(x=>x.parent===n.id);
 if(!parent&&!children.length)return '';
 return `<section class="structural-relationships"><h3>Structure</h3><p class="tiny muted">Where screens live. These are not navigation actions.</p>${parent?`<button class="structure-row" data-action="connection-structure" data-value="${esc(n.id)}">${icon('layers')}<span><strong>Inside ${esc(parent.label)}</strong><small>Change parent</small></span>${icon('settings')}</button>`:''}${children.map(c=>`<button class="structure-row" data-action="connection-structure" data-value="${esc(c.id)}">${icon('layers')}<span><strong>Contains ${esc(c.label)}</strong><small>Inspect structure</small></span>${icon('arrow')}</button>`).join('')}</section>`;
}
