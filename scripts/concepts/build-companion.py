from pathlib import Path
import argparse, hashlib, json
ROOT=Path(__file__).resolve().parents[2] / "docs/concepts/companion"

def build(output: Path, check: bool = False):
 s=(ROOT/'src/base.html').read_text()
 def change(old,new):
  nonlocal s
  if s.count(old)!=1:raise ValueError(f'Expected one baseline seam, got {s.count(old)}: {old[:90]}')
  s=s.replace(old,new,1)
 change('Concept 01','Concept · Review & recovery')
 change('<!-- Standalone concept. The named inline sections are its editable source; no build step or external runtime is required. -->','<!-- Generated standalone concept. Edit src/ modules, then rebuild. No network or external runtime is required. -->')
 change("['overview','box','Overview'],","['overview','box','Overview'],['prds','file','Product requirements'],['sitemap','layers','Sitemap & views'],['components','box','Component library'],['blueprints','grid','Blueprints'],['patterns','spark','Action patterns'],")
 change("const views={projects:projectsView,overview:overviewView,", "const views={prds:prdWorkspaceView,components:componentLibraryView,sitemap:sitemapView,blueprints:blueprintView,patterns:patternLibrary,projects:workflowStartView,overview:workflowOverview,")
 change("!['projects','capabilities','runs'].includes(state.view)","!['projects','capabilities','runs','prds','sitemap','components','blueprints','patterns'].includes(state.view)")
 change("document.documentElement.dataset.theme=state.settings.theme;const p=project();", "document.documentElement.dataset.theme=state.settings.theme;document.body.classList.toggle('design-workspace',['prds','sitemap','components','blueprints','patterns'].includes(state.view));const p=project();")
 change("schema:1,view:'projects',projects:[]", "schema:1,designDraft:null,view:'projects',projects:[]")
 change("s.projects.every(proj)","s.projects.every(p=>proj(p)&&(!p.design||validSavedDesign(p.design)))&&(!s.designDraft||validSavedDesign(s.designDraft))")
 change("try{const parsed=JSON.parse(raw);", "try{if(raw.length>5000000)throw Error('Bounded storage limit');const parsed=JSON.parse(raw);")
 change("const p=newProject(w);p.enabled=true;", "const p=newProject(w);p.design=createDesign('document-manager');seedIntentExamples(p.design);seedContentBricks(p.design);p.enabled=true;")
 change("return {id:w.id,name:w.name,version:w.version", "return {design:w.design?designCopy(w.design):createDesign(w.blueprint||'workspace'),id:w.id,name:w.name,version:w.version")
 change("const p=project();\n switch(action){", "if(handleEdgeEditingAction(action,value)||handleUnifiedAction(action,value)||handleReferenceAction(action,value)||handleLibraryAction(action,value)||handleBrickAction(action,value)||handleConnectionAction(action,value)||handleFlowAction(action,value)||handleWorkflowAction(action,value)||handleCanvasAction(action,value)||handleProductAction(action,value)||handleDesignAction(action,value))return;\n const p=project();\n switch(action){")
 change("function updateField(el,commit=false){const key=el.dataset.field;", "function updateField(el,commit=false){if(editUnifiedField(el)||editReferenceField(el)||editLibraryField(el,commit)||editBrickField(el,commit)||editConnectionField(el,commit)||editFlowField(el,commit)||editWorkflowField(el)||editCanvasField(el)||editPolishField(el)||editProductField(el,commit)||editDesignField(el,commit))return;const key=el.dataset.field;")
 change("const factories={wizard:wizardView,", "const factories={'edge-detach':edgeDetachDialog,'ref-content':referenceContentDialog,'ref-section':referenceSectionDialog,'library-place':libraryPlacementDialog,'library-upgrade':libraryUpgradeDialog,'library-card-add':libraryCardAddDialog,'brick-edit':brickEditDialog,'brick-palette':brickPaletteDialog,'brick-transfer':brickTransferDialog,'brick-remove':brickRemoveDialog,'brick-method':brickMethodDialog,'brick-starter':brickStarterDialog,'connection-create':connectedCardDialog,'connection-structure':structureRelationshipDialog,'flow-settings':flowSettingsDialog,'flow-intent':flowIntentDialog,'flow-binding':flowBindingDialog,'flow-binding-remove':flowBindingRemoveDialog,'workflow-context':workflowContextDialog,'canvas-card-menu':canvasCardMenu,'canvas-help':canvasHelp,'canvas-edge-remove':canvasEdgeRemoveDialog,'product-component':componentFormDialog,'product-bind':componentBindDialog,'product-upgrade':productUpgradeDialog,'product-component-remove':productDeleteDialog,'product-prd':prdFormDialog,'product-requirement':requirementFormDialog,'product-baseline':baselineReviewDialog,'design-node':designNodeDialog,'design-connect':designConnectDialog,'design-plan':designPlanDialog,'design-goal':designGoalDialog,'design-replace':designReplaceDialog,'design-remove':designRemoveDialog,'design-transfer':designTransferDialog,'design-wizard-confirm':()=>dialogBody('Use this outline in setup?', '<p>Keep the existing identity and environment answers, replace the outline, and review the setup plan again. No real files are changed.</p>',button('Cancel','close','','ghost')+button('Use this outline','design-create-confirm','','primary')),wizard:wizardView,")
 change("${NAV.map(([id,ic,label])=>`<button", "${NAV.map(([id,ic,label])=>`${id==='prds'?'<div class=\"nav-label\">DESIGN</div>':id==='generate'?'<div class=\"nav-label\">BUILD & VERIFY</div>':''}<button")
 # Preserve existing flows while introducing design-first entry.
 change("Less setup.<br>More building.","Less boilerplate.<br>More business logic.")
 change("A guided path from a fresh vault to your first working plugin. The template does the heavy lifting. You stay in control.","Outline the plugin you want to build. Choose its views, connect the journey, and let a reviewed scaffold handle the plumbing.")
 change("<div class=\"row wrap\">${button(state.wizard?'Continue setup':'Create a plugin','create'", "<div class=\"row wrap\">${button('Outline a plugin','outline-start','','primary','layers')}${button(state.wizard?'Continue setup':'Create a plugin','create'")
 change("['Choose your template','Review the plan','Build your plugin','Make it yours']", "['Choose a blueprint','Build the sitemap','Review boilerplate','Write business logic']")
 # Add the outline summary at the beginning of the existing overview.
 pos=s.index('function overviewView()')
 end=s.index('\nfunction recentRuns',pos)
 segment=s[pos:end];segment=segment.replace("return heading(","return outlineOverviewCard()+heading(",1);s=s[:pos]+segment+s[end:]
 pos=s.index('function sourceStep()');end=s.index('\nfunction identityStep',pos)
 segment=s[pos:end];segment=segment.replace('return `<h2>', 'return wizardBlueprintSection()+`<h2>',1);s=s[:pos]+segment+s[end:]
 # Validate stored wizard designs and keep dialog focus across redraws.
 change("wizard(s.wizard)&&s.generator", "wizard(s.wizard)&&(!s.wizard?.design||validSavedDesign(s.wizard.design))&&s.generator")
 change("function redrawModal(){if(document.getElementById('modal').open)drawModal();}", "function redrawModal(){const d=document.getElementById('modal');if(!d.open)return;const old=document.activeElement,field=old?.dataset?.field,id=old?.id;const a=old?.selectionStart,b=old?.selectionEnd;drawModal();const next=id?document.getElementById(id):field?Array.from(d.querySelectorAll('[data-field]')).find(e=>e.dataset.field===field):null;if(next){next.focus();if(typeof a==='number'&&typeof next.setSelectionRange==='function'&&next.tagName!=='SELECT')try{next.setSelectionRange(a,b);}catch{}}}")
 change('<div class="content-layout">','<div id="workflow-rail-holder"></div><div class="content-layout">')
 # Explicit ownership fixes found during the review.
 change("g.plan={rev:p.rev,options:","g.plan={owner:p.id,rev:p.rev,options:")
 change("!g.plan||g.plan.rev!==p.rev", "!g.plan||g.plan.owner!==p.id||g.plan.rev!==p.rev")
 change("state.activeId=value;closeModal();setView('overview');", "state.activeId=value;state.generator.plan=null;designUi.plan=null;designUi.selected=null;closeModal();setView('overview');")
 change("function showModal(type,data=null){modalType=type;", "function showModal(type,data=null){if(!document.getElementById('modal').open)dialogReturnFocus=document.activeElement;prepareDestructiveReview(type,data);modalOriginal=null;modalType=type;")
 change("modalData=null;save();document.getElementById('content').focus();", "modalData=null;save();if(dialogReturnFocus?.isConnected)dialogReturnFocus.focus();else document.getElementById('content').focus();")
 # Enhance the existing tour without changing its storage schema or length.
 change("['generate','generate','Generate, then review'", "['sitemap','sitemap','Outline, then scaffold'") if "['generate','generate','Generate, then review'" in s else None
 # Keep focus across same-view re-renders and add explicit unsaved-form protection.
 change("function render(){", "function render(){const uiFocus=captureUiFocus();destroyFlow();")
 change("document.getElementById('storage-status').className=storageWarning?'storage-alert':'';save();", "document.getElementById('storage-status').className=storageWarning?'storage-alert':'';save();afterCanvasRender();workflowDecorate();restoreUiFocus(uiFocus);")
 change("el?.focus();}\nfunction closeModal", "el?.focus();if(modalOriginal===null)rememberModalForm();workflowModalPolish();}\nfunction closeModal")
 change("document.getElementById('modal').innerHTML=(factories[modalType]", "document.getElementById('modal').classList.toggle('reference-content-modal',modalType==='ref-content');document.getElementById('modal').innerHTML=(factories[modalType]")
 # Insert the new modules before the final render, so no runtime override/eval is needed.
 modules=['state-safety.js','surface-view.js','edge-editing.js','unified-library.js','spatial-model.js','spatial-runtime.js','reference-model.js','reference-views.js','reference-content.js','reference-actions.js','library-model.js','library-views.js','library-actions.js','brick-model.js','brick-views.js','brick-actions.js','connection-model.js','connection-views.js','connection-menu.js','connection-actions.js','flow-model.js','flow-views.js','flow-actions.js','flow-runtime.js','flow-edge.js','workflow-model.js','workflow-views.js','workflow-actions.js','canvas-model.js','canvas-layout.js','canvas-view.js','canvas-actions.js','canvas-pointer.js','interaction-polish.js','product-model.js','component-views.js','prd-views.js','product-actions.js','product-plan.js','design-model.js','design-plan.js','design-views.js','design-dialogs.js','design-actions.js']
 # Register exact JS/CSS inputs, including retained hash-verified upstream CSS.
 styles=['design.css','product.css','canvas.css','workflow.css','flow.css','connection.css','bricks.css','library.css','reference.css','unified.css','surface.css']
 vendor_scripts=['vue.runtime.global.prod.js','pinia.iife.prod.js','vue-flow-core.iife.js']
 vendor_inputs=vendor_scripts+['vue-flow.css','vue-flow.scoped.css']
 source_inputs=modules+['brick-catalog.js','catalog.js','canvas-catalog.js','flow-catalog.js']+styles
 inputs={'src/'+name for name in source_inputs}|{'vendor/'+name for name in vendor_inputs}
 config=json.loads((ROOT.parents[2]/'.fallowrc.json').read_text())
 prefix='docs/concepts/companion/'
 registered=[entry[len(prefix):] for entry in config['entry'] if entry.startswith(prefix)]
 actual={file.relative_to(ROOT).as_posix() for folder in ['src','vendor'] for file in (ROOT/folder).rglob('*') if file.suffix in {'.js','.css'}}
 if inputs!=set(registered) or len(registered)!=len(inputs) or inputs!=actual:
  raise ValueError('Concept assembly/analyzer entry inventory differs; do not hide unassembled source')
 # Pin the provenance manifest too: edits cannot legitimize altered vendor bytes.
 provenance=(ROOT/'vendor/provenance.json').read_bytes()
 if hashlib.sha256(provenance).hexdigest()!='96ecfefb110fee7f89c3276bc672c2b5f866a6d1cdc9f9e880fe6ffb5e00e5ea':
  raise ValueError('Unreviewed vendor provenance')
 for entry in json.loads(provenance)['files']:
  raw=(ROOT/'vendor'/entry['path']).read_bytes()
  if len(raw)!=entry['bytes'] or hashlib.sha256(raw).hexdigest()!=entry['sha256']:
   raise ValueError('Unreviewed vendor input: '+entry['path'])
 extension='\n'.join((ROOT/'src'/m).read_text() for m in modules)
 change("window.addEventListener('beforeunload',save);\nrender();", "window.addEventListener('beforeunload',save);\n"+extension+"\nrender();")
 change('<script>','<script>\n'+(ROOT/'src/brick-catalog.js').read_text()+'\n'+(ROOT/'src/catalog.js').read_text()+'\n'+(ROOT/'src/canvas-catalog.js').read_text()+'\n'+(ROOT/'src/flow-catalog.js').read_text()+'\nlet dialogReturnFocus=null;\n')
 change('</style>',''.join((ROOT/'src'/name).read_text() for name in styles)+'\n</style>')
 # Local pinned vendors only. Preserve upstream licenses and no runtime requests.
 vendor=ROOT/'vendor'
 css=(vendor/'vue-flow.scoped.css').read_text()
 s=s.replace('<style>', '<style>\n'+css+'\n',1)
 def vendor_text(name):
  raw=(vendor/name).read_bytes()
  text=raw.decode('utf-8')
  if name=='vue-flow-core.iife.js':
   # The retrieved IIFE emits the environment token as an unbound identifier.
   # Keep raw vendor bytes; adapt exactly the reviewed occurrence on assembly.
   if hashlib.sha256(raw).hexdigest()!='92cd354fac92f7a998565c40d6e3b59d9031dfc56db4d393a524cdb57cf27edc':raise ValueError('Unreviewed Vue Flow vendor input')
   old='productionEnvs.includes(production || "")'
   if text.count(old)!=1:raise ValueError('Vue Flow environment replacement no longer matches')
   text=text.replace(old,'productionEnvs.includes("production" || "")',1)
  return text.replace('</script','<\\/script')
 bundles='\n'.join('<script data-vendor="'+name+'">'+vendor_text(name)+'</script>' for name in vendor_scripts)
 s=s.replace('<script>',bundles+'\n<script>',1)
 notices=(vendor/'THIRD_PARTY_NOTICES.txt').read_text().replace('--','—')
 s=s.replace('</head>', '<!--\n'+notices+'\n-->\n</head>',1)
 encoded=s.encode('utf-8')
 if check:
  if not output.exists() or output.read_bytes()!=encoded:
   raise ValueError('Generated concept differs; rebuild before qualification')
 else:
  output.parent.mkdir(parents=True,exist_ok=True)
  output.write_bytes(encoded)
 print(('Verified' if check else 'Generated'),len(encoded),'bytes; SHA-256',hashlib.sha256(encoded).hexdigest())

if __name__=='__main__':
 parser=argparse.ArgumentParser(description='Compose the offline companion concept; no runtime commands are executed.')
 parser.add_argument('--output',type=Path,default=ROOT/'index.html')
 parser.add_argument('--check',action='store_true')
 args=parser.parse_args()
 build(args.output,args.check)
