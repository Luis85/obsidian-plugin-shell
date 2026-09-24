// Concept-only persistence. Never claim native host storage or distributed locking.
function paintStorageState(){
 const status=document.getElementById('storage-status'),recovery=document.getElementById('storage-recovery');
 const message=storageWarning||(state.settings.remember?'Demo state saved only in this browser':'Memory-only demo session');
 if(status){if(status.textContent!==message)status.textContent=message;status.className=storageWarning?'storage-alert':'';}
 if(recovery)recovery.hidden=!storageWarning;
 document.querySelector('.host-status')?.classList.toggle('storage-warning',!!storageWarning);
}
function saveConceptState(){
 if(storageWarning){paintStorageState();return false;}
 try{
  const retained=localStorage.getItem(STORAGE_KEY);
  if(retained!==persistenceSnapshot){storageWarning='Saved data changed in another window. This session is retained in memory; export recovery before reloading.';paintStorageState();return false;}
  const next=state.settings.remember?JSON.stringify(state):null;
  if(next!==null&&next.length>5000000){storageWarning='This session exceeds the browser-state limit. The last saved copy is preserved; export recovery now.';paintStorageState();return false;}
  // Avoid rewriting identical snapshots during repeated renders and camera events.
  if(next!==retained){if(next===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,next);}
  persistenceSnapshot=next;paintStorageState();return true;
 }catch{storageWarning='Browser storage unavailable. This session is in memory only.';paintStorageState();return false;}
}
function resetConceptState(){
 if(state.activeRun)return;
 try{
  if(localStorage.getItem(STORAGE_KEY)!==persistenceSnapshot){
   storageWarning='Reset blocked: saved data changed in another window. Export this session and the retained browser data before reloading.';
   paintStorageState();notify(storageWarning);return;
  }
  localStorage.removeItem(STORAGE_KEY);if(localStorage.getItem(STORAGE_KEY)!==null)throw Error('Retained storage');
 }
 catch{storageWarning='Reset could not remove browser data. Your current session is retained. Export recovery before closing.';paintStorageState();notify(storageWarning);return;}
 clearTimeout(runTimer);destroyFlow();persistenceSnapshot=null;storageWarning='';state=freshState();closeModal();render();notify('Fresh demo restored. Only this concept’s browser state was reset.');
}
window.addEventListener('storage',event=>{
 if((event.key===STORAGE_KEY||event.key===null)&&!storageWarning){
  try{if(localStorage.getItem(STORAGE_KEY)===persistenceSnapshot)return;}catch{/* save reports the unavailable store */}
  saveConceptState();
 }
});

function exportRetainedBrowserData(){
 try{
  const raw=localStorage.getItem(STORAGE_KEY);
  if(raw===null){notify('No retained browser snapshot is available. Export this session instead.');return;}
  showModal('copy',{title:'Retained browser data — may belong to another window or use an unsupported schema. Keep private; no import or execution is performed.',text:raw,filename:'shell-workbench-retained-browser-data.json'});
 }catch{notify('Browser storage cannot be read. Export this session instead; no retained data was changed.');}
}
