// Presentation-only task guidance. Counts describe design artifacts, never test completion.
const workflowUi = {fileQuery:'',fileStatus:'all',matchIndex:0, lastQuery:'', componentTab:'preview'};
const WORKFLOW_STAGES = [
 {id:'brief',label:'Define',detail:'Problem & requirements',view:'prds',icon:'file'},
 {id:'structure',label:'Structure',detail:'Sitemap & layouts',view:'sitemap',icon:'layers'},
 {id:'components',label:'Compose',detail:'Components & actions',view:'components',icon:'box'},
 {id:'review',label:'Review',detail:'Boilerplate & ownership',view:'sitemap',icon:'code'},
 {id:'build',label:'Prepare & build',detail:'This vault & evidence',view:'develop',icon:'terminal'}
];
function workflowHasDesign(){return Boolean(project()?.design);}
function workflowFacts(){
 const d=design(),p=project(),active=d.prds.filter(x=>x.status!=='archived');
 const requirements=active.flatMap(x=>x.requirements).filter(r=>r.status!=='deferred');
 const issues=designIssues(d),blockers=issues.filter(x=>x.level==='error'),warnings=issues.filter(x=>x.level==='warning');
 const used=d.nodes.reduce((sum,n)=>sum+n.components.length,0);
 const mapped=requirements.filter(r=>r.nodes.length||r.components.length||r.patterns.length).length;
 return {d,p,active,requirements,issues,blockers,warnings,used,mapped,hasBrief:active.some(x=>x.problem.trim())||Boolean(d.goal.trim()),
  generated:d.generatedRevision===d.revision&&Object.keys(d.emitted||{}).length>0};
}
function workflowStage(){
 if(modalType==='design-plan')return 'review';
 if(['prds'].includes(state.view))return 'brief';
 if(['sitemap','entities','sources','blueprints'].includes(state.view))return 'structure';
 if(['components','designsystem','patterns'].includes(state.view))return 'components';
 if(state.view==='testdata')return 'review';
 return ['prepare','generate','develop','quality','capabilities','release','runs'].includes(state.view)?'build':null;
}
function workflowStatus(id,f=workflowFacts()){
 if(id==='brief')return f.hasBrief?(f.requirements.length+' requirement'+(f.requirements.length===1?'':'s')):'Start with the problem';
 if(id==='structure')return f.blockers.length?f.blockers.length+' to resolve':f.d.nodes.length+' surfaces outlined';
 if(id==='components')return f.used?f.used+' component bindings':'Reuse where useful';
 if(id==='review')return f.generated?'Preview recorded':f.blockers.length?'Resolve blockers first':'Review the source plan';
 if(!vaultProjectPrepared())return 'Not prepared · design only';
 return f.p?(f.p.quality.verify?.rev===f.p.rev&&f.p.quality.verify?.status==='passed'?'Verification fixture current':'Review verification scopes'):'Create your project';
}
function workflowNext(){
 const f=workflowFacts();
 if(vaultProjectPrepared()&&!f.p.enabled)return {title:'Enable the installed candidate deliberately',description:'Installation and activation are different steps. Review the target vault before enabling the fixture.',label:'Review activation',action:'activate'};
 if(!f.hasBrief)return {title:'Clarify the problem you are solving',description:'A lean brief keeps screens and generated hooks connected to a real user outcome.',label:'Define the plugin',stage:'brief'};
 if(!f.d.nodes.length)return {title:'Choose a starting structure',description:'Use a shell blueprint, or add your first view. You can revise either later.',label:'Choose a blueprint',action:'nav',value:'blueprints'};
 if(f.blockers.length)return {title:'Resolve '+f.blockers.length+' outline issue'+(f.blockers.length===1?'':'s'),description:'Review broken links, incompatible surfaces or component version changes before scaffolding.',label:'Review outline issues',action:'workflow-checks'};
 if(!f.requirements.length)return {title:'Make the outcome testable',description:'Add a requirement and acceptance criteria before business implementation. This is guidance, not a blocker: the source review remains available.',label:'Capture requirements',stage:'brief'};
 if(!f.generated)return {title:'Review what the template will prepare',description:'Inspect file changes and protected business hooks. A preview is not an implementation.',label:'Review boilerplate',stage:'review'};
 if(!vaultProjectPrepared())return {title:'Prepare this vault for development',description:'Add reviewed template files to this root without replacing the design or Obsidian configuration.',label:'Prepare this vault',action:'vault-prepare'};
 return {title:'Continue the first development loop',description:'Implement an application action, then verify the relevant scopes. The concept only simulates execution.',label:'Open development',action:'nav',value:'develop'};
}
function workflowActionButton(next,cls='primary'){
 return button(next.label,next.action||'workflow-stage',next.value||next.stage||'',cls,'arrow');
}
function filteredPlanFiles(){
 const plan=designUi.plan;if(!plan)return [];
 const q=workflowUi.fileQuery.trim().toLowerCase();
 return plan.changes.map((file,index)=>({file,index})).filter(({file})=>(workflowUi.fileStatus==='all'||file.status===workflowUi.fileStatus)&&(!q||(file.path+' '+file.role).toLowerCase().includes(q)));
}
function workflowIssueDestination(issue){
 const code=issue.code||'';
 if(code.startsWith('semantic-'))return {action:'nav',value:'entities'};
 if(code.startsWith('data-source-'))return {action:'nav',value:'sources'};
 if(/requirement|prd|acceptance/.test(code)||code==='goal')return {action:'nav',value:'prds'};
 if(issue.node)return {action:'workflow-node',value:issue.node};
 if(/component|binding|version|slot/.test(code))return {action:'nav',value:'components'};
 return {action:'workflow-checks',value:''};
}
function workflowInlineSummary(){
 const d=design(),p=project();return `${p?'Project':'Draft'} outline · ${d.nodes.length} surfaces · ${allRequirements(d).length} requirements · ${d.library.length} component contracts`;
}
