// View-local rendering and bounded input lifecycle. No timers survive graph disposal.
function queueSpatialPaint(){
 if(spatialUi.frame)return;
 spatialUi.frame=requestAnimationFrame(()=>{spatialUi.frame=0;if(state.view==='sitemap')paintReferenceChrome();});
}
function paintSpatialLayers(){
 const layer=document.getElementById('ref-section-layer'),vp=document.getElementById('map-viewport');if(!layer||!vp)return;
 const d=design(),c=canvasState(),positions={...c.positions,...spatialPositionMap()};
 const enabled=(c.sections||[]).length||c.layout==='sections';
 layer.innerHTML=enabled?sectionZones(d,positions).map(z=>`<section class="spatial-zone ${spatialUi.drop?.id===z.id?'drop-active':''}" data-section="${esc(z.id)}" aria-label="${esc(z.name)} drop zone" style="left:${z.x*c.zoom+c.pan.x}px;top:${z.y*c.zoom+c.pan.y}px;width:${z.width*c.zoom}px;height:${z.height*c.zoom}px"><div class="spatial-zone-heading" style="top:${12*c.zoom}px;left:${16*c.zoom}px;font-size:${Math.max(9,12*c.zoom)}px;opacity:${c.zoom<.25?0:1}"><strong>${esc(z.name)}</strong><span>${z.count} ${z.count===1?'card':'cards'}</span></div>${!z.count?'<p>Drop a card here<br><small>Visual grouping only</small></p>':''}${spatialUi.drop?.id===z.id?'<div class="spatial-drop-hint">Release to move this card into '+esc(z.name)+'</div>':''}</section>`).join(''):'';
 let headers=document.getElementById('section-controls');if(!headers){headers=document.createElement('div');headers.id='section-controls';vp.append(headers);}
 headers.innerHTML=enabled?sectionZones(d,positions).filter(z=>z.id!=='main').map(z=>`<div class="section-control" style="left:${(z.x+z.width)*c.zoom+c.pan.x-44}px;top:${z.y*c.zoom+c.pan.y+8}px">${referenceTool('Edit '+z.name+' section','ref-section',z.id,'properties')}</div>`).join(''):'';
 let guides=document.getElementById('alignment-guides');if(!guides){guides=document.createElement('div');guides.id='alignment-guides';guides.setAttribute('aria-hidden','true');vp.append(guides);}
 guides.innerHTML=spatialUi.guides.map(g=>`<div class="alignment-guide axis-${g.axis}" style="${g.axis==='x'?'left':'top'}:${g.line*c.zoom+(g.axis==='x'?c.pan.x:c.pan.y)}px"><span>${g.axis==='x'?'Vertical':'Horizontal'} align</span></div>`).join('');
}
function setFlowConnecting(active){
 flowUi.connecting=active;document.getElementById('vf-root')?.setAttribute('data-connecting',String(active));
 if(!active)flowUi.api?.endConnection();paintReferenceChrome();
}
function resetFlowConnection(announce=false){
 const was=flowUi.connecting||!!flowUi.api?.connectionStartHandle?.value;
 flowUi.cancelled=true;edgeEditing.reconnect=null;document.getElementById("vf-root")?.removeAttribute("data-reconnecting");connectionUi.pointer=null;flowUi.api?.endConnection(undefined,true);setFlowConnecting(false);closeConnectionMenu(false);
 if(announce&&was)canvasAnnounce('Connection cancelled. Nothing changed.');
}
function scheduleHandleMeasure(id,serial){
 requestAnimationFrame(()=>{if(serial===flowUi.serial&&flowUi.api)flowUi.api.updateNodeInternals([id]);});
}
function abortSpatialInput(){
 dsCancelDrag(true);
 resetFlowConnection(false);
 if(flowUi.drag){const drag=flowUi.drag;flowUi.cancelled=true;flowUi.drag=null;flowUi.dragging=false;if(drag.owner===designOwner())design().canvas=drag.before;const owner=flowUi.owner,serial=flowUi.serial;queueMicrotask(()=>{if(state.view==='sitemap'&&owner===designOwner()&&serial===flowUi.serial)render();});}
 clearSpatialGesture();
}
window.addEventListener('blur',abortSpatialInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)abortSpatialInput();});
document.addEventListener('pointercancel',abortSpatialInput,true);
document.addEventListener('keydown',event=>{spatialUi.alt=event.altKey;if(event.key==='Escape'&&flowUi.connecting){event.preventDefault();event.stopImmediatePropagation();resetFlowConnection(true);}},true);
document.addEventListener('keyup',event=>{spatialUi.alt=event.altKey;});
// A release outside the canvas must not leave a preview line active.
document.addEventListener('pointerup',()=>{if(!flowUi.connecting)return;const serial=flowUi.serial;setTimeout(()=>{if(serial===flowUi.serial&&flowUi.connecting)resetFlowConnection(false);},0);},true);
