"""Concept04 workflow refinement. Exact HTML injection; no Vue Flow/native claims.
Uses a controlled Storage stand-in. Tests navigate the real browser concept UI.
"""
from pathlib import Path
import argparse,hashlib,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--html',default=str(ROOT/'docs/concepts/companion/index.html'));a.add_argument('--out',default=str(ROOT/'reports/concepts/companion-workflow'));a.add_argument('--browser',default='/usr/bin/chromium');args=a.parse_args()
HTML=Path(args.html);OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];started=time.monotonic()
def check(name,ok,scope='browser interaction'):
    checks.append({'name':name,'passed':bool(ok),'scope':scope});assert ok,name;print('PASS',name,flush=True)
def act(p,key,value=None,scope=''):
    p.locator(f'{scope} [data-action="{key}"]'+(f'[data-value="{value}"]' if value is not None else '')).first.click()
    # Concept07: these retained fixtures qualify Structure mode; content mode has its own suite.
    if (key=="nav" and value=="sitemap") or (key=="workflow-stage" and value=="structure"):
        p.locator('[data-action="brick-display"][data-value="structure"]').click();p.wait_for_timeout(80)

def nav(p,key):
    if not p.locator('#sidebar').is_visible():act(p,'menu')
    act(p,'nav',key,'#sidebar')
