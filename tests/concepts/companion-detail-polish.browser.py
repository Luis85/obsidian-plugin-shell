"""Research-led polish: actual control journeys with canonical readback and scoped fixtures."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/detail-polish'
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks, errors, requests, fatal = [], [], [], None

def check(name, value, scope='Actual controls with canonical readback; isolated storage adapter'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name

def js(code, arg=None): return page.evaluate(code, arg)
def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def field(key): return page.locator('[data-field="dt-' + key + '"]').first
def save():
    act('dt-save', scope='#modal'); page.locator('#modal').wait_for(state='hidden')
def shot(name): page.screenshot(path=str(OUT/name))

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True)
    page.set_default_timeout(7000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.on('request',lambda r:requests.append(r.url))
    try:
        page.set_content(STORAGE+HTML.read_text())
        act('project-example');page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        act('nav','pages','#sidebar');before=js('JSON.stringify(design())')
        field('page-search').fill('import-project')
        check('Search finds a surface by slug without changing project',page.locator('.dt-page-card').count()==1 and before==js('JSON.stringify(design())'))
        check('Page search retains keyboard focus',field('page-search').evaluate('(e)=>e===document.activeElement'))
        field('page-search').fill('not-a-page-449');check('Empty search explains recovery without discarding pages','No matching surfaces' in page.locator('#dt-pages-results').inner_text())
        field('page-search').fill('Import');shot('01-pages-search.png')
        owner=js('design().nodes.find(n=>n.slug==="import-project").id');act('dt-page',owner);act('dt-mode','outline')
        instance=js('dtDocument().nodes.find(n=>n.component).id');input_id=js('dtDocument().nodes.find(n=>n.kind==="input").id')
        before=js('JSON.stringify(design())');field('outline-search').fill('Project review')
        check('Outline search retains matching element and ancestor context',page.locator('.dt-outline-main .dt-tree-row').count()==2)
        check('Search is presentation only, with no duplicate tree in outline',before==js('JSON.stringify(design())') and page.locator('#dt-tree').count()==0)
        act('dt-select',instance);check('Selected element exposes clickable ancestor breadcrumb',page.locator('.dt-ancestor-trail [data-action="dt-select"]').count()>0)
        act('dt-edit',scope='#dt-inspector')
        check('Typed text and boolean controls replace JSON-first editing',field('prop-title').count()==1 and field('prop-busy').count()==1 and not field('props').is_visible())
        field('prop-title').fill('Review for homeowner');act('dt-prop-reset','busy','#modal');act('dt-prop-override','busy','#modal');field('prop-busy').select_option('false')
        before=js('JSON.stringify(design())');shot('02-typed-instance-properties.png');save()
        check('Typed values persist with correct string and boolean types',js('dtDocument().nodes.find(n=>n.id===dtUi.selected).props.title==="Review for homeowner" && dtDocument().nodes.find(n=>n.id===dtUi.selected).props.busy===false'))
        check('Typed save creates a history entry rather than changing the definition',before!=js('JSON.stringify(design())') and js('design().library.find(c=>c.id==="project-json-review").props')=='title:string\nbusy:boolean')
        act('dt-edit',scope='#dt-inspector');act('dt-prop-reset','busy','#modal')
        check('Reset changes only one draft override',js('!Object.hasOwn(JSON.parse(dtUi.form.propsText),"busy") && JSON.parse(dtUi.form.propsText).title==="Review for homeowner"'))
        save();act('dt-undo');check('Undo restores removed override',js('dtDocument().nodes.find(n=>n.id==='+json.dumps(instance)+').props.busy===false'));act('dt-redo')
        act('dt-select',instance);act('dt-edit',scope='#dt-inspector');saved=js('JSON.stringify(design())');field('componentId').select_option('filter-toolbar')
        check('Swapping a definition preserves local overrides in draft',js('JSON.parse(dtUi.form.propsText).title==="Review for homeowner"') and 'retained' in page.locator('#dt-form-error').inner_text())
        act('dt-save',scope='#modal');check('Incompatible retained props block Save without canonical changes',page.locator('#modal').is_visible() and saved==js('JSON.stringify(design())'))
        act('dt-prop-reset','title','#modal');act('dt-prop-override','count','#modal');field('prop-count').fill('')
        act('dt-save',scope='#modal');check('Blank numeric value is rejected rather than converted to zero',page.locator('#modal').is_visible() and saved==js('JSON.stringify(design())'))
        field('prop-count').fill('12.5');save();check('Finite numeric override survives save',js('dtDocument().nodes.find(n=>n.id===dtUi.selected).props.count===12.5'))
        act('dt-undo');act('dt-select',instance)
        # Preview/outline/back context must remain independent of saved data.
        field('outline-search').fill('Project review');act('dt-component','project-json-review');act('dt-mode','review')
        check('Component review lists direct usage and its scope',page.locator('.dt-use-row').count()==js('dtComponentUses(dtDocument().ownerId).length') and 'direct instances' in page.locator('.dt-usage').inner_text())
        component_doc=js('dtDocument().id');use=page.locator('[data-action="dt-use"]').first.get_attribute('data-value');act('dt-use',use)
        check('Used-by link opens the exact originating instance',js('dtUi.selected')==use.split('/')[1] and js('dtDocument().id')==use.split('/')[0])
        act('dt-back');check('Return from usage restores component Review mode',js('dtUi.mode==="review" && dtDocument().id')==component_doc)
        shot('03-component-review.png');act('dt-back')
        check('Nested Back restores original mode, search and selection',js('dtUi.mode==="outline" && dtUi.query==="Project review" && dtUi.selected')==instance)
        field('outline-search').fill('');act('dt-select',input_id);act('dt-edit',scope='#dt-inspector');field('a11y').fill('');save();act('dt-mode','review')
        check('Review exposes actionable accessibility questions without a pass badge','document accessible naming' in page.locator('.dt-review').inner_text() and 'No runtime or accessibility tests' in page.locator('.dt-review').inner_text())
        act('dt-finding','node/'+input_id);check('Finding opens its exact element',js('dtUi.form.id')==input_id)
        field('a11y').fill('Named input; error feedback associated with the visible label.');save()
        check('Resolving a finding removes that exact question','document accessible naming' not in page.locator('.dt-review').inner_text())
        check('State review exposes every declared state',page.locator('.dt-state-table tbody tr').count()==5)
        snapshot=js('JSON.stringify(design())');act('dt-review-state','error')
        check('State review links to its precise inert preview',js('dtUi.mode==="preview" && dtUi.previewState==="error"') and snapshot==js('JSON.stringify(design())'))
        shot('04-page-error-preview.png');act('dt-mode','review')
        with page.expect_download() as event:act('dt-export-brief')
        download=event.value;download.save_as(str(OUT/'example.design-brief.md'));brief=(OUT/'example.design-brief.md').read_text()
        check('Actual Markdown download contains stable source and acceptance intent',js('dtDocument().id') in brief and 'Acceptance intent:' in brief and 'not implementation or executed-test evidence' in brief)
        check('Export does not change saved project',snapshot==js('JSON.stringify(design())'))
        act('dt-mode','canvas');page.wait_for_selector('#dt-flow .vue-flow__node');act('dt-zoom','reset');page.wait_for_timeout(80)
        check('Reset zoom uses the live Vue Flow camera',abs(js('dtUi.viewports[dtDocument().id].zoom')-1)<.01)
        act('dt-zoom','-0.2');page.wait_for_timeout(80);check('Zoom-out is non-drag and changes no canonical data',js('dtUi.viewports[dtDocument().id].zoom')<1 and snapshot==js('JSON.stringify(design())'))
        act('dt-fit');page.wait_for_timeout(100)
        check('Interaction text has readable fill and no inherited SVG stroke',page.locator('#dt-flow .vue-flow__edge-text').first.evaluate('(e)=>getComputedStyle(e).stroke')=='none')
        shot('05-page-canvas-dark.png');js('state.settings.theme="light";render()');page.wait_for_selector('#dt-flow .vue-flow__node');shot('06-page-canvas-light.png')
        check('Light desktop has no horizontal viewport overflow',js('document.documentElement.scrollWidth<=innerWidth'))
        page.set_viewport_size({'width':390,'height':844});act('dt-mode','review');shot('07-mobile-review.png')
        check('Mobile Review fits the viewport and retains actionable links',js('document.documentElement.scrollWidth<=innerWidth') and page.locator('.dt-state-table').is_visible())
        act('dt-mode','outline');field('outline-search').fill('Project review');check('Mobile structure search remains visible and focused',field('outline-search').is_visible() and field('outline-search').evaluate('(e)=>e===document.activeElement'))
        act('dt-select',instance);act('dt-edit',scope='#dt-inspector');shot('08-mobile-properties.png')
        check('Mobile typed property dialog fits viewport',page.locator('#modal').bounding_box()['width']<=390)
        check('No browser errors or external requests',not errors and not requests)
    except Exception as error:
        fatal=str(error);traceback.print_exc();shot('failure.png')
    browser.close()
(OUT/'checks.json').write_text(json.dumps({'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'scope':'Actual polish browser controls with isolated in-memory storage adapter; not native or business acceptance.'},indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
