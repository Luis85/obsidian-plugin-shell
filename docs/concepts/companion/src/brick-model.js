// Data validation and model commands. All edits use the existing history/source-plan boundary.
function validBricks(n){
 if(n.bricks===undefined)return true;
 const text=(v,max)=>typeof v==='string'&&v.length<=max;
 return Array.isArray(n.bricks)&&n.bricks.length<=BRICK_LIMITS.perSurface&&n.bricks.every(b=>b&&b.schema===1&&/^brick-[1-9][0-9]*$/.test(b.id)&&Object.hasOwn(BRICK_KINDS,b.kind)&&text(b.title,BRICK_LIMITS.title)&&b.title.trim().length>0&&text(b.purpose,BRICK_LIMITS.purpose)&&text(b.content,BRICK_LIMITS.content)&&text(b.region,40)&&(b.component===null||text(b.component,100))&&(b.definition===undefined||text(b.definition,100)&&typeof b.version==='string'&&/^\d+\.\d+\.\d+$/.test(b.version)&&validContentSpec(b.defaults))&&Object.keys(b).every(k=>['schema','id','kind','title','purpose','content','region','component','definition','version','defaults'].includes(k)));
}
function brickIssues(d){
 const issues=libraryBrickIssues(d),ids=new Set();let total=0;
 const add=(code,message,node)=>issues.push({level:'error',code,message,node});
 for(const n of d.nodes){if(!validBricks(n)){add('brick-schema',n.label+': unsupported or malformed content bricks.',n.id);continue;}
  if(bricksOf(n).length&&!canHaveBricks(n))add('brick-surface',n.label+': only visual surfaces contain content bricks.',n.id);
  for(const b of bricksOf(n)){total++;if(ids.has(b.id))add('brick-id','Content brick IDs must be unique.',n.id);ids.add(b.id);
   if(!componentSlots(n).includes(b.region))add('brick-region',n.label+' / '+b.title+': choose a region supported by this layout.',n.id);
   if(b.component&&!n.components?.some(c=>c.id===b.component&&c.slot===b.region))add('brick-binding',n.label+' / '+b.title+': its component placement changed. Review the mapping.',n.id);
  }
 }
 if(total>BRICK_LIMITS.total)add('brick-limit','The outline exceeds 400 content bricks.',null);
 return issues;
}
function beginBrick(nodeId,kind='text',id=null){
 const d=design(),n=d.nodes.find(n=>n.id===nodeId);if(state.activeRun||!canHaveBricks(n))return;
 const b=id?bricksOf(n).find(b=>b.id===id):{schema:1,id:null,kind,title:BRICK_KINDS[kind]?.label||'',purpose:'',content:'',region:componentSlots(n)[0],component:null};if(!b)return;
 brickUi.node=n.id;brickUi.selected=id;brickUi.error='';
 brickUi.form={...designCopy(b),node:n.id,owner:designOwner(),revision:d.revision};if(!brickUi.form.definition)attachBrickDefinition(brickUi.form,brickDefinition(d,kind));showModal('brick-edit');
}
function brickContext(f){return !!f&&f.owner===designOwner()&&f.revision===design().revision&&!state.activeRun;}
function failBrick(message){brickUi.error=message;redrawModal();return false;}
function ensureBrickBinding(d,n,b){
 if(!b.component)return;
 if(!['view','page','modal'].includes(n.kind))throw Error('Native settings do not mount custom Vue components in this concept.');
 const c=d.library.find(c=>c.id===b.component);if(!c||c.status==='deprecated')throw Error('Choose an available component from the library.');
 const binding=n.components.find(x=>x.id===b.component&&x.slot===b.region);
 if(binding&&binding.version!==c.version)throw Error('Review the existing component version in the library before mapping it.');
 if(!binding){if(n.components.length>=20)throw Error('This surface already has 20 component placements.');n.components.push({id:c.id,slot:b.region,version:c.version});}
}
function saveBrick(){
 const f=brickUi.form,d=design(),n=d.nodes.find(n=>n.id===f?.node);
 if(!n||!brickContext(f))return failBrick('This draft is stale. Reopen the brick against the current outline.');
 const candidate=designCopy(d),target=candidate.nodes.find(x=>x.id===n.id);target.bricks=target.bricks||[];
 if(!f.id&&target.bricks.length>=BRICK_LIMITS.perSurface)return failBrick('Use at most 24 bricks per surface.');
 const b={schema:1,id:f.id||freshBrickId(candidate),kind:f.kind,title:f.title.trim(),purpose:f.purpose.trim(),content:f.content,region:f.region,component:f.component||null,...(f.definition?{definition:f.definition,version:f.version,defaults:designCopy(f.defaults)}:{})};
 const index=target.bricks.findIndex(x=>x.id===f.id);
 if(f.id&&index<0)return failBrick('The original brick no longer exists.');
 try{ensureBrickBinding(candidate,target,b);}catch(e){return failBrick(e.message);}
 if(index<0)target.bricks.push(b);else target.bricks[index]=b;
 const errors=brickIssues(candidate).filter(i=>i.level==='error'&&i.code!=='brick-definition-drift');if(errors.length)return failBrick(errors[0].message);
 if(JSON.stringify(n.bricks||[])===JSON.stringify(target.bricks)&&JSON.stringify(n.components)===JSON.stringify(target.components)){closeModal();return;}
 recordDesign();n.bricks=target.bricks;n.components=target.components;d.nextId=candidate.nextId;designChanged();brickUi.selected=b.id;brickUi.node=n.id;designUi.selected=n.id;canvasUi.inspector='bricks';closeModal();render();if(index<0)fitMap(true);canvasAnnounce('Content brick saved. The source plan needs review; no business logic was generated.');
}
function findBrick(value){const [node,id]=value.split(':');const n=design().nodes.find(n=>n.id===node);return {n,b:bricksOf(n).find(b=>b.id===id)};}
function reorderBrick(nodeId,id,beforeId=null,expected=null){
 const d=design(),n=d.nodes.find(n=>n.id===nodeId);if(state.activeRun||!n)return false;
 if(expected&&!brickContext(expected))return false;
 const list=[...bricksOf(n)],i=list.findIndex(b=>b.id===id);if(i<0||id===beforeId)return false;
 if(beforeId&&!list.some(b=>b.id===beforeId))return false;
 const [b]=list.splice(i,1);list.splice(beforeId?list.findIndex(x=>x.id===beforeId):list.length,0,b);
 if(JSON.stringify(list)===JSON.stringify(n.bricks))return false;
 recordDesign();n.bricks=list;designChanged();brickUi.selected=id;brickUi.node=n.id;designUi.selected=n.id;render();canvasAnnounce('Content order changed. Screen hierarchy and component definitions are unchanged.');return true;
}
function nudgeBrick(value,delta){const {n,b}=findBrick(value);if(!b)return;const list=bricksOf(n),index=list.indexOf(b),at=index+delta;if(at<0||at>=list.length)return;reorderBrick(n.id,b.id,delta<0?list[at].id:list[at+1]?.id||null);}
function duplicateBrick(value){const {n,b}=findBrick(value);if(!b||state.activeRun)return;if(bricksOf(n).length>=24||design().nodes.reduce((s,n)=>s+bricksOf(n).length,0)>=400){notify('Content brick limit reached.');return;}
 recordDesign();const copy={...designCopy(b),id:freshBrickId(design()),title:(b.title+' copy').slice(0,100)};n.bricks.splice(n.bricks.indexOf(b)+1,0,copy);designChanged();brickUi.selected=copy.id;brickUi.node=n.id;closeModal();render();fitMap(true);
}
function saveBrickTransfer(){
 const f=brickUi.move,d=design(),source=d.nodes.find(n=>n.id===f?.source),b=bricksOf(source).find(b=>b.id===f?.id),target=d.nodes.find(n=>n.id===f?.target);
 if(!b||!target||!brickContext(f))return failBrick('This transfer is stale. Reopen it from the current outline.');
 if(!canHaveBricks(target)||source===target||bricksOf(target).length>=24)return failBrick('Choose a different visual surface with room for another brick.');
 if(!componentSlots(target).includes(f.region))return failBrick('Choose a region supported by the destination.');
 const candidate=designCopy(d),a=candidate.nodes.find(n=>n.id===source.id),z=candidate.nodes.find(n=>n.id===target.id),copy={...designCopy(b),region:f.region};
 if(f.copy)copy.id=freshBrickId(candidate);else a.bricks=a.bricks.filter(x=>x.id!==b.id);
 try{ensureBrickBinding(candidate,z,copy);}catch(e){return failBrick(e.message);}
 z.bricks=[...bricksOf(z),copy];const errors=brickIssues(candidate).filter(i=>i.level==='error'&&i.code!=='brick-definition-drift');if(errors.length)return failBrick(errors[0].message);
 recordDesign();source.bricks=a.bricks;target.bricks=z.bricks;target.components=z.components;d.nextId=candidate.nextId;designChanged();designUi.selected=target.id;brickUi.selected=copy.id;brickUi.node=target.id;closeModal();render();fitMap(true);canvasAnnounce('Content '+(f.copy?'copied':'moved')+'. Existing component placements and source files were retained.');
}
function contentOutlineMarkdown(d){
 const clean=s=>String(s).replace(/[\r\n]/g,' ');
 return '# Screen content outline\n\nPlanning document. Blocks are not implemented components, verified requirements or pixel-accurate layouts.\n\n'+d.nodes.filter(canHaveBricks).map(n=>'## '+clean(n.label)+'\n\nIntent: '+clean(n.intent||'Not specified')+'\n\n'+(bricksOf(n).map((b,i)=>'### '+(i+1)+'. '+clean(b.title)+'\n\nType: '+BRICK_KINDS[b.kind].label+' · Region: '+b.region+' · ID: '+b.id+'\n\nPurpose: '+b.purpose+'\n\n'+b.content+'\n\nLibrary component: '+(b.definition||'Legacy')+' · v'+(b.version||'unversioned')+'\n\nImplementation contract: '+(b.component||'Not linked; implementation is not implied')+'\n').join('\n')||'Content has not been outlined.\n')).join('\n');
}
