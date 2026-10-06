namespace Jev {
  export function nodeDefinition(node: FlowNode, logic: LogicSnapshot, prompts: Recipe[]): LogicEntity | Recipe | undefined {
    if(node.kind==='prompt')return prompts.find(p=>p.id===node.refId);
    if(node.kind==='rule')return logic.rules.find(r=>r.id===node.refId);
    if(node.kind==='process')return logic.processes.find(p=>p.id===node.refId);
    return undefined;
  }
  export function nodeEvents(node: FlowNode, logic: LogicSnapshot, prompts: Recipe[]): LogicEvent[] {
    return [...(nodeDefinition(node,logic,prompts)?.events||[]),...node.events];
  }
  export function nodePorts(node: FlowNode, logic: LogicSnapshot): {id:string;name:string}[] {
    if(node.kind==='end')return [];
    if(node.kind==='rule') {
      const rule=logic.rules.find(r=>r.id===node.refId);
      return [...(rule?.branches.map(b=>({id:b.id,name:b.name}))||[]),{id:'else',name:rule?.mode==='while'?'Exit / else':'Else'},{id:'error',name:'Error'}];
    }
    return [{id:'success',name:'Completed'},{id:'error',name:'Error'}];
  }
  function controlCycles(flow: FlowDefinition): string[][] {
    let next=0;const indices=new Map<string,number>(),low=new Map<string,number>(),stack:string[]=[],onStack=new Set<string>(),cycles:string[][]=[];
    function visit(id:string):void {
      indices.set(id,next);low.set(id,next++);stack.push(id);onStack.add(id);
      for(const edge of flow.edges.filter(e=>e.kind==='control'&&e.source===id)) {
        if(!indices.has(edge.target)){visit(edge.target);low.set(id,Math.min(low.get(id)!,low.get(edge.target)!));}
        else if(onStack.has(edge.target))low.set(id,Math.min(low.get(id)!,indices.get(edge.target)!));
      }
      if(low.get(id)!==indices.get(id))return;
      const component:string[]=[];let member:string;
      do{member=stack.pop()!;onStack.delete(member);component.push(member);}while(member!==id);
      if(component.length>1||flow.edges.some(e=>e.kind==='control'&&e.source===id&&e.target===id))cycles.push(component);
    }
    flow.nodes.forEach(n=>{if(!indices.has(n.id))visit(n.id);});return cycles;
  }
  export function inspectFlow(flow: FlowDefinition, logic: LogicSnapshot, prompts: Recipe[]): LogicIssue[] {
    const issues:LogicIssue[]=[];
    const issue=(path:string,message:string,nodeId?:string,severity:LogicIssue['severity']='error')=>issues.push({path,message,nodeId,severity});
    for(const event of flow.events)if(['true','false'].includes(event.when))issue('events.'+event.id,'Flow lifecycle events support completed, review, or error only.');
    const starts=flow.nodes.filter(n=>n.kind==='start');
    if(starts.length!==1)issue('nodes','A flow needs exactly one Start.');
    try{if(!record(parseJson(flow.sampleInput)))issue('sampleInput','Simulation input must be a JSON object.');}catch(e){issue('sampleInput',(e as Error).message);}
    const controls=new Set<string>(),eventRoutes=new Set<string>();
    for(const edge of flow.edges) {
      const source=flow.nodes.find(n=>n.id===edge.source),target=flow.nodes.find(n=>n.id===edge.target);
      if(!source||!target){issue('edges.'+edge.id,'Connection names a missing node.');continue;}
      if(target.kind==='start')issue('edges.'+edge.id,'Start cannot be a destination.',target.id);
      if(source.kind==='end')issue('edges.'+edge.id,'End stops the entire run; it cannot dispatch another step.',source.id);
      if(edge.kind==='control') {
        if(!nodePorts(source,logic).some(p=>p.id===edge.port))issue('edges.'+edge.id,'Unknown control output '+edge.port,source.id);
        const key=edge.source+':'+edge.port;
        if(controls.has(key))issue('edges.'+edge.id,'A control output can have only one destination. Use an emitted event for explicit fan-out.',source.id);controls.add(key);
      }else {
        if(!nodeEvents(source,logic,prompts).some(e=>e.id===edge.port))issue('edges.'+edge.id,'This event is no longer declared by the source item.',source.id);
        const key=edge.source+':'+edge.port+':'+edge.target;
        if(eventRoutes.has(key))issue('edges.'+edge.id,'Duplicate event subscription.',source.id);
        eventRoutes.add(key);
      }
    }
    for(const node of flow.nodes) {
      const definition=nodeDefinition(node,logic,prompts);
      if(['prompt','rule','process'].includes(node.kind)&&!definition){issue('nodes.'+node.id,'Choose an existing '+node.kind+' definition.',node.id);continue;}
      if(definition?.status==='archived')issue('nodes.'+node.id,'The referenced definition is archived. Restore or replace it.',node.id);
      for(const event of nodeEvents(node,logic,prompts))if(node.kind!=='rule'&&['true','false'].includes(event.when))issue('events.'+event.id,'Only a rule can emit branch-matched or Else events.',node.id);
      for(const check of validateEvents(nodeEvents(node,logic,prompts)))issue(check.path,check.message,node.id);
      const hasCompletionEvent=flow.edges.some(e=>e.source===node.id&&e.kind==='event'&&nodeEvents(node,logic,prompts).some(ev=>ev.id===e.port&&ev.when==='completed'));
      if(['start','prompt','process'].includes(node.kind)&&!controls.has(node.id+':success')&&!hasCompletionEvent)issue('nodes.'+node.id,'Connect Completed or a completed event to a next step or End.',node.id);
      if(node.kind==='prompt'&&definition)for(const check of validateRecipe(definition))issue(check.path,check.message,node.id);
      const contract=node.kind==='rule'?logic.rules.find(r=>r.id===node.refId)?.inputs:node.kind==='process'?logic.processes.find(p=>p.id===node.refId)?.inputs:undefined;
      if(contract&&node.inputs.length) {
        for(const f of contract)if(f.required&&!node.inputs.some(b=>b.name===f.name))issue('nodes.'+node.id,'Bind required input '+f.name+'.',node.id);
        for(const b of node.inputs)if(!contract.some(f=>f.name===b.name))issue('nodes.'+node.id,'Input '+b.name+' is not declared by the contract.',node.id);
      }
      if(node.kind==='rule') {
        const rule=logic.rules.find(r=>r.id===node.refId)!;
        if(rule.mode==='while'&&rule.branches.length!==1)issue('rule.'+rule.id,'While supports exactly one condition branch plus Else.',node.id);
        for(const branch of [...rule.branches.map(b=>({id:b.id,decision:b.decision})),{id:'else',decision:rule.fallback}]) {
          const edge=flow.edges.find(e=>e.source===node.id&&e.kind==='control'&&e.port===branch.id);
          if(['end','review'].includes(branch.decision.type)&&edge)issue('edges.'+edge.id,'This decision terminates the run; remove its unreachable control connection.',node.id);
          if(['continue','process'].includes(branch.decision.type)&&!edge)issue('nodes.'+node.id,'Connect '+branch.id+' or change its decision to End / Review.',node.id);
          if(branch.decision.type==='process') {
            const target=flow.nodes.find(n=>n.id===edge?.target);
            if(!branch.decision.processId||target?.kind!=='process'||target.refId!==branch.decision.processId)issue('nodes.'+node.id,'Process decisions must connect to a node using the selected process.',node.id);
          }
        }
      }
      if(node.kind==='process') {
        const process=logic.processes.find(p=>p.id===node.refId)!;
        for(const f of process.outputs)if(f.required&&process.mode!=='external'&&!process.mappings.some(m=>m.name===f.name))issue('process.'+process.id,'Map required output '+f.name+'.',node.id);
        for(const m of process.mappings)if(!process.outputs.some(f=>f.name===m.name))issue('process.'+process.id,'Undeclared output '+m.name+'.',node.id);
        if(process.mode==='external')issue('process.'+process.id,'External process: the simulator stops for review and performs no side effect.',node.id,'warning');
      }
      for(const e of nodeEvents(node,logic,prompts))if(!flow.edges.some(edge=>edge.kind==='event'&&edge.source===node.id&&edge.port===e.id))issue('events.'+e.id,'Event '+e.name+' is observable only; no listener in this flow.',node.id,'warning');
    }
    // Every cycle must traverse a bounded While, not merely share a component with one.
    const bounded=new Set(flow.nodes.filter(n=>n.kind==='rule'&&logic.rules.find(r=>r.id===n.refId)?.mode==='while').map(n=>n.id));
    const unbounded={...flow,nodes:flow.nodes.filter(n=>!bounded.has(n.id)),edges:flow.edges.filter(e=>!bounded.has(e.source)&&!bounded.has(e.target))};
    for(const cycle of controlCycles(unbounded))issue('edges','Control cycle without an explicit bounded While: '+cycle.join(' → '));
    if(starts[0]){
      const reached=new Set<string>();const queue=[starts[0].id];
      while(queue.length){const id=queue.shift()!;if(reached.has(id))continue;reached.add(id);for(const e of flow.edges.filter(e=>e.source===id))queue.push(e.target);}
      for(const node of flow.nodes)if(!reached.has(node.id))issue('nodes.'+node.id,'Unreachable from Start.',node.id,'warning');
    }
    return issues;
  }
  export function definitionUsages(logic: LogicSnapshot, kind: FlowNode['kind'], id: string): {flow:string;node:string}[] {
    return logic.flows.flatMap(f=>f.nodes.filter(n=>n.kind===kind&&n.refId===id).map(n=>({flow:f.name,node:n.name})));
  }
}
