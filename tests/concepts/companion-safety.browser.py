"""Concept authoring/recovery regressions against exact assembled HTML.
Storage tests use an explicit controlled adapter, not browser-origin qualification.
Geometry and concurrency fixtures are named separately from physical UI input.
"""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/safety'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None


def check(name, value, scope='browser interaction / rendered observation'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS' if value else 'FAIL'), name, flush=True)
    assert value, name


def act(p, name, value=None, scope=''):
    selector = f'{scope} [data-action="{name}"]'
    if value is not None:
        selector += f'[data-value="{value}"]'
    p.locator(selector.strip()).first.click()


def close(p):
    act(p, 'close', scope='#modal')


def fixture_script(initial=None):
    # The adapter provides observable writes and controlled failure, never native evidence.
    return '<script>window.__storage={value:' + json.dumps(initial) + ''',writes:0,fail:false,removeFail:false};
    Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:()=>window.__storage.value,
      setItem:(k,v)=>{if(__storage.fail)throw Error('fixture quota');__storage.value=v;__storage.writes++;},
      removeItem:()=>{if(__storage.removeFail)throw Error('fixture remove');__storage.value=null;__storage.writes++;}
    }});</script>'''


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])

    def new(width=1600, stored=None, sample=True):
        p = browser.new_page(viewport={'width': width, 'height': 1100}, accept_downloads=True)
        p.set_default_timeout(6000)
        p.on('pageerror', lambda e: errors.append(str(e)))
        p.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        p.on('request', lambda r: requests.append(r.url))
        p.set_content(fixture_script(stored) + HTML.read_text())
        if sample:
            act(p, 'sample', scope='main')
            if width < 650:
                act(p, 'menu')
            act(p, 'nav', 'sitemap', '#sidebar')
            p.wait_for_selector('.vue-flow__node')
        return p

    p = None
    try:
        p = new()
        before = p.evaluate('JSON.stringify(designSnapshot(design()))')
        p.evaluate('dispatch("design-transfer")')
        draft = '{"schema": 1, broken'
        p.locator('#blueprint-json').fill(draft)
        act(p, 'design-import', scope='#modal')
        check('Failed import preserves exactly the pasted draft', p.locator('#blueprint-json').input_value() == draft)
        check('Failed import leaves canonical outline unchanged', p.evaluate('JSON.stringify(designSnapshot(design()))') == before)
        check('Invalid import focuses the retained field with an associated error', p.locator('#blueprint-json').evaluate('e=>e===document.activeElement&&e.getAttribute("aria-invalid")==="true"&&e.getAttribute("aria-describedby")==="design-error"'))
        p.screenshot(path=str(OUT / 'import-recovery.png'))
        with p.expect_download() as download:
            act(p, 'design-export', scope='#modal')
        data = json.loads(Path(download.value.path()).read_text())
        check('Export downloads the saved blueprint, not malformed import text', data['kind'] == 'plugin-shell-blueprint' and data['executable'] is False)
        check('Export leaves the import draft and dialog open', p.locator('#modal').evaluate('e=>e.open') and p.locator('#blueprint-json').input_value() == draft)
        close(p)
        check('Closing a changed import requires discard review', p.locator('#discard-dialog').evaluate('e=>e.open'))
        p.locator('#discard-keep').click()
        check('Keep editing retains the draft', p.locator('#blueprint-json').input_value() == draft)
        p.keyboard.press('Escape')
        check('Escape also protects the import draft', p.locator('#discard-dialog').evaluate('e=>e.open'))
        p.locator('#discard-confirm').click()
        check('Explicit discard leaves saved outline unchanged', p.evaluate('JSON.stringify(designSnapshot(design()))') == before)
        p.evaluate('dispatch("design-transfer");design().goal="Concurrent update";designChanged()')
        act(p, 'design-import', scope='#modal')
        check('Stale import review cannot replace newer authoring', p.evaluate('design().goal') == 'Concurrent update' and 'outline changed' in p.locator('#design-error').inner_text(), 'controlled concurrency fixture + rendered review')
        close(p)
        p.evaluate('dispatch("design-add","settings")')
        check('New Settings model agrees with the visible form layout', p.evaluate('designUi.form.layout') == p.locator('[data-field="design-node-layout"]').input_value() == 'form')
        p.locator('[data-field="design-node-label"]').fill('Display preferences')
        act(p, 'design-save', scope='#modal')
        check('New Settings saves on the first attempt without hidden correction', not p.locator('#modal').evaluate('e=>e.open') and p.evaluate('design().nodes.at(-1).layout') == 'form')
        p.evaluate('window.__before={revision:design().revision,undo:design().history.length};designUi.plan={approved:true,marker:"unchanged"};dispatch("design-edit","node-2")')
        act(p, 'design-save', scope='#modal')
        check('Unchanged surface save preserves revision and undo history', p.evaluate('design().revision===__before.revision&&design().history.length===__before.undo'))
        check('Unchanged save preserves the reviewed source plan', p.evaluate('designUi.plan?.marker==="unchanged"&&designUi.plan.approved'))
        p.evaluate('window.__connectionBefore={revision:design().revision,undo:design().history.length};openTypedConnection(design().links[0])')
        act(p, 'design-link-save', scope='#modal')
        check('Unchanged legacy connection save does not create an artificial revision', p.evaluate('design().revision===__connectionBefore.revision&&design().history.length===__connectionBefore.undo'))
        p.evaluate('''const e=flowEdgeProjection(design()).find(e=>e.id==='contains-node-2');beginEdgeReconnect(e);
          canvasState().anchors[e.id].label='Concurrent relationship caption';
          reviewEdgeReconnect(e,{source:'node-1',target:'node-2',sourceHandle:'out-bottom',targetHandle:'in-top'});''')
        check('Reconnect refuses an intervening caption/anchor edit without a semantic revision', p.evaluate('!document.getElementById("modal").open&&edgeEditing.reconnect===null&&canvasState().anchors["contains-node-2"].label==="Concurrent relationship caption"'), 'controlled graph concurrency fixture')
        p.close()
        p = new()
        # A bounded-world corner is valid authoring state; focusing it must never reset sections/anchors.
        p.evaluate('''referenceUi.panel='none';canvasState().brickDisplay='structure';render();
          canvasState().positions['node-2']={x:49000,y:49000};designUi.selected='node-2';
          canvasState().sections=[{id:'section-1',name:'Far workspace',roots:[],members:['node-2'],anchor:{x:48000,y:48000}}];
          window.__map=JSON.stringify([canvasState().positions,canvasState().sections,canvasState().anchors]);
          window.__fp=designFingerprint(design());fitMap(true);''')
        check('Focus at large world coordinates preserves positions, sections and anchors', p.evaluate('JSON.stringify([canvasState().positions,canvasState().sections,canvasState().anchors])===__map'), 'boundary-coordinate fixture + rendered focus')
        check('Camera transform outside world bounds remains a valid canvas', p.evaluate('Math.abs(canvasState().pan.x)>50000&&validCanvas(canvasState())'), 'model geometry fixture')
        for factor in [2, .5, 2, .25, 2]:
            p.evaluate('(factor)=>zoomMap(factor)', factor)
        check('Repeated boundary zooms preserve the arrangement and source fingerprint', p.evaluate('JSON.stringify([canvasState().positions,canvasState().sections,canvasState().anchors])===__map&&designFingerprint(design())===__fp'), 'boundary-coordinate fixture + camera commands')
        p.evaluate('flowUi.api.setViewport({x:-100000,y:100000,zoom:2})')
        p.wait_for_timeout(250)
        check('Vue Flow camera events use camera bounds rather than world bounds', p.evaluate('Math.abs(canvasState().pan.x)>50000&&validCanvas(canvasState())&&canvasState().positions["node-2"].x===49000'), 'real Vue Flow viewport event')
        check('World positions still reject out-of-range and non-finite input', p.evaluate('''[50001,Infinity,NaN].every(x=>{const c=designCopy(canvasState());c.positions['node-2'].x=x;return !validCanvas(c);})'''), 'negative validation fixture')
        p.close()
        p = new()
        for key in ['kind', 'placement']:
            check(f'Inherited Object properties are rejected as {key} values', p.evaluate('(key)=>["constructor","toString","__proto__"].every(v=>{const d=designCopy(design());d.nodes[0][key]=v;return !structuralDesign(d);})', key), 'negative import validation fixture')
        check('Typed edges cannot impersonate structural relationship identities', p.evaluate('''(()=>{const d=designCopy(design());d.links[0].id='contains-node-2';return !structuralDesign(d);})()'''), 'negative import validation fixture')
        old = p.evaluate('JSON.stringify(designSnapshot(design()))')
        check('Oversized numeric identities are rejected before mutation', p.evaluate('''(()=>{const d=portableDesign();d.nodes.push({...designCopy(d.nodes[0]),id:'node-9007199254740992',slug:'safe-import-copy',entry:false,bricks:[],components:[]});try{importDesign(JSON.stringify(d));return false;}catch(e){return e.message.includes('safe numeric');}})()'''), 'negative import validation fixture')
        check('Rejected identity leaves current model and undo state unchanged', p.evaluate('JSON.stringify(designSnapshot(design()))') == old)
        p.evaluate('''const d=portableDesign();d.nodes[0].label='<img src=x onerror=alert(1)>';importDesign(JSON.stringify(d));render();''')
        check('Imported markup stays inert text', p.locator('.map-node img').count() == 0 and '<img' in p.locator('.map-node[data-node="node-1"]').inner_text())
        p.evaluate('''const d=design();const n=d.nodes.find(n=>n.id==='node-2');n.label='L'.repeat(120);dispatch('design-duplicate',n.id);''')
        check('Duplicate of a maximum-length label remains schema-valid', p.evaluate('design().nodes.at(-1).label.length===120&&structuralDesign(design())'), 'boundary-length fixture + duplicate command')
        check('Duplicate retains independent component identities', p.evaluate('new Set(design().nodes.flatMap(n=>bricksOf(n).map(b=>b.id))).size===design().nodes.reduce((s,n)=>s+bricksOf(n).length,0)'))
        # Populate bounded component content using valid sample block definitions; no source generation.
        p.evaluate('''const d=design(),template=designCopy(d.nodes.find(n=>n.id==='node-2')),block=designCopy(template.bricks[0]);
          d.nodes=d.nodes.filter(n=>n.kind==='view');d.nodes.forEach(n=>{n.bricks=[];n.components=[];});d.links=[];
          for(let i=0;i<17;i++){const n={...designCopy(template),id:'node-'+d.nextId++,slug:'capacity-'+i,label:'Capacity '+i,parent:d.nodes[0].id,nav:true,bricks:[]};
            for(let j=0;j<(i===16?16:24);j++)n.bricks.push({...designCopy(block),id:freshBrickId(d)});d.nodes.push(n);}
          canvasState(d);window.__capacity=JSON.stringify([designSnapshot(d),d.history,d.revision]);dispatch('design-duplicate',d.nodes[1].id);''')
        check('Duplication cannot exceed the 400-block persistence limit', p.evaluate('design().nodes.reduce((s,n)=>s+bricksOf(n).length,0)===400&&JSON.stringify([designSnapshot(design()),design().history,design().revision])===__capacity'), 'capacity fixture + duplicate command')
        check('Capacity rejection explains that original content is retained', '400' in p.locator('#toasts').inner_text())
        p.close()
        p = new()
        p.evaluate('save();window.__writes=__storage.writes;save();save()')
        check('Identical saves do not rewrite local state', p.evaluate('__storage.writes===__writes'), 'controlled storage adapter')
        saved = p.evaluate('__storage.value')
        q = new(stored=saved, sample=False)
        check('A complete saved snapshot restores with valid ownership and content', q.evaluate('!!state.activeId&&designIssues(design()).every(i=>i.level!=="error")&&!storageWarning'), 'controlled storage reload fixture')
        q.close()
        p.evaluate('__storage.value="external-newer-snapshot";design().goal="Local unpersisted edit";save()')
        check('Observed external changes stop local overwrites', p.evaluate('__storage.value==="external-newer-snapshot"&&storageWarning.includes("another window")&&design().goal==="Local unpersisted edit"'), 'controlled concurrency/storage fixture')
        check('Conflict offers visible recovery export', p.locator('#storage-recovery').is_visible())
        act(p, 'storage-recovery')
        recovered = json.loads(p.locator('#copy-text').input_value())
        check('Recovery includes the current in-memory project, not stale stored data', recovered['projects'][0]['design']['goal'] == 'Local unpersisted edit')
        close(p)
        p.evaluate('__storage.removeFail=true;dispatch("reset")')
        act(p, 'reset-confirm', scope='#modal')
        check('Failed reset retains memory and does not claim saved data was removed', p.evaluate('!!state.activeId&&__storage.value==="external-newer-snapshot"&&storageWarning.includes("Reset could not")'), 'controlled storage failure fixture')
        p.evaluate('__storage.removeFail=false')
        act(p, 'reset-confirm', scope='#modal')
        check('Explicit successful reset returns to fresh state', p.evaluate('state.projects.length===0&&!storageWarning&&JSON.parse(__storage.value).projects.length===0'))
        p.close()
        p = new(width=390)
        p.evaluate('__storage.fail=true;design().goal="Quota recovery";save()')
        check('Write failure is announced immediately without another render', p.locator('#storage-status').inner_text().startswith('Browser storage unavailable'))
        check('Narrow panes retain the warning and recovery action', p.locator('#storage-status').is_visible() and p.locator('#storage-recovery').is_visible())
        check('Recovery controls fit fully inside the narrow viewport', p.locator('#storage-recovery').evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight') and p.locator('#storage-status').evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight'))
        check('Recovery warning has a live status role', p.locator('#storage-status').get_attribute('role') == 'status')
        check('Narrow recovery layout has no horizontal document overflow', p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        p.screenshot(path=str(OUT / 'narrow-recovery.png'))
        p.close()
        p = new()
        p.evaluate('window.__retained=__storage.value;state.projects[0].notes=["x".repeat(5000000)];save()')
        check('Oversize saves preserve the last recoverable snapshot', p.evaluate('__storage.value===__retained&&storageWarning.includes("limit")'), 'storage-size boundary fixture')
        p.close()
        p = new(stored='{corrupt', sample=False)
        check('Malformed saved state stays preserved rather than overwritten', p.evaluate('__storage.value==="{corrupt"&&storageWarning.includes("preserved")'), 'controlled malformed storage fixture')
        check('All exercised paths have no page or console errors', not errors)
        check('Offline interaction paths make no runtime network requests', not requests)
    except Exception:
        fatal = traceback.format_exc()
        print(fatal)
        if p:
            p.screenshot(path=str(OUT / 'failure.png'))
    finally:
        browser.close()
        report = {'scope': 'Offline concept; exact HTML injection; controlled storage/concurrency fixtures', 'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'passed': sum(c['result'] == 'passed' for c in checks), 'failed': sum(c['result'] == 'failed' for c in checks), 'fatal': fatal, 'checks': checks, 'errors': errors, 'requests': requests}
        (OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps({k: v for k, v in report.items() if k != 'checks'}))
if fatal or errors or report['failed']:
    raise SystemExit(1)
