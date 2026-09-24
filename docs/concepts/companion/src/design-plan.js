// A deterministic browser-only compiler preview, NOT a production generator.
function designFiles(d){
 const files=[];const put=(path,content,owner,role)=>files.push({path,content,owner,role});
 const quote=v=>JSON.stringify(v).replace(/</g,'\\u003c');
 const header='// CONCEPT SCAFFOLD. Not compiled or verified. Implement the shared recipe before use.\n';
 const name=n=>n.slug.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('');
 for(const n of d.nodes){
  if(n.kind==='group')continue;
  const spec={nodeId:n.id,kind:n.kind,label:n.label,entity:n.entity||null,layout:n.layout,placement:nodePlacement(d,n),parent:n.parent,instance:n.instance,patterns:n.patterns,intent:n.intent||'',userGoals:n.goals||[],dataFlows:d.dataSources?.flows.filter(f=>f.card===n.id)||[],contentBricks:bricksOf(n)};
  put(`src/features/${n.slug}/surface-spec.ts`,header+`export const surfaceSpec = ${JSON.stringify(spec,null,2)} as const;\n`,n.id,'Owned declarative surface contract');
  if(['view','page'].includes(n.kind)){
   put(`src/presentation/components/${name(n)}Screen.vue`,header.replace('//','<!--').trim()+' -->\n'+`<template>\n  <section class="screen-${n.slug}" aria-label=${quote(n.label)}>\n    <h2>${esc(n.label)}</h2>\n    <p>Connect the ${esc(n.layout)} layout to typed application actions.</p>\n    <!-- Required states: empty, loading, error, populated. -->\n  </section>\n</template>\n`,n.id,'Presentation markup only');
   put(`src/presentation/composables/use${name(n)}Screen.ts`,header+`// Per-view state; dispose subscriptions on close.\nexport function use${name(n)}Screen() {\n  return { status: 'not-connected' as const };\n}\n`,n.id,'Per-instance presentation behavior');
   put(`src/styles/views/${n.slug}.css`,`/* CONCEPT: compose through the existing scoped style pipeline. */\n.screen-${n.slug} { min-width: 0; color: var(--text-normal); }\n`,n.id,'Scoped layout module');
  }
  if(n.kind==='modal')put(`src/features/${n.slug}/dialog-contract.ts`,header+`export type ${name(n)}Result = { kind: 'cancelled' } | { kind: 'submitted'; values: Record<string, unknown> };\n// Use the shared modal service. Validation belongs to the application.\n`,n.id,'Dialog outcome contract');
  if(n.kind==='settings')put(`src/features/${n.slug}/preference-fields.ts`,header+'// Declare actual fields, defaults and validators; use one queued settings writer.\nexport const preferenceFields = [] as const;\n',n.id,'Native settings intent');
  if(n.patterns.length||n.command||n.ribbon)put(`src/features/${n.slug}/actions.ts`,header+`// Your business logic: ${n.goal.replace(/[\r\n]/g,' ')||'define the use case before implementing it.'}\nexport function ${name(n)[0].toLowerCase()+name(n).slice(1)}Action(): never {\n  throw new Error('Business logic is not implemented');\n}\n// Entry points: ${n.command?'command ':''}${n.ribbon?'ribbon ':''}${n.patterns.join(', ')}\n// All entry points must call the same application action; availability is read-only.\n`,n.id,'Developer-owned business hook');
  put(`tests/features/${n.slug}.test.ts`,header+`import { describe, it } from 'vitest';\ndescribe(${quote(n.label)}, () => {\n  it.todo('implements the business result, not just registration');\n  it.todo('preserves data on error and supports cancellation');\n  it.todo('disposes owned resources and isolates multiple views');\n});\n`,n.id,'Unimplemented test obligations (not passing evidence)');
 }
 const registry=d.nodes.filter(n=>n.kind==='view').map(n=>({id:n.id,viewType:'<manifest-id>:'+n.slug,placement:n.placement,policy:n.instance}));
 put('src/bootstrap/view-outlines.ts',header+`// Proposed input to a shared host adapter; not an existing shell API.\nexport const viewOutlines = ${JSON.stringify(registry,null,2)} as const;\n`,'blueprint','Native view registrations only');
 put('src/bootstrap/navigation-outline.ts',header+`export const navigationOutline = ${JSON.stringify({pages:d.nodes.filter(n=>n.kind==='page'||n.kind==='group'),transitions:d.links},null,2)} as const;\n`,'blueprint','Internal screens and explicit transitions');
 put('docs/PLUGIN-BLUEPRINT.json',JSON.stringify({kind:'plugin-shell-blueprint',schema:1,executable:false,...generationSnapshot(d)},null,2),'blueprint','Portable data-only outline');
 const hooks=d.nodes.filter(n=>n.kind!=='group').map(n=>`| ${n.label.replace(/\|/g,'/')} | ${n.kind} | ${n.goal.replace(/[\r\n|]/g,' ')||'Describe the outcome and acceptance rule.'} |`).join('\n');
 put('docs/BUSINESS-LOGIC-HANDOFF.md',`# Business-logic handoff\n\nConcept only. No application build or test was executed.\n\n## Product goal\n${d.goal}\n\n| Surface | Type | Business decision still required |\n| --- | --- | --- |\n${hooks}\n\n## Never inferred\nUndeclared entities, authorization, formulas, business rules, persistence adapters, remote credentials, real test results. Declared entities and relationships feed schema previews, not a native data migration.\n\n## Requested patterns\n${d.nodes.flatMap(n=>n.patterns.map(id=>'- '+n.label+': '+PATTERNS.find(p=>p.id===id).name)).join('\n')}\n`,'blueprint','Developer work remaining');
 if(d.nodes.some(n=>bricksOf(n).length))put('docs/SCREEN-CONTENT-OUTLINE.md',contentOutlineMarkdown(d),'blueprint','Ordered content intent and explicit component mappings');
 return [...files,...productPlanFiles(d),...semanticFiles(d),...dataSourceFiles(d),...tdBoilerplateFiles(d),...sgFiles(d)];
}
function buildDesignPlan(d){
 const issues=designIssues(d);let files=[];try{files=designFiles(d);}catch{issues.push({level:'error',code:'preview-contract',message:'The outline contains a contract that cannot be previewed. Repair the design; no source has been changed.'});}if(files.some(f=>f.content.length>=100000)||new Set([...Object.keys(d.emitted),...files.map(f=>f.path)]).size>600)issues.push({level:'error',code:'preview-capacity',message:'This scaffold exceeds the concept’s saved-preview capacity (600 files; each below 100,000 characters). Export the blueprint and reduce the preview scope. Nothing was emitted.'});const changes=files.map(f=>{const before=d.emitted[f.path];return {...f,status:!before?'create':before.owner!==f.owner?'conflict':before.content===f.content?'unchanged':before.protected?'conflict':'update'};});
 for(const [path,old] of Object.entries(d.emitted))if(!files.some(f=>f.path===path))changes.push({path,owner:old.owner,content:old.content,role:'Previously scaffolded; preserve for explicit migration',status:'retain'});
 return {schema:1,owner:designOwner(),sourceRev:project()?.rev||0,revision:d.revision,fingerprint:designFingerprint(d),changes,issues,approved:false};
}
function reviewDesignPlan(){const d=design();designUi.plan=buildDesignPlan(d);designUi.file=0;designUi.error='';showModal('design-plan');}
function simulateDesignApply(){
 const plan=designUi.plan,d=design(),p=project();
 const fail=t=>{designUi.error=t;redrawModal();};
 if(!plan||plan.owner!==designOwner()||plan.sourceRev!==(p?.rev||0)||plan.fingerprint!==designFingerprint(d)||plan.revision!==d.revision)return fail('This plan is stale or belongs to another project. Close it and review the current outline.');
 if(state.activeRun)return fail('Finish the active run first.');
 if(!plan.approved)return fail('Review and explicitly approve this concept-only plan.');
 if(plan.issues.some(i=>i.level==='error')||plan.changes.some(f=>f.status==='conflict'))return fail('Resolve the blockers and conflicts before simulating generation.');
 const changes=plan.changes.filter(f=>['create','update'].includes(f.status));
 for(const f of changes)d.emitted[f.path]={owner:f.owner,content:f.content,protected:f.role.includes('business hook')};
 d.generatedRevision=d.revision;
 if(changes.length&&p)invalidateProject(p);
 const r=addRun('Sitemap → boilerplate','design','Proposed shared blueprint compiler — no CLI exists yet','succeeded');
 r.logs.push(`[concept] ${changes.length} source previews stored only in browser state.`, '[concept] No files were written and no checks executed. Business hooks and tests remain incomplete. Requirement status has not changed.');
 designUi.plan=null;save();closeModal();render();notify(changes.length?'Concept scaffolding recorded. Business logic is still yours to implement.':'Identical outline. No-op; source revision unchanged.');
}
function designPlanDialog(){
 const plan=designUi.plan;if(!plan)return dialogBody('No design plan','Review the current sitemap first.');
 const blockers=plan.issues.filter(i=>i.level==='error'),warnings=plan.issues.filter(i=>i.level==='warning');
 const counts={};plan.changes.forEach(f=>counts[f.status]=(counts[f.status]||0)+1);
 const f=plan.changes[designUi.file]||plan.changes[0];
 return dialogBody('Design → boilerplate plan',`<div class="callout"><div><strong>Concept compiler · not the current CLI</strong><p class="mb0">This previews ordinary source, registration intent and business hooks. No plugin is built, and no template maker is being claimed as implemented.</p></div></div><div class="plan-counts">${Object.entries(counts).map(([key,num])=>badge(num+' '+key,key==='conflict'?'bad':key==='create'?'good':'')).join('')} ${badge('Outline r'+plan.revision,'purple')}</div>${blockers.length?`<div class="callout bad"><div><strong>${blockers.length} blocking issue(s)</strong>${blockers.map(i=>`<p class="mb0">${esc(i.message)}</p>`).join('')}</div></div>`:''}${warnings.length?`<details class="card compact"><summary>${warnings.length} design warnings to review</summary>${warnings.map(i=>`<p>${esc(i.message)}</p>`).join('')}</details>`:''}${planFilterBar()}<div class="plan-files"><div class="file-nav" aria-label="Planned files">${planFilePicker()}</div><div class="file-code"><div class="row between"><strong>${esc(f?.role||'No output')}</strong>${badge('Preview only')}</div><pre tabindex="0">${esc(f?.content||'')}</pre></div></div><div class="callout warn"><div><strong>The developer still implements business logic.</strong><p class="mb0">Entity declarations are included when provided. Application actions, validation adapters, data access and assertions are not inferred. Test placeholders are not passing tests. Removed nodes retain existing source.</p></div></div><label class="check-label"><input type="checkbox" data-field="design-approve" ${plan.approved?'checked':''}> I reviewed the changes, warnings and incomplete business hooks.</label><p id="design-error" class="error" role="alert">${esc(designUi.error)}</p>`,button('Close','close','','ghost')+button('Export preview bundle','design-bundle','','','download')+(!project()&&design().generatedRevision===design().revision?button('Continue to setup','workflow-continue-setup','','','arrow'):'')+button('Simulate scaffolding','design-apply','','primary','wand',blockers.length||counts.conflict?'disabled':''));
}
