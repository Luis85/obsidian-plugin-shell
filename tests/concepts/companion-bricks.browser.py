"""Content Brick concept: real embedded Vue Flow, exact HTML injection.
No native host/CLI claim. Storage and explicitly labeled negative cases are fixtures.
"""
from pathlib import Path
import argparse, hashlib, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--html',default=str(ROOT/'docs/concepts/companion/index.html'));a.add_argument('--out',default=str(ROOT/'reports/concepts/companion-bricks'));a.add_argument('--browser',default='/usr/bin/chromium');args=a.parse_args()
HTML=Path(args.html);OUT=Path(args.out);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[];current=None

def check(name,ok,scope='browser interaction / resulting state'):
 checks.append({'name':name,'passed':bool(ok),'scope':scope});print('PASS' if ok else 'FAIL',name,flush=True);assert ok,name

def v(p,s):return p.evaluate(s)
def act(p,key,value=None,scope=''):
 if key=='brick-kind':
  node,kind=value.split(':');key='library-pick';value=node+':content-'+kind
 q=f'{scope} [data-action="{key}"]'+(f'[data-value="{value}"]' if value is not None else '')+':visible'
 if key=='brick-edit':q+=':not(.brick-grip)'
 p.locator(q.strip()).first.click();p.wait_for_timeout(90)
def card(p,n='node-2'):return p.locator(f'.map-node[data-node="{n}"]')
def close(p):act(p,'close',scope='#modal')
def focus(p,n='node-2'):
 card(p,n).locator('.map-card-title').click();act(p,'canvas-focus');p.wait_for_timeout(90)
