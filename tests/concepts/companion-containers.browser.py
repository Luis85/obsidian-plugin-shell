"""Offline concept regression: ownership containers, geometry, naming and edge updates.
Chromium runs exact HTML injection. Model/geometry fixtures are labelled separately.
No native host, CLI, generation or file-origin persistence claim.
"""
import hashlib,json,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
HTML=ROOT/'docs/concepts/companion/index.html'
REPORT=ROOT/'reports/concepts/containers';REPORT.mkdir(parents=True,exist_ok=True)
checks,errors,requests=[],[],[]
fatal=None

def check(name,result=True,scope='browser interaction / rendered observation'):
 checks.append({'name':name,'result':'passed' if result else 'failed','scope':scope})
 print(('PASS' if result else 'FAIL'),name,flush=True)
 assert result,name

def js(p,s):return p.evaluate(s)
def act(p,name,value=None,scope=''):
 sel=f'{scope} [data-action="{name}"]'+(f'[data-value="{value}"]' if value is not None else '')
 p.locator(sel.strip()).first.click()
def wait(p):p.wait_for_timeout(150)
def close(p):act(p,'close',scope='#modal');wait(p)
def card(p,id):return p.locator(f'.map-node[data-node="{id}"]')
def center(r):return r['x']+r['width']/2,r['y']+r['height']/2

def make(p,kind,name):
 p.evaluate('(k)=>dispatch("design-add",k)',kind)
 p.locator('[data-field="design-node-label"]').fill(name)
 code=p.locator('[data-field="design-node-slug"]').input_value()
 act(p,'design-save',scope='#modal');wait(p)
 return code

def edge_open(p,id):p.locator(f'[data-flow-edge="{id}"]').click();wait(p)
def ready(p,id):edge_open(p,id);close(p)
def reconnect(p,id,end,node,side,cancel=False):
 a=center(p.locator(f'.vue-flow__edge[data-id="{id}"] .vue-flow__edgeupdater-{end}').bounding_box())
 z=center(p.locator(f'[data-port-node="{node}"][data-port-side="{side}"]').bounding_box())
 p.mouse.move(*a);p.mouse.down();p.mouse.move(*z,steps=20)
 if cancel:p.keyboard.press('Escape')
 p.mouse.up();wait(p)

