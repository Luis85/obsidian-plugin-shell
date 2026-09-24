// The semantic graph is a controlled, lifecycle-owned Vue Flow island.
function erProjection(){
 const m=semanticModel();return [...erSectionNodes(m),...m.entities.map(e=>({id:e.id,type:'erEntity',position:erPosition(m,e),data:{entity:designCopy(e),fields:erFields(e,m),height:erCardHeight(e,m)},selected:e.id===erUi.selected,draggable:!state.activeRun,connectable:!state.activeRun,focusable:true,ariaLabel:e.name+' entity. Enter to edit; arrow keys to move.'}))];
}
function erEdgeProjection(positions=semanticModel().canvas.positions){
 const m=semanticModel();return m.relationships.map(r=>{
  const a=m.entities.find(e=>e.id===r.source),b=m.entities.find(e=>e.id===r.target),ports=erPortPair(erRect(m,a,positions),erRect(m,b,positions),a.id===b.id);
  const lane=m.relationships.filter(other=>other.source===r.source&&other.target===r.target).findIndex(other=>other.id===r.id);
  return {id:r.id,source:r.source,target:r.target,sourceHandle:ports[0],targetHandle:ports[1],type:'erRelation',data:{relation:designCopy(r),lane},selected:r.id===erUi.edge,interactionWidth:24,focusable:true,updatable:false,ariaLabel:r.name+'. '+erRelationshipWords(r,m)+' Enter to edit.'};
 });
}
function erCardinalityMark(h,point,side,card){
 const angle={right:0,bottom:90,left:180,top:270}[side],elements=[],line=(x1,y1,x2,y2)=>h('line',{x1,y1,x2,y2});
 if(erMany(card))elements.push(line(1,-6,14,0),line(1,6,14,0));else elements.push(line(9,-6,9,6));
 if(card.startsWith('0'))elements.push(h('circle',{cx:22,cy:0,r:4,fill:'var(--bg)'}));else elements.push(line(21,-6,21,6));
 return h('g',{class:'er-cardinality',transform:`translate(${point.x},${point.y}) rotate(${angle})`,'aria-hidden':'true'},elements);
}
function erEdgeComponent(){const {h,defineComponent}=Vue,{BaseEdge}=VueFlowCore;
 return defineComponent({props:['id','sourceX','sourceY','targetX','targetY','sourcePosition','targetPosition','data','selected'],setup(p){return ()=>{
  const m=semanticModel(),positions=erCurrentPositions(),r=p.data.relation,s={x:p.sourceX,y:p.sourceY},t={x:p.targetX,y:p.targetY};
  const route=erRoute(s,t,p.sourcePosition,p.targetPosition,m.entities.map(e=>erRect(m,e,positions)),p.data.lane),name=r.name.length>22?r.name.slice(0,21)+'…':r.name;
  return h('g',{'data-er-route':p.id,'data-obstructed':String(route.obstructed)},[
   h('title',r.name+' · '+r.key+'. '+erRelationshipWords(r,m)),
   h(BaseEdge,{id:p.id,path:route.path,label:name,labelX:route.label.x,labelY:route.label.y-14,labelShowBg:true,interactionWidth:24,labelStyle:{fill:'var(--text)',fontSize:11,stroke:'none'},labelBgStyle:{fill:'var(--surface)',stroke:'var(--line)'},labelBgPadding:[8,5],labelBgBorderRadius:5}),
   erCardinalityMark(h,s,p.sourcePosition,r.sourceCard),erCardinalityMark(h,t,p.targetPosition,r.targetCard)
  ]);
 };}});
}
function erEntityComponent(){const {h,defineComponent}=Vue,{Handle,Position}=VueFlowCore;
 return defineComponent({props:['data','selected'],setup(p){return ()=>{const e=p.data.entity;
  const handles=[['in','target',Position.Left],['out','source',Position.Right],['in-right','target',Position.Right],['out-left','source',Position.Left],['in-top','target',Position.Top],['out-bottom','source',Position.Bottom],['in-bottom','target',Position.Bottom],['out-top','source',Position.Top]];
  return h('article',{class:['er-card',{selected:p.selected}],'data-entity':e.id,style:{width:ER_WIDTH+'px',height:p.data.height+'px'},'aria-label':e.name+' entity'},[
   h('div',{class:'er-card-heading'},[h('small','ENTITY · MARKDOWN'),h('button',{class:'nodrag nopan','data-action':'er-edit','data-value':e.id,title:'Edit '+e.name,disabled:!!state.activeRun},e.name),h('code',e.slug)]),
   h('div',{class:'er-card-properties',innerHTML:`<div><code>id</code><small>Text · managed</small></div><div><code>type</code><small>Text · managed</small></div>`+p.data.fields.slice(0,8).map(f=>`<div ${f.relationship?`data-relationship="${esc(f.relationship)}"`:''} title="${esc(f.key+' · '+ER_TYPES[f.type]+(f.required?' · required':''))}"><code>${esc(f.key)}${f.required?' *':''}</code><small>${esc(ER_TYPES[f.type])}${f.relationship?' ↗':''}</small></div>`).join('')+(p.data.fields.length>8?`<small>+ ${p.data.fields.length-8} more · open entity</small>`:'')}),
   h('footer',{title:e.folder},e.folder),
   ...handles.map(([id,type,position])=>h(Handle,{id,type,position,class:['er-handle','er-port-'+type,{'er-secondary-port':!['in','out'].includes(id)}],style:(position==='left'||position==='right')?{top:type==='source'?'46%':'60%'}:{left:type==='source'?'40%':'60%'},'aria-label':(type==='source'?'Link from ':'Reference ')+e.name,title:(type==='source'?'Drag from ':'Reference ')+e.name+' ('+position+'). Connect entities is the non-drag alternative.',isConnectable:!state.activeRun}))
  ]);
 };}});
}
function erMount(){
 const root=document.getElementById('er-flow');if(!root||erUi.app)return;
 const {h,defineComponent,createApp,markRaw,nextTick}=Vue,{VueFlow,useVueFlow,ConnectionMode}=VueFlowCore;
 const serial=++erUi.serial,owner=designOwner(),current=()=>serial===erUi.serial&&owner===designOwner();
 const initialNodes=erProjection(),initialEdges=erEdgeProjection(),Entity=erEntityComponent(),Edge=erEdgeComponent();
 const Section=defineComponent({props:['data'],setup(p){return ()=>h('div',{class:'er-section-frame'},h('button',{'data-action':'er-section','data-value':p.data.id,class:'nodrag nopan',disabled:!!state.activeRun,title:'Edit section '+p.data.name},p.data.name+' · '+p.data.count));}});
 const Root=defineComponent({setup(){const api=useVueFlow('companion-er-'+serial);erUi.api=api;
  api.onNodesChange(changes=>{
   if(!current())return;
   const next=changes.filter(c=>['dimensions','select'].includes(c.type)||c.type==='position'&&!erUi.cancelled&&!state.activeRun).map(c=>{
    if(c.type!=='position'||!c.position||!erUi.drag||c.id!==erUi.drag.id)return c;
    const result=erSnapPosition(semanticModel(),c.id,c.position,api.viewport.value.zoom,erUi.bypass);erPaintGuides(result.guides);return {...c,position:result.position};
   });api.applyNodeChanges(next);nextTick(erFitReady);
  });
  api.onEdgesChange(changes=>{if(current())api.applyEdgeChanges(changes.filter(c=>c.type==='select'));});
  api.onNodeClick(({node,event})=>{if(current()&&node.type==='erEntity'&&!erUi.cancelled){erPick(node.id);}});
  api.onNodeDoubleClick(({node,event})=>{if(current()&&node.type==='erEntity'&&!event.target.closest('button,.vue-flow__handle'))erBeginEntity(node.id);});
  api.onPaneClick(()=>{if(current()&&!erUi.cancelled)erPick(null);});
  api.onEdgeClick(({edge,event})=>{if(current()){event.stopPropagation();erPick(edge.id,true);}});
  api.onEdgeDoubleClick(({edge})=>{if(current())erBeginRelationship(null,null,edge.id);});
  api.onEdgeMouseEnter(({edge})=>{if(current())erHighlightRelationship(edge.id);});
  api.onEdgeMouseLeave(()=>{if(current())erHighlightRelationship();});
  api.onConnectStart(()=>{if(current()){erUi.cancelled=false;erUi.connecting=true;root.classList.add('er-connecting');erAnnounce('Choose a reference target. Escape cancels.');}});
  api.onConnect(connection=>{if(current()&&!erUi.cancelled&&!state.activeRun){erUi.connecting=false;erBeginRelationship(connection.source,connection.target);}});
  api.onConnectEnd(()=>{if(current()){erUi.connecting=false;root.classList.remove('er-connecting');}});
  api.onNodeDragStart(({node,event})=>{if(current()){erUi.cancelled=false;erUi.bypass=!!event.altKey;erUi.drag={id:node.id,snapshot:JSON.stringify(semanticModel()),owner,revision:design().revision};erPick(node.id);}});
  api.onNodeDrag(()=>{if(current())erRefreshGeometry();});
  api.onNodeDragStop(({node})=>{
   if(!current())return;const drag=erUi.drag;erUi.drag=null;const aligned=erUi.guides?.length;erPaintGuides();
   if(!drag)return;
   if(drag.snapshot!==JSON.stringify(semanticModel())||drag.revision!==design().revision){render();erAnnounce('The diagram changed during the move. Saved data was kept; move again.');return;}
   const moved=api.findNode(node.id),p={x:moved.position.x,y:moved.position.y};
   if(erCommit(m=>{m.canvas.positions[node.id]=p;},true)){erRefreshGeometry();erSelectionFeedback();erAnnounce((aligned?'Aligned. ':'')+'Position saved. Undo is available.');}
  });
  api.onViewportChange(v=>{if(current()){
   erPaintGuides(erUi.guides||[]);const output=document.getElementById('er-zoom-level');if(output)output.textContent=Math.round(v.zoom*100)+'%';
   if(!erUi.drag){semanticModel().canvas.viewport={x:Math.max(-200000,Math.min(200000,v.x)),y:Math.max(-200000,Math.min(200000,v.y)),zoom:Math.max(.15,Math.min(2,v.zoom))};save();}
  }});
  api.onInit(()=>nextTick(()=>{if(current()){api.setViewport(semanticModel().canvas.viewport,{duration:0});api.updateNodeInternals();erSelectionFeedback();erFitReady();}}));
  return ()=>h(VueFlow,{id:'companion-er-'+serial,nodes:initialNodes,edges:initialEdges,nodeTypes:{erEntity:markRaw(Entity),erSection:markRaw(Section)},edgeTypes:{erRelation:markRaw(Edge)},applyDefault:false,defaultViewport:semanticModel().canvas.viewport,minZoom:.15,maxZoom:2,snapToGrid:false,panOnDrag:true,zoomOnScroll:true,zoomOnDoubleClick:false,deleteKeyCode:null,multiSelectionKeyCode:null,connectionMode:ConnectionMode.Strict,isValidConnection:c=>!state.activeRun&&!!api.findNode(c.source)&&!!api.findNode(c.target),nodeDragThreshold:4,noDragClassName:'nodrag',noPanClassName:'nopan',noWheelClassName:'nowheel'});
 }});
 erUi.cancelled=false;erUi.app=createApp(Root);erUi.app.mount(root);
 const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.id='er-guides';overlay.setAttribute('aria-hidden','true');root.appendChild(overlay);
 erUi.pointerStart=()=>{if(!erUi.drag&&!erUi.connecting)erUi.cancelled=false;};root.addEventListener('pointerdown',erUi.pointerStart,true);
 erUi.pointerMove=e=>{erUi.bypass=e.altKey;};erUi.pointerCancel=()=>erCancelGesture();
 root.addEventListener('pointermove',erUi.pointerMove,true);root.addEventListener('pointercancel',erUi.pointerCancel,true);
 erUi.blur=()=>erCancelGesture();window.addEventListener('blur',erUi.blur);
}
function erDestroy(){
 if(!erUi.app)return;const app=erUi.app,api=erUi.api,root=document.getElementById('er-flow');
 root?.removeEventListener('pointerdown',erUi.pointerStart,true);root?.removeEventListener('pointermove',erUi.pointerMove,true);root?.removeEventListener('pointercancel',erUi.pointerCancel,true);window.removeEventListener('blur',erUi.blur);
 erUi.serial++;erUi.app=null;erUi.api=null;erUi.drag=null;erUi.connecting=false;erUi.guides=[];app.unmount();api?.$destroy();
}
