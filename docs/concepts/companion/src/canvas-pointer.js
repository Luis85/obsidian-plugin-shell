// Pointer movement updates only world coordinates and SVG paths, never the full app.
function mapPointerDown(event){
 if(event.target.closest('#vf-root'))return;
 const vp=event.target.closest('#map-viewport');if(!vp||event.button!==0||event.target.closest('button,input,select,.map-controls,.map-edge,.map-legend,.ref-node-toolbar,.ref-main-dock,.ref-canvas-top,.ref-panel'))return;
 if(canvasUi.connecting||canvasUi.placing)return;
 const card=event.target.closest('.map-node'),c=canvasState();
 if(card&&state.activeRun){notify('Finish or cancel the active simulation before moving a card.');return;}
 if(card){designUi.selected=card.dataset.node;paintMapSelection();card.focus({preventScroll:true});}
 canvasUi.drag={pointer:event.pointerId,owner:designOwner(),revision:design().revision,startX:event.clientX,startY:event.clientY,kind:card?'node':'pan',node:card?.dataset.node,before:designCopy(c),moved:false,frame:0,dx:0,dy:0};
 canvasUi.drag.capture=card||vp;(card||vp).setPointerCapture(event.pointerId);event.preventDefault();
}
function paintMapSelection(){
 document.querySelectorAll('.map-node').forEach(el=>el.classList.toggle('selected',el.dataset.node===designUi.selected));
 const inspector=document.querySelector('.inspector-body'),n=selectedNode();
 if(inspector)inspector.innerHTML=flowInspector(design(),n);if(flowUi.api)syncFlowSelection();paintReferenceChrome();
 const wires=document.getElementById('map-wires');if(wires)wires.innerHTML=canvasWires(design(),visibleMapNodes());
}
function mapPointerMove(event){
 const drag=canvasUi.drag;if(!drag||event.pointerId!==drag.pointer)return;
 drag.dx=event.clientX-drag.startX;drag.dy=event.clientY-drag.startY;
 if(!drag.moved&&Math.hypot(drag.dx,drag.dy)<5)return;
 drag.moved=true;canvasUi.metrics.moves++;
 if(drag.frame)return;drag.frame=requestAnimationFrame(()=>{drag.frame=0;applyPointerFrame();});event.preventDefault();
}
function applyPointerFrame(){
 const drag=canvasUi.drag;if(!drag)return;
 const c=canvasState();canvasUi.metrics.frames++;
 if(drag.kind==='node'){
  const original=drag.before.positions[drag.node],step=c.snap?24:1;
  c.positions[drag.node]={x:Math.max(-50000,Math.min(50000,Math.round((original.x+drag.dx/c.zoom)/step)*step)),y:Math.max(-50000,Math.min(50000,Math.round((original.y+drag.dy/c.zoom)/step)*step))};
  const el=document.querySelector(`.map-node[data-node="${CSS.escape(drag.node)}"]`);if(el){el.style.left=c.positions[drag.node].x+'px';el.style.top=c.positions[drag.node].y+'px';el.classList.add('dragging');}
  document.getElementById('map-wires').innerHTML=canvasWires(design(),visibleMapNodes());
 }else{c.pan={x:Math.max(-50000,Math.min(50000,drag.before.pan.x+drag.dx)),y:Math.max(-50000,Math.min(50000,drag.before.pan.y+drag.dy))};paintMap();}
 document.getElementById('map-viewport')?.classList.add('is-dragging');
}
function endMapPointer(cancel=false){
 const drag=canvasUi.drag;if(!drag)return;
 if(drag.frame){cancelAnimationFrame(drag.frame);drag.frame=0;}if(drag.moved&&!cancel)applyPointerFrame();
 canvasUi.drag=null;const vp=document.getElementById('map-viewport');if(drag.capture?.hasPointerCapture(drag.pointer))drag.capture.releasePointerCapture(drag.pointer);
 if(drag.owner!==designOwner())return;
 if(cancel||drag.revision!==design().revision){design().canvas=drag.before;render();canvasAnnounce('Movement cancelled. Previous position restored.');}
 else if(drag.moved){
  if(drag.kind==='node'){const after=designCopy(design().canvas);design().canvas=drag.before;if(JSON.stringify(after.positions[drag.node])!==JSON.stringify(drag.before.positions[drag.node])){recordDesign();after.custom=true;design().canvas=after;}save();render();canvasAnnounce('Card moved. One undo restores its position.');focusMapNode(drag.node);}
  else{save();vp?.classList.remove('is-dragging');}
 }else vp?.classList.remove('is-dragging');
 if(drag.moved){canvasUi.suppressClick=true;setTimeout(()=>canvasUi.suppressClick=false,150);}
}
function mapPointerUp(event){if(event.pointerId===canvasUi.drag?.pointer)endMapPointer(false);}
function mapPointerCancel(event){if(event.pointerId===canvasUi.drag?.pointer)endMapPointer(true);}
function mapClickCapture(event){
 if(canvasUi.suppressClick&&event.target.closest('#map-viewport')){canvasUi.suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}
 if(canvasUi.placing&&event.target.closest('#map-viewport')&&!event.target.closest('.map-node,button,.map-edge')){
  const vp=document.getElementById('map-viewport'),box=vp.getBoundingClientRect(),c=canvasState(),id=canvasUi.placing,step=c.snap?24:1;
  const x=Math.round(((event.clientX-box.left-c.pan.x)/c.zoom-MAP_SIZE.w/2)/step)*step,y=Math.round(((event.clientY-box.top-c.pan.y)/c.zoom-MAP_SIZE.h/2)/step)*step;
  canvasUi.placing=null;canvasCommit(next=>{next.positions[id]={x:Math.max(-50000,Math.min(50000,x)),y:Math.max(-50000,Math.min(50000,y))};next.custom=true;},'Card placed. Structure is unchanged.');event.preventDefault();event.stopImmediatePropagation();
 }
}
function mapKeyDown(event){
 if(state.view!=='sitemap'||document.getElementById('modal').open||connectionUi.menu)return;
 if(event.key==='Escape'){
  if(cancelFlowGesture()){event.preventDefault();return;}
  if(canvasUi.drag){event.preventDefault();endMapPointer(true);return;}
  if(canvasUi.connecting||canvasUi.placing){canvasUi.connecting=null;canvasUi.placing=null;render();canvasAnnounce('Connection or placement cancelled.');return;}
 }
 if(event.target.id==='map-search'&&event.key==='Enter'){
  const match=design().nodes.find(mapMatch);if(match){showMapNode(match.id,true);fitMap(true);}else canvasAnnounce('No matching surfaces. Clear the search to return to the map.');event.preventDefault();return;
 }
 if(event.target.closest('input,textarea,select,[contenteditable=true]'))return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){
  event.preventDefault();dispatch(event.shiftKey?'design-redo':'design-undo');focusMapNode(selectedNode()?.id);return;
 }
 const card=event.target.closest('.map-node');if(!card||event.target.closest('button,.flow-port'))return;
 const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(directions[event.key]){event.preventDefault();const [dx,dy]=directions[event.key],step=event.shiftKey?96:24;moveMapNode(card.dataset.node,dx*step,dy*step);}
 if(event.key==='Enter'){event.preventDefault();startNodeForm('view',card.dataset.node);}
 if(event.key===' '){event.preventDefault();showMapNode(card.dataset.node,true);}
 if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();showModal('design-remove',card.dataset.node);}
}
function mapWheel(event){
 if(event.target.closest('#vf-root'))return;
 const vp=event.target.closest('#map-viewport');if(!vp||event.target.closest('select,input'))return;
 event.preventDefault();const c=canvasState();
 if(event.ctrlKey||event.metaKey){const r=vp.getBoundingClientRect();zoomMap(Math.exp(-event.deltaY*.002),{x:event.clientX-r.left,y:event.clientY-r.top});}
 else{c.pan.x=Math.max(-50000,Math.min(50000,c.pan.x-(event.shiftKey?event.deltaY:event.deltaX)));c.pan.y=Math.max(-50000,Math.min(50000,c.pan.y-(event.shiftKey?0:event.deltaY)));paintMap();}
 clearTimeout(canvasUi.liveTimer);canvasUi.liveTimer=setTimeout(save,250);
}
document.addEventListener('pointerdown',mapPointerDown);
document.addEventListener('pointermove',mapPointerMove,{passive:false});
document.addEventListener('pointerup',mapPointerUp);
document.addEventListener('pointercancel',mapPointerCancel);
document.addEventListener('click',mapClickCapture,true);
document.addEventListener('keydown',mapKeyDown);
document.addEventListener('wheel',mapWheel,{passive:false});
document.addEventListener('contextmenu',event=>{const n=event.target.closest('.map-node');if(n){event.preventDefault();dispatch('canvas-card-menu',n.dataset.node);}});
document.addEventListener('dblclick',event=>{const n=event.target.closest('.map-node');if(n&&!event.target.closest('button,.flow-port')){event.preventDefault();startNodeForm('view',n.dataset.node);}});
document.addEventListener('focusin',event=>{const n=event.target.closest('.map-node');if(n&&event.target===n){designUi.selected=n.dataset.node;paintMapSelection();if(n.matches(':focus-visible')&&!flowUi.dragging)revealDesignSelection();}});
window.addEventListener('resize',()=>{if(state.view==='sitemap')paintMap();});
