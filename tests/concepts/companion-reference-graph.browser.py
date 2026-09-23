"""Retained graph editing through the refined canvas; browser concept only."""
import argparse,hashlib,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
H=ROOT/'docs/concepts/companion/index.html'
R=ROOT/'reports/concepts/reference/graph-checks.json'
checks=[];errors=[];requests=[];fatal=None
def ok(name,value,scope='browser interaction'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    assert value,name
def act(p,name,value=None,scope=''):
    s=f'{scope} [data-action="{name}"]'+(f'[data-value="{value}"]' if value is not None else '')
    p.locator(s.strip()).first.click()
def j(p,x):return p.evaluate(x)
def point(box):return box['x']+box['width']/2,box['y']+box['height']/2
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1600,'height':1000});p.set_default_timeout(6000)
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 p.on('request',lambda r:requests.append(r.url))
 try:
  p.set_content(H.read_text());act(p,'sample',scope='main');act(p,'nav','sitemap','#sidebar')
  p.wait_for_selector('.vue-flow__node');p.wait_for_timeout(100)
  act(p,'ref-panel-close');act(p,'canvas-fit');p.wait_for_timeout(120)
  before=j(p,'({rev:design().revision,links:design().links.length})')
  a=p.locator('[data-port-node="node-3"][data-port-side="right"]')
  z=p.locator('[data-port-node="node-5"][data-port-side="left"]')
  p.locator('.map-node[data-node="node-3"]').hover()
  x,y=point(a.bounding_box());tx,ty=point(z.bounding_box())
  p.mouse.move(x,y);p.mouse.down();p.mouse.move(tx,ty,steps=12);p.mouse.up()
  p.wait_for_selector('#modal[open] [data-action="design-link-save"]')
  ok('Real handle drag opens a reviewed connection without committing',j(p,'design().links.length')==before['links'])
  p.locator('[data-field="design-link-label"]').fill('Configure this record')
  act(p,'design-link-save',scope='#modal')
  ok('Confirming drawn connection creates exactly one typed relationship',j(p,'design().links.length')==before['links']+1)
  edge=j(p,'design().links[design().links.length-1].id')
  p.wait_for_timeout(100)
  target=p.evaluate('''id=>{const path=document.querySelector('.vue-flow__edge[data-id="'+CSS.escape(id)+'"] .vue-flow__edge-interaction');const m=path.getScreenCTM(),length=path.getTotalLength();for(const fraction of [.5,.35,.65,.2,.8,.1,.9]){const q=path.getPointAtLength(length*fraction),pt=new DOMPoint(q.x,q.y).matrixTransform(m),el=document.elementFromPoint(pt.x,pt.y);if(el?.closest('.vue-flow__edge')?.getAttribute('data-id')===id)return {x:pt.x,y:pt.y};}return null}''',edge)
  assert target,'No unobstructed point on the actual SVG interaction path'
  p.mouse.click(target['x'],target['y'])
  p.wait_for_selector('#modal[open] [data-action="design-link-save"]')
  p.locator('[data-field="design-link-label"]').fill('Review settings')
  act(p,'design-link-save',scope='#modal')
  ok('SVG line editing keeps connection identity and updates its label',j(p,f'design().links.find(l=>l.id==={json.dumps(edge)}).label')=='Review settings')
  # Visual movement stays outside semantic source generation.
  before=j(p,'({fp:designFingerprint(design()),positions:JSON.stringify(canvasState().positions)})')
  header=p.locator('.map-node[data-node="node-3"] .map-card-title')
  x,y=point(header.bounding_box());p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+40,y+25,steps=10);p.mouse.up();p.wait_for_timeout(80)
  ok('Actual card dragging changes visual positions only',j(p,'JSON.stringify(canvasState().positions)')!=before['positions'] and j(p,'designFingerprint(design())')==before['fp'])
  # Sort two content bricks on the card at useful zoom.
  p.locator('.map-node[data-node="node-2"] .map-card-title').click();act(p,'canvas-focus');p.wait_for_timeout(100)
  before=j(p,'design().nodes.find(n=>n.id==="node-2").bricks.map(b=>b.id)')
  grips=p.locator('.map-node[data-node="node-2"] [data-brick-grip]')
  if grips.count()==0:grips=p.locator('.map-node[data-node="node-2"] .brick-grip')
  target=p.locator('.map-node[data-node="node-2"] .content-brick').nth(1)
  start=grips.first.bounding_box();end=target.bounding_box()
  x,y=point(start);p.mouse.move(x,y);p.mouse.down();p.mouse.move(end['x']+end['width']/2,end['y']+end['height']-4,steps=14);p.mouse.up()
  p.wait_for_timeout(120)
  ok('Actual on-card content grip reorders library-backed instances',j(p,'design().nodes.find(n=>n.id==="node-2").bricks.map(b=>b.id)')!=before)
  # Settings remain non-semantic.
  fp=j(p,'designFingerprint(design())');act(p,'flow-settings',scope='.ref-main-dock')
  p.locator('[data-field="flow-wheel"]').select_option('zoom')
  ok('Canvas settings preserve source-plan identity',j(p,'canvasPreferences().wheel')=='zoom' and j(p,'designFingerprint(design())')==fp)
  act(p,'close',scope='#modal')
  ok('No page or console errors in retained graph flow',not errors)
  ok('No network requests in retained graph flow',not requests)
 except Exception as e:
  fatal=str(e);print('FAIL',fatal,flush=True)
  p.screenshot(path=str(ROOT/'reports/concepts/reference/graph-failure.png'))
 finally:
  b.close()
  R.parent.mkdir(parents=True,exist_ok=True);R.write_text(json.dumps({'scope':'Retained graph browser checks; no native/CLI evidence','html_sha256':hashlib.sha256(H.read_bytes()).hexdigest(),'checks':checks,'passed':sum(c['result']=='passed' for c in checks),'failed':sum(c['result']=='failed' for c in checks),'fatal':fatal,'errors':errors,'requests':requests},indent=2)+'\n')
  for c in checks:print(c['result'].upper(),c['name'],flush=True)
if fatal:raise SystemExit(1)
