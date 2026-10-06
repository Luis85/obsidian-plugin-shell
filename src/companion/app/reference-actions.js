function handleReferenceAction(action,value){
 if(!action.startsWith('ref-'))return false;
 switch(action){
  case 'ref-content':openReferenceContent(value);break;
  case 'ref-content-save':saveReferenceContent();break;
  case 'ref-inspect':selectSitemapItem('surface',value);referenceUi.panel='inspector';render();break;
  case 'ref-panel-close':referenceUi.panel='none';canvasUi.outline=false;render();break;
  case 'ref-reveal':showMapNode(value,true);fitMap(true);break;
  case 'ref-section':openSectionEditor(value||null);break;
  case 'ref-section-save':saveSectionEditor();break;
  case 'ref-section-remove':saveSectionEditor(true);break;
  case 'ref-section-layout':arrangeMap('sections');break;
  case 'ref-select-mode':canvasPreferences().panOnDrag=false;save();refreshFlowConfig();render();break;
  case 'ref-pan-mode':canvasPreferences().panOnDrag=true;save();refreshFlowConfig();render();break;
  case 'ref-mode':designUi.mode=designUi.mode===value?'map':value;render();break;
  case 'ref-editor-library':referenceUi.editorTab='library';redrawModal();break;
  case 'ref-editor-preview':referenceUi.editorTab='content';redrawModal();break;
  case 'ref-block-focus':referenceFocusBlock(value);break;
  case 'ref-block-add':addReferenceBlock(value);break;
  case 'ref-block-up':moveReferenceBlock(value,-1);break;
  case 'ref-block-down':moveReferenceBlock(value,1);break;
  case 'ref-block-remove':removeReferenceBlock(value);break;
  case 'ref-block-restore':restoreReferenceBlock();break;
  case 'ref-draft-export':exportReferenceDraft();break;
  case 'ref-format':formatReferenceText(value);break;
  default:return false;
 }
 return true;
}
function editReferenceField(el){
 const field=el.dataset.field;
 if(!field?.startsWith('ref-'))return false;
 if(field==='ref-search'){
  canvasUi.search=el.value;
  const old=document.activeElement,start=old.selectionStart;
  const panel=document.querySelector('.outline-tree.ref-panel');
  if(panel){panel.innerHTML=referenceStructure(design());const search=panel.querySelector('#map-search');search.focus();try{search.setSelectionRange(start,start);}catch{}}
  syncFlowSelection();document.querySelectorAll('.map-node').forEach(e=>e.classList.toggle('search-dim',!mapMatch(design().nodes.find(n=>n.id===e.dataset.node))));return true;
 }
 if(field==='ref-section-name')referenceUi.sectionForm.name=el.value;
 else if(field==='ref-section-root'){const f=referenceUi.sectionForm;f.roots=el.checked?[...new Set([...f.roots,el.dataset.id])]:f.roots.filter(id=>id!==el.dataset.id);}
 else if(field==='ref-library-search'){
  referenceUi.libraryQuery=el.value;
  document.getElementById('ref-library-list').innerHTML=referenceLibraryItems(el.value.toLowerCase());
 }else if(field.startsWith('ref-block-')){
  const b=referenceDraftBlock(el.dataset.block),key=field.slice(10);
  if(b&&['title','purpose','content','region'].includes(key)){
   b[key]=el.value;referenceUi.content.selected=b.id;referenceUi.contentError='';refreshReferenceContent();
  }
 }
 return true;
}
document.addEventListener('dragstart',event=>{
 const grip=event.target.closest('[data-ref-drag]');if(!grip)return;
 referenceUi.drag={id:grip.dataset.refDrag,owner:referenceUi.content?.owner};
 event.dataTransfer.setData('text/plain',grip.dataset.refDrag);event.dataTransfer.effectAllowed='move';event.stopPropagation();
});
document.addEventListener('dragover',event=>{
 if(!referenceUi.drag)return;
 const block=event.target.closest('.ref-write-block');if(!block)return;
 event.preventDefault();event.dataTransfer.dropEffect='move';const after=event.clientY>block.getBoundingClientRect().top+block.offsetHeight/2;
 document.querySelectorAll('.ref-drag-before,.ref-drag-after').forEach(e=>e.classList.remove('ref-drag-before','ref-drag-after'));
 block.classList.add(after?'ref-drag-after':'ref-drag-before');
});
document.addEventListener('dragleave',event=>event.target.closest('.ref-write-block')?.classList.remove('ref-drag-before','ref-drag-after'));
document.addEventListener('drop',event=>{
 const drag=referenceUi.drag,block=event.target.closest('.ref-write-block');if(!drag||!block)return;
 event.preventDefault();event.stopPropagation();
 if(referenceUi.content?.owner===drag.owner)moveReferenceBlock(drag.id,0,block.dataset.block,event.clientY>block.getBoundingClientRect().top+block.offsetHeight/2);
 referenceUi.drag=null;document.querySelectorAll('.ref-drag-before,.ref-drag-after').forEach(e=>e.classList.remove('ref-drag-before','ref-drag-after'));
});
document.addEventListener('dragend',()=>{referenceUi.drag=null;document.querySelectorAll('.ref-drag-before,.ref-drag-after').forEach(e=>e.classList.remove('ref-drag-before','ref-drag-after'));});
document.addEventListener('keydown',event=>{
 if(modalType==='ref-content'&&document.getElementById('modal').open&&!document.getElementById('discard-dialog')?.open&&(event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();saveReferenceContent();}
});

// Dismiss canvas popovers without also cancelling a graph gesture or selection.
document.addEventListener('pointerdown',event=>{
 for(const popover of document.querySelectorAll('.ref-arrange-popover[open],.map-pan-controls[open]')){
  if(!popover.contains(event.target))popover.open=false;
 }
},true);
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||document.getElementById('modal').open)return;
 const popover=document.querySelector('.ref-arrange-popover[open],.map-pan-controls[open]');
 if(popover){event.preventDefault();event.stopImmediatePropagation();popover.open=false;popover.querySelector('summary')?.focus();}
},true);
