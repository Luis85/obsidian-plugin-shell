"""Retained sitemap behaviors, adapted to the Vue Flow renderer in Concept 05. Exact HTML injection, not native Obsidian/CLI.
Pre-provisioned Python Playwright/Chromium required; installs nothing.
Persistence uses an explicit Storage substitute. Model fixtures are scope-labeled.
"""
from pathlib import Path
import argparse, hashlib, json, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--html',default=str(ROOT/'docs/concepts/companion/index.html'));a.add_argument('--out',default=str(ROOT/'reports/concepts/companion-sitemap'));a.add_argument('--browser',default='/usr/bin/chromium');args=a.parse_args()
HTML=Path(args.html);OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];metrics={};start=time.monotonic();current=None

def check(name,ok=True,scope='browser interaction'):
    checks.append({'name':name,'passed':bool(ok),'scope':scope});assert ok,name
    print('PASS',name,flush=True)
def val(p,s):return p.evaluate(s)
def act(p,action,value=None,scope=''):
    q=f'{scope} [data-action="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
    p.locator(q.strip()).first.click();p.wait_for_timeout(55)
    # Concept07: these retained fixtures qualify Structure mode; content mode has its own suite.
    if (action=="nav" and value=="sitemap") or (action=="workflow-stage" and value=="structure"):
        p.locator('[data-action="brick-display"][data-value="structure"]').click();p.wait_for_timeout(80)

def nav(p,where):
    if not p.locator('#sidebar').is_visible():act(p,'menu')
    act(p,'nav',where,'#sidebar')
def close(p):act(p,'close',scope='#modal')
def field(p,key,text):p.locator('[data-field="'+key+'"]').fill(text)
def card(p,n):return p.locator('.map-node[data-node="'+n+'"]')
def selected(p):return val(p,'selectedNode().id')
def choose(p,n):
    if not p.locator('.outline-tree').count():act(p,'canvas-outline')
    act(p,'design-select',n,'.outline-tree')
    act(p,'canvas-outline',scope='.outline-tree')
    act(p,'canvas-focus')
def movement(p,n,dx,dy,cancel=False):
    box=card(p,n).bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.22
    p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+dx,y+dy,steps=8);p.wait_for_timeout(30)
    if cancel:p.keyboard.press('Escape')
    p.mouse.up();p.wait_for_timeout(180)
