// Projection into the existing Vue Flow island. No source becomes a navigation node.
const DS_CARD_SIZE=Object.freeze({width:290,height:224});
function dsIsNode(id,d=design()){return !!d.dataSources?.sources.some(s=>s.id===id);}
function dsNodeSize(id,d=design()){return dsIsNode(id,d)?DS_CARD_SIZE:brickSurfaceSize(d.nodes.find(n=>n.id===id),d);}
function dsPorts(id,isSource){
 const {h}=Vue,{Handle,Position}=VueFlowCore;
 return ['left','right','top','bottom'].flatMap(side=>['source','target'].map(type=>h(Handle,{
  id:'ds-'+(type==='source'?'out-':'in-')+side,type,position:Position[side[0].toUpperCase()+side.slice(1)],
  class:'ds-port flow-port '+(isSource?'ds-source-port':''),connectable:()=>!state.activeRun,
  title:(type==='source'?'Data leaves':'Data enters')+' this '+(isSource?'source':'card')+'. Drag to connect data.',
  'aria-label':(type==='source'?'Outgoing':'Incoming')+' data connector '+side,tabindex:0,role:'button',
  onClick:event=>{event.stopPropagation();if(!flowUi.suppressClick)dispatch(isSource?'ds-connect':'ds-card-connect',id);},
  onKeydown:event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();dispatch(isSource?'ds-connect':'ds-card-connect',id);}}
 })));
}
function createDataSourceNode(){
 const {h,defineComponent,onMounted}=Vue;
 return defineComponent({name:'CompanionDataSource',props:['id','data','selected'],setup(p){onMounted(()=>scheduleHandleMeasure(p.id,flowUi.serial));return()=>{
  const s=p.data.source,flows=dataSources().flows.filter(f=>f.source===s.id);
  return h('article',{class:['ds-source-card',{'selected':dsUi.selected===s.id,'search-dim':!dsMapMatch(s)}],style:{width:DS_CARD_SIZE.width+'px',height:DS_CARD_SIZE.height+'px'},'data-source-node':s.id,'data-action':'canvas-select','data-value':s.id,tabindex:0,role:'group','aria-label':s.name+' · data source · '+DS_KINDS[s.kind],onFocus:event=>{if(event.target===event.currentTarget&&!flowUi.dragging){designUi.selected=null;dsUi.selected=s.id;paintMapSelection();}}},[
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
 const read=dsIsNode(c.source),sourceId=read?c.source:c.target,source=dataSources().sources.find(s=>s.id===sourceId),direction=read?'read':'write',op=source.operations.find(o=>o.direction===direction||o.direction==='both');
 dsEditFlow(null,sourceId,read?c.target:c.source,direction);dsUi.form.operation=op.id;dsUi.form.label=op.name;redrawModal();return true;
}
function dsPick(id){
 if(!dsIsNode(id))return;dsUi.selected=id;designUi.selected=null;canvasUi.edge=null;referenceUi.panel='inspector';render();
 document.querySelector('[data-source-node="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});canvasAnnounce('Selected data source. Manage its operations or connect it to a sitemap card.');
}
function dsSitemapInspector(d,n){
 if(n)return `<h2>${esc(n.label)} · data flows</h2><p class="small muted">Data origins and destinations, not navigation or containment.</p>${button('Connect data source','ds-card-connect',n.id,'primary small','link')}${dsFlowList(dataSources().flows.filter(f=>f.card===n.id))}${button('Manage Data Sources','ds-catalog','','ghost small')}`;
 const source=d.dataSources?.sources.find(s=>s.id===dsUi.selected);if(!source)return '';
 return `<span class="ds-glyph">${dsGlyph(source.kind)}</span><h2>${esc(source.name)}</h2><p>${esc(DS_KINDS[source.kind])} · ${esc(source.status)}</p><p class="small muted">A reusable source declaration. It is not a view, navigation destination or ER entity.</p><div class="row wrap">${button('Manage source','ds-catalog',source.id,'primary small')}${button('Connect to card','ds-connect',source.id,'small','link')}${button('Position','ds-position',source.id,'small')}</div>${dsFlowList(dataSources().flows.filter(f=>f.source===source.id))}${button('Remove from canvas','ds-unplace',source.id,'ghost small')}<p class="small muted">Remove data flows first to remove this card. The catalog definition stays intact.</p>`;
}
function dsOutline(){
 if(!dataSources().sources.length)return '';
 return `<section class="ds-outline"><div class="ref-panel-heading"><strong>Data Sources</strong>${button('Manage','ds-catalog','','ghost small')}</div><p class="small muted">Separate from view hierarchy.</p>${dataSources().sources.map(s=>`<button data-action="ds-place" data-value="${s.id}" class="ds-outline-row">${dsGlyph(s.kind)}<span>${esc(s.name)}</span><small>${Object.hasOwn(dataSources().positions,s.id)?'Show':'Place'}</small></button>`).join('')}</section>`;
}
function dsExtendBounds(bounds,selected=false){
 if(!dsUi.show||!design().dataSources)return bounds;
 const positions=dataSources().positions,ids=selected?(dsUi.selected&&positions[dsUi.selected]?[dsUi.selected]:[]):Object.keys(positions);
 if(!ids.length)return bounds;
 const boxes=ids.map(id=>({x:positions[id].x,y:positions[id].y,w:DS_CARD_SIZE.width,h:DS_CARD_SIZE.height}));
 if(!selected||selectedNode())boxes.push(bounds);
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
function dsBeginDrag({node,event}){
 if(!dsIsNode(node.id))return false;
 dsUi.drag={id:node.id,owner:designOwner(),revision:design().revision,before:{...dataSources().positions[node.id]},x:event.clientX,y:event.clientY,cancelled:false};flowUi.dragging=true;flowUi.cancelled=false;dsUi.selected=node.id;designUi.selected=null;canvasUi.edge=null;return true;
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
 const f=design().dataSources?.flows.find(f=>f.id===id);if(!f)return;
 for(const key of [f.card,f.source])document.querySelector('#vf-root .vue-flow__node[data-id="'+CSS.escape(key)+'"]')?.classList.toggle('ds-related',active);
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
