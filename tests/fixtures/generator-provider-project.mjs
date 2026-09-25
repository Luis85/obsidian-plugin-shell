/** Explicit API/database simulations extend the real companion export; no provider is contacted. */
export function providerProject(original) {
  const project = structuredClone(original), sources = project.design.dataSources;
  const item = {type:'object',properties:{id:{type:'string',format:'uuid'},title:{type:'string'},completed:{type:'boolean'}},required:['id','title','completed'],additionalProperties:false};
  for (const [offset,kind] of [[700,'api'],[800,'database']]) {
    const id='ds-source-'+offset, slug='fixture-'+kind;
    const shape = schema => ({mode:'schema',many:false,schema});
    const none={mode:'none',many:false};
    const operation=(n,name,direction,input,output)=>({id:'ds-operation-'+(offset+n),slug:name,name,description:'Synthetic provider contract',direction,method:kind==='api'?(direction==='read'?'GET':name==='delete-record'?'DELETE':'POST'):'adapter',resource:kind==='api'?'/records':'fixture_records',input,output});
    const list=operation(1,'list-records','read',none,shape({type:'array',items:item}));
    const save=operation(2,'save-record','write',shape(item),none);
    const remove=operation(3,'delete-record','write',shape({type:'object',properties:{id:item.properties.id},required:['id'],additionalProperties:false}),none);
    const disabled=operation(4,'not-configured','read',none,shape({type:'array',items:item}));
    sources.sources.push({...sources.sources[0],id,slug,name:'Fixture '+kind,kind,locator:kind==='api'?'https://example.invalid':'fixture-database',auth:'none',operations:[list,save,remove,disabled]});
    for(const [op,behavior] of [[list,'list'],[save,'upsert'],[remove,'delete']]) sources.testing.recipes.push({source:id,operation:op.id,enabled:true,behavior,dataset:slug,keyField:'id',scenario:'populated',latencyMs:0,errorStatus:503,rules:[]});
  }
  return project;
}
