"""Test the HTML concept, not an Obsidian plugin or its real CLI adapters.
HTML injection is used because file/loopback navigation was blocked by the managed
browser in the authoring environment. Persistence checks explicitly use a Storage
stand-in; they do not qualify native file-origin localStorage.
Requires pre-provisioned Python Playwright and Chromium. No dependencies installed.
"""
import argparse
import json
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
parser = argparse.ArgumentParser()
parser.add_argument('--browser', default=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
parser.add_argument('--report', default=str(ROOT / 'reports/concepts/companion/browser-checks.json'))
parser.add_argument('--screenshots', default=str(ROOT / 'reports/concepts/companion/screenshots'))
args = parser.parse_args()
shots = Path(args.screenshots)
shots.mkdir(parents=True, exist_ok=True)
results, errors, requests = [], [], []

def act(p, action, value=None, scope=''):
    q = f'{scope} [data-action="{action}"]'
    if value is not None:
        q += f'[data-value="{value}"]'
    p.locator(q.strip()).first.click()

def check(name, condition=True):
    assert condition, name
    results.append({'name': name, 'result': 'passed', 'scope': 'browser concept only'})
    print('PASS', name, flush=True)

def scenario(p, name):
    if p.locator('#modal').evaluate('(e)=>e.open'):
        p.keyboard.press('Escape')
    act(p, 'lab'); act(p, 'scenario', name); act(p, 'close')

def review(p):
    act(p, 'create', scope='main')
    act(p, 'wizard-next'); act(p, 'wizard-next'); act(p, 'acquire')
    act(p, 'wizard-next'); act(p, 'wizard-next')
    p.locator('[data-field="w-bound"]').check(); act(p, 'wizard-next')
    p.locator('[data-field="w-trusted"]').check(); act(p, 'plan')
    p.locator('[data-field="w-approved"]').check()

def maker(p):
    act(p, 'nav', 'generate', '#sidebar')
    p.locator('[data-field="g-name"]').fill('meetings')
    p.locator('[data-field="g-entity"]').fill('meeting')
    p.locator('[data-field="g-folder"]').fill('Meetings')
    act(p, 'maker-preview')

def wait(p):
    deadline = time.monotonic() + 6
    while p.evaluate('state.activeRun !== null'):
        assert time.monotonic() < deadline, 'Simulation did not settle'
        p.wait_for_timeout(50)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=args.browser, headless=True, args=['--no-sandbox'])
    def new(storage=None, width=1512, height=1040):
        p = browser.new_page(viewport={'width': width, 'height': height})
        p.set_default_timeout(6000)
        p.on('pageerror', lambda e: errors.append(str(e)))
        p.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        p.on('request', lambda r: requests.append(r.url))
        if storage is not None:
            p.evaluate('''(raw)=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;
              Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,
              setItem:(k,v)=>fixtureStore[k]=String(v),removeItem:k=>delete fixtureStore[k]},configurable:true});}''', storage)
        p.set_content(HTML.read_text())
        return p
    p = new()
    check('Fresh workspace renders with no prerequisites', p.locator('h1').inner_text() == 'Less setup.\nMore building.')
    check('Storage denial falls back to memory', 'memory only' in p.locator('#storage-status').inner_text())
    p.screenshot(path=str(shots/'01-fresh-vault.png'))
    p.keyboard.press('Control+k'); p.locator('#palette-search').fill('quality')
    p.keyboard.press('ArrowDown'); p.keyboard.press('Enter')
    check('Keyboard palette opens unbound workflow safely', 'Start with a project' in p.locator('main').inner_text())
    act(p, 'nav', 'projects', '#sidebar'); review(p)
    check('Plan distinguishes existing command from proposed binding', '--profile browser' in p.locator('#modal').inner_text() and 'not an existing CLI flag' in p.locator('#modal').inner_text())
    p.screenshot(path=str(shots/'02-setup-plan.png'))
    act(p, 'setup'); p.wait_for_selector('[data-action="finish"]')
    check('Eight-stage creation journey completes', p.evaluate('state.projects.length===1 && state.wizard.completed.length===6'))
    check('Setup neither activates nor promotes unrun scopes', p.evaluate('!project().enabled && !project().quality.browser && !project().quality.native && !project().quality.security'))
    act(p, 'activate', scope='#modal'); act(p, 'enable-demo'); act(p, 'return-wizard'); act(p, 'finish')
    check('Activation is a separate deliberate fixture action', p.evaluate('project().enabled'))
    p.screenshot(path=str(shots/'03-project-overview.png'))
    maker(p); p.screenshot(path=str(shots/'04-maker-preview.png'))
    act(p, 'file-preview', '4')
    check('Maker file navigation displays the fixture', 'No vault note is created' in p.locator('.code-body').inner_text())
    act(p, 'maker-apply'); wait(p)
    check('Maker increments source and leaves old verification stale', p.evaluate('project().features.length===1 && project().rev===2 && project().quality.verify.rev===1'))
    maker(p); act(p, 'maker-apply')
    check('Identical maker rerun is no-op', p.evaluate('project().features.length===1 && project().rev===2'))
    act(p, 'nav', 'generate', '#sidebar'); act(p, 'recipe', 'entity')
    p.locator('[data-field="g-group"]').select_option('meetings')
    p.locator('[data-field="g-entity"]').fill('agenda')
    act(p, 'maker-preview'); act(p, 'maker-apply'); wait(p)
    check('Entity-with-document targets selected group', p.evaluate('project().features.some(f=>f.entity==="agenda" && f.name==="meetings")'))
    act(p, 'nav', 'quality', '#sidebar'); p.screenshot(path=str(shots/'05-quality-scopes.png'))
    act(p, 'check', 'verify'); act(p, 'check-confirm'); wait(p)
    check('Verify updates only its named scope and build', p.evaluate('project().quality.verify.rev===project().rev && !project().quality.native && project().builtRev===project().rev'))
    act(p, 'edit-source')
    check('Source edit makes previous evidence stale', 'Stale · demo' in p.locator('main').inner_text())
    act(p, 'nav', 'develop', '#sidebar'); act(p, 'deploy')
    check('Stale candidate cannot be deployed', p.locator('[data-action="deploy-confirm"]').is_disabled())
    act(p, 'close'); act(p, 'check', 'build'); act(p, 'check-confirm'); wait(p)
    scenario(p, 'collision'); act(p, 'deploy'); act(p, 'deploy-confirm')
    check('Target collision preserves installed candidate', 'Target collision' in p.locator('#operation-error').inner_text() and p.evaluate('project().installedRev===1'))
    scenario(p, 'happy'); act(p, 'deploy'); act(p, 'deploy-confirm')
    check('Deployment advances assets without changing activation', p.evaluate('project().installedRev===project().rev && project().enabled'))
    act(p, 'session', 'dev:ui'); act(p, 'session-confirm')
    check('Session ownership appears without a server', p.evaluate('project().sessions.includes("dev:ui")'))
    act(p, 'stop-session', 'dev:ui')
    check('Session stop releases fixture', p.evaluate('project().sessions.length===0'))
    act(p, 'nav', 'capabilities', '#sidebar'); act(p, 'tool-tab', 'tools'); p.locator('#tool-search').fill('coverage')
    check('Tool catalog search', p.locator('#tool-results .tool-card').count()==3)
    p.locator('#tool-search').fill('')
    check('All 33 baseline scripts appear', p.locator('#tool-results .tool-card').count()==33)
    act(p, 'nav', 'projects', '#sidebar'); act(p, 'attach'); act(p, 'attach-confirm')
    check('Attached project begins inspect-only', p.evaluate('!project().trusted && Object.keys(project().quality).length===0'))
    act(p, 'nav', 'quality', '#sidebar'); act(p, 'check', 'verify'); act(p, 'check-confirm')
    check('Attached project requires execution trust', p.locator('#trust-checkbox').count()==1 and p.evaluate('state.activeRun===null'))
    p.locator('#trust-checkbox').check(); act(p, 'trust-confirm')
    check('Trust grant does not execute', p.evaluate('project().trusted && state.activeRun===null && Object.keys(project().quality).length===0'))
    act(p, 'note'); act(p, 'commit-note')
    check('Note commit is explicit and duplicate-safe', p.evaluate('project().notes.length===1') and p.locator('[data-action="commit-note"]').is_disabled())
    act(p, 'close'); act(p, 'nav', 'release', '#sidebar'); act(p, 'handoff')
    check('Handoff is labeled and excludes paths', 'simulation only' in p.locator('#copy-text').input_value() and '/workspace' not in p.locator('#copy-text').input_value())
    with p.expect_download() as dl: act(p, 'download-text')
    check('Explicit text export has correct filename', dl.value.suggested_filename=='shell-workbench-concept-handoff.md')
    act(p, 'close'); act(p, 'theme')
    check('Light theme affects the entire concept', p.locator('html').get_attribute('data-theme')=='light')
    p.screenshot(path=str(shots/'06-light-theme.png')); p.close()

    p=new(); scenario(p, 'missing-node'); act(p, 'create', scope='main'); act(p, 'wizard-next'); act(p, 'wizard-next')
    check('Missing Node blocks setup', 'Node is missing' in p.locator('#wizard-error').inner_text())
    act(p, 'restore-env'); act(p, 'wizard-next'); scenario(p, 'offline'); act(p, 'create', scope='main'); act(p, 'acquire')
    check('Offline acquisition reports failure', 'offline scenario' in p.locator('#wizard-error').inner_text())
    p.locator('[data-field="w-source"]').select_option('cache'); act(p, 'acquire'); act(p, 'wizard-next')
    check('Cached fixture is a separate acquisition route', p.evaluate('state.wizard.acquired && state.wizard.source==="cache"'))
    p.locator('[data-field="w-id"]').fill('shell-workbench'); act(p, 'wizard-next')
    check('Companion ID is protected', 'companion' in p.locator('#wizard-error').inner_text())
    p.locator('[data-field="w-id"]').fill('con'); act(p, 'wizard-next')
    check('Reserved device name rejected', 'reserved' in p.locator('#wizard-error').inner_text())
    p.locator('[data-field="w-id"]').fill('field-notes'); act(p, 'wizard-next'); act(p, 'wizard-next')
    check('Vault binding requires designation', 'designate' in p.locator('#wizard-error').inner_text()); p.close()

    p=new(); scenario(p, 'stale-plan'); review(p); act(p, 'setup')
    check('Stale plan revokes approval before run', p.evaluate('!state.wizard.plan && !state.wizard.approved && state.runs.length===0')); p.close()
    p=new(); scenario(p, 'install-failure'); review(p); act(p, 'setup'); wait(p)
    check('Dependency failure retains identity without deployment', p.evaluate('state.wizard.status==="failed" && state.wizard.completed.includes(1) && state.projects.length===0'))
    scenario(p, 'happy'); act(p, 'create', scope='main'); act(p, 'resume'); act(p, 'plan')
    p.locator('[data-field="w-approved"]').check(); act(p, 'setup'); wait(p)
    check('Reviewed resume keeps the failed receipt', p.evaluate('state.projects.length===1 && state.runs.some(r=>r.status==="failed") && state.runs[0].cmd.includes("--resume")')); p.close()
    p=new(); review(p); act(p, 'setup'); act(p, 'cancel-run')
    check('Cancellation is terminal and retains draft', p.evaluate('state.activeRun===null && state.wizard.status==="cancelled" && state.projects.length===0')); p.close()
    p=new(); act(p, 'sample', scope='main'); scenario(p, 'maker-conflict'); maker(p); act(p, 'maker-apply')
    check('Edited scaffold is never overwritten', p.evaluate('project().rev===1 && project().features.length===1') and 'Nothing was overwritten' in p.locator('#maker-error').inner_text())
    scenario(p, 'test-failure'); maker(p); act(p, 'maker-apply'); wait(p)
    check('Generated test failure preserves source', p.evaluate('project().features.length===2 && state.runs[0].status==="failed" && project().rev===2'))
    scenario(p, 'offline'); act(p, 'nav', 'quality', '#sidebar'); act(p, 'check', 'security'); act(p, 'check-confirm'); wait(p)
    check('Offline audit is failed, not clean', p.evaluate('project().quality.security.status==="failed"'))
    scenario(p, 'happy'); act(p, 'tour'); act(p, 'tour-next'); act(p, 'tour-pause'); act(p, 'tour')
    check('Tour resumes without running work', p.locator('#tour-title').inner_text()=='Generate, then review' and p.evaluate('state.activeRun===null'))
    p.keyboard.press('Escape'); act(p, 'nav', 'generate', '#sidebar')
    p.locator('[data-field="g-folder"]').fill('<img src=x onerror=alert(1)>')
    act(p, 'maker-preview'); act(p, 'file-preview', '1')
    check('User source text is escaped', p.locator('.code-body img').count()==0 and '<img' in p.locator('.code-body').inner_text()); p.close()

    p=new(storage=''); act(p, 'sample', scope='main'); act(p, 'theme')
    saved=p.evaluate('fixtureStore["shell-workbench-concept-v1"]'); p.close()
    p=new(storage=saved)
    check('Controlled Storage fixture rehydrates project', p.evaluate('state.projects.length===1 && state.settings.theme==="light"'))
    act(p, 'nav', 'projects', '#sidebar'); act(p, 'create', scope='main'); act(p, 'wizard-next')
    saved=p.evaluate('fixtureStore["shell-workbench-concept-v1"]'); p.close()
    p=new(storage=saved)
    check('Controlled Storage fixture rehydrates wizard', p.evaluate('state.wizard.step===1')); p.close()
    p=new(storage='{"schema":999}')
    check('Future state is preserved', p.evaluate('fixtureStore["shell-workbench-concept-v1"]===\'{"schema":999}\'') and 'preserved' in p.locator('#storage-status').inner_text()); p.close()
    p=new(storage='{"schema":1,"projects":[null]}')
    check('Malformed state falls back safely', p.locator('h1').inner_text().startswith('Less setup.')); p.close()
    for width,height in [(1024,768),(390,844)]:
        p=new(width=width,height=height)
        check(f'No document overflow at {width}px', p.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        if width<650:
            act(p, 'menu'); act(p, 'nav', 'quality', '#sidebar')
            check('Narrow navigation closes after selection', not p.locator('#sidebar').is_visible())
            act(p, 'create', scope='main')
            check('Narrow wizard fits viewport', p.locator('#modal').bounding_box()['width']<=width)
        p.screenshot(path=str(shots/f'07-responsive-{width}.png')); p.close()
    check('Zero console or page errors across tested routes', not errors)
    check('Zero network requests across tested routes', not requests)
    report={'scope':'embedded HTML concept; no native/runtime/backend qualification','browser':browser.version,'count':len(results),'tests':results,'errors':errors,'networkRequests':requests,'limitations':['File/loopback navigation blocked by managed policy; HTML injected with set_content.','Persistence tests use a controlled Storage stand-in.','No real Obsidian, CLI, filesystem, process or screen-reader qualification.']}
    Path(args.report).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':len(results),'browser':browser.version,'report':args.report}))
    browser.close()
