// Current authoring entry. Definitions are selected local data, never embedded or executed.
const starterProjectSources = new WeakMap();
const starterWorkspaceUi = { definitions: new Map(), serial: 0, loading: false, error: '', reviewHash: '', startSetup: false };
function validateAuthoringDocument(value) { return CompanionJourney.validateAuthoringDocument(value); }
function parseAuthoringDocument(text) { return CompanionJourney.parseAuthoringDocument(text); }
function vaultWelcomeView() {
  return heading('Welcome to Workbench', 'Choose a starter or begin with a blank project. Nothing is created before review.') +
    `<section class="starter-intro" data-onboarding="empty"><div><span class="eyebrow">FOCUS ON YOUR IDEA</span><h2>Your workspace is empty.</h2><p>Load an editable JSON starter from the separate starter pack, or create a blank project. Then review your identity, folders and setup steps.</p><div class="row wrap">${button('Choose a starter','nav','starters','primary','grid')}${button('Blank project','starter-blank','','','plus')}</div></div><div class="starter-boundary"><strong>No hidden example project</strong><p>The Companion golden template and feature showcase are external JSON definitions. Existing saved projects reopen without being replaced.</p>${button('Import existing project','project-import','','ghost','file')}</div></section>${vaultLegacyBanner()}`;
}
function starterImportSection() {
  return `<section class="card mt16"><h2>Load starter definitions</h2><p>Extract the separate starters ZIP, then select one or more <code>configs/starters/*.json</code> files. These are kept in this browser session only. Importing a starter does not create a project or approve a process.</p><label for="starter-definition-files">Starter definition JSON files</label><input id="starter-definition-files" type="file" accept=".json,application/json" multiple ${starterWorkspaceUi.loading?'disabled':''}><p role="status">${starterWorkspaceUi.loading?'Validating selected definitions…':starterWorkspaceUi.definitions.size+' definitions loaded'}</p><p id="starter-load-error" class="error" role="alert" tabindex="-1">${esc(starterWorkspaceUi.error)}</p></section>`;
}
function projectStartersView() {
  const categories = [...new Set(starterCatalog.starters.map(s => s.category))];
  return heading('Project starters', 'External, editable JSON definitions. The shell and this workspace validate the same contract.', button('Blank project','starter-blank','','ghost','plus')) + starterImportSection() +
    `<div class="starter-filter"><label for="starter-search">Find a starter<input id="starter-search" type="search" data-field="starter-search" value="${esc(starterUi.query)}" placeholder="Name or use case" maxlength="160"></label><label for="starter-category">Category<select id="starter-category" data-field="starter-category"><option value="all">All categories</option>${categories.map(c=>`<option ${starterUi.category===c?'selected':''} value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><span id="starter-count" role="status">${starterMatches().length} Companion starters</span></div><div id="starter-results">${starterResults()}</div><footer class="starter-footnote">Definitions describe generation and subsequent processes. Browser setup is a simulation; real generation, installation and build require the independently approved shell workflow. Native acceptance is separate.</footer>`;
}
function starterResults() {
  const matches = starterMatches();
  const fileOnly = [...starterWorkspaceUi.definitions.values()].filter(row=>row.definition.generator.kind==='files');
  return (matches.length ? `<div class="starter-grid">${matches.map(entry=>`<div>${starterCard(entry)}${project()?button('Use recipe for current project','starter-recipe',entry.id,'small','file'):''}</div>`).join('')}</div>` : `<section class="card starter-empty"><h2>${starterCatalog.starters.length?'No matching starters':'No starter definitions loaded'}</h2><p>Choose a JSON file above or begin with a blank project.</p>${button('Blank project','starter-blank','','primary')}</section>`) +
    (fileOnly.length ? `<section class="card mt16"><h2>File-based CLI starters</h2><p>These definitions contain files rather than a Companion design. Inspect them and generate them through the shell.</p>${fileOnly.map(row=>button(row.definition.name,'starter-inspect-files',row.definition.id,'small','file')).join('')}</section>` : '');
}
async function readStarterDefinitions(files) {
  const serial = ++starterWorkspaceUi.serial, list = Array.from(files || []);
  starterWorkspaceUi.loading = true; starterWorkspaceUi.error = ''; render();
  try {
    if (!list.length || list.length > 256 || list.some(f=>!f.name.toLowerCase().endsWith('.json')||f.size>4000000) || list.reduce((sum,f)=>sum+f.size,0)>16000000) throw Error('Select 1–256 JSON definitions, at most 4 MB each and 16 MB total.');
    const incoming = new Map();
    for (const file of list) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length > 4000000) throw Error('A starter exceeded the 4 MB limit while reading.');
      const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes), definition = CompanionJourney.parseBrowserStarter(text);
      if (incoming.has(definition.id)) throw Error('Duplicate starter ID in this selection: '+definition.id);
      if (!crypto.subtle) throw Error('This browser needs a secure local file or localhost context to verify starter hashes.');
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      const entry = definition.generator.kind==='companion' ? CompanionJourney.starterProjection(definition,sha256) : null;
      incoming.set(definition.id,{definition,sha256,text,entry,bytes:bytes.length});
    }
    if (serial !== starterWorkspaceUi.serial) return;
    const merged = new Map([...starterWorkspaceUi.definitions,...incoming]);
    if (merged.size>256 || [...merged.values()].reduce((sum,r)=>sum+r.bytes,0)>16000000) throw Error('Loaded starters would exceed the session limit. Reload the page before loading another pack. Your project is preserved.');
    const entries = [...merged.values()].flatMap(row=>row.entry?[row.entry]:[]).sort((a,b)=>a.id.localeCompare(b.id));
    validateStarterCatalog({schemaVersion:1,starters:entries});
    starterWorkspaceUi.definitions = merged; starterCatalog.starters = entries;
    starterUi.query='';starterUi.category='all';starterUi.draft=null;
  } catch(error) { if(serial===starterWorkspaceUi.serial)starterWorkspaceUi.error=error.message||'Starter import failed. Existing definitions and project were preserved.'; }
  finally { if(serial===starterWorkspaceUi.serial){starterWorkspaceUi.loading=false;render();if(starterWorkspaceUi.error)document.getElementById('starter-load-error')?.focus();} }
}
function openStarter(id) {
  try {
    const row=starterWorkspaceUi.definitions.get(id),entry=starterEntry(id);
    if(!row||!entry)throw Error('Load this starter JSON first. No bundled fallback is used.');
    companionCanReplace(companionProjectToken());
    const defaults=Object.fromEntries(row.definition.inputs.filter(input=>input.default!==undefined).map(input=>[input.id,input.default]));
    starterUi.draft={starterId:id,snapshot:companionProjectToken(),...entry.document.project,...entry.document.settings,...defaults};
    starterWorkspaceUi.reviewHash=row.sha256;starterWorkspaceUi.startSetup=true;
    starterUi.error='';showModal('starter-configure');
  }catch(error){notify(error.message);}
}
function starterDraftDocument() {
  const {starterId,snapshot,...fields}=starterUi.draft,row=starterWorkspaceUi.definitions.get(starterId);
  companionCanReplace(snapshot);
  if(!row||row.sha256!==starterWorkspaceUi.reviewHash)throw Error('The starter changed. Configure and review its current bytes again.');
  const supplied=Object.fromEntries(Object.entries(fields).filter(([key])=>row.definition.inputs.some(input=>input.id===key)));
  return CompanionJourney.configureBrowserStarter(row.definition,row.sha256,supplied);
}
function starterReviewBanner() {
  const source=projectTransferUi.starter;if(!source)return '';
  const entry=starterEntry(source.id);
  return `<section class="callout"><div><strong>Review ${esc(entry.name)} · ${esc(entry.version)}</strong><p>The configured project is an independent copy. Confirming opens project setup; it does not run any process.</p><p class="small">Remaining development: ${esc(entry.implementation.join(' · '))}</p></div></section>`;
}
function openCompanionImport(example=false) {
  if(example){setView('starters');return;}
  if(state.activeRun||tdUi.busy)return notify('Finish or cancel the current operation first.');
  starterWorkspaceUi.startSetup=false;
  Object.assign(projectTransferUi,{text:'',filename:'',candidate:null,snapshot:companionProjectToken(),error:'',loading:false,starter:null,serial:projectTransferUi.serial+1});
  showModal('project-import');
}
function verifyStarterReview() {
  const source=projectTransferUi.starter;if(!source)return;
  const row=starterWorkspaceUi.definitions.get(source.id);
  if(!row||row.sha256!==source.sha256)throw Error('The starter changed after review. Configure and review its current bytes again; your project is unchanged.');
}
function starterSetupAfterCreate() {
  if(!starterWorkspaceUi.startSetup||!project())return;
  const origin=projectTransferUi.starter,row=origin&&starterWorkspaceUi.definitions.get(origin.id);
  if(row&&row.sha256===origin.sha256){
    const inputs=Object.fromEntries(Object.entries(starterUi.draft||{}).filter(([key])=>row.definition.inputs.some(input=>input.id===key)));
    starterProjectSources.set(project(),{definition:structuredClone(row.definition),sha256:row.sha256,inputs});
  }
  starterWorkspaceUi.startSetup=false;startVaultPreparation();
}
function starterSetupNotice() {
  return `<section class="callout"><div><strong>Project defined. Review setup next.</strong><p>Continue designing at any time by closing this dialog. Installing dependencies, building and opening a preview are separate shell processes. This browser never approves or executes them.</p>${button('Review shell handoff','starter-generate','','small','terminal')}</div></section>`;
}
function handleStarterAction(action,value) {
  if(action==='starter-recipe'){reviewStarterRecipe(value);return true;}
  if(action==='starter-recipe-apply'){attachStarterRecipe();return true;}
  if(action==='starter-open'){openStarter(value);return true;}
  if(action==='starter-review'){reviewStarter();return true;}
  if(action==='starter-back'){starterBack();return true;}
  if(action==='starter-clear'){starterUi.query='';starterUi.category='all';render();return true;}
  if(action==='starter-generate'){showModal('starter-generation');return true;}
  if(action==='starter-export'){
    try{const p=project(),source=p&&starterProjectSources.get(p);if(!source)throw Error('This session has no reviewed recipe for this project. Export project JSON instead; original starter files and processes will not be guessed.');
      const definition=CompanionJourney.exportBrowserStarter(source.definition,source.sha256,companionProjectDocument(p),source.inputs);
      showModal('copy',{title:'Edited starter definition — save under configs/starters/'+definition.id+'.json after review. Processes remain unapproved data.',text:JSON.stringify(definition,null,2)+'\n',filename:definition.id+'.json'});
    }catch(error){notify(error.message);}return true;
  }
  if(action==='starter-blank'){
    if(project()){notify('This vault already has a project. Export it before reviewing a replacement starter, or open an empty vault for a new blank project.');return true;}
    starterWorkspaceUi.startSetup=true;openVaultIdentity('overview');return true;
  }
  if(action==='starter-inspect-files'){
    const row=starterWorkspaceUi.definitions.get(value);
    if(row)showModal('copy',{title:'File-based starter — inspect JSON; execute only through the shell after review.',text:row.text,filename:row.definition.id+'.json'});
    return true;
  }
  return false;
}
document.addEventListener('change',event=>{if(event.target?.id==='starter-definition-files')void readStarterDefinitions(event.target.files);});

function starterConfigureDialog() {
  const draft=starterUi.draft,row=starterWorkspaceUi.definitions.get(draft.starterId),entry=starterEntry(draft.starterId);
  const fieldHtml=input=>{
    const id='starter-'+input.id,value=draft[input.id],required=input.required?'required':'';
    const choices=input.choices;
    const control=choices?`<select id="${esc(id)}" data-field="${esc(id)}" ${required}><option value="">Choose…</option>${choices.map((choice,index)=>`<option value="${index}" ${choice===value?'selected':''}>${esc(String(choice))}</option>`).join('')}</select>`:
      input.type==='boolean'?`<input id="${esc(id)}" data-field="${esc(id)}" type="checkbox" ${value?'checked':''}>`:
      `<input id="${esc(id)}" data-field="${esc(id)}" type="${input.type==='integer'?'number':'text'}" ${input.type==='integer'?'step="1"':'maxlength="4000"'} value="${esc(String(value??''))}" ${required}>`;
    return `<div class="field"><label for="${esc(id)}">${esc(input.label)}${input.required?' *':''}</label>${control}</div>`;
  };
  return dialogBody(entry.name,`<p>${esc(entry.summary)}</p><p>${esc(entry.outcome)}</p><h3>Project configuration</h3><p>These fields come from this definition. Changing identity does not rename its internal design objects.</p><div class="field-grid">${row.definition.inputs.map(fieldHtml).join('')}</div><h3>Included</h3><ul>${entry.includes.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><h3>Remaining development and qualification</h3><ul>${entry.implementation.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><div class="error" id="starter-error" role="alert" tabindex="-1">${esc(starterUi.error)}</div><p class="small">Version ${esc(entry.version)} · ${esc(row.sha256)}. Review before ${project()?'replacing the current project':'creating this project'}. No process is executed.</p>`,button('Cancel','close','','ghost')+button('Review project','starter-review','','primary','arrow'));
}
function editStarterField(el) {
  const field=el.dataset.field;
  if(field==='starter-search'){starterUi.query=el.value.slice(0,160);renderStarterResults();return true;}
  if(field==='starter-category'){starterUi.category=el.value;renderStarterResults();return true;}
  if(!field?.startsWith('starter-')||!starterUi.draft)return false;
  const input=starterWorkspaceUi.definitions.get(starterUi.draft.starterId)?.definition.inputs.find(input=>'starter-'+input.id===field);
  if(!input)return false;
  const value=input.choices?(el.value===''?undefined:input.choices[Number(el.value)]):input.type==='boolean'?el.checked:input.type==='integer'?(el.value===''?undefined:Number(el.value)):el.value;
  if(value===undefined)delete starterUi.draft[input.id];else starterUi.draft[input.id]=value;
  starterUi.error='';return true;
}

function starterGenerationDialog() {
  const p=project(),source=p&&starterProjectSources.get(p);
  if(!p)return dialogBody('Generate a project','<p>Create or import a project first.</p>',button('Close','close','','ghost'));
  const command=source?'node bin/app new ../'+p.id+' --starter '+source.definition.id:'node bin/app new ../'+p.id+' --from '+handoffFile(p);
  return dialogBody('Export and generate',`<p>This browser does not run processes. Review the source before invoking the shell.</p>${source?`<h3>Preserve the entire starter</h3><p>Export the edited starter to <code>configs/starters/${esc(source.definition.id)}.json</code>. It retains the current design, configured input defaults, supplementary files, process definitions and first-run choices. It does not retain execution trust.</p>`:'<p>No reviewed starter recipe is attached in this session. Load its JSON in Project starters and choose Use recipe for current project, or export project JSON without inferred files or processes.</p>'}<div class="command"><code>${esc(command)}</code></div><p>Review the printed file plan, then re-run with <code>--yes</code> to write it. Select subsequent processes separately with <code>starters run</code> and <code>--trust-processes</code>. Generation alone never grants execution authority.</p><p>Generated code and tests retain their implementation gaps. A model coverage report does not prove native behavior.</p>`,button('Close','close','','ghost')+(source?button('Export starter JSON','starter-export','','primary','download'):'')+button('Export project JSON','project-export','','ghost','download'));
}

function recipeInputs(row, document) {
  const values={...Object.fromEntries(row.definition.inputs.filter(input=>input.default!==undefined).map(input=>[input.id,input.default])),...document.project,...document.settings};
  return Object.fromEntries(row.definition.inputs.filter(input=>values[input.id]!==undefined).map(input=>[input.id,values[input.id]]));
}
function reviewStarterRecipe(id) {
  try {
    const p=project(),row=starterWorkspaceUi.definitions.get(id),snapshot=companionProjectToken();
    if(!p||!row||row.definition.generator.kind!=='companion')throw Error('Open a project and explicitly load its Companion starter recipe first.');
    companionCanReplace(snapshot);
    const document=companionProjectDocument(p),inputs=recipeInputs(row,document);
    CompanionJourney.exportBrowserStarter(row.definition,row.sha256,document,inputs);
    showModal('starter-recipe',{id,sha256:row.sha256,snapshot,error:''});
  }catch(error){notify(error.message);}
}
function starterRecipeDialog() {
  const row=starterWorkspaceUi.definitions.get(modalData.id);
  return dialogBody('Attach recipe for starter export',`<p>The current project and all its edits remain unchanged. Only the recipe used for the next starter export changes.</p><p>Recipe: <strong>${esc(row?.definition.name||modalData.id)}</strong></p><p class="small">Reviewed SHA-256: ${esc(modalData.sha256)}</p><p>Includes ${row?.definition.files.length??0} supplementary files and these unapproved process definitions: ${esc(row?.definition.processes.map(item=>item.label).join(', ')||'none')}.</p><p>Current project identity and folders become export defaults. Other inputs use the recipe's defaults; a missing required input blocks attachment.</p><label><input type="checkbox" id="starter-recipe-confirm"> Use this recipe for export only; do not replace the project or run processes.</label><p role="alert">${esc(modalData.error||'')}</p>`,button('Cancel','close','','ghost')+button('Attach recipe','starter-recipe-apply','','primary'));
}
function attachStarterRecipe() {
  try {
    if(!document.getElementById('starter-recipe-confirm')?.checked)throw Error('Confirm which recipe will accompany the current project.');
    const row=starterWorkspaceUi.definitions.get(modalData.id);
    if(!row||row.sha256!==modalData.sha256)throw Error('The recipe changed after review. Review its current bytes again.');
    companionCanReplace(modalData.snapshot);
    const p=project(),projectDocument=companionProjectDocument(p),inputs=recipeInputs(row,projectDocument);
    CompanionJourney.exportBrowserStarter(row.definition,row.sha256,projectDocument,inputs);
    starterProjectSources.set(p,{definition:structuredClone(row.definition),sha256:row.sha256,inputs});
    showModal('starter-generation');
  }catch(error){modalData.error=error.message;redrawModal();}
}
