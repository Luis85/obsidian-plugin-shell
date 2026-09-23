function handleCanvasAction(action,value){
 if(!action.startsWith('canvas-'))return false;
 const d=design(),c=canvasState(d),n=selectedNode();
 switch(action){
  case 'canvas-select':
   if(flowUi.dragging||flowUi.suppressClick)return true;
   if(canvasUi.connecting){const target=d.nodes.find(x=>x.id===value);if(!target||target.kind==='group'){notify('Connect to a surface or action, not an organizing group.');break;}designUi.form={from:canvasUi.connecting,to:value,label:'Open '+target.label,owner:designOwner(),baseRevision:d.revision};canvasUi.connecting=null;designUi.error='';showModal('design-connect');}
   else {designUi.selected=value;canvasUi.edge=null;paintMapSelection();focusMapNode(value);canvasAnnounce('Selected '+selectedNode()?.label+'. Use Edit to change the surface.');}break;
  case 'canvas-child':designUi.selected=value;canvasUi.edge=null;paintMapSelection();startNodeForm('page');break;
  case 'canvas-connect-from':canvasUi.connecting=value;canvasUi.placing=null;designUi.selected=value;canvasUi.inspector='links';render();canvasAnnounce('Choose a destination card or press Escape to cancel.');break;
  case 'canvas-cancel-mode':cancelFlowGesture();canvasUi.connecting=null;canvasUi.placing=null;render();break;
  case 'canvas-outline':referencePaneMode('structure');break;
  case 'canvas-expand':canvasUi.expanded=!canvasUi.expanded;render();fitMap();break;
  case 'canvas-inspector':referenceUi.panel='inspector';canvasUi.inspector=value;render();break;
  case 'canvas-arrange':arrangeMap(c.layout);break;
  case 'canvas-collapse':toggleMapBranch(value);break;
  case 'canvas-expand-all':canvasCommit(v=>v.collapsed=[],'All branches expanded.');break;
  case 'canvas-zoom-in':zoomMap(1.2);break;
  case 'canvas-zoom-out':zoomMap(1/1.2);break;
  case 'canvas-reset-zoom':zoomMap(1/c.zoom);break;
  case 'canvas-fit':fitMap();break;
  case 'canvas-focus':if(n)fitMap(true);break;
  case 'canvas-pan':{const [dx,dy]=value.split(',').map(Number);c.pan.x=Math.max(-50000,Math.min(50000,c.pan.x+dx));c.pan.y=Math.max(-50000,Math.min(50000,c.pan.y+dy));paintMap();save();canvasAnnounce('Canvas panned. Surface positions are unchanged.');break;}
  case 'canvas-nudge':if(n){const [dx,dy]=value.split(',').map(Number);moveMapNode(n.id,dx,dy);}break;
  case 'canvas-position':{
   const rawX=document.getElementById('map-position-x')?.value,rawY=document.getElementById('map-position-y')?.value;
   if(!rawX?.trim()||!rawY?.trim()){notify('Enter both X and Y coordinates before applying.');break;}
   const x=Number(rawX),y=Number(rawY);
   if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>50000||Math.abs(y)>50000){notify('Use finite coordinates between −50,000 and 50,000.');break;}
   const before=c.positions[value];if(before)moveMapNode(value,x-before.x,y-before.y);break;
  }
  case 'canvas-place':canvasUi.placing=value;canvasUi.connecting=null;render();{const box=document.getElementById('map-mode-message');box.hidden=false;box.firstChild.textContent='Click empty canvas to place the selected card. ';}break;
  case 'canvas-edge':{if(value.startsWith('contains-')){openStructureRelationship(value.slice(9));break;}const edge=d.links.find(e=>e.id===value);if(!edge)break;designUi.selected=edge.from;canvasUi.edge=value;canvasUi.inspector='links';paintMapSelection();openTypedConnection(edge);break;}
  case 'canvas-edit-edge':{const edge=d.links.find(e=>e.id===value);if(edge)openTypedConnection(edge);break;}
  case 'canvas-remove-edge':showModal('canvas-edge-remove',value);break;
  case 'canvas-remove-edge-confirm':if(!validDestructiveReview('canvas-edge-remove',value))break;closeModal();dispatch('design-unlink',value);canvasUi.edge=null;break;
  case 'canvas-card-menu':designUi.selected=value;showModal('canvas-card-menu',value);break;
  case 'canvas-menu-edit':closeModal();startNodeForm('view',value);break;
  case 'canvas-menu-child':closeModal();designUi.selected=value;canvasUi.edge=null;paintMapSelection();startNodeForm('page');break;
  case 'canvas-menu-remove':showModal('design-remove',value);break;
  case 'canvas-menu-duplicate':closeModal();dispatch('design-duplicate',value);break;
  case 'canvas-menu-entry':closeModal();dispatch('design-entry',value);break;
  case 'canvas-help':showModal('canvas-help');break;
  default:return false;
 }
 return true;
}
function editCanvasField(el){
 const key=el.dataset.field;if(!key?.startsWith('canvas-'))return false;
 const c=canvasState();
 if(key==='canvas-layout'){arrangeMap(el.value);document.getElementById('map-layout')?.focus();}
 if(key==='canvas-snap'){c.snap=el.checked;save();refreshFlowConfig();canvasAnnounce(c.snap?'Snap to 24-unit grid enabled.':'Free movement enabled.');}
 if(key==='canvas-edges'){c.edges=el.value;save();render();document.getElementById('map-edges')?.focus();}
 if(key==='canvas-search'){
  canvasUi.search=el.value;
  document.querySelectorAll('.map-node').forEach(card=>{const n=design().nodes.find(n=>n.id===card.dataset.node);card.classList.toggle('search-dim',!mapMatch(n));});
  const matches=design().nodes.filter(mapMatch),count=document.getElementById('map-count');
  count.textContent=canvasUi.search?`${matches.length} match${matches.length===1?'':'es'} · Enter to focus`:`${visibleMapNodes().length}/${design().nodes.length} visible`;
 }
 workflowMapSearchFeedback();return true;
}
function canvasEdgeRemoveDialog(){const e=design().links.find(e=>e.id===modalData);return dialogBody('Remove this connection?',`<p>${esc(e?.label||'Connection no longer exists')}</p><p>Only this navigation action is removed. Both surfaces, their requirements and any existing source remain. Undo restores the connection.</p>`,button('Cancel','close','','ghost')+button('Remove connection','canvas-remove-edge-confirm',modalData,'danger'));}
