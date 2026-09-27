// Trusted composition bridge. The browser concept's existing project and persistence remain authoritative.
let jmEditor=null;
function jmUnmount(){jmEditor?.unmount();jmEditor=null;}
function jmRead(){const p=project();if(!p)throw Error('Define a project first.');return {revision:String(p.design.revision),writable:!storageWarning&&!state.activeRun&&!tdUi.busy,design:companionProjectDocument(p).design};}
function jmValidate(candidate){const whole=companionProjectDocument();CompanionJourney.validateAuthoringDocument({...whole,design:candidate});if(!structuralDesign(candidate))throw Error('The surface contains an unsupported field or reference.');}
function jmMount(){
 const root=document.getElementById('jm-root');if(!root||jmEditor||!project())return;
 jmEditor=CompanionJourney.mount(root,{
  selected:designUi.selected,read:async()=>jmRead(),validate:jmValidate,
  save:async request=>{
   const p=project();if(!p||state.activeRun||tdUi.busy||storageWarning)return {status:'failed',certainty:'unchanged'};
   const before=jmRead();
   if(before.revision!==request.expectedRevision||CompanionJourney.canonicalKey(before.design)!==request.beforeKey)return {status:'conflict'};
   try{companionCanReplace(companionProjectToken());jmValidate(request.design);}catch{return {status:'conflict'};}
   const old=p.design;
   p.design={...old,...designCopy(request.design),revision:old.revision+1};
   if(!saveConceptState()){p.design=old;return {status:'failed',certainty:'unknown'};}
   designUi.plan=null;return {status:'committed',snapshot:jmRead()};
  },
  select:id=>{designUi.selected=id;},openPage:id=>veOpenPage(id),openComponents:()=>setView('components'),openSources:()=>setView('sources'),
  importProject:()=>openCompanionImport(),exportProject:()=>companionExport(),
 });
}
function jmValidFields(value){try{CompanionJourney.validateSitemapModel(value);return true;}catch{return false;}}
function jmSeed(p){
 const d=p.design,bySlug=new Map(d.nodes.map(n=>[n.slug,n]));
 const paths={overview:'/',starters:'/starters',requirements:'/requirements',storymaps:'/storymaps','storymap-detail':'/storymaps/editor',sitemap:'/sitemap',pages:'/pages','page-editor':'/pages/editor','component-editor':'/components/editor',entities:'/entities',sources:'/sources','test-data':'/test-data','design-system':'/design-system',components:'/components',blueprints:'/blueprints',patterns:'/patterns',prepare:'/prepare',generate:'/generate',develop:'/develop',quality:'/quality',capabilities:'/capabilities',release:'/release',runs:'/runs'};
 d.sitemap={schema:1,routes:Object.entries(paths).map(([slug,path])=>({id:'route-'+slug,surface:bySlug.get(slug).id,path})),journeys:[]};
 for(const [id,name,slugs] of [['design','Design a plugin',['overview','requirements','sitemap','page-editor']],['starter','Start from a template',['overview','starters','import-project']],['delivery','Prepare and verify',['prepare','develop','quality','release']]]){
  d.sitemap.journeys.push({id:'journey-'+id,name,steps:slugs.map((slug,i)=>{const surface=bySlug.get(slug).id,prior=i?bySlug.get(slugs[i-1]).id:null;return {id:'step-'+(i+1),surface,via:i?d.links.find(e=>e.from===prior&&e.to===surface)?.id??null:null};})});
 }
 const groups=[['design','Product design',['overview','starters','requirements','storymaps','storymap-detail','sitemap','pages','page-editor','component-editor','components','blueprints','patterns','design-system']],['data','Data and contracts',['entities','sources','test-data']],['delivery','Development and delivery',['prepare','generate','develop','quality','capabilities','release','runs']]];
 d.features={schema:1,items:groups.map(([id,name,slugs])=>{const surfaces=slugs.map(s=>bySlug.get(s).id);return {id:'feature-'+id,name,surfaces,entryPoints:[surfaces[0]],components:[],requirements:d.prds.flatMap(prd=>prd.requirements).filter(r=>r.nodes.some(n=>surfaces.includes(n))).map(r=>r.id),dependsOn:[]};})};
 d.schema=6;return p;
}
