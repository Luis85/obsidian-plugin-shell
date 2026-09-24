"""Data-only source catalog, shape declarations and actual sitemap projection regression."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/data-sources'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{
getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""


def ok(name, condition, scope='Actual browser controls and canonical state readback'):
    checks.append({'name': name, 'result': 'passed' if condition else 'failed', 'scope': scope})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)
    assert condition, name


def act(action, value=None, scope=''):
    sel = f'{scope} [data-action="{action}"]'.strip()
    if value is not None:
        sel += f'[data-value="{value}"]'
    page.locator(sel).first.click()


def js(code):
    return page.evaluate(code)


def close_clean():
    js('modalOriginal=null;closeModal()')


def ready_map():
    page.wait_for_function('flowUi.api && flowUi.api.getNodes.value.every(n=>n.dimensions.width>0)')
    page.wait_for_timeout(120)


def invalid(name, mutation):
    ok(name, js('(()=>{const d=designCopy(design()),m=d.dataSources;' + mutation + ';return dataSourceIssues(d,false).some(i=>i.level==="error")})()'), 'Malformed data-only model fixture; no canonical mutation')


ENDPOINTS = """()=>[...document.querySelectorAll('#vf-root .ds-data-edge')].flatMap(g=>{
 const edge=flowUi.api.findEdge(g.dataset.id),path=g.querySelector('.vue-flow__edge-path');
 return ['source','target'].map((k,i)=>{const h=document.querySelector('#vf-root [data-id="'+edge[k]+'"] [data-handleid="'+edge[k+'Handle']+'"]'),r=h.getBoundingClientRect();
 const side=['left','right','top','bottom'].find(s=>h.classList.contains('vue-flow__handle-'+s));
 const p=path.getPointAtLength(i?path.getTotalLength():0).matrixTransform(path.getScreenCTM());
 const x=side==='left'?r.left:side==='right'?r.right:r.left+r.width/2,y=side==='top'?r.top:side==='bottom'?r.bottom:r.top+r.height/2;
 return Math.hypot(p.x-x,p.y-y)<2;});})"""
HIT = """()=>{let hit=0,miss=0;const r=document.getElementById('vf-root').getBoundingClientRect();
 for(const g of document.querySelectorAll('#vf-root .ds-data-edge')){const p=g.querySelector('.vue-flow__edge-path');for(const t of [.18,.34,.51,.68,.84]){
 const q=p.getPointAtLength(p.getTotalLength()*t).matrixTransform(p.getScreenCTM());if(q.x<r.left+5||q.x>r.right-5||q.y<r.top+5||q.y>r.bottom-5)continue;
 const e=document.elementFromPoint(q.x,q.y);if(e?.closest('.vue-flow__node,.ref-panel,.flow-edge-label,.ref-canvas-top,.ref-tool-dock,.ref-viewport-bar'))continue;
 hit++;if(!e?.closest('.vue-flow__edge'))miss++;}}return {hit,miss}}"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1680, 'height': 1120}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('sample', scope='main');act('nav', 'sources', '#sidebar')
        ok('A fresh project has an empty managed catalog and explicit examples', js('dataSources().sources.length===0') and page.locator('[data-action="ds-example"]').count()==1)
        act('ds-add','api');page.locator('#ds-name').fill('Tasks service')
        page.locator('#ds-locator').fill('https://user:secret@api.example.test?token=x');act('ds-save')
        ok('Credential-bearing URL is refused before creating the source', js('dataSources().sources.length===0') and page.locator('#ds-error').inner_text()!='')
        ok('Validation moves focus to the associated visible error', js('document.activeElement.id==="ds-error"'))
        page.locator('#ds-locator').fill('https://api.example.test');page.locator('#ds-auth').select_option('api-key')
        page.locator('#ds-credentialRef').fill('TASKS_API_KEY');act('ds-save')
        source = js('dataSources().sources[0].id')
        ok('Source stores a symbolic credential reference, not credential values', js('dataSources().sources[0].credentialRef==="TASKS_API_KEY"&&dataSourcesShape(dataSources())'))
        act('ds-operation', source);page.locator('#ds-name').fill('Fetch tasks')
        page.locator('#ds-resource').fill('/tasks');page.locator('#ds-shape-output-mode').select_option('fields')
        act('ds-field-add','output');page.locator('#ds-output-name-0').fill('title');page.locator('[data-field="ds-shape-output-required"]').check()
        page.locator('#ds-shape-output-mode').select_option('schema');page.locator('#ds-output-schema').fill('{"type":"object","$ref":"https://bad.example.test"}')
        act('ds-save');ok('Remote schema reference is refused without a network request', js('dataSources().sources[0].operations.length===0') and not requests)
        page.locator('#ds-shape-output-mode').select_option('fields')
        ok('Switching shape modes retains the explicitly authored field draft', page.locator('#ds-output-name-0').input_value()=='title')
        act('ds-save');op = js('dataSources().sources[0].operations[0].id')
        ok('Operation has independent request and response shape declarations', js('dataSources().sources[0].operations[0].input.mode==="none"&&dsResolveShape(dataSources().sources[0].operations[0].output).required[0]==="title"'))
        before_nav = js('JSON.stringify({nodes:design().nodes,links:design().links})')
        act('ds-connect', source);page.locator('#ds-label').fill('Load tasks on opening');page.locator('#ds-trigger').select_option('on-open');act('ds-save')
        ok('Connecting an operation does not create navigation nodes or links', before_nav==js('JSON.stringify({nodes:design().nodes,links:design().links})'))
        flow = js('dataSources().flows[0].id')
        act('ds-remove-source',source);act('ds-save')
        ok('Source deletion retains definitions and connections while in use', js('dataSources().sources.length===1&&dataSources().flows.length===1') and 'first' in page.locator('#ds-error').inner_text())
        close_clean();act('ds-remove-operation', source+':'+op);act('ds-save')
        ok('Operation deletion is blocked until its flows are reassigned or removed', js('dataSources().sources[0].operations.length===1'))
        close_clean();act('ds-edit',source)
        rev = js('design().revision');hist=js('design().history.length');act('ds-save')
        ok('Saving an unchanged source does not revise its design or undo history', js('design().revision')==rev and js('design().history.length')==hist)
        act('ds-edit',source);page.locator('#ds-name').fill('Renamed service');act('ds-save')
        ok('Renaming preserves stable source and operation identities', js('dataSources().sources[0].slug==="tasks-service"&&dataSources().flows[0].source===dataSources().sources[0].id'))
        act('ds-edit',source);page.locator('#ds-description').fill('Unsaved changes');page.keyboard.press('Escape')
        ok('Source forms participate in draft discard protection', page.locator('#discard-keep').is_visible())
        page.locator('#discard-keep').click();ok('Keep editing preserves descriptive text', page.locator('#ds-description').input_value()=='Unsaved changes')
        close_clean();act('ds-edit',source);page.locator('#ds-status').select_option('deprecated');act('ds-save')
        ok('Deprecation retains current usages rather than silently deleting them', js('dataSources().flows.length===1&&dataSources().sources[0].status==="deprecated"'))
        js(f'dsEditFlow({json.dumps(flow)});dsUi.form.card=design().nodes.find(n=>n.id!==dsUi.form.card&&n.kind!=="group").id;dsSave()')
        ok('Deprecated sources cannot acquire a new target usage', 'Deprecated' in page.locator('#ds-error').inner_text())
        close_clean();act('ds-edit',source);page.locator('#ds-status').select_option('active');act('ds-save')
        # Controlled model additions retain the actual catalog and exercise parser limits.
        invalid('Duplicate source IDs are rejected', 'm.sources.push(designCopy(m.sources[0]))')
        invalid('Unsafe ID counters are rejected', 'm.nextId=Number.MAX_SAFE_INTEGER')
        invalid('Unknown imported source properties are rejected', 'm.sources[0].password="not-a-real-secret"')
        invalid('Dangling operation references are rejected', 'm.flows[0].operation="ds-operation-777"')
        invalid('Missing target cards are rejected', 'm.flows[0].card="missing-card"')
        invalid('Source and sitemap IDs cannot collide', 'd.nodes[0].id=m.sources[0].id')
        ok('Stored models reject missing data-flow targets before rendering',js('(()=>{const d=designCopy(design());d.dataSources.flows[0].card="missing";return !validSavedDesign(d)})()'),'Saved state validation fixture')
        invalid('Orphan placement entries are rejected', 'm.positions.unknown={x:0,y:0}')
        invalid('GET cannot declare a write operation', 'm.sources[0].operations[0].direction="write"')
        invalid('Incompatible flow direction is rejected', 'm.flows[0].direction="both"')
        invalid('Duplicate field names are rejected', 'm.sources[0].operations[0].output.fields.push(designCopy(m.sources[0].operations[0].output.fields[0]))')
        invalid('Entity shapes must reference an existing declared entity', 'm.sources[0].operations[0].output={...dsNewShape("entity"),entity:"er-entity-999"}')
        ok('Missing custom schema is safely rejected without throwing', js('!dsShapeValid({...dsNewShape("schema"),schema:undefined})'), 'Pure validation fixture')
        for label, schema in [('unknown keyword', {'type':'string','eval':'x'}),('contradictory enum',{'type':'integer','enum':['one']}),('duplicate enum',{'type':'string','enum':['a','a']}),('dangling required',{'type':'object','required':['missing']}),('unbounded array',{'type':'array'})]:
            ok('Schema rejects '+label, not page.evaluate('(s)=>dsSchemaValid(s)',schema),'Pure schema definition fixture')
        ok('Schema supports nested arrays and primitive union item types', js('dsSchemaValid({type:"object",properties:{rows:{type:"array",items:{type:["string","number"]}}},required:["rows"],additionalProperties:false})'))
        ok('Shape definitions reject excessive nesting', js('(()=>{let s={type:"string"};for(let i=0;i<9;i++)s={type:"array",items:s};return !dsSchemaValid(s)})()'))
        ok('Vault paths reject protected folders and traversal', js('![".obsidian/plugins","../Notes","Records/../Secrets"].some(resource=>dsResourceValid({kind:"vault"},resource))'))
        ok('Database locations are references, never connection strings', js('!dsLocatorValid({...dsFreshSource("database"),locator:"postgres://user:password@host/db"})'))
        generation=js('JSON.stringify(dataSourceFiles(design()))')
        ok('Source port previews are inert and include the output fields', 'Promise<' in generation and 'title' in generation and 'No network' in generation)
        ok('Data-flow preview carries the user-selected trigger and direction', 'on-open' in generation and 'read' in generation)
        blocked=js('JSON.stringify(designSnapshot(design()))')
        js('dispatch("design-remove",dataSources().flows[0].card);dispatch("design-remove-confirm",dataSources().flows[0].card)')
        ok('Removing a bound sitemap surface preserves all its data flows',blocked==js('JSON.stringify(designSnapshot(design()))'))
        close_clean();js('dispatch("blueprint-choose","blank");dispatch("blueprint-apply","blank")')
        ok('Blueprint replacement cannot orphan connected source usages',blocked==js('JSON.stringify(designSnapshot(design()))'))
        close_clean()
        # ER live references update the same generator contract and protect referenced entities.
        act('nav','entities','#sidebar');act('er-example')
        entity=js('semanticModel().entities[0].id')
        js(f'dsCommit(m=>m.sources[0].operations[0].output={{...dsNewShape("entity"),entity:{json.dumps(entity)}}})')
        before=js('dsToken()')
        js('semanticModel().entities[0].properties.push({key:"source_note",type:"text",required:false,default:null});')
        ok('ER entity edits change resolved source shapes without copied schemas', js('dsToken()')!=before)
        js('semanticModel().entities[0].properties.pop()')
        ok('Declared entity references appear in semantic ownership checks', js(f'dsReferences(design()).some(r=>r.entity==={json.dumps(entity)})'))
        js(f'erOpen("remove-entity",semanticModel().entities.find(e=>e.id==={json.dumps(entity)}));erSave()')
        ok('Entity deletion is blocked by an operation shape reference', 'data-source' in page.locator('#er-form-error').inner_text())
        close_clean()
        # Roundtrip includes sources and visual placements but imports no execution authority.
        saved=js('JSON.stringify(portableDesign())');before=js('JSON.stringify(dsGeneration(design()))')
        page.evaluate('text=>importDesign(text)',saved)
        ok('Portable blueprint roundtrip preserves source contracts and connections', before==js('JSON.stringify(dsGeneration(design()))'))
        js('dsCommit(m=>m.sources[0].operations[0].output=dsNewShape())')
        ok('An undeclared used payload blocks generation review, not draft storage', js('dataSourceIssues(design()).some(x=>x.level==="error"&&x.code==="data-source-shape")&&validSavedDesign(design())'))
        draft=js('JSON.stringify(portableDesign())');page.evaluate('text=>importDesign(text)',draft)
        ok('An incomplete payload draft survives blueprint export and import', js('dataSources().sources[0].operations[0].output.mode==="unspecified"'))
        js('dsCommit(m=>m.sources[0].operations[0].output={...dsNewShape("fields"),fields:[{name:"title",type:"string",required:true}]})')
        act('nav','sources','#sidebar');act('ds-edit',source)
        snapshot=js('JSON.stringify(dataSources())');js('design().revision++;dsUi.form.name="Must not commit";dsSave()')
        ok('Stale edit review refuses the write and retains canonical source data', snapshot==js('JSON.stringify(dataSources())') and page.locator('#ds-error').inner_text()!='')
        close_clean();act('ds-edit',source);token=js('JSON.stringify(dsGeneration(design()))')
        js('dataSources().sources[0].description="Concurrent contract edit";dsSave()')
        ok('Contract snapshot rejects same-revision intervening edits',page.locator('#ds-error').inner_text()!='' and js('dataSources().sources[0].description==="Concurrent contract edit"'))
        close_clean();js('state.activeRun="controlled-active-run";dsEditSource(dataSources().sources[0].id)')
        ok('Active simulations prevent authoring source changes', not page.locator('#modal').is_visible())
        js('state.activeRun=null')
        # Explicit delete, Undo and monotonic counters.
        act('ds-flow',flow);act('ds-remove-flow',flow);act('ds-save');ok('Explicit flow removal leaves its source and target intact',js('dataSources().flows.length===0&&dataSources().sources.length===1'))
        js('designHistory("undo")');ok('Undo restores the removed data flow',js('dataSources().flows.length===1'))
        js('designHistory("redo")');ok('Redo repeats only the requested flow removal',js('dataSources().flows.length===0'))
        # New project runtime with explicit example, used for actual connector interaction.
        page.goto("about:blank");page.set_content(STORAGE+HTML.read_text());act('sample',scope='main');act('nav','sources','#sidebar');act('ds-example')
        ok('Illustrative example declares API, vault and database independently',js('new Set(dataSources().sources.map(s=>s.kind)).size===3&&dataSources().flows.length===4'))
        page.locator('[data-field="ds-query"]').fill('Reporting')
        ok('Catalog search narrows the maintained sources',page.locator('.ds-catalog-row').count()==1)
        page.locator('[data-field="ds-query"]').fill('');page.locator('[data-field="ds-filter"]').select_option('vault')
        ok('Source type filter selects the active-vault declaration',page.locator('.ds-catalog-row').count()==1 and 'Obsidian vault' in page.locator('.ds-catalog-row').inner_text())
        page.locator('[data-field="ds-filter"]').select_option('all');page.screenshot(path=str(OUT/'catalog-dark.png'),full_page=True)
        source=js('dataSources().sources[0].id');act('ds-place',source);ready_map();js('fitMap()');page.wait_for_timeout(150)  # Show focuses one source; geometry qualification explicitly frames the full graph.
        ok('Source cards are projected without contaminating the view hierarchy',js('flowUi.api.getNodes.value.filter(n=>n.type==="dataSource").length===3&&!design().nodes.some(n=>n.id.startsWith("ds-"))'))
        ok('Read, write and both directions render correct endpoints and arrow markers',js('flowUi.api.getEdges.value.filter(e=>e.data?.dataSource).every(e=>{const f=dataSources().flows.find(f=>f.id===e.id);return e.source===(f.direction==="write"?f.card:f.source)&&e.target===(f.direction==="write"?f.source:f.card)&&!!e.markerEnd&&!!e.markerStart===(f.direction==="both")})'))
        ok('Data-flow paths meet their measured handles',all(js(ENDPOINTS)),'SVG endpoint-to-handle geometry')
        page.mouse.move(3,3);ok('Connected data handles remain visible at rest',js('flowUi.api.getEdges.value.filter(e=>e.data?.dataSource).every(e=>["source","target"].every(k=>getComputedStyle(document.querySelector("#vf-root [data-id=\\\""+e[k]+"\\\"] [data-handleid=\\\""+e[k+"Handle"]+"\\\"]")).opacity==="1"))'))
        ok('Actual inner edge SVG stays visible while viewport clips',js('[...document.querySelectorAll("#vf-root svg.vue-flow__edges")].every(e=>getComputedStyle(e).overflow==="visible")&&getComputedStyle(document.querySelector(".ref-canvas.map-viewport")).overflow==="hidden"'))
        hit=js(HIT);ok('Data paths are browser-hit-testable beyond their node rectangles',hit['hit']>5 and hit['miss']==0,'Rendered point hit tests, skipping UI overlays')
        contracts=js('JSON.stringify(dsGeneration(design()))');act('ds-position',source);page.locator('#ds-x').fill('24000');page.locator('#ds-y').fill('-18000');act('ds-save');ready_map();js('fitMap()');page.wait_for_timeout(150)
        ok('Numeric positioning persists without changing source contracts',contracts==js('JSON.stringify(dsGeneration(design()))') and js('dataSources().positions[dataSources().sources[0].id].x===24000'))
        ok('Far-coordinate connection endpoints retain measured attachment',all(js(ENDPOINTS)),'Translated geometry')
        act('ds-position',source);page.locator('#ds-x').fill('1900');page.locator('#ds-y').fill('100');act('ds-save');ready_map();js('fitMap()');page.wait_for_timeout(150)
        js('window.dsOldPositions=JSON.stringify({sources:dataSources().positions,cards:canvasState().positions});for(const p of [...Object.values(dataSources().positions),...Object.values(canvasState().positions)]){p.x+=24000;p.y-=18000;}referenceUi.panel=null;render();fitMap()');ready_map()
        positive=js(HIT);ok('Translated world still exposes rendered source paths',positive['hit']>5 and positive['miss']==0,'Translated point hit testing')
        style=page.add_style_tag(content='#vf-root svg.vue-flow__edges{overflow:hidden!important}');broken=js(HIT);style.evaluate('(e)=>e.remove()')
        ok('Restoring old clipping CSS breaks the rendered visibility probe',broken['miss']>0,'Fail-before/pass-after clipping negative control')
        js('const old=JSON.parse(window.dsOldPositions);dataSources().positions=old.sources;canvasState().positions=old.cards;render();fitMap()');ready_map()
        contracts=js('JSON.stringify(dataSources())');act('ds-layer');ready_map()
        ok('Data-layer visibility hides projection without deleting model data',page.locator('[data-source-node]').count()==0 and contracts==js('JSON.stringify(dataSources())'))
        act('ds-layer');ready_map();js('referenceUi.panel=null;render();fitMap()');ready_map()
        # Actual outgoing port drag from API to a previously unbound Settings surface.
        card=js('design().nodes.find(n=>n.kind==="settings").id')
        a=page.locator(f'[data-id="{source}"] [data-handleid="ds-out-left"]').bounding_box();b=page.locator(f'[data-id="{card}"] [data-handleid="ds-in-right"]').bounding_box()
        page.mouse.move(a['x']+a['width']/2,a['y']+a['height']/2);page.mouse.down();page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2,steps=14);page.mouse.up()
        page.wait_for_function('modalType==="data-source-form"')
        ok('Dragging a data handle opens review without immediately mutating flows',js('dsUi.form.formKind==="flow"&&dataSources().flows.length===4'))
        act('ds-save');ready_map();ok('Reviewed drag commits one source-to-surface flow',js('dataSources().flows.length===5'))
        ok('Source-to-source links are explicitly rejected',js('!!dsConnectionError({source:dataSources().sources[0].id,target:dataSources().sources[1].id,sourceHandle:"ds-out-right",targetHandle:"ds-in-left"})'))
        # Moving a source uses its own canonical placement transaction.
        js(f'dsPick({json.dumps(source)});canvasUi.tool="select";render()');ready_map()
        contracts=js('JSON.stringify(dataSourceFiles(design()))');before=js(f'JSON.stringify(dataSources().positions[{json.dumps(source)}])')
        page.locator(f'[data-source-node="{source}"]').focus();page.keyboard.press('ArrowDown');ready_map()
        ok('Keyboard movement updates source placement without changing preview output',before!=js(f'JSON.stringify(dataSources().positions[{json.dumps(source)}])') and contracts==js('JSON.stringify(dataSourceFiles(design()))'))
        js('designHistory("undo")');ready_map();ok('Undo restores source placement',before==js(f'JSON.stringify(dataSources().positions[{json.dumps(source)}])'))
        js('referenceUi.panel=null;render();fitMap()');ready_map();page.wait_for_timeout(800)
        page.screenshot(path=str(OUT/'sitemap-data-flows.png'),full_page=True)
        act('nav','sources','#sidebar');js('state.settings.theme="light";render()');page.screenshot(path=str(OUT/'catalog-light.png'),full_page=True)
        ok('Light theme retains explicit readable source tokens',js('getComputedStyle(document.querySelector(".ds-workspace")).getPropertyValue("--ds-accent").trim()!==""'))
        page.set_viewport_size({'width':720,'height':1000});act('ds-operation',source)
        ok('Narrow operation editor fits the viewport and keeps fields available',js('document.getElementById("modal").getBoundingClientRect().right<=innerWidth&&document.getElementById("modal").scrollWidth<=document.getElementById("modal").clientWidth'))
        page.screenshot(path=str(OUT/'operation-narrow.png'),full_page=True);close_clean()
        saved=js('save();JSON.stringify(__saved)')
        restored=browser.new_page();restored.on('pageerror',lambda e:errors.append(str(e)))
        restored.set_content(STORAGE.replace('window.__saved={}','window.__saved='+saved)+HTML.read_text())
        ok('Fresh runtime restores sources, operations and all directional connections',restored.evaluate('!storageWarning&&dataSources().sources.length===3&&dataSources().flows.length===5'),'Serialized storage through actual startup; local Storage controlled')
        restored.close();ok('No page errors or runtime external requests occur',not errors and not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal,flush=True)
    finally:
        browser.close()
report={'schema':'companion-data-sources/v1','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'requests':requests,'fatal':fatal}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
