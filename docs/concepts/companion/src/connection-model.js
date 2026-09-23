// Relationship commands are canonical model changes; pointer gestures only propose them.
const connectionUi={menu:null,form:null,structure:null,error:'',pointer:null,committed:false};
const SIDE_NAMES={left:'Left',right:'Right',top:'Top',bottom:'Bottom'};
const OPPOSITE_SIDE={left:'right',right:'left',top:'bottom',bottom:'top'};
function newDesignErrors(before,after){
 const key=i=>JSON.stringify([i.code,i.node,i.message]);
 const existing=new Set(designIssues(before).filter(i=>i.level==='error').map(key));
 return designIssues(after).filter(i=>i.level==='error'&&!existing.has(key(i)));
}
function structureRoute(d,n){
 const c=canvasState(d),a=c.anchors['contains-'+n.id];
 return {sourceHandle:a.sourceHandle,targetHandle:a.targetHandle};
}

function structureEdges(d,ids,positions=null){
 const prefs=canvasState(d).interaction;
 return d.nodes.filter(n=>ids.has(n.id)&&ids.has(n.parent)).map(n=>({
  id:'contains-'+n.id,source:n.parent,target:n.id,...structureRoute(d,n,positions),type:'structure',
  selectable:true,focusable:true,updatable:!state.activeRun&&canvasUi.edge==='contains-'+n.id,selected:canvasUi.edge==='contains-'+n.id,
  interactionWidth:24,class:'flow-containment',label:prefs.labels?(canvasState(d).anchors['contains-'+n.id].label||'Contains'):undefined,
  style:{stroke:'var(--muted)',strokeWidth:canvasUi.edge==='contains-'+n.id?2.5:1.5},
  data:{containment:true,shape:'smoothstep',title:'Contains: '+d.nodes.find(x=>x.id===n.parent).label+' → '+n.label}
 }));
}
function refreshStructureRouting(){queueSpatialPaint();}

function nearestScreenParent(d,n){
 if(n.kind==='view')return n.id;
 if(n.kind==='page')return n.parent;
 return nodeOwner(d,n)?.id||d.nodes.find(x=>x.kind==='view')?.id||null;
}
function uniqueSurfaceName(d,kind){
 const label={page:'New screen',view:'New view',modal:'New dialog',group:'Navigation group',action:'New action',settings:'Settings'}[kind]||'New surface';
 return {label,slug:allocateSurfaceCode(d,label)};
}

