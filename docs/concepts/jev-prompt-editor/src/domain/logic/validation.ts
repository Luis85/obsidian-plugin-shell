namespace Jev {
  type Shape = (value: unknown, path: string, issues: Check[]) => void;
  const bad = (issues: Check[], path: string, message: string): void => { issues.push({path,message}); };
  const text = (limit=4000, required=false): Shape => (v,p,e) => {
    if (typeof v!=='string'||v.length>limit||(required&&!v.trim())) bad(e,p,'Expected '+(required?'non-empty ':'')+'text, at most '+limit+' characters.');
  };
  const choice = (...values: unknown[]): Shape => (v,p,e) => { if (!values.includes(v)) bad(e,p,'Expected one of: '+values.join(', ')); };
  const integer = (min: number,max: number): Shape => (v,p,e) => { if (typeof v!=='number'||!Number.isInteger(v)||v<min||v>max) bad(e,p,'Expected an integer from '+min+' to '+max+'.'); };
  const numberShape: Shape=(v,p,e)=>{if(typeof v!=='number'||!Number.isFinite(v))bad(e,p,'Expected a finite number.');};
  const keyShape: Shape=(v,p,e)=>{if(typeof v!=='string'||!safeKey(v))bad(e,p,'Use a lowercase ID, letters/numbers/underscores, starting with a letter.');};
  const refShape: Shape=(v,p,e)=>{if(typeof v!=='string'||!/^([a-zA-Z0-9_-]{1,80})?$/.test(v)||['__proto__','constructor','prototype'].includes(v))bad(e,p,'Invalid portable reference.');};
  const objectShape = (fields: Record<string,Shape>): Shape => (v,p,e) => {
    if (!record(v)) {bad(e,p,'Expected an object.');return;}
    for(const key of Object.keys(v))if(!Object.prototype.hasOwnProperty.call(fields,key))bad(e,p+'.'+key,'Unknown field; import will not discard it.');
    for(const [key,check]of Object.entries(fields))check(v[key],p+'.'+key,e);
  };
  const arrayShape = (item: Shape,max=30,min=0,unique?: string): Shape => (v,p,e) => {
    if(!Array.isArray(v)||v.length<min||v.length>max){bad(e,p,'Expected '+min+'–'+max+' items.');return;}
    const seen=new Set<unknown>();
    v.forEach((value,i)=>{item(value,p+'.'+i,e);if(unique&&record(value)){if(seen.has(value[unique]))bad(e,p+'.'+i,'Duplicate '+unique+'.');seen.add(value[unique]);}});
  };
  const bindingShape: Shape=objectShape({mode:choice('literal','path','add'),value:text(16000),amount:numberShape});
  const checkedBinding: Shape=(v,p,e)=>{
    bindingShape(v,p,e);if(!record(v)||typeof v.value!=='string')return;
    if(v.mode==='literal'){try{parseJson(v.value);}catch(error){bad(e,p+'.value',(error as Error).message);}}
    else if(!validPath(v.value))bad(e,p+'.value','Use a safe dot-separated data path, not code.');
  };
  const namedShape=objectShape({name:keyShape,binding:checkedBinding});
  const namedArray=arrayShape(namedShape,40,0,'name');
  const fieldShape=objectShape({name:keyShape,type:choice('string','number','boolean','object','array'),required:choice(true,false),description:text(1000)});
  const fieldArray=arrayShape(fieldShape,40,0,'name');
  const eventShape=objectShape({
    id:keyShape,name:(v,p,e)=>{if(typeof v!=='string'||v.length>100||!v.split('.').every(s=>safeKey(s)))bad(e,p,'Use a dotted event name, such as note.classified.');},
    description:text(),when:choice('completed','true','false','review','error'),fields:fieldArray,payload:namedArray,
  });
  const eventArray=arrayShape(eventShape,12,0,'id');
  export function validateEvents(value: unknown): Check[] {
    const errors:Check[]=[];eventArray(value,'events',errors);
    if(Array.isArray(value)){
      const names=new Set<string>();
      value.forEach((event,index)=>{
        if(!record(event))return;
        if(typeof event.name==='string'){if(names.has(event.name))bad(errors,'events.'+index,'Event names must be unique within this item.');names.add(event.name);}
        if(Array.isArray(event.fields)&&Array.isArray(event.payload)){
          const fields=event.fields.filter(record),payload=event.payload.filter(record);
          for(const f of fields)if(f.required&&!payload.some(b=>b.name===f.name))bad(errors,'events.'+index+'.payload','Missing required binding: '+f.name);
          for(const b of payload)if(!fields.some(f=>f.name===b.name))bad(errors,'events.'+index+'.payload','Undeclared payload field: '+b.name);
        }
      });
    }
    return errors;
  }
  const eventsShape:Shape=(v,p,e)=>{for(const check of validateEvents(v))bad(e,p+check.path.slice(6),check.message);};
  const base={id:keyShape,name:text(160,true),description:text(),status:choice('draft','ready','archived'),events:eventsShape};
  const decisionShape=objectShape({type:choice('continue','process','end','review'),code:keyShape,processId:refShape});
  const conditionShape=objectShape({id:keyShape,left:checkedBinding,operator:choice('eq','neq','gt','gte','lt','lte','contains','exists','missing'),right:checkedBinding});
  const branchKey: Shape=(v,p,e)=>{keyShape(v,p,e);if(['else','error','limit','success'].includes(String(v)))bad(e,p,'This branch ID is reserved by the runtime.');};
  const branchShape=objectShape({id:branchKey,name:text(160,true),match:choice('all','any'),conditions:arrayShape(conditionShape,12,1,'id'),decision:decisionShape});
  const ruleShape=objectShape({...base,mode:choice('if','while'),inputs:fieldArray,branches:arrayShape(branchShape,12,1,'id'),fallback:decisionShape,maxIterations:integer(1,25)});
  const processShape=objectShape({...base,mode:choice('transform','fixture','external'),inputs:fieldArray,outputs:fieldArray,mappings:namedArray});
  const nodeShape=objectShape({id:keyShape,kind:choice('start','prompt','rule','process','end'),name:text(160,true),refId:refShape,x:integer(-4000,12000),y:integer(-4000,12000),inputs:namedArray,events:eventsShape});
  const edgeShape=objectShape({id:keyShape,source:keyShape,port:text(100,true),target:keyShape,kind:choice('control','event')});
  const flowShape=objectShape({...base,nodes:arrayShape(nodeShape,60,1,'id'),edges:arrayShape(edgeShape,120,0,'id'),sampleInput:text(40000,true),maxSteps:integer(1,200),maxEvents:integer(1,100)});
  const snapshotFields={rules:arrayShape(ruleShape,40,0,'id'),processes:arrayShape(processShape,40,0,'id'),flows:arrayShape(flowShape,20,1,'id')};
  const snapshotShape=objectShape(snapshotFields);
  const revisionShape=objectShape({id:keyShape,name:text(160,true),createdAt:text(80,true),snapshot:snapshotShape});
  const libraryShape=objectShape({kind:choice('jev-logic'),schemaVersion:choice(1),...snapshotFields,revisions:arrayShape(revisionShape,20,0,'id')});
  export function validateLogic(value: unknown): Check[] {
    const issues:Check[]=[];
    try{assertSafe(value);}catch(error){return [{path:'$',message:(error as Error).message}];}
    libraryShape(value,'logic',issues);return issues;
  }
  export function readLogic(value: unknown): LogicLibrary {
    const issues=validateLogic(value);if(issues.length)throw new Error(issues.slice(0,4).map(i=>i.path+': '+i.message).join('\n'));
    return clone(value) as LogicLibrary;
  }
}
