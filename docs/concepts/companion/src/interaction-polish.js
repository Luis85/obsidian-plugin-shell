// Shared form and focus safeguards. No production persistence or runtime adapters.
let modalOriginal=null;
const TRACKED_FORMS=new Set(['data-source-form','semantic-form','component-variant','vault-identity','design-transfer','edge-detach','ref-content','ref-section','library-place','library-upgrade','brick-edit','brick-transfer','connection-create','connection-structure','flow-intent','flow-binding','design-node','design-connect','design-goal','product-prd','product-requirement','product-component','product-bind']);
function formCheckpoint(){
 if(modalType==='ref-content')return JSON.stringify(referenceUi.content?.bricks||[]);
 if(modalType==='semantic-form'||modalType==='data-source-form')return editorDraftCheckpoint(inlineRemovalForm());
 return JSON.stringify([...document.querySelectorAll('#modal input,#modal textarea,#modal select')].map((e,i)=>[e.dataset.field||e.id||String(i),e.type==='checkbox'?e.checked:e.value]));
}
function rememberModalForm(){modalOriginal=TRACKED_FORMS.has(modalType)?formCheckpoint():null;}
function askDiscardForm(){
 if(restoreInlineRemoval())return true;
 if(!modalOriginal||!TRACKED_FORMS.has(modalType)||formCheckpoint()===modalOriginal)return false;
 let dialog=document.getElementById('discard-dialog');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='discard-dialog';dialog.setAttribute('aria-labelledby','discard-title');document.body.appendChild(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();dialog.close();});}
 dialog.innerHTML='<h2 id="discard-title">Keep your edits?</h2><p>You have unsaved changes in this form. Keep editing, or discard only these changes. Saved project data remains untouched.</p><div class="row"><button class="btn" id="discard-confirm">Discard changes</button><button class="btn primary" id="discard-keep">Keep editing</button></div>';
 const prior=document.activeElement;
 dialog.querySelector('#discard-keep').onclick=()=>{dialog.close();if(prior?.isConnected)prior.focus();};
 dialog.querySelector('#discard-confirm').onclick=()=>{dialog.close();modalOriginal=null;closeModal();};
 dialog.showModal();dialog.querySelector('#discard-keep').focus();return true;
}
function captureUiFocus(){
 const e=document.activeElement;if(!e||e===document.body||e.closest('dialog'))return null;
 return {id:e.id,action:e.dataset.action,value:e.dataset.value,field:e.dataset.field,node:e.dataset.node,selectionStart:typeof e.selectionStart==='number'?e.selectionStart:null,selectionEnd:typeof e.selectionEnd==='number'?e.selectionEnd:null};
}
function restoreUiFocus(t){
 if(!t||document.getElementById('modal').open||!sitemapFocusStillCurrent(t))return;
 let e=t.id?document.getElementById(t.id):null;
 if(!e&&t.node)e=document.querySelector(`.map-node[data-node="${CSS.escape(t.node)}"]`);
 if(!e&&t.field)e=[...document.querySelectorAll('[data-field]')].find(x=>x.dataset.field===t.field);
 if(!e&&t.action)e=[...document.querySelectorAll('[data-action]')].find(x=>x.dataset.action===t.action&&x.dataset.value===t.value);
 if(e&&e.isConnected&&!e.disabled){e.focus({preventScroll:true});if(t.selectionStart!==null&&typeof e.setSelectionRange==='function')try{e.setSelectionRange(t.selectionStart,t.selectionEnd);}catch{}}
}
function prdRequirements(p){
 const query=productUi.requirementSearch||'';
 return `<div class="requirement-search"><label for="requirement-search">Find a requirement</label><input id="requirement-search" type="search" data-field="polish-requirement-search" value="${esc(query)}" placeholder="Title, ID, priority or state…"><span id="requirement-count" class="tiny muted">${filteredRequirements(p).length} / ${p.requirements.length}</span></div><div id="requirement-results">${requirementsResults(p)}</div>`;
}
function filteredRequirements(p){const q=(productUi.requirementSearch||'').trim().toLowerCase();return p.requirements.filter(r=>(r.id+' '+r.title+' '+r.priority+' '+r.status+' '+r.acceptance).toLowerCase().includes(q));}
function requirementsResults(p){const list=filteredRequirements(p);if(!list.length&&p.requirements.length)return '<div class="card"><h3>No matching requirements</h3><p>Clear the search or try a requirement ID. Your requirements have not been removed.</p></div>';return prdRequirementsBody({...p,requirements:list});}
function editPolishField(el){if(el.dataset.field!=='polish-requirement-search')return false;productUi.requirementSearch=el.value;document.getElementById('requirement-results').innerHTML=requirementsResults(selectedPrd());document.getElementById('requirement-count').textContent=filteredRequirements(selectedPrd()).length+' / '+selectedPrd().requirements.length;return true;}
document.addEventListener('click',event=>{if(event.target.closest('[data-action="close"]')&&askDiscardForm()){event.preventDefault();event.stopImmediatePropagation();}},true);
document.getElementById('modal').addEventListener('cancel',event=>{if(askDiscardForm()){event.preventDefault();event.stopImmediatePropagation();}},true);

// A browser refresh must not silently discard a still-open editing draft.
window.addEventListener('beforeunload',event=>{
 if(document.getElementById('modal').open&&modalOriginal&&TRACKED_FORMS.has(modalType)&&formCheckpoint()!==modalOriginal){
  event.preventDefault();event.returnValue='';
 }
});