def ids(p,n='node-2'):return p.evaluate('id=>bricksOf(design().nodes.find(n=>n.id===id)).map(b=>b.id)',n)
def shot(p,n):p.screenshot(path=str(OUT/n))
def drag(p,one,two):
 x=one.bounding_box();y=two.bounding_box();p.mouse.move(x['x']+x['width']/2,x['y']+x['height']/2);p.mouse.down();p.mouse.move(y['x']+y['width']/2,y['y']+y['height']/2,steps=16);p.wait_for_timeout(80);p.mouse.up();p.wait_for_timeout(180)

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 def new(raw='',width=1680,height=1120):
  global current
  p=b.new_page(viewport={'width':width,'height':height});current=p;p.set_default_timeout(7000)
  p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);p.on('request',lambda r:requests.append(r.url))
  p.evaluate('''raw=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,setItem:(k,x)=>fixtureStore[k]=String(x),removeItem:k=>delete fixtureStore[k]},configurable:true});}''',raw)
  p.set_content(HTML.read_text())
  if not v(p,'state.projects.length'):act(p,'sample',scope='main')
  if not p.locator('#sidebar').is_visible():act(p,'menu')
  act(p,'nav','sitemap','#sidebar');p.wait_for_selector('.vue-flow__node');p.wait_for_timeout(240);return p
 try:
  p=new();check('The existing Vue Flow runtime renders five content cards',p.locator('.vue-flow__node').count()==5 and v(p,'!!flowUi.api && !!flowUi.store'))
  check('Example explicitly provides fifteen ordered planning bricks',p.locator('.content-brick').count()==15)
  check('Each brick has its own original wireframe',p.locator('.content-brick .brick-wireframe').count()==15)
  check('No structure blocker is introduced by the seeded content',not v(p,'designIssues(design()).some(i=>i.level==="error")'))
  check('Vue Flow measures taller content cards rather than old fixed bounds',v(p,'flowUi.api.getNodes.value.every(n=>n.dimensions.height===brickSurfaceSize(design().nodes.find(x=>x.id===n.id)).height)'))
  p.wait_for_timeout(2000);shot(p,'01-content-map.png');focus(p);act(p,'canvas-inspector','bricks');shot(p,'02-content-inspector.png')
  fingerprint=v(p,'designFingerprint(design())');links=v(p,'JSON.stringify(design().links)');parents=v(p,'JSON.stringify(design().nodes.map(n=>n.parent))')
  act(p,'brick-display','labels');check('Labels mode keeps every brick and hides wireframes',p.locator('.content-brick').count()==15 and p.locator('.content-brick .brick-wireframe').count()==0)
  act(p,'brick-display','structure');check('Structure mode preserves the original compact cards',p.locator('.map-card-layout').count()==5 and p.locator('.content-brick').count()==0)
  check('Display settings do not change generation input or relationships',v(p,'designFingerprint(design())')==fingerprint and v(p,'JSON.stringify(design().links)')==links)
  act(p,'brick-display','wireframes');focus(p)
  act(p,'brick-add','node-2','.map-node');check('Palette exposes fourteen content block types',p.locator('#brick-palette-results .brick-palette-item').count()==14)
  shot(p,'03-brick-palette.png');p.locator('#brick-search').fill('table');check('Block palette search narrows the actual choices',p.locator('#brick-palette-results .brick-palette-item').count()==1)
  act(p,'brick-kind','node-2:table');check('Choosing a block opens a draft without mutating content',len(ids(p))==3)
  p.locator('#brick-title').fill(' ');act(p,'brick-save');check('Blank title is rejected before any mutation',p.locator('#brick-error').inner_text()!='' and len(ids(p))==3)
  p.locator('#brick-title').fill('Project budgets');p.locator('#brick-purpose').fill('Compare planned costs with actual spend.');p.locator('#brick-content').fill('Columns: room, budget, actual.\nShow zero as a valid amount.');p.locator('#brick-component').select_option('record-card');shot(p,'04-brick-editor.png');rev=v(p,'design().revision');act(p,'brick-save');bid=ids(p)[-1]
  check('Saving adds exactly one brick and one semantic revision',len(ids(p))==4 and v(p,'design().revision')==rev+1)
  check('Component mapping adds a real versioned library placement',v(p,'design().nodes.find(n=>n.id==="node-2").components.some(c=>c.id==="record-card"&&c.version==="1.0.0")'))
  check('Content editing preserves screen parents and navigation',v(p,'JSON.stringify(design().links)')==links and v(p,'JSON.stringify(design().nodes.map(n=>n.parent))')==parents)
  check('Component mapping does not duplicate the shared definition',v(p,'design().library.filter(c=>c.id==="record-card").length')==1)
  act(p,'brick-edit','node-2:'+bid);rev=v(p,'design().revision');act(p,'brick-save');check('Saving unchanged content is a semantic no-op',v(p,'design().revision')==rev)
  act(p,'design-edit','node-2','.map-node');act(p,'design-save');check('The existing surface editor preserves its content bricks',bid in ids(p))
  act(p,'brick-edit','node-2:'+bid);p.locator('#brick-title').fill('Unsaved change');p.locator('#brick-kind').select_option('list');close(p)
  check('Dirty brick drafts retain the original checkpoint through a redraw',p.locator('#discard-dialog[open]').count()==1)
  p.locator('#discard-keep').click();check('Keep editing preserves the changed draft',p.locator('#brick-title').input_value()=='Unsaved change')
  close(p);p.locator('#discard-confirm').click();check('Discard leaves the saved content intact',v(p,f'design().nodes[1].bricks.find(b=>b.id==="{bid}").title')=='Project budgets')
  before=ids(p);act(p,'brick-up','node-2:'+bid,scope='.polish-inspector');check('Earlier changes reading order, not containment',ids(p)[-2]==bid and v(p,'JSON.stringify(design().nodes.map(n=>n.parent))')==parents)
  act(p,'design-undo');check('Undo restores exact content order and stable IDs',ids(p)==before);act(p,'design-redo');check('Redo restores the content-order operation',ids(p)[-2]==bid)
  focus(p);before=ids(p);pos=v(p,'JSON.stringify(canvasState().positions["node-2"])');hist=v(p,'design().history.length')
  drag(p,card(p).locator('[data-brick-drag]').last,card(p).locator('.content-brick').first)
  check('Actual grip drag reorders the brick within its screen',ids(p)[0]==before[-1])
  check('Brick dragging does not move its enclosing Vue Flow node',v(p,'JSON.stringify(canvasState().positions["node-2"])')==pos)
  check('A completed content drag records one history entry',v(p,'design().history.length')==min(20,hist+1))
  # Header dragging must still be a card movement, not a content operation.
  before=ids(p);pos=v(p,'JSON.stringify(canvasState().positions["node-2"])');title=card(p).locator('.map-card-title').bounding_box()
  p.mouse.move(title['x']+60,title['y']+10);p.mouse.down();p.mouse.move(title['x']+110,title['y']+45,steps=10);p.mouse.up();p.wait_for_timeout(200)
  check('Dragging the header still moves the card and preserves brick order',v(p,'JSON.stringify(canvasState().positions["node-2"])')!=pos and ids(p)==before)
  act(p,'brick-transfer','node-2:'+bid);p.locator('#brick-target').select_option('node-3');p.locator('[data-field="brick-copy"]').check();act(p,'brick-transfer-save');copyid=ids(p,'node-3')[-1]
  check('Copying content across screens creates a distinct brick ID',copyid!=bid and bid in ids(p) and len(ids(p,'node-3'))==4)
  check('Copied mapping references the same component library definition',v(p,'design().nodes.find(n=>n.id==="node-3").components.some(c=>c.id==="record-card")') and v(p,'design().library.filter(c=>!c.contentSpec).length')==6 and v(p,'design().library.filter(c=>c.contentSpec).length')==14)
  act(p,'brick-transfer','node-3:'+copyid);p.locator('#brick-target').select_option('node-2');act(p,'brick-transfer-save')
  check('Moving content preserves identity and removes only its original occurrence',copyid in ids(p) and copyid not in ids(p,'node-3'))
  check('Moving content retains source component placement for explicit review',v(p,'design().nodes.find(n=>n.id==="node-3").components.some(c=>c.id==="record-card")'))
  act(p,'brick-delete','node-2:'+copyid);close(p);check('Cancelling removal preserves the brick',copyid in ids(p))
  act(p,'brick-delete','node-2:'+copyid);act(p,'brick-delete-confirm');check('Confirmed removal deletes only the content record',copyid not in ids(p) and v(p,'design().nodes[1].components.length')==1)
  act(p,'design-undo');check('Undo restores a removed brick and mapping',copyid in ids(p))
  act(p,'brick-edit','node-2:'+bid);p.locator('#brick-content').fill('<img src=x onerror=alert(1)>\n<script>throw 1</script>');act(p,'brick-save');act(p,'brick-edit','node-2:'+bid)
  check('Entered markup stays inert in the editor',p.locator('#modal img').count()==0 and '<img' in p.locator('#brick-content').input_value());close(p)
  act(p,'design-plan');check('Source plan includes an explicit ordered content handoff',v(p,'designUi.plan.changes.some(f=>f.path==="docs/SCREEN-CONTENT-OUTLINE.md"&&f.content.includes("Project budgets"))'))
  check('Surface contracts carry bricks without claiming component execution',v(p,'designUi.plan.changes.some(f=>f.path.endsWith("surface-spec.ts")&&f.content.includes("contentBricks"))'));plan=v(p,'designUi.plan.fingerprint');close(p)
  act(p,'brick-display','labels');check('Display change retains an otherwise current source plan',v(p,'designUi.plan.fingerprint')==plan and v(p,'designFingerprint(design())')==plan)
  act(p,'brick-display','wireframes');act(p,'brick-up','node-2:'+bid,scope='.polish-inspector');check('Content order changes invalidate the reviewed source plan',v(p,'designUi.plan===null'))
  # Portable model negative controls do not claim user interaction coverage.
  check('Blueprint round-trip includes ordered bricks',v(p,'structuralDesign(portableDesign()) && portableDesign().nodes.some(n=>n.bricks?.length)'), 'model fixture')
  check('Older blueprints without bricks remain valid',v(p,'(()=>{const d=portableDesign();d.nodes.forEach(n=>delete n.bricks);return structuralDesign(d)})()'),'model fixture')
  check('Unknown brick schema fails closed',v(p,'(()=>{const d=portableDesign();d.nodes[0].bricks[0].schema=999;return !structuralDesign(d)})()'),'negative model fixture')
  check('Oversized content is rejected',v(p,'(()=>{const n=designCopy(design().nodes[0]);n.bricks[0].content="x".repeat(4001);return !validBricks(n)})()'),'negative model fixture')
  check('Duplicate brick IDs are blocking issues',v(p,'(()=>{const d=designCopy(design());d.nodes[1].bricks[0].id=d.nodes[0].bricks[0].id;return brickIssues(d).some(i=>i.code==="brick-id")})()'),'negative model fixture')
  check('Deleted component placements surface a broken mapping',v(p,'(()=>{const d=designCopy(design());d.nodes[1].components=[];return brickIssues(d).some(i=>i.code==="brick-binding")})()'),'negative model fixture')
  check('Unknown card-display preferences fail closed',v(p,'!validCanvas({...canvasState(),brickDisplay:"remote-renderer"})'),'negative model fixture')
  act(p,'brick-edit','node-2:'+bid);v(p,'design().revision++');act(p,'brick-save');check('Stale editor cannot overwrite a newer revision','stale' in p.locator('#brick-error').inner_text(),'controlled revision conflict + real submit');close(p)
  # Cancel may require discard if no field changed? model-only drift changes none.
  if p.locator('#discard-dialog[open]').count():p.locator('#discard-confirm').click()
  saved=v(p,'fixtureStore["shell-workbench-concept-v1"]');p.close();p=new(saved)
  check('Controlled Storage round-trip retains content and display settings',bid in ids(p) and v(p,'brickDisplay()')=='wireframes','Storage fixture + browser rehydration')
  # Every alignment accounts for content-card height without overwriting the content model.
  semantic=v(p,'designFingerprint(design())')
  for mode in ['vertical','horizontal','lanes','grid']:
   p.locator('#map-layout').select_option(mode);p.wait_for_timeout(150)
   check(mode+' layout aligns expanded cards without overlap',v(p,'(()=>{const d=design(),c=canvasState();return d.nodes.every((n,i)=>d.nodes.slice(i+1).every(m=>{const a=c.positions[n.id],b=c.positions[m.id],x=brickSurfaceSize(n),y=brickSurfaceSize(m);return a.x+x.width<=b.x||b.x+y.width<=a.x||a.y+x.height<=b.y||b.y+y.height<=a.y}))})()'))
  check('All alignment modes preserve semantic content',v(p,'designFingerprint(design())')==semantic)
  p.close()
  p=new();focus(p);act(p,'canvas-inspector','bricks')
  count=len(ids(p));act(p,'brick-starter','node-2');close(p)
  check('Cancelling a suggested starter adds no content',len(ids(p))==count)
  act(p,'brick-starter','node-2');act(p,'brick-starter-confirm')
  check('Starter explicitly appends three bricks without replacing prior content',len(ids(p))==count+3)
  first=ids(p)[0];act(p,'brick-edit','node-2:'+first);act(p,'brick-duplicate','node-2:'+first)
  check('Duplicate content receives a new stable identifier',len(ids(p))==count+4 and ids(p)[1]!=first and len(set(ids(p)))==len(ids(p)))
  p.close()
  p=new();focus(p);act(p,'canvas-inspector','bricks')
  p.locator('.brick-inline-palette summary').click()
  source=p.locator('.brick-inline-palette [data-brick-kind="text"]');source.scroll_into_view_if_needed()
  drag(p,source,card(p).locator('.map-card-title'))
  check('Dragging a palette block opens the real editor for the target screen',p.locator('#brick-kind').input_value()=='text' and v(p,'brickUi.form.node')=='node-2')
  check('Palette drop does not commit before Save',len(ids(p))==3);close(p)
  act(p,'brick-display','labels');act(p,'canvas-fit')
  moved=ids(p)[-1];drag(p,card(p).locator('[data-brick-drag]').last,card(p,'node-3').locator('.map-card-title'))
  check('Cross-card content dragging opens a reviewed transfer',p.locator('#brick-target').input_value()=='node-3' and v(p,'brickUi.move.id')==moved)
  check('A cross-card drop has no unreviewed mutation',moved in ids(p) and moved not in ids(p,'node-3'));close(p)
  check('Cancelling a cross-card drag preserves both content stacks',len(ids(p))==3 and len(ids(p,'node-3'))==3)
  # A real handle draw still works with content-expanded node dimensions.
  act(p,'brick-display','wireframes');act(p,'canvas-fit')
  drag(p,card(p).locator('[data-handleid="out-right"]'),card(p,'node-5').locator('[data-handleid="in-left"]'))
  check('Vue Flow handle draw still opens a connection review on content cards',v(p,'document.getElementById("modal").open') and p.locator('#modal').inner_text().find('connection')>=0)
  close(p);check('Cancelling a content-card connection leaves bricks intact',p.locator('.content-brick').count()==15)
  p.close()
  for width,theme in [(1600,'light'),(1024,'dark'),(390,'dark')]:
   p=new(width=width,height=1100 if width>600 else 844)
   if theme=='light':act(p,'theme')
   check(f'No document overflow at {width}px {theme}',v(p,'document.documentElement.scrollWidth<=innerWidth'))
   if width>600:focus(p);act(p,'canvas-inspector','bricks')
   shot(p,f'05-content-{width}-{theme}.png')
   # Palette reached through a visible Method/primary-screen route on narrow screens.
   act(p,'brick-add','node-2','.map-node');check(f'Content palette fits {width}px',p.locator('#modal').bounding_box()['width']<=width)
   shot(p,f'06-palette-{width}.png');p.close()
  check('No browser runtime or console errors',not errors)
  check('No runtime network requests',not requests)
 except Exception as e:
  if current and not current.is_closed():current.screenshot(path=str(OUT/'failure.png'))
  print('FAILED',repr(e),flush=True);raise
 finally:
  (OUT/'brick-checks.json').write_text(json.dumps({'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'network_requests':requests},indent=2));b.close()
