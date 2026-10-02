"""Test-data authoring, real kit download and execution; no live services or user vault."""
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import traceback
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/test-data'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = '''<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>'''

def ok(name, value, scope='Browser controls and canonical model readback'):
    checks.append({'name':name, 'result':'passed' if value else 'failed', 'scope':scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name

def js(code):
    return page.evaluate(code)

def act(name, value=None, scope=''):
    selector = f'{scope} [data-action="{name}"]'.strip()
    if value is not None:
        selector += f'[data-value="{value}"]'
    page.locator(selector).first.click()

def clean():
    js('modalOriginal=null;closeModal()')

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1540,'height':1000}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('sample',scope='main');act('nav','testdata','#sidebar')
        ok('Test data is reachable without generating state or files', js('dataSources().testing===undefined && tdSettings().recipes.length===0'))
        ok('Empty catalog links to source authoring and blocks preview/export', page.locator('[data-action="td-preview"]').is_disabled() and page.locator('[data-action="td-export"]').is_disabled())
        ok('New project development target is the dedicated test vault', js('project().vault===vaultTestRoot() && project().vault.endsWith("/.test-vault")'))
        act('nav','sources','#sidebar');act('ds-example');act('nav','testdata','#sidebar')
        source = js('dataSources().sources.map(s=>({id:s.id,kind:s.kind,ops:s.operations.map(o=>o.id)}))')
        api=next(s for s in source if s['kind']=='api');vault=next(s for s in source if s['kind']=='vault');database=next(s for s in source if s['kind']=='database')
        ok('All supported source kinds have centrally derived recipes', len(source)==3 and page.locator('.td-source').count()==3)
        act('td-enable',api['id'])
        ok('Enable source explicitly opts its operations in with one transaction', js('tdSettings().recipes.filter(r=>r.enabled).length')==len(api['ops']))
        before=js('JSON.stringify({r:design().revision,h:design().history,f:design().future})')
        act('td-enable',api['id'])
        ok('Re-enabling unchanged recipes does not create false history', before==js('JSON.stringify({r:design().revision,h:design().history,f:design().future})'))
        act('td-settings');page.locator('#td-count').fill('3');page.locator('#td-seed').fill('314');page.locator('#td-locale').select_option('de');act('td-save')
        ok('Seed, locale and bounded count persist as project-owned settings', js('tdSettings().count===3 && tdSettings().seed===314 && tdSettings().locale==="de"'))
        act('td-settings');page.locator('#td-count').fill('0');act('td-save')
        ok('Invalid settings stay in the modal without changing saved values', page.locator('#td-count').input_value()=='0' and js('tdSettings().count===3'))
        ok('Invalid settings expose a focused recovery message', page.locator('#td-error').evaluate('e=>e===document.activeElement'))
        clean();act('td-preview')
        first=js('JSON.stringify(tdUi.preview.generated.files)')
        act('td-preview')
        ok('Two previews of identical recipes return identical bytes', first==js('JSON.stringify(tdUi.preview.generated.files)'))
        ok('Preview exposes payload files without writing a vault', js('tdUi.preview.generated.files.length===2') and page.locator('.td-files pre').is_visible())
        ok('Resolved manifest does not retain production URL or credentials', js('!JSON.stringify(tdManifest()).includes("https://") && !JSON.stringify(tdManifest()).includes("credential")'))
        act('td-settings');page.locator('#td-seed').fill('315');act('td-save')
        ok('Changing settings invalidates preview and disables export', page.locator('[data-action="td-export"]').is_disabled())
        act('td-preview');ok('Changing the seed changes synthetic payloads', first!=js('JSON.stringify(tdUi.preview.generated.files)'))
        act('td-recipe',api['ops'][0]);page.locator('#td-scenario').select_option('error');page.locator('#td-errorStatus').fill('429');act('td-save')
        act('td-preview');page.locator('[data-field="td-operation"]').select_option(api['ops'][0]);act('td-simulate')
        page.wait_for_function('!tdUi.busy')
        ok('Configured failure is visible without a live fallback', '429' in page.locator('.td-result').inner_text())
        act('td-recipe',api['ops'][0]);page.locator('#td-scenario').select_option('slow');act('td-save');act('td-preview')
        act('td-simulate');ok('Running state disables repeat invocation and enables cancellation', page.locator('[data-action="td-simulate"]').is_disabled() and page.locator('[data-action="td-cancel"]').is_enabled())
        act('td-cancel');page.wait_for_function('!tdUi.busy')
        ok('Cancel stops the request without mutating a source', 'cancelled' in page.locator('.td-result').inner_text().lower())
        act('td-simulate');act('nav','designsystem','#sidebar');page.wait_for_timeout(50)
        ok('Leaving Test data disposes the pending session', js('tdUi.session===null && !tdUi.busy && tdUi.output===""'))
        act('nav','testdata','#sidebar');act('td-recipe',api['ops'][0]);page.locator('#td-scenario').select_option('populated');act('td-save')
        act('td-recipe',api['ops'][1]);arg=page.locator('[data-field="td-rule-argument"]').first;provider=page.locator('[data-field="td-rule-provider"]').first
        provider.select_option('literal');arg.fill('{broken');act('td-save');act('td-preview')
        ok('Invalid literal remains saved as a repairable recipe but blocks generation', 'Literal generators' in page.locator('#td-page-error').inner_text() and page.locator('[data-action="td-export"]').is_disabled())
        act('td-recipe',api['ops'][1]);ok('Invalid generator text survives reopening', page.locator('[data-field="td-rule-argument"]').first.input_value()=='{broken')
        page.locator('[data-field="td-rule-provider"]').first.select_option('auto');page.locator('[data-field="td-rule-argument"]').first.fill('');act('td-save')
        # An unsaved recipe is protected against interruption and stale contracts.
        act('td-recipe',api['ops'][0]);page.locator('#td-dataset').fill('edited-draft');act('close')
        ok('Closing an edited recipe offers discard protection', page.locator('#discard-dialog').is_visible())
        page.locator('#discard-keep').click();ok('Keep editing restores the exact recipe draft', page.locator('#td-dataset').input_value()=='edited-draft')
        js('dataSources().sources[0].description="Intervening source edit"');act('td-save')
        ok('Stale contract edit is rejected and retains the draft', 'changed during editing' in page.locator('#td-error').inner_text() and page.locator('#td-dataset').input_value()=='edited-draft')
        clean()
        for s in [vault,database]:
            act('td-source',s['id']);act('td-enable',s['id'])
        act('td-preview')
        ok('Vault recipes derive real Markdown fixtures alongside API/database JSON', js('tdUi.preview.generated.files.some(f=>f.path.endsWith(".md")) && tdUi.preview.generated.files.some(f=>f.path.startsWith(".fixtures/"))'))
        ok('Every generated fixture matches the enabled operation schema', js('tdUi.preview.generated.operations.every(o=>["input","output"].every(side=>o[side].none||createFixtureEngine().matches(o[side+"Value"],o[side].schema)))'))
        canonical=js('JSON.stringify(tdSettings())');js('importDesign(JSON.stringify(portableDesign()))')
        ok('Blueprint export/import roundtrips recipes without live endpoints', canonical==js('JSON.stringify(tdSettings())'))
        act('td-preview');files=js('tdUi.preview.generated.files')
        ok('Generator plan includes runnable tooling and exact manifest', js('designFiles(design()).some(f=>f.path==="scripts/test-data/cli.mjs") && designFiles(design()).some(f=>f.path==="scripts/test-data/manifest.json")'))
        with page.expect_download() as dl:
            act('td-export')
        dl.value.save_as(str(OUT/'plugin-test-data-kit.zip'))
        ok('Export control downloads the complete runnable ZIP', dl.value.suggested_filename=='plugin-test-data-kit.zip')
        with zipfile.ZipFile(OUT/'plugin-test-data-kit.zip') as archive:
            ok('Kit contains generator, safe writer, both simulators and client bootstrap', all('scripts/test-data/'+name in archive.namelist() for name in ['engine.mjs','storage.mjs','server.mjs','adapters.mjs','client.mjs','cli.mjs','manifest.json','README.md']))
            ok('Kit has no fonts, dependencies, secrets or existing vault files', all(name.startswith('scripts/test-data/') and name.endswith(('.mjs','.json','.md')) for name in archive.namelist()))
            with tempfile.TemporaryDirectory(prefix='exported-fixtures-') as tmp:
                target=Path(tmp).resolve();archive.extractall(target)
                def run(*args):
                    result=subprocess.run(['node','scripts/test-data/cli.mjs',*args],cwd=target,text=True,capture_output=True,timeout=30,check=True)
                    return json.loads(result.stdout)
                plan=run('plan')
                ok('Actual exported CLI defaults to a dry plan with zero fixture writes', not (target/'.test-vault').exists() and plan['mode']=='seed', 'Real exported Node CLI in temporary directory')
                run('apply','--approve',plan['approval'])
                ok('Actual exported CLI creates exactly the previewed content', all((target/'.test-vault'/f['path']).read_text()==f['content'] for f in files), 'Real temporary filesystem; byte-for-byte preview comparison')
                (target/'.test-vault'/'My note.md').write_text('preserve')
                reset=run('reset-plan');run('reset','--approve',reset['approval'])
                ok('Actual exported cleanup preserves unrelated notes', (target/'.test-vault'/'My note.md').read_text()=='preserve' and not (target/'.test-vault'/files[0]['path']).exists(), 'Real exported cleanup, temporary directory')
        page.screenshot(path=str(OUT/'workspace-dark.png'),full_page=True)
        act('td-source',api['id']);act('td-recipe',api['ops'][1]);page.set_viewport_size({'width':720,'height':1000});js('state.settings.theme="light";render();redrawModal()')
        page.screenshot(path=str(OUT/'recipe-light-narrow.png'),full_page=True)
        ok('Narrow recipe controls and Save remain inside the modal', page.locator('[data-action="td-save"]').is_visible() and page.locator('#modal').evaluate('e=>e.getBoundingClientRect().right<=innerWidth && e.scrollWidth<=e.clientWidth'))
        clean();page.keyboard.press('Tab');page.locator('[data-action="td-settings"]').focus()
        ok('Test-data controls retain visible keyboard focus', page.locator('[data-action="td-settings"]').evaluate('e=>getComputedStyle(e).outlineStyle!=="none"'))
        # Retained older target needs an explicit change; no data migration is implied.
        js('project().vault=project().path+"/.dev-vault";render()');act('td-target')
        js('project().rev+=1');act('td-target-confirm')
        ok('Stale development-target review cannot mutate the project', js('project().vault.endsWith("/.dev-vault")') and page.locator('#modal').evaluate('e=>e.open'))
        clean();js('state.activeRun={id:"target-check"};handleTestDataAction("td-target")')
        ok('Active project operation blocks target changes', js('project().vault.endsWith("/.dev-vault") && !document.getElementById("modal").open'))
        js('state.activeRun=null;render()');act('td-target');act('td-target-confirm')
        ok('Older target changes only through the explicit review action', js('project().vault===vaultTestRoot()'))
        ok('No runtime browser network requests or console/page errors', not requests and not errors)
    except Exception:
        fatal=traceback.format_exc();print(fatal)
    finally:
        browser.close()
(OUT/'checks.json').write_text(json.dumps({'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest()},indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests else 0)
