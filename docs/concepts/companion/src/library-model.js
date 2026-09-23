// A brick is an ordered instance of a library component. Code readiness remains separate.
const libraryUi={filter:'all',includeDeprecated:false,form:null,returnNode:null,error:''};

function isBrickComponent(c){return !!c?.contentSpec;}
function brickSpec(kind,title,purpose='',content='',region='content'){
 return {schema:1,kind,title,purpose,content,region};
}
function defaultBrickComponents(){
 return Object.entries(BRICK_KINDS).map(([kind,s])=>({
  id:'content-'+kind,name:kind[0].toUpperCase()+kind.slice(1)+'Block',category:BRICK_GROUPS[s.group],
  preview:'brick',description:s.help,props:'title:string',events:'',slots:'content',variants:'default',
  a11y:'Name this content region. Preserve reading order and keyboard access.',
  version:'1.0.0',revision:1,status:'ready',origin:'starter',replacement:'',
  tokens:'--text-normal\n--background-primary',contentSpec:brickSpec(kind,s.label,s.help)
 }));
}
function validContentSpec(s){
 const text=(v,max)=>typeof v==='string'&&v.length<=max;
 return !!s&&s.schema===1&&Object.hasOwn(BRICK_KINDS,s.kind)&&text(s.title,100)&&s.title.trim().length>0&&
  text(s.purpose,800)&&text(s.content,4000)&&text(s.region,40)&&/^[a-z][a-z0-9-]*$/.test(s.region)&&
  Object.keys(s).every(k=>['schema','kind','title','purpose','content','region'].includes(k));
}
function brickDefinition(d,kind){
 return d.library.find(c=>c.id==='content-'+kind&&isBrickComponent(c)&&c.status!=='deprecated')||
  d.library.find(c=>c.contentSpec?.kind===kind&&c.status!=='deprecated');
}
function attachBrickDefinition(b,c){
 if(!c)return b;
 b.definition=c.id;b.version=c.version;b.defaults=designCopy(c.contentSpec);return b;
}
function ensureBrickLibrary(d){
 // Additive legacy migration: preserve authored instances, IDs, notes and implementation bindings.
 if(d.librarySchema===undefined){
  for(const c of defaultBrickComponents()){
   if(d.library.some(x=>x.id===c.id)){
    const existing=d.library.find(x=>x.id===c.id);
    if(isBrickComponent(existing))continue;
    let suffix=2;const base=c.id;while(d.library.some(x=>x.id===c.id))c.id=base+'-'+suffix++;
   }
   if(!d.library.some(x=>x.name===c.name))d.library.push(c);
  }
  d.librarySchema=2;
 }
 for(const n of d.nodes)for(const b of bricksOf(n))if(!b.definition)attachBrickDefinition(b,brickDefinition(d,b.kind));
 return d;
}
function libraryBrickRefs(d,id){
 return d.nodes.flatMap(node=>bricksOf(node).filter(brick=>brick.definition===id).map(brick=>({node,brick})));
}
function libraryBrickIssues(d){
 const result=[];
 for(const n of d.nodes)for(const b of bricksOf(n)){
  if(!b.definition)continue; // Legacy data is migrated only when adopted, never while validating unknown input.
  const c=(d.library||[]).find(c=>c.id===b.definition);
  const add=(level,code,text)=>result.push({level,code,message:n.label+' / '+b.title+': '+text,node:n.id});
  if(!isBrickComponent(c)){add('error','brick-definition-missing','the library component is missing. Relink explicitly.');continue;}
  if(c.version!==b.version)add('error','brick-definition-drift','review library v'+c.version+' before generating.');
  if(c.status==='deprecated')add('warning','brick-definition-deprecated','the definition is deprecated; existing content is retained.');
  if(c.status==='draft')add('warning','brick-definition-draft','the component definition is still a draft.');
 }
 return result;
}
function beginLibraryBrick(node,id,instance=null){
 const d=design(),n=d.nodes.find(n=>n.id===node),c=d.library.find(c=>c.id===id);
 if(!canHaveBricks(n)||!isBrickComponent(c)||state.activeRun)return;
 if(c.status==='deprecated'&&!instance){notify('This component is deprecated. Choose an active definition.');return;}
 const b=instance||{schema:1,id:null,...Object.fromEntries(['kind','title','purpose','content','region'].map(k=>[k,c.contentSpec[k]])),component:null};
 beginBrick(node,b.kind,instance?.id||null);
 if(!instance){Object.assign(brickUi.form,b,{region:componentSlots(n).includes(b.region)?b.region:componentSlots(n)[0],definition:c.id,version:c.version,defaults:designCopy(c.contentSpec)});modalOriginal=null;redrawModal();}
}
function newBrickDefinition(){
 const c=nextCustomComponent();c.category='Content';c.preview='brick';
 c.contentSpec=brickSpec('text','New content component');return c;
}
function beginBrickUpgrade(value){
 const {n,b}=findBrick(value),c=design().library.find(c=>c.id===b?.definition);
 if(!n||!b||!isBrickComponent(c))return;
 libraryUi.form={node:n.id,id:b.id,owner:designOwner(),revision:design().revision};libraryUi.error='';showModal('library-upgrade');
}
function upgradedBrick(b,c){
 const next=designCopy(b),changes=[];
 for(const field of ['kind','title','purpose','content','region']){
  const local=b.defaults?b[field]!==b.defaults[field]:true;
  const value=local?b[field]:c.contentSpec[field];
  changes.push({field,local,before:b[field],after:value});next[field]=value;
 }
 attachBrickDefinition(next,c);return {next,changes};
}
function applyBrickUpgrade(){
 const f=libraryUi.form,d=design(),n=d.nodes.find(n=>n.id===f?.node),b=bricksOf(n).find(b=>b.id===f?.id),c=d.library.find(c=>c.id===b?.definition);
 if(!b||!c||!brickContext(f)){libraryUi.error='This review is stale. Reopen the current instance.';redrawModal();return;}
 const candidate=designCopy(d),target=candidate.nodes.find(x=>x.id===n.id),next=upgradedBrick(b,c).next;
 target.bricks[target.bricks.findIndex(x=>x.id===b.id)]=next;
 const errors=brickIssues(candidate).filter(x=>x.level==='error'&&x.node===n.id&&x.code!=='brick-definition-drift');
 if(errors.length){libraryUi.error=errors[0].message;redrawModal();return;}
 recordDesign();n.bricks=target.bricks;designChanged();closeModal();render();canvasAnnounce('Component version reviewed. Screen-specific overrides were preserved.');
}
function componentContentDefaults(c){
 const s=c.contentSpec;return !s?'':JSON.stringify(s,null,2);
}
