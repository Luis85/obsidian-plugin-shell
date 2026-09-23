// Handles keep native Vue Flow drag behavior. A stationary click opens a local menu.
function portPointerDown(event,node,side){
 connectionUi.pointer={node,side,x:event.clientX,y:event.clientY,moved:false};connectionUi.committed=false;flowUi.cancelled=false;
 closeConnectionMenu(false);
}
function portClick(event,node,side){
 event.stopPropagation();event.preventDefault();
 const p=connectionUi.pointer;const moved=p&&(p.moved||Math.hypot(event.clientX-p.x,event.clientY-p.y)>=5);
 connectionUi.pointer=null;
 if(moved||connectionUi.committed||flowUi.cancelled||document.getElementById('modal').open)return;
 flowUi.api?.endConnection();flowUi.connecting=false;openConnectionMenu(node,side,event.currentTarget);
}
function portKeyDown(event,node,side){
 if(['Enter',' ','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();openConnectionMenu(node,side,event.currentTarget);}
}
function closeConnectionMenu(restore=true){
 const menu=connectionUi.menu;document.getElementById('connection-menu')?.remove();connectionUi.menu=null;
 if(menu?.anchor?.isConnected){menu.anchor.setAttribute('aria-expanded','false');if(restore)menu.anchor.focus({preventScroll:true});}
}
function openConnectionMenu(node,side,anchor=null){
 if(state.activeRun){notify('Finish the active simulation before extending this outline.');return;}
 const d=design(),n=d.nodes.find(n=>n.id===node);if(!n||n.kind==='group'||!PORTS[side])return;
 closeConnectionMenu(false);designUi.selected=n.id;canvasUi.edge=null;paintMapSelection();
 const incoming=PORTS[side].type==='target';
 anchor=anchor||document.querySelector(`.map-node[data-node="${CSS.escape(node)}"] [data-handleid="${PORTS[side].id}"]`);
 const rect=anchor?.getBoundingClientRect()||{left:innerWidth/2,right:innerWidth/2,top:innerHeight/2,bottom:innerHeight/2};
 connectionUi.menu={node,side,owner:designOwner(),revision:d.revision,anchor};anchor?.setAttribute('aria-expanded','true');
 const menu=document.createElement('div');menu.id='connection-menu';menu.className='connection-quick-menu';
 menu.setAttribute('role','menu');menu.setAttribute('aria-label',(incoming?'Connect into ':'Connect from ')+n.label);
 const item=(action,value,label,detail,disabled=false)=>`<button type="button" role="menuitem" tabindex="-1" data-action="${action}" data-value="${value}" ${disabled?'disabled':''}><span class="connection-menu-icon">${icon(action==='connection-new'?'plus':'link')}</span><span><strong>${label}</strong><small>${detail}</small></span>${icon('arrow')}</button>`;
 menu.innerHTML=`<div class="connection-menu-head" role="presentation"><span>${icon(incoming?'arrow':'link')} ${incoming?'Into':'From'} ${esc(n.label)}</span><small>${SIDE_NAMES[side]} · ${incoming?'incoming':'outgoing'}</small></div>
 ${item('connection-new','page',incoming?'New preceding screen…':'New connected screen…',nearestScreenParent(d,n)?'Inside '+esc(d.nodes.find(x=>x.id===nearestScreenParent(d,n))?.label||'native view'):'Requires a native view',!nearestScreenParent(d,n))}
 ${item('connection-new','view',incoming?'New preceding view…':'New native view…','Independent Obsidian view')}
 ${incoming?'':item('connection-new','modal','New dialog…','Open a transient interaction')}
 <div role="separator" class="connection-menu-divider"></div>
 ${item('connection-existing','',incoming?'Connect from an existing card…':'Connect to an existing card…','Choose endpoints and declare the type')}
 <div class="connection-menu-hint" role="presentation">Click for options · drag to draw<br>Nothing changes until you save.</div>`;
 document.body.appendChild(menu);
 const w=menu.offsetWidth,h=menu.offsetHeight;
 let x=rect.right+12,y=rect.top-30;if(x+w>innerWidth-12)x=rect.left-w-12;
 x=Math.max(12,Math.min(innerWidth-w-12,x));y=Math.max(12,Math.min(innerHeight-h-12,y));
 menu.style.left=x+'px';menu.style.top=y+'px';
 menu.querySelector('[role="menuitem"]:not(:disabled)')?.focus({preventScroll:true});
 menu.addEventListener('keydown',event=>{
  const items=[...menu.querySelectorAll('[role="menuitem"]:not(:disabled)')],i=items.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
   event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(i+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
   items[next]?.focus();
  }else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeConnectionMenu();}
  else if(event.key==='Tab'){closeConnectionMenu();}
 });
}
function existingFromHandle(context){
 const d=design(),origin=d.nodes.find(n=>n.id===context?.node);
 if(!origin||context.owner!==designOwner()||context.revision!==d.revision){notify('The card changed. Open its handle again.');return;}
 const other=d.nodes.find(n=>n.kind!=='group'&&n.id!==origin.id);if(!other){notify('Create another card first.');return;}
 const incoming=PORTS[context.side].type==='target';
 reviewFlowConnection({source:incoming?other.id:origin.id,target:incoming?origin.id:other.id,
  sourceHandle:'out-'+(incoming?OPPOSITE_SIDE[context.side]:context.side),targetHandle:'in-'+(incoming?context.side:OPPOSITE_SIDE[context.side])});
}
function connectionCardAdd(node){
 if(document.getElementById('modal').open)closeModal();
 openConnectionMenu(node,'right');
}
document.addEventListener('pointermove',event=>{const p=connectionUi.pointer;if(p&&Math.hypot(event.clientX-p.x,event.clientY-p.y)>=5)p.moved=true;},{passive:true});
document.addEventListener('pointercancel',()=>{connectionUi.pointer=null;flowUi.cancelled=true;closeConnectionMenu(false);});
document.addEventListener('pointerdown',event=>{if(connectionUi.menu&&!event.target.closest('#connection-menu,.flow-port'))closeConnectionMenu(false);},true);
window.addEventListener('resize',()=>closeConnectionMenu(false));
