"""CSS export / saved bindings / browser-CLI parity and computed style isolation."""
import hashlib
import json
import os
import subprocess
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/design-styles'
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks, errors, requests, fatal = [], [], [], None

def check(name, value, scope='Actual controls, canonical readback and explicit isolated fixtures'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name

def js(code, arg=None): return page.evaluate(code, arg)
def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1480,'height':1000},accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    try:
        page.set_content(STORAGE+HTML.read_text())
        act('project-example');page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        act('nav','designsystem','#sidebar');act('sg-section','frontend')
        check('Styling is reachable inside the existing Design System',page.get_by_role('heading',name='Nuxt UI styling',exact=True).is_visible())
        check('Saved mappings and inherited roles are visible','Framework default' in page.locator('.sg-content').inner_text())
        before=js('JSON.stringify(styleGuide())');history=js('design().history.length')
        act('sg-edit','frontend');page.locator('#sg-colorPolicy').select_option('declared')
        check('Palette editing remains a draft until Save',before==js('JSON.stringify(styleGuide())'))
        page.locator('#sg-binding-primary').select_option('text')
        act('sg-save',scope='#modal')
        check('Bindings commit in one undoable transaction',js('styleGuide().frontend.bindings.primary==="text"&&styleGuide().frontend.colorPolicy==="declared"') and js('design().history.length')==history+1)
        act('design-undo');check('Undo restores exact original saved frontend settings',before==js('JSON.stringify(styleGuide())'))
        act('design-redo');check('Redo restores the saved binding',js('styleGuide().frontend.bindings.primary==="text"'))
        act('sg-edit','frontend');page.locator('#sg-binding-primary').select_option('@auto');act('sg-save',scope='#modal')
        check('Automatic is represented by absence, not a magic token ID',js('!Object.hasOwn(styleGuide().frontend.bindings,"primary")'))
        count=js('design().history.length');act('sg-edit','frontend');act('sg-save',scope='#modal')
        check('Saving an unchanged binding set is a no-op',js('design().history.length')==count)
        with page.expect_download() as event:act('sg-export','css')
        download=event.value;download.save_as(str(OUT/'design-system.css'))
        css=(OUT/'design-system.css').read_text()
        check('Actual CSS download matches the saved compiler output',download.suggested_filename=='design-system.css' and css==js('compileDesignSystem(styleGuide(),project().id).css'))
        exported=js('companionJson()');(OUT/'project.companion.json').write_text(exported)
        run=subprocess.run(['node','--input-type=module','-e',"import {compileDesignSystem} from './scripts/companion/design-system-css.mjs';let s='';for await(const c of process.stdin)s+=c;const d=JSON.parse(s);process.stdout.write(compileDesignSystem(d.design.designSystem,d.project.id).css);"],input=exported,text=True,capture_output=True,cwd=ROOT,timeout=15)
        check('CLI and browser compilation are byte-identical from the actual exported JSON',run.returncode==0 and run.stdout==css and not run.stderr)
        check('Full-project round trip retains palette policy and mappings',js('JSON.parse(companionJson()).design.designSystem.frontend.colorPolicy==="declared"'))
        act('sg-edit','frontend');page.locator('#sg-binding-primary').select_option('text')
        js('design().designSystem.description+=" externally changed"')
        act('sg-save',scope='#modal')
        check('Stale styling drafts are rejected and retained',page.locator('#modal').is_visible() and 'changed' in page.locator('#sg-error').inner_text() and js('sgUi.form.record.bindings.primary==="text"&&!Object.hasOwn(styleGuide().frontend.bindings,"primary")'))
        js('modalOriginal=null;closeModal()')
        # The specimen verifies CSS itself, not an invented Nuxt runtime. Live Nuxt tests are separate.
        specimen=browser.new_page(viewport={'width':960,'height':600})
        specimen.set_content('<style>body{--background-primary:#fefefe;--font-interface:serif;--font-text:serif}button{border-radius:2px}</style><button id="host">Host</button><div id="other" data-plugin-ui="other" class="ps--other"><button>Other</button></div><div id="owned" data-plugin-ui="plugin-companion" class="ps--plugin-companion light"><h1>Title</h1><button>Button</button><span class="plugin-companion-ds-colors-accent">Accent</span><input><div class="plugin-companion-ds-padding-md">Space</div></div><div id="portal" data-plugin-ui="plugin-companion" class="ps--plugin-companion dark"><button>Portal</button></div>')
        sentinel=specimen.locator('#host').evaluate('e=>({color:getComputedStyle(e).color,radius:getComputedStyle(e).borderRadius})')
        other=specimen.locator('#other').evaluate('e=>getComputedStyle(e).backgroundColor')
        specimen.add_style_tag(content=css)
        check('Owned root uses declared light background instead of the host value',specimen.locator('#owned').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)')
        check('Typography helper and heading mapping use exact saved size',specimen.locator('#owned h1').evaluate('e=>getComputedStyle(e).fontSize')=='24px')
        check('Nuxt UI semantic primary is mapped to the authored token',specimen.locator('#owned').evaluate('e=>getComputedStyle(e).getPropertyValue("--ui-primary").trim().toLowerCase()')=='#6550b9')
        check('Control radius and size are applied',specimen.locator('#owned button').evaluate('e=>getComputedStyle(e).borderRadius==="6px"&&getComputedStyle(e).minHeight==="36px"'))
        check('Spacing helpers consume saved tokens',specimen.locator('.plugin-companion-ds-padding-md').evaluate('e=>getComputedStyle(e).padding')=='16px')
        specimen.locator('#owned').evaluate('e=>{e.classList.remove("light");e.classList.add("dark")}')
        check('Changing the owned mode resolves the dark palette',specimen.locator('#owned').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(30, 30, 36)')
        check('Owned portal roots receive the same dark tokens',specimen.locator('#portal').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(30, 30, 36)')
        check('Host sentinel and second plugin are unchanged',sentinel==specimen.locator('#host').evaluate('e=>({color:getComputedStyle(e).color,radius:getComputedStyle(e).borderRadius})') and other==specimen.locator('#other').evaluate('e=>getComputedStyle(e).backgroundColor'))
        specimen.screenshot(path=str(OUT/'scoped-css-specimen.png'));specimen.close()
        page.set_viewport_size({'width':720,'height':1000});act('sg-section','frontend')
        check('Narrow styling page retains export controls without page overflow',page.locator('[data-action="sg-export"][data-value="css"]').is_visible() and js('document.documentElement.scrollWidth<=innerWidth'))
        page.screenshot(path=str(OUT/'styling-narrow.png'),full_page=True)
        check('No runtime errors or network requests',not errors and not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal)
    finally:browser.close()
(OUT/'checks.json').write_text(json.dumps({'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest()},indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests else 0)