def positions(p):
 js(p,"""referenceUi.panel='none';canvasState().brickDisplay='structure';canvasState().snap=false;canvasState().interaction.guides=false;canvasState().edges='all';canvasState().positions={'node-1':{x:100,y:50},'node-2':{x:100,y:480},'node-3':{x:530,y:480},'node-5':{x:970,y:50},'node-7':{x:970,y:480}};render();fitMap();""");wait(p)

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 def new(width=1600,height=1100):
  p=browser.new_page(viewport={'width':width,'height':height});p.set_default_timeout(6500)
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  p.on('request',lambda r:requests.append(r.url))
  p.set_content(HTML.read_text());act(p,'sample',scope='main')
  if width<650:act(p,'menu')
  act(p,'nav','sitemap','#sidebar');wait(p)
  return p
 p=None
 try:
  p=new();positions(p)
  check('Sample retains canonical content and has no validation errors',js(p,'designIssues(design()).every(i=>i.level!=="error")'))
  a=make(p,'view','Library');b=make(p,'view','Library');c=make(p,'view','Library')
  check('Unsuffixed code until collision, then increasing indices',(a,b,c)==('library','library-2','library-3'))
  ids=js(p,'design().nodes.filter(n=>n.label==="Library").map(n=>n.id)')
  check('Repeated visible labels retain distinct stable identities',len(set(ids))==3)
  p.evaluate('(id)=>dispatch("design-edit",id)',ids[0]);p.locator('[data-field="design-node-label"]').fill('Library renamed')
  check('Editing visible label preserves existing stable code',p.locator('[data-field="design-node-slug"]').input_value()=='library')
  act(p,'design-save',scope='#modal');p.evaluate('(id)=>dispatch("design-duplicate",id)',ids[1]);wait(p)
  check('Duplicate gets the next code without timestamps',js(p,'design().nodes.at(-1).slug')=='library-4')
  js(p,'dispatch("design-add","view")');p.locator('[data-field="design-node-label"]').fill('Another library');p.locator('[data-field="design-node-slug"]').fill('library');act(p,'design-save',scope='#modal')
  check('Explicit duplicate is rejected rather than silently renamed','unique' in p.locator('#design-error').inner_text())
  js(p,'modalOriginal=null');close(p)
  check('Allocation normalizes case and accents',js(p,'allocateSurfaceCode(design(),"LÍBRARY")')=='library-5','model fixture')
  p.close();p=new();positions(p)
  make(p,'group','Account navigation');group=js(p,'design().nodes.at(-1).id')
  for mode in ['structure','labels','wireframes']:
   p.evaluate('(m)=>{canvasState().brickDisplay=m;render();fitMap();}',mode);wait(p)
   check(f'{mode}: native view renders host layout, not content stack',card(p,'node-1').locator('.container-layout').count()==1 and card(p,'node-1').locator('.brick-stack').count()==0)
   check(f'{mode}: group is organizational, without fake content',card(p,group).locator('.navigation-group-body').count()==1 and card(p,group).locator('.brick-stack,.surface-layout-svg').count()==0)
   check(f'{mode}: rendered rectangles match canonical geometry',js(p,"""[...document.querySelectorAll('.map-node')].every(e=>{const s=brickSurfaceSize(design().nodes.find(n=>n.id===e.dataset.node)),r=e.getBoundingClientRect();return Math.abs(r.height/canvasState().zoom-s.height)<1&&Math.abs(r.width/canvasState().zoom-s.width)<1;})"""))
   check(f'{mode}: interiors fit without unintended clipping',js(p,"[...document.querySelectorAll('.map-node .flow-node-content')].every(e=>e.scrollHeight<=e.clientHeight+1)"))
   check(f'{mode}: selected layout has a visible name',js(p,'surfaceLayoutName(design().nodes.find(n=>n.id==="node-2"))') in card(p,'node-2').inner_text())
  p.evaluate('(id)=>dispatch("design-edit",id)',group)
  check('Group editor has no irrelevant layout controls',p.locator('[data-field="design-node-layout"]').count()==0);close(p)
  act(p,'canvas-child','node-1');check('Child creation inherits the selected view owner',p.locator('[data-field="design-node-parent"]').input_value()=='node-1');close(p)
  check('Earlier native-view content remains retained and accessible',js(p,'bricksOf(design().nodes.find(n=>n.id==="node-1")).length>0') and card(p,'node-1').locator('.retained-view-content').count()==1)
  p.screenshot(path=str(REPORT/'01-container-and-content.png'))
  p.close();p=new();positions(p)
  js(p,"""canvasState().sections=[{id:'sec-dialog',name:'Dialogs',roots:[],members:['node-5'],anchor:{x:48,y:1200}},{id:'sec-settings',name:'Settings',roots:[],members:['node-7'],anchor:{x:48,y:1600}},{id:'sec-empty',name:'Later',roots:[],members:[],anchor:{x:48,y:2000}}];render();""")
  before=js(p,'({fp:designFingerprint(design()),members:JSON.stringify(referenceSections(design()).map(s=>s.members))})')
  for mode in ['lanes','grid','vertical','horizontal','sections']:
   p.evaluate('(m)=>arrangeMap(m)',mode);wait(p)
   check(f'{mode}: section rectangles remain disjoint',js(p,"""(()=>{const z=sectionZones(design());return z.every((a,i)=>z.slice(i+1).every(b=>a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y));})()"""),'model geometry + rendered arrangement')
   check(f'{mode}: section bounds retain top, side and bottom padding',js(p,"""sectionZones(design()).every(z=>design().nodes.filter(n=>z.members.includes(n.id)).every(n=>{const p=canvasState().positions[n.id],s=brickSurfaceSize(n);return p.x-z.x>=39&&p.y-z.y>=63&&z.x+z.width-p.x-s.width>=39&&z.y+z.height-p.y-s.height>=39;}))"""),'model geometry + rendered arrangement')
  check('Arrangements keep group membership and semantic design unchanged',js(p,'designFingerprint(design())')==before['fp'] and js(p,'JSON.stringify(referenceSections(design()).map(s=>s.members))')==before['members'])
  js(p,"arrangeMap('lanes');state.settings.theme='light';render();fitMap();");wait(p);p.screenshot(path=str(REPORT/'02-section-safe-lanes.png'))
  p.close();p=new();positions(p)
  edge_open(p,'edge-4');p.locator('[data-field="design-link-label"]').fill('Review selected note');act(p,'design-link-save',scope='#modal');wait(p)
  check('Typed label editing preserves connection identity',js(p,'design().links.find(e=>e.id==="edge-4").label')=='Review selected note')
  edge_open(p,'edge-4');act(p,'edge-remove','edge-4',scope='#modal')
  check('Connection modal offers separately confirmed deletion',p.locator('[data-action="canvas-remove-edge-confirm"]').count()==1)
  before=js(p,'JSON.stringify(design().nodes)');act(p,'canvas-remove-edge-confirm','edge-4',scope='#modal');wait(p)
  check('Delete changes only the chosen flow connection',js(p,'!design().links.some(e=>e.id==="edge-4")') and js(p,'JSON.stringify(design().nodes)')==before)
  act(p,'design-undo');wait(p);check('Undo restores exact labelled connection',js(p,'design().links.some(e=>e.id==="edge-4"&&e.label==="Review selected note")'))
  edge_open(p,'contains-node-2');p.locator('[data-field="connection-structure-label"]').fill('Hosts collection');fp=js(p,'designFingerprint(design())');act(p,'connection-structure-save',scope='#modal');wait(p)
  check('Structural caption is editable without changing containment',js(p,'canvasState().anchors["contains-node-2"].label')=='Hosts collection' and js(p,'designFingerprint(design())')==fp)
  edge_open(p,'contains-node-2');p.locator('[data-field="connection-structure-label"]').fill('');act(p,'connection-structure-save',scope='#modal')
  check('Blank structural label rejected with data retained','1–120' in p.locator('#connection-error').inner_text());js(p,'modalOriginal=null');close(p)
  edge_open(p,'contains-node-2');js(p,'canvasState().anchors["contains-node-2"].label="Changed elsewhere"');p.locator('[data-field="connection-structure-label"]').fill('Stale caption');act(p,'connection-structure-save',scope='#modal')
  check('Concurrent visual-label change rejects stale save','changed' in p.locator('#connection-error').inner_text().lower(),'controlled concurrent-change fixture');js(p,'modalOriginal=null');close(p)
  edge_open(p,'contains-node-3');act(p,'edge-remove','contains-node-3',scope='#modal')
  check('Removing containment explains required replacement ownership','replacement' in p.locator('#modal').inner_text().lower())
  p.locator('#detach-parent').select_option('node-2');act(p,'edge-detach-confirm',scope='#modal');wait(p)
  check('Old containment removed without deleting the screen',js(p,'design().nodes.find(n=>n.id==="node-3").parent==="node-2"&&design().nodes.length===5'))
  act(p,'design-undo');wait(p);check('Undo restores the previous owner',js(p,'design().nodes.find(n=>n.id==="node-3").parent')=='node-1')
  p.close();p=new();positions(p)
  ready(p,'edge-4');saved=js(p,'JSON.stringify(design().links.find(e=>e.id==="edge-4"))')
  check('Selected edge exposes two updater controls',p.locator('.vue-flow__edge[data-id="edge-4"] .vue-flow__edgeupdater').count()==2)
  reconnect(p,'edge-4','target','node-5','top');p.wait_for_selector('#modal[open] [data-action="design-link-save"]')
  check('Actual target drag proposes update without committing',js(p,'designUi.form.id==="edge-4"&&designUi.form.to==="node-5"&&designUi.form.targetHandle==="in-top"') and js(p,'JSON.stringify(design().links.find(e=>e.id==="edge-4"))')==saved)
  p.screenshot(path=str(REPORT/'03-reconnect-review.png'));close(p)
  check('Cancel leaves original connection unchanged',js(p,'JSON.stringify(design().links.find(e=>e.id==="edge-4"))')==saved)
  reconnect(p,'edge-4','target','node-5','top');p.wait_for_selector('#modal[open]');act(p,'design-link-save',scope='#modal');wait(p)
  check('Save updates same edge without duplication',js(p,'design().links.length===2&&design().links.find(e=>e.id==="edge-4").targetHandle==="in-top"&&design().links.find(e=>e.id==="edge-4").to==="node-5"'))
  act(p,'design-undo');wait(p);check('Undo restores complete previous edge',js(p,'JSON.stringify(design().links.find(e=>e.id==="edge-4"))')==saved)
  ready(p,'edge-4');reconnect(p,'edge-4','source','node-1','bottom');p.wait_for_selector('#modal[open]')
  check('Actual origin drag independently changes its proposed anchor',js(p,'designUi.form.from==="node-1"&&designUi.form.sourceHandle==="out-bottom"&&designUi.form.to==="node-3"'));close(p)
  reconnect(p,'edge-4','target','node-5','top',True)
  check('Escape leaves no ghost gesture, modal or changed edge',js(p,'!document.getElementById("modal").open&&!flowUi.connecting&&edgeEditing.reconnect===null') and js(p,'JSON.stringify(design().links.find(e=>e.id==="edge-4"))')==saved)
  ready(p,'contains-node-2');anchors=js(p,'JSON.stringify(canvasState().anchors)')
  reconnect(p,'contains-node-2','target','node-2','left');p.wait_for_selector('#modal[open] [data-action="connection-structure-save"]')
  check('Actual structural endpoint drag reviews same child at new anchor',js(p,'connectionUi.structure.targetHandle==="structure-in-left"') and js(p,'JSON.stringify(canvasState().anchors)')==anchors)
  act(p,'connection-structure-save',scope='#modal');wait(p)
  check('Structural anchor save keeps ownership intact',js(p,'canvasState().anchors["contains-node-2"].targetHandle==="structure-in-left"&&design().nodes.find(n=>n.id==="node-2").parent==="node-1"'))
  ready(p,'contains-node-3');reconnect(p,'contains-node-3','source','node-2','right');p.wait_for_selector('#modal[open] [data-action="connection-structure-save"]')
  check('Actual structural source drag proposes another parent for review',js(p,'connectionUi.structure.parent==="node-2"&&design().nodes.find(n=>n.id==="node-3").parent==="node-1"'));close(p)
  p.close();p=new();positions(p)
  js(p,'for(const pos of Object.values(canvasState().positions)){pos.x+=4000;pos.y+=3500;}render();fitMap();');wait(p)
  check('Inner edge SVG allows graph-coordinate overflow',js(p,"[...document.querySelectorAll('svg.vue-flow__edges')].every(e=>getComputedStyle(e).overflow==='visible')"))
  point=js(p,"""(()=>{const path=document.querySelector('.vue-flow__edge[data-id="edge-4"] .vue-flow__edge-interaction');for(const f of [.1,.2,.3,.4,.6,.7,.8,.9]){const s=path.getPointAtLength(path.getTotalLength()*f),q=new DOMPoint(s.x,s.y).matrixTransform(path.getScreenCTM());if(document.elementFromPoint(q.x,q.y)?.closest('.vue-flow__edge')?.dataset.id==='edge-4')return {x:q.x,y:q.y};}return null;})()""")
  check('Far-origin line remains hit-testable in visible viewport',point is not None)
  p.mouse.click(point['x'],point['y']);p.wait_for_selector('#modal[open]');check('Clicking the unclipped SVG opens the line editor',js(p,'modalType==="design-connect"'));close(p)
  before=js(p,'({anchors:JSON.stringify(canvasState().anchors),links:JSON.stringify(design().links)})')
  x,y=center(card(p,'node-3').locator('.map-card-title').bounding_box());p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+40,y+30,steps=10);p.mouse.up();wait(p)
  check('Card movement still preserves chosen anchors',js(p,'JSON.stringify(canvasState().anchors)')==before['anchors'] and js(p,'JSON.stringify(design().links)')==before['links'])
  p.screenshot(path=str(REPORT/'04-structure-overview.png'));p.close()
  for width,theme in [(1600,'light'),(390,'dark')]:
   p=new(width,1000 if width==1600 else 844);p.evaluate('(t)=>{state.settings.theme=t;render();}',theme);wait(p)
   check(f'{width}px {theme}: no horizontal document overflow',js(p,'document.documentElement.scrollWidth<=innerWidth'))
   p.screenshot(path=str(REPORT/f'05-canvas-{width}-{theme}.png'));p.close()
  check('No page or console errors in tested paths',not errors)
  check('No runtime network requests in tested paths',not requests)
 except Exception as e:
  fatal=str(e);print(traceback.format_exc(),flush=True)
  if p and not p.is_closed():p.screenshot(path=str(REPORT/'failure.png'))
 finally:
  browser.close()
  result={'scope':'Offline concept; Chromium exact HTML injection','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'passed':sum(c['result']=='passed' for c in checks),'failed':sum(c['result']=='failed' for c in checks),'fatal':fatal,'errors':errors,'requests':requests}
  (REPORT/'checks.json').write_text(json.dumps(result,indent=2)+'\n')
  print(json.dumps({k:v for k,v in result.items() if k!='checks'}),flush=True)
if fatal:raise SystemExit(1)
