function handleLibraryAction(action,value){
 if(!action.startsWith('library-'))return false;
 const d=design();
 if(state.activeRun&&!['library-filter','library-manage','library-open'].includes(action)){notify('Finish the active simulation before editing components.');return true;}
 switch(action){
  case 'library-filter':libraryUi.filter=value;render();break;
  case 'library-deprecated':libraryUi.includeDeprecated=!libraryUi.includeDeprecated;render();break;
  case 'library-new-brick':beginProductForm('product-component',newBrickDefinition());break;
  case 'library-place':{
   const c=d.library.find(c=>c.id===value),n=selectedNode();
   if(!c||!isBrickComponent(c))break;
   const node=canHaveBricks(n)?n:d.nodes.find(canHaveBricks);
   if(!node){notify('Add a visual surface before placing a component.');break;}
   libraryUi.form={component:value,node:node.id,owner:designOwner(),revision:d.revision};
   showModal('library-place');break;
  }
  case 'library-place-confirm':{
   const f=libraryUi.form;if(!brickContext(f)){notify('The design changed. Reopen the placement.');break;}
   closeModal();beginLibraryBrick(f.node,f.component);break;
  }
  case 'library-pick':{const [node,id]=value.split(':');beginLibraryBrick(node,id);break;}
  case 'library-open':productUi.component=value;libraryUi.filter='all';productUi.filter='';closeModal();setView('components');break;
  case 'library-manage':libraryUi.returnNode=value||designUi.selected;libraryUi.filter='all';productUi.filter='';closeModal();setView('components');break;
  case 'library-return':designUi.selected=libraryUi.returnNode||designUi.selected;setView('sitemap');revealDesignSelection();break;
  case 'library-upgrade':beginBrickUpgrade(value);break;
  case 'library-upgrade-save':applyBrickUpgrade();break;
  case 'library-card-add':libraryUi.returnNode=value;showModal('library-card-add',value);break;
  case 'library-instance':{const {n,b}=findBrick(value);if(b){designUi.selected=n.id;brickUi.selected=b.id;brickUi.node=n.id;setView('sitemap');beginBrick(n.id,b.kind,b.id);}break;}
  case 'library-contracts':closeModal();dispatch('flow-components',value);break;
  case 'library-card-components':designUi.selected=value;canvasUi.inspector='bricks';render();break;
  default:return false;
 }
 return true;
}
function editLibraryField(el,commit){
 const k=el.dataset.field;
 if(k==='library-place-node'){libraryUi.form.node=el.value;return true;}
 if(!k?.startsWith('library-spec-'))return false;
 const f=productUi.form,key=k.slice(13);if(!isBrickComponent(f))return true;
 if(['title','kind','purpose','content','region'].includes(key))f.contentSpec[key]=el.value;
 if(key==='kind'&&commit)redrawModal();
 productUi.error='';return true;
}
// Keyboard sorting uses the same command and history as pointer sorting, never Vue Flow node movement.
document.addEventListener('keydown',event=>{
 const grip=event.target.closest('[data-brick-drag]');
 if(!grip||!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
 event.preventDefault();event.stopImmediatePropagation();const value=grip.dataset.brickDrag;
 nudgeBrick(value,event.key==='ArrowUp'?-1:1);
 requestAnimationFrame(()=>document.querySelector('[data-brick-drag="'+CSS.escape(value)+'"]')?.focus({preventScroll:true}));
},true);