def val(p,code):return p.evaluate(code)
def close(p):act(p,'close',scope='#modal')
def shot(p,name):p.screenshot(path=str(OUT/name))
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 def new(width=1600,height=1050,storage=''):
    p=b.new_page(viewport={'width':width,'height':height});p.set_default_timeout(6000)
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);p.on('request',lambda r:requests.append(r.url))
    p.evaluate('''raw=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,setItem:(k,v)=>fixtureStore[k]=String(v),removeItem:k=>delete fixtureStore[k]},configurable:true});}''',storage)
    p.set_content(HTML.read_text());return p
 try:
    p=new();shot(p,'01-start.png')
    check('Home offers design, direct setup and existing-project routes',p.locator('[data-action="outline-start"]').count()==1 and p.locator('[data-action="create"]').count()>0 and p.locator('[data-action="attach"]').count()>0)
    act(p,'outline-start');check('Design-first starts at the brief, not an empty canvas',val(p,'state.view')=='prds' and val(p,'state.projects.length')==0)
    check('Five reversible workflow stages are visible',p.locator('.workflow-rail .workflow-step').count()==5)
    act(p,'product-prd-new');p.locator('[data-field="product-form-title"]').fill('Workshop requirements');p.locator('[data-field="product-form-problem"]').fill('Developers lose context between product design and source setup.');act(p,'product-prd-save')
    check('Brief is saved without creating a project',val(p,'design().prds.length===1 && !project()'))
    act(p,'product-requirement-new');p.locator('[data-field="product-form-title"]').fill('Open the main workspace');p.locator('[data-field="product-form-acceptance"]').fill('A deliberate open action focuses the existing view without making a duplicate.');act(p,'product-requirement-save')
    shot(p,'02-prd.png');before=val(p,'designFingerprint(design())')
    act(p,'workflow-stage','structure','.workflow-rail');act(p,'workflow-stage','components','.workflow-rail')
    check('Stage navigation preserves the semantic outline',val(p,'designFingerprint(design())')==before)
    check('Current workflow stage is announced',p.locator('.workflow-step[aria-current="step"]').inner_text().endswith('Compose'))
    act(p,'workflow-context');check('Context explains draft/source/target without authority grant','Chosen later in setup' in p.locator('#modal').inner_text() and val(p,'state.activeRun===null'));close(p)
    act(p,'workflow-stage','structure','.workflow-rail');act(p,'canvas-fit');shot(p,'03-sitemap.png')
    check('Every card shows a full-width layout sketch',val(p,'[...document.querySelectorAll(".map-node")].every(n=>n.querySelector(".map-card-layout").getBoundingClientRect().width>n.getBoundingClientRect().width*.75)'))
    check('Card titles retain a readable base size',val(p,'parseFloat(getComputedStyle(document.querySelector(".map-card-title")).fontSize)>=16'))
    p.locator('#map-search').fill('unfindable surface');check('Map search explains empty results',p.locator('#map-search-feedback').inner_text().startswith('No matching surfaces'))
    p.locator('#map-search').press('Escape');check('Escape clears canvas search without changing outline',p.locator('#map-search').input_value()=='' and val(p,'designFingerprint(design())')==before)
    p.locator('#map-search').fill(val(p,'design().nodes[0].label'));p.locator('#map-search').press('Enter')
    check('Enter reveals a matching surface',val(p,'selectedNode().label.toLowerCase().includes(canvasUi.search.toLowerCase())'))
    act(p,'workflow-search-clear');check('Clear search keeps the map inventory',p.locator('.map-node').count()==val(p,'design().nodes.length'))
    n=val(p,'selectedNode().id');act(p,'design-edit',n,'.map-node.selected')
    p.locator('[data-field="design-node-label"]').fill('UNSAVED RERENDER')
    p.locator('[data-field="design-node-layout"]').select_option('tabs')
    close(p);check('Dirty changes survive a form redraw checkpoint',p.locator('#discard-dialog[open]').count()==1)
    p.locator('#discard-keep').click();check('Keep editing retains both draft label and layout',p.locator('[data-field="design-node-label"]').input_value()=='UNSAVED RERENDER' and p.locator('[data-field="design-node-layout"]').input_value()=='tabs')
    close(p);p.locator('#discard-confirm').click();check('Discard after redraw preserves canonical source model',val(p,'designFingerprint(design())')==before)
    act(p,'workflow-stage','components','.workflow-rail');check('Component library opens at preview',p.locator('.component-tabs button[aria-pressed="true"]').inner_text()=='Preview')
    c=val(p,'selectedComponent().id');act(p,'workflow-component-tab','contract')
    check('Contract has declared props events slots and tokens',all(t in p.locator('#component-detail').inner_text() for t in ['Props','Emits','Slots','Host tokens']))
    act(p,'workflow-component-tab','usage');check('Usage disclosure preserves selected component',val(p,'selectedComponent().id')==c and 'Usage' in p.locator('.component-tabs [aria-pressed="true"]').inner_text())
    act(p,'workflow-component-tab','preview');act(p,'product-story','error');check('Existing error-state sketch still works',val(p,'productUi.story')=='error')
    shot(p,'04-components.png');check('Tab and story navigation do not change component contracts',val(p,'designFingerprint(design())')==before)
    act(p,'workflow-stage','review','.workflow-rail');check('Workflow review uses the canonical plan dialog',val(p,'modalType')=='design-plan')
    count=val(p,'designUi.plan.changes.length');finger=val(p,'designUi.plan.fingerprint')
    p.locator('#plan-file-search').fill('actions.ts');check('Planned files can be filtered without changing the plan',p.locator('.plan-files .file-pick').count()<count and val(p,'designUi.plan.changes.length')==count)
    check('Approval scope explicitly includes filtered-out files',f'Approval covers all {count} files' in p.locator('.filter-disclosure').inner_text())
    p.locator('#plan-file-search').fill('missing-file-xyz');check('Empty file search gives a recovery message','No matching files' in p.locator('.plan-files .file-nav').inner_text())
    act(p,'workflow-file-clear');check('Clear restores every planned path',p.locator('.plan-files .file-pick').count()==count and val(p,'designUi.plan.fingerprint')==finger)
    p.locator('[data-field="workflow-file-status"]').select_option('create');check('Status filter is a view not a mutation',val(p,'designUi.plan.fingerprint')==finger and val(p,'!designUi.plan.approved'))
    p.locator('[data-field="design-approve"]').check();p.locator('#plan-file-search').fill('src');shot(p,'05-boilerplate-plan.png');act(p,'design-apply')
    check('Reviewed scaffold preview records the full plan, not search subset',val(p,'design().generatedRevision===design().revision') and val(p,'Object.keys(design().emitted).length')==count)
    check('Scaffold does not promote requirements to implemented',val(p,'selectedPrd().requirements[0].status')=='draft')
    # A rerun is read-only until explicit setup. No dependency download is performed.
    act(p,'design-plan');act(p,'workflow-continue-setup');check('Reviewed design can continue straight into setup',val(p,'modalType')=='wizard' and val(p,'state.wizard.design.prds.length')==1)
    check('Wizard communicates inherited outline', 'Your outline is included' in p.locator('#modal').inner_text())
    check('Continue-to-setup is not execution consent',val(p,'state.activeRun===null && state.projects.length===0 && !state.wizard.approved'))
    close(p);nav(p,'projects');check('Home offers to resume existing outline',p.locator('[data-action="outline-start"]').first.inner_text()=='Continue your outline')
    act(p,'outline-start');check('Resumed outline opens the working sitemap',val(p,'state.view')=='sitemap')
    saved=val(p,'fixtureStore["shell-workbench-concept-v1"]');p.close();p=new(storage=saved);check('Existing storage schema rehydrates the revised workflow',val(p,'design().prds.length===1 && state.wizard.design.prds.length===1'))
    p.close();p=new();act(p,'sample',scope='main');shot(p,'06-overview.png')
    check('Overview displays design progress and runtime evidence separately','Design to implementation' in p.locator('main').inner_text() and 'Development evidence' in p.locator('main').inner_text())
    check('Overview retains run history access',p.locator('[data-action="nav"][data-value="runs"]').count()>0)
    # Controlled model conditions, not fabricated native observation.
    p.evaluate('project().enabled=false;render()')
    check('Installed but inactive candidate suggests deliberate activation',p.locator('.next-task [data-action="activate"]').count()==1,'controlled state fixture + rendered UI')
    p.evaluate('project().quality.verify={rev:project().rev,status:"failed"};render()')
    check('Failed matching-revision check is not labelled current verification', 'Verification fixture current' not in p.locator('.workflow-ledger').inner_text(),'controlled state fixture + rendered UI')
    p.close()
    for width,height,theme in [(1600,1050,'light'),(1024,768,'dark'),(390,844,'dark')]:
      p=new(width,height);act(p,'sample',scope='main');nav(p,'sitemap')
      if theme=='light':act(p,'theme')
      check(f'No document overflow at {width}px {theme}',val(p,'document.documentElement.scrollWidth<=innerWidth'))
      check(f'Workflow stage controls fit or scroll within their own rail at {width}px',val(p,'document.querySelector(".workflow-rail").getBoundingClientRect().right<=innerWidth'))
      shot(p,f'07-map-{width}-{theme}.png')
      if width==390:
        act(p,'canvas-expand');shot(p,'08-focused-narrow.png');check('Narrow focus mode keeps map editing accessible',p.locator('#map-viewport').bounding_box()['height']>180)
      p.close()
    check('Zero page and console errors',not errors);check('Zero network requests',not requests)
 finally:
    (OUT/'workflow-browser-checks.json').write_text(json.dumps({'scope':'HTML browser concept with injection and Storage stand-in; actual bundled Vue Flow; not native or real CLI','sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'browser':b.version,'elapsed_seconds':round(time.monotonic()-started,2),'checks':checks,'errors':errors,'requests':requests},indent=2));b.close()
