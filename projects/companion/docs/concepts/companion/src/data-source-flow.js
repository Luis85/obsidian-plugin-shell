// Projection into the existing Vue Flow island. No source becomes a navigation node.
const DS_CARD_SIZE=Object.freeze({width:290,height:224});
function dsIsNode(id,d=design()){return !!d.dataSources?.sources.some(s=>s.id===id);}
function dsNodeSize(id,d=design()){return dsIsNode(id,d)?DS_CARD_SIZE:brickSurfaceSize(d.nodes.find(n=>n.id===id),d);}
function dsPorts(id,isSource){
 const {h}=Vue,{Handle,Position}=VueFlowCore;
 return ['left','right','top','bottom'].flatMap(side=>['source','target'].map(type=>h(Handle,{
  id:'ds-'+(type==='source'?'out-':'in-')+side,type,position:Position[side[0].toUpperCase()+side.slice(1)],
  class:'ds-port flow-port '+(isSource?'ds-source-port':''),connectable:()=>dsPortAvailable(id,isSource,type),'aria-disabled':String(!dsPortAvailable(id,isSource,type)),
  title:(type==='source'?'Data leaves':'Data enters')+' this '+(isSource?'source':'card')+'. Drag to connect data.',
  'aria-label':(type==='source'?'Outgoing':'Incoming')+' data connector '+side,tabindex:dsUi.show?0:-1,'aria-hidden':String(!dsUi.show),role:'button',
  onClick:event=>{event.stopPropagation();if(!flowUi.suppressClick)dsOpenFromPort(id,isSource,type);},
  onKeydown:event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();dsOpenFromPort(id,isSource,type);}}
 })));
}
function createDataSourceNode(){
 const {h,defineComponent,onMounted}=Vue;
 return defineComponent({name:'CompanionDataSource',props:['id','data','selected'],setup(p){onMounted(()=>scheduleHandleMeasure(p.id,flowUi.serial));return()=>{
  const s=p.data.source,flows=dataSources().flows.filter(f=>f.source===s.id);
  return h('article',{class:['ds-source-card',{'selected':p.selected,'search-dim':!dsMapMatch(s)}],style:{width:DS_CARD_SIZE.width+'px',height:DS_CARD_SIZE.height+'px'},'data-source-node':s.id,'data-action':'canvas-select','data-value':s.id,tabindex:0,role:'group','aria-label':s.name+' · data source · '+DS_KINDS[s.kind],onFocus:event=>{if(event.target===event.currentTarget&&!flowUi.dragging){selectSitemapItem('source',s.id);paintMapSelection();}}},[
   h('div',{class:'ds-source-card-body',innerHTML:`<div class="ds-source-type">${dsGlyph(s.kind)}<span>${esc(DS_KINDS[s.kind])}</span>${badge(s.status,s.status==='deprecated'?'warn':'')}</div><h3>${esc(s.name)}</h3><code>${esc(s.slug)}</code><p>${s.operations.length} operations · ${flows.length} data flows</p><div class="ds-card-actions nodrag nopan">${button('Manage','ds-catalog',s.id,'small')}${button('Connect data','ds-connect',s.id,'small','link',s.status==='deprecated'||!s.operations.length?'disabled':'')}</div><small>Design only · no live connection</small>`}),...dsPorts(s.id,true)
  ]);
 };}});
}
function dsMapMatch(s){return !canvasUi.search.trim()||(s.name+' '+s.slug+' '+DS_KINDS[s.kind]).toLowerCase().includes(canvasUi.search.trim().toLowerCase());}
function dataSourceNodeProjection(d){
 if(!dsUi.show)return [];
 const m=d.dataSources;if(!m)return [];
 return m.sources.filter(s=>Object.hasOwn(m.positions,s.id)).map(s=>({id:s.id,type:'dataSource',position:{...m.positions[s.id]},data:{source:designCopy(s)},dimensions:DS_CARD_SIZE,selected:dsUi.selected===s.id,draggable:!state.activeRun,selectable:true,connectable:true,focusable:false}));
}
function dsFacing(source,card,d){
 const a=d.dataSources.positions[source.id],b=canvasState(d).positions[card.id],bs=brickSurfaceSize(card,d),dx=b.x+bs.width/2-a.x-DS_CARD_SIZE.width/2,dy=b.y+bs.height/2-a.y-DS_CARD_SIZE.height/2;
 if(Math.abs(dx)>Math.abs(dy)*.7)return dx>=0?['right','left']:['left','right'];
 return dy>=0?['bottom','top']:['top','bottom'];
}
function dataFlowProjection(d,visibleIds){
 if(!dsUi.show||!d.dataSources)return [];
 const m=d.dataSources;
 return m.flows.filter(f=>visibleIds.has(f.card)&&Object.hasOwn(m.positions,f.source)).map(f=>{
  const source=m.sources.find(s=>s.id===f.source),card=d.nodes.find(n=>n.id===f.card),[a,b]=dsFacing(source,card,d),write=f.direction==='write';
  const marker={type:VueFlowCore.MarkerType.ArrowClosed,color:'var(--ds-accent)',width:18,height:18};
  const peers=m.flows.filter(x=>x.source===f.source&&x.card===f.card),index=peers.findIndex(x=>x.id===f.id);
  return {id:f.id,source:write?card.id:source.id,target:write?source.id:card.id,sourceHandle:'ds-out-'+(write?b:a),targetHandle:'ds-in-'+(write?a:b),type:'transition',selectable:true,focusable:true,updatable:false,selected:canvasUi.edge===f.id,class:'flow-transition ds-data-edge',interactionWidth:26,label:canvasPreferences().labels?f.direction==='both'?'Data · read & write':f.direction==='read'?'Data · read':'Data · write':undefined,
   markerEnd:marker,...(f.direction==='both'?{markerStart:marker}:{}),style:{stroke:'var(--ds-accent)',strokeWidth:canvasUi.edge===f.id?2.8:2,strokeDasharray:'3 4'},
   data:{dataSource:true,title:dsFlowSentence(f)+' · '+f.label,actionLabel:f.label,shape:'smoothstep',offset:index?Math.ceil(index/2)*44*(index%2?1:-1):0}};
 });
}
function dsConnectionError(c){
 if(state.activeRun)return 'Finish the active simulation before connecting data.';
 const d=design(),sourceId=dsIsNode(c.source)?c.source:dsIsNode(c.target)?c.target:null;
 if(!sourceId||dsIsNode(c.source)&&dsIsNode(c.target))return 'A data flow connects one data source to one sitemap card.';
 const card=d.nodes.find(n=>n.id===(c.source===sourceId?c.target:c.source)),source=dataSources().sources.find(s=>s.id===sourceId),direction=c.source===sourceId?'read':'write';
 if(!card||card.kind==='group')return 'Connect data to a view, screen, dialog, settings surface or action, not a navigation group.';
 if(source.status==='deprecated')return 'This source is deprecated. Use an active or draft source.';
 if(!source.operations.some(o=>o.direction===direction||o.direction==='both'))return 'Add a '+direction+' operation to this source first.';
 const sh=/^ds-out-(left|right|top|bottom)$/.test(c.sourceHandle)||['out-right','out-bottom'].includes(c.sourceHandle),th=/^ds-in-(left|right|top|bottom)$/.test(c.targetHandle)||['in-left','in-top'].includes(c.targetHandle);
 return sh&&th?'':'Draw from an outgoing data connector to an incoming connector.';
}
function dsReviewConnection(c){
 const error=dsConnectionError(c);if(error){notify(error);return false;}
 const read=dsIsNode(c.source);
 return !!dsEditFlow(null,read?c.source:c.target,read?c.target:c.source,read?'read':'write');
}
function dsPick(id){
 if(!selectSitemapItem('source',id))return;
 referenceUi.panel='inspector';paintMapSelection();
 canvasAnnounce('Selected data source. Manage its operations or connect it to a sitemap card.');
}
function dsRevealFlow(id){
 const d=design(),f=d.dataSources?.flows.find(x=>x.id===id);
 if(!f)return dsFail('This data flow no longer exists. Select a current connection.');
 if(!d.dataSources.positions[f.source]&&!dsCommit((m,next)=>dsPosition(f.source,m,next)))return false;
 dsUi.show=true;designUi.mode='map';referenceUi.panel='inspector';
 const c=canvasState(d);c.collapsed=c.collapsed.filter(parent=>!nodeDescendants(d,parent).has(f.card));
 selectSitemapItem('data-flow',id);setView('sitemap');
 Vue.nextTick(()=>{if(canvasUi.edge===id&&state.view==='sitemap')fitMap(true);});
 canvasAnnounce(dsFlowSentence(f,d)+'. Connection revealed; contracts unchanged.');return true;
}
function dsSitemapInspector(d,n){
 if(n)return `<h2>${esc(n.label)} · data flows</h2><p class="small muted">Data origins and destinations, not navigation or containment.</p>${button('Connect data source','ds-card-connect',n.id,'primary small','link',n.kind==='group'?'disabled':'')}${dsFlowList(dataSources().flows.filter(f=>f.card===n.id))}${button('Manage Data Sources','ds-catalog','','ghost small')}`;
 const source=d.dataSources?.sources.find(s=>s.id===dsUi.selected);if(!source)return '';
 const flows=d.dataSources.flows.filter(f=>f.source===source.id),disabled=source.status==='deprecated'||!source.operations.length;
 const heading=`<span class="ds-glyph">${dsGlyph(source.kind)}</span><h2>${esc(source.name)}</h2><p>${esc(DS_KINDS[source.kind])} · ${esc(source.status)}</p>`;
 if(canvasUi.inspector==='source-operations')return heading+`<p>Input enters this source; output leaves it. Contracts are shared by all usages.</p>${button('Add operation','ds-operation',source.id,'small','plus',source.operations.length>=DS_LIMITS.operations?'disabled':'')}`+(source.operations.map(o=>`<section class="ds-operation"><h3>${esc(o.name)}</h3><p>${esc(DS_DIRECTIONS[o.direction])}</p><div class="ds-shape-pair"><div><span>Input</span><strong>${esc(dsShapeLabel(o.input,d))}</strong></div><div><span>Output</span><strong>${esc(dsShapeLabel(o.output,d))}</strong></div></div>${button('Edit operation','ds-operation',source.id+':'+o.id,'small')}</section>`).join('')||'<p class="ds-help-empty">Add an operation before connecting this source. No unrelated source is substituted.</p>');
 if(canvasUi.inspector==='source-flows')return heading+button('Connect to card','ds-connect',source.id,'primary small','link',disabled?'disabled':'')+dsFlowList(flows);
 return heading+`<p>${esc(source.description||'Describe the purpose of this reusable source.')}</p><dl class="ds-facts"><dt>Location</dt><dd>${esc(source.locator||'Configure at runtime')}</dd><dt>Operations</dt><dd>${source.operations.length}</dd><dt>Data flows</dt><dd>${flows.length}</dd></dl><div class="row wrap">${button('Manage source','ds-catalog',source.id,'primary small')}${button('Connect to card','ds-connect',source.id,'small','link',disabled?'disabled':'')}${button('Position','ds-position',source.id,'small')}${button('Remove from canvas','ds-unplace',source.id,'ghost small','',flows.length?'disabled':'')}</div><p class="small muted">${flows.length?'This source has data flows. Remove them explicitly or hide the data layer.':'Removing this placement keeps the catalog definition.'} No live service, database or vault is accessed.</p>`;
}
function dsOutline(){
 if(!dataSources().sources.length)return '';
 return `<section class="ds-outline"><div class="ref-panel-heading"><strong>Data Sources</strong>${button('Manage','ds-catalog','','ghost small')}</div><p class="small muted">Separate from view hierarchy.</p>${dataSources().sources.map(s=>`<button data-action="ds-place" data-value="${s.id}" class="ds-outline-row">${dsGlyph(s.kind)}<span>${esc(s.name)}</span><small>${Object.hasOwn(dataSources().positions,s.id)?'Show':'Place'}</small></button>`).join('')}</section>`;
}
function dsExtendBounds(bounds,selected=false){
 if(!dsUi.show||!design().dataSources)return bounds;
 const positions=dataSources().positions,flow=selected?dataSources().flows.find(f=>f.id===canvasUi.edge):null;
 if(flow){const a=positions[flow.source],card=design().nodes.find(n=>n.id===flow.card),b=canvasState().positions[flow.card],size=brickSurfaceSize(card),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);return {x,y,w:Math.max(a.x+DS_CARD_SIZE.width,b.x+size.width)-x,h:Math.max(a.y+DS_CARD_SIZE.height,b.y+size.height)-y};}
 const ids=selected?(dsUi.selected&&positions[dsUi.selected]?[dsUi.selected]:[]):Object.keys(positions);
 if(!ids.length)return bounds;
 const boxes=ids.map(id=>({x:positions[id].x,y:positions[id].y,w:DS_CARD_SIZE.width,h:DS_CARD_SIZE.height}));
 if(!selected||selectedNode())boxes.push(bounds);
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
function dsBeginDrag({node,event}){
 if(!dsIsNode(node.id))return false;
 dsUi.drag={id:node.id,owner:designOwner(),revision:design().revision,before:{...dataSources().positions[node.id]},x:event.clientX,y:event.clientY,cancelled:false};flowUi.dragging=true;flowUi.cancelled=false;selectSitemapItem('source',node.id);paintMapSelection();return true;
}
function dsAlignChanges(changes){
 const drag=dsUi.drag;if(!drag||drag.cancelled)return changes;
 return changes.map(change=>{
  if(change.id!==drag.id||change.type!=='position'||!change.position)return change;
  const others=(flowUi.api?.getNodes.value||[]).filter(n=>n.id!==drag.id).map(n=>({id:n.id,...n.position,...dsNodeSize(n.id)}));
  const aligned=canvasPreferences().guides!==false&&!spatialUi.alt?alignPosition(change.position,DS_CARD_SIZE,others,canvasState().zoom,canvasPreferences().guideSnap!==false):{position:change.position,guides:[]};
  spatialUi.guides=aligned.guides;queueSpatialPaint();return {...change,position:aligned.position};
 });
}
function dsEndDrag({node,event}){
 const drag=dsUi.drag;if(!drag)return false;dsUi.drag=null;flowUi.dragging=false;clearSpatialGesture();
 const p=flowUi.api.findNode(node.id)?.position||node.position,moved=Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>=5;
 if(!drag.cancelled&&moved&&drag.owner===designOwner()&&drag.revision===design().revision)dsCommit(m=>{m.positions[node.id]={x:Math.max(-50000,Math.min(50000,p.x)),y:Math.max(-50000,Math.min(50000,p.y))};});
 flowUi.suppressClick=moved;render();return true;
}
function dsCancelDrag(repaint=false){
 if(!dsUi.drag)return false;
 const drag=dsUi.drag;dsUi.drag=null;flowUi.dragging=false;flowUi.cancelled=true;
 flowUi.api?.applyNodeChanges([{id:drag.id,type:'position',position:drag.before,dragging:false}]);clearSpatialGesture();
 if(repaint)queueMicrotask(()=>{if(state.view==='sitemap')render();});return true;
}
function dsHoverFlow(id,active){
 if(active)dsUi.hover=id;else if(dsUi.hover===id)dsUi.hover=null;
 dsPaintFlowFeedback();
}
function dsPaintFlowFeedback(){
 const ids=new Set();
 if(dsUi.show)for(const f of design().dataSources?.flows||[])if(f.id===dsUi.hover||f.id===canvasUi.edge){ids.add(f.card);ids.add(f.source);}
 document.querySelectorAll('#vf-root .vue-flow__node').forEach(node=>node.classList.toggle('ds-related',ids.has(node.dataset.id)));
}

