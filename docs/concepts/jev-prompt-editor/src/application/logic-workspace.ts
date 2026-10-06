namespace Jev {
  /** Remap definition identities, not arbitrary user strings. Preserve all existing work. */
  export function mergeLogicWorkspace(current: Library, imported: Library, nextId: () => string): Library {
    const source=readLibrary(imported),target=clone(current);
    if(!source.logic)throw new Error('This file has no business logic. Use prompt import for a recipe-only library.');
    const promptIds=new Map<string,string>(),ruleIds=new Map<string,string>(),processIds=new Map<string,string>(),flowIds=new Map<string,string>();
    source.prompts.forEach(p=>promptIds.set(p.id,nextId()));
    // Allocate each identity once across live definitions and historical snapshots.
    for(const snapshot of [source.logic,...source.logic.revisions.map(r=>r.snapshot)]) {
      for(const rule of snapshot.rules)if(!ruleIds.has(rule.id))ruleIds.set(rule.id,nextId());
      for(const process of snapshot.processes)if(!processIds.has(process.id))processIds.set(process.id,nextId());
      for(const flow of snapshot.flows)if(!flowIds.has(flow.id))flowIds.set(flow.id,nextId());
    }
    const renamePrompt=(p:Recipe):Recipe=>({...clone(p),id:promptIds.get(p.id)!,name:(p.name+' · imported').slice(0,160)});
    target.prompts.push(...source.prompts.map(renamePrompt));
    for(const [id,revisions]of Object.entries(source.revisions))target.revisions[promptIds.get(id)!]=revisions.map(r=>({...clone(r),id:nextId(),recipe:renamePrompt(r.recipe)}));
    const remap=(snapshot:LogicSnapshot):LogicSnapshot=>{
      const copy=clone(snapshot);
      const remapDecision=(d:RuleDecision)=>{if(d.processId&&processIds.has(d.processId))d.processId=processIds.get(d.processId)!;};
      for(const rule of copy.rules){rule.id=ruleIds.get(rule.id)||nextId();rule.name=(rule.name+' · imported').slice(0,160);rule.branches.forEach(b=>remapDecision(b.decision));remapDecision(rule.fallback);}
      for(const process of copy.processes){process.id=processIds.get(process.id)||nextId();process.name=(process.name+' · imported').slice(0,160);}
      for(const flow of copy.flows){flow.id=flowIds.get(flow.id)||nextId();flow.name=(flow.name+' · imported').slice(0,160);for(const node of flow.nodes){const map=node.kind==='prompt'?promptIds:node.kind==='rule'?ruleIds:processIds;if(['prompt','rule','process'].includes(node.kind))node.refId=map.get(node.refId)||node.refId;}}
      return copy;
    };
    const logic:LogicLibrary=target.logic||{kind:'jev-logic',schemaVersion:1,rules:[],processes:[],flows:[],revisions:[]};
    const copied=remap(source.logic);
    logic.rules.push(...copied.rules);logic.processes.push(...copied.processes);logic.flows.push(...copied.flows);
    for(const revision of source.logic.revisions)logic.revisions.push({...clone(revision),id:nextId(),snapshot:remap(revision.snapshot)});
    target.logic=logic;target.schemaVersion=2;return readLibrary(target);
  }
  export function logicCheckpoint(library: LogicLibrary, id: string, name: string, createdAt: string): LogicLibrary {
    if(library.revisions.length>=20)throw new Error('20 checkpoints are retained. Export a workspace backup before removing an older checkpoint.');
    const copy=clone(library);const {rules,processes,flows}=clone(library);
    copy.revisions.unshift({id,name:name.trim()||'Logic checkpoint',createdAt,snapshot:{rules,processes,flows}});return readLogic(copy);
  }
  export function restoreLogicCheckpoint(library: LogicLibrary, revisionId: string, id: string, createdAt: string): LogicLibrary {
    const revision=library.revisions.find(r=>r.id===revisionId);if(!revision)throw new Error('Checkpoint is missing.');
    const copy=logicCheckpoint(library,id,'Before restoring '+revision.name,createdAt);
    return {...copy,...clone(revision.snapshot)};
  }
}
