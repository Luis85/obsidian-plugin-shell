"""Actual embedded Vue / Pinia / Vue Flow browser interactions; no native/CLI claim.
Exact HTML injection; explicit Storage fixture. No dependency installation.
"""
from pathlib import Path
import argparse,hashlib,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--html',default=str(ROOT/'docs/concepts/companion/index.html'));a.add_argument('--out',default=str(ROOT/'reports/concepts/companion-flow'));a.add_argument('--browser',default='/usr/bin/chromium');args=a.parse_args()
HTML=Path(args.html);OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];current=None

def val(p,code):return p.evaluate(code)
def check(name,ok=True,scope='actual bundled browser interaction'):
 checks.append({'name':name,'passed':bool(ok),'scope':scope});print('PASS' if ok else 'FAIL',name,flush=True);assert ok,name
def act(p,action,value=None,scope=''):
 if action=='flow-components' and not p.locator('[data-action=\"flow-components\"]').count():
  p.locator('[data-action=\"library-card-add\"][data-value=\"'+value+'\"]').click();action='library-contracts'
 q=f'{scope} [data-action="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
 p.locator(q.strip()).first.click();p.wait_for_timeout(80)
 # Concept07: these retained fixtures qualify Structure mode; content mode has its own suite.
 if (action=="nav" and value=="sitemap") or (action=="workflow-stage" and value=="structure"):
     p.locator('[data-action="brick-display"][data-value="structure"]').click();p.wait_for_timeout(80)

def close(p):act(p,'close',scope='#modal')
def card(p,id):return p.locator(f'.map-node[data-node="{id}"]')
def select(p,id):card(p,id).locator('.map-card-title').click();p.wait_for_timeout(80)
def center(el):
 q=el.bounding_box();return q['x']+q['width']/2,q['y']+q['height']/2
def connect(p,source,target,sh='out-right',th='in-left',cancel=False):
 x,y=center(card(p,source).locator('[data-handleid="'+sh+'"]'));tx,ty=center(card(p,target).locator('[data-handleid="'+th+'"]'))
 p.mouse.move(x,y);p.mouse.down();p.mouse.move(tx,ty,steps=14)
 if cancel:p.keyboard.press('Escape')
 p.mouse.up();p.wait_for_timeout(100)
def blank(p):
 r=p.locator('#map-viewport').bounding_box();return r['x']+r['width']*.75,r['y']+r['height']*.85
