"""Cross-surface control, focus, spacing and responsive contracts on the exact HTML."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/consistency'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""


def ok(name, condition, scope='Rendered controls and canonical state readback'):
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
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
                                 headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1440, 'height':1000})
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('sample', scope='main')
        js('seedSemanticExample(semanticModel());design().designSystem=sgStarter();setView("sources")')
        act('ds-example')
        js('canvasState();setView("sitemap")')
        page.wait_for_timeout(150)
        invariant = js('JSON.stringify(portableDesign())')
        for theme in ['dark', 'light']:
            js(f'state.settings.theme="{theme}";render()')
            for route in ['overview', 'prds', 'sitemap', 'entities', 'sources', 'components', 'testdata', 'designsystem', 'blueprints', 'patterns']:
                page.evaluate('(route)=>setView(route)', route)
                ok(f'{theme}: {route} has one primary heading and current navigation', js('''
                    document.querySelectorAll('main h1').length===1 &&
                    document.querySelectorAll('#sidebar [aria-current="page"]').length===1
                '''))
            js('setView("designsystem");sgUi.section="spacing";render()')
            primary = page.locator('main .btn.primary').first
            ratio = primary.evaluate('''e=>{
                const c=getComputedStyle(e),rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=s=>rgb(s).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
                const a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
            }''')
            ok(theme + ': primary button base text contrast exceeds 4.5:1', ratio >= 4.5)
            before = primary.evaluate('e=>({bg:getComputedStyle(e).backgroundColor,h:e.getBoundingClientRect().height})')
            primary.hover()
            ok(theme + ': primary hover keeps its primary background role', primary.evaluate('e=>getComputedStyle(e).backgroundColor') == before['bg'])
            primary.focus(); page.keyboard.press("Tab"); page.keyboard.press("Shift+Tab")
            ok(theme + ': keyboard focus is visibly outlined', primary.evaluate('e=>getComputedStyle(e).outlineStyle') != 'none')
            ok(theme + ': compact primary targets are at least 32 CSS pixels tall', before['h'] >= 32)
            primary.hover(); page.mouse.down()
            ok(theme + ': pressed primary retains readable fill and gives inset feedback', primary.evaluate('e=>getComputedStyle(e).backgroundColor') == before['bg'] and primary.evaluate('e=>getComputedStyle(e).boxShadow') != 'none')
            page.mouse.move(4,4); page.mouse.up()
            disabled = page.locator('main button:disabled').first
            base_disabled = disabled.evaluate('e=>getComputedStyle(e).backgroundColor')
            disabled.hover(force=True)
            ok(theme + ': disabled controls retain disabled styling on hover', disabled.evaluate('e=>getComputedStyle(e).backgroundColor') == base_disabled and disabled.evaluate('e=>getComputedStyle(e).cursor') == 'not-allowed')

        ok('Browsing, theme and focus changes do not edit the design', js('JSON.stringify(portableDesign())') == invariant)
        # Shared forms preserve names, hints, values and escaped author text.
        for command, control in [('sgOpen("typography")', '#sg-size'), ('tdOpen()', '#td-count'),
                                 ('dsEditSource(dataSources().sources[0].id)', '#ds-slug'),
                                 ('erBeginEntity(semanticModel().entities[0].id)', '#er-slug')]:
            js(command)
            ok(control + ': input retains a programmatic label', page.locator(control).evaluate('e=>e.labels.length===1'))
            hints = js(r'''[...document.querySelectorAll('#modal [aria-describedby]')].every(e=>e.getAttribute('aria-describedby').split(/\s+/).every(id=>document.getElementById(id)))''')
            ok(control + ': every helper-text reference resolves', hints)
            ok(control + ': field values have normal weight, independent of label weight', page.locator(control).evaluate('e=>getComputedStyle(e).fontWeight') == '400')
            js('modalOriginal=null;closeModal()')
        markup = js('uiInput("<img src=x>","probe",0,{hint:"<b>help</b>"})')
        ok('Shared renderer preserves numeric zero and escapes labels and hints', 'value="0"' in markup and '&lt;img' in markup and '<img' not in markup and '&lt;b&gt;' in markup)
        # Ordinary modal replacements reset their accessible name to the current title.
        js('showModal("canvas-help");showModal("settings")')
        ok('A replacement dialog references its own visible title', js('''(()=>{const d=document.getElementById('modal'),title=d.querySelector('h2');return title&&d.getAttribute('aria-labelledby')===title.id;})()'''))
        act('close')
        js('setView("designsystem");sgUi.section="spacing";render()')
        act('sg-add', 'spacing')
        page.locator('#sg-name').fill('Pending spacing')
        draft = js('JSON.stringify(sgUi.form)')
        page.keyboard.press('Control+k')
        ok('Command palette shortcut cannot replace a dirty editing dialog', js('modalType==="style-guide-form"&&JSON.stringify(sgUi.form)') == draft)
        page.keyboard.press('Meta+k')
        ok('Mac command palette shortcut also preserves the active draft', js('modalType==="style-guide-form"&&JSON.stringify(sgUi.form)') == draft)
        act('close'); ok('Normal Close still asks before discarding changed fields', page.locator('#discard-dialog').is_visible())
        page.locator('#discard-keep').click()
        ok('Keep editing restores the pending field value', page.locator('#sg-name').input_value() == 'Pending spacing')
        js('modalOriginal=null;closeModal()')
        # A render detaches old buttons; closing the modal resolves their stable identity.
        js('setView("designsystem");sgUi.section="spacing";render()')
        act('sg-add', 'spacing'); js('render()'); act('close')
        ok('Closing after background redraw restores the invoking control', js('document.activeElement.dataset.action==="sg-add"&&document.activeElement.dataset.value==="spacing"'))
        # Repeated fields often have only data-index, not unique IDs.
        js('erBeginEntity(semanticModel().entities[0].id)')
        required = page.locator('[data-field="er-prop-required"][data-index="1"]')
        required.focus(); js('redrawModal()')
        ok('Redraw restores the second repeated property control, not the first', js('document.activeElement.dataset.field==="er-prop-required"&&document.activeElement.dataset.index==="1"'))
        page.locator('#er-name').fill('Edited project title')
        page.locator('#er-name').evaluate('e=>{e.focus();e.setSelectionRange(3,9)}')
        js('redrawModal()')
        ok('Redraw preserves text selection and caret without committing', js('document.activeElement.id==="er-name"&&document.activeElement.selectionStart===3&&document.activeElement.selectionEnd===9'))
        js('modalOriginal=null;closeModal()')
        # Both shape sides contain indexed required controls.
        js('dsEditOperation(dataSources().sources[0].id+":"+dataSources().sources[0].operations[0].id)')
        page.locator('[data-field="ds-shape-output-required"][data-index="1"]').focus()
        js('redrawModal()')
        ok('Source shape redraw preserves side and row identity', js('document.activeElement.dataset.field==="ds-shape-output-required"&&document.activeElement.dataset.index==="1"'))
        js('modalOriginal=null;closeModal()')
        # Narrow forms keep header and action row visible while body scrolls.
        page.set_viewport_size({'width':560, 'height':640})
        js('sgOpen("typography")')
        size = js('''(()=>{const d=document.getElementById('modal'),h=d.querySelector('.dialog-header'),f=d.querySelector('.dialog-footer'),b=d.querySelector('.dialog-body');return {header:h.getBoundingClientRect().top,footer:f.getBoundingClientRect().bottom,body:b.clientHeight,scroll:b.scrollHeight,height:innerHeight,width:d.scrollWidth,client:d.clientWidth};})()''')
        ok('Short viewport keeps both modal title and actions visible', size['header'] >= 0 and size['footer'] <= 640 and size['scroll'] > size['body'])
        ok('Narrow modal has no horizontal content overflow', size['width'] <= size['client'] + 1)
        page.locator('#sg-usage').focus()
        scroll = js('document.querySelector("#modal .dialog-body").scrollTop')
        js('redrawModal()')
        ok('Form redraw retains the body scroll position', abs(js('document.querySelector("#modal .dialog-body").scrollTop') - scroll) <= 1)
        page.screenshot(path=str(OUT/'form-light-narrow.png'))
        js('modalOriginal=null;closeModal()')
        act('menu')
        ok('Narrow navigation exposes its expanded state and moves focus inside', js('document.querySelector("[data-action=menu]").getAttribute("aria-expanded")==="true"&&Boolean(document.activeElement.closest("#sidebar"))'))
        page.keyboard.press('Escape')
        ok('Escape closes navigation and restores its trigger', js('!document.getElementById("sidebar").classList.contains("show")&&document.activeElement.dataset.action==="menu"'))
        act('menu'); act('nav', 'sources', '#sidebar')
        ok('Choosing a destination collapses navigation with truthful metadata', js('document.querySelector("[data-action=menu]").getAttribute("aria-expanded")==="false"&&!document.getElementById("sidebar").classList.contains("show")'))
        # No root/model migration occurs as a side effect of visual polishing.
        ok('Presentation and cancelled drafts preserve the authored design', js('JSON.stringify(portableDesign())') == invariant)
        js('const savedVault=project().vault;project().vault="/example/.dev-vault";window.retainedTarget=vaultContextView().includes("/example/.dev-vault");project().vault=savedVault')
        ok('Context reports a retained development target instead of substituting the new default', js('window.retainedTarget'))
        ok('Preparation consistently names the new contained target', js('vaultPreparationView().includes("Test target: .test-vault/")'))
        js('showModal("activate")')
        ok('Activation names the actual current test target', page.locator('#modal h3').filter(has_text='Isolated test vault:').inner_text().endswith(js('vaultDisplayTarget()')))
        js('closeModal();showModal("deploy")')
        ok('Deployment accurately describes the existing explicit-target installer', '--vault target' in page.locator('#modal').inner_text() and 'not an existing CLI flag' not in page.locator('#modal').inner_text())
        js('closeModal()')

        page.locator('#toasts .toast').wait_for(state='detached')
        for width, theme in [(1440, 'dark'), (960, 'light'), (560, 'dark')]:
            page.set_viewport_size({'width':width, 'height':1000})
            js(f'state.settings.theme="{theme}"')
            for route in ['sitemap', 'entities', 'sources', 'components', 'testdata', 'designsystem']:
                page.evaluate('(route)=>setView(route)', route)
                page.wait_for_timeout(100)
                ok(f'{width}/{theme}: {route} heading and main viewport fit', js('''(()=>{const m=document.querySelector('main'),h=m.querySelector('h1'),r=h.getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth&&r.left>=0&&r.right<=innerWidth&&m.scrollWidth<=m.clientWidth+1;})()'''))
                if (width, route) in [(1440,'sources'),(1440,'entities'),(960,'components'),(560,'designsystem'),(1440,'testdata'),(1440,'sitemap')]:
                    page.screenshot(path=str(OUT/f'{route}-{theme}-{width}.png'))
        js('setView("sitemap")')
        summary = page.locator('.ref-arrange-popover > summary')
        summary.click();page.keyboard.press('Escape')
        ok('Escape closes an arrangement popover before any canvas action', page.locator('.ref-arrange-popover').get_attribute('open') is None and summary.evaluate('e=>e===document.activeElement'))
        # Disabled and selected controls do not advertise a different action/state on hover.
        js('setView("designsystem");sgUi.section="spacing";render()')
        current = page.locator('.sg-navigation > button.selected')
        base_color = current.evaluate('e=>getComputedStyle(e).backgroundColor');current.hover()
        ok('Selected design section keeps its selected background on hover', current.evaluate('e=>getComputedStyle(e).backgroundColor') == base_color)
        page.emulate_media(reduced_motion='reduce')
        ok('Reduced-motion preference disables shared transitions', current.evaluate('e=>getComputedStyle(e).transitionDuration') == '0s')
        ok('No observed page or console errors', not errors)
        ok('No runtime network requests', not requests)
    except Exception as exc:
        fatal = str(exc)
        traceback.print_exc()
    finally:
        report = {'checks':checks, 'errors':errors, 'requests':requests, 'fatal':fatal,
                  'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),
                  'scope':'Actual browser controls plus explicit controlled-state fixtures; not native Obsidian or complete accessibility certification.'}
        (OUT/'checks.json').write_text(json.dumps(report, indent=2)+'\n')
        browser.close()
raise SystemExit(0 if not fatal and not errors and not requests else 1)
