function designSelect(label,key,options,value,help=''){
 return `<div class="field"><label for="d-${key}">${label}</label><select id="d-${key}" data-field="design-${key}">${options.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select>${help?`<small>${help}</small>`:''}</div>`;
}
function designInput(label,key,value,help='',multiline=false){return `<div class="field"><label for="d-${key}">${label}</label>${multiline?`<textarea id="d-${key}" data-field="design-${key}" rows="3" maxlength="1000">${esc(value)}</textarea>`:`<input id="d-${key}" data-field="design-${key}" value="${esc(value)}" maxlength="120">`}${help?`<small>${help}</small>`:''}</div>`;}
function designNodeDialog(){
 const d=design(),f=designUi.form;if(!f)return dialogBody('No surface','Choose a surface first.');
 const excluded=nodeDescendants(d,f.id);const parents=d.nodes.filter(n=>!excluded.has(n.id)&&['view','page','group'].includes(n.kind));
 const layouts=LAYOUTS.filter(l=>f.kind==='settings'?l.id==='form':f.kind==='modal'?['single','form','wizard'].includes(l.id):true);
 return dialogBody(f.editing?'Edit '+f.label:'Add a surface',`<div class="grid2">${designSelect('Surface type','node-kind',Object.entries(NODE_KINDS),f.kind,'Native views register with Obsidian; internal screens belong inside one.')}${designInput('Display name','node-label',f.label)}${designInput('Stable code name','node-slug',f.slug,'Lowercase kebab-case. Renaming after scaffolding needs a reviewed migration.')}${designSelect('Parent','node-parent',[['','Plugin root'],...parents.map(n=>[n.id,n.label+' · '+NODE_KINDS[n.kind]])],f.parent||'')}${f.kind==='group'?callout('Navigation groups organize screens. They have no visual layout or component stack.'):designSelect(f.kind==='view'?'Host layout':'Layout template','node-layout',layouts.map(l=>[l.id,l.name]),f.layout)}${f.kind==='view'?designSelect('Initial placement','node-placement',Object.entries(PLACEMENTS),f.placement,'A preference on first open; never force panes back after the user moves them.'):callout('Placement is inherited for internal screens. Dialogs and settings are separate host surfaces.')}${f.kind==='view'?designSelect('Opening policy','node-instance',[['reuse','Focus existing instance'],['multiple','Allow multiple instances']],f.instance):''}${designSelect('Declared entity (optional)','node-entity',[['','No entity binding'],...(design().semantic?.entities||[]).map(e=>[e.id,e.name]),...(f.entity&&!(design().semantic?.entities||[]).some(e=>e.id===f.entity)?[[f.entity,f.entity+' · legacy unbound reference']]:[])],f.entity,'Declare entities in Design → Entity relationships. Screen names never infer fields.')}</div>${f.kind==='group'?'':`<div class="surface-form-layout" aria-label="Complete layout preview">${surfaceLayoutDiagram(f.layout)}</div>`}<div class="entry-options">${f.kind!=='group'?`<label><input type="checkbox" data-field="design-node-command" ${f.command?'checked':''}> Command palette entry</label><label><input type="checkbox" data-field="design-node-ribbon" ${f.ribbon?'checked':''}> Optional ribbon shortcut</label>`:''}${f.parent?`<label><input type="checkbox" data-field="design-node-nav" ${f.nav?'checked':''}> Show in parent navigation</label>`:''}${['view','modal','action'].includes(f.kind)?`<label><input type="checkbox" data-field="design-node-entry" ${f.entry?'checked':''}> Primary entry surface</label>`:''}</div>${designInput('User intent','node-intent',f.intent||'','Why does the user come to this screen?',true)}${designInput('User goals — one outcome per line','node-goals',(f.goals||[]).join('\n'),'Keep goals observable. They do not become implemented behavior.',true)}${designInput('User outcome / business logic','node-goal',f.goal,'Describe the behavior you will implement, not a shell command.',true)}${f.kind==='action'?designSelect('Initial action pattern','node-initialPattern',PATTERNS.map(p=>[p.id,p.name]),f.initialPattern||f.patterns[0]||'open-view'):''}<p class="error" id="design-error" role="alert">${esc(designUi.error)}</p>`,button('Cancel','close','','ghost')+button('Save surface','design-save','','primary','check'));
}
function designConnectDialog(){return typedConnectionDialog();}

