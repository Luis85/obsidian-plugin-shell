namespace Jev {
  export interface LogicHost {
    ui: {library:Library;draft:Recipe;vault:VaultState;area:string;tab:string;sidebar:boolean;error:string;consent:boolean};
    flush:()=>boolean;notify:(text:string)=>void;openModal:(name:string)=>void;closeModal:()=>void;
  }
  export function setupLogicWorkbench(service:StudioService,host:LogicHost):Record<string,unknown> {
    const prompts=():Recipe[]=>host.ui.library.prompts.map(p=>p.id===host.ui.draft.id?host.ui.draft:p);
    const seeded=clone(service.library.logic||initialLogic(prompts()));
    const logic=Vue.reactive({doc:seeded,view:'flows',flowId:seeded.flows[0].id,ruleId:seeded.rules[0]?.id||'',processId:seeded.processes[0]?.id||'',nodeId:'route',edgeId:'',search:'',archive:false,
      zoom:0.65,panX:20,panY:40,addKind:'prompt' as FlowNode['kind'],connectionKind:'control' as FlowEdge['kind'],connectionPort:'success',connectionTarget:'',
      saved:service.library.logic?'Saved locally':'Examples · not yet saved',error:'',run:undefined as Simulation|undefined,runStamp:'',scenario:'clear',traceIndex:-1,showTrace:false,
      eventOwner:'',eventDraft:[] as LogicEvent[],eventIndex:0,checkpointName:'',restoreId:'',importText:'',candidate:undefined as Library|undefined,
      deleteTitle:'',deleteDetail:'',exportMode:'workspace',jsonScope:'workspace',guide:false,history:[] as LogicLibrary[],redo:[] as LogicLibrary[]});
    let canonical=clone(seeded),timer=0,suppress=false,remove:()=>void=()=>{};
    const nextId=():string=>'l_'+(typeof crypto.randomUUID==='function'?crypto.randomUUID().replace(/-/g,'').slice(0,16):Date.now().toString(36)+Math.random().toString(36).slice(2,9));
    const logicFlow=Vue.computed(()=>logic.doc.flows.find(f=>f.id===logic.flowId)||logic.doc.flows[0]);
    const logicRule=Vue.computed(()=>logic.doc.rules.find(r=>r.id===logic.ruleId));
    const logicProcess=Vue.computed(()=>logic.doc.processes.find(p=>p.id===logic.processId));
    const logicNode=Vue.computed(()=>logicFlow.value.nodes.find(n=>n.id===logic.nodeId));
    const logicShape=Vue.computed(()=>validateLogic(logic.doc));
    const logicIssues=Vue.computed(()=>logicShape.value.length?logicShape.value.map(e=>({...e,severity:'error' as const})):inspectFlow(logicFlow.value,logic.doc,prompts()));
    const logicBlocking=Vue.computed(()=>logicIssues.value.filter(e=>e.severity==='error'));
    const logicCurrent=Vue.computed(()=>logic.view==='rules'?logicRule.value:logic.view==='processes'?logicProcess.value:logicFlow.value);
    const logicItems=Vue.computed(()=>{const list:LogicEntity[]=logic.view==='rules'?logic.doc.rules:logic.view==='processes'?logic.doc.processes:logic.doc.flows;return list.filter(p=>(logic.archive?p.status==='archived':p.status!=='archived')&&(p.name+' '+p.description).toLowerCase().includes(logic.search.toLowerCase()));});
    const logicOwners=Vue.computed(()=>[
      ...prompts().map(p=>({key:'prompt:'+p.id,name:p.name,kind:'Prompt',events:p.events||[]})),
      ...logic.doc.rules.map(p=>({key:'rule:'+p.id,name:p.name,kind:'Rule',events:p.events})),
      ...logic.doc.processes.map(p=>({key:'process:'+p.id,name:p.name,kind:'Process',events:p.events})),
      ...logic.doc.flows.map(p=>({key:'flow:'+p.id,name:p.name,kind:'Flow',events:p.events})),
      ...logic.doc.flows.flatMap(f=>f.nodes.map(n=>({key:'node:'+f.id+':'+n.id,name:f.name+' / '+n.name,kind:'Node',events:n.events}))),
    ]);
    const logicOwner=Vue.computed(()=>logicOwners.value.find(o=>o.key===logic.eventOwner));
    const logicEventErrors=Vue.computed(()=>validateEvents(logic.eventDraft));
    const logicEventDirty=Vue.computed(()=>!!logicOwner.value&&!same(logic.eventDraft,logicOwner.value.events));
    const logicCatalog=Vue.computed(()=>logicOwners.value.flatMap(owner=>owner.events.map(event=>({...event,owner:owner.key,ownerName:owner.name,ownerKind:owner.kind,listeners:eventListeners(owner.key,event.id)}))));
    const runStamp=()=>fingerprint({flowId:logic.flowId,logic:logic.doc,prompts:prompts(),vault:host.ui.vault,scenario:logic.scenario});
    const logicStale=Vue.computed(()=>!!logic.run&&logic.runStamp!==runStamp());
    const logicTrace=Vue.computed(()=>logic.run?.trace[logic.traceIndex<0?(logic.run?.trace.length||1)-1:logic.traceIndex]);
    const logicPorts=Vue.computed(()=>logicNode.value?nodePorts(logicNode.value,logic.doc):[]);
    const logicEmissions=Vue.computed(()=>logicNode.value?nodeEvents(logicNode.value,logic.doc,prompts()):[]);
    const logicReferences=Vue.computed(()=>logicNode.value?.kind==='prompt'?prompts():logicNode.value?.kind==='rule'?logic.doc.rules:logic.doc.processes);
    const logicUsages=Vue.computed(()=>logicCurrent.value?definitionUsages(logic.doc,logic.view==='rules'?'rule':'process',logicCurrent.value.id):[]);
    const logicPaths=Vue.computed(()=>['input','initial','event.payload','output','loop.iteration',...prompts().flatMap(p=>p.questions.flatMap(q=>q.type==='noul'?['input.answers.'+q.id+'.noul']:['input.answers.'+q.id+'.'+(q.type==='choice'?'choice':'score'),'input.answers.'+q.id+'.confidence'])),...logicFlow.value.nodes.map(n=>'steps.'+n.id+'.output')]);
    const logicJson=Vue.computed(()=>JSON.stringify(logic.jsonScope==='item'?logicCurrent.value:{...clone(host.ui.library),schemaVersion:2,prompts:prompts(),logic:logic.doc},null,2));
    function sync():void {host.ui.library=clone(service.library);}
    function logicSave():boolean {
      window.clearTimeout(timer);
      if(logicShape.value.length){logic.saved='Needs attention · not saved';return false;}
      try{
        service.saveLogic(logic.doc);sync();
        if(!same(canonical,logic.doc)){logic.history.push(canonical);if(logic.history.length>40)logic.history.shift();logic.redo=[];canonical=clone(logic.doc);}
        logic.saved=service.persistent?'Saved locally':'Memory only';logic.error='';return true;
      }catch(e){logic.error=(e as Error).message;logic.saved='Not saved';return false;}
    }
    function replaceDoc(value:LogicLibrary):void {window.clearTimeout(timer);suppress=true;logic.doc=clone(value);canonical=clone(value);Vue.nextTick(()=>{suppress=false;});}
    function logicUndo(redo=false):void {
      if(!logicSave())return;
      const from=redo?logic.redo:logic.history,to=redo?logic.history:logic.redo;
      const candidate=from[from.length-1];if(!candidate)return;
      try{service.saveLogic(candidate);to.push(clone(logic.doc));from.pop();replaceDoc(candidate);sync();host.notify(redo?'Logic change reapplied.':'Logic change undone.');}catch(e){logic.error=(e as Error).message;}
    }
    function logicEnter():void {host.ui.area='logic';host.ui.sidebar=false;Vue.nextTick(logicFit);}
    function logicSwitch(view:string):void {logic.view=view;logic.search='';logic.archive=false;host.ui.sidebar=false;if(view==='events'&&!logic.eventOwner)logicOpenEvents('prompt:'+host.ui.draft.id);if(view==='flows')Vue.nextTick(logicFit);}
    function logicSelect(id:string):void {if(logic.view==='rules')logic.ruleId=id;else if(logic.view==='processes')logic.processId=id;else{logic.flowId=id;logic.nodeId='';logic.edgeId='';Vue.nextTick(logicFit);}host.ui.sidebar=false;}
    function logicCreate(kind=logic.view):void {
      const id=nextId();
      if(kind==='rules'){logic.doc.rules.push(freshRule(id));logic.ruleId=id;logic.view='rules';}
      else if(kind==='processes'){logic.doc.processes.push(freshProcess(id));logic.processId=id;logic.view='processes';}
      else{logic.doc.flows.push(freshFlow(id));logic.flowId=id;logic.view='flows';logic.nodeId='start';Vue.nextTick(logicFit);}
      host.ui.sidebar=false;logicSave();
    }
    function logicDuplicate():void {
      const item=logicCurrent.value;if(!item)return;const copy=clone(item);copy.id=nextId();copy.name=(copy.name+' · copy').slice(0,160);copy.status='draft';
      if(logic.view==='rules'){logic.doc.rules.push(copy as BusinessRule);logic.ruleId=copy.id;}
      else if(logic.view==='processes'){logic.doc.processes.push(copy as ProcessDefinition);logic.processId=copy.id;}
      else{logic.doc.flows.push(copy as FlowDefinition);logic.flowId=copy.id;}logicSave();host.notify('Independent definition created. Existing instances are unchanged.');
    }
    function logicAskDelete():void {
      const item=logicCurrent.value;if(!item)return;
      const used=logic.view==='rules'?definitionUsages(logic.doc,'rule',item.id):logic.view==='processes'?definitionUsages(logic.doc,'process',item.id):[];
      const decisions=logic.view==='processes'?logic.doc.rules.filter(r=>[...r.branches.map(b=>b.decision),r.fallback].some(d=>d.processId===item.id)):[];
      if(used.length||decisions.length){host.notify('Cannot delete: '+used.length+' flow instances and '+decisions.length+' rules still reference this definition.');return;}
      if(!['rules','processes'].includes(logic.view)&&logic.doc.flows.length===1){host.notify('Keep at least one flow.');return;}
      logic.deleteTitle='Delete '+item.name+'?';logic.deleteDetail='This removes the unused definition. Saved checkpoints and other items remain. Undo is available.';
      const collection=logic.view==='rules'?logic.doc.rules:logic.view==='processes'?logic.doc.processes:logic.doc.flows;
      remove=()=>{const i=collection.findIndex(p=>p.id===item.id);if(i>=0)collection.splice(i,1);logic.ruleId=logic.doc.rules[0]?.id||'';logic.processId=logic.doc.processes[0]?.id||'';logic.flowId=logic.doc.flows[0].id;};host.openModal('logic-delete');
    }
    function logicConfirmDelete():void {remove();logicSave();host.closeModal();}
    function logicArchive():void {const item=logicCurrent.value;if(!item)return;item.status=item.status==='archived'?'draft':'archived';logic.archive=item.status==='archived';logicSave();host.notify('Status updated. References remain visible; archived definitions cannot run.');}
    function logicAddNode():void {
      const kind=logic.addKind;const defs=kind==='prompt'?prompts():kind==='rule'?logic.doc.rules:logic.doc.processes;
      const definition=defs.find(p=>p.status!=='archived');
      if(kind!=='end'&&!definition){host.notify('Create an active '+kind+' definition first.');return;}
      const node=freshNode(kind,nextId(),kind==='end'?'':definition!.id,kind==='end'?'End':definition!.name);
      const last=logicNode.value;node.x=Math.min(11000,last?last.x+300:80+logicFlow.value.nodes.length*40);node.y=last?.y||120;
      logicFlow.value.nodes.push(node);logic.nodeId=node.id;logic.edgeId='';logicSave();Vue.nextTick(logicFit);
    }
    function logicRemoveNode():void {
      const node=logicNode.value;if(!node)return;if(node.kind==='start'){host.notify('Start is required.');return;}
      const flow=logicFlow.value,count=flow.edges.filter(e=>e.source===node.id||e.target===node.id).length;
      logic.deleteTitle='Remove '+node.name+'?';logic.deleteDetail='Remove this flow instance and '+count+' connections. Its reusable definition is preserved.';
      remove=()=>{flow.nodes=flow.nodes.filter(n=>n.id!==node.id);flow.edges=flow.edges.filter(e=>e.source!==node.id&&e.target!==node.id);logic.nodeId='';};host.openModal('logic-delete');
    }
    function logicConnect():void {
      const node=logicNode.value;if(!node||!logic.connectionTarget){host.notify('Select an output and destination first.');return;}
      if(node.kind==='end'){host.notify('End cannot have an outgoing connection.');return;}
      const edge={id:nextId(),source:node.id,target:logic.connectionTarget,port:logic.connectionPort,kind:logic.connectionKind};
      if(logicFlow.value.edges.some(e=>e.source===edge.source&&e.port===edge.port&&e.kind===edge.kind&&(edge.kind==='control'||e.target===edge.target))){host.notify('That output is already connected. Edit or remove its connection first.');return;}
      logicFlow.value.edges.push(edge);logic.edgeId=edge.id;logicSave();host.notify('Connection added. Data bindings are configured on the destination.');
    }
    function logicRemoveEdge(id:string):void {logicFlow.value.edges=logicFlow.value.edges.filter(e=>e.id!==id);logic.edgeId='';logicSave();}
    function logicSelectNode(id:string):void {logic.nodeId=id;logic.edgeId='';logic.connectionKind='control';logic.connectionPort=nodePorts(logicFlow.value.nodes.find(n=>n.id===id)!,logic.doc)[0]?.id||'success';}
    function logicEditDefinition():void {const n=logicNode.value;if(!n)return;if(n.kind==='prompt'){if(!host.flush())return;const p=service.library.prompts.find(p=>p.id===n.refId);if(p){host.ui.draft=clone(p);host.ui.area='prompts';host.ui.tab='compose';}}else if(n.kind==='rule'){logic.ruleId=n.refId;logicSwitch('rules');}else if(n.kind==='process'){logic.processId=n.refId;logicSwitch('processes');}}
    function logicAddBranch():void {if(!logicRule.value||logicRule.value.branches.length>=12)return;const branch=clone(freshRule().branches[0]);branch.id=nextId();branch.name='Else if';logicRule.value.branches.push(branch);}
    function logicAddCondition(branch:RuleBranch):void {if(branch.conditions.length<12)branch.conditions.push({id:nextId(),left:reference('input.value'),operator:'gte',right:literal(0.8)});}
    function logicMove<T>(rows:T[],index:number,offset:number):void {const target=index+offset;if(target<0||target>=rows.length)return;const [value]=rows.splice(index,1);rows.splice(target,0,value);}
    function logicAddField(fields:ContractField[],mappings?:NamedBinding[]):void {let n=1;while(fields.some(f=>f.name==='field_'+n))n++;const name='field_'+n;fields.push(field(name,'string'));if(mappings)mappings.push(binding(name,literal('')));}
    function logicRemoveField(fields:ContractField[],index:number,mappings?:NamedBinding[]):void {const name=fields[index].name;fields.splice(index,1);if(mappings){const i=mappings.findIndex(m=>m.name===name);if(i>=0)mappings.splice(i,1);}}
    function logicRenameField(fields:ContractField[],index:number,event:Event,mappings?:NamedBinding[]):void {const name=(event.target as HTMLInputElement).value,old=fields[index].name;fields[index].name=name;const m=mappings?.find(b=>b.name===old);if(m)m.name=name;}
    function logicAddBinding(rows:NamedBinding[]):void {let n=1;while(rows.some(r=>r.name==='field_'+n))n++;rows.push(binding('field_'+n,literal('')));}
    function logicFit():void {const stage=document.querySelector<HTMLElement>('.logic-stage');if(!stage)return;const b=graphBounds(logicFlow.value),size=stage.getBoundingClientRect();logic.zoom=Math.max(0.25,Math.min(1,(size.width-70)/b.width,(size.height-70)/b.height));logic.panX=Math.round((size.width-b.width*logic.zoom)/2-b.x*logic.zoom);logic.panY=Math.round((size.height-b.height*logic.zoom)/2-b.y*logic.zoom);}
    function logicZoom(delta:number):void {logic.zoom=Math.max(0.25,Math.min(1.5,logic.zoom+delta));}
    let drag:undefined|{id:string;x:number;y:number;initialX:number;initialY:number;pan:boolean};
    function logicPointerDown(event:PointerEvent,id=''):void {if(event.button!==0)return;const node=logicFlow.value.nodes.find(n=>n.id===id);if(id)logicSelectNode(id);drag={id,x:event.clientX,y:event.clientY,initialX:node?.x??logic.panX,initialY:node?.y??logic.panY,pan:!node};(event.currentTarget as Element).setPointerCapture(event.pointerId);}
    function logicPointerMove(event:PointerEvent):void {if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(drag.pan){logic.panX=drag.initialX+dx;logic.panY=drag.initialY+dy;}else{const node=logicFlow.value.nodes.find(n=>n.id===drag!.id);if(node){node.x=Math.max(-4000,Math.min(12000,Math.round(drag.initialX+dx/logic.zoom)));node.y=Math.max(-4000,Math.min(12000,Math.round(drag.initialY+dy/logic.zoom)));}}}
    function logicPointerUp():void {drag=undefined;}
    function logicNodeKey(event:KeyboardEvent,id:string):void {const node=logicFlow.value.nodes.find(n=>n.id===id);if(!node)return;const d=event.shiftKey?40:10;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();node.x=Math.max(-4000,Math.min(12000,node.x+(event.key==='ArrowLeft'?-d:event.key==='ArrowRight'?d:0)));node.y=Math.max(-4000,Math.min(12000,node.y+(event.key==='ArrowUp'?-d:event.key==='ArrowDown'?d:0)));}}
    function eventListeners(owner:string,id:string):number {const [kind,ref,nodeId]=owner.split(':');return logic.doc.flows.reduce((total,flow)=>total+flow.edges.filter(e=>{const n=flow.nodes.find(n=>n.id===e.source);return e.kind==='event'&&e.port===id&&(kind==='node'?flow.id===ref&&n?.id===nodeId:n?.kind===kind&&n.refId===ref);}).length,0);}
    function mutableOwner(key:string):{events:LogicEvent[]}|undefined {const [kind,id,node]=key.split(':');return kind==='rule'?logic.doc.rules.find(r=>r.id===id):kind==='process'?logic.doc.processes.find(r=>r.id===id):kind==='flow'?logic.doc.flows.find(r=>r.id===id):kind==='node'?logic.doc.flows.find(f=>f.id===id)?.nodes.find(n=>n.id===node):undefined;}
    function logicSaveEvents():boolean {
      if(logicEventErrors.value.length){logic.error=logicEventErrors.value[0].message;return false;}
      if(!logicOwner.value)return false;
      try{
        if(logic.eventOwner.startsWith('prompt:')){
          if(!host.flush())throw new Error('Repair the active prompt before saving event contracts.');
          const p=service.library.prompts.find(p=>'prompt:'+p.id===logic.eventOwner);if(!p)throw new Error('Prompt no longer exists.');
          const copy:Recipe={...clone(p),schemaVersion:2,events:clone(logic.eventDraft)};service.save(copy);sync();if(host.ui.draft.id===copy.id)host.ui.draft=clone(copy);
        }else{const owner=mutableOwner(logic.eventOwner);if(!owner)throw new Error('Event owner no longer exists.');owner.events=clone(logic.eventDraft);if(!logicSave())return false;}
        logic.error='';host.notify('Event contracts saved. No event was emitted.');return true;
      }catch(e){logic.error=(e as Error).message;return false;}
    }
    function logicOpenEvents(key:string):void {if(logicEventDirty.value&&!logicSaveEvents())return;logic.eventOwner=key;logic.eventDraft=clone(logicOwners.value.find(o=>o.key===key)?.events||[]);logic.eventIndex=0;logic.view='events';host.ui.area='logic';host.ui.sidebar=false;}
    function logicAddEvent():void {if(logic.eventDraft.length>=12)return;const event=freshEvent(nextId());event.name='item.event_'+(logic.eventDraft.length+1);logic.eventDraft.push(event);logic.eventIndex=logic.eventDraft.length-1;}
    function logicRemoveEvent(index:number):void {const event=logic.eventDraft[index];if(eventListeners(logic.eventOwner,event.id)){host.notify('Remove the event’s listener connections before deleting its contract.');return;}logic.eventDraft.splice(index,1);logic.eventIndex=Math.max(0,index-1);}
    function logicRun(step=false):void {
      if(logicEventDirty.value){host.notify('Save event contracts before simulating.');return;}
      try{
        if(!host.flush()||!logicSave())throw new Error('Repair unsaved edits before simulating.');
        if(!step||!logic.run||logic.run.status!=='paused'||logicStale.value){logic.run=startSimulation(logicFlow.value,logic.doc,prompts(),logic.scenario);logic.runStamp=runStamp();}
        if(step)logic.run=stepSimulation(logic.run!,logicFlow.value,logic.doc,prompts(),host.ui.vault);
        else logic.run=runSimulation(logicFlow.value,logic.doc,prompts(),host.ui.vault,logic.scenario);
        logic.traceIndex=-1;logic.showTrace=true;logic.error='';
      }catch(e){logic.error=(e as Error).message;logic.showTrace=true;}
    }
    function logicCancel():void {if(logic.run){logic.run.status='cancelled';logic.run.reason='Cancelled by the user.';logic.run.queue=[];}}
    function logicCheckpointSave():void {try{if(!logicSave())throw new Error('Repair the current logic first.');const next=logicCheckpoint(logic.doc,nextId(),logic.checkpointName,new Date().toISOString());service.saveLogic(next);replaceDoc(next);sync();logic.checkpointName='';host.closeModal();host.notify('Logic checkpoint saved. Prompt versions remain in the prompt workspace.');}catch(e){host.ui.error=(e as Error).message;}}
    function logicRestore():void {try{if(!logicSave())throw new Error('Repair the current logic first.');const next=restoreLogicCheckpoint(logic.doc,logic.restoreId,nextId(),new Date().toISOString());service.saveLogic(next);replaceDoc(next);sync();logic.flowId=next.flows[0].id;logic.ruleId=next.rules[0]?.id||'';logic.processId=next.processes[0]?.id||'';host.closeModal();host.notify('Restored. The previous logic was checkpointed first.');}catch(e){host.ui.error=(e as Error).message;}}
    function logicPreviewImport():void {try{logic.candidate=readLibrary(parseJson(logic.importText));if(!logic.candidate.logic)throw new Error('Use a version-2 workspace with business logic.');host.ui.error='';}catch(e){logic.candidate=undefined;host.ui.error=(e as Error).message;}}
    async function logicImportFile(event:Event):Promise<void> {const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>2_000_000)throw new Error('Choose a JSON file below 2 MB.');logic.importText=await file.text();await Vue.nextTick();logicPreviewImport();}catch(e){host.ui.error=(e as Error).message;}}
    function logicImport():void {try{if(!logic.candidate)return;if(!host.flush()||!logicSave())throw new Error('Repair the current workspace first.');const next=mergeLogicWorkspace(service.library,logic.candidate,nextId);service.replaceWorkspace(next);replaceDoc(next.logic!);sync();logic.flowId=next.logic!.flows[next.logic!.flows.length-1].id;logic.view='flows';host.closeModal();Vue.nextTick(logicFit);host.notify('Imported linked copies. Existing definitions, prompts, and history were preserved.');}catch(e){host.ui.error=(e as Error).message;}}
    function logicOpenExport(mode='workspace'):void {logic.exportMode=mode;host.openModal('logic-export');}
    function logicExport():void {try{
      if(logic.exportMode==='trace'){
        if(!logic.run||logicStale.value||!host.ui.consent)throw new Error('Review and acknowledge the current trace before exporting.');
        downloadJson(slug(logicFlow.value.name)+'.simulation.json',{kind:'jev-simulation',schemaVersion:1,inferencePerformed:false,externalProcessesExecuted:false,flowId:logicFlow.value.id,run:logic.run});
      }else{
        if(logicEventDirty.value&&!logicSaveEvents())throw new Error('Repair the event contracts first.');
        if(!host.flush()||!logicSave())throw new Error('Repair the current workspace first.');downloadJson('jev-studio.workspace.json',service.library);
      }
      host.closeModal();host.notify('JSON exported. No process or provider was invoked.');
    }catch(e){host.ui.error=(e as Error).message;}}
    function logicDiff(revision:LogicRevision):{id:string;name:string;kind:string;change:string}[] {
      const changes:{id:string;name:string;kind:string;change:string}[]=[];
      for(const kind of ['rules','processes','flows'] as const){
        const before:LogicEntity[]=revision.snapshot[kind],after:LogicEntity[]=logic.doc[kind];
        for(const item of after){const old=before.find(p=>p.id===item.id);if(!old||!same(old,item))changes.push({id:kind+item.id,name:item.name,kind,change:old?'changed':'added'});}
        for(const item of before)if(!after.some(p=>p.id===item.id))changes.push({id:kind+item.id,name:item.name,kind,change:'removed'});
      }
      return changes;
    }
    async function logicCopyJson():Promise<void> {try{await navigator.clipboard.writeText(logicJson.value);host.notify('Definition JSON copied.');}catch{host.notify('Clipboard unavailable. Select the JSON or export the workspace.');}}
    Vue.watch(()=>logic.doc,()=>{if(suppress)return;logic.saved='Unsaved changes';window.clearTimeout(timer);timer=window.setTimeout(()=>logicSave(),650);},{deep:true});
    Vue.watch(()=>logic.showTrace,()=>Vue.nextTick(logicFit));
    Vue.watch(()=>logic.importText,()=>{logic.candidate=undefined;});
    window.addEventListener('beforeunload',event=>{if(logicEventDirty.value||logic.saved==='Unsaved changes'||logic.saved.includes('not saved')||logic.saved==='Not saved')event.preventDefault();});
    return {logic,logicFlow,logicRule,logicProcess,logicNode,logicShape,logicIssues,logicBlocking,logicCurrent,logicItems,logicOwners,logicOwner,logicEventErrors,logicEventDirty,logicCatalog,logicStale,logicTrace,logicPorts,logicEmissions,logicReferences,logicUsages,logicPaths,logicJson,
      logicSave,logicUndo,logicEnter,logicSwitch,logicSelect,logicCreate,logicDuplicate,logicAskDelete,logicConfirmDelete,logicArchive,logicAddNode,logicRemoveNode,logicConnect,logicRemoveEdge,logicSelectNode,logicEditDefinition,logicAddBranch,logicAddCondition,logicMove,logicAddField,logicRemoveField,logicRenameField,logicAddBinding,logicFit,logicZoom,logicPointerDown,logicPointerMove,logicPointerUp,logicNodeKey,logicSaveEvents,logicOpenEvents,logicAddEvent,logicRemoveEvent,logicRun,logicCancel,logicCheckpointSave,logicRestore,logicPreviewImport,logicImportFile,logicImport,logicOpenExport,logicExport,
      logicDiff,logicCopyJson,graphEdgePath,graphEdgeLabel,nodePorts,nodeEvents,logicPrompts:Vue.computed(prompts)};
  }
}
