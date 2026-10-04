function handleConnectionAction(action,value){
 if(!action.startsWith('connection-'))return false;
 switch(action){
  case 'connection-card-add':connectionCardAdd(value);break;
  case 'connection-new':{const context=connectionUi.menu?{...connectionUi.menu}:null;closeConnectionMenu();startConnectedCard(value,context);break;}
  case 'connection-existing':{const context=connectionUi.menu?{...connectionUi.menu}:null;closeConnectionMenu();existingFromHandle(context);break;}
  case 'connection-save':commitConnectedCard();break;
  case 'connection-structure':openStructureRelationship(value);break;
  case 'connection-structure-save':saveStructureRelationship();break;
  case 'connection-from-structure':{
   if(askDiscardForm())break;
   const n=design().nodes.find(n=>n.id===value);if(!n?.parent)break;
   const parent=design().nodes.find(x=>x.id===n.parent);if(parent?.kind==='group'){notify('Choose the owning view or a screen as the source; a group is not a user action.');break;}
   const from=n.parent;closeModal();reviewFlowConnection({source:from,target:n.id,sourceHandle:'out-right',targetHandle:'in-left'});break;
  }
  default:return false;
 }
 return true;
}
function editConnectionField(el,commit){
 const key=el.dataset.field;if(!key?.startsWith('connection-'))return false;
 const k=key.slice(11),v=el.type==='checkbox'?el.checked:el.value;if(k==='structure-label'){connectionUi.structure.label=v;return true;}if(k==='structure-source'){connectionUi.structure.sourceHandle=v;return true;}if(k==='structure-target'){connectionUi.structure.targetHandle=v;return true;}
 connectionUi.error='';const error=document.getElementById('connection-error');if(error)error.textContent='';
 if(k==='structure-parent'){if(connectionUi.structure)connectionUi.structure.parent=v||null;return true;}
 const f=connectionUi.form;if(!f)return true;
 f[k]=v;if(k==='slug')f.autoSlug=false;if(k==='actionLabel')f.autoAction=false;
 if(k==='label'){
  if(f.autoSlug){f.slug=allocateSurfaceCode(design(),v);const input=document.getElementById('connection-slug');if(input)input.value=f.slug;}
  if(f.autoAction&&f.direction==='outgoing'){f.actionLabel='Open '+v;const input=document.getElementById('connection-actionLabel');if(input)input.value=f.actionLabel;}
  const summary=document.getElementById('connection-summary');const origin=design().nodes.find(n=>n.id===f.origin);
  if(summary&&origin)summary.innerHTML='<span>'+esc(f.direction==='incoming'?v:origin.label)+'</span>'+icon('arrow')+'<span>'+esc(f.direction==='incoming'?origin.label:v)+'</span>';
 }
 if(commit&&['linkKind','parent','nav'].includes(k))redrawModal();return true;
}
let destructiveReview=null;
function prepareDestructiveReview(type,id){
 if(['design-remove','canvas-edge-remove'].includes(type))destructiveReview={type,id,owner:designOwner(),revision:design().revision};
}
function validDestructiveReview(type,id){
 const r=destructiveReview;
 if(!r||r.type!==type||r.id!==id||r.owner!==designOwner()||r.revision!==design().revision||state.activeRun){notify('This removal review is stale. Reopen it against the current outline. Nothing was removed.');return false;}
 return true;
}
document.addEventListener('keydown',event=>{
 const edge=event.target.closest('.vue-flow__edge');
 if(!edge||event.target.closest('button')||document.getElementById('modal').open||!['Enter',' '].includes(event.key))return;
 const id=edge.getAttribute('data-id');if(!id)return;event.preventDefault();event.stopPropagation();dispatch('canvas-edge',id);
},true);
