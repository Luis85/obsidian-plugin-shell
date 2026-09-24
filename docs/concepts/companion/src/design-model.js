// Pure validation/planning plus concept-only state adapters. No source or host I/O.
let designUi={selected:null,mode:'map',filter:'',category:'all',plan:null,file:0,error:'',undoMessage:'',form:null};
function design(){const p=project();if(!p)throw Error('Define this vault’s project before editing.');if(!p.design){p.design=createDesign('blank');p.design.goal='';}return ensureProductModel(p.design);}
function designOwner(){return project()?.key||'uninitialized-vault';}
function designSnapshot(d){return designCopy({blueprint:d.blueprint,goal:d.goal,platform:d.platform,nodes:d.nodes,links:d.links,nextId:d.nextId,library:d.library,prds:d.prds,...(d.librarySchema?{librarySchema:d.librarySchema}:{}),...(d.canvas?{canvas:d.canvas}:{}),...(d.semantic?{semantic:d.semantic}:{})});}
function recordDesign(){const d=design();d.history.push(designSnapshot(d));d.history=d.history.slice(-DESIGN_LIMITS.history);d.future=[];}
function designChanged(){const d=design();d.revision++;designUi.plan=null;designUi.error='';save();}
function designHistory(direction){const d=design(),before=designFingerprint(d);const stack=direction==='undo'?d.history:d.future;if(!stack.length)return;const other=direction==='undo'?d.future:d.history;other.push(designSnapshot(d));if(other.length>20)other.shift();const semanticCounter=d.semantic?.nextId||1;const nextId=d.nextId,snapshot=stack.pop();Object.assign(d,snapshot);if(!snapshot.semantic)d.semantic=emptySemantic();d.semantic.nextId=Math.max(semanticCounter,d.semantic.nextId);if(!snapshot.canvas)delete d.canvas;if(!snapshot.librarySchema)delete d.librarySchema;d.nextId=Math.max(nextId,d.nextId);if(before!==designFingerprint(d))designChanged();else save();render();notify((before!==designFingerprint(d)?'Outline ':'Map arrangement ')+direction+' complete. Generated source is never deleted.');}
function selectedNode(){if(!project())return null;const d=design();return d.nodes.find(n=>n.id===designUi.selected)||null;}
function nodeOwner(d,node){let n=node;const seen=new Set();while(n&&!seen.has(n.id)){seen.add(n.id);if(n.kind==='view')return n;n=d.nodes.find(x=>x.id===n.parent);}return null;}
function nodePlacement(d,n){return nodeOwner(d,n)?.placement||n.placement;}
function nodeDescendants(d,id){const found=new Set([id]);let previous=0;while(previous!==found.size){previous=found.size;for(const n of d.nodes)if(found.has(n.parent))found.add(n.id);}return found;}
function structuralDesign(value){
 if(!value||value.schema!==1||!Array.isArray(value.nodes)||value.nodes.length>DESIGN_LIMITS.nodes||!Array.isArray(value.links)||value.links.length>DESIGN_LIMITS.links)return false;
 if(typeof value.goal!=='string'||value.goal.length>1000||!['desktop','mobile-ready'].includes(value.platform)||!BLUEPRINTS.some(b=>b.id===value.blueprint))return false;
 const text=(x,max=120)=>typeof x==='string'&&x.length<=max;
 if(!value.nodes.every(n=>n&&text(n.id)&&text(n.slug)&&text(n.label)&&Object.hasOwn(NODE_KINDS,n.kind)&&LAYOUTS.some(l=>l.id===n.layout)&&Object.hasOwn(PLACEMENTS,n.placement)&&(n.parent===null||text(n.parent))&&['reuse','multiple'].includes(n.instance)&&['nav','command','ribbon','entry'].every(k=>typeof n[k]==='boolean')&&text(n.goal,1000)&&validIntentFields(n)&&validBricks(n)&&text(n.entity,80)&&Array.isArray(n.patterns)&&n.patterns.length<=PATTERNS.length&&n.patterns.every(p=>PATTERNS.some(x=>x.id===p))))return false;
 if(!value.links.every(e=>e&&text(e.id)&&e.id.length>0&&!e.id.startsWith('contains-')&&text(e.from)&&text(e.to)&&text(e.label)&&validLinkFields(e)))return false;
 return erShape(value.semantic)&&productShape(value)&&validCanvas(value.canvas)&&value.nodes.reduce((total,n)=>total+bricksOf(n).length,0)<=BRICK_LIMITS.total;
}
function designIssues(d){
 const issues=[...productIssues(d),...brickIssues(d),...semanticIssues(d)];const add=(level,code,message,node=null)=>issues.push({level,code,message,node});
 if(!structuralDesign(d)){add('error','schema','The blueprint schema is unsupported or malformed.');return issues;}
 if(!d.nodes.length)add('error','empty','Add a view, dialog or action before generating boilerplate.');
 if(!d.goal.trim())add('warning','goal','Describe the user problem to keep business logic in focus.');
 const ids=new Set(),slugs=new Set();
 for(const n of d.nodes){
  if(ids.has(n.id))add('error','duplicate-id','Node IDs must be unique.',n.id);ids.add(n.id);
  if(!safeSlug(n.slug)||n.slug.length>60||slugs.has(n.slug.toLowerCase()))add('error','slug','Use a unique portable code name: '+n.slug,n.id);slugs.add(n.slug.toLowerCase());
  if(!n.label.trim())add('error','label','A screen needs a visible name.',n.id);
  const parent=d.nodes.find(x=>x.id===n.parent);
  if(n.parent&&!parent)add('error','parent','The parent no longer exists.',n.id);
  if(parent&&nodeDescendants(d,n.id).has(parent.id))add('error','cycle','Containment must not contain a cycle.',n.id);
  if(n.kind==='page'&&!nodeOwner(d,n))add('error','page-owner','Internal screens must belong to a native view.',n.id);
  if(n.kind==='view'&&n.parent&&parent?.kind!=='group')add('error','nested-view','A native view is not embedded inside another view. Use an internal screen.',n.id);
  if(parent&&['modal','settings','action'].includes(parent.kind))add('error','invalid-parent','Dialogs, settings and actions cannot contain sitemap screens in this concept.',n.id);
  if(n.kind==='page'&&(n.command||n.ribbon))add('warning','page-entry','An internal-screen command must open its owning native view first.',n.id);
  if(n.kind==='group'&&(n.command||n.ribbon||n.entry||n.patterns.length))add('error','group-action','Navigation groups organize screens and do not register commands or actions.',n.id);
  if(n.ribbon&&!n.command)add('error','ribbon-fallback','Add a command fallback for the ribbon action.',n.id);
  if(n.kind==='action'&&!n.patterns.length)add('error','empty-action','Choose an action pattern.',n.id);
  if(n.kind==='modal'&&!['single','form','wizard'].includes(n.layout))add('error','modal-layout','Use a single, form or step-by-step layout for a dialog.',n.id);
  if(n.kind==='settings'&&n.layout!=='form')add('error','settings-layout','Native settings use their own form adapter, not a workspace layout.',n.id);
  if(['left','right'].includes(nodePlacement(d,n))&&LAYOUTS.find(l=>l.id===n.layout)?.width==='wide')add('warning','narrow-layout',n.label+': wide content must adapt to a narrow sidebar.',n.id);
  if(d.platform==='mobile-ready'&&(nodePlacement(d,n)==='window'||n.patterns.includes('status-bar')))add('error','desktop-surface','Pop-out windows and status items require a desktop alternative.',n.id);
  if(n.patterns.some(id=>PATTERNS.find(p=>p.id===id)?.status==='advanced'))add('warning','advanced',n.label+': advanced patterns are outline tasks, not generated host integrations.',n.id);
  if(n.patterns.includes('note-crud')&&!n.entity)add('warning','entity',n.label+': choose a real entity through the existing feature maker; no schema is inferred.',n.id);
 }
 const entries=d.nodes.filter(n=>n.entry);
 if(entries.length!==1)add('error','entry','Choose exactly one primary entry surface (view, dialog or action).');
 if(entries.some(n=>!['view','modal','action'].includes(n.kind)))add('error','entry-kind','Primary entry must be a native view, dialog or action.',entries[0]?.id);
 const edgeIds=new Set();
 for(const e of d.links){
  const a=d.nodes.find(n=>n.id===e.from),b=d.nodes.find(n=>n.id===e.to);
  if(edgeIds.has(e.id))add('error','duplicate-edge','Connection IDs must be unique.');edgeIds.add(e.id);
  if(!a||!b)add('error','broken-link','Connection '+e.label+' has a missing endpoint.');
  else if(a.kind==='group'||b.kind==='group')add('error','group-link','Connect screens or actions, not structural groups.');
  else if(!e.label.trim())add('error','link-label','Give each connection a meaningful action label.');
  else if(!allowedLinkKinds(b).includes(e.kind))add('error','link-kind','Connection type does not match its destination.');
  if(e.kind==='conditional'&&!e.condition?.trim())add('error','link-condition','Conditional connections need a condition.');
 }
 // Navigation cycles are allowed. Reachability is distinct from acyclic containment.
 const reachable=new Set(d.nodes.filter(n=>n.command||n.entry||n.kind==='settings').map(n=>n.id));
 let size=-1;while(size!==reachable.size){size=reachable.size;for(const n of d.nodes){const parent=d.nodes.find(x=>x.id===n.parent);if(parent&&reachable.has(parent.id)&&(n.nav||n.kind==='group'))reachable.add(n.id);}for(const e of d.links)if(e.kind!=='data'&&reachable.has(e.from))reachable.add(e.to);}
 for(const n of d.nodes)if(n.kind!=='group'&&!reachable.has(n.id))add('error','unreachable',n.label+' has no command, navigation item or reachable incoming connection.',n.id);
 return issues;
}
function designFingerprint(d){return JSON.stringify(generationSnapshot(d));}
function portableDesign(){const d=design();return {schema:1,...designSnapshot(d),kind:'plugin-shell-blueprint',executable:false};}
function importDesign(text){
 if(text.length>DESIGN_LIMITS.importBytes)throw Error('Blueprint exceeds the import limit.');
 const input=JSON.parse(text);if(!structuralDesign(input))throw Error('Expected a supported data-only blueprint. Unknown types and schemas are rejected.');
 const issues=designIssues(input).filter(i=>i.level==='error');if(issues.length)throw Error(issues[0].message);
 const allowed=new Set(['schema','blueprint','goal','platform','nodes','links','nextId','library','prds','librarySchema','kind','executable','canvas','semantic']);if(Object.keys(input).some(k=>!allowed.has(k)))throw Error('Unknown blueprint properties are not accepted.');const nextId=importCounter(input);const clean=ensureProductModel(designCopy(input));recordDesign();const d=design();Object.assign(d,{blueprint:clean.blueprint,goal:clean.goal,platform:clean.platform,nodes:clean.nodes,links:clean.links,library:clean.library,librarySchema:clean.librarySchema,prds:clean.prds,semantic:{...(clean.semantic||emptySemantic()),nextId:Math.max(d.semantic?.nextId||1,clean.semantic?.nextId||1)},canvas:clean.canvas||emptyCanvas(),nextId});designChanged();designUi.selected=d.nodes[0]?.id;return d;
}
function validSavedDesign(d){
 const plain=o=>o&&typeof o==='object'&&!Array.isArray(o);
 return structuralDesign(d)&&Number.isInteger(d.revision)&&d.revision>0&&Number.isSafeInteger(d.nextId)&&d.nextId>0&&d.nextId<Number.MAX_SAFE_INTEGER-100000&&plain(d.emitted)&&Object.keys(d.emitted).length<=600&&Object.values(d.emitted).every(f=>plain(f)&&typeof f.owner==='string'&&typeof f.content==='string'&&f.content.length<100000&&typeof f.protected==='boolean')&&Array.isArray(d.history)&&d.history.length<=20&&Array.isArray(d.future)&&d.future.length<=20&&[...d.history,...d.future].every(s=>structuralDesign({...s,schema:1}));
}

function importCounter(d){
 let max=0;
 for(const item of [...d.nodes,...d.links,...d.nodes.flatMap(bricksOf)]){
  const match=/^(?:node|edge|brick)-([0-9]+)$/.exec(item.id);if(!match)continue;
  const n=Number(match[1]);if(!Number.isSafeInteger(n)||n>=Number.MAX_SAFE_INTEGER-100000)throw Error('Blueprint IDs exceed the safe numeric range. Nothing was imported.');max=Math.max(max,n);
 }
 return max+1;
}
