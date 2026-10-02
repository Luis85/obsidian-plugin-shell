function handleBrickAction(action,value){
 if(!action.startsWith('brick-'))return false;
 if(state.activeRun&&!['brick-method','brick-entry','brick-display','brick-panel'].includes(action)){notify('Finish the active simulation before editing content.');return true;}
 switch(action){
 case 'brick-panel':designUi.selected=value;canvasUi.inspector='bricks';render();break;
 case 'brick-method':showModal('brick-method');break;
 case 'brick-entry':{closeModal();const n=design().nodes.find(n=>n.entry);if(!n){notify('Set a primary entry first.');break;}designUi.selected=n.id;canvasUi.inspector='bricks';render();fitMap(true);break;}
 case 'brick-display':if(['structure','labels','wireframes'].includes(value)){canvasState().brickDisplay=value;canvasState().fitted=false;save();render();}break;
 case 'brick-add':brickUi.node=value;brickUi.query='';brickUi.error='';showModal('brick-palette');break;
 case 'brick-kind':{const [id,kind]=value.split(':');beginBrick(id,kind);break;}
 case 'brick-edit':{const {n,b}=findBrick(value);if(b)beginBrick(n.id,b.kind,b.id);break;}
 case 'brick-save':saveBrick();break;
 case 'brick-up':nudgeBrick(value,-1);break;
 case 'brick-down':nudgeBrick(value,1);break;
 case 'brick-duplicate':duplicateBrick(value);break;
 case 'brick-transfer':beginBrickTransfer(value);break;
 case 'brick-transfer-save':saveBrickTransfer();break;
 case 'brick-delete':{const {n,b}=findBrick(value);if(!b)break;brickUi.move={source:n.id,id:b.id,owner:designOwner(),revision:design().revision};brickUi.error='';showModal('brick-remove');break;}
 case 'brick-delete-confirm':{const f=brickUi.move,{n,b}=findBrick(f.source+':'+f.id);if(!b||!brickContext(f)){failBrick('This removal is stale. Reopen it from the current outline.');break;}recordDesign();n.bricks=n.bricks.filter(x=>x.id!==b.id);designChanged();brickUi.selected=null;closeModal();render();break;}
 case 'brick-starter':{const n=design().nodes.find(n=>n.id===value);if(!canHaveBricks(n))break;brickUi.node=n.id;brickUi.form={owner:designOwner(),revision:design().revision,node:n.id};showModal('brick-starter');break;}
 case 'brick-starter-confirm':{
  const f=brickUi.form,d=design(),n=d.nodes.find(n=>n.id===f?.node);if(!n||!brickContext(f)){failBrick('Reopen the starter stack against the current outline.');break;}
  if(bricksOf(n).length>21||d.nodes.reduce((s,n)=>s+bricksOf(n).length,0)>397){failBrick('There is not enough room for three more content bricks.');break;}
  const missing=starterKinds(n).find(kind=>!brickDefinition(d,kind));if(missing){failBrick('The '+BRICK_KINDS[missing].label+' definition is missing or deprecated. Restore it in the component library, or add individual components.');break;}
  recordDesign();n.bricks=[...bricksOf(n),...starterKinds(n).map(kind=>blankBrick(d,n,kind))];designChanged();designUi.selected=n.id;canvasUi.inspector='bricks';closeModal();render();fitMap(true);break;
 }
 default:return false;
 }return true;
}
function starterKinds(n){return ['form','wizard'].includes(n.layout)?['heading','form','actions']:n.layout==='inspector'?['heading','detail','actions']:['heading','toolbar',n.layout==='board'?'board':n.layout==='dashboard'?'chart':'list'];}
function brickStarterDialog(){const n=design().nodes.find(n=>n.id===brickUi.node);return dialogBody('Add a starter content stack',`<p>Append these three planning blocks to <strong>${esc(n?.label||'the screen')}</strong>. Existing content and component placements are unchanged.</p><div class="brick-starter-preview">${n?starterKinds(n).map(k=>`<div data-group="${BRICK_KINDS[k].group}"><strong>${BRICK_KINDS[k].label}</strong>${brickSketch(k)}</div>`).join(''):''}</div><p class="small muted">Adds three versioned instances from the library. No business logic or implementation binding is inferred.</p><p class="error" role="alert">${esc(brickUi.error)}</p>`,button('Cancel','close','','ghost')+button('Append three bricks','brick-starter-confirm','','primary'));}
function editBrickField(el,commit){
 const k=el.dataset.field;if(!k?.startsWith('brick-'))return false;const v=el.type==='checkbox'?el.checked:el.value;
 brickUi.error='';const error=document.getElementById('brick-error');if(error)error.textContent='';
 if(k==='brick-search'){brickUi.query=v;const n=design().nodes.find(n=>n.id===brickUi.node);if(n)document.getElementById('brick-palette-results').innerHTML=brickPalette(n);return true;}
 if(k==='brick-target'){brickUi.move.target=v;const target=design().nodes.find(n=>n.id===v);if(!target)return true;brickUi.move.region=componentSlots(target)[0];if(commit)redrawModal();return true;}
 if(k==='brick-move-region'){brickUi.move.region=v;return true;}
 if(k==='brick-copy'){brickUi.move.copy=v;return true;}
 if(brickUi.form&&['kind','title','purpose','content','region','component'].includes(k.slice(6))){brickUi.form[k.slice(6)]=v;if(k==='brick-kind'&&commit)redrawModal();}
 return true;
}
// Only grips initiate content dragging; node movement and connection handles stay Vue Flow's job.
document.addEventListener('dragstart',event=>{
 const grip=event.target.closest('[data-brick-drag]'),palette=event.target.closest('[data-brick-kind]');if(!grip&&!palette)return;
 event.stopPropagation();brickUi.drag={owner:designOwner(),revision:design().revision,value:grip?.dataset.brickDrag,kind:palette?.dataset.brickKind,definition:palette?.dataset.brickDefinition};
 event.dataTransfer.setData('application/x-companion-brick','local-content');event.dataTransfer.effectAllowed=grip?'move':'copy';
},true);
document.addEventListener('dragover',event=>{
 if(!event.dataTransfer.types.includes('application/x-companion-brick')||!brickUi.drag)return;
 const tile=event.target.closest('[data-brick-id]'),card=event.target.closest('.map-node');if(!card)return;
 event.preventDefault();event.stopPropagation();clearBrickDrop();
 if(tile&&(!brickUi.drag.value||brickUi.drag.value.split(':')[0]===card.dataset.node))tile.classList.add(event.clientY>tile.getBoundingClientRect().top+tile.getBoundingClientRect().height/2?'brick-drop-after':'brick-drop-before');else card.classList.add('brick-drop-card');
},true);
document.addEventListener('drop',event=>{
 if(!event.dataTransfer.types.includes('application/x-companion-brick'))return;
 event.preventDefault();event.stopPropagation();const drag=brickUi.drag;brickUi.drag=null;clearBrickDrop();
 if(!brickContext(drag)){notify('The content drag is stale or was cancelled. Nothing changed.');return;}
 const card=event.target.closest('.map-node'),tile=event.target.closest('[data-brick-id]');if(!card)return;if(!canHaveBricks(design().nodes.find(n=>n.id===card.dataset.node))){notify('Choose a visual surface for this content.');return;}
 if(drag.kind){if(drag.definition)beginLibraryBrick(card.dataset.node,drag.definition);else beginBrick(card.dataset.node,drag.kind);return;}
 const [node,id]=drag.value.split(':');
 if(node===card.dataset.node){reorderBrick(node,id,brickDropBefore(tile,event.clientY,node),drag);return;}
 beginBrickTransfer(drag.value,card.dataset.node);
},true);
function clearBrickDrop(){document.querySelectorAll('.brick-drop-before,.brick-drop-after,.brick-drop-card').forEach(e=>e.classList.remove('brick-drop-before','brick-drop-after','brick-drop-card'));}
document.addEventListener('dragend',()=>{brickUi.drag=null;clearBrickDrop();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&brickUi.drag){brickUi.drag=null;clearBrickDrop();canvasAnnounce('Content drag cancelled.');}},true);

function beginBrickTransfer(value,targetId=null){
 const {n,b}=findBrick(value);if(!b)return;const target=design().nodes.find(t=>canHaveBricks(t)&&t.id!==n.id&&(!targetId||t.id===targetId));
 if(!target){notify('Add another visual surface first.');return;}
 brickUi.move={source:n.id,id:b.id,target:target.id,region:componentSlots(target).includes(b.region)?b.region:componentSlots(target)[0],copy:false,owner:designOwner(),revision:design().revision};
 brickUi.error='';showModal('brick-transfer');
}

function brickDropBefore(tile,y,node){
 if(!tile)return null;
 const rect=tile.getBoundingClientRect(),list=bricksOf(design().nodes.find(n=>n.id===node)),index=list.findIndex(b=>b.id===tile.dataset.brickId);
 return y>rect.top+rect.height/2?list[index+1]?.id||null:tile.dataset.brickId;
}
