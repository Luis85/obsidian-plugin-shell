"""Browser-concept qualification, not Obsidian/native/CLI verification.
Uses exact HTML injection because file navigation is blocked by managed Chromium.
Storage cases use an explicit stand-in; no file-origin persistence claim is made.
"""
from pathlib import Path
import argparse, json, time, hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--html',default=str(R/'docs/concepts/companion/index.html'));a.add_argument('--out',default=str(R/'reports/concepts/companion-studio'));a.add_argument('--browser',default='/usr/bin/chromium');args=a.parse_args()
HTML=Path(args.html);OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];started=time.time()
def check(name,ok=True,scope='browser concept'):
    checks.append({'name':name,'passed':bool(ok),'scope':scope});assert ok,name
    print('PASS',name,flush=True)
def act(p,action,value=None,scope=''):
    # Existing workflows now use the linear outline and card action menu.
    if action=='design-select' and not p.locator('.outline-tree').count():
        if not p.locator('[data-action="canvas-outline"]').count():act(p,'design-mode','map')
        act(p,'canvas-outline')
    if action in ['design-duplicate','design-remove'] and not p.locator(f'[data-action="{action}"][data-value="{value}"]').count():
        act(p,'canvas-card-menu',value);action='canvas-menu-'+('duplicate' if action=='design-duplicate' else 'remove')
    # Concept 04 discloses existing component operations through explicit tabs.
    if p.locator('.library-workspace').count():
        tab = 'usage' if action in ['product-component-unbind','product-component-upgrade'] else 'preview' if action == 'product-story' else None
        if tab and not p.locator(f'[data-action="{action}"]').count():
            p.locator(f'[data-action="workflow-component-tab"][data-value="{tab}"]').click()
    q=f'{scope} [data-action="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
    p.locator(q.strip()).first.click()
    # Concept 03 makes discarding edited forms deliberate; retain all earlier assertions.
    if action=='close' and p.locator('#discard-dialog[open]').count():p.locator('#discard-confirm').click()
def nav(p,view):act(p,'nav',view,'#sidebar')
def value(p,expression):return p.evaluate(expression)
def close(p):
    if p.locator('#modal').evaluate('e=>e.open'):act(p,'close')
def wait(p):
    deadline=time.monotonic()+10
    while p.evaluate('state.activeRun!==null'):
        assert time.monotonic()<deadline,'Simulation did not settle'
        p.wait_for_timeout(50)
def form(p,key,text):p.locator('[data-field="product-form-'+key+'"]').fill(text)
def shot(p,name):p.screenshot(path=str(OUT/name))
def wizard(p):
    act(p,'create',scope='main');act(p,'wizard-next');act(p,'wizard-next');act(p,'acquire');act(p,'wizard-next');act(p,'wizard-next')
    p.locator('[data-field="w-bound"]').check();act(p,'wizard-next');p.locator('[data-field="w-trusted"]').check();act(p,'plan');p.locator('[data-field="w-approved"]').check()
