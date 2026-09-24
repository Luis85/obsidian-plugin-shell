"""Single-project product journey on the exact offline concept.
Real DOM actions with explicitly named controlled persistence/collision fixtures.
No native Obsidian APIs, template acquisition or filesystem writes are exercised.
"""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/single-vault'
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'shell-workbench-single-vault-v2'
LEGACY = 'shell-workbench-concept-v1'
checks, errors, requests = [], [], []
fatal = None


def check(name, value, scope='DOM interaction and rendered state'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS' if value else 'FAIL'), name, flush=True)
    assert value, name


def act(page, action, value=None, scope='#modal'):
    selector = f'{scope} [data-action="{action}"]'
    if value is not None:
        selector += f'[data-value="{value}"]'
    page.locator(selector.strip()).first.click()


def js(page, expression):
    return page.evaluate(expression)


def stored_script(values):
    return '<script>window.__vaultStorage=' + json.dumps(values) + ''';
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:key=>Object.hasOwn(__vaultStorage,key)?__vaultStorage[key]:null,
        setItem:(key,value)=>{__vaultStorage[key]=String(value)},
        removeItem:key=>{delete __vaultStorage[key]}
      }});</script>'''


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])

    def new(values=None, width=1440):
        page = browser.new_page(viewport={'width': width, 'height': 1050}, accept_downloads=True)
        page.set_default_timeout(8000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('request', lambda r: requests.append(r.url))
        page.set_content(stored_script(values or {}) + HTML.read_text())
        return page

    def sample():
        page = new()
        act(page, 'sample', scope='main')
        return page

    def ready_plan(page):
        # Reach the reviewed preparation stage through real buttons, not by
        # manufacturing a successful setup or an approved plan in saved state.
        act(page, 'vault-prepare', scope='main') if page.locator('main [data-action="vault-prepare"]').count() else js(page, 'dispatch("vault-prepare")')
        for _ in range(2):
            act(page, 'wizard-next')
        act(page, 'acquire')
        act(page, 'wizard-next')
        page.locator('[data-field="w-author"]').fill('Example author')
        act(page, 'wizard-next')
        page.locator('[data-field="w-bound"]').check()
        act(page, 'wizard-next')
        page.locator('[data-field="w-trusted"]').check()
        act(page, 'plan')

    p = None
    try:
        p = new()
        check('A fresh vault starts on one project overview, without a selected-project collection', js(p, 'state.schema===2&&state.view==="overview"&&state.project===null&&!["projects","activeId","designDraft"].some(k=>Object.hasOwn(state,k))'))
        check('No project picker, attach action or new-project list remains', p.locator('[data-action="switch"],[data-action="attach"],[data-action="select-project"]').count() == 0)
        check('The opened vault is visible before initialization', '/workspace/plugin-workspace' in p.locator('main').inner_text())
        p.screenshot(path=str(OUT / 'empty-vault.png'))
        js(p, 'state.scenario="missing-node"')
        act(p, 'vault-init', scope='main')
        p.locator('[data-field="vault-name"]').fill('Research Notes')
        p.locator('[data-field="vault-id"]').fill('research-notes')
        p.locator('[data-field="vault-description"]').fill('Keep research outcomes linked to sources.')
        act(p, 'vault-save')
        check('The project can be defined with no Node and no author yet', js(p, 'project().name==="Research Notes"&&project().phase==="planning"&&state.scenario==="missing-node"&&project().author===""'))
        check('Design initialization does not acquire a template or invent runtime evidence', js(p, 'state.wizard===null&&state.runs.length===0&&project().builtRev===0&&project().installedRev===0&&!project().enabled&&!project().trusted&&Object.keys(project().quality).length===0&&!Object.hasOwn(state.vaultFiles,"package.json")'))
        check('Project.md previews stable frontmatter and a relative source root', js(p, 'state.vaultFiles["Project.md"].includes("type: obsidian-plugin-project")&&state.vaultFiles["Project.md"].includes("source_root: \\\".\\\"")&&project().key==="vault-project"'))
        js(p, 'dispatch("vault-record")')
        check('The proposed project record is inspectable without starting preparation', 'source_root: "."' in p.locator('#copy-text').input_value() and js(p, 'state.wizard===null'))
        act(p, 'close')
        key = js(p, 'project().key')
        for view in ['components', 'patterns', 'blueprints']:
            act(p, 'nav', view, '#sidebar')
        check('Design workspaces remain available before toolchain preparation', js(p, 'state.view==="blueprints"&&state.runs.length===0&&project().key') == key)
        act(p, 'blueprint-choose', 'document-manager', 'main')
        act(p, 'blueprint-apply', 'document-manager')
        p.wait_for_selector('.vue-flow__node')
        js(p, 'design().goal="Preserved planning goal";designChanged();window.__designBefore=JSON.stringify(designSnapshot(design()));window.__projectBefore=project();')
        check('Choosing a blueprint changes the same project, not its root or identity', js(p, 'project().key===__projectBefore.key&&project().root===vaultRoot()&&state.runs.length===0'))
        js(p, 'dispatch("vault-prepare")')
        act(p, 'wizard-next')
        act(p, 'wizard-next')
        check('Missing Node blocks preparation, not the retained design', js(p, 'state.wizard.step===1&&project()===__projectBefore&&JSON.stringify(designSnapshot(design()))===__designBefore') and 'unavailable' in p.locator('#wizard-error').inner_text())
        act(p, 'close')
        raw = js(p, 'localStorage.getItem(STORAGE_KEY)')
        p.close()
        p = new({KEY: raw})
        check('Reload resumes the single planning project and blocked wizard without approvals', js(p, 'project().key==="vault-project"&&project().name==="Research Notes"&&state.wizard.step===1&&state.wizard.plan===null&&!state.wizard.approved&&design().goal==="Preserved planning goal"'))
        before = js(p, 'JSON.stringify(state.project)')
        for action in ['sample', 'attach', 'select-project', 'switch']:
            p.evaluate('(action)=>dispatch(action,"other-project")', action)
        check('Legacy launcher actions cannot replace or add a project', js(p, 'JSON.stringify(state.project)') == before)
        js(p, 'dispatch("check-confirm","verify");dispatch("maker-apply");dispatch("enable-demo",project().id)')
        check('Unprepared runtime actions cannot produce fake verification or activation', js(p, 'state.runs.length===0&&!project().enabled&&Object.keys(project().quality).length===0'))
        p.close()
        p = sample()
        js(p, 'state.vaultFiles["project/Research.md"]="Preserve research";state.vaultFiles["Notes.md"]="Preserve personal note";window.__before=JSON.stringify(designSnapshot(design()));window.__p=project();')
        ready_plan(p)
        check('Preparation uses this vault as root and the contained test vault as a different context', js(p, 'state.wizard.root===vaultRoot()&&state.wizard.vault===vaultTestRoot()&&state.wizard.vault!==state.wizard.root'))
        check('Neither source nor test target is an editable path field', p.locator('[data-field="w-root"],[data-field="w-vault"],[data-field="w-config"]').count() == 0)
        check('Review lists additive changes and existing owned project identity', js(p, 'state.wizard.plan.changes.some(f=>f.path==="package.json"&&f.status==="create")&&state.wizard.plan.changes.find(f=>f.path==="Project.md").status==="unchanged"'))
        check('Template plan excludes host configuration, Git metadata and design notes', js(p, 'state.wizard.plan.changes.every(f=>!protectedVaultPath(f.path))'))
        check('The review explains that this is not a real template manifest', 'not a real template manifest' in p.locator('#modal').inner_text())
        p.screenshot(path=str(OUT / 'preparation-plan.png'))
        js(p, 'state.vaultFiles["package.json"]="Existing source — preserve";preparePlan()')
        check('An occupied template destination is displayed as a conflict', js(p, 'state.wizard.plan.changes.find(f=>f.path==="package.json").status==="conflict"'))
        check('A conflicting plan cannot be approved through the primary action', p.locator('#modal [data-action="setup"]').is_disabled())
        js(p, 'state.wizard.approved=true;beginSetup()')
        check('Direct dispatch also refuses conflicting writes', js(p, 'state.activeRun===null&&state.vaultFiles["package.json"]==="Existing source — preserve"&&state.runs.length===0'))
        js(p, 'delete state.vaultFiles["package.json"];state.vaultFiles["SRC"]="File at directory destination";preparePlan()')
        check('Case-insensitive file-directory collisions fail before any writes', js(p, 'state.wizard.plan.changes.find(f=>f.path==="src/main.ts").status==="conflict"'), 'controlled path-collision fixture')
        js(p, 'delete state.vaultFiles["SRC"];preparePlan();state.wizard.approved=true;design().goal="Newer planning edit";designChanged();beginSetup()')
        check('A design edit after preparation review invalidates approval without overwriting', js(p, 'state.activeRun===null&&!state.wizard.approved&&state.wizard.plan===null&&design().goal==="Newer planning edit"'), 'controlled stale-review fixture')
        js(p, 'preparePlan();state.wizard.approved=true;state.wizard.plan.changes[0].path=".obsidian/unsafe.json";beginSetup()')
        check('A modified plan cannot authorize a protected destination', js(p, 'state.activeRun===null&&!Object.hasOwn(state.vaultFiles,".obsidian/unsafe.json")'), 'controlled tampered-plan fixture')
        js(p, 'preparePlan()')
        p.locator('[data-field="w-approved"]').check()
        js(p, 'window.__finalDesign=JSON.stringify(designSnapshot(design()))')
        act(p, 'setup')
        p.wait_for_function('() => state.wizard.status==="succeeded"')
        check('Preparation completes on the same singleton object and exact design', js(p, 'project()===__p&&project().phase==="prepared"&&JSON.stringify(designSnapshot(design()))===__finalDesign'))
        check('The companion installation and all existing notes survive preparation', js(p, 'state.vaultFiles[".obsidian/plugins/shell-workbench/manifest.json"]===freshVaultFiles()[".obsidian/plugins/shell-workbench/manifest.json"]&&state.vaultFiles["project/Research.md"]==="Preserve research"&&state.vaultFiles["Notes.md"]==="Preserve personal note"'))
        check('Successful setup does not imply generated-plugin enablement or native evidence', js(p, '!project().enabled&&!project().quality.native&&!project().quality.browser&&project().builtRev===project().rev'))
        act(p, 'finish')
        js(p, 'window.__files=JSON.stringify(state.vaultFiles);window.__runs=state.runs.length;dispatch("vault-prepare")')
        check('Repeated preparation cannot create another project or reinitialize source', js(p, 'project()===__p&&JSON.stringify(state.vaultFiles)===__files&&state.runs.length===__runs&&state.wizard===null'))
        act(p, 'nav', 'overview', '#sidebar')
        p.screenshot(path=str(OUT / 'prepared-project.png'))
        old = js(p, 'JSON.parse(JSON.stringify(project()))')
        old['root'] = '/old/external/project'
        other = json.loads(json.dumps(old))
        other['name'], other['id'] = 'Other saved project', 'other-saved'
        original = json.dumps({'schema': 1, 'projects': [old, other]})
        p.close()
        p = new({LEGACY: original})
        check('Legacy multi-project data requires explicit one-outline selection', p.locator('[data-action="vault-legacy"]').count() == 1 and js(p, 'project()===null'))
        act(p, 'vault-legacy', scope='main')
        p.locator('#legacy-choice').select_option('1')
        with p.expect_download() as download:
            act(p, 'vault-legacy-export')
        check('The original multi-project workspace can be exported byte for byte', Path(download.value.path()).read_text() == original)
        act(p, 'vault-legacy-adopt')
        check('Exactly the chosen design is rebound to the current vault', js(p, 'project().name==="Other saved project"&&project().root===vaultRoot()&&project().vault===vaultTestRoot()&&project().key==="vault-project"'))
        check('Migration drops old execution authority and results, not design content', js(p, 'project().phase==="planning"&&!project().trusted&&!project().enabled&&project().installedRev===0&&state.runs.length===0&&Object.keys(project().quality).length===0&&design().generatedRevision===0&&design().goal==="Newer planning edit"'))
        check('Migration leaves the complete legacy storage untouched', js(p, 'localStorage.getItem(LEGACY_STORAGE_KEY)') == original)
        raw = js(p, 'localStorage.getItem(STORAGE_KEY)')
        p.close()
        malformed = json.loads(raw)
        malformed['project']['root'] = '/different/vault'
        p = new({KEY: json.dumps(malformed)})
        check('Stored source-root substitution fails closed and preserves the original bytes', js(p, 'project()===null&&storageWarning.includes("preserved")&&localStorage.getItem(STORAGE_KEY).includes("/different/vault")'), 'controlled invalid-storage fixture')
        p.close()
        p = new()
        js(p, 'state.vaultFiles["project.MD"]="Handwritten existing record";dispatch("vault-init")')
        act(p, 'vault-save')
        check('Case-aliased project metadata blocks initialization without overwriting the note', js(p, 'project()===null&&state.vaultFiles["project.MD"]==="Handwritten existing record"&&!Object.hasOwn(state.vaultFiles,"Project.md")') and 'already exists' in p.locator('#vault-form-error').inner_text(), 'controlled existing-note fixture, real identity form')
        p.close()

        p = sample()
        js(p, 'dispatch("vault-init");window.__identity=projectIdentity(project());state.vaultFiles["Project.md"]+="\\nHandwritten change"')
        p.locator('[data-field="vault-name"]').fill('Changed display name')
        act(p, 'vault-save')
        check('An external Project.md edit invalidates an open identity form', js(p, 'projectIdentity(project())===__identity&&state.vaultFiles["Project.md"].includes("Handwritten change")') and 'changed' in p.locator('#vault-form-error').inner_text(), 'controlled concurrent-note fixture, real form save')
        p.close()

        p = sample()
        ready_plan(p)
        p.locator('[data-field="w-approved"]').check()
        act(p, 'setup')
        js(p, 'clearTimeout(runTimer);state.vaultFiles["project/decisions/race.md"]="External decision";tickVaultSetup();clearTimeout(runTimer)')
        check('Mid-run external edits stop preparation without deleting either the design or external change', js(p, 'state.wizard.status==="failed"&&project().phase==="planning"&&state.vaultFiles["project/decisions/race.md"]==="External decision"&&design().nodes.length>0'), 'controlled inter-stage external edit; real run state machine')
        p.close()

        p = sample()
        ready_plan(p)
        p.locator('[data-field="w-approved"]').check()
        act(p, 'setup')
        js(p, 'clearTimeout(runTimer);tickVaultSetup();clearTimeout(runTimer);tickVaultSetup();clearTimeout(runTimer);window.__partial=JSON.stringify(state.vaultFiles)')
        act(p, 'cancel-run')
        check('Cancellation after staged file writes preserves the same project and its completed changes', js(p, 'state.wizard.status==="cancelled"&&project().phase==="planning"&&state.activeRun===null&&JSON.stringify(state.vaultFiles)===__partial&&Object.hasOwn(state.vaultFiles,"package.json")'), 'controlled stage advancement; real cancellation button')
        p.close()

        p = sample()
        ready_plan(p)
        js(p, 'state.scenario="install-failure"')
        p.locator('[data-field="w-approved"]').check()
        act(p, 'setup')
        p.wait_for_function('() => state.wizard.status==="failed"')
        check('An installation failure retains the project, design and added files', js(p, 'project().phase==="planning"&&!!state.vaultFiles["package.json"]&&design().nodes.length>0&&state.runs[0].status==="failed"&&!project().quality.verify'))
        js(p, 'state.scenario="happy"')
        act(p, 'resume')
        act(p, 'plan')
        check('Resume re-plans existing identical files as unchanged', js(p, 'state.wizard.plan.changes.every(f=>f.status==="unchanged")'))
        p.locator('[data-field="w-approved"]').check()
        act(p, 'setup')
        p.wait_for_function('() => state.wizard.status==="succeeded"')
        check('Reviewed resume succeeds without a second project and retains the failed run', js(p, 'project().key==="vault-project"&&project().phase==="prepared"&&state.runs.length===2&&state.runs[1].status==="failed"'))
        act(p, 'finish')
        act(p, 'nav', 'sitemap', '#sidebar')
        p.wait_for_selector('.vue-flow__node')
        js(p, 'dispatch("reset")')
        act(p, 'reset-confirm')
        check('Reset unmounts the graph before removing its project owner', js(p, 'state.project===null&&!flowUi.app&&state.view==="overview"'))
        p.close()
        p = new(width=390)
        check('The single-vault empty state fits a narrow pane without horizontal overflow', js(p, 'document.documentElement.scrollWidth<=innerWidth'))
        act(p, 'vault-init', scope='main')
        check('Identity and primary actions are reachable in a narrow pane', p.locator('[data-field="vault-name"]').is_visible() and p.locator('[data-action="vault-save"]').is_visible())
        p.screenshot(path=str(OUT / 'narrow-identity.png'))
        p.locator('[data-field="vault-name"]').fill('Unsaved local name')
        act(p, 'close')
        check('Close protects unsaved project identity edits', p.locator('#discard-dialog').evaluate('e=>e.open'))
        p.locator('#discard-keep').click()
        check('Keep editing retains the identity draft and does not initialize', p.locator('[data-field="vault-name"]').input_value() == 'Unsaved local name' and js(p, 'project()===null'))
        check('All exercised single-vault paths have no runtime errors or requests', not errors and not requests)
    except Exception:
        fatal = traceback.format_exc()
        print(fatal, flush=True)
        if p:
            p.screenshot(path=str(OUT / 'failure.png'))
    finally:
        browser.close()
        report = {'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'checks': checks, 'errors': errors, 'requests': requests, 'fatal': fatal}
        (OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
if fatal or errors or requests or any(c['result'] != 'passed' for c in checks):
    raise SystemExit(1)
