namespace Jev {
  export function freshEvent(id='event_1'): LogicEvent {
    return {id,name:'item.completed',description:'A fact emitted after successful local completion.',when:'completed',fields:[field('result','object')],payload:[binding('result',reference('output'))]};
  }
  export function freshRule(id='rule_1'): BusinessRule {
    return {id,name:'New business rule',description:'Evaluate typed evidence, then return an explicit decision.',status:'draft',events:[],mode:'if',inputs:[field('value','number')],branches:[{id:'match',name:'Condition matches',match:'all',conditions:[{id:'condition_1',left:reference('input.value'),operator:'gte',right:literal(0.8)}],decision:decision('continue','accepted')}],fallback:decision('review','needs_review'),maxIterations:5};
  }
  export function freshProcess(id='process_1'): ProcessDefinition {
    return {id,name:'New process',description:'A named process with an explicit input and output contract.',status:'draft',events:[],mode:'transform',inputs:[field('value','string')],outputs:[field('value','string')],mappings:[binding('value',reference('input.value'))]};
  }
  export function freshNode(kind: FlowNode['kind'], id: string, refId='', name=''): FlowNode {
    return {id,kind,refId,name:name||kind[0].toUpperCase()+kind.slice(1),x:80,y:80,inputs:[],events:[]};
  }
  export function freshFlow(id='flow_1'): FlowDefinition {
    const start=freshNode('start','start'),end=freshNode('end','end');end.x=440;
    return {id,name:'New decision flow',description:'Connect prompts, rules, and processes. All execution is local simulation.',status:'draft',events:[],nodes:[start,end],edges:[{id:'edge_1',source:'start',port:'success',target:'end',kind:'control'}],sampleInput:'{}',maxSteps:60,maxEvents:30};
  }
  export function initialLogic(prompts: Recipe[]): LogicLibrary {
    const route=prompts.find(p=>p.id==='inbox-routing')||prompts[0];
    const follow=prompts.find(p=>p.id==='next-action')||route;
    const question=route.questions.find(q=>q.type==='choice');
    const prepare=freshProcess('prepare_context');prepare.name='Prepare decision context';prepare.inputs=[field('body','string')];prepare.outputs=[field('body','string')];prepare.mappings=[binding('body',reference('input.body'))];
    prepare.events=[{id:'context_ready',name:'context.prepared',description:'The input is ready for classification.',when:'completed',fields:[field('body','string')],payload:[binding('body',reference('output.body'))]}];
    const task=freshProcess('prepare_task');task.name='Draft a task payload';task.description='Build data for a next step, without writing a vault note.';task.inputs=[field('destination','string')];task.outputs=[field('title','string'),field('destination','string')];task.mappings=[binding('title',literal('Review the classified inbox note')),binding('destination',reference('input.destination'))];
    const guard=freshRule('routing_policy');guard.name='Route only clear project notes';guard.description='First matching branch wins. Uncertain or fallback classifications require review.';guard.inputs=[field('answers','object')];
    guard.branches[0]={id:'accepted',name:'Confident project decision',match:'all',conditions:question?[{id:'confidence',left:reference('input.answers.'+question.id+'.confidence'),operator:'gte',right:literal(0.85)},{id:'destination',left:reference('input.answers.'+question.id+'.choice'),operator:'eq',right:literal(question.options[0].key)}]:[{id:'known',left:reference('input.answers'),operator:'exists',right:literal(null)}],decision:decision('process','prepare_task','prepare_task')};
    guard.events=[{id:'decision_made',name:'routing.decided',description:'The rule made a deterministic decision from the supplied evidence.',when:'completed',fields:[field('code','string')],payload:[binding('code',reference('output.decision.code'))]}];
    const loop=freshRule('bounded_retry');loop.name='Repeat while attempts remain';loop.mode='while';loop.inputs=[field('attempt','number')];loop.branches[0]={id:'repeat',name:'Attempt is below 3',match:'all',conditions:[{id:'remaining',left:reference('input.attempt'),operator:'lt',right:literal(3)}],decision:decision('process','next_attempt','increment_attempt')};loop.fallback=decision('continue','finished');loop.maxIterations=5;
    const increment=freshProcess('increment_attempt');increment.name='Increment attempt';increment.inputs=[field('attempt','number')];increment.outputs=[field('attempt','number')];increment.mappings=[binding('attempt',{mode:'add',value:'input.attempt',amount:1})];
    increment.events=[{id:'attempt_counted',name:'attempt.counted',description:'The synthetic attempt counter was incremented.',when:'completed',fields:[field('attempt','number')],payload:[binding('attempt',reference('output.attempt'))]}];
    const flow=freshFlow('inbox_decision');flow.name='From inbox note to next action';flow.description='Prepare context → Jev → rule → process → Jev. Follow the data and every emitted fact.';flow.sampleInput=JSON.stringify({body:'Synthetic intake: prepare a plan for the kitchen renovation.'},null,2);
    const make=(kind:FlowNode['kind'],id:string,x:number,y:number,refId='',name='')=>({...freshNode(kind,id,refId,name),x,y});
    flow.nodes=[make('start','start',60,130,'','Manual start'),make('process','prepare',360,130,prepare.id,prepare.name),make('prompt','classify',660,130,route.id,'Classify the note'),make('rule','route',960,130,guard.id,'Apply routing policy'),make('process','task',960,390,task.id,'Draft task data'),make('prompt','verify',660,390,follow.id,'Check the next action'),make('end','end',360,390,'','End with decision')];
    flow.nodes.find(n=>n.id==='route')!.inputs=[binding('answers',reference('input.answers'))];
    flow.nodes.find(n=>n.id==='task')!.inputs=[binding('destination',question?reference('steps.classify.output.answers.'+question.id+'.choice'):literal('project'))];
    const connect=(id:string,source:string,target:string,port='success',kind:FlowEdge['kind']='control'):FlowEdge=>({id,source,target,port,kind});
    flow.edges=[connect('e1','start','prepare'),connect('e2','prepare','classify'),connect('e3','classify','route'),connect('e4','route','task','accepted'),connect('e5','task','verify'),connect('e6','verify','end')];
    const retry=freshFlow('retry_with_limit');retry.name='A bounded while-loop';retry.description='Repeat a deterministic process, re-evaluate the rule, then exit. Limits stop misconfigured loops.';retry.sampleInput='{"attempt": 0}';
    retry.nodes=[make('start','start',60,180),make('rule','guard',360,180,loop.id,'While attempt < 3'),make('process','increment',660,180,increment.id,'Increment attempt'),make('end','end',360,470)];
    retry.nodes[2].inputs=[binding('attempt',reference('input.evaluatedInput.attempt'))];
    retry.edges=[connect('e1','start','guard'),connect('e2','guard','increment','repeat'),connect('e3','increment','guard'),connect('e4','guard','end','else')];
    const events=clone(flow);events.id='event_driven_intake';events.name='Event-driven intake';events.description='Events carry typed payloads and explicitly trigger subscribers. No hidden global event bus.';
    events.edges[1]=connect('e2','prepare','classify','context_ready','event');
    events.nodes[2].events=[{id:'classified',name:'note.classified',description:'Classification answers are available for the next rule.',when:'completed',fields:[field('answers','object')],payload:[binding('answers',reference('output.answers'))]}];
    events.edges[2]=connect('e3','classify','route','classified','event');events.nodes[3].inputs=[binding('answers',reference('event.payload.answers'))];
    return {kind:'jev-logic',schemaVersion:1,rules:[guard,loop],processes:[prepare,task,increment],flows:[flow,retry,events],revisions:[]};
  }
}
