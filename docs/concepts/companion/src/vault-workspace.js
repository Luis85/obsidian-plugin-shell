// Single-project navigation and identity editing. All persistence here is a
// browser fixture; Project.md previews specify, but do not write, native notes.
let vaultIdentityDraft=null;
function vaultLocationCard(){return `<section class="vault-location"><span class="icon-tile">${icon('folder')}</span><div class="grow"><strong>${esc(CONCEPT_VAULT.name)}</strong><small>Current Obsidian vault · simulated host context</small><code>${esc(vaultRoot())}</code></div>${badge('One vault · one project','purple')}</section>`;}
function vaultWelcomeView(){return heading('This vault. One project.','Start with the idea. Prepare the development toolchain when the design is ready.')+vaultLocationCard()+
 `<section class="start-workspace"><div class="start-head"><div class="eyebrow">YOUR PROJECT WORKSPACE</div><h2>Design first.<br>Build when you are ready.</h2><p>Your empty folder is already open as an Obsidian vault, and the companion is installed. Define this project, capture requirements and shape its screens before obtaining the template.</p><div class="row wrap">${button('Start designing','vault-init','','primary','layers')}${button('Use example outline','sample','','ghost','box')}</div><p class="start-disclosure">No Node, npm, Git or account is needed for design. This browser concept does not detect a real vault or write native files.</p></div><div class="start-process" aria-label="Vault-first project journey">${[['check','Open a folder as a vault','Completed before entering the plugin.'],['file','Define this project','A brief, requirements and a connected design.'],['layers','Shape the experience','Sitemap, layouts, content and shared components.'],['terminal','Prepare this vault','Review additive template files; then install and verify.']].map(([ic,t,d],i)=>`<div class="start-process-row"><span class="process-icon">${icon(ic)}</span><span><strong>${t}</strong><small>${d}</small></span><span class="process-order">${i+1}</span></div>`).join('')}</div></section>${vaultLegacyBanner()}<footer class="start-footer"><span>For a different project, open a different vault using Obsidian.</span>${button('Take a tour','tour','','ghost small','help')}</footer>`;}
