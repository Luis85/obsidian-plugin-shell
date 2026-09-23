// Keep parallel transitions independently inspectable; semantics never select geometry.
function parallelEdgeOffset(d,e){const peers=d.links.filter(x=>x.from===e.from&&x.to===e.to&&(x.sourceHandle||'out-right')===(e.sourceHandle||'out-right')&&(x.targetHandle||'in-left')===(e.targetHandle||'in-left'));const i=peers.findIndex(x=>x.id===e.id);return i>0?(i%2?1:-1)*Math.ceil(i/2)*64:0;}
function createFlowEdgeComponent(){
 const {h,defineComponent,onMounted,onUpdated,nextTick}=Vue,{BaseEdge,EdgeLabelRenderer,getBezierPath,getSmoothStepPath,getStraightPath}=VueFlowCore;
 return defineComponent({name:'CompanionTransition',props:['id','sourceX','sourceY','targetX','targetY','sourcePosition','targetPosition','markerEnd','markerStart','style','label','labelStyle','labelBgStyle','labelBgPadding','labelBgBorderRadius','interactionWidth','data'],setup(p){
  // SVG attribute names are case-sensitive: normalize the wrapper owned by Vue Flow.
  const syncAccessibility=()=>nextTick(()=>{const edge=document.querySelector('#vf-root .vue-flow__edge[data-id="'+CSS.escape(p.id)+'"]');if(edge){edge.setAttribute('tabindex','0');edge.setAttribute('role','button');edge.setAttribute('aria-label','Edit '+(p.data?.title||'relationship')+'. Press Enter or Space.');}});
  onMounted(syncAccessibility);onUpdated(syncAccessibility);
  return ()=>{
  const options={sourceX:p.sourceX,sourceY:p.sourceY,targetX:p.targetX,targetY:p.targetY,sourcePosition:p.sourcePosition,targetPosition:p.targetPosition};
  let [path,x,y]=(p.data?.shape==='smoothstep'?getSmoothStepPath:p.data?.shape==='straight'?getStraightPath:getBezierPath)(options);
  const offset=p.data?.offset||0;
  if(offset){
   const direction={right:[1,0],left:[-1,0],top:[0,-1],bottom:[0,1]},a=direction[p.sourcePosition]||[1,0],b=direction[p.targetPosition]||[-1,0];
   const span=Math.max(55,Math.min(180,Math.hypot(p.targetX-p.sourceX,p.targetY-p.sourceY)*.45));
   const cx1=p.sourceX+a[0]*span+(a[1]?offset:0),cy1=p.sourceY+a[1]*span+(a[0]?offset:0),cx2=p.targetX+b[0]*span+(b[1]?offset:0),cy2=p.targetY+b[1]*span+(b[0]?offset:0);
   x=(p.sourceX+3*cx1+3*cx2+p.targetX)/8;y=(p.sourceY+3*cy1+3*cy2+p.targetY)/8;
   path=p.data.shape==='straight'?`M ${p.sourceX},${p.sourceY} L ${x},${y} L ${p.targetX},${p.targetY}`:p.data.shape==='smoothstep'?`M ${p.sourceX},${p.sourceY} L ${cx1},${p.sourceY} L ${cx1},${y} L ${cx2},${y} L ${cx2},${p.targetY} L ${p.targetX},${p.targetY}`:`M ${p.sourceX},${p.sourceY} C ${cx1},${cy1} ${cx2},${cy2} ${p.targetX},${p.targetY}`;
  }
  if(p.label){const anchor=unobstructedEdgeLabel(path,x,y,p.data?.containment?45:100);x=anchor.x;y=anchor.y;}
  return h(Vue.Fragment,null,[h(BaseEdge,{id:p.id,path,markerEnd:p.markerEnd,markerStart:p.markerStart,style:p.style,interactionWidth:p.interactionWidth}),p.label?h(EdgeLabelRenderer,null,{default:()=>h('button',{class:'flow-edge-label nodrag nopan','data-flow-edge':p.id,style:{transform:`translate(-50%,-50%) translate(${x}px,${y}px)`},onClick:event=>{event.stopPropagation();dispatch('canvas-edge',p.id);},title:(p.data?.containment?'Edit structure: ':'Edit connection type: ')+p.data.title,'aria-label':'Edit '+p.data.title},p.data?.containment?p.label:[h('strong',p.label),h('span',p.data.actionLabel)])}):null]);
 };}});
}
function seedIntentExamples(d){
 const examples={workspace:['See my project notes in one place.',['Understand what needs attention','Open a relevant collection']],collection:['Find a note relevant to my current work.',['Filter and locate a record','Keep my filters when returning']],detail:['Understand a record before deciding what to do.',['Read the current status','Return to the collection']], 'capture-note':['Capture an idea without interrupting my work.',['Enter the essential details','Save intentionally or cancel without changes']],preferences:['Adapt the plugin to my workflow.',['Choose a notes folder','Understand the effect before saving']]};
 for(const n of d.nodes){const value=examples[n.slug];if(value){n.intent=value[0];n.goals=value[1];}}
}

// Choose a visible point on the existing path; do not move cards or rewrite relationships.
function unobstructedEdgeLabel(path,x,y,halfWidth=45){
 const points=flowUi.api?.getNodes.value?.map(n=>({...n.position,width:n.dimensions.width,height:n.dimensions.height}))||design().nodes.map(n=>({...canvasState().positions[n.id],...brickSurfaceSize(n)}));
 const clear=(p)=>points.every(n=>p.x+halfWidth<n.x||p.x-halfWidth>n.x+(n.width||MAP_SIZE.w)||p.y+18<n.y||p.y-18>n.y+(n.height||MAP_SIZE.h));
 if(clear({x,y}))return {x,y};
 const sample=document.createElementNS('http://www.w3.org/2000/svg','path');sample.setAttribute('d',path);
 const length=sample.getTotalLength();
 for(const fraction of [.35,.65,.2,.8,.12,.88,.06,.94]){const point=sample.getPointAtLength(length*fraction);if(clear(point))return point;}
 return {x,y};
}
