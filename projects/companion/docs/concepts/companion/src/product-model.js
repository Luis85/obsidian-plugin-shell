// Local concept data only. Production PRDs are Markdown; components are source-backed.
const productUi={tab:'document',prd:null,component:null,story:'default',filter:'',form:null,error:'',returnTo:null};
function defaultLibrary(){return [
 ['record-card','RecordCard','Data display','record','A selectable summary of a note-backed record.','title:string\nselected:boolean','select:string','actions','default, selected','Name the selection target; do not rely on color.'],
 ['capture-form','CaptureForm','Forms','form','Validated capture with separate submit and cancel outcomes.','title:string\nbusy:boolean','submit:string\ncancel:void','footer','default, compact','Associate errors with fields; preserve drafts on failure.'],
 ['empty-state','EmptyState','Feedback','empty','Explain an empty collection and offer its next action.','title:string\ndescription:string','create:void','illustration','default, compact','Use a meaningful heading and a named primary action.'],
 ['filter-toolbar','FilterToolbar','Navigation','toolbar','Search and filter a collection without losing context.','query:string\ncount:number','search:string\nclear:void','actions','default, compact','Label search; announce result counts without stealing focus.'],
 ['status-notice','StatusNotice','Feedback','notice','A scoped status or recoverable error.','message:string\nbusy:boolean','retry:void','details','info, success, error','Use polite announcements; only blocking failures use alert.'],
 ['property-editor','PropertyEditor','Forms','form','Edit declared fields through a typed application action.','label:string\nvalue:string','change:string\ncancel:void','help','default, readonly','Label inputs and expose both validation and cancellation.']
 ].map(([id,name,category,preview,description,props,events,slots,variants,a11y])=>({id,name,category,preview,description,props,events,slots,variants,a11y,version:'1.0.0',revision:1,status:'ready',origin:'starter',replacement:'',tokens:'--text-normal\n--background-primary\n--interactive-accent'}));}