def scenario(p,key):close(p);act(p,'lab');act(p,'scenario',key);act(p,'close')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 def new(storage=None,width=1600,height=1050):
    p=b.new_page(viewport={'width':width,'height':height});p.set_default_timeout(5000)
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);p.on('request',lambda r:requests.append(r.url))
    if storage is not None:p.evaluate('''raw=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,setItem:(k,v)=>fixtureStore[k]=String(v),removeItem:k=>delete fixtureStore[k]},configurable:true});}''',storage)
    p.set_content(HTML.read_text());p.wait_for_selector('#content h1');return p
 try:
    p=new(storage='');check('Fresh entry retains create/setup and adds design-first action',p.locator('[data-action="outline-start"]').count()==1 and p.locator('[data-action="create"]').count()>0)
    shot(p,'01-fresh-workbench.png');nav(p,'prds');check('PRD authoring is available before creating a project','Start with the why' in p.locator('main').inner_text());act(p,'product-prd-new')
    form(p,'title','');act(p,'product-prd-save');check('PRD needs a title',p.locator('#modal .error').inner_text()!='')
    form(p,'title','Field Notes — Product requirements');form(p,'problem','Useful notes are scattered and hard to retrieve.');form(p,'goals','Capture a useful note in one deliberate action.');form(p,'notes','Handwritten notes stay intact.\n\n- Research before expanding scope.');act(p,'product-prd-save')
    check('PRD saves structured fields and preserved author notes',value(p,'selectedPrd().notes.includes("Handwritten") && design().prds.length===1'))
    act(p,'product-prd-edit','prd-1');form(p,'notes','Discard this edit');act(p,'close');check('Cancel PRD edit leaves canonical concept data unchanged',value(p,'selectedPrd().notes.includes("Handwritten")'))
    act(p,'product-requirement-new');form(p,'title','Capture a note');form(p,'acceptance','Given a valid title, create exactly one Markdown note and preserve the active context.');p.locator('[data-field="product-ref-components"][data-id="capture-form"]').check();p.locator('[data-field="product-ref-patterns"][data-id="quick-capture"]').check();act(p,'product-requirement-save')
    check('Stable requirement ID and explicit action/component references',value(p,'selectedPrd().requirements[0].id==="PRD-1-REQ-001" && selectedPrd().requirements[0].patterns[0]==="quick-capture"'))
    act(p,'product-requirement-screen','PRD-1-REQ-001');p.locator('[data-field="design-node-label"]').fill('Capture workspace');p.locator('[data-field="design-node-slug"]').fill('capture-workspace');p.locator('[data-field="design-node-placement"]').select_option('left');p.locator('[data-field="design-node-layout"]').select_option('sidebar-right');act(p,'design-save')
    nid=value(p,'selectedPrd().requirements[0].nodes[0]');check('Create a view from a requirement adds the traceability link',bool(nid) and value(p,'design().nodes.find(n=>n.id===selectedPrd().requirements[0].nodes[0]).placement==="left"'))
    act(p,'product-prd-tab','trace');shot(p,'02-prd-traceability.png');check('Traceability does not infer test success','Not verified' in p.locator('main').inner_text())
    act(p,'product-go-node',nid);check('Selected graph node is revealed without resetting the page',value(p,'(()=>{const p=document.querySelector("#map-viewport").getBoundingClientRect(),n=document.querySelector(".map-node.selected").getBoundingClientRect();return n.top>=p.top && n.bottom<=p.bottom && n.left>=p.left && n.right<=p.right})()'));shot(p,'03-sitemap.png');check('Inspector exposes linked requirement',p.locator('.node-inspector').inner_text().find('PRD-1-REQ-001')>=0)
    act(p,'design-add','page');p.locator('[data-field="design-node-label"]').fill('Details');p.locator('[data-field="design-node-slug"]').fill('capture-details');act(p,'design-save');check('Internal screen is owned by a native view',value(p,'selectedNode().kind==="page" && nodeOwner(design(),selectedNode()).id==="'+nid+'"'))
    act(p,'design-mode','preview');shot(p,'04-layout-preview.png');check('Layout preview distinguishes internal screen and inherited placement','Left sidebar' in p.locator('.host-preview').inner_text())
    nav(p,'blueprints');check('Catalog offers eight blueprints and fourteen layouts',value(p,'BLUEPRINTS.length===8 && LAYOUTS.length===14'))
    shot(p,'05-blueprint-library.png');check('Placement and internal sidebar layouts are distinct',value(p,'PLACEMENTS.left && LAYOUTS.some(l=>l.id==="sidebar-left") && LAYOUTS.some(l=>l.id==="sidebar-right")'))
    nav(p,'patterns');check('Host pattern catalog labels advanced recipes separately',value(p,'PATTERNS.length===22') and 'Advanced' in p.locator('main').inner_text())
    p.locator('#pattern-search').fill('editor');check('Pattern filter works',p.locator('.pattern-card').count()<22);p.locator('#pattern-search').fill('');shot(p,'06-action-patterns.png')
    nav(p,'components');check('Six UI contracts plus fourteen content components are available',value(p,'design().library.filter(c=>!isBrickComponent(c)).length===6 && design().library.length===20'));act(p,'product-component-new');form(p,'name','TaskCard');form(p,'id','task-card');form(p,'description','Shows one task without owning persistence.');act(p,'product-component-save')
    check('Custom component saved separately from starter contracts',value(p,'selectedComponent().id==="task-card" && selectedComponent().origin==="project"'))
    act(p,'product-component-bind','task-card');p.locator('[data-field="product-form-node"]').select_option(nid);act(p,'product-component-bind-save');check('Component is bound to a specific surface and version',value(p,'componentUses("task-card").length===1'))
    act(p,'product-component-bind','task-card');p.locator('[data-field="product-form-node"]').select_option(nid);act(p,'product-component-bind-save');check('Identical component binding rejected',p.locator('#modal .error').inner_text()!='');close(p)
    act(p,'product-component-bind','task-card');p.locator('[data-field="product-form-node"]').select_option(nid);p.locator('[data-field="product-form-slot"]').select_option('toolbar');act(p,'product-component-bind-save');check('One component can occupy two explicit regions',value(p,'componentUses("task-card").length===2'))
    act(p,'product-component-unbind',nid+':task-card:toolbar');check('Removing one region does not remove the other binding',value(p,'componentUses("task-card").length===1'))
    act(p,'product-component-delete','task-card');check('In-use component cannot be deleted',value(p,'design().library.some(c=>c.id==="task-card")') and 'In use' in p.locator('#toasts').inner_text())
    act(p,'product-component-edit','task-card');form(p,'props','title:string\ncompleted:boolean');act(p,'product-component-save');check('Contract changes require a version bump','Bump' in p.locator('#modal .error').inner_text());form(p,'version','0.2.0');act(p,'product-component-save')
    check('Changed version leaves usages pinned until review',value(p,'componentUses("task-card")[0].binding.version==="0.1.0" && designIssues(design()).some(i=>i.code==="component-drift")'))
    act(p,'product-component-upgrade',nid+':task-card');act(p,'product-component-upgrade-save');check('Reviewed component upgrade removes drift blocker',value(p,'componentUses("task-card")[0].binding.version==="0.2.0" && !designIssues(design()).some(i=>i.code==="component-drift")'))
    act(p,'product-story','error');check('Error story offers local recovery event','Try again' in p.locator('.story-preview').inner_text());act(p,'product-demo-event','retry');check('Preview events run no application operation',value(p,'state.runs.length===0'))
    act(p,'product-story','disabled');check('Disabled story uses a disabled control',p.locator('.story-preview button').first.is_disabled());act(p,'product-story','loading');check('Loading story is explicit','Loading records' in p.locator('.story-preview').inner_text());act(p,'product-story','default');shot(p,'07-component-library.png')
    act(p,'product-component-deprecate','task-card');check('Deprecation retains existing usage with warning',value(p,'componentUses("task-card").length===1 && designIssues(design()).some(i=>i.code==="component-deprecated")'))
    act(p,'library-deprecated');act(p,'product-component-select','task-card');act(p,'product-component-edit','task-card');p.locator('[data-field="product-form-status"]').select_option('ready');act(p,'product-component-save')
    act(p,'product-component-duplicate','task-card');form(p,'name','UnusedCard');form(p,'id','unused-card');act(p,'product-component-save');act(p,'product-component-delete','unused-card');check('Unused component deletion is confirmed',p.locator('#modal').is_visible());act(p,'product-component-delete-save');check('Deleting an unused record leaves the source-bound component',value(p,'!design().library.some(c=>c.id==="unused-card") && design().library.some(c=>c.id==="task-card")'))
    p.locator('#component-filter').fill('Capture');check('Component search filters without changing selection',p.locator('#component-results .library-item').count()==1);p.locator('#component-filter').fill('')
    nav(p,'prds');act(p,'product-prd-tab','document');act(p,'product-prd-baseline','prd-1');act(p,'product-prd-baseline-save');check('Baseline requires explicit review',p.locator('#modal .error').inner_text()!='');p.locator('[data-field="product-baseline-approved"]').check();act(p,'product-prd-baseline-save');check('Reviewed baseline snapshot is stored',value(p,'selectedPrd().status==="approved" && selectedPrd().baselines.length===1'))
    old=value(p,'selectedPrd().baselines[0].markdown');act(p,'product-prd-edit','prd-1');form(p,'title','Field Notes — revised scope');act(p,'product-prd-save');check('Editing approved PRD returns it to draft',value(p,'selectedPrd().status==="draft"'));check('Old baseline and author notes remain unchanged',value(p,'selectedPrd().baselines[0].markdown')==old and value(p,'selectedPrd().notes.includes("Handwritten")'))
    act(p,'product-prd-export','prd-1');md=p.locator('#copy-text').input_value();check('Markdown export has frontmatter, stable IDs and author notes',md.startswith('---\ntype: "plugin-prd"') and 'PRD-1-REQ-001' in md and 'Handwritten' in md)
    with p.expect_download() as dl:act(p,'download-text')
    check('PRD download is an explicit local artifact',dl.value.suggested_filename=='prd-1.md');close(p)
    nav(p,'sitemap');act(p,'design-select',nid);act(p,'design-duplicate',nid);first_duplicate=value(p,'selectedNode().id');act(p,'design-undo');act(p,'design-select',nid);act(p,'design-duplicate',nid);check('Undo never recycles a surface ID into another surface',value(p,'selectedNode().id')!=first_duplicate);act(p,'design-undo')
    act(p,'design-plan');check('Plan includes shared components and PRD traceability',value(p,'designUi.plan.changes.some(f=>f.path==="docs/requirements/prd-1.md") && designUi.plan.changes.filter(f=>f.path.endsWith("/TaskCard.vue")).length===1'))
    check('Plan emits only native views into native registration intent',value(p,'JSON.parse(designUi.plan.changes.find(f=>f.path==="src/bootstrap/view-outlines.ts").content.split(" = ")[1].split(" as const")[0]).length===design().nodes.filter(n=>n.kind==="view").length'))
    shot(p,'08-boilerplate-plan.png');act(p,'design-apply');check('Scaffolding requires separate approval',p.locator('#design-error').inner_text()!='');p.locator('[data-field="design-approve"]').check();act(p,'design-apply');check('Concept scaffolding preserves requirement status',value(p,'selectedPrd().requirements[0].status==="draft" && design().generatedRevision===design().revision'))
    act(p,'design-plan');check('Identical complete plan is a no-op',value(p,'designUi.plan.changes.every(f=>f.status==="unchanged")'));close(p)
    act(p,'design-select',nid);act(p,'design-edit',nid);p.locator('[data-field="design-node-goal"]').fill('Changed business intent');act(p,'design-save');act(p,'design-plan');check('Developer-owned hooks conflict rather than overwrite',value(p,'designUi.plan.changes.some(f=>f.status==="conflict" && f.path.endsWith("actions.ts"))'));close(p);act(p,'design-undo')
    act(p,'design-plan');p.evaluate('designUi.plan.owner="another-project"');p.locator('[data-field="design-approve"]').check();act(p,'design-apply');check('Plan ownership prevents cross-project application','another project' in p.locator('#design-error').inner_text());close(p)
    act(p,'design-select',nid);act(p,'design-remove',nid);act(p,'design-remove-confirm',nid);check('Removing a referenced surface produces an explicit broken trace',value(p,'designIssues(design()).some(i=>i.code==="requirement-node")'));act(p,'design-undo');check('Undo restores containment and requirement references',value(p,'!designIssues(design()).some(i=>i.code==="requirement-node")'))
    nav(p,'blueprints');act(p,'blueprint-choose','right-inspector');act(p,'blueprint-apply','right-inspector');check('Replacing a blueprint preserves PRDs without rebinding old IDs',value(p,'design().prds.length===1 && designIssues(design()).some(i=>i.code==="requirement-node")'));act(p,'design-undo')
    exported=value(p,'JSON.stringify(portableDesign())');check('Portable design includes library and PRDs, not execution authority',value(p,'portableDesign().library.length===21 && portableDesign().prds.length===1 && !Object.hasOwn(portableDesign(),"trusted") && !Object.hasOwn(portableDesign(),"root")'))
    act(p,'design-transfer');p.locator('#blueprint-json').fill('{"schema":999}');act(p,'design-import');check('Unsupported design schema is rejected without replacing data',p.locator('#design-error').inner_text()!='' and value(p,'design().prds.length===1'))
    bad=json.loads(exported);bad['command']='rm -rf';p.locator('#blueprint-json').fill(json.dumps(bad));act(p,'design-import');check('Unknown executable-style top-level fields are rejected','Unknown' in p.locator('#design-error').inner_text());p.locator('#blueprint-json').fill(exported);act(p,'design-import');check('Data-only outline imports with component and PRD relationships',value(p,'design().prds[0].requirements.length===1 && design().library.length===21'))
    check('Invalid component contract produces a blocking preview, not an exception',value(p,'(()=>{let d=designCopy(design());d.library.find(c=>c.id==="task-card").props="bad-code()";return buildDesignPlan(d).issues.some(i=>i.code==="preview-contract")})()'),'pure model fixture')
    check('Containment cycle validation is finite and blocking',value(p,'(()=>{let d=designCopy(design());let n=d.nodes.find(n=>n.kind==="view");n.parent=n.id;return designIssues(d).some(i=>i.code==="cycle")})()'),'pure model fixture')
    check('Dangling navigation targets are blocking',value(p,'(()=>{let d=designCopy(design());d.links.push({id:"fixture",from:d.nodes[0].id,to:"missing",label:"Open",kind:"navigate"});return designIssues(d).some(i=>i.code==="broken-link")})()'),'pure model fixture')
    check('Navigation cycles do not become containment cycles',value(p,'(()=>{let d=designCopy(design());let v=d.nodes.filter(n=>n.kind==="view");d.links.push({id:"roundtrip-a",from:v[0].id,to:v[1].id,label:"Go",kind:"navigate"},{id:"roundtrip-b",from:v[1].id,to:v[0].id,label:"Back",kind:"navigate"});return !designIssues(d).some(i=>i.code==="cycle")})()'),'pure model fixture')
    check('Desktop-only surface conflicts with mobile-ready ambition',value(p,'(()=>{let d=designCopy(design());d.platform="mobile-ready";d.nodes.find(n=>n.kind==="view").placement="window";return designIssues(d).some(i=>i.code==="desktop-surface")})()'),'pure model fixture')
    check('Internal-screen compatibility follows its owning view placement',value(p,'(()=>{let d=designCopy(design());d.platform="mobile-ready";let n=d.nodes.find(n=>n.kind==="page");n.placement="window";return !designIssues(d).some(i=>i.code==="desktop-surface")})()'),'pure model fixture')
    saved=value(p,'fixtureStore["shell-workbench-concept-v1"]');p.close();p=new(storage=saved);check('Controlled storage rehydrates PRDs, library and outline',value(p,'design().prds.length===1 && design().library.some(c=>c.id==="task-card")'))
    nav(p,'sitemap');act(p,'design-create');check('Wizard receives the full design without hidden project dependency',value(p,'state.wizard.design.prds.length===1 && state.wizard.design.library.length===21'));close(p)
    nav(p,'projects');wizard(p);act(p,'setup');p.wait_for_selector('[data-action="finish"]');check('Existing setup journey still completes with the design',value(p,'state.projects.length===1 && project().design.prds.length===1 && !project().enabled'))
    check('Setup does not claim unrun native/browser/security checks',value(p,'!project().quality.native && !project().quality.browser && !project().quality.security'))
    act(p,'activate',scope='#modal');act(p,'enable-demo');act(p,'return-wizard');act(p,'finish');check('Activation is a separate explicit simulation',value(p,'project().enabled'))
    nav(p,'generate');p.locator('[data-field="g-name"]').fill('meetings');p.locator('[data-field="g-entity"]').fill('meeting');act(p,'maker-preview');act(p,'maker-apply');wait(p);check('Original note-feature maker still updates source independently',value(p,'project().features.length===1 && project().rev>1'))
    nav(p,'quality');act(p,'check','verify');act(p,'check-confirm');wait(p);check('Original verification retains scope and revision',value(p,'project().quality.verify.rev===project().rev && !project().quality.native'))
    act(p,'edit-source');nav(p,'develop');act(p,'deploy');check('Stale built candidate cannot be deployed',p.locator('[data-action="deploy-confirm"]').is_disabled());close(p)
    nav(p,'capabilities');act(p,'tool-tab','tools');check('All 33 original CLI entries remain available',p.locator('#tool-results .tool-card').count()==33)
    nav(p,'prds');act(p,'theme');shot(p,'09-light-prd.png');check('Light theme retained',p.locator('html').get_attribute('data-theme')=='light')
    p.keyboard.press('Control+k');check('Original command palette is keyboard accessible',p.locator('#palette-search').is_visible());p.keyboard.press('Escape')
    nav(p,'projects');act(p,'attach');act(p,'attach-confirm');check('Attaching another project does not leak previous product design',value(p,'design().prds.length===0 && !project().trusted'))
    nav(p,'quality');act(p,'check','verify');act(p,'check-confirm');check('Attached project must be trusted before execution',p.locator('#trust-checkbox').is_visible());close(p);p.close()
    p=new();scenario(p,'missing-node');nav(p,'projects');act(p,'create',scope='main');act(p,'wizard-next');act(p,'wizard-next');check('Missing prerequisites still block setup','Node is missing' in p.locator('#wizard-error').inner_text());p.close()
    p=new();scenario(p,'install-failure');wizard(p);act(p,'setup');wait(p);check('Dependency failure preserves the partial setup journal',value(p,'state.wizard.status==="failed" && state.projects.length===0'));p.close()
    p=new();wizard(p);act(p,'setup');act(p,'cancel-run');check('Original cancellation leaves no active simulated process',value(p,'state.activeRun===null && state.wizard.status==="cancelled"'));p.close()
    p=new(storage='{"schema":999}');check('Unknown stored state remains untouched',value(p,'fixtureStore["shell-workbench-concept-v1"]===\'{"schema":999}\''));p.close()
    p=new(storage='{"schema":1,"projects":[null]}');check('Malformed storage falls back without script errors','Less boilerplate' in p.locator('h1').inner_text());p.close()
    for width,height in [(1024,768),(390,844)]:
      p=new(width=width,height=height)
      if width<650:act(p,'menu')
      nav(p,'prds');check(f'No document overflow at {width}px',value(p,'document.documentElement.scrollWidth<=innerWidth'))
      if width<650:check('Narrow navigation closes after selection',not p.locator('#sidebar').is_visible())
      act(p,'product-prd-new');check(f'PRD editor fits {width}px viewport',p.locator('#modal').bounding_box()['width']<=width);close(p);shot(p,f'10-responsive-{width}.png');p.close()
    p=new();nav(p,'prds');act(p,'product-prd-new');form(p,'title','<img src=x onerror=alert(1)>');act(p,'product-prd-save');check('PRD title renders as inert text',p.locator('main img').count()==0 and '<img' in p.locator('main').inner_text());p.close()
    check('No page/console errors across tested routes',not errors);check('No network requests across tested routes',not requests)
 finally:
    (OUT/'studio-browser-checks.json').write_text(json.dumps({'scope':'HTML concept with injection and controlled Storage fixtures; no real CLI/native checks','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'browser':b.version,'elapsed_seconds':round(time.time()-started,2),'checks':checks,'errors':errors,'requests':requests},indent=2))
    b.close()
