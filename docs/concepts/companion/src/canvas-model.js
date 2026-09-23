// Canvas metadata is presentation state, not an input to generated source.
function emptyCanvas(){return {schema:1,layout:'vertical',positions:Object.create(null),pan:{x:32,y:28},zoom:1,snap:true,collapsed:[],edges:'selected',custom:false,arrangedFor:'',fitted:false};}
function validCanvas(c){
 if(c===undefined)return true;
 if(c.brickDisplay!==undefined&&!['structure','labels','wireframes'].includes(c.brickDisplay))return false;
 const plain=x=>x&&typeof x==='object'&&!Array.isArray(x),num=x=>Number.isFinite(x)&&Math.abs(x)<=50000;
 return plain(c)&&c.schema===1&&Object.hasOwn(MAP_LAYOUTS,c.layout)&&plain(c.positions)&&Object.keys(c.positions).length<=60&&Object.entries(c.positions).every(([id,p])=>typeof id==='string'&&id.length<=120&&plain(p)&&num(p.x)&&num(p.y))&&plain(c.pan)&&num(c.pan.x)&&num(c.pan.y)&&Number.isFinite(c.zoom)&&c.zoom>=0.12&&c.zoom<=2&&typeof c.snap==='boolean'&&Array.isArray(c.collapsed)&&c.collapsed.length<=60&&c.collapsed.every(id=>typeof id==='string'&&id.length<=120)&&['none','selected','all'].includes(c.edges)&&typeof c.custom==='boolean'&&typeof c.arrangedFor==='string'&&c.arrangedFor.length<=16000&&typeof c.fitted==='boolean'&&validCanvasPreferences(c.interaction);
}
function canvasStructure(d){return JSON.stringify(d.nodes.map(n=>[n.id,n.parent,n.kind]));}
function canvasState(d=design()){
 if(!validCanvas(d.canvas)||!d.canvas)d.canvas=emptyCanvas();
 const c=d.canvas;if(!c.interaction)c.interaction=defaultCanvasPreferences();const known=new Set(d.nodes.map(n=>n.id));
 if(Object.getPrototypeOf(c.positions)!==null)c.positions=Object.assign(Object.create(null),c.positions);
 for(const id of Object.keys(c.positions))if(!known.has(id))delete c.positions[id];
 c.collapsed=c.collapsed.filter(id=>known.has(id));
 if(d.nodes.some(n=>!Object.hasOwn(c.positions,n.id))){const fresh=layoutPositions(d,c.layout==='free'?'grid':c.layout);for(const n of d.nodes)if(!Object.hasOwn(c.positions,n.id))c.positions[n.id]=fresh[n.id]||{x:48,y:48};}
 if(!c.arrangedFor)c.arrangedFor=canvasStructure(d);
 if(canvasUi.owner!==designOwner()){canvasUi.owner=designOwner();flowUi.cancelled=false;canvasUi.edge=null;canvasUi.connecting=null;canvasUi.placing=null;canvasUi.search='';}
 return c;
}
function visibleMapNodes(d=design()){
 const hidden=new Set();for(const id of canvasState(d).collapsed)for(const child of nodeDescendants(d,id))if(child!==id)hidden.add(child);
 return designNodesInOrder(d).filter(({n})=>!hidden.has(n.id)).map(({n})=>n);
}
function canvasCommit(fn,message){
 if(state.activeRun){notify('Finish or cancel the active simulation before arranging the map.');return false;}
 const d=design();canvasState(d);recordDesign();fn(d.canvas);save();render();if(message)canvasAnnounce(message);return true;
}
function arrangeMap(layout){
 if(!Object.hasOwn(MAP_LAYOUTS,layout))return;
 const d=design();canvasCommit(c=>{c.layout=layout;if(layout!=='free')c.positions=layoutPositions(d,layout);c.custom=false;c.arrangedFor=canvasStructure(d);c.fitted=false;},'Applied '+MAP_LAYOUTS[layout]+'. Surface structure and generation plans are unchanged.');
}
function canvasAnnounce(text){
 const e=document.getElementById('canvas-live');if(e)e.textContent=text;
 const status=document.getElementById('map-status-message');if(status)status.textContent=text;
}
function moveMapNode(id,dx,dy){
 const d=design(),c=canvasState(d),p=c.positions[id];if(!p)return;
 canvasCommit(next=>{next.positions[id]={x:Math.max(-50000,Math.min(50000,p.x+dx)),y:Math.max(-50000,Math.min(50000,p.y+dy))};next.custom=true;},'Card moved. Parent and navigation order are unchanged.');
 focusMapNode(id);
}
function toggleMapBranch(id){
 const d=design();canvasCommit(c=>{c.collapsed=c.collapsed.includes(id)?c.collapsed.filter(x=>x!==id):[...c.collapsed,id];if(nodeDescendants(d,id).has(designUi.selected)&&designUi.selected!==id)designUi.selected=id;},'Branch visibility changed. No surfaces were removed.');
}
function showMapNode(id,focus=false){
 const d=design();if(!d.nodes.some(n=>n.id===id))return;
 const c=canvasState(d);c.collapsed=c.collapsed.filter(parent=>!nodeDescendants(d,parent).has(id));
 designUi.selected=id;canvasUi.edge=null;render();revealDesignSelection();if(focus)focusMapNode(id);
}
function focusMapNode(id){if(!id)return;const focus=()=>{if(designUi.selected===id&&!document.getElementById('modal').open)document.querySelector(`.map-node[data-node="${CSS.escape(id)}"]`)?.focus({preventScroll:true});};focus();if(flowUi.app)Vue.nextTick(focus);}
function mapMatch(n){const q=canvasUi.search.trim().toLowerCase();return !q||(n.label+' '+n.slug+' '+NODE_KINDS[n.kind]).toLowerCase().includes(q);}
function canvasBounds(nodes=visibleMapNodes()){
 const c=canvasState();if(!nodes.length)return {x:0,y:0,w:400,h:260};
 const xs=nodes.map(n=>c.positions[n.id].x),ys=nodes.map(n=>c.positions[n.id].y);
 return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)+MAP_SIZE.w,h:Math.max(...nodes.map(n=>c.positions[n.id].y+brickSurfaceSize(n).height))-Math.min(...ys)};
}
function fitMap(selected=false){
 const pane=document.getElementById('map-viewport');if(!pane)return;
 const c=canvasState(),nodes=selected&&selectedNode()?[selectedNode()]:visibleMapNodes(),b=canvasBounds(nodes);
 c.zoom=Math.max(.12,Math.min(selected?1.15:1,(pane.clientWidth-80)/b.w,(pane.clientHeight-(selected?160:100))/b.h));
 c.pan={x:(pane.clientWidth-b.w*c.zoom)/2-b.x*c.zoom,y:(pane.clientHeight-b.h*c.zoom)/2-b.y*c.zoom};c.fitted=true;paintMap();save();
}
function zoomMap(factor,anchor=null){
 const pane=document.getElementById('map-viewport');if(!pane)return;
 const c=canvasState(),z=Math.max(.12,Math.min(2,c.zoom*factor));const p=anchor||{x:pane.clientWidth/2,y:pane.clientHeight/2};
 c.pan={x:p.x-(p.x-c.pan.x)*z/c.zoom,y:p.y-(p.y-c.pan.y)*z/c.zoom};c.zoom=z;c.fitted=true;paintMap();save();
}
function paintMap(){
 if(flowUi.api){paintFlowViewport();return;}
 const world=document.getElementById('map-world');if(!world)return;
 const c=canvasState();world.style.setProperty('--map-zoom',c.zoom);world.style.setProperty('--map-inverse',1/c.zoom);world.style.transform=`translate(${c.pan.x}px,${c.pan.y}px) scale(${c.zoom})`;
 const z=document.getElementById('map-zoom-label');if(z)z.textContent=Math.round(c.zoom*100)+'%';
 const vp=document.getElementById('map-viewport');vp.style.backgroundSize=(24*c.zoom)+'px '+(24*c.zoom)+'px';vp.style.backgroundPosition=c.pan.x+'px '+c.pan.y+'px';
}
function afterCanvasRender(){
 document.body.classList.toggle('sitemap-workspace',state.view==='sitemap');document.body.classList.toggle('map-expanded',state.view==='sitemap'&&canvasUi.expanded);
 if(state.view==='sitemap'&&document.getElementById('map-viewport')){mountFlow();const c=canvasState();if(!c.fitted)fitMap();else paintMap();}
}
function revealDesignSelection(){
 const pane=document.getElementById('map-viewport'),n=selectedNode();if(!pane||!n)return;
 const c=canvasState(),p=c.positions[n.id],size=brickSurfaceSize(n),left=p.x*c.zoom+c.pan.x,top=p.y*c.zoom+c.pan.y;
 if(left<20||left+MAP_SIZE.w*c.zoom>pane.clientWidth-20||top<20||top+size.height*c.zoom>pane.clientHeight-20){c.pan={x:pane.clientWidth/2-(p.x+MAP_SIZE.w/2)*c.zoom,y:pane.clientHeight/2-(p.y+size.height/2)*c.zoom};paintMap();save();}
}

function generationSnapshot(d){const value=designSnapshot(d);delete value.canvas;return value;}
