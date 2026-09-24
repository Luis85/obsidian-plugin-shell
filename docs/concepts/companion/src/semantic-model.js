// Data-only semantic layer. Native persistence and relationship resolution are separate adapters.
const ER_TYPES=Object.freeze({text:'Text',list:'List',number:'Number',checkbox:'Checkbox',date:'Date',datetime:'Date & time',tags:'Tags'});
const ER_CARDS=['0..1','1','0..*','1..*'];
const ER_LIMITS=Object.freeze({entities:60,properties:40,relationships:160,sections:16});
const erUi={selected:null,edge:null,query:'',mode:'map',form:null,error:'',app:null,api:null,serial:0,drag:null};
function emptySemantic(){return {schema:1,nextId:1,entities:[],relationships:[],sections:[],canvas:{positions:{},viewport:{x:40,y:40,zoom:1},snap:true}};}
function semanticModel(d=design()){if(!d.semantic)d.semantic=emptySemantic();return d.semantic;}
function semanticId(m,prefix){if(!Number.isSafeInteger(m.nextId)||m.nextId>=Number.MAX_SAFE_INTEGER-100000)throw Error('Semantic ID capacity reached.');return 'er-'+prefix+'-'+m.nextId++;}
function semanticName(label){return String(label).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,54).replace(/-$/,'')||'entity';}
function semanticPascal(slug){return slug.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join('');}
function erPlain(v){return !!v&&typeof v==='object'&&!Array.isArray(v);}
function erKeys(v,keys){return erPlain(v)&&Object.keys(v).every(k=>keys.includes(k));}
function erText(v,n=120){return typeof v==='string'&&v.length<=n;}
function semanticGeneration(d){const m=d.semantic;if(!m||!m.entities.length)return undefined;const ids=[...m.entities,...m.entities.flatMap(e=>e.properties),...m.relationships].map(x=>Number(x.id.split('-').at(-1)));return {...emptySemantic(),nextId:Math.max(0,...ids)+1,entities:m.entities.map(e=>({...designCopy(e),section:null})),relationships:designCopy(m.relationships)};}
function erShape(m){
 if(m===undefined)return true;
 if(!erKeys(m,['schema','nextId','entities','relationships','sections','canvas'])||m.schema!==1||!Number.isSafeInteger(m.nextId)||m.nextId<1||m.nextId>=Number.MAX_SAFE_INTEGER-100000)return false;
 if(!Array.isArray(m.entities)||m.entities.length>ER_LIMITS.entities||!Array.isArray(m.relationships)||m.relationships.length>ER_LIMITS.relationships||!Array.isArray(m.sections)||m.sections.length>ER_LIMITS.sections)return false;
 const id=(v,k)=>typeof v==='string'&&new RegExp('^er-'+k+'-[1-9][0-9]*$').test(v)&&Number.isSafeInteger(Number(v.split('-').at(-1)))&&Number(v.split('-').at(-1))<m.nextId;
 if(!m.entities.every(e=>erKeys(e,['id','name','slug','folder','description','section','properties'])&&id(e.id,'entity')&&erText(e.name,80)&&erText(e.slug,60)&&erText(e.folder,120)&&erText(e.description,1000)&&(e.section===null||id(e.section,'section'))&&Array.isArray(e.properties)&&e.properties.length<=ER_LIMITS.properties&&e.properties.every(p=>erKeys(p,['id','key','type','required','defaultValue'])&&id(p.id,'property')&&erText(p.key,60)&&Object.hasOwn(ER_TYPES,p.type)&&typeof p.required==='boolean'&&(!Object.hasOwn(p,'defaultValue')||erDefaultValid(p.type,p.defaultValue)))))return false;
 if(!m.relationships.every(r=>erKeys(r,['id','name','source','target','key','sourceCard','targetCard','onDelete'])&&id(r.id,'relationship')&&erText(r.name,80)&&id(r.source,'entity')&&id(r.target,'entity')&&erText(r.key,60)&&ER_CARDS.includes(r.sourceCard)&&ER_CARDS.includes(r.targetCard)&&r.onDelete==='restrict'))return false;
 if(!m.sections.every(s=>erKeys(s,['id','name'])&&id(s.id,'section')&&erText(s.name,80)))return false;
 const c=m.canvas;if(!erKeys(c,['positions','viewport','snap'])||!erPlain(c.positions)||Object.keys(c.positions).length>60||!Object.entries(c.positions).every(([k,p])=>id(k,'entity')&&erKeys(p,['x','y'])&&[p.x,p.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=100000))||typeof c.snap!=='boolean')return false;
 return erKeys(c.viewport,['x','y','zoom'])&&[c.viewport.x,c.viewport.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=200000)&&Number.isFinite(c.viewport.zoom)&&c.viewport.zoom>=.15&&c.viewport.zoom<=2;
}
function erDefaultValid(type,value){
 if(type==='text')return erText(value,500)&&!/[\r\n]/.test(value);
 if(type==='number')return typeof value==='number'&&Number.isFinite(value);
 if(type==='checkbox')return typeof value==='boolean';
 if(type==='list')return Array.isArray(value)&&value.length<=40&&value.every(v=>erText(v,200)||typeof v==='number'&&Number.isFinite(v));
 if(type==='tags')return Array.isArray(value)&&value.length<=40&&new Set(value).size===value.length&&value.every(v=>typeof v==='string'&&/^[\p{L}_][\p{L}\p{N}_/-]*$/u.test(v)&&!v.endsWith('/')&&!v.includes('//'));
 if(type==='date'||type==='datetime'){
  if(typeof value!=='string'||!new RegExp(type==='date'?'^\\d{4}-\\d{2}-\\d{2}$':'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?$').test(value))return false;
  const dt=new Date(value.slice(0,10)+'T00:00:00Z');if(!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==value.slice(0,10))return false;
  return type==='date'||Number(value.slice(11,13))<24&&Number(value.slice(14,16))<60&&(value.length===16||Number(value.slice(17,19))<60);
 }
 return false;
}
function erPropertyKey(key){return /^[a-z][a-z0-9_]{0,59}$/.test(key)&&!['id','type','__proto__','constructor','prototype'].includes(key);}
function erFolder(path){return erText(path,120)&&path.split('/').every(p=>/^[A-Za-z][A-Za-z0-9 _-]*$/.test(p)&&!p.endsWith(' ')&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(p));}
function erMany(card){return card.endsWith('*');}
function erFields(e,m){return [...e.properties,...m.relationships.filter(r=>r.source===e.id).map(r=>({id:r.id,key:r.key,type:erMany(r.targetCard)?'list':'text',required:r.targetCard.startsWith('1'),relationship:r.id,target:r.target}))];}
function semanticIssues(d){
 const m=d.semantic,out=[];if(!m)return out;
 const add=(code,message,entity=null)=>out.push({level:'error',code:'semantic-'+code,message,entity});
 if(!erShape(m)){add('shape','The semantic layer has an unsupported schema, malformed fields or exceeded limits.');return out;}
 const ids=new Set(),slugs=new Set(),names=new Set(),folders=new Set(),types=new Map();
 const unique=id=>{if(ids.has(id))add('id','Semantic IDs must be unique.');ids.add(id);};
 const sections=new Set(m.sections.map(s=>s.id));for(const s of m.sections){unique(s.id);if(!s.name.trim())add('section','Give the section a name.');}
 for(const e of m.entities){
  unique(e.id);if(!e.name.trim()||/[\r\n]/.test(e.name)||names.has(e.name.toLowerCase()))add('name','Entity names must be nonempty and unique.',e.id);names.add(e.name.toLowerCase());
  if(!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(e.slug)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(e.slug)||slugs.has(e.slug))add('slug','Choose a unique portable entity code name.',e.id);slugs.add(e.slug);
  if(!erFolder(e.folder)||folders.has(e.folder.toLowerCase()))add('folder','Each entity needs a unique, safe note folder relative to the generated plugin’s runtime vault.',e.id);folders.add(e.folder.toLowerCase());
  if(e.section&&!sections.has(e.section))add('section','The selected section no longer exists.',e.id);
  const keys=new Set();for(const p of erFields(e,m)){
   if(!p.relationship)unique(p.id);
   if(p.relationship&&['tags','aliases','cssclasses'].includes(p.key))add('relationship-key','Use a dedicated relationship key, not Obsidian metadata.',e.id);
   if(!erPropertyKey(p.key)||keys.has(p.key))add('property','Property keys must be unique, lowercase snake_case; id and type are managed.',e.id);keys.add(p.key);
   if(p.key==='tags'&&p.type!=='tags'||p.type==='tags'&&p.key!=='tags'||['aliases','cssclasses'].includes(p.key)&&p.type!=='list')add('reserved','Use Tags only for tags, and List for aliases and cssclasses.',e.id);
   if(types.has(p.key)&&types.get(p.key)!==p.type)add('global-type','Obsidian property “'+p.key+'” has conflicting types across entities.',e.id);types.set(p.key,p.type);
  }
 }
 const pairs=new Set();for(const r of m.relationships){unique(r.id);if(!r.name.trim())add('relationship-name','Name the relationship.');if(!m.entities.some(e=>e.id===r.source)||!m.entities.some(e=>e.id===r.target))add('endpoint','Relationship endpoints must reference existing entities.');const pair=r.source+':'+r.key;if(pairs.has(pair))add('ownership','A stored relationship property may have only one owner.');pairs.add(pair);}
 for(const id of Object.keys(m.canvas.positions))if(!m.entities.some(e=>e.id===id))add('position','Entity arrangement references a missing entity.');
 for(const n of d.nodes||[])if(n.entity?.startsWith('er-entity-')&&!m.entities.some(e=>e.id===n.entity))add('binding',n.label+': select a declared entity; free text is not a schema.',null);
 return out;
}
function semanticArrange(m){
 let y=60;const groups=[null,...m.sections.map(s=>s.id)];
 for(const group of groups){const items=m.entities.filter(e=>e.section===group);if(!items.length)continue;
  let rowY=y;for(let i=0;i<items.length;i+=3){const row=items.slice(i,i+3);row.forEach((e,j)=>m.canvas.positions[e.id]={x:60+j*350,y:rowY});rowY+=Math.max(...row.map(e=>erCardHeight(e,m)))+70;}y=rowY+70;
 }
}
function erCardHeight(e,m){return 144+(Math.min(erFields(e,m).length,8)+2)*25+(erFields(e,m).length>8?28:0);}
