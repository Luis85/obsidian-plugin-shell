function handleDesignAction(action,value){
 if(!action.startsWith('design-')&&!action.startsWith('blueprint-')&&action!=='outline-start')return false;
 const d=design(),n=selectedNode();
 if(state.activeRun&&!['design-select','design-mode','design-file'].includes(action)){notify('Finish or cancel the active simulation before changing its design.');return true;}
 switch(action){
  case 'outline-start':state.activeId=null;designUi.selected=null;designUi.plan=null;closeModal();setView('sitemap');break;
  case 'blueprint-choose':showModal('design-replace',value);break;
  case 'blueprint-apply':{recordDesign();const fresh=replacementDesign(value);Object.assign(d,fresh);designChanged();designUi.selected=d.nodes[0]?.id;closeModal();setView('sitemap');break;}
  case 'design-select':showMapNode(value);break;
  case 'design-mode':designUi.mode=value;render();break;
  case 'design-add':startNodeForm(value);break;
  case 'design-edit':startNodeForm('view',value);break;
  case 'design-save':saveDesignNode();break;
  case 'design-goal':designUi.goalDraft={goal:d.goal,platform:d.platform,owner:designOwner(),revision:d.revision};showModal('design-goal');break;
  case 'design-goal-save':{const f=designUi.goalDraft;if(f.owner!==designOwner()||f.revision!==d.revision){notify('The outline changed; reopen product intent.');break;}recordDesign();d.goal=f.goal;d.platform=f.platform;designChanged();closeModal();render();break;}
  case 'design-undo':designHistory('undo');break;
  case 'design-redo':designHistory('redo');break;
  case 'design-entry':recordDesign();d.nodes.forEach(n=>n.entry=n.id===value);designChanged();render();break;
  case 'design-move':{
   const [id,delta]=value.split(':');const node=d.nodes.find(n=>n.id===id);const siblings=d.nodes.filter(n=>n.parent===node.parent);const si=siblings.indexOf(node),other=siblings[si+Number(delta)];
   if(other){recordDesign();const a=d.nodes.indexOf(node),b=d.nodes.indexOf(other);[d.nodes[a],d.nodes[b]]=[d.nodes[b],d.nodes[a]];designChanged();render();}else notify('Already at the edge of this group.');break;
  }
  case 'design-duplicate':duplicateDesignSurface(value);break;
  case 'design-remove':showModal('design-remove',value);break;
  case 'design-remove-confirm':{if(!validDestructiveReview('design-remove',value))break;recordDesign();const ids=nodeDescendants(d,value);d.nodes=d.nodes.filter(n=>!ids.has(n.id));d.links=d.links.filter(e=>!ids.has(e.from)&&!ids.has(e.to));designChanged();designUi.selected=d.nodes[0]?.id;closeModal();render();notify('Removed from the outline only. Existing source previews are retained.');break;}
  case 'design-connect':{
   const available=d.nodes.filter(n=>n.kind!=='group');if(available.length<2){notify('Add two surfaces to connect.');break;}
   const from=n?.kind!=='group'&&n?n:available[0];const to=available.find(x=>x.id!==from.id);
   designUi.form={from:from.id,to:to.id,label:'Open '+to.label,owner:designOwner(),baseRevision:d.revision};designUi.error='';showModal('design-connect');break;
  }
  case 'design-link-save':saveTypedConnection();break;
  case 'design-unlink':recordDesign();d.links=d.links.filter(e=>e.id!==value);designChanged();render();break;
  case 'design-pattern':{
   const p=PATTERNS.find(p=>p.id===value);if(!n||n.kind==='group'||!p)break;recordDesign();n.patterns=n.patterns.includes(value)?n.patterns.filter(id=>id!==value):[...n.patterns,value];designChanged();render();notify('Updated '+n.label+' in the outline. No code executed.');break;
  }
  case 'design-plan':workflowUi.fileQuery='';workflowUi.fileStatus='all';reviewDesignPlan();break;
  case 'design-file':designUi.file=Number(value);redrawModal();break;
  case 'design-apply':simulateDesignApply();break;
  case 'design-transfer':designUi.error='';designUi.transfer={text:JSON.stringify(portableDesign(),null,2),owner:designOwner(),revision:d.revision,snapshot:JSON.stringify(designSnapshot(d))};showModal('design-transfer');break;
  case 'design-import':importReviewedBlueprint();break;
  case 'design-export':if(modalType==='design-transfer'){downloadText({text:JSON.stringify(portableDesign(),null,2),filename:'plugin-blueprint.json'});break;}showModal('copy',{title:'Data-only plugin blueprint. No paths, approval or executable code.',text:JSON.stringify(portableDesign(),null,2),filename:'plugin-blueprint.json'});break;
  case 'design-bundle':showModal('copy',{title:'Concept preview bundle. NOT an installable plugin; business hooks and test obligations remain incomplete.',text:JSON.stringify({kind:'concept-scaffold-preview',schema:1,executable:false,blueprint:portableDesign(),files:designUi.plan?.changes||[],realCommandsExecuted:0},null,2),filename:'companion-scaffold-preview.json'});break;
  case 'design-create':{
   if(project()){notify('The outline already belongs to a project. Use Review boilerplate to extend it.');break;}
   const errors=designIssues(d).filter(i=>i.level==='error');if(errors.length){designUi.mode='issues';render();notify('Resolve outline blockers before creating the project.');break;}
   if(state.wizard){showModal('design-wizard-confirm');break;}createWizardFromDesign();break;
  }
  case 'design-create-confirm':createWizardFromDesign();break;
  case 'design-open-from-wizard':state.designDraft=designCopy(state.wizard.design||createDesign(state.wizard.blueprint||'workspace'));state.activeId=null;designUi.selected=null;closeModal();setView('sitemap');break;
  default:return false;
 }
 save();return true;
}
function createWizardFromDesign(){const w=state.wizard||newWizard();w.rev++;w.plan=null;w.approved=false;w.status='draft';w.step=Math.min(w.step,2);w.blueprint=design().blueprint;w.design={...createDesign('blank'),...designSnapshot(design())};state.wizard=w;designUi.plan=null;showModal('wizard');}
function wizardBlueprintSection(){const w=state.wizard,b=BLUEPRINTS.find(b=>b.id===(w.blueprint||'workspace'));return `<div class="card mt16"><div class="section-head"><h3>Plugin shell blueprint</h3>${badge('Design only','purple')}</div><p>${esc(b.name)} · ${w.design?.nodes.length??createDesign(b.id).nodes.length} outlined surfaces</p>${button('Design sitemap & layouts','design-open-from-wizard','','small','layers')}<p class="tiny muted mt16 mb0">Source version and shell blueprint are separate choices. Setup uses the existing CLI; sitemap generation requires a new shared maker.</p></div>`;}
function outlineOverviewCard(){const d=design();return `<section class="card outline-overview"><div><span class="eyebrow">PLUGIN BLUEPRINT</span><h2>${esc(BLUEPRINTS.find(b=>b.id===d.blueprint)?.name||'Custom outline')}</h2><p class="mb0">${d.nodes.filter(n=>n.kind==='view').length} native views · ${d.nodes.filter(n=>n.kind==='page').length} internal screens · ${d.nodes.reduce((n,x)=>n+x.patterns.length,0)} pattern selections</p></div><div class="row wrap">${button('Edit sitemap','nav','sitemap','primary small','layers')}${button('Add a view','design-add','view','small','plus')}</div></section>`;}


