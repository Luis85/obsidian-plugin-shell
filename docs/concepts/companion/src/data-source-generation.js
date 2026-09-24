// Deterministic, inert previews. Adapter implementations are deliberately not fabricated.
function dsTypeScript(schema){
 if(schema?.payload===false)return 'void';
 if(!schema||schema.declared===false||schema.missingEntity)return 'unknown';
 if(Array.isArray(schema.type))return schema.type.map(type=>dsTypeScript({type})).join(' | ');
 if(schema.enum?.length)return schema.enum.map(v=>JSON.stringify(v)).join(' | ');
 if(schema.type==='array')return 'ReadonlyArray<'+dsTypeScript(schema.items)+'>';
 if(schema.type==='object'){
  const fields=Object.entries(schema.properties||{}).map(([k,v])=>'readonly '+JSON.stringify(k)+((schema.required||[]).includes(k)?'':'?')+': '+dsTypeScript(v)+';');
  if(schema.additionalProperties!==false)fields.push('readonly [key: string]: unknown;');return '{ '+fields.join(' ')+' }';
 }
 return ({string:'string',number:'number',integer:'number',boolean:'boolean',null:'null'})[schema.type]||'unknown';
}
function dataSourceFiles(d){
 const spec=dsGeneration(d);if(!spec)return [];
 const files=[],header='// DATA-SOURCE CONTRACT PREVIEW. No network, database or vault implementation.\n';
 for(const s of spec.sources){
  const operations=s.operations.map(o=>{
   const input=dsResolveShape(o.input,d),output=dsResolveShape(o.output,d);
   return '  '+JSON.stringify(o.slug)+'('+(input.payload===false?'':'input: '+dsTypeScript(input))+'): Promise<'+dsTypeScript(output)+'>;';
  }).join('\n');
  files.push({path:'src/application/data-sources/'+s.slug+'-port.ts',content:header+'export interface '+semanticPascal(s.slug)+'Port {\n'+operations+'\n}\n',owner:s.id,role:'Declared application data port · adapter still required'});
  files.push({path:'docs/data-sources/'+s.slug+'.json',content:JSON.stringify({schema:1,executable:false,source:s,shapes:spec.resolvedShapes.filter(o=>o.source===s.id)},null,2)+'\n',owner:s.id,role:'Source operation and payload contracts'});
 }
 files.push({path:'src/bootstrap/data-flow-outlines.ts',content:header+'export const dataFlowOutlines = '+JSON.stringify(spec.flows,null,2)+' as const;\n',owner:'data-sources',role:'Explicit source-to-surface data-flow bindings'});
 const rows=spec.flows.map(f=>'| '+[f.label,dsFlowSentence(f,d),f.direction,f.trigger,f.notes||'Define mapping and failure behavior.'].map(x=>x.replace(/[\r\n|]/g,' ')).join(' | ')+' |').join('\n');
 files.push({path:'docs/DATA-FLOW-HANDOFF.md',content:'# Data-flow implementation handoff\n\nDesign only. No connection test, query, request, synchronization, database operation or vault write has run.\n\n| Intent | Business-data direction | Mode | Trigger | Mapping / behavior |\n| --- | --- | --- | --- | --- |\n'+rows+'\n\n## Required implementation\n\nBind application ports to explicitly approved infrastructure adapters. Resolve credential reference names in runtime configuration, never design files. Validate untrusted request/response shapes; format annotations are not validators. Implement authentication, permissions, cancellation, bounded retries, timeouts, error/empty/loading states, privacy and redacted logging. Database drivers and server access need platform/security review. Use the generated plugin’s active vault and preserve unrelated note properties/body content. Writes need reviewed conflict and failure policies. Bidirectional arrows declare two directions, not synchronization or permission to send vault data externally. No mapping, request or transformation is inferred from the diagram.\n',owner:'data-sources',role:'Unimplemented data-access obligations'});
 return files;
}