function vaultLegacyBanner(){return legacyAvailable()?`<section class="callout warn"><div class="grow"><strong>Previous multi-project concept data found</strong><p>The original remains untouched. Bring one outline into this vault, or export the old workspace before deciding.</p></div>${button('Review old workspace','vault-legacy','','small')}</section>`:'';}
function vaultPreparationView(){
 const p=project();if(!p)return vaultWelcomeView();
 const inProgress=state.wizard&&state.wizard.status!=='succeeded';
 return heading('Prepare this vault','Turn this project’s design into a reviewed development workspace.')+vaultLocationCard()+
 `<section class="next-task"><span class="next-task-icon">${icon('terminal')}</span><div class="grow"><h2>${vaultProjectPrepared()?'This project is prepared':'Your design is already a project'}</h2><p>${vaultProjectPrepared()?'Continue in the existing workspace; initialization will not create another project.':'Preparation adds the template here. It does not create a second folder or replace the current design.'}</p></div>${button(vaultProjectPrepared()?'Open development':inProgress?'Resume preparation':'Review preparation',vaultProjectPrepared()?'nav':'vault-prepare',vaultProjectPrepared()?'develop':'','primary','arrow')}</section>
 <div class="grid2"><section class="card"><h2>Preserved in this vault</h2><p>Obsidian configuration, the companion installation, Project.md and your requirements, sitemap and components.</p><div class="context-path">${esc(CONCEPT_VAULT.config)}/ · Project.md · project/</div><p class="small muted">Existing files are compared before writes. Conflicts stop preparation; there is no force-overwrite option.</p></section><section class="card"><h2>Added after review</h2><p>Template source, build scripts and locked dependencies. Runtime testing uses an isolated vault, not the project’s authoring vault.</p><div class="context-path">src/ · scripts/ · package.json<br>Test target: ${esc(vaultDisplayTarget(vaultTestRoot()))}/</div><p class="small muted">Template acquisition, source writes, dependency installation, testing and activation are separate stages.</p></section></div><div class="button-row">${button('Back to the design','nav','sitemap','','layers')}${button('Project details','vault-init','','ghost','settings')}${button('Project record','vault-record','','ghost','file')}</div>`;
}
function vaultContextView(){const p=project();return `<div class="eyebrow">CURRENT VAULT</div><div class="context-block"><h3>${esc(CONCEPT_VAULT.name)}</h3><div class="context-path">${esc(vaultRoot())}</div><p>This is the project root. The native plugin uses the opened vault, never a project picker.</p>${badge('Simulated host context','purple')}</div><div class="context-block"><h3>${p?'This project':'Before the first design'}</h3><p>${p?esc(p.name)+' · '+esc(p.id):'Define one project here. Node, npm and Git are not needed for planning.'}</p>${badge(p?(vaultProjectPrepared()?'Prepared · demo':'Designing'):'Not initialized',vaultProjectPrepared()?'good':'')}<p class="small">Project.md and project/ are the proposed native authoring records. Browser state is not native vault persistence.</p></div><div class="context-block"><h3>Generated-plugin test target</h3><div class="context-path">${esc(p?.vault||vaultTestRoot())}</div><p>Separate host context. Installing the companion does not install or enable the plugin you are designing.</p></div><p class="small">Another project? Open another vault through Obsidian. CLI development stays independent of the companion.</p>`;}
function vaultContextDialog(){return dialogBody('This vault’s project',vaultLocationCard()+vaultContextView(),button('Close','close','','ghost')+(project()?button('Project record','vault-record','','ghost','file')+button('Project overview','palette-nav','overview','primary'):button('Start designing','vault-init','','primary')));}
function openVaultIdentity(after='prds'){
 if(state.activeRun){notify('Finish or cancel the current simulation before editing project details.');return;}
 if(vaultProjectPrepared()){showModal('workflow-context');return;}
 const p=project();vaultIdentityDraft={name:p?.name||CONCEPT_VAULT.name,id:p?.id||'my-plugin',author:p?.author||'',description:p?.description||'',version:p?.version||'1.0.0',after,snapshot:projectIdentity(p),error:''};showModal('vault-identity');
}
function vaultIdentityDialog(){const f=vaultIdentityDraft;return dialogBody(project()?'Project details':'Define this project',`<p>The source root is fixed to the currently opened vault. The project name and generated-plugin ID do not rename that folder.</p>${vaultLocationCard()}<div class="field-grid">${field('Project / plugin name','vault-name',f.name)}${field('Generated-plugin ID','vault-id',f.id,'Portable lowercase ID; different from shell-workbench.')}${field('Author','vault-author',f.author,'Optional while designing; required before preparation.')}${field('Initial version','vault-version',f.version)}</div>${field('Description','vault-description',f.description)}<div id="vault-form-error" role="alert" class="error">${esc(f.error)}</div><p class="small muted">In the native plugin, Project.md and project/ hold the authoring data. This concept retains it only in browser state. No template is acquired.</p>`,button('Cancel','close','','ghost')+button(project()?'Save project details':'Start this project','vault-save','','primary','arrow'));}
function saveVaultIdentity(){
 const f=vaultIdentityDraft,p=project();if(!f)return;
 const error=identityError({...f,author:f.author.trim()||'Planning only'});
 if(error||f.description.length>400||/[\r\n]/.test(f.name)){f.error=error||'Use a single-line name and a description up to 400 characters.';redrawModal();document.getElementById('vault-form-error')?.setAttribute('tabindex','-1');document.getElementById('vault-form-error')?.focus();return;}
 if(f.snapshot!==projectIdentity(p)||p&&state.vaultFiles['Project.md']!==p.projectNote){f.error='Project details or Project.md changed. Copy your edits and reopen this form; no data was overwritten.';redrawModal();return;}
 const values=Object.fromEntries(['name','id','author','description','version'].map(k=>[k,f[k].trim()]));
 try{
  if(p){const changed=Object.entries(values).some(([k,v])=>p[k]!==v);if(changed){Object.assign(p,values);p.rev++;p.projectNote=projectNoteText(p);state.vaultFiles['Project.md']=p.projectNote;designUi.plan=null;if(state.wizard){Object.assign(state.wizard,values);state.wizard.rev++;state.wizard.plan=null;state.wizard.approved=false;state.wizard.step=Math.min(3,state.wizard.step);}}}
  else installPlanningProject(newPlanningProject(values));
  modalOriginal=null;closeModal();setView(p?'overview':f.after);notify('Project details retained in this browser. No template or build was started.');
 }catch(e){f.error=e.message;redrawModal();}
}
function vaultLegacyDialog(){const options=legacyChoices();return dialogBody('Recover one outline into this vault',`<p>A previous concept stored several projects together. This workspace permits one project. The original browser key is retained, including all unselected projects and historical receipts.</p>${options.length?`<div class="field"><label for="legacy-choice">Outline to copy</label><select id="legacy-choice" data-field="vault-legacy-choice">${options.map((item,i)=>`<option value="${i}" ${i===modalData.index?'selected':''}>${esc(item.label)}</option>`).join('')}</select></div>`:callout('The old data is unsupported or malformed. Export it for recovery; it will not be imported automatically.','warn')}<p>Old paths, trust, approval, generated previews and execution evidence are not carried forward. Design content is retained and bound to this vault.</p><div class="error" id="legacy-error" role="alert">${esc(modalData.error||'')}</div>`,button('Cancel','close','','ghost')+button('Export original workspace','vault-legacy-export','','')+(options.length&&!project()?button('Copy this outline','vault-legacy-adopt','','primary'):''));}
function adoptLegacyOutline(){
 if(project()||state.activeRun)return notify('This vault already has a project. Use a different vault for another project.');
 try{
  if(localStorage.getItem(LEGACY_STORAGE_KEY)!==modalData.snapshot)throw Error('The previous workspace changed. Reopen this recovery review.');
  const choice=legacyChoices()[modalData.index];if(!choice)throw Error('Choose one valid outline.');
  const input=choice.identity,values={};for(const k of ['name','id','author','description','version'])if(typeof input[k]==='string')values[k]=input[k];
  const p=newPlanningProject(values);if(identityError({...p,author:p.author||'Planning only'}))throw Error('Legacy identity needs manual review. Export the original, define the project, then import its data-only blueprint.');
  p.design=designCopy(choice.design);p.design.emitted={};p.design.retired=[];p.design.generatedRevision=0;
  installPlanningProject(p);state.legacyHandled=true;modalOriginal=null;closeModal();setView('overview');notify('One outline copied. The full original workspace remains untouched.');
 }catch(e){modalData.error=e.message;redrawModal();}
}
function handleVaultAction(action,value){
 if(vaultRuntimeGuard(action))return true;
 if(['switch','select-project','attach','attach-confirm'].includes(action)){notify('One project belongs to this vault. Open another vault in Obsidian for a different project.');return true;}
 if(action==='sample'){loadSample();return true;}
 if(['vault-prepare','create','design-create','design-create-confirm','workflow-continue-setup'].includes(action)){startVaultPreparation();return true;}
 if(action==='vault-init'){openVaultIdentity(project()?'overview':'prds');return true;}
 if(action==='vault-save'){saveVaultIdentity();return true;}
 if(action==='vault-record'){if(project())showModal('copy',{title:'Project.md preview — simulated browser file, not a native vault write. Review private content before export.',text:state.vaultFiles['Project.md'],filename:'Project.md'});return true;}
 if(action==='vault-legacy'){showModal('vault-legacy',{snapshot:legacySnapshot,index:0,error:''});return true;}
 if(action==='vault-legacy-adopt'){adoptLegacyOutline();return true;}
 if(action==='vault-legacy-export'){downloadText({text:modalData.snapshot,filename:'previous-workbench-recovery.json'});return true;}
 if(['nav','palette-nav','outline-start'].includes(action)&&!project()){
  const target=action==='outline-start'?'prds':value;
  if(['prds','sitemap','entities','sources','testdata','designsystem','components','patterns','blueprints','prepare'].includes(target)){openVaultIdentity(target==='prepare'?'overview':target);return true;}
 }
 return false;
}
function editVaultField(el){
 const key=el.dataset.field;if(key==='vault-legacy-choice'){modalData.index=Number(el.value);return true;}
 if(!key?.startsWith('vault-')||!vaultIdentityDraft)return false;
 const field=key.slice(6);if(['name','id','author','description','version'].includes(field)){vaultIdentityDraft[field]=el.value;vaultIdentityDraft.error='';}return true;
}

// Shared presentation of a validated project-contained target; never moves files.
function vaultDisplayTarget(target = project()?.vault || vaultTestRoot()) {
  const prefix = vaultRoot() + '/';
  return target.startsWith(prefix) ? target.slice(prefix.length) : target;
}
