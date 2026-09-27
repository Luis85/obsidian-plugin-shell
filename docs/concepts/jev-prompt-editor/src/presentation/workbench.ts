declare const Vue: {
  reactive<T extends object>(value:T):T;
  computed<T>(getter:()=>T):{readonly value:T};
  watch<T>(source:()=>T, callback:(value:T,old:T|undefined)=>void, options?:{deep?:boolean;immediate?:boolean}):()=>void;
  nextTick(fn?:()=>void):Promise<void>;
  createApp(options:{setup:()=>Record<string,unknown>;render:Function}):{mount:(element:string)=>void};
};
namespace Jev {
  export function setupWorkbench(service: StudioService): Record<string, unknown> {
    const ui=Vue.reactive({
      library:clone(service.library),draft:clone(service.library.prompts.find(p=>p.status!=='archived')||service.library.prompts[0]),
      vault:demoVault(),area:'prompts',tab:'compose',search:'',folder:'all',openIndex:0,theme:'dark',
      modal:'',error:'',toast:'',saved:service.persistent?'Saved locally':'Memory only',sidebar:false,
      jsonMode:'recipe',exportMode:'recipe',consent:false,versionMessage:'',compareId:'',
      importText:'',candidate:undefined as Library|undefined,pendingVault:undefined as VaultState|undefined,
      scenario:'clear',response:undefined as ResponseBody|undefined,responseOrigin:'',responseStamp:'',
      responseText:'',responseConsent:false,pendingId:'',pendingRevision:undefined as Revision|undefined,
      tourStep:0,noteSearch:'',reading:false,filterTag:'',copyLabel:'Copy JSON',inspector:true,
    });
    let toastTimer=0,saveTimer=0; let previousFocus:HTMLElement|null=null;
    const errors=Vue.computed(()=>validateRecipe(ui.draft));
    const hints=Vue.computed(()=>lintQuestions(ui.draft));
    const snapshot=Vue.computed(()=>compileSnapshot(ui.draft,ui.vault));
    const activeNote=Vue.computed(()=>ui.vault.notes.find(n=>n.path===ui.vault.activePath));
    const revisions=Vue.computed(()=>ui.library.revisions[ui.draft.id]||[]);
    const filtered=Vue.computed(()=>ui.library.prompts.filter(p=>(ui.folder==='archived'?p.status==='archived':p.status!=='archived') && (ui.folder!=='ready'||p.status==='ready') && (p.name+' '+p.description+' '+p.tags.join(' ')).toLowerCase().includes(ui.search.toLowerCase())));
    const visibleNotes=Vue.computed(()=>ui.vault.notes.filter(n=>(n.path+' '+n.tags.join(' ')).toLowerCase().includes(ui.noteSearch.toLowerCase())));
    const stamp=()=>fingerprint({recipe:ui.draft,state:snapshot.value.state});
    const stale=Vue.computed(()=>!!ui.response && ui.responseStamp!==stamp());
    const decisions=Vue.computed(()=>ui.response&&!stale.value?evaluatePolicy(ui.draft,ui.response):[]);
    const jsonValue=()=>ui.jsonMode==='library'?{...clone(ui.library),prompts:ui.library.prompts.map(p=>p.id===ui.draft.id?clone(ui.draft):p)}:ui.jsonMode==='request'?compileRequest(ui.draft,snapshot.value):clone(ui.draft);
    const jsonText=Vue.computed(()=>{try{return JSON.stringify(jsonValue(),null,2);}catch(e){return '// '+(e as Error).message;}});
    const responseJson=Vue.computed(()=>ui.response?JSON.stringify(ui.response,null,2):'');
    const modelWarnings=Vue.computed(()=>ui.draft.model!=='jev-1.13.0'?['This alias can move to a different model. Record the resolved model with each run.']:[]);
    const changes=(revision:Revision):{path:string;before:string;after:string}[]=>{
      const rows:{path:string;before:string;after:string}[]=[];
      const walk=(a:unknown,b:unknown,path:string)=>{
        if (same(a,b)) return;
        if (record(a)&&record(b)) {for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],path?path+'.'+k:k);return;}
        rows.push({path,before:JSON.stringify(a)??'—',after:JSON.stringify(b)??'—'});
      };walk(revision.recipe,ui.draft,'');return rows;
    };
    function notify(text:string):void {ui.toast=text;window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>ui.toast='',4500);}
    function flush():boolean {
      window.clearTimeout(saveTimer);
      if(errors.value.length){ui.saved='Needs attention · not saved';return false;}
      try{service.save(ui.draft);ui.library=clone(service.library);ui.saved=service.persistent?'Saved locally':'Memory only';return true;}
      catch(e){ui.saved='Not saved';notify((e as Error).message);return false;}
    }
    function select(id:string,discard=false):void {
      if(id===ui.draft.id)return;
      if(!discard&&!flush()){ui.pendingId=id;openModal('discard');return;}
      window.clearTimeout(saveTimer);const recipe=service.library.prompts.find(p=>p.id===id);if(!recipe)return;
      ui.draft=clone(recipe);ui.openIndex=0;ui.response=undefined;ui.sidebar=false;ui.saved=service.persistent?'Saved locally':'Memory only';
    }
    function openModal(name:string):void {previousFocus=document.activeElement as HTMLElement|null;ui.error='';ui.consent=false;ui.modal=name;Vue.nextTick(()=>{document.querySelector<HTMLElement>('.modal [data-autofocus], .modal input, .modal textarea, .modal button')?.focus();});}
    function closeModal():void {ui.modal='';ui.error='';ui.candidate=undefined;ui.pendingVault=undefined;previousFocus?.focus();}
    function create(template:string):void {try{if(!flush())throw new Error('Save or repair the current recipe first.');const recipe=service.create(template);ui.library=clone(service.library);ui.draft=recipe;ui.sidebar=false;ui.tab='compose';ui.openIndex=0;ui.response=undefined;closeModal();notify('New recipe created.');}catch(e){ui.error=(e as Error).message;}}
    function duplicate():void {try{const r=service.duplicate(ui.draft);ui.library=clone(service.library);ui.draft=r;ui.response=undefined;notify('Independent copy created.');}catch(e){notify((e as Error).message);}}
    function addQuestion(type:QuestionType):void {if(ui.draft.questions.length>=24){ui.error='This editor supports up to 24 questions.';return;}let n=1;while(ui.draft.questions.some(q=>q.id==='decision_'+n))n++;ui.draft.questions.push(newQuestion(type,'decision_'+n));ui.openIndex=ui.draft.questions.length-1;closeModal();}
    function removeQuestion(index:number):void {if(ui.draft.questions.length<=1){notify('Keep at least one question.');return;}ui.draft.questions.splice(index,1);ui.openIndex=Math.max(0,index-1);}
    function moveQuestion(index:number,delta:number):void {const to=index+delta;if(to<0||to>=ui.draft.questions.length)return;const [q]=ui.draft.questions.splice(index,1);ui.draft.questions.splice(to,0,q);ui.openIndex=to;}
    function addOption(q:Question):void {if(q.options.length>=255)return;let n=q.options.length+1;while(q.options.some(o=>o.key==='option_'+n))n++;q.options.push({key:'option_'+n,description:''});}
    function setTags(event:Event):void {ui.draft.tags=(event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,12);}
    function setList(key:'fields'|'excludedFolders',event:Event):void {ui.draft.bindings[key]=(event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean);}
    function toggleReference(path:string):void {const i=ui.vault.references.indexOf(path);if(i<0)ui.vault.references.push(path);else ui.vault.references.splice(i,1);}
    async function importMarkdown(event:Event):Promise<void> {
      const input=event.target as HTMLInputElement;const files=Array.from(input.files||[]);input.value='';if(!files.length)return;ui.reading=true;
      try{const candidate=await readMarkdownFiles(files,ui.vault);ui.pendingVault=candidate;openModal('vault-import');}
      catch(e){notify((e as Error).message);}finally{ui.reading=false;}
    }
    function applyVault():void {if(!ui.pendingVault)return;ui.vault=ui.pendingVault;ui.response=undefined;ui.tab='state';closeModal();notify('Read-only snapshot loaded. Note bodies stay in memory.');}
    function resetVault():void {ui.vault=demoVault();ui.response=undefined;notify('Demo vault restored. Imported note content released from this view.');}
    function exportOpen(mode='recipe'):void {ui.exportMode=mode;openModal('export');}
    function exportFile():void {
      try{
        if(errors.value.length)throw new Error(errors.value[0].message);
        if(ui.exportMode==='request'&&!ui.consent)throw new Error('Review and acknowledge the included note content.');
        const name=slug(ui.draft.name);
        if(ui.exportMode==='request')downloadJson(name+'.request.json',compileRequest(ui.draft,snapshot.value));
        else if(ui.exportMode==='library'){if(!flush())throw new Error('Resolve saving errors before exporting the library.');downloadJson('jev-studio.library.json',service.library);}
        else downloadJson(name+'.prompt.json',ui.draft);
        closeModal();notify(ui.exportMode==='request'?'Resolved request exported. Nothing was sent to Jev.':'Portable JSON exported.');
      }catch(e){ui.error=(e as Error).message;}
    }
    async function copyJson():Promise<void> {
      if(ui.jsonMode==='request'){exportOpen('request');return;}
      try{await navigator.clipboard.writeText(jsonText.value);ui.copyLabel='Copied';window.setTimeout(()=>ui.copyLabel='Copy JSON',1800);}catch{notify('Clipboard unavailable. Select the JSON text or use Export.');}
    }
    function previewImport():void {try{ui.candidate=readLibrary(parseJson(ui.importText));if(ui.candidate.logic)throw new Error('This file contains linked business logic. Use Business logic → Import workspace JSON.');ui.error='';}catch(e){ui.candidate=undefined;ui.error=(e as Error).message;}}
    async function importJsonFile(event:Event):Promise<void> {const input=event.target as HTMLInputElement;const file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>2_000_000)throw new Error('JSON file exceeds 2 MB.');ui.importText=await file.text();await Vue.nextTick();previewImport();}catch(e){ui.error=(e as Error).message;}}
    function applyImport():void {try{if(!ui.candidate)return;if(!flush())throw new Error('Repair the current recipe before importing.');const id=service.importCopies(ui.candidate);ui.library=clone(service.library);ui.draft=clone(service.library.prompts.find(p=>p.id===id)!);ui.response=undefined;ui.tab='compose';ui.folder='all';ui.sidebar=false;closeModal();notify('Imported as independent copies. Existing prompts were preserved.');}catch(e){ui.error=(e as Error).message;}}
    function saveVersion():void {try{service.revision(ui.draft,ui.versionMessage);ui.library=clone(service.library);ui.versionMessage='';closeModal();notify('Immutable version saved.');}catch(e){ui.error=(e as Error).message;}}
    function askRestore(revision:Revision):void {ui.pendingRevision=clone(revision);openModal('restore');}
    function restoreVersion():void {if(!ui.pendingRevision)return;try{service.revision(ui.draft,'Automatic checkpoint before restoring a version');ui.library=clone(service.library);const restored=clone(ui.pendingRevision.recipe);restored.status='draft';service.save(restored);ui.library=clone(service.library);ui.draft=restored;ui.response=undefined;closeModal();notify('Restored into a new working draft. Previous state was checkpointed.');}catch(e){ui.error=(e as Error).message;}}
    function archive():void {const next=clone(ui.draft);next.status=next.status==='archived'?'draft':'archived';try{service.save(next);ui.library=clone(service.library);ui.draft=next;ui.folder=next.status==='archived'?'archived':'all';notify(next.status==='archived'?'Archived. It remains available in the archive.':'Restored to the prompt library.');}catch(e){notify((e as Error).message);}}
    function replay():void {try{if(errors.value.length)throw new Error(errors.value[0].message);compileRequest(ui.draft,snapshot.value);ui.response=validateResponse(ui.draft,fixtureResponse(ui.draft,ui.scenario));ui.responseOrigin='Synthetic fixture';ui.responseStamp=stamp();notify('Fixture replayed locally. No AI inference occurred.');}catch(e){notify((e as Error).message);}}
    function acceptResponse():void {try{if(!ui.responseConsent)throw new Error('Confirm which request this response belongs to.');ui.response=validateResponse(ui.draft,parseJson(ui.responseText));ui.responseOrigin='Imported response · provenance unverified';ui.responseStamp=stamp();closeModal();notify('Response shape validated. Review routing is computed locally.');}catch(e){ui.error=(e as Error).message;}}
    function exportEvidence():void {if(!ui.response||stale.value)return;downloadJson(slug(ui.draft.name)+'.policy-replay.json',{kind:'jev-studio-policy-replay',schemaVersion:1,origin:ui.responseOrigin,inferencePerformed:false,requestFingerprint:ui.responseStamp,fingerprintAlgorithm:'fnv1a-32-display-only',recipeId:ui.draft.id,policy:ui.draft.policy,response:ui.response,decisions:decisions.value});notify('Local policy evidence exported without note bodies.');}
    function nextTour():void {ui.tourStep++;if(ui.tourStep>3)closeModal();else ui.tab=['compose','state','lab','json'][ui.tourStep];}
    function tour():void {ui.tourStep=0;ui.tab='compose';openModal('help');}
    function setTheme():void {ui.theme=ui.theme==='dark'?'light':'dark';}
    Vue.watch(()=>ui.draft,()=>{ui.saved='Unsaved changes';window.clearTimeout(saveTimer);saveTimer=window.setTimeout(flush,500);},{deep:true});
    Vue.watch(()=>ui.importText,()=>ui.candidate=undefined);
    document.addEventListener('keydown',(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&ui.modal){event.preventDefault();closeModal();return;}
      if(ui.modal&&event.key==='Tab'){
        const elements=Array.from(document.querySelectorAll<HTMLElement>('.modal button:not([disabled]),.modal input:not([disabled]),.modal textarea,.modal select,.modal a[href]')).filter(e=>e.offsetParent!==null);
        const first=elements[0],last=elements[elements.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;
      }
      if((event.ctrlKey||event.metaKey)&&!event.altKey){
        if(event.key.toLowerCase()==='k'){event.preventDefault();ui.sidebar=true;Vue.nextTick(()=>document.querySelector<HTMLInputElement>('#library-search')?.focus());}
        if(event.key.toLowerCase()==='s'){event.preventDefault();openModal(ui.area==='logic'?'logic-checkpoint':'version');}
        if(event.key.toLowerCase()==='e'){event.preventDefault();if(ui.area==='logic')openModal('logic-export');else exportOpen();}
      }
    });
    window.addEventListener('beforeunload',event=>{if(!service.persistent||ui.saved==='Not saved'||ui.saved.includes('not saved')||ui.saved==='Unsaved changes'){event.preventDefault();}});
    const date=(s:string)=>new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
    const pretty=(value:unknown)=>JSON.stringify(value,null,2);
    const logicWorkbench=setupLogicWorkbench(service,{ui,flush,notify,openModal,closeModal});
    return {...logicWorkbench,ui,errors,hints,snapshot,activeNote,revisions,filtered,visibleNotes,stale,decisions,jsonText,responseJson,modelWarnings,changes,service,
      notify,flush,select,openModal,closeModal,create,duplicate,addQuestion,removeQuestion,moveQuestion,addOption,setTags,setList,toggleReference,importMarkdown,applyVault,resetVault,exportOpen,exportFile,copyJson,previewImport,importJsonFile,applyImport,saveVersion,askRestore,restoreVersion,archive,replay,acceptResponse,exportEvidence,nextTour,tour,setTheme,date,pretty};
  }
}
