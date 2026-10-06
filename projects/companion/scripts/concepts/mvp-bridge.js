// Trusted composition bridge. The browser concept's existing project and persistence remain authoritative.
let jmEditor=null,jmOwner=null;
// UI state only, keyed by the actual project object. Replacing/importing a project cannot leak a prior lens or filter.
const jmViews=new WeakMap();
function jmUnmount(){if(jmEditor&&jmOwner)jmViews.set(jmOwner,jmEditor.viewState());jmEditor?.unmount();jmEditor=null;jmOwner=null;}
function jmRead(){const p=project();if(!p)throw Error('Define a project first.');return {revision:String(p.design.revision),writable:!storageWarning&&!state.activeRun&&!tdUi.busy,design:companionProjectDocument(p).design};}
function jmValidate(candidate){const whole=companionProjectDocument();CompanionJourney.validateAuthoringDocument({...whole,design:candidate});if(!structuralDesign(candidate))throw Error('The surface contains an unsupported field or reference.');}
function jmMount(){
 const root=document.getElementById('jm-root');if(!root||jmEditor||!project())return;
 jmOwner=project();
 jmEditor=CompanionJourney.mount(root,{
  selected:designUi.selected,viewState:jmViews.get(jmOwner),read:async()=>jmRead(),validate:jmValidate,
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
// The authoring build opens on the empty starter workspace instead of the concept's design-first welcome.
function jmWelcomeView() {
  return heading('Welcome to Workbench', 'Choose a starter or begin with a blank project. Nothing is created before review.') +
    `<section class="starter-intro" data-onboarding="empty"><div><span class="eyebrow">FOCUS ON YOUR IDEA</span><h2>Your workspace is empty.</h2><p>Load an editable JSON starter from the separate starter pack, or create a blank project. Then review your identity, folders and setup steps.</p><div class="row wrap">${button('Choose a starter','nav','starters','primary','grid')}${button('Blank project','starter-blank','','','plus')}</div></div><div class="starter-boundary"><strong>No hidden example project</strong><p>The Companion golden template and feature showcase are external JSON definitions. Existing saved projects reopen without being replaced.</p>${button('Import existing project','project-import','','ghost','file')}</div></section>${vaultLegacyBanner()}`;
}