def shot(p,name):p.screenshot(path=str(OUT/name))

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 def new(raw='',width=1600,height=1100):
  global current
  p=b.new_page(viewport={'width':width,'height':height});current=p;p.set_default_timeout(6000)
  p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);p.on('request',lambda r:requests.append(r.url))
  p.evaluate('''raw=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,setItem:(k,v)=>fixtureStore[k]=String(v),removeItem:k=>delete fixtureStore[k]},configurable:true});}''',raw)
  p.set_content(HTML.read_text())
  if not val(p,'state.projects.length'):act(p,'sample',scope='main')
  
  if not p.locator('#sidebar').is_visible():act(p,'menu')
  act(p,'nav','sitemap','#sidebar');p.wait_for_selector('.vue-flow__node');p.wait_for_timeout(120);return p
 try:
  p=new()
  check('Real pinned Vue 3 runtime and Pinia projection are active',val(p,'Vue.version==="3.5.43" && !!flowUi.store.$id && !!flowUi.api'))
  check('Every visible surface is a real Vue Flow custom node',p.locator('.vue-flow__node-surface').count()==5)
  check('Four visible connection handles are provided per card',p.locator('.flow-port').count()==20)
  check('Starts with an honest empty selection',val(p,'selectedNode()===null') and 'No surface selected' in p.locator('.inspector-body').inner_text())
  select(p,'node-2');check('Click selects without opening an editor',val(p,'designUi.selected==="node-2"') and not val(p,'document.getElementById("modal").open'))
  p.mouse.click(*blank(p));p.wait_for_timeout(80)
  check('Click blank canvas clears both canonical and rendered selection',val(p,'selectedNode()===null && canvasUi.edge===null') and p.locator('.map-node.selected').count()==0)
  check('Focus-selection control disables after deselection',p.locator('[data-action="canvas-focus"]').is_disabled())
  select(p,'node-2')
  point=p.locator('#edge-4').evaluate('(e)=>{const p=e.getPointAtLength(e.getTotalLength()*.2);const q=new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y}}')
  p.mouse.click(point['x'],point['y']);p.wait_for_timeout(80)
  check('Clicking the SVG line itself opens the type editor',val(p,'modalType==="design-connect" && designUi.form.id==="edge-4"'));close(p)
  nlinks=val(p,'design().links.length');parents=val(p,'JSON.stringify(design().nodes.map(n=>[n.id,n.parent]))')
  connect(p,'node-2','node-3')
  check('Real handle dragging opens a reviewed connection draft',val(p,'modalType==="design-connect" && designUi.form.from==="node-2" && designUi.form.to==="node-3"'))
  check('Drawing has not yet changed the semantic model',val(p,'design().links.length')==nlinks)
  check('Screen destinations expose semantic types, not line shapes',p.locator('#d-link-kind option').all_text_contents()==['Navigate','Return','Conditional navigation','Pass context'])
  p.locator('#d-link-kind').select_option('conditional');p.locator('#d-link-label').fill('Inspect approved record');act(p,'design-link-save')
  check('Conditional transition requires a declared condition','Describe the condition' in p.locator('#design-error').inner_text())
  p.locator('#d-link-condition').fill('The selected record has status approved.');p.locator('#d-link-description').fill('Preserve the active collection filters.');act(p,'design-link-save')
  eid=val(p,'design().links.at(-1).id');check('Typed connection persists its handle IDs, condition and notes',val(p,'design().links.at(-1).kind==="conditional" && design().links.at(-1).sourceHandle==="out-right" && design().links.at(-1).targetHandle==="in-left" && design().links.at(-1).condition.includes("approved")'))
  check('Connecting screens never reparents them',val(p,'JSON.stringify(design().nodes.map(n=>[n.id,n.parent]))')==parents)
  check('Parallel same-handle transitions have distinct paths',val(p,'(()=>{let a=document.querySelector("#edge-4"),b=document.querySelector("#'+eid+'");return a&&b&&a.getAttribute("d")!==b.getAttribute("d")})()'))
  p.locator('[data-flow-edge="'+eid+'"]').click();p.wait_for_timeout(80)
  check('Clicking a line label opens its existing type for editing',p.locator('#d-link-kind').input_value()=='conditional' and val(p,'designUi.form.editing'))
  shot(p,'02-connection-type.png');p.locator('#d-link-kind').select_option('return');act(p,'design-link-save')
  check('Editing a type preserves line identity and clears inapplicable condition',val(p,'design().links.find(e=>e.id==="'+eid+'").kind==="return" && design().links.find(e=>e.id==="'+eid+'").condition===""'))
  act(p,'design-undo');check('Undo restores the prior declared type',val(p,'design().links.find(e=>e.id==="'+eid+'").kind==="conditional"'))
  act(p,'canvas-fit');connect(p,'node-3','node-2');close(p)
  check('Cancelling a reviewed connection leaves no new edge',val(p,'design().links.length')==nlinks+1)
  connect(p,'node-3','node-2',cancel=True)
  check('Escape during actual handle dragging cancels the preview',not val(p,'document.getElementById("modal").open') and val(p,'design().links.length')==nlinks+1)
  connect(p,'node-2','node-2','out-bottom','in-top')
  check('A self-connection is rejected by the runtime',not val(p,'document.getElementById("modal").open') and val(p,'design().links.length')==nlinks+1)
  # Pointer-free equivalent uses the same reviewed application operation.
  act(p,'design-connect');p.locator('#d-link-from').select_option('node-3');p.locator('#d-link-to').select_option('node-7')
  check('Destination change constrains the semantic type',p.locator('#d-link-kind option').all_text_contents()==['Configure','Pass context'])
  close(p)
  if p.locator('#discard-dialog[open]').count():p.locator('#discard-confirm').click()
  select(p,'node-2');act(p,'canvas-focus');act(p,'flow-components','node-2');check('Selected surface exposes available library components',p.locator('.flow-palette-item').count()==20)
  p.locator('#flow-component-search').fill('zz absent');check('Library search has a recoverable empty result','No matching components' in p.locator('#flow-component-options').inner_text());p.locator('#flow-component-search').fill('Record')
  act(p,'flow-place-component','node-2:record-card');check('Placement opens a region review without mutation',val(p,'selectedNode().components.length')==0 and p.locator('#modal').get_by_role('heading').inner_text()=='Place RecordCard')
  act(p,'product-component-bind-save');check('Placement creates a versioned reference on the selected screen',val(p,'selectedNode().components[0].id==="record-card" && selectedNode().components[0].version==="1.0.0"'))
  check('Card exposes its placed component directly',card(p,'node-2').locator('.flow-binding-chip').inner_text().startswith('RecordCard'))
  card(p,'node-2').locator('.flow-binding-chip').click();p.locator('#flow-binding-region').select_option('header');act(p,'flow-binding-save')
  check('Binding region can change without copying library source',val(p,'selectedNode().components[0].slot==="header" && design().library.filter(c=>!c.contentSpec).length===6 && design().library.filter(c=>c.contentSpec).length===14'))
  act(p,'flow-binding','node-2:record-card:header');act(p,'flow-binding-remove');check('Removal is explicitly confirmed',p.locator('#modal').get_by_role('heading').inner_text()=='Remove this placement?');act(p,'flow-binding-remove-confirm')
  check('Removing placement preserves the library definition',val(p,'selectedNode().components.length===0 && design().library.some(c=>c.id==="record-card")'));act(p,'design-undo')
  check('Undo restores the exact region and version',val(p,'selectedNode().components[0].slot==="header" && selectedNode().components[0].version==="1.0.0"'))
  act(p,'flow-components','node-2');act(p,'canvas-fit');p.locator('#flow-component-search').fill('Record')
  p.locator('.flow-palette-item').first.drag_to(card(p,'node-3'));p.wait_for_timeout(100)
  check('Dragging a palette component onto a different card opens a placement review',val(p,'modalType==="product-bind" && productUi.form.node==="node-3"'))
  act(p,'product-component-bind-save')
  check('Dropped component binds only to the target surface',val(p,'design().nodes.find(n=>n.id==="node-3").components[0].id==="record-card"'))
  select(p,'node-2');act(p,'canvas-focus');act(p,'flow-components','node-2');act(p,'canvas-focus');shot(p,'03-components-on-view.png')
  act(p,'flow-intent','node-2');p.locator('#flow-intent-text').fill('When reviewing a project, I want to find the right note without losing context.');p.locator('#flow-goals-text').fill('Find a record using filters\nOpen its details\nReturn to the same collection state');act(p,'flow-intent-save')
  check('Intent and goals are saved as bounded per-card data',val(p,'selectedNode().intent.includes("without losing context") && selectedNode().goals.length===3'))
  check('Card displays the saved intent and goal count','without losing context' in card(p,'node-2').inner_text() and '3 user goals' in card(p,'node-2').inner_text())
  check('Intent and goals are included in portable design',val(p,'portableDesign().nodes.find(n=>n.id==="node-2").goals.length===3'))
  shot(p,'04-user-intent.png');act(p,'flow-intent','node-2');p.locator('#flow-intent-text').fill('Discard this draft');close(p)
  check('Intent editor preserves dirty-dismiss protection',p.locator('#discard-dialog[open]').count()==1);p.locator('#discard-confirm').click()
  check('Discard leaves the saved user intent unchanged',val(p,'selectedNode().intent.includes("without losing context")'))
  semantic=val(p,'designFingerprint(design())');act(p,'flow-settings');p.locator('#flow-wheel').select_option('zoom');p.locator('[data-field="flow-grid"]').uncheck();p.locator('[data-field="flow-labels"]').uncheck();p.locator('#flow-curve').select_option('smoothstep');shot(p,'05-canvas-settings.png');close(p)
  check('Canvas settings update the actual Vue Flow configuration',val(p,'flowUi.store.preferences.wheel==="zoom" && flowUi.store.preferences.curve==="smoothstep" && !flowUi.store.preferences.grid'))
  check('Labels can be hidden without removing edges',p.locator('.flow-edge-label').count()==0 and val(p,'design().links.length')==nlinks+1)
  check('Canvas preferences do not change semantic fingerprint',val(p,'designFingerprint(design())')==semantic)
  z=val(p,'canvasState().zoom');p.mouse.move(*blank(p));p.mouse.wheel(0,100);p.wait_for_timeout(200)
  check('Zoom wheel mode changes actual canvas zoom',abs(val(p,'canvasState().zoom')-z)>.005)
  act(p,'flow-settings');p.locator('#flow-wheel').select_option('pan');close(p);z=val(p,'canvasState().zoom');y=val(p,'canvasState().pan.y');p.mouse.move(*blank(p));p.mouse.wheel(0,90);p.wait_for_timeout(200)
  check('Pan wheel mode moves the viewport without changing zoom',abs(val(p,'canvasState().zoom')-z)<.001 and abs(val(p,'canvasState().pan.y')-y)>10)
  act(p,'flow-settings');p.locator('#flow-wheel').select_option('page');close(p);viewport=val(p,'JSON.stringify([canvasState().zoom,canvasState().pan])');p.mouse.move(*blank(p));p.mouse.wheel(0,90);p.wait_for_timeout(180)
  check('Page-wheel mode leaves the canvas transform unchanged',val(p,'JSON.stringify([canvasState().zoom,canvasState().pan])')==viewport)
  act(p,'flow-settings');act(p,'flow-settings-reset');close(p);check('Restore defaults updates both settings and toolbar',val(p,'canvasPreferences().wheel==="pan" && canvasPreferences().labels && canvasState().snap') and p.locator('[data-field="canvas-snap"]').is_checked())
  act(p,'canvas-fit');select(p,'node-2');before=val(p,'JSON.stringify(canvasState().pan)');x,y=blank(p);p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+45,y+25,steps=8);p.mouse.up();p.wait_for_timeout(100)
  check('Dragging blank space pans without deselecting the card',val(p,'JSON.stringify(canvasState().pan)')!=before and val(p,'designUi.selected==="node-2"'))
  p.mouse.click(*blank(p));check('A subsequent blank click deselects',val(p,'designUi.selected===null'))
  saved=val(p,'fixtureStore["shell-workbench-concept-v1"]');p.close();p=new(saved)
  check('Controlled storage restores typed edges, bindings and card goals',val(p,'design().links.some(e=>e.kind==="conditional") && design().nodes.find(n=>n.id==="node-2").goals.length===3 && design().nodes.find(n=>n.id==="node-2").components[0].slot==="header"'))
  check('Unknown future interaction preferences are rejected',val(p,'!validCanvasPreferences({...defaultCanvasPreferences(),schema:99})'),'model fixture')
  check('Wrong handle direction is rejected',val(p,'!!connectionError("node-2","node-3","in-left","out-right")'),'model fixture')
  check('Goal count limit is enforced',val(p,'!validIntentFields({intent:"x",goals:Array(13).fill("goal")})'),'model fixture')
  check('Invalid type cannot enter a stored link',val(p,'!validLinkFields({kind:"execute-arbitrary-code"})'),'model fixture')
  check('Visual preferences are excluded from generation snapshot',val(p,'!Object.hasOwn(generationSnapshot(design()),"canvas")'),'model fixture')
  act(p,'canvas-fit');shot(p,'01-interactive-sitemap.png')
  for route in ['prds','components','sitemap','overview','sitemap']:
   act(p,'nav',route,'#sidebar');p.wait_for_timeout(80)
  check('Repeated navigation creates one live renderer, not duplicated islands',p.locator('.vue-flow').count()==1 and val(p,'!!flowUi.app && !!flowUi.store'))
  act(p,'theme');shot(p,'06-light-theme.png');p.close()
  p=new(width=390,height=844);check('Narrow layout does not overflow the page',val(p,'document.documentElement.scrollWidth<=innerWidth'));act(p,'flow-settings');check('Settings dialog fits a narrow viewport',p.locator('#modal').bounding_box()['width']<=390);close(p);shot(p,'07-narrow.png');p.close()
  check('No page, runtime or console errors across these routes',not errors);check('No external requests made by the self-contained HTML',not requests)
 finally:
  report={'scope':'Actual Vue/Pinia/Vue Flow runtime; HTML injection and controlled Storage, not Obsidian or CLI','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'browser':b.version,'checks':checks,'errors':errors,'requests':requests}
  (OUT/'flow-browser-checks.json').write_text(json.dumps(report,indent=2)+'\n')
  if current and not current.is_closed() and checks and not checks[-1]['passed']:shot(current,'failure.png')
  b.close()
