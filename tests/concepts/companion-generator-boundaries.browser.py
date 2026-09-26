"""Actual authoring controls and labeled model fixtures for generated interaction declarations."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/generator-boundaries'
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks, errors, requests, fatal = [], [], [], None

def check(name, value, scope='Actual form controls; canonical readback with isolated storage'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name

def js(code, arg=None): return page.evaluate(code, arg)
def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def field(key): return page.locator('[data-field="dt-' + key + '"]').first
def save():
    act('dt-save',scope='#modal');page.locator('#modal').wait_for(state='hidden')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(7000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:requests.append(r.url))
    try:
        page.set_content(STORAGE+HTML.read_text())
        act('project-example');page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        initial_schema = json.loads((ROOT / 'docs/concepts/companion/companion-project.json').read_text())['design']['detailDesigns']['schema']
        check('Loading the existing companion preserves its declared detail schema',js('dtStore().schema')==initial_schema)
        act('nav','pages','#sidebar');owner=js('design().nodes.find(n=>n.slug==="import-project").id');act('dt-page',owner);act('dt-mode','outline')
        input_id=js('dtDocument().nodes.find(n=>n.kind==="input").id');act('dt-edit',input_id)
        check('All ten explicit control kinds are available',field('controlKind').locator('option').count()==10)
        before=js('JSON.stringify(dtStore())');field('controlKind').select_option('number');field('controlRequired').check()
        check('Changing control semantics is draft-only until Save',before==js('JSON.stringify(dtStore())'))
        save();check('Saving a typed required control retains a supported detail schema',js('(schema)=>dtStore().schema===Math.max(2,schema) && dtDocument().nodes.find(n=>n.id===dtUi.selected).control.kind==="number" && dtDocument().nodes.find(n=>n.id===dtUi.selected).control.required===true',initial_schema))
        act('dt-undo');check('Undo restores the exact original detail document and schema',js('JSON.stringify(dtStore())')==before);act('dt-redo')
        act('dt-edit',input_id);field('controlKind').select_option('select');field('controlOptions').fill('{bad')
        before=js('JSON.stringify(dtStore())');act('dt-save',scope='#modal')
        check('Malformed options retain the form and saved data',page.locator('#modal').is_visible() and page.locator('#dt-form-error').inner_text()!='' and before==js('JSON.stringify(dtStore())'))
        field('controlOptions').fill('[{"label":"Zero","value":"0"},{"label":"Other","value":"other"}]');save()
        check('Select labels and literal values round-trip',js('dtDocument().nodes.find(n=>n.id===dtUi.selected).control.options[0].value')=='0')
        # Form authoring, not application execution: convert one existing interaction.
        edge_id=js('dtDocument().edges[0].id');js('(id)=>dtBegin("edge",id)',edge_id)
        field('actionKind').select_option('source');field('actionMapping').fill('{"kind":"none"}');save()
        check('Source action declarations persist without invoking a provider',js('dtDocument().edges[0].action.kind==="source" && dtDocument().edges[0].action.input.kind==="none"'))
        exported=js('companionProjectDocument()')
        check('Full project export preserves schema-2 controls and actions',exported['design']['detailDesigns']['schema']==2 and any(e.get('action') for d in exported['design']['detailDesigns']['documents'] for e in d['edges']))
        # A labeled model fixture provides an extra root. Slot assignment itself uses actual form controls.
        root_id=js('''() => {let id;dtCommit(store=>{const doc=store.documents.find(d=>d.id===dtDocument().id);const root=dtNewNode(store,'text');root.label='Assigned root';root.text='Unique slot payload';doc.nodes.push(root);id=root.id;});render();return id;}''')
        instance=js('dtDocument().nodes.find(n=>n.component?.id==="project-json-review").id');act('dt-edit',instance)
        field('slot-content').select_option([root_id]);save()
        check('Instance slot control retains exact root identity',js('(id)=>dtDocument().nodes.find(n=>n.component?.id==="project-json-review").slots.content[0]===id',root_id))
        act('dt-mode','preview');check('Assigned root renders once inside the reusable preview',page.locator('.dt-preview-shell').inner_text().count('Unique slot payload')==1)
        duplicate=js('''(id)=>{const store=dtCopy(dtStore()),doc=store.documents.find(d=>d.id===dtDocument().id);const copy=dtDuplicateNode(store,doc,id);validateDetailDesigns(store);const n=doc.nodes.find(n=>n.id===copy);return {copy:n.id,slot:n.slots.content[0],count:doc.nodes.filter(n=>n.text==='Unique slot payload').length};}''',instance)
        check('Duplication owns a remapped slot subtree, not a shared reference',duplicate['slot']!=root_id and duplicate['count']==2,'Isolated model fixture; no saved mutation')
        guarded=js('''(id)=>{const doc=dtCopy(dtDocument()),input=doc.nodes.find(n=>n.kind==='input');doc.edges[0].action.input={kind:'draft',nodeId:input.id};doc.edges[0].source=doc.nodes.find(n=>n.id!==input.id).id;doc.edges[0].target=id;try{dtRemoveNode(doc,input.id);return false;}catch{return doc.nodes.some(n=>n.id===input.id);}}''',root_id)
        check('Removing an input referenced by a surviving mapping is blocked',guarded,'Isolated model fixture; no saved mutation')
        page.screenshot(path=str(OUT/'typed-slot-preview.png'))
        check('No browser errors or external requests',not errors and not requests)
    except Exception as e:
        fatal=str(e);traceback.print_exc();page.screenshot(path=str(OUT/'failure.png'))
    browser.close()
report={'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'scope':'Authoring controls and labeled fixtures only, not native or generated application acceptance.'}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
