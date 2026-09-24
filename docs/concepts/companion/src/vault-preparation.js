// Reviewed, additive file-plan SIMULATION. No archive is fetched and no disk or
// command adapter is used here. Real template hydration requires shared tooling.
function vaultTemplateFiles(w){return {
 'manifest.json':JSON.stringify({id:w.id,name:w.name,version:w.version,author:w.author,description:w.description,fixture:true},null,2),
 'package.json':JSON.stringify({name:w.id,version:w.version,private:true,notice:'Illustrative template file — not an installable project'},null,2),
 'src/main.ts':'// Reviewed template entry fixture. Real source comes from a qualified template artifact.\n',
 'scripts/setup.mjs':'// Canonical setup entry fixture. No code is executed by this concept.\n',
 '.gitignore':'.obsidian/\n.dev-vault/\nnode_modules/\ndist/\nreports/\n',
 'Project.md':projectNoteText({...project(),...w,key:project().key})
};}
function protectedVaultPath(path){return path===CONCEPT_VAULT.config||path.startsWith(CONCEPT_VAULT.config+'/')||path==='.git'||path.startsWith('.git/')||path==='project'||path.startsWith('project/')||path==='.dev-vault'||path.startsWith('.dev-vault/');}
function vaultFilePlan(w){
 const files=state.vaultFiles;
 return Object.entries(vaultTemplateFiles(w)).map(([path,after])=>{
  const present=Object.hasOwn(files,path),before=present?files[path]:null;
  const overlaps=Object.keys(files).some(other=>other!==path&&(other.toLowerCase()===path.toLowerCase()||other.toLowerCase().startsWith(path.toLowerCase()+'/')||path.toLowerCase().startsWith(other.toLowerCase()+'/')));
  const owned=path==='Project.md'&&before===project().projectNote;
  const status=!validVaultRelativePath(path)||protectedVaultPath(path)||overlaps?'conflict':!present?'create':before===after?'unchanged':owned?'update':'conflict';
  return {path,before,after,status};
 });
}
function validPreparationScope(w){return Boolean(project())&&w.owner===project().key&&w.root===vaultRoot()&&w.vault===vaultTestRoot()&&w.config==='.obsidian';}
function startVaultPreparation(){
 if(!project()){openVaultIdentity();return;}
 if(state.activeRun){notify('Finish or cancel the active simulation first.');return;}
 if(vaultProjectPrepared()){setView('develop');notify('This project is already prepared. No second project or repeated initialization was created.');return;}
 const p=project();
 if(!state.wizard)state.wizard={...newWizard(),name:p.name,id:p.id,author:p.author,description:p.description,version:p.version,owner:p.key};
 const w=state.wizard;
 w.root=vaultRoot();w.vault=vaultTestRoot();w.config='.obsidian';
 w.design=designCopy(design());w.blueprint=design().blueprint;
 if(w.status!=='running'&&w.step!==6){w.plan=null;w.approved=false;w.step=Math.min(w.step,5);}
 showModal('wizard');save();
}
function prepareVaultPlan(){
 const w=state.wizard;if(!validPreparationScope(w))return wizardError('The current vault binding is invalid. No files were changed.');
 if(!w.trusted)return wizardError('Review execution trust before asking project scripts to prepare a plan.');
 if(!w.acquired||!w.bound)return wizardError('Stage a template and review the isolated test target before preparation.');
 if(state.scenario==='missing-node')return wizardError('Node is unavailable. Design remains usable; preparation is blocked.');
 const error=identityError(w);if(error)return wizardError(error);
 const issues=designIssues(design()).filter(i=>i.level==='error');if(issues.length)return wizardError('Resolve the outline before preparation: '+issues[0].message);
 w.plan={rev:w.rev,owner:w.owner,scope:vaultScopeSnapshot(),identity:projectIdentity(w),changes:vaultFilePlan(w)};w.approved=false;
 w.error=w.plan.changes.some(f=>f.status==='conflict')?'Conflicting files are preserved. Review them outside this simulation, then prepare a fresh plan.':'';
 redrawModal();save();
}
function beginVaultSetup(){
 const w=state.wizard;if(!w||state.activeRun)return;
 if(!validPreparationScope(w)||!w.trusted||!w.approved||!w.plan||!w.acquired||!w.bound)return wizardError('Stage, trust and approve the current vault-bound plan first.');
 if(state.scenario==='missing-node')return wizardError('Node is unavailable. No operation started.');
 if(state.scenario==='stale-plan'||w.plan.rev!==w.rev||w.plan.scope!==vaultScopeSnapshot()||w.plan.identity!==projectIdentity(w)||JSON.stringify(w.plan.changes)!==JSON.stringify(vaultFilePlan(w))){
  w.plan=null;w.approved=false;return wizardError('The project, outline or vault files changed after review. Prepare a fresh plan; nothing was overwritten.');
 }
 if(state.scenario==='collision'||w.plan.changes.some(f=>f.status==='conflict'))return wizardError('Conflicting files or installation detected. No overwrite is available.');
 w.status='running';w.step=6;w.stage=0;w.completed=[];w.error='';w.guard=vaultScopeSnapshot();w.planSnapshot=JSON.stringify(w.plan);
 const run=addRun(w.resume?'Resume vault preparation':'Prepare this vault','setup',getSetupCommand(w,true));w.runId=run.id;state.activeRun=run.id;
 render();redrawModal();runTimer=setTimeout(tickVaultSetup,420);
}
function stopVaultSetup(message){
 const w=state.wizard,r=state.runs.find(r=>r.id===state.activeRun);w.status='failed';w.error=message;if(r){r.status='failed';r.logs.push('[demo] '+message);}state.activeRun=null;save();render();redrawModal();
}
function tickVaultSetup(){
 const w=state.wizard;if(!w||w.status!=='running'||!state.activeRun)return;
 if(!validPreparationScope(w)||w.guard!==vaultScopeSnapshot()||w.planSnapshot!==JSON.stringify(w.plan)||w.plan.identity!==projectIdentity(w)||w.plan.rev!==w.rev)return stopVaultSetup('The vault or design changed during preparation. Completed fixture writes are retained. Inspect and review again; no blind retry.');
 const p=project(),r=state.runs.find(r=>r.id===state.activeRun),i=w.stage;
 if(i>=STAGES.length){
  Object.assign(p,{name:w.name,id:w.id,author:w.author,description:w.description,version:w.version,phase:'prepared',trusted:true,builtRev:p.rev,installedRev:p.rev,enabled:false,quality:{verify:{status:'passed',rev:p.rev}}});
  p.projectNote=state.vaultFiles['Project.md'];w.status='succeeded';r.status='succeeded';state.activeRun=null;w.step=7;state.view='overview';
  r.logs.push('[demo] The same project is prepared. No native, browser or security evidence was inferred.');save();render();redrawModal();notify('Vault preparation simulated. Your existing design is retained.');return;
 }
 if(i===1){
  for(const f of w.plan.changes){if(f.status==='create'||f.status==='update')state.vaultFiles[f.path]=f.after;}
  p.projectNote=state.vaultFiles['Project.md'];w.guard=vaultScopeSnapshot();
 }
 if(state.scenario==='install-failure'&&i===2)return stopVaultSetup('Dependency installation failed in this scenario. Added fixture files and your design are retained. Review again to resume.');
 w.completed.push(i);r.stages.push(STAGES[i]);r.logs.push('[demo] '+STAGES[i]+' — complete.');w.stage++;save();render();redrawModal();runTimer=setTimeout(tickVaultSetup,420);
}
function vaultRuntimeGuard(action){
 const blocked=['maker-preview','maker-apply','check-confirm','session-confirm','deploy-confirm','enable-demo','edit-source','commit-note'];
 if(blocked.includes(action)&&!vaultProjectPrepared()){notify('Prepare this vault before running project tools. Designing does not require a toolchain.');return true;}
 return false;
}
