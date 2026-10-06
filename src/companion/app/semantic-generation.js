// Generator inputs and readable Markdown fixtures. Not an executable persistence adapter.
function semanticNote(e,m){
 const quote=v=>JSON.stringify(v);const fields=['type: '+quote(e.slug),'id: '+quote('example-'+e.slug)];
 for(const p of erFields(e,m)){
  let v=p.defaultValue;
  if(p.relationship){const target=m.entities.find(x=>x.id===p.target);v='[['+target.folder+'/Example '+target.name+']]';if(p.type==='list')v=[v];}
  else if(v===undefined)v={text:'Example',list:[],number:0,checkbox:false,date:'2026-09-24',datetime:'2026-09-24T09:00:00',tags:[]}[p.type];
  fields.push(p.key+': '+((p.type==='date'||p.type==='datetime')?v:quote(v)));
 }
 return '---\n'+fields.join('\n')+'\n---\n\n# Example '+e.name+'\n\nIllustrative instance. No note was written to an Obsidian vault.\n';
}
function semanticFiles(d){
 const m=d.semantic;if(!m||!m.entities.length)return [];
 const out=[],put=(path,content,owner,role)=>out.push({path,content,owner,role});
 const header='// DECLARED SCHEMA PREVIEW. Adapt to shared makers before compilation; no native writes.\n';
 const tsType=p=>p.relationship?(p.type==='list'?'readonly string[]':'string'):({text:'string',list:'readonly (string | number)[]',number:'number',checkbox:'boolean',date:'string',datetime:'string',tags:'readonly string[]'}[p.type]);
 for(const e of m.entities){
  const name=semanticPascal(e.slug),fields=erFields(e,m),props=fields.map(p=>'  '+p.key+(p.required?'':'?')+': '+tsType(p)+';').join('\n');
  put('src/domain/entities/'+e.slug+'.ts',header+'export interface '+name+' {\n  id: string;\n  type: '+JSON.stringify(e.slug)+';\n'+props+'\n}\n',e.id,'Declared entity type');
  const descriptor={schema:1,entityId:e.id,type:e.slug,name:e.name,folder:e.folder,storage:'markdown-frontmatter',managed:{id:'text',type:'text'},properties:fields,relationships:m.relationships.filter(r=>r.source===e.id),preserveUnknownProperties:true,preserveBody:true};
  put('src/features/entities/'+e.slug+'/document-recipe.ts',header+'export const documentRecipe = '+JSON.stringify(descriptor,null,2)+' as const;\n',e.id,'Document creation, update and validation recipe input');
  put('tests/fixtures/entities/'+e.slug+'-example.md',semanticNote(e,m),e.id,'Obsidian-compatible frontmatter example');
 }
 put('src/bootstrap/entity-outlines.ts',header+'export const entityOutlines = '+JSON.stringify(semanticGeneration(d),null,2)+' as const;\n','semantic','Shared generator semantic input');
 put('docs/ENTITY-RELATIONSHIPS.md','# Semantic layer\n\nDeclared, not inferred. Layout sections are visual groups, not storage or transaction boundaries.\n\n'+m.relationships.map(r=>{const a=m.entities.find(e=>e.id===r.source),b=m.entities.find(e=>e.id===r.target);return '## '+r.name+'\n\n'+a.name+' ('+r.sourceCard+') → '+b.name+' ('+r.targetCard+')\n\nStored once at `'+a.slug+'.'+r.key+'` as '+(erMany(r.targetCard)?'a List of quoted wikilinks':'a Text property with a quoted wikilink')+'. Inverse queries are derived. Deletion: restrict; never cascade-delete notes.\n';}).join('\n')+'\n## Implementation obligations\n\nResolve references by stable ID/path, update links on rename, handle missing/ambiguous notes, validate cardinality and defaults in application services, preserve unrelated frontmatter and note bodies, test failed writes and migrations. Obsidian does not enforce relationship cardinalities. Changing a schema is not a data migration.\n','semantic','Relationship semantics and unresolved runtime obligations');
 return out;
}
