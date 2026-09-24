// One navigation language across the existing workspaces. No second project model.
function workflowRail(){
 if(!workflowHasDesign())return '';
 const f=workflowFacts(),current=workflowStage();
 return `<nav class="workflow-rail" aria-label="Design to plugin workflow">${WORKFLOW_STAGES.map((s,i)=>`<button data-action="workflow-stage" data-value="${s.id}" class="workflow-step ${current===s.id?'current':''}" ${current===s.id?'aria-current="step"':''} title="${esc(s.detail+' · '+workflowStatus(s.id,f))}"><span class="step-number">${i+1}</span><span>${s.label}</span></button>`).join('')}<span class="workflow-spacer"></span><button class="workflow-context" data-action="workflow-context" aria-label="Inspect project context and next step">${icon('folder')}<span>${esc(f.p?.name||'Unattached outline')}</span>${icon('chevron')}</button></nav>`;
}
function workflowStartView(){return vaultWelcomeView();}
function workflowOverview(){
 if(!project())return vaultWelcomeView();
 const f=workflowFacts(),n=workflowNext();
 return heading(f.p?.name||'Your plugin workspace','The current vault is your project root. Design and source stay together.',button('Project details','vault-init','','small','folder'))+
 `${vaultLocationCard()}<section class="next-task"><span class="next-task-icon">${icon('arrow')}</span><div class="grow"><h2>${n.title}</h2><p>${n.description}</p></div>${workflowActionButton(n)}</section>
 <div class="work-overview"><section class="workflow-ledger"><div class="section-head"><h2>Design to implementation</h2><span class="small muted">Revisit any stage</span></div>${WORKFLOW_STAGES.map((s,i)=>`<button class="ledger-step" data-action="workflow-stage" data-value="${s.id}"><span class="ledger-number">${i+1}</span><span class="grow"><strong>${s.detail}</strong><small>${workflowStatus(s.id,f)}</small></span>${icon('arrow')}</button>`).join('')}<p class="ledger-note">These describe your design and fixture state, not production readiness.</p></section>
 <section class="overview-detail"><h2>Review attention</h2>${f.blockers.length?f.blockers.slice(0,4).map(i=>{const dest=workflowIssueDestination(i);return `<div class="attention-item">${icon('shield')}<p>${esc(i.message)}</p>${button('Review',dest.action,dest.value,'small')}</div>`;}).join(''):`<div class="attention-clear">${icon('check')}<div><strong>No structural blockers</strong><p>Business behavior, usability and native compatibility still need verification.</p></div></div>`}
 <dl class="overview-facts"><dt>Brief</dt><dd>${f.active.length} active PRD(s)</dd><dt>Traceability</dt><dd>${f.mapped} / ${f.requirements.length} requirements mapped</dd><dt>Frontend</dt><dd>${f.d.nodes.filter(x=>x.kind==='view').length} native views · ${f.d.nodes.filter(x=>x.kind==='page').length} internal screens</dd><dt>Semantic layer</dt><dd>${f.d.semantic?.entities.length||0} entities · ${f.d.semantic?.relationships.length||0} relationships</dd><dt>Components</dt><dd>${f.used} bindings · ${f.d.library.length} contracts</dd><dt>Source plan</dt><dd>${f.generated?'Preview recorded at current design revision':'Review needed before scaffold preview'}</dd></dl>
 <div class="overview-shortcuts">${button('Add a view','design-add','view','small','plus')}${button('Open sitemap','nav','sitemap','small','layers')}${button('Entity relationships','nav','entities','small','layers')}${vaultProjectPrepared()?button('Generate a feature','nav','generate','small','wand'):button('Choose a blueprint','nav','blueprints','small','grid')}</div></section></div>
 ${vaultProjectPrepared()?`<section class="runtime-summary"><h2>Development evidence <span>simulated</span></h2><div class="runtime-revisions"><div><span>Source</span><strong>r${f.p.rev}</strong></div><div><span>Built candidate</span><strong>r${f.p.builtRev}</strong></div><div><span>Installed candidate</span><strong>r${f.p.installedRev}</strong></div><div><span>Activation</span><strong>${f.p.enabled?'Enabled fixture':'Not enabled'}</strong></div></div><div class="row wrap">${button('Develop','nav','develop','small','terminal')}${button('Inspect quality scopes','nav','quality','small','shield')}${button('Runs & recovery','nav','runs','ghost small','clock')}</div></section>`:''}${f.p?'<div class="section-head mt24"><h2>Recent activity</h2>'+button('All runs','nav','runs','ghost small','arrow')+'</div>'+recentRuns(3):''}`;
}
function workflowContextDialog(){return vaultContextDialog();}
function workflowHandoff(){
 const view=state.view;
 const hints={entities:['Connect meaning to experience','Entity declarations feed the reviewed generator. Diagram sections do not define runtime folders or database transactions.','Review generated contracts','design-preview',''],prds:['From requirements to screens','Map the user outcome to a surface; do not mistake a link for implementation.','Shape the sitemap','workflow-stage','structure'],components:['Use the contract where it belongs','Place one shared component into a named layout region, then return to its screen.','Back to sitemap','workflow-stage','structure'],blueprints:['Choose a starting point, not a constraint','A shell blueprint seeds surfaces. Each surface keeps its own internal layout.','Continue with sitemap','workflow-stage','structure'],patterns:['One action, several entry points','Keep commands, buttons and menus attached to the same application action.','Back to sitemap','workflow-stage','structure']};
 const h=hints[view];return h?`<footer class="handoff-bar"><div><strong>${h[0]}</strong><small>${h[1]}</small></div>${button(h[2],h[3],h[4],'small','arrow')}</footer>`:'';
}
function planFilePicker(){
 const files=filteredPlanFiles();return files.map(({file,index})=>`<button class="file-pick ${index===designUi.file?'chosen':''}" data-action="design-file" data-value="${index}" aria-pressed="${index===designUi.file}"><span>${esc(file.path)}</span>${badge(file.status,file.status==='conflict'?'bad':'')}</button>`).join('')||'<div class="file-empty"><strong>No matching files</strong><p>Clear the filter to see all changes.</p></div>';
}
function planFilterBar(){
 const count=designUi.plan?.changes.length||0;
 return `<div class="plan-filter-bar"><label>${icon('search')}<input id="plan-file-search" data-field="workflow-file-query" type="search" value="${esc(workflowUi.fileQuery)}" placeholder="Find a path or responsibility…" aria-label="Search planned files"></label><select data-field="workflow-file-status" aria-label="Filter planned file changes">${[['all','All changes'],['create','Create'],['update','Update'],['unchanged','Unchanged'],['conflict','Conflicts'],['retain','Retained']].map(([id,label])=>`<option value="${id}" ${workflowUi.fileStatus===id?'selected':''}>${label}</option>`).join('')}</select><span id="plan-filter-count">${filteredPlanFiles().length} / ${count} files</span>${button('Clear','workflow-file-clear','','ghost small')}</div><p class="filter-disclosure">Filters affect this preview only. Approval covers all ${count} files in the reviewed plan.</p>`;
}
function workflowDecorate(){
 const content=document.getElementById('content'),rail=document.getElementById('workflow-rail-holder');
 if(rail)rail.innerHTML=workflowRail();
 document.body.classList.toggle('has-workflow',Boolean(rail?.innerHTML));
 document.body.classList.toggle('home-workspace',state.view==='overview'&&!project());
 const existing=content.querySelector('.handoff-bar');if(existing)existing.remove();
 if(['prds','entities','components','blueprints','patterns'].includes(state.view))content.insertAdjacentHTML('beforeend',workflowHandoff());
 const breadcrumb=document.querySelector('.breadcrumb .muted');if(breadcrumb)breadcrumb.textContent=project()?.name||CONCEPT_VAULT.name;
 const main=content;if(main)main.setAttribute('aria-label',NAV.find(x=>x[0]===state.view)?.[2]||'Workspace');
 workflowMapSearchFeedback();
}
