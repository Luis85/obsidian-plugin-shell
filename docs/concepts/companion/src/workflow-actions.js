// Navigation between established capabilities. This module never generates files.
function handleWorkflowAction(action,value){
 if(action==='outline-start'){const hadDraft=Boolean(state.designDraft);state.activeId=null;designUi.plan=null;designUi.selected=null;closeModal();setView(hadDraft?'sitemap':'prds');return true;}
 if(!action.startsWith('workflow-'))return false;
 switch(action){
  case 'workflow-stage':{
   if(value==='review'){if(state.activeRun){notify('Finish or cancel the active simulation before reviewing a new plan.');break;}closeModal();workflowUi.fileQuery='';workflowUi.fileStatus='all';reviewDesignPlan();break;}
   if(value==='build'){closeModal();if(project())setView('develop');else handleDesignAction('design-create','');break;}
   const step=WORKFLOW_STAGES.find(s=>s.id===value);if(step){closeModal();setView(step.view);}break;
  }
  case 'workflow-component-tab':workflowUi.componentTab=value;render();break;
  case 'workflow-continue-setup':closeModal();handleDesignAction('design-create','');break;
  case 'workflow-context':showModal('workflow-context');break;
  case 'workflow-checks':closeModal();designUi.mode='issues';setView('sitemap');break;
  case 'workflow-node':closeModal();setView('sitemap');designUi.mode='map';showMapNode(value,true);break;
  case 'workflow-file-clear':workflowUi.fileQuery='';workflowUi.fileStatus='all';redrawModal();break;
  case 'workflow-search-clear':canvasUi.search='';workflowUi.lastQuery='';workflowUi.matchIndex=0;render();document.getElementById('map-search')?.focus();break;
  case 'workflow-search-next':{
   const found=design().nodes.filter(mapMatch);if(!found.length)return true;
   const at=found.findIndex(n=>n.id===selectedNode()?.id);const next=found[(at+1)%found.length];showMapNode(next.id,true);workflowUi.matchIndex=found.indexOf(next);workflowMapSearchFeedback();break;
  }
  case 'workflow-rename':startNodeForm('view',selectedNode()?.id);document.getElementById('d-node-label')?.focus();document.getElementById('d-node-label')?.select();break;
  default:return false;
 }
 save();return true;
}
function editWorkflowField(el){
 const key=el.dataset.field;
 if(key!=='workflow-file-query'&&key!=='workflow-file-status')return false;
 workflowUi[key==='workflow-file-query'?'fileQuery':'fileStatus']=el.value;
 const nav=document.querySelector('.plan-files .file-nav');if(nav)nav.innerHTML=planFilePicker();
 const count=document.getElementById('plan-filter-count');if(count)count.textContent=filteredPlanFiles().length+' / '+designUi.plan.changes.length+' files';
 return true;
}
function workflowMapSearchFeedback(){
 const el=document.getElementById('map-search-feedback');if(!el)return;
 const q=canvasUi.search.trim(),matches=design().nodes.filter(mapMatch);
 el.hidden=!q;
 el.innerHTML=q?`<span role="status">${matches.length?matches.length+' matching surface'+(matches.length===1?'':'s'):'No matching surfaces'}</span>${matches.length?button('Next match','workflow-search-next','','ghost small','arrow'):''}${button('Clear','workflow-search-clear','','ghost small')}`:'';
}
// Field-specific errors stay next to the form, and first errors are announced/focused.
function workflowModalPolish(){
 const modal=document.getElementById('modal');
 modal.dataset.kind=modalType;
 const title=modal.querySelector('h2');if(title&&!title.id){title.id='active-dialog-title';modal.setAttribute('aria-labelledby',title.id);}
 if(modalType==='wizard'){
  const w=state.wizard,body=modal.querySelector('.wizard-body');
  if(w?.design&&body&&!body.querySelector('.wizard-outline-summary'))body.insertAdjacentHTML('afterbegin',`<div class="wizard-outline-summary">${icon('layers')}<span>Your outline is included: <strong>${w.design.nodes.length} surfaces</strong> · ${w.design.prds?.length||0} PRD(s)</span></div>`);
 }
}

// Search shortcuts operate only in the canvas search field, never in document editors.
document.addEventListener('keydown',event=>{
 if(event.target.id==='map-search'&&event.key==='Enter'){event.preventDefault();handleWorkflowAction('workflow-search-next','');}
 if(event.target.id==='map-search'&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();handleWorkflowAction('workflow-search-clear','');}
});