def shot(p,name):p.screenshot(path=str(OUT/name))
def pos(p,n):return p.evaluate('id=>({...canvasState().positions[id]})',n)
def model(p):return val(p,'JSON.stringify(generationSnapshot(design()))')
def details(p):
    act(p,'canvas-inspector','details')
    p.locator('summary').filter(has_text='Position & movement').click()

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 def new(storage='',width=1600,height=1050,sample=True):
    global current
    p=b.new_page(viewport={'width':width,'height':height});current=p;p.set_default_timeout(6000)
    p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);p.on('request',lambda r:requests.append(r.url))
    p.evaluate('''raw=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,setItem:(k,v)=>fixtureStore[k]=String(v),removeItem:k=>delete fixtureStore[k]},configurable:true});}''',storage)
    p.set_content(HTML.read_text())
    if sample and not val(p,'state.projects.length'):act(p,'sample',scope='main')
    nav(p,'sitemap');p.wait_for_selector('.vue-flow__node');p.locator('.map-card-title').first.click();p.wait_for_timeout(80);return p
 try:
    p=new();n=selected(p);original=model(p)
    check('Map starts fitted with every surface represented',p.locator('.map-node').count()==val(p,'design().nodes.length'))
    check('All five alignment choices are exposed',p.locator('#map-layout option').count()==5)
    p.wait_for_timeout(2400);shot(p,'01-sitemap-overview.png');choose(p,n);card(p,n).click(position={'x':90,'y':58})
    check('Click selects card and updates inspector',val(p,'designUi.selected')==n and p.locator('.inspector-body h2').inner_text()==val(p,'selectedNode().label'))
    act(p,'design-edit',n,scope='.map-node.selected');field(p,'design-node-label','Temporary draft');close(p)
    check('Closing a dirty surface offers keep/discard',p.locator('#discard-dialog[open]').count()==1 and p.locator('#discard-keep').evaluate('e=>e===document.activeElement'))
    p.locator('#discard-keep').click();check('Keep editing preserves the draft',p.locator('[data-field="design-node-label"]').input_value()=='Temporary draft')
    p.keyboard.press('Escape');p.locator('#discard-confirm').click();check('Discard preserves canonical surface',model(p)==original)
    card(p,n).dblclick(position={'x':100,'y':55});check('Double-click opens the existing surface form',p.locator('#modal').evaluate('e=>e.open') and val(p,'designUi.form.id')==n);close(p)
    card(p,n).focus();p.keyboard.press('Enter');check('Enter edits the focused surface',val(p,'designUi.form.id')==n and p.locator('#modal').evaluate('e=>e.open'))
    field(p,'design-node-label','Workspace refined');act(p,'design-save');check('Surface editing preserves stable ID',val(p,'selectedNode().label')=='Workspace refined' and selected(p)==n)
    act(p,'design-undo');choose(p,n);shot(p,'02-card-actions.png')
    card(p,n).click(button='right',position={'x':100,'y':55});check('Right-click offers the same card actions','Duplicate surface only' in p.locator('#modal').inner_text());shot(p,'03-card-menu.png');close(p)
    act(p,'design-plan');plan=val(p,'designUi.plan.fingerprint');close(p);before=pos(p,n);h=val(p,'design().history.length');rev=val(p,'design().revision');semantic=model(p)
    movement(p,n,83,47);after=pos(p,n)
    check('Pointer drag moves and snaps the card',after!=before and after['x']%24==0 and after['y']%24==0)
    check('A completed drag adds exactly one undo entry',val(p,'design().history.length')==h+1)
    check('Dragging preserves structure and generation fingerprint',model(p)==semantic and val(p,'design().revision')==rev and val(p,'designUi.plan.fingerprint')==plan)
    check('Dragging does not accidentally open the editor',not p.locator('#modal').evaluate('e=>e.open'))
    p.keyboard.press('Control+z');check('Keyboard undo restores the exact position',pos(p,n)==before)
    p.keyboard.press('Control+Shift+z');check('Keyboard redo restores completed move',pos(p,n)==after)
    h=val(p,'design().history.length');movement(p,n,60,55,cancel=True);check('Escape aborts an unfinished drag',pos(p,n)==after and val(p,'design().history.length')==h)
    card(p,n).focus();p.keyboard.press('ArrowRight');check('Arrow key nudges 24 world units',pos(p,n)['x']==after['x']+24)
    p.keyboard.press('Shift+ArrowDown');check('Shift-arrow uses a larger 96-unit step',pos(p,n)['y']==after['y']+96)
    details(p);p.locator('#map-position-x').fill('384');p.locator('#map-position-y').fill('216');act(p,'canvas-position',n)
    check('Numeric positioning provides a non-drag alternative',pos(p,n)=={'x':384,'y':216})
    details(p);p.locator('#map-position-x').fill('');act(p,'canvas-position',n);check('Blank coordinates do not move a card to zero',pos(p,n)=={'x':384,'y':216} and 'both X and Y' in p.locator('#toasts').inner_text())
    p.locator('#map-position-x').fill('384');act(p,'canvas-nudge','-24,0');check('Click move controls work without a keyboard',pos(p,n)['x']==360)
    details(p);act(p,'canvas-place',n);vp=p.locator('#map-viewport').bounding_box();p.mouse.click(vp['x']+vp['width']*.85,vp['y']+vp['height']*.8)
    check('Click-to-place completes without dragging',val(p,'canvasUi.placing===null') and pos(p,n)['x']!=360)
    choose(p,n);act(p,'canvas-reset-zoom');p.locator('[data-field="canvas-snap"]').uncheck();before=pos(p,n);movement(p,n,60,30)
    check('Unsnap movement follows pointer at 100 percent zoom',abs(pos(p,n)['x']-before['x']-60)<=1 and abs(pos(p,n)['y']-before['y']-30)<=1)
    act(p,'canvas-zoom-out');z=val(p,'canvasState().zoom');before=pos(p,n);movement(p,n,60,30)
    check('Drag converts screen distance through current zoom',abs(pos(p,n)['x']-before['x']-60/z)<=1.5)
    semantic=model(p);saved_positions=val(p,'JSON.stringify(canvasState().positions)');p.locator('.map-pan-controls summary').click();pan=val(p,'canvasState().pan.x');act(p,'canvas-pan','-96,0')
    check('Click panning changes viewport not cards',val(p,'canvasState().pan.x')==pan-96 and val(p,'JSON.stringify(canvasState().positions)')==saved_positions)
    p.locator('.map-pan-controls summary').click();act(p,'canvas-fit');check('Fit keeps all visible cards within canvas',val(p,'(()=>{let v=document.querySelector("#map-viewport").getBoundingClientRect();return [...document.querySelectorAll(".map-node")].every(e=>{let r=e.getBoundingClientRect();return r.left>=v.left&&r.right<=v.right&&r.top>=v.top&&r.bottom<=v.bottom})})()'))
    for layout in ['horizontal','lanes','grid','vertical']:
        p.locator('#map-layout').select_option(layout)
        check(layout+' alignment preserves semantic design',model(p)==semantic and val(p,'canvasState().layout')==layout)
        positions=val(p,'JSON.stringify(canvasState().positions)');act(p,'canvas-arrange');check(layout+' arrangement is deterministic',val(p,'JSON.stringify(canvasState().positions)')==positions)
        check(layout+' alignment has nonoverlapping card rectangles',val(p,'(()=>{let a=Object.values(canvasState().positions);return a.every((x,i)=>a.every((y,j)=>i===j||x.x+MAP_SIZE.w<=y.x||y.x+MAP_SIZE.w<=x.x||x.y+MAP_SIZE.h<=y.y||y.y+MAP_SIZE.h<=x.y))})()'))
        shot(p,'04-layout-'+layout+'.png')
    saved_positions=val(p,'JSON.stringify(canvasState().positions)');p.locator('#map-layout').select_option('free');check('Freeform preserves positions rather than scattering cards',val(p,'JSON.stringify(canvasState().positions)')==saved_positions and p.locator('[data-action="canvas-arrange"]').is_disabled())
    act(p,'design-undo');check('Undo restores a previous layout choice',val(p,'canvasState().layout')=='vertical' and val(p,'JSON.stringify(canvasState().positions)')==saved_positions);act(p,'design-redo')
    child=val(p,'design().nodes.find(x=>x.parent===design().nodes.find(n=>n.kind==="view").id).id');parent=val(p,'design().nodes.find(x=>x.id==="'+child+'").parent');choose(p,parent)
    act(p,'canvas-collapse',parent,scope='.inspector-body');check('Collapsing hides descendants without deleting them',card(p,child).count()==0 and val(p,'design().nodes.some(x=>x.id==="'+child+'")'))
    act(p,'canvas-outline');act(p,'design-select',child,'.outline-tree');check('Outline selection expands hidden ancestors',card(p,child).count()==1);act(p,'canvas-outline',scope='.outline-tree')
    p.locator('#map-search').fill('no-surface-matches');check('Search gives an explicit empty result','0 matches' in p.locator('#map-count').inner_text());p.locator('#map-search').fill(val(p,'selectedNode().label'));p.keyboard.press('Enter');check('Search Enter focuses an actual matching card',p.locator('.map-node.selected').evaluate('e=>e===document.activeElement'));p.locator('#map-search').fill('')
    check('Search has no semantic side effects',model(p)==semantic)
    source=child;target=val(p,'design().nodes.find(n=>n.kind==="settings").id');choose(p,source);act(p,'canvas-inspector','links');act(p,'canvas-connect-from',source,scope='.inspector-body');act(p,'canvas-fit');card(p,target).click(position={'x':90,'y':55})
    check('Card-to-card connect opens reviewed action form',val(p,'designUi.form.from')==source and val(p,'designUi.form.to')==target and p.locator('#modal').evaluate('e=>e.open'))
    field(p,'design-link-label','Configure from selected record');act(p,'design-link-save');edge=val(p,'design().links.at(-1).id');check('Connection save uses a stable ID and inferred action kind',val(p,'design().links.at(-1).kind')=='configure')
    act(p,'canvas-edit-edge',edge);field(p,'design-link-label','Open preferences');act(p,'design-link-save');check('Editing connection preserves its ID',val(p,'design().links.find(x=>x.id==="'+edge+'").label')=='Open preferences')
    shot(p,'05-connections.png');act(p,'canvas-remove-edge',edge);check('Connection removal is separately confirmed',p.locator('#modal').get_by_role('heading').inner_text()=='Remove this connection?');act(p,'canvas-remove-edge-confirm',edge);check('Connection removal keeps both surfaces',not val(p,'design().links.some(x=>x.id==="'+edge+'")') and card(p,source).count()==1 and card(p,target).count()==1)
    act(p,'design-undo');check('Undo restores connection identity',val(p,'design().links.some(x=>x.id==="'+edge+'")'))
    p.locator('#map-edges').select_option('none');check('Action visibility can be hidden without losing data',p.locator('.vue-flow__edge.flow-transition').count()==0 and val(p,'design().links.length')>0)
    p.locator('#map-edges').select_option('all');check('All connections restores visible action edges',p.locator('.vue-flow__edge.flow-transition').count()==val(p,'design().links.length'))
    act(p,'canvas-fit');p.locator('.flow-edge-label[data-flow-edge^="edge-"]').first.click();check('Clicking a drawn action reveals its connection inspector',val(p,'canvasUi.edge!==null && canvasUi.inspector==="links"'));close(p)
    act(p,'canvas-expand');check('Focus mode enlarges the working canvas',val(p,'document.body.classList.contains("map-expanded")'));shot(p,'06-focus-mode.png');act(p,'canvas-expand')
    nav(p,'prds');act(p,'product-prd-new');field(p,'product-form-title','Interaction acceptance');act(p,'product-prd-save');act(p,'product-requirement-new');field(p,'product-form-title','Move without changing hierarchy');field(p,'product-form-acceptance','A moved card retains its parent.');act(p,'product-requirement-save');act(p,'product-prd-tab','requirements')
    p.locator('#requirement-search').fill('without');check('PRD requirement search finds existing acceptance work',p.locator('#requirement-count').inner_text()=='1 / 1');p.locator('#requirement-search').fill('absent');check('PRD empty search preserves records','No matching requirements' in p.locator('#requirement-results').inner_text() and val(p,'selectedPrd().requirements.length')==1);p.locator('#requirement-search').fill('');shot(p,'07-requirements.png')
    act(p,'product-requirement-edit',val(p,'selectedPrd().requirements[0].id'));field(p,'product-form-title','Unsaved change');p.keyboard.press('Escape');check('PRD form has the same dirty-dismiss protection',p.locator('#discard-dialog[open]').count()==1);p.locator('#discard-confirm').click()
    nav(p,'sitemap');saved=val(p,'fixtureStore["shell-workbench-concept-v1"]');positions=val(p,'JSON.stringify(canvasState().positions)');layout=val(p,'canvasState().layout');p.close();p=new(storage=saved)
    check('Controlled storage restores layout and card coordinates',val(p,'JSON.stringify(canvasState().positions)')==positions and val(p,'canvasState().layout')==layout)
    portable=val(p,'JSON.stringify(portableDesign())');act(p,'design-transfer');bad=json.loads(portable);bad['canvas']['positions'][next(iter(bad['canvas']['positions']))]['x']=1e100;p.locator('#blueprint-json').fill(json.dumps(bad));act(p,'design-import');check('Out-of-bounds imported coordinates fail before replacement',p.locator('#design-error').inner_text()!='' and val(p,'JSON.stringify(canvasState().positions)')==positions)
    p.locator('#blueprint-json').fill(portable);act(p,'design-import');check('Data-only import preserves canvas with semantic references',val(p,'JSON.stringify(canvasState().positions)')==positions)
    check('Generation snapshot excludes visual coordinates',val(p,'!Object.hasOwn(generationSnapshot(design()),"canvas")'),'model fixture')
    check('Unknown canvas schema is rejected',val(p,'!validCanvas({...emptyCanvas(),schema:999})'),'model fixture')
    check('Infinite zoom cannot enter saved canvas',val(p,'!validCanvas({...emptyCanvas(),zoom:Infinity})'),'model fixture')
    check('Prototype-key position map remains inert',val(p,'(()=>{let c=emptyCanvas();c.positions=JSON.parse(\'{"__proto__":{"x":24,"y":24}}\');let d=designCopy(design());d.canvas=c;canvasState(d);return !({}).x&&Object.getPrototypeOf(d.canvas.positions)===null})()'),'model fixture')
    check('Layout algorithm terminates on a cycle fixture',val(p,'(()=>{let d=designCopy(design());d.nodes[0].parent=d.nodes[0].id;return Object.keys(layoutPositions(d,"vertical")).length===d.nodes.length})()'),'model fixture')
    # A declared synthetic 60-node design, never a real project performance claim.
    metrics['sixty_node_layout_ms']=val(p,'(()=>{let d=designCopy(design()),base=d.nodes[0];d.nodes=Array.from({length:60},(_,i)=>({...base,id:"stress-"+i,slug:"stress-"+i,label:"Surface "+i,parent:i?"stress-"+Math.floor((i-1)/3):null}));let t=performance.now();for(let i=0;i<100;i++)layoutPositions(d,"vertical");return (performance.now()-t)/100})()')
    check('Sixty-node repeated layout is bounded in this fixture',metrics['sixty_node_layout_ms']<100,'model fixture')
    choose(p,n);count=val(p,'design().nodes.length');act(p,'library-card-add',n,scope='.map-node.selected');act(p,'canvas-child',n,scope='#modal');field(p,'design-node-label','New internal workspace');field(p,'design-node-slug','new-internal-workspace');act(p,'design-save');check('Card action adds a screen with the selected parent',val(p,'design().nodes.length')==count+1 and val(p,'selectedNode().parent')==n and val(p,'selectedNode().kind')=='page');act(p,'design-undo');check('Undo removes the added screen without removing its parent',val(p,'design().nodes.length')==count and val(p,'design().nodes.some(x=>x.id==="'+n+'")'))
    p.close()
    for width,height,theme in [(1600,1050,'light'),(1024,900,'dark'),(390,844,'dark')]:
        p=new(width=width,height=height)
        if theme=='light':act(p,'theme')
        check(f'No document overflow at {width}px {theme}',val(p,'document.documentElement.scrollWidth<=innerWidth'))
        p.wait_for_timeout(2300);shot(p,f'08-responsive-{width}-{theme}.png')
        if width==390:
            act(p,'canvas-focus');p.locator('#map-viewport').scroll_into_view_if_needed();shot(p,'09-narrow-canvas-focused.png')
        act(p,'canvas-help');check(f'Canvas help fits {width}px',p.locator('#modal').bounding_box()['width']<=width);close(p)
        p.close()
    check('No page or console errors',not errors);check('No network requests',not requests)
 finally:
    report={'scope':'Concept only; exact HTML injection, controlled Storage; no native/CLI qualification','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'browser':b.version,'elapsed_seconds':round(time.monotonic()-start,2),'checks':checks,'errors':errors,'requests':requests,'metrics':metrics}
    (OUT/'sitemap-browser-checks.json').write_text(json.dumps(report,indent=2)+'\n')
    if checks and not checks[-1]['passed'] and current and not current.is_closed():shot(current,'failure.png')
    b.close()
