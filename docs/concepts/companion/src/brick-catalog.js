const LIBRARY_LIMIT=64;
// Content planning units, not executable components or inferred business logic.
const BRICK_KINDS={
 heading:{label:'Heading & context',group:'content',help:'Orient the user: title, context and supporting copy.'},
 text:{label:'Text & explanation',group:'content',help:'Describe the information or guidance the user needs.'},
 navigation:{label:'Navigation',group:'navigation',help:'Plan entry points within this surface.'},
 toolbar:{label:'Search & filters',group:'navigation',help:'Locate content and adjust the current collection.'},
 list:{label:'Record list',group:'data',help:'A scannable collection of records or notes.'},
 table:{label:'Data table',group:'data',help:'Compare records across meaningful columns.'},
 board:{label:'Board',group:'data',help:'Organize records into declared groups or states.'},
 detail:{label:'Record details',group:'data',help:'Explain one record, its properties and context.'},
 form:{label:'Input form',group:'input',help:'Describe input, validation and cancellation requirements.'},
 chart:{label:'Chart / summary',group:'data',help:'Name the question the visualization must answer.'},
 media:{label:'Image / attachment',group:'content',help:'Plan a visual or document without fetching an asset.'},
 actions:{label:'Primary actions',group:'action',help:'Describe user decisions and expected outcomes.'},
 empty:{label:'Empty state',group:'feedback',help:'Explain why there is no content and what to do next.'},
 notice:{label:'Status / recovery',group:'feedback',help:'Plan progress, failure and recovery communication.'}
};
const BRICK_GROUPS={navigation:'Navigation',content:'Content',data:'Data',input:'Input',action:'Action',feedback:'Feedback'};
const BRICK_LIMITS={perSurface:24,total:400,title:100,purpose:800,content:4000};
const brickUi={form:null,error:'',selected:null,node:null,query:'',move:null,drag:null};
function canHaveBricks(n){return !!n&&['view','page','modal','settings'].includes(n.kind);}
function bricksOf(n){return n?.bricks||[];}
function brickDisplay(d=design()){return d.canvas?.brickDisplay||'wireframes';}
function brickSurfaceSize(n,d=design()){
 const mode=brickDisplay(d);
 if(mode==='structure'||!canHaveBricks(n))return {width:MAP_SIZE.w,height:MAP_SIZE.h};
 return {width:MAP_SIZE.w,height:236+Math.max(1,bricksOf(n).length)*(mode==='wireframes'?76:40)};
}
function freshBrickId(d){let id;do{id='brick-'+d.nextId++;}while(d.nodes.some(n=>bricksOf(n).some(b=>b.id===id)));return id;}
function blankBrick(d,n,kind='text'){
 const c=brickDefinition(d,kind);if(!c)throw Error('Restore an available '+BRICK_KINDS[kind].label+' definition in the component library first.');
 return attachBrickDefinition({schema:1,id:freshBrickId(d),kind,title:c.contentSpec.title,purpose:c.contentSpec.purpose,content:c.contentSpec.content,region:componentSlots(n).includes(c.contentSpec.region)?c.contentSpec.region:componentSlots(n)[0]||'content',component:null},c);
}
function seedContentBricks(d){
 const stacks={workspace:[['heading','Project overview'],['navigation','Collections & capture'],['chart','Work needing attention']],collection:[['toolbar','Find a note'],['table','Notes collection'],['empty','No matching notes']],detail:[['heading','Record context'],['detail','Note and properties'],['actions','Open note / return']], 'capture-note':[['heading','Capture an idea'],['form','Essential note fields'],['actions','Save or cancel']],preferences:[['heading','Plugin preferences'],['form','Paths & notifications'],['notice','Changes saved']]};
 for(const n of d.nodes){const stack=stacks[n.slug];if(stack)n.bricks=stack.map(([kind,title])=>({...blankBrick(d,n,kind),title}));}
 // Examples are explicitly seeded only on the user's Explore example route.
}