document.addEventListener('keydown',event=>{
 if(state.view!=='sitemap'||document.getElementById('modal').open)return;
 if(event.key==='Escape'&&dsUi.drag){event.preventDefault();event.stopImmediatePropagation();dsCancelDrag(true);return;}
 const card=event.target.closest('[data-source-node]');if(!card||event.target.closest('button,.vue-flow__handle,input,textarea'))return;
 const id=card.dataset.sourceNode,steps={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};
 if(steps[event.key]){event.preventDefault();const [x,y]=steps[event.key],factor=event.shiftKey?4:1;if(dsCommit(m=>{m.positions[id].x=Math.max(-50000,Math.min(50000,m.positions[id].x+x*factor));m.positions[id].y=Math.max(-50000,Math.min(50000,m.positions[id].y+y*factor));})){render();document.querySelector('[data-source-node="'+CSS.escape(id)+'"]')?.focus();}}
 if(event.key==='Enter'){event.preventDefault();dsEditSource(id);}
},true);

function dsPaintConnectedPorts(){
 const root=document.getElementById('vf-root');if(!root)return;
 root.querySelectorAll('.ds-port.ds-connected').forEach(port=>port.classList.remove('ds-connected'));
 for(const edge of flowUi.api?.getEdges.value||[]){if(!edge.data?.dataSource)continue;
  for(const kind of ['source','target'])root.querySelector('.vue-flow__node[data-id="'+CSS.escape(edge[kind])+'"] [data-handleid="'+CSS.escape(edge[kind+'Handle'])+'"]')?.classList.add('ds-connected');
 }
}

