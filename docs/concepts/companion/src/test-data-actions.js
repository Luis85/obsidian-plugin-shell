const tdUi={source:null,form:null,error:'',preview:null,file:0,session:null,sessionKey:null,operation:null,input:'',output:'',busy:false,abort:null,target:null};
function tdFail(message){tdUi.error=message;if(document.getElementById('modal').open&&modalType==='test-data-form'){redrawModal();document.getElementById('td-error')?.focus();}else {render();document.getElementById('td-page-error')?.focus();}return false;}
function tdDropSession(){tdUi.abort?.abort();tdUi.abort=null;tdUi.session?.dispose();tdUi.session=null;tdUi.sessionKey=null;tdUi.busy=false;tdUi.output='';}
function tdCommit(candidate){
 if(state.activeRun)return tdFail('Finish the active project simulation first.');
 if(!tdValidSettings(candidate,dataSources()))return tdFail('Check the seed, date, record count and generator settings.');
 if(JSON.stringify(candidate)===JSON.stringify(tdSettings()))return true;
 recordDesign();dataSources().testing=designCopy(candidate);designChanged();tdUi.preview=null;tdDropSession();return true;
}
function tdOpen(operation=null){
 if(!project()){openVaultIdentity('testdata');return;}
 if(state.activeRun){notify('Finish the active simulation first.');return;}
 let record=designCopy(tdSettings()),source=null,op=null;
 if(operation){source=dataSources().sources.find(s=>s.operations.some(o=>o.id===operation));op=source?.operations.find(o=>o.id===operation);if(!op)return tdFail('That operation no longer exists.');record=designCopy(tdRecipe(source,op));}
 tdUi.form={kind:operation?'recipe':'settings',record,snapshot:tdFingerprint(),owner:designOwner(),source:source?.id,operation:op?.id};tdUi.error='';showModal('test-data-form');
}
function tdSave(){
 const f=tdUi.form;
 if(!f||f.owner!==designOwner()||f.snapshot!==tdFingerprint())return tdFail('The source contracts changed during editing. Keep your draft, then reopen a fresh recipe.');
 let settings=f.kind==='settings'?designCopy(f.record):designCopy(tdSettings());
 if(f.kind==='recipe'){const i=settings.recipes.findIndex(r=>r.operation===f.operation);if(i<0)settings.recipes.push(designCopy(f.record));else settings.recipes[i]=designCopy(f.record);}
 if(!tdCommit(settings))return false;
 modalOriginal=null;closeModal();tdUi.error='';render();notify('Test recipe saved. No data or files were generated.');return true;
}
function tdBuildPreview(){
 try{
  const manifest=tdManifest();if(!manifest.operations.length)throw Error('Enable at least one source operation recipe.');
  const generated=createFixtureEngine().generate(manifest),session=createFixtureAdapter(manifest);session.dispose();
  const fingerprint=tdFingerprint();tdUi.preview={manifest,generated,fingerprint};tdUi.file=0;tdUi.error='';return tdUi.preview;
 }catch(error){tdUi.preview=null;tdFail(error.message);return null;}
}
async function tdSimulate(){
 if(tdUi.busy)return;
 let controller=null,key=null,session=null;
 try{
  key=tdFingerprint();if(!tdUi.session||tdUi.sessionKey!==key){tdDropSession();tdUi.session=createFixtureAdapter(tdManifest());tdUi.sessionKey=key;}
  session=tdUi.session;const op=tdManifest().operations.find(o=>o.id===tdUi.operation);if(!op)throw Error('Select an enabled API or database operation.');
  let input;try{input=op.input.none?undefined:JSON.parse(tdUi.input);}catch{throw Error('Enter valid JSON request data.');}
  tdUi.busy=true;controller=new AbortController();tdUi.abort=controller;tdUi.output='Running in the in-memory test session…';tdPaintSimulation();
  const result=await session.execute(op.id,input,{signal:controller.signal});
  if(tdUi.session!==session||tdUi.abort!==controller||tdFingerprint()!==key)return;
  tdUi.output=result===undefined?'No payload':JSON.stringify(result,null,2);
 }catch(error){if(!controller||tdUi.abort===controller)tdUi.output=(error.status?'Simulated status '+error.status+': ':'')+error.message;}
 finally{if(!controller||tdUi.abort===controller){tdUi.busy=false;tdUi.abort=null;tdPaintSimulation();}}
}
function tdChooseOperation(id){
 tdUi.abort?.abort();tdUi.abort=null;tdUi.busy=false;tdUi.operation=id;tdUi.output='';
 try{const op=createFixtureEngine().generate(tdManifest()).operations.find(o=>o.id===id);tdUi.input=op?.inputValue===undefined?'':JSON.stringify(op.inputValue,null,2);}catch{tdUi.input='';}
}
function handleTestDataAction(action,value=''){
 if(!action.startsWith('td-'))return false;
 if(!project()){openVaultIdentity('testdata');return true;}
 switch(action){
  case 'td-open':tdUi.source=value||null;setView('testdata');break;
  case 'td-source':tdDropSession();tdUi.source=value;tdUi.error='';render();break;
  case 'td-settings':tdOpen();break;
  case 'td-recipe':tdOpen(value);break;
  case 'td-save':tdSave();break;
  case 'td-enable':{const s=dataSources().sources.find(s=>s.id===value);if(!s)break;const settings=designCopy(tdSettings());for(const op of s.operations){const r=designCopy(tdRecipe(s,op));r.enabled=true;const i=settings.recipes.findIndex(x=>x.operation===op.id);if(i<0)settings.recipes.push(r);else settings.recipes[i]=r;}if(tdCommit(settings)){tdUi.error='';render();}break;}
  case 'td-preview':if(tdBuildPreview())render();break;
  case 'td-file':tdUi.file=Number(value)||0;render();break;
  case 'td-export':{const p=tdUi.preview;if(!p||p.fingerprint!==tdFingerprint()){tdFail('Preview the current recipes before exporting. The previous preview is stale.');break;}tdDownloadKit(p.manifest);break;}
  case 'td-simulate':void tdSimulate();break;
  case 'td-cancel':tdUi.abort?.abort(new Error('Test request cancelled. No live fallback.'));break;
  case 'td-reset-session':tdDropSession();tdUi.output='In-memory session reset. Files on disk were not changed.';tdPaintSimulation();break;
  case 'td-target':if(state.activeRun){tdFail('Finish the active project simulation first.');break;}tdUi.target={owner:designOwner(),revision:project().rev,vault:project().vault};showModal('test-data-target');break;
  case 'td-target-confirm':{const p=project(),t=tdUi.target;if(state.activeRun||!t||t.owner!==designOwner()||t.revision!==p.rev||t.vault!==p.vault){notify('Development target review is stale or a run is active. Reopen the target review.');break;}tdUi.target=null;p.vault=vaultTestRoot();invalidateProject(p);state.wizard=null;modalOriginal=null;closeModal();render();notify('Development target set to .test-vault. Existing .dev-vault files were not moved or deleted.');break;}
 }
 return true;
}
function editTestDataField(el){
 const key=el.dataset.field;if(!key?.startsWith('td-'))return false;
 if(key==='td-operation'){tdChooseOperation(el.value);tdPaintSimulation();return true;}
 if(key==='td-input'){tdUi.input=el.value;return true;}
 const f=tdUi.form;if(!f)return true;
 if(key.startsWith('td-rule-')){
  const op=dataSources().sources.find(s=>s.id===f.source)?.operations.find(o=>o.id===f.operation),rows=[...tdRows(op.input,'input'),...tdRows(op.output,'output')],row=rows[Number(el.dataset.index)];if(!row)return true;
  let r=f.record.rules.find(r=>r.side===row.side&&r.path===row.path);if(!r){r={side:row.side,path:row.path,provider:'auto',argument:''};f.record.rules.push(r);}
  r[key==='td-rule-provider'?'provider':'argument']=el.value;
  if(r.provider==='auto'&&!r.argument)f.record.rules=f.record.rules.filter(x=>x!==r);return true;
 }
 const name=key.slice(3);
 if(['seed','count','latencyMs','errorStatus'].includes(name))f.record[name]=el.value===''?null:Number(el.value);
 else if(name==='referenceDate')f.record[name]=el.value+'T00:00:00.000Z';
 else if(name==='enabled')f.record.enabled=el.checked;
 else if(Object.hasOwn(f.record,name))f.record[name]=el.value;
 return true;
}
