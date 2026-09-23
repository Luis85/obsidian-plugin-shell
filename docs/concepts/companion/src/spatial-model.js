// Spatial metadata: anchors, sections and guides never generate business code.
const spatialUi={guides:[],zones:[],drop:null,last:null,alt:false,frame:0};
function validAnchorMap(value){
 if(value===undefined)return true;
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=60&&Object.entries(value).every(([id,a])=>id.length<=140&&a&&typeof a.source==='string'&&typeof a.target==='string'&&a.source.length<=120&&a.target.length<=120&&(a.label===undefined||typeof a.label==='string'&&a.label.trim().length>0&&a.label.length<=120)&&/^structure-out-(left|right|top|bottom)$/.test(a.sourceHandle)&&/^structure-in-(left|right|top|bottom)$/.test(a.targetHandle));
}
function initialStructureAnchor(d,n){
 const c=d.canvas,points=c.positions,a=points[n.parent],b=points[n.id];let side=c.layout==='horizontal'?'right':'bottom';
 if(c.custom&&a&&b){const dx=b.x-a.x,dy=b.y-a.y;side=Math.abs(dx)>Math.abs(dy)?(dx>=0?'right':'left'):(dy>=0?'bottom':'top');}
 return {source:n.parent,target:n.id,sourceHandle:'structure-out-'+side,targetHandle:'structure-in-'+OPPOSITE_SIDE[side]};
}
function ensureStructureAnchors(d){
 const c=d.canvas;c.anchors=Object.assign(Object.create(null),c.anchors||{});
 const live=new Set();for(const n of d.nodes){if(!n.parent)continue;const id='contains-'+n.id;live.add(id);
  if(c.anchors[id]?.source!==n.parent||c.anchors[id]?.target!==n.id)c.anchors[id]=initialStructureAnchor(d,n);
 }
 for(const id of Object.keys(c.anchors))if(!live.has(id))delete c.anchors[id];
}
function sectionMembers(d,s){return s.members||[...new Set((s.roots||[]).flatMap(id=>[...nodeDescendants(d,id)]))];}
function adoptSections(d){
 if(!d.canvas?.sections)return;
 for(const s of d.canvas.sections){if(!s.members)s.members=sectionMembers(d,s);s.roots=[];}
}
function spatialPositionMap(){return Object.fromEntries((flowUi.api?.getNodes.value||[]).map(n=>[n.id,n.position]));}
function sectionZones(d,positions=d.canvas.positions){
 const sections=referenceSections(d);let nextX=48;
 return sections.map(s=>{
  const members=d.nodes.filter(n=>s.members.includes(n.id));
  const boxes=members.map(n=>({...(positions[n.id]||d.canvas.positions[n.id]),...brickSurfaceSize(n,d)}));
  const anchor=(d.canvas.sections||[]).find(x=>x.id===s.id)?.anchor;
  const x=boxes.length?Math.min(...boxes.map(p=>p.x))-40:anchor?.x??nextX;
  const y=boxes.length?Math.min(...boxes.map(p=>p.y))-64:anchor?.y??72;
  const width=boxes.length?Math.max(360,Math.max(...boxes.map(p=>p.x+p.width))+40-x):360;
  const height=boxes.length?Math.max(240,Math.max(...boxes.map(p=>p.y+p.height))+40-y):240;
  nextX=Math.max(nextX,x+width+80);
  return {...s,x,y,width,height,count:members.length};
 });
}
function sectionForCard(d,id){return referenceSections(d).find(s=>s.members.includes(id))?.id||'main';}
function assignCardToSection(d,nodeId,sectionId){
 const list=d.canvas.sections||[];if(sectionId!=='main'&&!list.some(s=>s.id===sectionId))return false;
 if(sectionForCard(d,nodeId)===sectionId)return false;
 for(const s of list)s.members=sectionMembers(d,s).filter(id=>id!==nodeId);
 if(sectionId!=='main')list.find(s=>s.id===sectionId).members.push(nodeId);
 return true;
}
function sectionAtPoint(zones,point,origin){
 // Prefer a different explicit section over the original expanding group.
 return zones.filter(z=>z.id!==origin&&point.x>=z.x&&point.x<=z.x+z.width&&point.y>=z.y&&point.y<=z.y+z.height)
  .sort((a,b)=>(a.id==='main')-(b.id==='main')||a.width*a.height-b.width*b.height||a.id.localeCompare(b.id))[0]||null;
}
function alignPosition(position,size,others,zoom,snap=true){
 const axes={x:[0,size.width/2,size.width],y:[0,size.height/2,size.height]},best={x:null,y:null};
 const threshold=7/zoom;
 for(const axis of ['x','y'])for(const other of [...others].sort((a,b)=>a.id.localeCompare(b.id))){
  const length=axis==='x'?other.width:other.height;
  for(const offset of axes[axis])for(const peer of [0,length/2,length]){
   const line=other[axis]+peer,delta=line-(position[axis]+offset);
   if(Math.abs(delta)<=threshold&&(!best[axis]||Math.abs(delta)<Math.abs(best[axis].delta)))best[axis]={axis,line,delta,id:other.id};
  }
 }
 return {position:{x:position.x+(snap?(best.x?.delta||0):0),y:position.y+(snap?(best.y?.delta||0):0)},guides:Object.values(best).filter(Boolean)};
}
function alignFlowChanges(changes){
 const drag=flowUi.drag;if(!drag||flowUi.cancelled)return changes;
 const d=design(),prefs=canvasPreferences(),nodes=flowUi.api?.getNodes.value||[];
 return changes.map(change=>{
  if(change.type!=='position'||change.id!==drag.id||!change.position)return change;
  const surface=d.nodes.find(n=>n.id===drag.id);if(!surface)return change;
  const others=nodes.filter(n=>n.id!==drag.id).map(n=>({id:n.id,...n.position,...brickSurfaceSize(d.nodes.find(s=>s.id===n.id),d)}));
  const aligned=prefs.guides!==false&&!spatialUi.alt?alignPosition(change.position,brickSurfaceSize(surface,d),others,canvasState().zoom,prefs.guideSnap!==false):{position:change.position,guides:[]};
  spatialUi.guides=aligned.guides;spatialUi.last=aligned.position;queueSpatialPaint();return {...change,position:aligned.position};
 });
}
function beginSpatialDrag(id){
 const d=design();spatialUi.zones=sectionZones(d);spatialUi.origin=sectionForCard(d,id);spatialUi.drop=null;spatialUi.last=null;spatialUi.guides=[];
}
function updateSpatialDrag(event){
 const vp=document.getElementById('map-viewport');if(!vp||!event)return;
 const r=vp.getBoundingClientRect(),c=canvasState(),point={x:(event.clientX-r.x-c.pan.x)/c.zoom,y:(event.clientY-r.y-c.pan.y)/c.zoom};
 spatialUi.drop=sectionAtPoint(spatialUi.zones,point,spatialUi.origin);queueSpatialPaint();
}
function clearSpatialGesture(){spatialUi.guides=[];spatialUi.drop=null;spatialUi.zones=[];spatialUi.last=null;queueSpatialPaint();}