function dsBeginConnection(params){
 dsUi.connection=params?.handleId?.startsWith('ds-')?{...params,owner:designOwner(),revision:design().revision}:null;
}
function dsFinishConnection(event){
 const pending=dsUi.connection;dsUi.connection=null;
 if(!pending||flowUi.cancelled||state.activeRun||document.getElementById('modal').open||pending.owner!==designOwner()||pending.revision!==design().revision)return;
 const point=event?.changedTouches?.[0]||event;
 if(!Number.isFinite(point?.clientX)||!Number.isFinite(point?.clientY))return;
 const target=document.elementFromPoint(point.clientX,point.clientY),node=target?.closest('#vf-root .vue-flow__node');
 if(!node||target.closest('.vue-flow__handle,button,input,textarea,select'))return;
 const id=node.dataset.id;if(!id||id===pending.nodeId)return;
 const outgoing=pending.handleType==='source';
 const c={source:outgoing?pending.nodeId:id,target:outgoing?id:pending.nodeId,sourceHandle:outgoing?pending.handleId:'ds-out-right',targetHandle:outgoing?'ds-in-left':pending.handleId};
 if(!dsIsNode(c.source)&&!dsIsNode(c.target))return;
 flowUi.suppressClick=true;setTimeout(()=>{if(!flowUi.dragging)flowUi.suppressClick=false;},180);
 dsReviewConnection(c);
}

function dsPortDirection(isSource,type){return (isSource?type==='source':type==='target')?'read':'write';}
function dsPortAvailable(id,isSource,type){
 if(state.activeRun)return false;
 if(!isSource)return dsUi.show;
 const source=dataSources().sources.find(s=>s.id===id),direction=dsPortDirection(isSource,type);
 return !!source&&source.status!=='deprecated'&&source.operations.some(o=>o.direction===direction||o.direction==='both');
}
function dsOpenFromPort(id,isSource,type){
 if(!dsPortAvailable(id,isSource,type)){notify('This data connector is unavailable. Add a compatible operation, enable the data layer or finish the active simulation.');return false;}
 return dsEditFlow(null,isSource?id:null,isSource?null:id,dsPortDirection(isSource,type));
}