function ensureProductModel(d){if(!d.library)d.library=defaultLibrary();if(!d.prds)d.prds=[];for(const n of d.nodes)if(!n.components)n.components=[];return ensureBrickLibrary(d);}
function selectedPrd(){return design().prds.find(p=>p.id===productUi.prd)||design().prds[0]||null;}
function selectedComponent(){return design().library.find(c=>c.id===productUi.component)||design().library[0]||null;}
function allRequirements(d=design()){return (d.prds||[]).flatMap(p=>p.requirements.map(r=>({...r,prdId:p.id,prdTitle:p.title})));}
function componentUses(id,d=design()){return [...d.nodes.flatMap(n=>(n.components||[]).filter(b=>b.id===id).map(b=>({node:n,binding:b}))),...libraryBrickRefs(d,id).map(({node,brick})=>({node,brick,binding:{id,version:brick.version,slot:brick.region}}))];}
function requirementUses(id,d=design()){return allRequirements(d).filter(r=>r.components.includes(id));}
function componentSlots(n){return ['canvas','three-pane','sidebar-right'].includes(n.layout)?['content','toolbar','inspector']:['list-detail','split'].includes(n.layout)?['content','toolbar','detail']:n.layout==='inspector'?['content','header','footer']:['content','header','footer'];}
function parseMembers(text,kind){
 if(!text.trim())return [];
 const rows=text.split('\n').map(s=>s.trim()).filter(Boolean);if(rows.length>16)throw Error('Use at most 16 '+kind+'.');
 const names=new Set();return rows.map(row=>{const m=row.match(/^([a-z][a-zA-Z0-9]*)(\?)?:(string|number|boolean|void)$/);if(!m||names.has(m[1])||(kind==='props'&&m[3]==='void'))throw Error('Use unique name:type entries; types: string, number, boolean'+(kind==='events'?', void':'')+'.');names.add(m[1]);return {name:m[1],optional:!!m[2],type:m[3]};});
}
function productShape(d){
 if(d.librarySchema!==undefined&&![2,3].includes(d.librarySchema))return false;
 const text=(v,max=4000)=>typeof v==='string'&&v.length<=max;
 const refs=v=>Array.isArray(v)&&v.length<=120&&v.every(s=>text(s,100));
 const comp=c=>c&&validVariantSpecs(c)&&['id','name','category','preview','description','props','events','slots','variants','a11y','version','status','origin','replacement','tokens'].every(k=>text(c[k]))&&Number.isInteger(c.revision)&&c.revision>0&&['draft','ready','deprecated'].includes(c.status)&&['starter','project'].includes(c.origin)&&['record','form','empty','toolbar','notice','brick'].includes(c.preview)&&validComponentTags(c.tags)&&(c.contentSpec===undefined||validContentSpec(c.contentSpec))&&(c.preview!=='brick'||!!c.contentSpec);
 const req=r=>r&&['id','title','priority','status','acceptance','kind'].every(k=>text(r[k]))&&['must','should','could','wont'].includes(r.priority)&&['draft','designed','implemented','tested','done','deferred'].includes(r.status)&&['functional','quality','constraint'].includes(r.kind)&&refs(r.nodes)&&refs(r.components)&&refs(r.patterns);
 const prd=p=>p&&['id','title','version','status','problem','audience','goals','nonGoals','notes'].every(k=>text(p[k],12000))&&Number.isInteger(p.revision)&&p.revision>0&&Number.isInteger(p.nextReq)&&p.nextReq>0&&['draft','review','approved','archived'].includes(p.status)&&Array.isArray(p.requirements)&&p.requirements.length<=80&&p.requirements.every(req)&&Array.isArray(p.baselines)&&p.baselines.length<=10&&p.baselines.every(b=>b&&Number.isInteger(b.revision)&&text(b.markdown,100000)&&text(b.label,120));
 if(d.library!==undefined&&(!Array.isArray(d.library)||d.library.length>LIBRARY_LIMIT||!d.library.every(comp)))return false;
 if(d.prds!==undefined&&(!Array.isArray(d.prds)||d.prds.length>12||!d.prds.every(prd)))return false;
 return d.nodes.every(n=>n.components===undefined||Array.isArray(n.components)&&n.components.length<=20&&n.components.every(b=>b&&text(b.id,100)&&text(b.version,30)&&text(b.slot,40)));
}
function productIssues(d){
 const out=[];const add=(level,code,message,node=null)=>out.push({level,code,message,node});if(!productShape(d)){add('error','product-schema','PRD or component data is malformed or exceeds the concept limits.');return out;}
 const library=d.library||[],prds=d.prds||[],ids=new Set(),names=new Set();
 for(const c of library){if(ids.has(c.id)||!safeSlug(c.id)||c.id.length>60||names.has(c.name)||!/^[A-Z][A-Za-z0-9]*$/.test(c.name))add('error','component-name','Components need unique portable IDs and PascalCase names.');ids.add(c.id);names.add(c.name);try{parseMembers(c.props,'props');parseMembers(c.events,'events');}catch(e){add('error','component-contract',c.name+': '+e.message);}if(!/^\d+\.\d+\.\d+$/.test(c.version))add('error','component-version','Use an explicit x.y.z component version.');if(c.replacement&&!library.some(x=>x.id===c.replacement&&x.id!==c.id))add('error','component-replacement',c.name+': replacement is missing or self-referencing.');}
 for(const n of d.nodes)for(const b of n.components||[]){const c=library.find(c=>c.id===b.id);if(!c)add('error','component-missing',n.label+': referenced component is missing.',n.id);else{if(c.version!==b.version)add('error','component-drift',n.label+': review '+c.name+' '+b.version+' → '+c.version+' before generating.',n.id);if(c.status==='deprecated')add('warning','component-deprecated',n.label+': '+c.name+' is deprecated; choose a replacement.',n.id);if(c.status==='draft')add('warning','component-draft',n.label+': '+c.name+' still needs a contract review.',n.id);}if(!componentSlots(n).includes(b.slot)||!['view','page','modal'].includes(n.kind))add('error','component-slot',n.label+': invalid component region or surface.',n.id);}
 const prdIds=new Set(),reqIds=new Set();
 if(!prds.length)add('warning','prd-missing','No PRD is linked yet. Record the problem and acceptance criteria before business implementation.');
 for(const p of prds){if(prdIds.has(p.id)||!safeSlug(p.id))add('error','prd-id','PRD IDs must be unique and portable.');prdIds.add(p.id);if(p.status==='archived')continue;for(const r of p.requirements){if(reqIds.has(r.id))add('error','requirement-id','Requirement IDs must be unique across project PRDs.');reqIds.add(r.id);for(const id of r.nodes)if(!d.nodes.some(n=>n.id===id))add('error','requirement-node',r.id+': linked surface was removed. Relink the requirement explicitly.');for(const id of r.components)if(!library.some(c=>c.id===id))add('error','requirement-component',r.id+': linked component is missing.');for(const id of r.patterns)if(!PATTERNS.some(x=>x.id===id))add('error','requirement-pattern',r.id+': unknown action pattern.');if(r.priority==='must'&&r.status!=='deferred'&&!r.acceptance.trim())add('warning','acceptance-missing',r.id+': write a verifiable acceptance criterion.');if(r.priority==='must'&&r.kind==='functional'&&r.status!=='deferred'&&!r.nodes.length&&!r.patterns.length)add('warning','requirement-unmapped',r.id+': no surface or action realizes this requirement.');}}
 return out;
}
function newPrd(template='lean'){
 const d=design();let seq=1;while(d.prds.some(p=>p.id==='prd-'+seq))seq++;const id='prd-'+seq;
 return {id,title:template==='feature'?'Feature requirements':'Plugin product requirements',version:'0.1.0',revision:1,status:'draft',problem:template==='feature'?'':d.goal,audience:'Obsidian users',goals:'',nonGoals:'No business rules are inferred by the boilerplate generator.',notes:'',nextReq:1,requirements:[],baselines:[]};
}
function prdMarkdown(p){
 const q=v=>JSON.stringify(v);const fm={type:'plugin-prd',schema_version:1,prd_id:p.id,project_id:project()?.id||'unattached-draft',title:p.title,status:p.status,version:p.version,revision:p.revision};
 return '---\n'+Object.entries(fm).map(([k,v])=>k+': '+q(v)).join('\n')+'\n---\n\n# '+p.title+'\n\n> Concept export. Status is a design record, not test evidence.\n\n## Problem\n'+p.problem+'\n\n## Audience\n'+p.audience+'\n\n## Goals\n'+p.goals+'\n\n## Non-goals\n'+p.nonGoals+'\n\n## Requirements\n'+p.requirements.map(r=>'\n### '+r.id+' — '+r.title+'\n\nPriority: '+r.priority+' · State: '+r.status+' · Kind: '+r.kind+'\n\nAcceptance: '+r.acceptance+'\n\nSurfaces: '+(r.nodes.join(', ')||'Unmapped')+'\nComponents: '+(r.components.join(', ')||'None')+'\nPatterns: '+(r.patterns.join(', ')||'None')+'\n').join('')+'\n## Author notes\n'+p.notes+'\n';
}
function touchPrd(p){p.revision++;if(p.status==='approved')p.status='draft';designChanged();}
function safeProductCandidate(fn){const clone=designCopy(design());fn(clone);if(!productShape(clone))throw Error('The data exceeds supported limits or is malformed.');return clone;}
