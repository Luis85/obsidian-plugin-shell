// Data-only design catalog. Availability describes the repository backend, not this UI.
const PLACEMENTS = {tab:'Main workspace',left:'Left sidebar',right:'Right sidebar',split:'Split pane',window:'Pop-out window'};
const NODE_KINDS = {view:'View container',page:'Internal screen',modal:'Dialog',settings:'Native settings',group:'Navigation group',action:'Action'};
const LAYOUTS = [
 ['sidebar-left','Left navigation shell','Navigation rail and a content region inside one view.','adaptive'],
 ['sidebar-right','Right inspector shell','Content with an internal right inspector.','wide'],
 ['three-pane','Three-pane workspace','Internal navigation, content and an inspector.','wide'],
 ['tabs','Tabbed workspace','Internal screens in a single native view.','adaptive'],
 ['split','Split content','Two coordinated content regions inside one view.','wide'],
 ['single','Single pane','One focused content area.','compact'],
 ['list-detail','List & detail','Browse a collection and inspect one item.','adaptive'],
 ['inspector','Context inspector','Read and edit the selected item.','compact'],
 ['dashboard','Dashboard','Summary tiles with an activity section.','wide'],
 ['table','Data table','Filter, sort and inspect records.','wide'],
 ['board','Board','Group work into status columns.','wide'],
 ['form','Form','Validated fields with deliberate submission.','compact'],
 ['wizard','Step-by-step','A staged task with a review step.','adaptive'],
 ['canvas','Canvas workspace','Tools, central canvas and contextual inspector.','wide']
].map(([id,name,description,width])=>({id,name,description,width}));
const BLUEPRINTS = [
 ['left-tool','Left sidebar utility','Quick access alongside the active note.','left','single',['open-view','settings']],
 ['right-inspector','Right sidebar inspector','A contextual companion to the active note.','right','inspector',['active-note','settings']],
 ['workspace','Workspace application','A main view with internal screen navigation.','tab','list-detail',['open-view','quick-capture','settings']],
 ['dual-view','Main view + inspector','Two independent native views with shared domain state.','tab','list-detail',['open-view','active-note','settings']],
 ['document-manager','Document manager','Collection, detail and capture flows around note-backed data.','tab','table',['note-crud','quick-capture','settings']],
 ['dashboard','Dashboard','Read-only overview with drill-down screens.','tab','dashboard',['open-view','vault-events','settings']],
 ['command-first','Command-first tool','Commands and a dialog; no persistent workspace view.','tab','form',['editor-command','quick-capture','settings']],
 ['blank','Blank outline','Start with only a product goal and add your own surfaces.','tab','single',[]]
].map(([id,name,description,placement,layout,patterns])=>({id,name,description,placement,layout,patterns}));
const PATTERNS = [
 ['open-view','Open or focus a view','Navigation','Command palette + optional ribbon','View descriptor, host adapter, focus/reuse tests','No private view references; placement is an initial preference.','next'],
 ['quick-capture','Capture with a form','Input','Command → dialog → reviewed write','Dialog, draft validation, commit action, cancellation tests','Business validation and entity mapping remain developer-owned.','next'],
 ['editor-command','Transform selected text','Editor','Editor command or editor menu','Editor adapter, availability predicate, action port, undo tests','Use Editor APIs for active text; do not write a stale whole file.','next'],
 ['file-menu','Act on a file','Navigation','File context menu + command fallback','TFile guard, menu registration, typed action and tests','Recheck the selected file at execution; no mutation during availability.','next'],
 ['suggest','Choose from suggestions','Input','Fuzzy picker or input suggestions','Suggestion provider, selection result, cancellation and focus tests','Bound result counts; input suggestions and modal suggestions differ.','next'],
 ['settings','Configure preferences','Foundation','Native settings tab','Validated settings model, queued persistence and localized labels','Use the qualified declarative API, not an untested host floor.','runtime'],
 ['note-crud','Manage note-backed records','Data','Create, update, list and reversible trash','Entity + document recipe + repository + real-service tests','Reuse the existing entity maker; never create a second schema database.','maker'],
 ['frontmatter','Update frontmatter','Data','Review → confirmed property update','FileManager adapter, mapping and preservation tests','Preserve body and unrelated properties; do not assume external atomicity.','next'],
 ['active-note','Follow the active note','Data','Workspace active-file change','Event adapter, null-file state, scoped subscription, inspector input','A view consumes domain state; it does not scan the whole vault per render.','next'],
 ['vault-events','React to file changes','Data','Vault + metadata lifecycle events','Bounded index/queue, event subscription and disposal tests','Avoid write loops and startup floods; debounce is not a correctness guarantee.','next'],
 ['notice','Report progress and outcomes','Foundation','Owned progress, notice and recovery','Existing notice/error service calls and declared diagnostics','No false success after failure; notifications have runtime owners.','runtime'],
 ['typed-events','Connect feature events','Foundation','Committed domain fact → subscribers','Typed catalog, subscription cleanup and failure observation tests','Direct calls request work; events report committed facts.','runtime'],
 ['code-block','Render a fenced block','Markdown','Registered code-block language','Processor + render child + parser + lifecycle fixtures','Input is data, never eval; disposal follows the rendered block.','advanced'],
 ['reading-view','Enhance Reading view','Markdown','Markdown post processor','Owned render child, semantic DOM and rendering tests','Not a substitute for Live Preview editor extensions.','advanced'],
 ['editor-extension','Enhance Live Preview','Editor','CodeMirror 6 extension','Extension, state/effects, decorations and viewport tests','Dedicated editor lifecycle and performance qualification required.','advanced'],
 ['inline-suggest','Suggest while typing','Editor','EditorSuggest trigger','Trigger bounds, suggestion provider and insertion transaction','No unconditional network requests on every keystroke.','advanced'],
 ['status-bar','Show compact status','Navigation','Desktop status item','Status renderer, shared action and cleanup tests','Desktop-only surface; supply an alternative entry point.','next'],
 ['protocol','Handle a deep link','Integration','Obsidian protocol handler','Strict input schema, route mapping and confirmation boundary','Links are untrusted input and never grant file/process authorization.','advanced'],
 ['file-view','Open a custom file type','Integration','Registered extension + TextFileView','File adapter, load/save, dirty-state and conflict tests','Separate recipe from ItemView; do not hijack Markdown extensions.','advanced'],
 ['bases','Add a Bases layout','Integration','Bases view registration','BasesView factory, data updates, options and host-gated tests','Not an ItemView or a second Markdown repository.','advanced'],
 ['http','Call an external service','Integration','Explicit sync action','Network adapter, consent, retries, redaction and offline states','Declare endpoints and policy; no telemetry or secret export.','advanced'],
 ['scheduled','Run owned periodic work','Integration','Lifecycle-owned interval','Scheduler port, cancellation, overlap guard and bounded queue','No silent writes at startup; clear intervals on unload.','advanced']
].map(([id,name,category,trigger,output,safety,status])=>({id,name,category,trigger,output,safety,status}));
const PATTERN_STATUS = {maker:'Existing maker · UI separate',runtime:'Existing runtime · recipe planned',next:'Proposed shared recipe',advanced:'Advanced · outline only'};
const DESIGN_LIMITS = {nodes:60,links:120,history:20,importBytes:900000};
const designCopy = value => JSON.parse(JSON.stringify(value));
function createDesign(blueprint='workspace') {
 const b=BLUEPRINTS.find(x=>x.id===blueprint)||BLUEPRINTS[2];
 const d={schema:1,revision:1,blueprint:b.id,goal:'Help people capture, organize and use their notes.',platform:'desktop',nodes:[],links:[],nextId:1,emitted:{},retired:[],history:[],future:[],generatedRevision:0};
 const add=(label,kind,layout='single',placement=b.placement,parent=null)=>{const n={id:'node-'+d.nextId++,slug:label.toLowerCase().replace(/[^a-z0-9]+/g,'-'),label,kind,layout,placement,parent,nav:kind==='page',command:kind==='view',ribbon:false,entry:false,instance:'reuse',patterns:[],goal:'',entity:''};d.nodes.push(n);return n;};
 if(b.id==='blank')return ensureProductModel(d);
 let main;
 if(b.id!=='command-first'){
  main=add(b.id==='right-inspector'?'Inspector':b.id==='left-tool'?'Navigator':'Workspace','view',b.layout);main.entry=true;main.ribbon=true;main.patterns=[b.id==='right-inspector'?'active-note':'open-view'];
  if(['workspace','document-manager','dual-view','dashboard'].includes(b.id)){
   const home=add(b.id==='dashboard'?'Overview':'Collection','page',b.layout,b.placement,main.id);
   const detail=add('Detail','page','inspector',b.placement,main.id);
   d.links.push({id:'edge-'+d.nextId++,from:home.id,to:detail.id,label:'Inspect selected item',kind:'navigate'});
  }
  if(b.id==='dual-view'){const i=add('Inspector','view','inspector','right');i.patterns=['active-note'];}
 }
 if(['workspace','document-manager','command-first'].includes(b.id)){
  const capture=add('Capture note','modal','form','tab');capture.command=true;capture.entry=!main;capture.patterns=['quick-capture'];
  if(main)d.links.push({id:'edge-'+d.nextId++,from:main.id,to:capture.id,label:'Capture note',kind:'open'});
 }
 const prefs=add('Preferences','settings','form','tab');prefs.patterns=['settings'];
 if(b.id==='document-manager')main.patterns.push('note-crud');
 return ensureProductModel(d);
}
