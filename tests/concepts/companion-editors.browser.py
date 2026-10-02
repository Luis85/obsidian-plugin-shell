"""Three-editor review: real user paths plus explicitly labeled transaction fixtures."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/editors'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = '''<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{
getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>'''


def ok(name, condition, scope='Browser controls and canonical state readback'):
    checks.append({'name': name, 'result': 'passed' if condition else 'failed', 'scope': scope})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)
    assert condition, name


def act(action, value=None, scope=''):
    selector = f'{scope} [data-action="{action}"]'.strip()
    if value is not None:
        selector += f'[data-value="{value}"]'
    page.locator(selector).first.click()


def edit_relationship(edge):
    act('er-mode', 'relationships')
    act('er-edit-edge', edge, '.er-relationship-list')


def js(code):
    return page.evaluate(code)


def clean():
    js('modalOriginal=null;closeModal()')


def ready():
    page.wait_for_function('flowUi.api && flowUi.api.getNodes.value.every(n=>n.dimensions.width>0)')
    page.wait_for_timeout(100)


def fresh():
    page.goto('about:blank')
    page.set_content(STORAGE + HTML.read_text())
    act('sample', scope='main');act('nav', 'sources', '#sidebar');act('ds-example')
    return js('({api:dataSources().sources[0].id,vault:dataSources().sources[1].id,view:design().nodes.find(n=>n.kind==="view").id,page:design().nodes.find(n=>n.kind==="page").id,settings:design().nodes.find(n=>n.kind==="settings").id})')


def map_fixture(ids):
    # Explicit geometry fixture: all pointer targets are onscreen and unoccluded.
    js('referenceUi.panel="none";dsUi.show=true;canvasUi.edge=null;designUi.selected=null;dsUi.selected=null;setView("sitemap")')
    js('for(const [id,p] of Object.entries(canvasState().positions)){p.x=2800;p.y=180;}for(const p of Object.values(dataSources().positions)){p.x=3400;p.y=400;}canvasState().positions['+json.dumps(ids['view'])+']={x:520,y:180};dataSources().positions['+json.dumps(ids['api'])+']={x:60,y:180};canvasState().zoom=.75;canvasState().pan={x:40,y:50};canvasState().fitted=true;render()')
    ready()


def drag(start, end, body=False, cancel=False):
    a=page.locator(start).bounding_box();b=page.locator(end).bounding_box()
    page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2)
    page.mouse.down();page.mouse.move(b['x']+b['width']/2,b['y']+(35 if body else b['height']/2),steps=16)
    if cancel:
        page.keyboard.press('Escape')
    page.mouse.up();page.wait_for_timeout(140)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1680,'height':1120}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e:errors.append(str(e)))
    page.on('console', lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request', lambda r:requests.append(r.url))
    try:
        ids=fresh()
        act('ds-add','api');page.locator('#ds-name').fill('No operations yet');act('ds-save')
        empty=js('dsUi.catalogSelected');before=js('JSON.stringify(dsGeneration(design()))')
        ok('Source creation keeps a separate catalog cursor',empty!=ids['api'] and js('dsUi.selected===null'))
        act('ds-place',empty);ready()
        ok('An unconfigured selected source shows only source inspector tabs',page.locator('.inspector-tabs').inner_text().splitlines()==['Source','Operations','Data flows'])
        ok('Connect is visibly disabled until this source has an operation',page.locator('.inspector-body [data-action="ds-connect"]').is_disabled())
        # Direct handler probe additionally catches the old silent fallback even
        # when callers do not originate at a disabled button.
        js('dsEditFlow(null,'+json.dumps(empty)+')')
        ok('Unconfigured source never substitutes another source',not page.locator('#modal').is_visible() and 'No other source was substituted' in js('dsUi.error'),'Targeted command fixture')
        ok('Rejected connection leaves all contracts untouched',before==js('JSON.stringify(dsGeneration(design()))'),'Canonical invariant')
        act('canvas-inspector','source-operations');ok('Empty operation state explains the required next step','Add an operation before connecting' in page.locator('.inspector-body').inner_text())
        act('ds-operation',empty,scope='.inspector-body');page.locator('#ds-name').fill('Fetch status')
        page.locator('#ds-shape-output-mode').select_option('fields');act('ds-field-add','output');page.locator('[data-field="ds-shape-output-name"]').fill('status');act('ds-save');ready()
        act('canvas-inspector','source-flows');act('ds-connect',empty,scope='.inspector-body')
        ok('Adding the first operation enables connection on the same source',js('dsUi.form.source')==empty)
        page.locator('#ds-card').select_option(ids['view']);page.locator('#ds-label').fill('Fetch status into workspace')
        act('ds-save');ready()
        ok('Saving shows a real connection to the selected native view',js('dataSources().flows.at(-1).card')==ids['view'] and js('flowUi.api.getEdges.value.some(e=>e.id===dataSources().flows.at(-1).id)'))
        ok('Selected data flow has a dedicated inspector with no component details',page.locator('.inspector-tabs').inner_text()=='Data flow' and 'Fetch status into workspace' in page.locator('.inspector-body').inner_text())
        # Selection feedback remains after hover leaves a connection.
        flow_label=page.locator('[data-flow-edge="'+js('dataSources().flows.at(-1).id')+'"]')
        flow_label.hover();page.mouse.move(20,20)
        ok('A selected data flow retains both endpoint highlights after hover ends',page.locator('#vf-root .vue-flow__node.ds-related').count()==2)
        # Catalog filtering must never obscure the identity being edited.
        act('ds-catalog',empty);page.locator('#ds-query').fill('Reporting')
        ok('Filtering keeps selected identity and explicitly labels it as outside filter','No operations yet' in page.locator('#ds-filter-context').inner_text() and page.locator('.ds-catalog-row').count()==1)
        page.locator('#ds-query').fill('')
        ok('Clearing filter removes the context warning',not page.locator('#ds-filter-context').is_visible())
        # Selection paths: map -> catalog -> map, mouse/focus, tab switches and undo.
        act('ds-select',ids['api']);act('ds-place',ids['api']);ready();js('dispatch("ref-inspect",'+json.dumps(ids['page'])+')')
        ready();js('dsPick('+json.dumps(ids['api'])+')')
        ok('Selecting a source clears stale surface and edge selection',js('designUi.selected===null&&canvasUi.edge===null') and js('dsUi.selected')==ids['api'])
        ok('Inspector switches its entire tab set with the selection type',page.locator('.inspector-tabs [data-action="canvas-inspector"]').count()==3 and page.locator('.inspector-body h2').inner_text()=='Tasks API')
        act('canvas-inspector','source-operations');ready()
        ok('Source tabs retain the source across a full rerender',page.locator('.inspector-body h2').inner_text()=='Tasks API' and js('dsUi.selected')==ids['api'])
        js('showMapNode('+json.dumps(ids['view'])+',true)');ready()
        ok('Surface selection clears source cursor and restores surface tabs',js('dsUi.selected===null') and page.locator('.inspector-tabs [data-action="canvas-inspector"]').count()==6 and page.locator('.inspector-body h2').inner_text()!='Tasks API')
        act('nav','sources','#sidebar');act('ds-select',ids['vault']);act('nav','sitemap','#sidebar');ready()
        ok('Catalog browsing never replaces the map selection',js('designUi.selected')==ids['view'] and js('dsUi.selected===null'))
        # Saving while a target is collapsed and data hidden reveals the result.
        js('canvasState().collapsed=['+json.dumps(ids['view'])+'];dsUi.show=false;render();dsEditFlow(null,'+json.dumps(empty)+','+json.dumps(ids['page'])+',"read")')
        page.locator('#ds-label').fill('Explicit write');act('ds-save');ready()
        ok('Save expands the target branch and unhides the data layer',js('dsUi.show&&!canvasState().collapsed.includes('+json.dumps(ids['view'])+')'))
        ok('The newly saved hidden-target connection is projected and selected',js('canvasUi.edge===dataSources().flows.at(-1).id&&flowUi.api.getEdges.value.some(e=>e.id===canvasUi.edge)'))
        act('ds-layer');ready()
        ok('Hiding the layer clears invisible source and data-flow selections',js('dsUi.selected===null&&canvasUi.edge===null'))
        # Genuine pointer input: read, write, cancel, endpoint selection and body drop.
        ids=fresh();act('nav','sitemap','#sidebar');act('design-add','view');page.locator('#d-node-label').fill('Data workspace');act('design-save');ids['view']=js('design().nodes.at(-1).id');map_fixture(ids)
        source=f'[data-id="{ids["api"]}"] [data-handleid="ds-out-right"]'
        target=f'[data-id="{ids["view"]}"] [data-handleid="ds-in-left"]'
        count=js('dataSources().flows.length');drag(source,target)
        ok('Actual source-to-view handle drag proposes read without premature mutation',page.locator('#modal').is_visible() and js('dsUi.form.direction')=='read' and js('dataSources().flows.length')==count)
        ok('Handle review preserves the requested source and native view',js('dsUi.form.source')==ids['api'] and js('dsUi.form.card')==ids['view'])
        act('ds-save');ready();ok('Reviewed handle drag commits exactly one flow',js('dataSources().flows.length')==count+1)
        map_fixture(ids)
        source=f'[data-id="{ids["view"]}"] [data-handleid="ds-out-left"]';target=f'[data-id="{ids["api"]}"] [data-handleid="ds-in-right"]'
        drag(source,target)
        ok('Reverse drag chooses an operation compatible with write',js('dsUi.form.direction==="write"&&dataSources().sources.find(s=>s.id===dsUi.form.source).operations.find(o=>o.id===dsUi.form.operation).direction==="write"'))
        act('ds-save');ready();ok('Reverse drag commits exactly one independent write flow',js('dataSources().flows.length')==count+2)
        map_fixture(ids);before=js('JSON.stringify(dataSources())')
        drag(source,target,cancel=True)
        ok('Escape cancels data dragging without a modal or a mutation',not page.locator('#modal').is_visible() and before==js('JSON.stringify(dataSources())'))
        page.locator(f'[data-source-node="{ids["api"]}"] h3').click()
        ok('A normal click selects a source after connection cancellation',js('dsUi.selected')==ids['api'])
        map_fixture(ids);source=f'[data-id="{ids["api"]}"] [data-handleid="ds-out-right"]';target=f'[data-node="{ids["view"]}"]'
        drag(source,target,body=True)
        ok('Dropping a data handle on a view body opens the same reviewed contract',page.locator('#modal').is_visible() and js('dsUi.form.card')==ids['view'])
        act('ds-save');ok('Repeated connection is rejected instead of duplicating an edge','already connected' in page.locator('#ds-error').inner_text() and js('dataSources().flows.length')==count+2);clean()
        map_fixture(ids)
        port=page.locator(f'[data-source-node="{ids["api"]}"] [data-handleid="ds-in-left"]')
        port.focus();page.keyboard.press('Enter')
        ok('Keyboard activation of an incoming source port requests a write operation',js('dsUi.form.direction')=='write' and js('dsUi.form.source')==ids['api']);clean()
        act('ds-layer');ready()
        ok('Hidden data handles are excluded from keyboard navigation',js('[...document.querySelectorAll(".map-node .ds-port")].every(e=>e.tabIndex===-1&&e.getAttribute("aria-hidden")==="true")'))
        # Containment-only creation through the actual handle menu.
        map_fixture(ids);js('dsUi.show=false;showMapNode('+json.dumps(ids['view'])+',true);fitMap(true)');ready()
        page.locator(f'[data-node="{ids["view"]}"] [data-handleid="out-right"]').click();act('connection-new','page','#connection-menu')
        ok('Container creation explains the single containment line','one Contains relationship' in page.locator('#modal').inner_text() and page.locator('#connection-actionLabel').count()==0)
        page.locator('#connection-label').fill('Activity screen');before=js('design().links.length');act('connection-save');ready()
        child=js('design().nodes.at(-1).id')
        ok('New container screen creates one Contains edge, not a second navigation edge',js('design().links.length')==before and js('flowEdgeProjection(design()).filter(e=>e.target==='+json.dumps(child)+').length')==1)
        ok('One Undo removes only the new child; Redo restores it',js('designHistory("undo");!design().nodes.some(n=>n.id==='+json.dumps(child)+')') and js('designHistory("redo");design().nodes.some(n=>n.id==='+json.dumps(child)+')'))
        js('showMapNode('+json.dumps(child)+',true);fitMap(true)');ready()
        page.locator(f'[data-node="{child}"] [data-handleid="out-right"]').click();act('connection-new','page','#connection-menu')
        ok('Screen-to-screen creation still offers an explicit user-flow action',page.locator('#connection-actionLabel').count()==1)
        page.locator('#connection-label').fill('Next screen');before=js('design().links.length');act('connection-save');ready()
        ok('Intentional screen transition is retained separately from its containment',js('design().links.length')==before+1)
        # No-op and same-revision mutation fixtures complement user event checks.
        js('designHistory("undo")');before=js('JSON.stringify([design().history,design().future,design().revision])');js('canvasCommit(()=>{})')
        ok('No-op arrangement preserves the redo branch and history',before==js('JSON.stringify([design().history,design().future,design().revision])'),'No-op transaction fixture')
        js('startNodeForm("view",'+json.dumps(ids['view'])+');design().nodes.find(n=>n.id==='+json.dumps(ids['view'])+').label="Concurrent rename"')
        page.locator('#d-node-label').fill('Stale rename');act('design-save')
        ok('Surface editor rejects same-revision intervening edits','changed' in page.locator('#design-error').inner_text().lower() and js('design().nodes.find(n=>n.id==='+json.dumps(ids['view'])+').label')=='Concurrent rename','Concurrent model fixture')
        clean();edge=js('design().links[0].id');js('openTypedConnection(design().links[0]);design().links[0].sourceHandle="out-bottom"');act('design-link-save')
        ok('Typed connection editor refuses stale anchor identity','changed' in page.locator('#design-error').inner_text().lower(),'Same-revision connection fixture');clean()
        # Entity relationship modal: preserve the draft through removal review.
        ids=fresh();act('nav','entities','#sidebar');act('er-example');edge=js('semanticModel().relationships[0].id')
        before=js('JSON.stringify(semanticModel().relationships)');entity_count=js('semanticModel().entities.length')
        edit_relationship(edge);page.locator('#er-name').fill('Uncommitted relationship caption');act('er-delete-edge',edge)
        ok('Entity connection has an explicit in-modal removal review',page.locator('#modal [data-action="er-save"]').inner_text()=='Remove declaration' and before==js('JSON.stringify(semanticModel().relationships)'))
        act('editor-keep-editing');ok('Keep editing returns the exact relationship draft',page.locator('#er-name').input_value()=='Uncommitted relationship caption')
        act('er-delete-edge',edge);page.keyboard.press('Escape')
        ok('Escape cancels only removal review, not the pending edit',page.locator('#er-name').input_value()=='Uncommitted relationship caption' and before==js('JSON.stringify(semanticModel().relationships)'))
        act('er-delete-edge',edge);act('er-save')
        ok('Confirmed deletion removes only the relationship and its implicit field',js('semanticModel().relationships.length')==1 and js('semanticModel().entities.length')==entity_count and js('!semanticModel().relationships.some(r=>r.id==='+json.dumps(edge)+')'))
        act('er-undo');ok('Undo restores the saved relation, not the uncommitted caption',before==js('JSON.stringify(semanticModel().relationships)'))
        edit_relationship(edge);js('semanticModel().relationships[0].name="Concurrent relation"');act('er-delete-edge',edge);act('er-save')
        ok('Deletion reuses the original review identity and rejects intervening changes','stale' in page.locator('#er-form-error').inner_text() and js('semanticModel().relationships.length===2'),'Concurrent relationship fixture');clean()
        # Data-source flow modal shares the same draft-preserving removal controller.
        act('nav','sources','#sidebar');flow=js('dataSources().flows[0].id');before=js('JSON.stringify(dataSources().flows)')
        act('ds-flow',flow);page.locator('#ds-label').fill('Uncommitted data caption');act('ds-remove-flow',flow);act('editor-keep-editing')
        ok('Data-flow removal cancellation preserves its edited caption',page.locator('#ds-label').input_value()=='Uncommitted data caption' and before==js('JSON.stringify(dataSources().flows)'))
        act('ds-remove-flow',flow);page.keyboard.press('Escape')
        ok('Escape restores the data-flow editor without discarding fields',page.locator('#ds-label').input_value()=='Uncommitted data caption')
        act('ds-remove-flow',flow);act('ds-save');ok('Confirmed data-flow removal keeps source and surface',js('dataSources().flows.length===3&&dataSources().sources.length===3&&design().nodes.length>0'))
        js('designHistory("undo")');ok('Data-flow undo restores the saved contract',before==js('JSON.stringify(dataSources().flows)'))
        act('ds-select',ids['api']);act('ds-operation',ids['api']);page.locator('#ds-shape-output-mode').select_option('fields');page.locator('#ds-shape-output-mode').select_option('unspecified');act('close',scope='#modal');ok('Untouched shape-mode round trip does not ask to discard',not page.locator('#modal').is_visible() and not page.locator('#discard-dialog').is_visible());act('ds-operation',ids['api']);page.locator('#ds-shape-output-mode').select_option('fields');act('ds-field-add','output');page.locator('[data-field="ds-shape-output-name"]').fill('unsavedHiddenField');page.locator('#ds-shape-output-mode').select_option('unspecified');act('close',scope='#modal')
        ok('Unsaved hidden shape-mode draft participates in Close protection',page.locator('#discard-dialog').is_visible())
        page.locator('#discard-keep').click();page.locator('#ds-shape-output-mode').select_option('fields')
        ok('Keeping hidden shape edits recovers exact field input',page.locator('[data-field="ds-shape-output-name"]').input_value()=='unsavedHiddenField');clean()
        # Expired IDs never become new records, and active simulations reject commands.
        before=js('JSON.stringify(designSnapshot(design()))')
        for command in ['dsEditSource("removed-source")','dsEditOperation('+json.dumps(ids['api']+':removed-operation')+')','dsEditFlow("removed-flow")','erBeginEntity("removed-entity")','erBeginRelationship(null,null,"removed-relation")','handleSemanticAction("er-section","removed-section")','handleSemanticAction("er-delete","removed-entity")']:
            js(command);ok('Expired command fails closed: '+command,not page.locator('#modal').is_visible() and before==js('JSON.stringify(designSnapshot(design()))'),'Expired identity command fixture')
        js('state.activeRun={id:"controlled-busy"};dsReviewConnection({source:'+json.dumps(ids['api'])+',target:'+json.dumps(ids['view'])+',sourceHandle:"ds-out-right",targetHandle:"ds-in-left"})')
        ok('Active-run connection refusal cannot mutate a previous modal draft',not page.locator('#modal').is_visible() and before==js('JSON.stringify(designSnapshot(design()))'),'Busy-state fixture');js('state.activeRun=null')
        # Batch responsive/theme inspection uses a clean illustrative workspace.
        ids=fresh();flow=js('dataSources().flows[0].id')
        act('ds-select',ids['api']);act('ds-place',ids['api']);ready();act('canvas-inspector','source-operations');ready()
        page.screenshot(path=str(OUT/'sitemap-source-inspector-dark.png'),full_page=True)
        tabs=page.locator('.inspector-tabs button');tabs.first.focus();page.keyboard.press('Tab')
        ok('Contextual inspector keyboard focus is visible',js('document.activeElement.matches(".inspector-tabs button:focus-visible")&&getComputedStyle(document.activeElement).outlineStyle!=="none"'))
        act('nav','entities','#sidebar');act('er-example');edge=js('semanticModel().relationships[0].id');edit_relationship(edge);act('er-delete-edge',edge)
        page.screenshot(path=str(OUT/'entity-removal-dark.png'),full_page=True);act('editor-keep-editing');clean()
        js('state.settings.theme="light";render()');act('nav','sources','#sidebar')
        page.set_viewport_size({'width':760,'height':1000});page.screenshot(path=str(OUT/'sources-light-narrow.png'),full_page=True)
        ok('Narrow source catalog stays within its content area',js('document.querySelector(".ds-workspace").scrollWidth<=document.querySelector(".ds-workspace").clientWidth'))
        act('ds-flow',flow);act('ds-remove-flow',flow)
        ok('Narrow removal dialog retains visible controls without horizontal overflow',js('document.getElementById("modal").scrollWidth<=document.getElementById("modal").clientWidth'))
        page.screenshot(path=str(OUT/'data-flow-removal-light-narrow.png'),full_page=True);act('editor-keep-editing');clean()
        ok('No page errors, console errors or external runtime requests',not errors and not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal,flush=True)
        try:page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        except Exception:pass
    finally:
        browser.close()
report={'schema':'companion-editors/v1','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'requests':requests,'fatal':fatal}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