function importReviewedBlueprint(){
 const f=designUi.transfer,d=design();
 if(f)f.text=document.getElementById('blueprint-json')?.value??f.text;
 try{
  if(!f||f.owner!==designOwner()||f.revision!==d.revision||f.snapshot!==JSON.stringify(designSnapshot(d)))throw Error('The outline changed after this import review opened. Copy your draft and reopen the review. Nothing was replaced.');
  importDesign(f.text);closeModal();render();notify('Validated blueprint imported. Execution trust was not imported.');
 }catch(e){designUi.error=e instanceof SyntaxError?'Invalid JSON. Correct the syntax below; your pasted text has been kept.':e.message;redrawModal();document.getElementById('blueprint-json')?.focus();}
}
function duplicateDesignSurface(id){
 const d=design(),original=d.nodes.find(n=>n.id===id);if(!original)return;
 if(d.nodes.length>=DESIGN_LIMITS.nodes){notify('The concept supports up to 60 surfaces.');return;}
 if(d.nodes.reduce((sum,n)=>sum+bricksOf(n).length,0)+bricksOf(original).length>BRICK_LIMITS.total){notify('Cannot duplicate: the outline would exceed 400 content blocks. Your existing content is unchanged.');return;}
 const candidate=designCopy(d),copy={...designCopy(original),id:'node-'+candidate.nextId++,slug:allocateSurfaceCode(d,original.label),label:original.label.slice(0,115)+' copy',entry:false};
 if(copy.bricks)copy.bricks=copy.bricks.map(b=>({...b,id:freshBrickId(candidate)}));candidate.nodes.push(copy);
 const errors=newDesignErrors(d,candidate);if(errors.length){notify('Cannot duplicate: '+errors[0].message);return;}
 recordDesign();d.nodes=candidate.nodes;d.nextId=candidate.nextId;canvasState(d);assignCardToSection(d,copy.id,sectionForCard(d,original.id));designChanged();designUi.selected=copy.id;render();notify('Surface duplicated. Children and connections are not duplicated.');
}