function proposedCardPosition(d,origin,side,node=null){
 const c=canvasState(d),at=c.positions[origin];if(!at)return null;
 const horizontal=['left','right'].includes(side),sign=['left','top'].includes(side)?-1:1;
 const size=brickSurfaceSize(node||{kind:'page',bricks:[]},d),originSize=brickSurfaceSize(d.nodes.find(n=>n.id===origin),d);
 for(let i=0;i<121;i++){
  const lane=i===0?0:(i%2?1:-1)*Math.ceil(i/2),step=c.snap?24:1;
  let x=at.x+(horizontal?sign*((sign<0?size.width:originSize.width)+144):lane*(size.width+72));
  let y=at.y+(horizontal?lane*(size.height+88):sign*((sign<0?size.height:originSize.height)+144));
  x=Math.round(x/step)*step;y=Math.round(y/step)*step;
  if(Math.abs(x)>50000||Math.abs(y)>50000)continue;
  if(Object.entries(c.positions).every(([id,p])=>x+size.width+32<=p.x||x>=p.x+MAP_SIZE.w+32||y+size.height+32<=p.y||y>=p.y+brickSurfaceSize(d.nodes.find(n=>n.id===id),d).height+32))return {x,y};
 }
 return null;
}
function startConnectedCard(kind,context){
 if(state.activeRun){notify('Finish the active simulation before extending the sitemap.');return;}
 const d=design(),origin=d.nodes.find(n=>n.id===context?.node);
 if(!origin||origin.kind==='group'||context.owner!==designOwner()||context.revision!==d.revision){notify('The source card changed. Open its handle menu again.');return;}
 const direction=PORTS[context.side]?.type==='target'?'incoming':'outgoing',parent=kind==='page'?nearestScreenParent(d,origin):null;
 if(kind==='page'&&!parent){notify('Add a native view first, or choose New native view. An internal screen needs an owner.');return;}
 const defaults=uniqueSurfaceName(d,kind),target=direction==='incoming'?origin:{kind};
 connectionUi.form={owner:designOwner(),revision:d.revision,origin:origin.id,side:context.side,direction,
  kind,parent,nav:kind==='page',layout:kind==='modal'?'form':'single',placement:'tab',...defaults,
  autoSlug:true,linkKind:linkKind(target),actionLabel:direction==='incoming'?'Open '+origin.label:'Open '+defaults.label,
  autoAction:true,condition:'',intent:'',goals:''};
 connectionUi.error='';showModal('connection-create');
}
function connectedCardCandidate(d,f){
 const origin=d.nodes.find(n=>n.id===f.origin),nodeId='node-'+d.nextId,edgeId='edge-'+(d.nextId+1);
 const n={id:nodeId,kind:f.kind,label:f.label.trim(),slug:f.slug.trim(),parent:f.kind==='page'?f.parent:null,
  layout:f.layout,placement:f.placement,nav:f.kind==='page'&&f.nav,command:f.kind==='view',ribbon:false,entry:false,instance:'reuse',
  components:[],patterns:f.kind==='action'?['open-view']:[],goal:'',entity:'',intent:f.intent.trim(),goals:f.goals.split('\n').map(g=>g.trim()).filter(Boolean)};
 const incoming=f.direction==='incoming',from=incoming?n:origin,to=incoming?origin:n;
 const fromSide=incoming?OPPOSITE_SIDE[f.side]:f.side,toSide=incoming?f.side:OPPOSITE_SIDE[f.side];
 const e={id:edgeId,from:from.id,to:to.id,sourceHandle:'out-'+fromSide,targetHandle:'in-'+toSide,
  label:f.actionLabel.trim(),kind:f.linkKind,condition:f.linkKind==='conditional'?f.condition.trim():'',description:''};
 const candidate=designCopy(d);candidate.nodes.push(n);candidate.links.push(e);candidate.nextId=d.nextId+2;
 return {candidate,n,e};
}
function commitConnectedCard(){
 const d=design(),f=connectionUi.form,fail=m=>{connectionUi.error=m;redrawModal();};
 if(state.activeRun)return fail('Finish the active simulation before saving.');
 if(!f||f.owner!==designOwner()||f.revision!==d.revision||!d.nodes.some(n=>n.id===f.origin))return fail('This draft is stale. Cancel and reopen the handle menu.');
 if(d.nodes.length>=DESIGN_LIMITS.nodes||d.links.length>=DESIGN_LIMITS.links)return fail('The outline limit is reached. No card or connection was added.');
 if(!f.actionLabel.trim()||f.actionLabel.length>120)return fail('Use an action label of 1–120 characters.');
 if(f.linkKind==='conditional'&&!f.condition.trim())return fail('Describe the condition before saving this connection.');
 const {candidate,n,e}=connectedCardCandidate(d,f);
 if(!validIntentFields(n)||!validLinkFields(e))return fail('Intent, goals or connection details exceed their limits.');
 const errors=newDesignErrors(d,candidate);if(errors.length)return fail(errors[0].message);
 const position=proposedCardPosition(d,f.origin,f.side,n);if(!position)return fail('No free position near that handle. Move the source card and try again.');
 recordDesign();d.nodes=candidate.nodes;d.links=candidate.links;d.nextId=candidate.nextId;
 const c=canvasState(d);c.positions[n.id]=position;c.custom=true;assignCardToSection(d,n.id,sectionForCard(d,f.origin));
 c.collapsed=c.collapsed.filter(id=>!nodeDescendants(d,id).has(n.id));
 designChanged();designUi.selected=n.id;canvasUi.edge=e.id;canvasUi.inspector='links';closeModal();render();
 revealDesignSelection();focusMapNode(n.id);canvasAnnounce('Created '+n.label+' and its '+LINK_TYPES[e.kind].label+' connection. Undo removes both.');
}
function openStructureRelationship(childId){
 const d=design(),child=d.nodes.find(n=>n.id===childId);if(!child?.parent)return;
 connectionUi.structure={owner:designOwner(),revision:d.revision,child:child.id,parent:child.parent,anchorSnapshot:JSON.stringify(canvasState(d).anchors['contains-'+child.id]),label:canvasState(d).anchors['contains-'+child.id].label||'Contains',...structureRoute(d,child)};connectionUi.error='';
 designUi.selected=child.id;canvasUi.edge='contains-'+child.id;canvasUi.inspector='links';paintMapSelection();showModal('connection-structure');
}
function saveStructureRelationship(){
 const d=design(),f=connectionUi.structure,child=d.nodes.find(n=>n.id===f?.child),fail=m=>{connectionUi.error=m;redrawModal();};
 if(state.activeRun)return fail('Finish the active simulation before editing structure.');
 if(!child||f.owner!==designOwner()||f.revision!==d.revision)return fail('The relationship changed. Reopen it before saving.');
 if(!/^structure-out-(left|right|top|bottom)$/.test(f.sourceHandle)||!/^structure-in-(left|right|top|bottom)$/.test(f.targetHandle))return fail('Choose valid origin and destination connectors.');
 if(f.anchorSnapshot!==JSON.stringify(canvasState(d).anchors['contains-'+child.id]))return fail('The connector changed. Reopen its current settings.');
 if(!String(f.label||'').trim()||f.label.length>120)return fail('Use a relationship label of 1–120 characters.');
 const c=canvasState(),old=c.anchors['contains-'+child.id],next={source:f.parent,target:child.id,sourceHandle:f.sourceHandle,targetHandle:f.targetHandle,label:f.label.trim()};
 const candidate=designCopy(d);candidate.nodes.find(n=>n.id===child.id).parent=f.parent;
 const errors=newDesignErrors(d,candidate);if(errors.length)return fail(errors[0].message);
 if(child.parent===f.parent&&JSON.stringify({...old,label:old.label||'Contains'})===JSON.stringify(next)){closeModal();return;}
 const reparent=child.parent!==f.parent;recordDesign();child.parent=f.parent;
 if(child.parent)c.anchors['contains-'+child.id]=next;
 if(reparent)designChanged();else save();closeModal();render();canvasAnnounce('Structural relationship saved. Labels and anchor sides do not change containment.');
}
