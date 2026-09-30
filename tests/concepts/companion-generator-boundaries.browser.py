"""Actual page-editor controls and canonical readback for the declarations the generator consumes."""
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
INPUT_KINDS = ['text', 'number', 'date', 'datetime-local', 'email', 'search']
checks, errors, requests, fatal = [], [], [], None

def check(name, value, scope='Actual editor controls; canonical readback with isolated storage'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name

def js(code, arg=None): return page.evaluate(code, arg)
def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def select_node(node_id):
    page.locator(f'#ve-outline [role="treeitem"][data-value="{node_id}"]').locator(':scope > .ve-tree-row .ve-tree-label').click()
def prop(key): return page.locator(f'[data-field="ve-prop"][data-key="{key}"]').first
def commit(locator, value):
    locator.fill(value);locator.press('Tab');page.wait_for_timeout(80)
def store(): return js('JSON.stringify(veStore())')
def node(node_id): return js('(i)=>JSON.parse(JSON.stringify(visualLocate(veCurrentPage().root,i)?.node??null))', node_id)
def history(direction): page.locator(f'.ve-toolbar [data-action="ve-{direction}"]').click()
def insert(entry):
    act('ve-left','insert');act('ve-insert-tab','components');act('ve-insert',entry);return js('veUi.selected')

GOLDEN = ROOT / 'configs/starters/companion-plugin.json'


def open_golden():
    """Review the self-project, the external golden starter's schema 6 document, through the real import dialog."""
    js('openCompanionImport()')
    page.locator('#project-import-text').fill(json.dumps(json.loads(GOLDEN.read_text())['generator']['document']))
    page.locator('#modal [data-action="project-import-review"]').click()


with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(7000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:requests.append(r.url))
    try:
        page.set_content(STORAGE+HTML.read_text())
        open_golden();page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        initial_schema = json.loads(GOLDEN.read_text())['generator']['document']['design']['visualDesigns']['schema']
        check('Loading the existing companion preserves its declared visual designs schema',js('veStore().schema')==initial_schema and js("!('detailDesigns' in design())"))
        act('nav','pages','#sidebar');owner=js('design().nodes.find(n=>n.slug==="import-project").id');act('ve-open-page',owner)
        input_id=js('visualNodes(veCurrentPage().root).find(n=>n.ref?.entryId==="u-input").id');select_node(input_id)
        act('ve-inspector','essentials','.ve-pane-inspector')
        kinds=prop('type').locator('option').evaluate_all('els=>els.map(e=>e.value)')
        check('Every typed input kind is an explicit choice',all(k in kinds for k in INPUT_KINDS))
        before=store();prop('placeholder').fill('Draft placeholder')
        check('Typing a property is draft-only until the field commits',before==store())
        prop('placeholder').press('Tab');page.wait_for_timeout(80)
        undo_depth=js('design().history.length');prop('type').select_option('number');typed=node(input_id)
        check('Choosing a typed input kind commits one validated write',typed['props'].get('type',{}).get('value')=='number' and typed['props'].get('placeholder',{}).get('value')=='Draft placeholder' and js('design().history.length')==undo_depth+1 and js('validSavedDesign(design())'))
        history('undo');history('undo')
        check('Undo restores the exact original visual designs',store()==before)
        history('redo');history('redo')
        select_id=insert('nuxt:u-select');act('ve-inspector','essentials','.ve-pane-inspector')
        before=store();commit(prop('items'),'{bad')
        check('Malformed options keep the saved design and report the field inline',page.locator('#ve-prop-items-error').inner_text()!='' and before==store())
        commit(prop('items'),'[{"label":"Zero","value":"0"},{"label":"Other","value":"other"}]')
        check('Select labels and literal values round-trip',node(select_id)['props']['items']['value'][0]['value']=='0')
        # Interaction authoring, not application execution: a button declares a source call that reads the select.
        save_id=insert('nuxt:u-button')
        act('ve-interaction',scope='.ve-selection-bar');act('ve-interaction-add',scope='.ve-pane-inspector')
        page.locator('#ve-int-label').fill('Save mapped record');act('ve-act-add',scope='#modal')
        page.locator('#ve-act-0-kind').select_option('source');page.locator('#ve-act-0-mapping').select_option('draft');page.locator('#ve-act-0-mappingNode').select_option(select_id)
        act('ve-interaction-save',scope='#modal');page.locator('#modal').wait_for(state='hidden')
        declared=node(save_id)['events'][-1]['actions'][0]
        check('Source action declarations persist without invoking a provider',declared['kind']=='source' and declared['input']=={'kind':'draft','nodeId':select_id} and js('(a)=>design().dataSources.sources.some(s=>s.id===a.sourceId&&s.operations.some(o=>o.id===a.operationId))',declared))
        exported=js('companionProjectDocument()')
        check('Full project export preserves visual designs and declared source actions',exported['design']['visualDesigns']['schema']==initial_schema and 'detailDesigns' not in exported['design'] and '"nodeId":"'+select_id+'"' in json.dumps(exported['design']['visualDesigns'],separators=(',',':')))
        act('ve-duplicate',scope='.ve-selection-bar');copy_id=js('veUi.selected');copy=node(copy_id)
        check('Duplication allocates a fresh identity and keeps the shared form-control reference',copy_id!=save_id and copy_id.startswith('vn-') and copy['events'][-1]['actions'][0]['input'].get('nodeId')==select_id)
        select_node(select_id);before=store();act('ve-delete','','.ve-inspector-body');page.locator('#modal[open]').wait_for()
        refusal=page.locator('#modal').inner_text();blocked=page.locator('#modal [data-action="ve-delete-confirm"]').is_disabled()
        page.keyboard.press('Escape');page.locator('#modal').wait_for(state='hidden')
        check('Removing a form control that a surviving mapping reads is refused','Cannot delete: Still referenced by Save mapped record' in refusal and blocked and before==store() and node(select_id) is not None)
        act('ve-mode','preview')
        check('The mapped select renders once in the preview',page.locator(f'.ve-frame [data-ve-node="{select_id}"]').count()==1)
        page.screenshot(path=str(OUT/'mapped-controls-preview.png'))
        check('No browser errors or external requests',not errors and not requests)
    except Exception as e:
        fatal=str(e);traceback.print_exc();page.screenshot(path=str(OUT/'failure.png'))
    browser.close()
report={'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'scope':'Authoring controls and canonical readback only, not native or generated application acceptance.'}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
