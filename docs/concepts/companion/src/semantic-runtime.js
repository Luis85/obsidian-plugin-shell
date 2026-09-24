// The ER diagram uses the same embedded Vue Flow engine as the sitemap.
function erProjection(){
 const m=semanticModel(),positions=m.canvas.positions;
 const frames=m.sections.map(s=>{const members=m.entities.filter(e=>e.section===s.id);if(!members.length)return null;
  const minX=Math.min(...members.map(e=>positions[e.id]?.x||0))-24,minY=Math.min(...members.map(e=>positions[e.id]?.y||0))-48;
  const right=Math.max(...members.map(e=>(positions[e.id]?.x||0)+290))+24,bottom=Math.max(...members.map(e=>(positions[e.id]?.y||0)+erCardHeight(e,m)))+24;
  return {id:'frame-'+s.id,type:'erSection',position:{x:minX,y:minY},data:{name:s.name,id:s.id},style:{width:(right-minX)+'px',height:(bottom-minY)+'px'},draggable:false,connectable:false,selectable:false,focusable:false,zIndex:-1};
 }).filter(Boolean);
 return [...frames,...m.entities.map((e,i)=>({id:e.id,type:'erEntity',position:positions[e.id]||{x:60+(i%3)*350,y:60+Math.floor(i/3)*450},data:{entity:designCopy(e),fields:erFields(e,m),height:erCardHeight(e,m)},selected:e.id===erUi.selected,draggable:!state.activeRun,connectable:!state.activeRun,focusable:true}))];
}
function erEdgeProjection(){return semanticModel().relationships.map(r=>({id:r.id,source:r.source,target:r.target,sourceHandle:'out',targetHandle:'in',type:'smoothstep',label:r.sourceCard+' · '+r.name+' / '+r.key+' · '+r.targetCard,interactionWidth:24,selected:r.id===erUi.edge,focusable:true,updatable:false,labelStyle:{fill:'var(--text)',fontSize:11,stroke:'none',strokeWidth:0},labelBgStyle:{fill:'var(--surface)',stroke:'var(--line)'},labelBgPadding:[8,5],labelBgBorderRadius:5,markerEnd:{type:VueFlowCore.MarkerType.ArrowClosed,color:'var(--accent)'},style:{stroke:'var(--accent)',strokeWidth:r.id===erUi.edge?3:2}}));}
function erMount(){
 const root=document.getElementById('er-flow');if(!root||erUi.app)return;
 const {h,defineComponent,createApp,markRaw,nextTick}=Vue,{VueFlow,useVueFlow,Handle,Position}=VueFlowCore;
 const serial=++erUi.serial,owner=designOwner(),current=()=>serial===erUi.serial&&owner===designOwner();
 const Entity=defineComponent({props:['data','selected'],setup(p){return ()=>{const e=p.data.entity;return h('article',{class:['er-card',{selected:p.selected}],'data-entity':e.id,style:{width:'290px',height:p.data.height+'px'},'aria-label':e.name+' entity'},[
  h('div',{class:'er-card-heading'},[h('small','ENTITY · MARKDOWN'),h('button',{class:'nodrag nopan','data-action':'er-edit','data-value':e.id},e.name),h('code',e.slug)]),
  h('div',{class:'er-card-properties',innerHTML:`<div><code>id</code><small>text · managed</small></div><div><code>type</code><small>text · managed</small></div>`+p.data.fields.slice(0,8).map(f=>`<div><code>${esc(f.key)}${f.required?' *':''}</code><small>${esc(ER_TYPES[f.type])}${f.relationship?' ↗':''}</small></div>`).join('')+(p.data.fields.length>8?`<small>+ ${p.data.fields.length-8} more · open entity</small>`:'')}),
  h('footer',e.folder),
  h(Handle,{id:'in',type:'target',position:Position.Left,class:'er-handle','aria-label':'Reference '+e.name,title:'Reference '+e.name}),
  h(Handle,{id:'out',type:'source',position:Position.Right,class:'er-handle','aria-label':'Link from '+e.name,title:'Drag to another entity, or use Connect entities'})
 ]);};}});
 const Section=defineComponent({props:['data'],setup(p){return ()=>h('div',{class:'er-section-frame'},h('button',{'data-action':'er-section','data-value':p.data.id,class:'nodrag nopan'},p.data.name));}});
 const Root=defineComponent({setup(){const api=useVueFlow('companion-er-'+serial);erUi.api=api;
  api.onNodesChange(changes=>{if(current())api.applyNodeChanges(changes.filter(c=>['position','dimensions','select'].includes(c.type)));});
  api.onEdgesChange(changes=>{if(current())api.applyEdgeChanges(changes.filter(c=>c.type==='select'));});
  api.onNodeClick(({node})=>{if(current()&&node.type==='erEntity')erPick(node.id);});
  api.onEdgeClick(({edge})=>{if(current())erPick(edge.id,true);});
  api.onConnect(connection=>{if(current()&&!state.activeRun)erBeginRelationship(connection.source,connection.target);});
  api.onNodeDragStart(({node})=>{if(current())erUi.drag={id:node.id,snapshot:JSON.stringify(semanticModel()),owner,revision:design().revision};});
  api.onNodeDragStop(({node})=>{
   if(!current())return;const drag=erUi.drag;erUi.drag=null;if(!drag||drag.snapshot!==JSON.stringify(semanticModel())||drag.revision!==design().revision){render();return;}
   const p={x:Math.max(-100000,Math.min(100000,node.position.x)),y:Math.max(-100000,Math.min(100000,node.position.y))};
   erPick(node.id);if(erCommit(m=>{m.canvas.positions[node.id]=p;},true)){api.setNodes(erProjection());}
  });
  api.onViewportChange(v=>{if(current()&&!erUi.drag){const c=semanticModel().canvas;c.viewport={x:Math.max(-200000,Math.min(200000,v.x)),y:Math.max(-200000,Math.min(200000,v.y)),zoom:Math.max(.15,Math.min(2,v.zoom))};save();}});
  api.onInit(()=>nextTick(()=>{if(current())api.setViewport(semanticModel().canvas.viewport,{duration:0});}));
  return ()=>h(VueFlow,{id:'companion-er-'+serial,nodes:erProjection(),edges:erEdgeProjection(),nodeTypes:{erEntity:markRaw(Entity),erSection:markRaw(Section)},applyDefault:false,defaultViewport:semanticModel().canvas.viewport,minZoom:.15,maxZoom:2,snapToGrid:semanticModel().canvas.snap,snapGrid:[20,20],panOnDrag:true,zoomOnScroll:true,zoomOnDoubleClick:false,deleteKeyCode:null,multiSelectionKeyCode:null,nodeDragThreshold:4,noDragClassName:'nodrag',noPanClassName:'nopan',noWheelClassName:'nowheel'});
 }});
 erUi.app=createApp(Root);erUi.app.mount(root);
}
function erDestroy(){if(!erUi.app)return;const app=erUi.app,api=erUi.api;erUi.serial++;erUi.app=null;erUi.api=null;erUi.drag=null;app.unmount();api?.$destroy();}
