// Real, pinned Vue Flow island. Canonical design remains in the shared concept model.
const flowUi={app:null,api:null,store:null,pinia:null,owner:null,serial:0,dragging:false,drag:null,connecting:false,cancelled:false,suppressClick:false,saveTimer:null,syncing:false};
function flowNodeProjection(d){const c=canvasState(d);return visibleMapNodes(d).map(n=>({id:n.id,type:'surface',position:{...c.positions[n.id]},data:{surface:designCopy(n),library:designCopy(d.library),dim:!mapMatch(n),collapsed:c.collapsed.includes(n.id),childCount:d.nodes.filter(x=>x.parent===n.id).length},selected:n.id===designUi.selected,draggable:!state.activeRun,selectable:true,connectable:n.kind!=='group',focusable:false,dimensions:brickSurfaceSize(n,d)}));}
function flowEdgeProjection(d){
 const c=canvasState(d),p=c.interaction,ids=new Set(visibleMapNodes(d).map(n=>n.id)),shape=p.curve==='bezier'?'default':p.curve;
 const parents=structureEdges(d,ids);
 const links=d.links.filter(e=>ids.has(e.from)&&ids.has(e.to)&&c.edges!=='none'&&(c.edges==='all'||!designUi.selected||[e.from,e.to].includes(designUi.selected))).map(e=>({id:e.id,source:e.from,target:e.to,sourceHandle:e.sourceHandle||'out-right',targetHandle:e.targetHandle||'in-left',type:'transition',selectable:true,focusable:true,selected:e.id===canvasUi.edge,updatable:!state.activeRun,interactionWidth:24,class:'flow-transition flow-type-'+e.kind,label:p.labels?({navigate:'Navigate',return:'Return',conditional:'Condition',open:'Dialog',configure:'Configure',execute:'Action',data:'Context'}[e.kind]):undefined,labelStyle:{fill:'var(--text)',fontSize:11,fontWeight:500},labelBgStyle:{fill:'var(--surface)',stroke:'var(--line)'},labelBgPadding:[7,5],labelBgBorderRadius:5,markerEnd:{type:VueFlowCore.MarkerType.ArrowClosed,color:'var(--accent)',width:18,height:18},data:{semanticType:e.kind,actionLabel:e.label,title:LINK_TYPES[e.kind].label+' · '+e.label,shape,offset:parallelEdgeOffset(d,e)},style:{stroke:'var(--accent)',strokeWidth:e.id===canvasUi.edge?2.6:1.8,strokeDasharray:e.kind==='data'?'2 5':e.kind==='conditional'?'8 4':'6 4'}}));
 return [...parents,...links];
}
function flowNodeContents(n,lib,children,collapsed){
 if(brickDisplay()!=='structure'&&canHaveBricks(n))return brickCardContents(n,lib,children,collapsed);
 const bindings=bricksOf(n).map(b=>`<button class="flow-binding-chip nodrag nopan" data-action="brick-edit" data-value="${esc(n.id+':'+b.id)}" title="Edit this component instance">${esc(b.title)}<span>${esc(b.region)}</span></button>`).join('');
 return `<div class="map-node-top"><span>${icon(n.kind==='view'?'box':n.kind==='modal'?'layers':n.kind==='action'?'zap':'file')}${esc(NODE_KINDS[n.kind])}</span>${n.entry?'<span class="map-entry">Entry</span>':''}${children?`<button class="flow-collapse nodrag nopan" data-action="canvas-collapse" data-value="${esc(n.id)}" title="${collapsed?'Expand':'Collapse'} branch">${collapsed?'+':'−'} ${children}</button>`:''}</div><strong class="map-card-title">${esc(n.label)}</strong><code class="map-card-slug">${esc(n.slug)}</code><div class="map-card-layout map-card-sketch" aria-label="Schematic layout preview">${layoutThumbnail(n.layout)}</div><button class="flow-card-intent nodrag nopan" data-action="flow-intent" data-value="${esc(n.id)}" title="Describe user intent and goals">${n.intent?esc(n.intent):'<span class="muted">What does the user want to do?</span>'}</button><div class="flow-card-meta"><button class="nodrag nopan flow-goals" data-action="flow-intent" data-value="${esc(n.id)}">${n.goals?.length||0} user goals</button><span>${esc(LAYOUTS.find(x=>x.id===n.layout)?.name||'No visual layout')}</span></div><div class="flow-card-bindings">${bindings||'<span class="tiny muted">No components placed</span>'}</div>${libraryCardToolbar(n)}`;
}
function createFlowNodeComponent(){
 const {h,defineComponent,onMounted,watch}=Vue;const {Handle,Position}=VueFlowCore;
 return defineComponent({name:'CompanionSurfaceCard',props:['id','data','selected'],setup(props){const serial=flowUi.serial;onMounted(()=>scheduleHandleMeasure(props.id,serial));watch(()=>props.data.surface.bricks?.length,()=>scheduleHandleMeasure(props.id,serial));return ()=>{
  const n=props.data.surface;const handles=Object.entries(PORTS).map(([side,port])=>h(Handle,{id:port.id,type:port.type,position:Position[side[0].toUpperCase()+side.slice(1)],connectable:n.kind!=='group'&&!state.activeRun,class:'flow-port flow-port-'+port.type,title:(port.type==='source'?'From ':'Into ')+n.label+' · '+side+'. Click for options; drag to connect.','aria-label':(port.type==='source'?'Outgoing':'Incoming')+' connector '+side+' on '+n.label+'; click for options or drag to connect',tabindex:0,role:'button','aria-haspopup':'menu','aria-expanded':'false','data-port-node':n.id,'data-port-side':side,onPointerdown:event=>portPointerDown(event,n.id,side),onClick:event=>portClick(event,n.id,side),onKeydown:event=>portKeyDown(event,n.id,side)}));
  for(const side of Object.keys(SIDE_NAMES))for(const type of ['source','target'])handles.push(h(Handle,{id:'structure-'+(type==='source'?'out-':'in-')+side,type,position:Position[side[0].toUpperCase()+side.slice(1)],connectable:false,class:'flow-structural-port','aria-hidden':'true',tabindex:-1}));
  return h('article',{class:['map-node','kind-'+n.kind,{'selected':props.selected,'search-dim':props.data.dim,'brick-page':brickDisplay()!=='structure'&&canHaveBricks(n)}],style:{'--brick-height':brickSurfaceSize(n).height+'px',width:brickSurfaceSize(n).width+'px'},tabindex:0,'data-node':n.id,'data-action':'canvas-select','data-value':n.id,'aria-label':n.label+' · '+NODE_KINDS[n.kind],role:'group','aria-current':props.selected?'true':undefined},[h('div',{class:'flow-node-content',innerHTML:flowNodeContents(n,props.data.library,props.data.childCount,props.data.collapsed)}),...handles]);
 };}});
}
function mountFlow(){
 const root=document.getElementById('vf-root');if(!root||flowUi.app)return;
 if(!window.Vue||!window.VueFlowCore||!window.Pinia){root.innerHTML='<p class="flow-runtime-error">The embedded graph runtime did not load. The outline remains available.</p>';return;}
 const owner=designOwner(),serial=++flowUi.serial;flowUi.owner=owner;flowUi.cancelled=false;flowUi.dragging=false;flowUi.connecting=false;flowUi.suppressClick=false;spatialUi.alt=false;
 const {h,createApp,defineComponent,markRaw,nextTick}=Vue;const {VueFlow,useVueFlow,ConnectionMode}=VueFlowCore;
 const pinia=Pinia.createPinia();flowUi.pinia=pinia;
 const useProjection=Pinia.defineStore('companion-canvas-'+serial,{state:()=>({nodes:flowNodeProjection(design()),edges:flowEdgeProjection(design()),preferences:{...canvasPreferences()},snap:canvasState().snap})});
 const store=useProjection(pinia);flowUi.store=store;
 const current=()=>flowUi.serial===serial&&flowUi.owner===owner&&owner===designOwner();
 const Component=defineComponent({name:'CompanionSitemap',setup(){
  const api=useVueFlow('companion-map-'+serial);flowUi.api=api;
  const nodeTypes={surface:markRaw(createFlowNodeComponent())};const edgeTypes={transition:markRaw(createFlowEdgeComponent()),structure:markRaw(createFlowEdgeComponent())};
  api.onError(error=>{if(current())console.error('[Sitemap] '+error.message);});
  api.onNodesChange(changes=>{if(current())api.applyNodeChanges(alignFlowChanges(changes.filter(x=>['dimensions','position','select'].includes(x.type))));});
  api.onEdgesChange(changes=>{if(current())api.applyEdgeChanges(changes.filter(x=>x.type==='select'));});
  api.onInit(()=>{nextTick(()=>{if(current()&&!flowUi.dragging&&!flowUi.connecting)paintFlowViewport();});});
  api.onNodesInitialized(()=>{nextTick(()=>{if(current()&&!flowUi.dragging&&!flowUi.connecting)paintFlowViewport();});});
  api.onNodeDragStart(({node,event})=>{
   if(!current()||state.activeRun)return;
   flowUi.drag={owner,revision:design().revision,id:node.id,startX:event.clientX,startY:event.clientY,before:designCopy(canvasState())};flowUi.dragging=true;flowUi.cancelled=false;
   beginSpatialDrag(node.id);designUi.selected=node.id;canvasUi.edge=null;paintMapSelection();
  });
  api.onNodeDrag(({event})=>{if(current()){canvasUi.metrics.moves++;canvasUi.metrics.frames++;updateSpatialDrag(event);queueSpatialPaint();}});
  api.onNodeDragStop(({node,event})=>{
   if(!current())return;const drag=flowUi.drag;flowUi.drag=null;flowUi.dragging=false;if(drag&&!flowUi.cancelled&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<5){api.applyNodeChanges([{id:node.id,type:'position',position:drag.before.positions[node.id],dragging:false}]);flowUi.suppressClick=false;clearSpatialGesture();return;}flowUi.suppressClick=true;
   setTimeout(()=>{if(current())flowUi.suppressClick=false;},160);
   if(!drag||drag.owner!==designOwner())return;
   if(flowUi.cancelled||drag.revision!==design().revision){design().canvas=drag.before;flowUi.cancelled=false;clearSpatialGesture();render();canvasAnnounce('Movement cancelled. Previous position restored.');return;}
   const live=spatialUi.last||api.findNode(node.id)?.position||node.position;const pos={x:Math.max(-50000,Math.min(50000,live.x)),y:Math.max(-50000,Math.min(50000,live.y))};
   if(JSON.stringify(pos)!==JSON.stringify(drag.before.positions[node.id])){recordDesign();canvasState().positions[node.id]=pos;canvasState().custom=true;if(spatialUi.drop)assignCardToSection(design(),node.id,spatialUi.drop.id);save();}
   clearSpatialGesture();render();canvasAnnounce('Card moved. One undo restores its position; structure is unchanged.');focusMapNode(node.id);
  });
  api.onConnectStart(()=>{if(current()){flowUi.cancelled=false;setFlowConnecting(true);}});
  api.onClickConnectStart(()=>{if(current()){flowUi.cancelled=false;setFlowConnecting(true);}});
  api.onConnect(connection=>{if(current()&&!flowUi.cancelled){setFlowConnecting(false);connectionUi.committed=true;reviewFlowConnection(connection);}});
  api.onConnectEnd(()=>{if(current())setFlowConnecting(false);});
  api.onClickConnectEnd(()=>{if(current())setFlowConnecting(false);});
  api.onEdgeClick(({edge,event})=>{if(!current())return;event.stopPropagation();dispatch('canvas-edge',edge.id);});
  api.onEdgeUpdate(({edge,connection})=>{if(current())reviewFlowConnection(connection,edge.id);});
  api.onPaneClick(()=>{if(current()&&!flowUi.suppressClick&&!canvasUi.placing)deselectFlow();});
  api.onViewportChange(v=>{if(!current()||flowUi.syncing)return;const c=canvasState();c.pan={x:Math.max(-50000,Math.min(50000,v.x)),y:Math.max(-50000,Math.min(50000,v.y))};c.zoom=Math.max(.12,Math.min(2,v.zoom));c.fitted=true;paintFlowChrome();clearTimeout(flowUi.saveTimer);flowUi.saveTimer=setTimeout(()=>{if(current())save();},150);});
  return ()=>h(VueFlow,{id:'companion-map-'+serial,nodes:store.nodes,edges:store.edges,nodeTypes,edgeTypes,applyDefault:false,connectionMode:ConnectionMode.Strict,connectOnClick:false,isValidConnection:validFlowConnection,panOnScroll:store.preferences.wheel==='pan',zoomOnScroll:store.preferences.wheel==='zoom',zoomOnPinch:store.preferences.pinch,zoomOnDoubleClick:false,zoomActivationKeyCode:['Control','Meta'],panOnDrag:store.preferences.panOnDrag,preventScrolling:store.preferences.wheel!=='page',minZoom:.12,maxZoom:2,snapToGrid:store.snap,snapGrid:[24,24],nodeDragThreshold:4,paneClickDistance:5,deleteKeyCode:null,selectionKeyCode:null,multiSelectionKeyCode:null,nodesFocusable:false,edgesFocusable:true,defaultViewport:{x:canvasState().pan.x,y:canvasState().pan.y,zoom:canvasState().zoom},noDragClassName:'nodrag',noPanClassName:'nopan',noWheelClassName:'nowheel'});
 }});
 flowUi.app=createApp(Component);flowUi.app.use(pinia);flowUi.app.mount(root);paintFlowChrome();
}
function destroyFlow(){
 closeConnectionMenu(false);resetFlowConnection(false);clearSpatialGesture();
 clearTimeout(flowUi.saveTimer);if(!flowUi.app)return;flowUi.serial++;
 if(flowUi.drag&&flowUi.owner===designOwner())design().canvas=flowUi.drag.before;
 const app=flowUi.app,store=flowUi.store,pinia=flowUi.pinia,api=flowUi.api;flowUi.app=null;flowUi.api=null;flowUi.store=null;flowUi.pinia=null;flowUi.drag=null;flowUi.dragging=false;flowUi.connecting=false;
 app.unmount();api?.$destroy();store?.$dispose();if(Pinia.disposePinia)Pinia.disposePinia(pinia);
}
function paintFlowChrome(){
 const c=canvasState(),root=document.getElementById('vf-root'),vp=document.getElementById('map-viewport');if(!vp)return;
 const z=document.getElementById('map-zoom-label');if(z)z.textContent=Math.round(c.zoom*100)+'%';
 if(root)root.style.setProperty('--map-inverse',1/c.zoom);
 vp.style.backgroundSize=(24*c.zoom)+'px '+(24*c.zoom)+'px';vp.style.backgroundPosition=c.pan.x+'px '+c.pan.y+'px';vp.style.backgroundImage=c.interaction.grid?'':'none';
 vp.dataset.wheel=c.interaction.wheel;vp.dataset.grid=String(c.interaction.grid);paintReferenceChrome();
}
function paintFlowViewport(){const c=canvasState();paintFlowChrome();const api=flowUi.api;if(!api)return;flowUi.syncing=true;Promise.resolve(api.setViewport({x:c.pan.x,y:c.pan.y,zoom:c.zoom},{duration:0})).finally(()=>{if(api===flowUi.api)flowUi.syncing=false;});}
function syncFlowSelection(){
 if(!flowUi.store)return;const selected=designUi.selected;
 for(const n of flowUi.store.nodes){n.selected=n.id===selected;n.data.dim=!mapMatch(n);}
 flowUi.store.edges=flowEdgeProjection(design());
 const changes=(flowUi.api?.getNodes.value||[]).map(n=>({id:n.id,type:'select',selected:n.id===selected}));flowUi.api?.applyNodeChanges(changes);
 const focus=document.querySelector('[data-action="canvas-focus"]');if(focus)focus.disabled=!selected;
}
function refreshFlowConfig(){const toggle=document.querySelector('[data-field="canvas-snap"]');if(toggle)toggle.checked=canvasState().snap;if(!flowUi.store)return;flowUi.store.preferences={...canvasPreferences()};flowUi.store.snap=canvasState().snap;flowUi.store.edges=flowEdgeProjection(design());paintFlowChrome();}
function cancelFlowGesture(){
 if(flowUi.dragging&&flowUi.drag){flowUi.cancelled=true;const drag=flowUi.drag;flowUi.api.applyNodeChanges([{id:drag.id,type:'position',position:drag.before.positions[drag.id],dragging:false}]);canvasAnnounce('Drag cancelled. Release the pointer to finish.');return true;}
 if(flowUi.connecting){resetFlowConnection(false);canvasAnnounce('Connection cancelled. Nothing changed.');return true;}
 return false;
}

function validFlowConnection(c){if(/^structure-out-(left|right|top|bottom)$/.test(c.sourceHandle)&&/^structure-in-(left|right|top|bottom)$/.test(c.targetHandle))return design().nodes.some(n=>n.id===c.target&&n.parent===c.source);return !connectionError(c.source,c.target,c.sourceHandle,c.targetHandle);}
