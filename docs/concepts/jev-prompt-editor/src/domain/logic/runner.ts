namespace Jev {
  export function startSimulation(flow: FlowDefinition, logic: LogicLibrary, prompts: Recipe[], scenario='clear'): Simulation {
    const shape=validateLogic(logic);if(shape.length)throw new Error(shape[0].path+': '+shape[0].message);
    const invalid=inspectFlow(flow,logic,prompts).find(i=>i.severity==='error');if(invalid)throw new Error(invalid.message);
    if(flow.status==='archived')throw new Error('Restore this archived flow before simulating it.');
    const input=parseJson(flow.sampleInput);if(!record(input))throw new Error('Expected an input object.');
    return {retainedCharacters:0,status:'paused',reason:'Ready to step through synthetic inputs.',runId:'run_'+fingerprint({flow,logic,prompts,scenario}),queue:[{nodeId:flow.nodes.find(n=>n.kind==='start')!.id,input:clone(input)}],trace:[],events:[],outputs:{},visits:{},iterations:{},input:clone(input),scenario};
  }
  function emitted(events: LogicEvent[], phases: string[], context: Record<string,unknown>, nodeId: string, run: Simulation, cause=''): EventEnvelope[] {
    return events.filter(e=>phases.includes(e.when)).map((event,i)=>{
      const payload=resolveBindings(event.payload,context);checkContract(event.fields,payload,'Event '+event.name);
      return {id:run.runId+'_e'+(run.events.length+i+1),name:event.name,source:nodeId,sequence:run.events.length+i+1,correlationId:run.runId,causationId:cause||run.runId+'_s'+(run.trace.length+1),payload};
    });
  }
  function finish(run: Simulation, flow: FlowDefinition): void {
    const when=run.status==='completed'?'completed':run.status==='review'?'review':run.status==='error'?'error':'';
    if(!when)return;
    try{
      const events=emitted(flow.events,[when],{input:run.input,output:{status:run.status,reason:run.reason,steps:run.trace.length},steps:run.outputs},flow.id,run);
      if(run.events.length+events.length>flow.maxEvents)throw new Error('Event budget exceeded by flow lifecycle events.');
      run.events.push(...events);
    }catch(error){run.status='error';run.reason='Flow event failed: '+(error as Error).message;}
    run.queue=[];
  }
  /** One deterministic task per step. No endpoint, disk, script, or external process is invoked. */
  export function stepSimulation(previous: Simulation, flow: FlowDefinition, logic: LogicLibrary, prompts: Recipe[], vault: VaultState): Simulation {
    const run=clone(previous);if(run.status!=='paused')return run;
    if(run.trace.length>=flow.maxSteps){run.status='review';run.reason='Global step limit reached. No further node was executed.';finish(run,flow);return run;}
    const pending=run.queue.shift();if(!pending){run.status='completed';run.reason='All scheduled work completed.';finish(run,flow);return run;}
    const node=flow.nodes.find(n=>n.id===pending.nodeId);
    if(!node){run.status='error';run.reason='Scheduled node is missing.';finish(run,flow);return run;}
    run.visits[node.id]=(run.visits[node.id]||0)+1;
    const environment={input:pending.input,initial:run.input,steps:run.outputs,event:pending.event||{},loop:{iteration:run.iterations[node.id]||0}};
    const entry:TraceEntry={sequence:run.trace.length+1,nodeId:node.id,name:node.name,kind:node.kind,port:'success',input:{},output:{},events:[],status:'completed',detail:'',conditions:[]};
    let halt: Simulation['status']|undefined;
    try{
      entry.input=node.inputs.length?resolveBindings(node.inputs,environment):clone(pending.input);
      const context={...environment,input:entry.input};
      if(node.kind==='start'){entry.output=clone(entry.input);entry.detail='Manual simulation trigger. No vault watcher is running.';}
      if(node.kind==='prompt'){
        const recipe=prompts.find(p=>p.id===node.refId);if(!recipe)throw new Error('Prompt reference is missing.');
        const request=compileRequest(recipe,compileSnapshot(recipe,vault));
        request.state={...request.state,workflow_input:clone(entry.input)};
        entry.request=request;
        entry.output={...validateResponse(recipe,fixtureResponse(recipe,run.scenario))};
        entry.detail='Synthetic '+run.scenario+' response. Prepared request is inspectable; nothing was sent to Jev.';
      }
      if(node.kind==='rule'){
        const rule=logic.rules.find(r=>r.id===node.refId);if(!rule)throw new Error('Rule reference is missing.');
        const result=evaluateRule(rule,entry.input,context,run.iterations[node.id]||0);
        run.iterations[node.id]=result.iteration;entry.port=result.port;entry.conditions=result.conditions;
        entry.output={decision:result.decision,iteration:result.iteration,evaluatedInput:clone(entry.input)};
        entry.detail=result.decision.code+' · '+result.decision.type;
        if(result.decision.type==='end')halt='completed';
        if(result.decision.type==='review'){entry.status='review';halt='review';}
      }
      if(node.kind==='process'){
        const process=logic.processes.find(p=>p.id===node.refId);if(!process)throw new Error('Process reference is missing.');
        checkContract(process.inputs,entry.input,'Process '+process.name+' input');
        if(process.mode==='external'){
          entry.output={requestedProcess:process.id,status:'requires_native_adapter'};entry.status='review';entry.port='review';
          entry.detail='External action requested, not executed. Native adapter and explicit approval are required.';halt='review';
        }else{
          entry.output=resolveBindings(process.mappings,context);checkContract(process.outputs,entry.output,'Process '+process.name+' output');
          entry.detail=process.mode==='fixture'?'Configured fixture output, not a real process result.':'Pure local data transformation.';
        }
      }
      if(node.kind==='end'){entry.output={decision:decision('end','completed')};entry.detail='Explicit End: remaining queued work will be cancelled.';halt='completed';}
      const phases=entry.status==='review'?['review']:['completed'];
      if(node.kind==='rule'&&entry.port!=='limit')phases.push(entry.port==='else'?'false':'true');
      entry.events=emitted(nodeEvents(node,logic,prompts),phases,{...context,output:entry.output},node.id,run,pending.event?.id);
      if(run.events.length+entry.events.length>flow.maxEvents)throw new Error('Event budget exceeded. Emissions from this step were not published.');
    }catch(error){
      entry.status='error';entry.port='error';entry.output={error:{code:'STEP_FAILED',message:(error as Error).message}};
      entry.detail=(error as Error).message;entry.events=[];
      try{entry.events=emitted(nodeEvents(node,logic,prompts),['error'],{...environment,input:entry.input,output:entry.output},node.id,run,pending.event?.id);}
      catch{entry.detail+=' Error-event payload also failed validation; no error event was published.';}
      if(run.events.length+entry.events.length>flow.maxEvents)entry.events=[];
      halt=undefined;
    }
    const retained=JSON.stringify(entry).length;
    if(run.retainedCharacters+retained>2_000_000){
      run.status='review';run.reason='Trace size limit reached. This step was not published; pending work was cancelled.';
      finish(run,flow);return run;
    }
    run.retainedCharacters+=retained;
    run.outputs[node.id]={output:clone(entry.output)};run.events.push(...entry.events);run.trace.push(entry);
    if(halt){run.status=halt;run.reason=entry.detail;finish(run,flow);return run;}
    const control=flow.edges.find(e=>e.kind==='control'&&e.source===node.id&&e.port===entry.port);
    if(control)run.queue.push({nodeId:control.target,input:clone(entry.output)});
    for(const event of entry.events){
      const definition=nodeEvents(node,logic,prompts).find(e=>e.name===event.name);
      for(const edge of flow.edges.filter(e=>e.kind==='event'&&e.source===node.id&&e.port===definition?.id))run.queue.push({nodeId:edge.target,input:clone(event.payload),event});
    }
    if(entry.status==='error'&&!control&&!entry.events.some(ev=>flow.edges.some(e=>e.source===node.id&&e.kind==='event'&&nodeEvents(node,logic,prompts).find(d=>d.id===e.port)?.name===ev.name))){run.status='error';run.reason=entry.detail;}
    else if(run.queue.length>200){run.status='review';run.reason='Queue limit reached. Pending work was cancelled.';}
    else if(!run.queue.length){run.status='completed';run.reason='All connected work completed.';}
    else run.reason='Next: '+(flow.nodes.find(n=>n.id===run.queue[0].nodeId)?.name||'unknown');
    finish(run,flow);return run;
  }
  export function runSimulation(flow:FlowDefinition,logic:LogicLibrary,prompts:Recipe[],vault:VaultState,scenario='clear'):Simulation {
    let run=startSimulation(flow,logic,prompts,scenario);
    for(let i=0;i<=flow.maxSteps&&run.status==='paused';i++)run=stepSimulation(run,flow,logic,prompts,vault);
    return run;
  }
}
