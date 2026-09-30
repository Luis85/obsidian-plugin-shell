// Native controls, local filtering, and honest generated/remaining scope. Definitions come only from selected JSON files.
function starterCard(entry) {
  const d = entry.document.design, pages = d.nodes.filter(n => ['page','modal','settings'].includes(n.kind));
  return `<article class="starter-card" aria-labelledby="starter-title-${entry.id}"><div class="starter-card-top"><span class="starter-category">${esc(entry.category)}</span>${badge(entry.level)}</div><div class="starter-mini" aria-hidden="true"><span class="starter-mini-rail"></span><span class="starter-mini-body"><strong>${esc(entry.name)}</strong><span>${pages.slice(0,3).map(p => `<i>${esc(p.label)}</i>`).join('') || '<i>Empty workspace</i>'}</span></span></div><h2 id="starter-title-${entry.id}">${esc(entry.name)}</h2><p class="starter-summary">${esc(entry.summary)}</p><p class="starter-facts">${d.nodes.length} surfaces · ${d.semantic?.entities.length || 0} entities · ${allRequirements(d).length} requirements</p><p class="small muted">${esc(entry.outcome)}</p><div class="starter-card-footer">${button(entry.id === 'blank' ? 'Start Blank' : 'Preview & configure', 'starter-open', entry.id, entry.id === 'blank' ? 'primary' : '', 'arrow')}</div></article>`;
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
  return (matches.length ? `<div class="starter-grid">${matches.map(entry=>`<div>${starterCard(entry)}${project()?button('Use recipe for current project','starter-recipe',entry.id,'small','file'):''}</div>`).join('')}</div>` : `<section class="card starter-empty"><h2>${starterCatalog.starters.length?'No matching starters':'No starter definitions loaded'}</h2><p>Choose a JSON file above or begin with a blank project.</p>${starterCatalog.starters.length?button('Clear filters','starter-clear','','primary'):''}${button('Blank project','starter-blank','',starterCatalog.starters.length?'':'primary')}</section>`) +
    (fileOnly.length ? `<section class="card mt16"><h2>File-based CLI starters</h2><p>These definitions contain files rather than a Companion design. Inspect them and generate them through the shell.</p>${fileOnly.map(row=>button(row.definition.name,'starter-inspect-files',row.definition.id,'small','file')).join('')}</section>` : '');
}
function renderStarterResults() {
  const results = document.getElementById('starter-results'), count = document.getElementById('starter-count');
  if (results) results.innerHTML = starterResults();
  if (count) count.textContent = starterMatches().length + ' of ' + starterCatalog.starters.length + ' starters';
}
function starterReviewBanner() {
  const source=projectTransferUi.starter;if(!source)return '';
  const entry=starterEntry(source.id);
  return `<section class="callout" id="starter-review-context"><div><strong>Review ${esc(entry.name)} · ${esc(entry.version)}</strong><p>The configured project is an independent copy. Confirming opens project setup; it does not run any process.</p><p class="small">Remaining development: ${esc(entry.implementation.join(' · '))}</p></div></section>`;
}
function starterSetupNotice() {
  return `<section class="callout"><div><strong>Project defined. Review setup next.</strong><p>Continue designing at any time by closing this dialog. Installing dependencies, building and opening a preview are separate shell processes. This browser never approves or executes them.</p>${button('Review shell handoff','starter-generate','','small','terminal')}</div></section>`;
}
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
function starterGenerationDialog() {
  const p=project(),source=p&&starterProjectSources.get(p);
  if(!p)return dialogBody('Generate a project','<p>Create or import a project first.</p>',button('Close','close','','ghost'));
  const command=source?'node shell.mjs new ../'+p.id+' --starter '+source.definition.id:'node shell.mjs new ../'+p.id+' --from '+p.id+'.companion.json';
  return dialogBody('Export and generate',`<p>This browser does not run processes. Review the source before invoking the shell.</p>${source?`<h3>Preserve the entire starter</h3><p>Export the edited starter to <code>configs/starters/${esc(source.definition.id)}.json</code>. It retains the current design, configured input defaults, supplementary files, process definitions and first-run choices. It does not retain execution trust.</p>`:'<p>No reviewed starter recipe is attached in this session. Load its JSON in Project starters and choose Use recipe for current project, or export project JSON without inferred files or processes.</p>'}<div class="command"><code>${esc(command)}</code></div><p>Review the printed file plan, then re-run with <code>--yes</code> to write it. Select subsequent processes separately with <code>starters run</code> and <code>--trust-processes</code>. Generation alone never grants execution authority.</p><p>Generated code and tests retain their implementation gaps. A model coverage report does not prove native behavior.</p>`,button('Close','close','','ghost')+(source?button('Export starter JSON','starter-export','','primary','download'):'')+button('Export project JSON','project-export','','ghost','download'));
}
function starterRecipeDialog() {
  const row=starterWorkspaceUi.definitions.get(modalData.id);
  return dialogBody('Attach recipe for starter export',`<p>The current project and all its edits remain unchanged. Only the recipe used for the next starter export changes.</p><p>Recipe: <strong>${esc(row?.definition.name||modalData.id)}</strong></p><p class="small">Reviewed SHA-256: ${esc(modalData.sha256)}</p><p>Includes ${row?.definition.files.length??0} supplementary files and these unapproved process definitions: ${esc(row?.definition.processes.map(item=>item.label).join(', ')||'none')}.</p><p>Current project identity and folders become export defaults. Other inputs use the recipe's defaults; a missing required input blocks attachment.</p><label><input type="checkbox" id="starter-recipe-confirm"> Use this recipe for export only; do not replace the project or run processes.</label><p role="alert">${esc(modalData.error||'')}</p>`,button('Cancel','close','','ghost')+button('Attach recipe','starter-recipe-apply','','primary'));
}