function linkKind(n){return n?.kind==='modal'?'open':n?.kind==='settings'?'configure':n?.kind==='action'?'execute':'navigate';}
function designGoalDialog(){return dialogBody('Define the product intent',`${designInput('What should the plugin help people do?','goal',designUi.goalDraft.goal,'This guides the business-logic handoff; no behavior is inferred from prose.',true)}${designSelect('Target ambition','platform',[['desktop','Desktop-first'],['mobile-ready','Mobile-ready design (requires qualification)']],designUi.goalDraft.platform,'This changes design checks, not the manifest or tested-platform claims.')}<p class="error" role="alert">${esc(designUi.error)}</p>`,button('Cancel','close','','ghost')+button('Save intent','design-goal-save','','primary'));}
function designReplaceDialog(){const b=BLUEPRINTS.find(b=>b.id===modalData);return dialogBody('Use '+b.name+'?',`${layoutThumbnail(b.layout,true)}<p>${b.description}</p>${callout('This replaces the editable sitemap only. PRDs, components and source declarations are preserved. Connected data flows must first be reassigned or removed explicitly; they block replacement. Existing requirement links to replaced surfaces become explicit blockers; no source files are deleted. Undo restores the previous outline.','warn')}`,button('Cancel','close','','ghost')+button('Use blueprint','blueprint-apply',b.id,'primary','check'));}
function designRemoveDialog(){const n=design().nodes.find(n=>n.id===modalData);if(!n)return dialogBody('Surface not found','It may already have been removed.');const nodes=nodeDescendants(design(),n.id);return dialogBody('Remove '+n.label+'?',`<p>This removes ${nodes.size} surface(s) and ${design().links.filter(e=>nodes.has(e.from)||nodes.has(e.to)).length} related user-flow connection(s) from the outline.</p><p class="small muted">${dataSources().flows.filter(f=>nodes.has(f.card)).length} data flow(s) reference these surfaces. Removal is blocked until you reassign or explicitly remove them in Data Sources.</p><p class="small muted">${allRequirements().filter(r=>r.nodes.some(id=>nodes.has(id))).length} requirement reference(s) are retained and will need remapping. Shared component definitions are kept.</p>${callout('Previously scaffolded files are retained. This is not a code deletion or migration. You can undo the outline change.','warn')}`,button('Cancel','close','','ghost')+button('Remove from outline','design-remove-confirm',n.id,'danger'));}
function designTransferDialog(){return dialogBody('Portable plugin blueprint',`<p>Export the sitemap, layouts, patterns and product intent as data. Declared note folders and public source locations may be included. No execution trust, credential values or test results are included. Do not place secrets in descriptive text. Import validates schema and structure before replacing the outline.</p><label for="blueprint-json">Blueprint JSON</label><textarea id="blueprint-json" data-field="design-transfer-json" aria-describedby="design-error" aria-invalid="${!!designUi.error}" class="mono transfer-area" spellcheck="false">${esc(designUi.transfer?.text??JSON.stringify(portableDesign(),null,2))}</textarea><p id="design-error" class="error" role="alert">${esc(designUi.error)}</p>`,button('Close','close','','ghost')+button('Import reviewed JSON','design-import','','','upload')+button('Download saved blueprint','design-export','','primary','download'));}
function startNodeForm(kind='view',editId=null){
 const d=design(),n=d.nodes.find(n=>n.id===editId),selected=selectedNode();
 const parent=kind==='page'?(selected&&['view','page','group'].includes(selected.kind)?selected.id:d.nodes.find(n=>n.kind==='view')?.id||null):null;
 designUi.form=n?{...designCopy(n),intent:n.intent||'',goals:n.goals||[],editing:true,owner:designOwner()}:{components:[],id:'node-'+d.nextId,label:kind==='view'?'New view':kind==='page'?'New screen':'New surface',slug:kind==='view'?'new-view':kind==='page'?'new-screen':'new-surface',kind,layout:kind==='settings'?'form':'single',placement:'tab',parent,nav:kind==='page',command:kind==='view',ribbon:false,entry:!d.nodes.some(n=>n.entry)&&kind==='view',instance:'reuse',patterns:[],goal:'',intent:'',goals:[],entity:'',editing:false,owner:designOwner()};
 if(!n){Object.assign(designUi.form,uniqueSurfaceName(d,kind));designUi.form.autoSlug=true;}
 designUi.form.baseRevision=d.revision;designUi.error='';showModal('design-node');
}
function saveDesignNode(){
 const d=design(),f=designUi.form;designUi.error='';if(state.activeRun){designUi.error='Finish the active simulation before saving.';redrawModal();return;}
 if(f.owner!==designOwner()||f.baseRevision!==d.revision){designUi.error='The selected project changed. Reopen the surface editor.';redrawModal();return;}
 if(!f.editing&&f.autoSlug)f.slug=allocateSurfaceCode(d,f.label);
 const keys=['components','id','slug','label','kind','layout','placement','parent','nav','command','ribbon','entry','instance','patterns','goal','entity','intent','goals'];
 const n=Object.fromEntries(keys.map(k=>[k,designCopy(f[k])]));if(f.bricks!==undefined)n.bricks=designCopy(f.bricks);
 if(n.kind==='action'&&!n.patterns.length)n.patterns=[f.initialPattern||'open-view'];
 if(n.entity&&!safeSlug(n.entity)){designUi.error='Use a portable entity code name, not a path or executable expression.';redrawModal();return;}
 if(!f.editing&&d.nodes.length>=DESIGN_LIMITS.nodes){designUi.error='The concept supports up to 60 surfaces.';redrawModal();return;}const candidate=designCopy(d);if(f.editing)candidate.nodes[candidate.nodes.findIndex(x=>x.id===n.id)]=n;else candidate.nodes.push(n);
 if(n.entry)candidate.nodes.forEach(x=>{if(x.id!==n.id)x.entry=false;});
 const issues=newDesignErrors(d,candidate);
 if(issues.length){designUi.error=issues[0].message;redrawModal();return;}
 if(f.editing&&JSON.stringify(d.nodes.map(surfaceEditIdentity))===JSON.stringify(candidate.nodes.map(surfaceEditIdentity))){closeModal();return;}
 recordDesign();d.nodes=candidate.nodes;if(!f.editing){d.nextId++;canvasState(d);if(n.parent)assignCardToSection(d,n.id,sectionForCard(d,n.parent));}linkCreatedRequirement(n);designChanged();designUi.selected=n.id;closeModal();render();notify('Surface saved to the outline. Source is unchanged.');
}
function editDesignField(el,commit){
 const key=el.dataset.field,value=el.type==='checkbox'?el.checked:el.value;
 if(key==='pattern-search'||key==='pattern-category'){designUi[key==='pattern-search'?'filter':'category']=value;document.getElementById('pattern-results').innerHTML=patternResults();return true;}
 if(!key?.startsWith('design-'))return false;
 if(key==='design-transfer-json'){if(designUi.transfer)designUi.transfer.text=value;return true;}
 if(key==='design-approve'){if(designUi.plan)designUi.plan.approved=value;return true;}
 if(key==='design-goal'||key==='design-platform'){designUi.goalDraft[key.slice(7)]=value;return true;}
 if(key.startsWith('design-node-')){
  const k=key.slice(12),f=designUi.form;f[k]=k==='parent'?(value||null):k==='goals'?value.split('\n').filter(x=>x.trim()):value;
  if(k==='slug')f.autoSlug=false;
  if(k==='label'&&!f.editing&&f.autoSlug){f.slug=allocateSurfaceCode(design(),value);const input=document.getElementById('d-node-slug');if(input)input.value=f.slug;}
  if(k==='kind'){
   if(['modal','settings'].includes(value)){f.layout='form';f.parent=null;f.nav=false;f.command=false;f.ribbon=false;f.entry=false;}
   if(value==='group'){f.command=false;f.ribbon=false;f.entry=false;f.patterns=[];}
   if(value==='page'){f.command=false;f.ribbon=false;f.entry=false;f.nav=true;}
  }
  if(commit&&el.tagName==='SELECT')redrawModal();return true;
 }
 if(key.startsWith('design-link-')){const k=key.slice(12);designUi.form[k]=value;if(k==='to'&&!allowedLinkKinds(design().nodes.find(n=>n.id===value)).includes(designUi.form.kind))designUi.form.kind=linkKind(design().nodes.find(n=>n.id===value));if(commit&&el.tagName==='SELECT')redrawModal();return true;}
 return true;
}

// Compare editable values, not object insertion order or absent optional defaults.
function surfaceEditIdentity(n){return ['components','id','slug','label','kind','layout','placement','parent','nav','command','ribbon','entry','instance','patterns','goal','entity'].map(k=>n[k]).concat([n.intent||'',n.goals||[],n.bricks||[]]);}
