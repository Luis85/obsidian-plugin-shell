"""Saved design-system authoring/export contracts; includes real downloads and inert HTML."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/style-guide'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = '''<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>'''

def ok(name, condition, scope='Actual controls and canonical model readback'):
    checks.append({'name': name, 'result': 'passed' if condition else 'failed', 'scope': scope})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)
    assert condition, name

def act(name, value=None, scope=''):
    selector = f'{scope} [data-action="{name}"]'.strip()
    if value is not None:
        selector += f'[data-value="{value}"]'
    page.locator(selector).first.click()

def js(code):
    return page.evaluate(code)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1540,'height':1000}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('sample', scope='main'); act('nav','designsystem','#sidebar')
        ok('Design System is reachable and starts without mutating the saved design', js('styleGuide()===undefined'))
        ok('Exports are disabled before the design exists', page.locator('[data-action="sg-export"][data-value="md"]').is_disabled())
        act('sg-starter')
        ok('Host-friendly starter creates valid typed declarations', js('validStyleGuide(styleGuide()) && styleGuide().fonts.length===3 && styleGuide().typography.length===4'))
        ok('Creation is a single undoable design transaction', js('design().history.length===1'))
        act('design-undo')
        ok('Undo restores the previous absence instead of leaving stale declarations', js('styleGuide()===undefined'))
        js('designHistory("redo")')
        ok('Redo restores the saved system', js('styleGuide().schema===1'))
        signature = js('JSON.stringify({h:design().history,r:design().revision,f:design().future})')
        act('sg-edit','overview'); act('sg-save')
        ok('Unchanged Save leaves history, revision and redo unchanged', js('JSON.stringify({h:design().history,r:design().revision,f:design().future})') == signature)
        act('sg-section','fonts'); act('sg-add','fonts')
        page.locator('#sg-name').fill('Product font');page.locator('#sg-id').fill('product-font');page.locator('#sg-families').fill('Example Sans, Arial')
        page.locator('#sg-license').fill('Family reference only. Bring your own licensed font.')
        page.locator('#sg-usage').fill('Use only for the plugin’s own headings.')
        act('sg-save')
        ok('Named local font stacks and license notes are saved', js('styleGuide().fonts.some(f=>f.id==="product-font" && f.families==="Example Sans, Arial")'))
        act('sg-section','typography');act('sg-add','typography')
        page.locator('#sg-name').fill('Hero text');page.locator('#sg-id').fill('hero-text');page.locator('#sg-font').select_option('product-font')
        page.locator('#sg-size').fill('2');page.locator('#sg-unit').select_option('rem');page.locator('#sg-weight').fill('700')
        ok('Valid unsaved typography has a visible local preview', page.locator('#sg-draft-preview').inner_text().find('Design for understanding.') >= 0)
        ok('Unsaved typography does not enter export', 'hero-text' not in js('sgMarkdown(styleGuide())'))
        act('sg-save')
        ok('Custom typography stores size, units and its font reference', js('styleGuide().typography.find(t=>t.id==="hero-text").unit==="rem"'))
        act('sg-section','fonts');act('sg-edit','fonts:product-font');act('sg-remove');act('sg-confirm-remove')
        ok('Used font deletion is blocked in the modal', 'used by typography' in page.locator('#sg-error').inner_text())
        act('sg-keep');act('close')
        act('sg-section','spacing');act('sg-add','spacing')
        page.locator('#sg-name').fill('Dense gap');page.locator('#sg-id').fill('dense-gap');page.locator('#sg-value').fill('6');act('sg-save')
        ok('Spacing tokens can be added independently', js('styleGuide().spacing.some(s=>s.id==="dense-gap"&&s.value===6)'))
        act('sg-edit','spacing:dense-gap');page.locator('#sg-value').fill('-1');act('sg-save')
        ok('Invalid dimension is rejected without losing the draft', page.locator('#modal').is_visible() and page.locator('#sg-value').input_value() == '-1' and js('styleGuide().spacing.find(s=>s.id==="dense-gap").value===6'))
        page.locator('#sg-value').fill('7');act('close')
        ok('Close asks before discarding an edited token', page.locator('#discard-dialog').is_visible())
        page.locator('#discard-keep').click();act('sg-remove');page.keyboard.press('Escape')
        ok('Escape from removal restores the exact editing draft', page.locator('#sg-value').input_value()=='7')
        act('sg-remove');act('sg-confirm-remove')
        ok('Confirmed deletion removes only the declaration', js('!styleGuide().spacing.some(s=>s.id==="dense-gap")'))
        act('design-undo')
        ok('Undo deletion restores saved content, not unsaved input', js('styleGuide().spacing.find(s=>s.id==="dense-gap").value===6'))
        act('sg-edit','spacing:dense-gap');page.locator('#sg-value').fill('9');js('styleGuide().description="Concurrent change"');act('sg-save')
        ok('Same-revision changes reject a stale token edit', 'changed while' in page.locator('#sg-error').inner_text() and js('styleGuide().spacing.find(s=>s.id==="dense-gap").value===6'))
        js('modalOriginal=null;closeModal()')
        act('sg-section','colors')
        ok('Contrast checks cover saved light and dark default pairs', page.locator('.sg-contrast > div > p').count()==6)
        ok('Contrast computes black/white as 21:1 without a rounding pass', abs(js('sgContrast("#000000","#FFFFFF")')-21)<.000001)
        token_tests = js('''(()=>{const s=styleGuide(),tests=[];for(const mutate of [x=>x.colors[0].light='red',x=>x.fonts[0].source='__proto__',x=>x.typography[0].font='absent',x=>x.spacing[0].value=Infinity,x=>x.colors[0].host='--x;display:none',x=>x.fonts.push({...x.fonts[0]}),x=>x.fonts[0]={...x.fonts[0],source:'custom',families:'Arial; color:red'},x=>x.unknown=true]){const c=designCopy(s);mutate(c);tests.push(!validStyleGuide(c));}return tests;})()''')
        ok('Unsafe CSS, duplicate keys, dangling fonts and unknown schema fields fail closed', all(token_tests), 'Controlled malformed-contract fixtures')
        ok('Portable blueprint contains the design system', js('portableDesign().designSystem.schema===1'))
        roundtrip=js('JSON.stringify(styleGuide())');js('importDesign(JSON.stringify(portableDesign()))')
        ok('Blueprint import roundtrips every saved declaration', js('JSON.stringify(styleGuide())')==roundtrip)
        ok('Generator review includes both requested document formats', js('sgFiles(design()).length===2&&designFiles(design()).some(f=>f.path==="docs/design/design-system.html")'))
        act('sg-section','typography')
        page.screenshot(path=str(OUT/'typography-dark.png'),full_page=True)
        # Export controls exercise real browser downloads.
        for extension in ['md','html']:
            with page.expect_download() as dl: act('sg-export',extension)
            dl.value.save_as(str(OUT/('design-system.'+extension)))
            ok('Real '+extension+' export has the expected filename and content', dl.value.suggested_filename=='design-system.'+extension and (OUT/('design-system.'+extension)).stat().st_size>1000)
        source = js('sgHtml(styleGuide())')
        exported = browser.new_page(viewport={'width':960,'height':800})
        export_requests=[];exported.on('request', lambda r: export_requests.append(r.url))
        exported.set_content(source)
        ok('Standalone HTML has every semantic section and no scripts', exported.locator('section[id]').count()==7 and exported.locator('script').count()==0)
        ok('Standalone HTML has a restrictive resource policy', "default-src 'none'" in exported.locator('meta[http-equiv="Content-Security-Policy"]').get_attribute('content'))
        ok('HTML is self-contained without remote font or asset requests', not export_requests)
        exported.set_viewport_size({'width':420,'height':850});exported.screenshot(path=str(OUT/'export-narrow.png'),full_page=True)
        ok('Export reflows without horizontal page overflow', exported.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        exported.close()
        injection=js('''(()=>{const s=designCopy(styleGuide());s.description='<img src="https://example.invalid/a" onerror="window.INJECTED=1"><script>window.INJECTED=1</scr'+'ipt>';s.guidelines[0].usage='[click](javascript:alert(1)) | **not formatting**';return {html:sgHtml(s),md:sgMarkdown(s)};})()''')
        exported=browser.new_page();exported.set_content(injection['html'])
        ok('Authored HTML-like descriptions remain inert text', exported.locator('img,script').count()==0 and exported.evaluate('window.INJECTED===undefined'))
        ok('Markdown export escapes HTML and link/table delimiters', '&lt;img' in injection['md'] and '\\[click\\]' in injection['md'] and '\\|' in injection['md'])
        exported.close()
        js('state.settings.theme="light";render()');page.set_viewport_size({'width':720,'height':1000})
        act('sg-section','colors');page.screenshot(path=str(OUT/'colors-light-narrow.png'),full_page=True)
        ok('Narrow workbench keeps export actions and token values reachable', page.locator('[data-action="sg-export"][data-value="html"]').is_visible() and js('document.documentElement.scrollWidth<=innerWidth'))
        page.keyboard.press('Tab')
        page.locator('[data-action="sg-section"][data-value="fonts"]').focus()
        ok('Section navigation exposes visible keyboard focus', page.locator('[data-action="sg-section"][data-value="fonts"]').evaluate('e=>getComputedStyle(e).outlineStyle!=="none"'))
        act('sg-section','fonts')
        ok('Active section exposes selected state', page.locator('[data-action="sg-section"][data-value="fonts"]').get_attribute('aria-pressed')=='true')
        ok('No page errors or runtime network requests occurred', not errors and not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal)
    finally:
        browser.close()
report={'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest()}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests else 0)
