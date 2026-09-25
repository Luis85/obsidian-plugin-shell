"""Full project JSON round-trip and read-only shell handoff; no native acceptance."""
import hashlib
import json
import os
import subprocess
import tempfile
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
SEED = ROOT / 'docs/concepts/companion/companion-project.json'
OUT = ROOT / 'reports/concepts/project-transfer'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""


def check(name, value, scope='Browser interaction and canonical state readback'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name


def js(code, arg=None):
    return page.evaluate(code, arg)


def act(action, scope=''):
    page.locator(f'{scope} [data-action="{action}"]'.strip()).first.click()


def shot(name):
    page.screenshot(path=str(OUT / name))


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'),
                                 headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        check('Welcome offers the full companion project without creating one',
              page.locator('[data-action="project-example"]').count() == 1 and js('project()===null'))
        check('Welcome offers full project import before initialization', page.locator('[data-action="project-import"]').count() == 1)
        act('project-example')
        check('Bundled project opens a reviewed import, not an automatic replacement', js('project()===null && !!projectTransferUi.candidate'))
        check('Example contains 27 surfaces and 30 mapped requirements', js('projectTransferUi.candidate.design.nodes.length===27 && allRequirements(projectTransferUi.candidate.design).length===30'))
        check('Example includes ten project-owned components', js('projectTransferUi.candidate.design.library.filter(c=>c.origin==="project").length===10'))
        check('Example includes entities, source operations, recipes and design tokens', js('projectTransferUi.candidate.design.semantic.entities.length===11 && projectTransferUi.candidate.design.dataSources.sources[0].operations.length===3 && projectTransferUi.candidate.design.designSystem.colors.length===5'))
        check('Bundled companion design has no structural blockers', js('designIssues(projectTransferUi.candidate.design).filter(i=>i.level==="error").length===0'))
        act('project-import-apply')
        check('Confirmation is required before importing', js('project()===null') and 'confirm' in page.locator('#project-transfer-error').inner_text())
        act('close', '#modal')
        check('Cancel preserves the empty workspace', js('project()===null'))
        act('project-example')
        shot('01-companion-import-review.png')
        page.locator('#project-import-confirm').check(); act('project-import-apply')
        check('Confirmed example loads exactly one project', js('project().id==="plugin-companion" && !Object.hasOwn(state,"projects")'))
        check('Example loading does not prepare or trust a plugin', js('project().phase==="planning" && !project().trusted && !project().enabled && !state.wizard'))
        check('Source and test folder defaults are src and tests', js('JSON.stringify(companionFolders())===JSON.stringify(COMPANION_DEFAULT_FOLDERS)'))
        check('Imported state meets existing persistence validators', js('validState(state)'))
        check('Bundled JSON artifact matches the executable seed definition', json.loads(js('companionJson(companionExampleProject())')) == json.loads(SEED.read_text()))
        original = js('companionJson()')
        check('First import/export round trip preserves every portable field', json.loads(original) == json.loads(SEED.read_text()))
        shot('02-companion-project-overview.png')
        act('project-export', '#content')
        check('Full project export is distinct from a recovery snapshot', js('JSON.parse(modalData.text).kind==="obsidian-companion-project" && !JSON.parse(modalData.text).vaultKey'))
        with page.expect_download() as event:
            act('download-text', '#modal')
        download = event.value; download.save_as(str(OUT / 'project.companion.json'))
        check('Actual JSON download has the project filename', download.suggested_filename == 'plugin-companion.companion.json')
        check('Actual download contains the complete document', (OUT / 'project.companion.json').read_text() == original)
        with tempfile.TemporaryDirectory(prefix='companion-browser-cli-') as tmp:
            vault = Path(tmp) / 'vault'; vault.mkdir(); (vault / 'keep.md').write_text('preserve')
            run = subprocess.run(['node', str(ROOT / 'scripts/companion/generate.mjs'), '--input', str(OUT / 'project.companion.json'),
                                  '--vault', str(vault), '--target', 'plugins/companion'], capture_output=True, timeout=15)
            check('Shell v1 consumes the actual browser export and prints exact bytes', run.returncode == 0 and run.stdout == original.encode() and not run.stderr, 'Actual CLI subprocess on exported browser bytes')
            check('Shell handoff creates no files or target directory', list(vault.iterdir()) == [vault / 'keep.md'] and (vault / 'keep.md').read_text() == 'preserve', 'Actual isolated filesystem before/after')
        act('close', '#modal'); act('settings'); act('project-folders', '#modal')
        check('Folder settings start with the current defaults', page.locator('#f-project-codebase-folder').input_value() == 'src')
        page.locator('#f-project-codebase-folder').fill('../outside'); act('project-folders-save')
        check('Invalid folder leaves saved settings unchanged', js('companionFolders().codebaseFolder==="src"') and 'relative' in page.locator('#project-folders-error').inner_text())
        page.locator('#f-project-codebase-folder').fill('app/src'); page.locator('#f-project-tests-folder').fill('APP/src/tests'); act('project-folders-save')
        check('Overlapping folders are rejected without state mutation', 'overlap' in page.locator('#project-folders-error').inner_text() and js('companionFolders().testsFolder==="tests"'))
        page.locator('#f-project-tests-folder').fill('app/tests'); shot('03-folder-settings.png'); act('project-folders-save')
        check('Custom folder settings are saved together', js('companionFolders().codebaseFolder==="app/src" && companionFolders().testsFolder==="app/tests"'))
        check('Custom folder settings are retained by browser persistence', js('JSON.parse(__saved[STORAGE_KEY]).project.folders.codebaseFolder==="app/src"'))
        check('Reload validation accepts folder settings', js('validState(JSON.parse(__saved[STORAGE_KEY]))'))
        custom = json.dumps(json.loads(js('companionJson()')), separators=(',', ':'))
        check('Full export carries custom folders', json.loads(custom)['settings'] == {'codebaseFolder': 'app/src', 'testsFolder': 'app/tests'})
        act('settings'); act('project-folders', '#modal'); page.locator('#f-project-codebase-folder').fill('abandoned')
        act('close', '#modal')
        check('Dirty folder draft asks before discard', page.locator('#discard-dialog').is_visible())
        page.locator('#discard-confirm').click()
        check('Discard changes only the draft', js('companionFolders().codebaseFolder==="app/src"'))
        # Explicit fixtures put the current project in a prepared state. Imported data
        # still must never inherit this session's authority or fabricated test pass.
        js('project().trusted=true;project().enabled=true;project().phase="prepared";project().quality.verify={rev:project().rev,status:"passed"};save();')
        check('Portable export omits trust, paths, generated files and execution receipts', js('!Object.hasOwn(companionProjectDocument().project,"trusted") && !Object.hasOwn(companionProjectDocument().project,"root") && !Object.hasOwn(companionProjectDocument().design,"emitted")'))
        act('project-import', '#content')
        page.locator('#project-import-text').fill(custom); act('project-import-review')
        check('Pasted JSON is reviewed without replacing current authority', js('project().trusted && !!projectTransferUi.candidate'))
        before = js('companionProjectToken()'); act('project-import-apply')
        check('Existing project requires the replacement checkbox', js('companionProjectToken()') == before)
        page.locator('#project-import-confirm').check(); act('project-import-apply')
        check('Import clears trust, preparation and simulated passes', js('!project().trusted && !project().enabled && project().phase==="planning" && Object.keys(project().quality).length===0'))
        check('Customized export survives paste-import-export with full fidelity', json.loads(js('companionJson()')) == json.loads(custom))
        act('project-import', '#content')
        page.locator('#project-import-file').set_input_files(str(SEED)); page.locator('#project-import-summary').wait_for()
        check('Actual file input is parsed and reviewed', js('projectTransferUi.candidate.id==="plugin-companion"') and 'companion-project.json' in page.locator('#modal').inner_text())
        check('Reviewing a file does not replace current folders', js('companionFolders().codebaseFolder==="app/src"'))
        page.locator('#project-import-confirm').check(); act('project-import-apply')
        check('Confirmed file import restores its own settings', js('companionFolders().codebaseFolder==="src"'))
        check('File-import/export round trip preserves every authored subsystem', json.loads(js('companionJson()')) == json.loads(SEED.read_text()))
        act('project-import', '#content')
        page.locator('#project-import-file').set_input_files({'name': 'oversized.json', 'mimeType': 'application/json', 'buffer': b' ' * 4_000_001})
        check('Oversized actual file selection is rejected before replacement', js('!projectTransferUi.candidate') and '4 MB' in page.locator('#project-transfer-error').inner_text())
        js('void readCompanionImportFile({name:"slow.json",size:20,arrayBuffer:()=>new Promise(resolve=>{window.finishOldFile=resolve})})')
        act('close', '#modal'); act('settings')
        js('(text)=>{finishOldFile(new TextEncoder().encode(text).buffer)}', SEED.read_text())
        check('Late file completion cannot replace a closed import or reopen it', js('modalType==="settings" && projectTransferUi.candidate===null && project().id==="plugin-companion"'))
        act('project-import', '#modal')
        for label, value in [('Malformed JSON', '{'), ('Recovery snapshot', json.dumps({'schema': 2, 'project': {}})),
                             ('Future format', json.dumps({**json.loads(SEED.read_text()), 'schemaVersion': 99})),
                             ('Host path', json.dumps({**json.loads(SEED.read_text()), 'settings': {'codebaseFolder': '.obsidian/plugins', 'testsFolder': 'tests'}})),
                             ('Unsafe nested key', json.dumps({**json.loads(SEED.read_text()), '__proto__': {}}))]:
            prior = js('companionProjectToken()'); page.locator('#project-import-text').fill(value); act('project-import-review')
            check(label + ' is rejected before mutation', js('!projectTransferUi.candidate') and js('companionProjectToken()') == prior and bool(page.locator('#project-transfer-error').inner_text()))
        page.locator('#project-import-text').fill(json.dumps(json.loads(SEED.read_text()))); act('project-import-review')
        js('project().description="Changed after review";save();'); page.locator('#project-import-confirm').check(); act('project-import-apply')
        check('Stale project review cannot replace newer local edits', js('project().description==="Changed after review"') and 'changed' in page.locator('#project-transfer-error').inner_text())
        act('project-import-review')
        check('Explicit re-review refreshes a stale local review without applying it', js('!!projectTransferUi.candidate && project().description==="Changed after review"'))
        js('modalOriginal=null'); act('close', '#modal')
        act('project-import', '#content'); page.locator('#project-import-text').fill(json.dumps(json.loads(SEED.read_text()))); act('project-import-review')
        js('window.originalStorage=__saved[STORAGE_KEY];__saved[STORAGE_KEY]="newer-window-data";'); page.locator('#project-import-confirm').check(); act('project-import-apply')
        check('Storage conflict blocks import and preserves both sessions', js('__saved[STORAGE_KEY]==="newer-window-data" && project().description==="Changed after review"'))
        js('__saved[STORAGE_KEY]=window.originalStorage;storageWarning="";modalOriginal=null'); act('close', '#modal')
        act('project-import', '#content'); page.locator('#project-import-text').fill(json.dumps(json.loads(SEED.read_text()))); act('project-import-review')
        js('window.normalSet=localStorage.setItem;localStorage.setItem=()=>{throw Error("quota")};void 0;'); page.locator('#project-import-confirm').check(); act('project-import-apply')
        check('Failed persistence rolls back the replacement in memory', js('project().description==="Changed after review" && __saved[STORAGE_KEY]===window.originalStorage'))
        js('localStorage.setItem=window.normalSet;storageWarning="";modalOriginal=null'); act('close', '#modal')
        js('tdUi.busy=true'); act('project-import', '#content')
        check('Active test operations block replacement', js('!document.getElementById("modal").open'))
        js('tdUi.busy=false'); act('settings'); act('project-example', '#modal'); page.locator('#project-import-confirm').check(); act('project-import-apply')
        page.locator('[data-action="nav"][data-value="prepare"]').first.click(); act('project-handoff')
        check('Handoff explicitly says v1 returns JSON and writes nothing', 'Version 1 returns the supplied JSON only' in page.locator('#modal').inner_text())
        check('Handoff shows CLI input, vault and target arguments', all(flag in page.locator('#modal').inner_text() for flag in ['--input', '--target', '--vault']))
        shot('04-shell-handoff.png'); act('close', '#modal')
        for view in ['sitemap', 'entities', 'sources', 'components', 'testdata', 'designsystem', 'prds']:
            page.locator(f'[data-action="nav"][data-value="{view}"]').first.click()
            check('Companion self-project renders ' + view, js('state.view') == view and bool(page.locator('#content').inner_text()))
            if view in ['sitemap', 'entities']:
                shot('05-' + view + '.png')
        for width, theme in [(960, 'light'), (390, 'dark')]:
            page.set_viewport_size({'width': width, 'height': 900}); js('(theme)=>{state.settings.theme=theme;setView("overview")}', theme)
            check('Overview fits ' + str(width) + 'px', js('document.documentElement.scrollWidth<=innerWidth'))
            js('openCompanionImport(true)')
            check('Import controls fit ' + str(width) + 'px', js('document.getElementById("modal").getBoundingClientRect().right<=innerWidth'))
            shot('06-import-' + str(width) + '.png'); act('close', '#modal')
        check('No page or console errors in exercised routes', not errors)
        check('No unexpected network requests', not requests)
    except Exception:
        fatal = traceback.format_exc(); print(fatal)
        try: shot('failure.png')
        except Exception: pass
    finally:
        browser.close()
report = {'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'checks': checks,
          'errors': errors, 'requests': requests, 'fatal': fatal,
          'scope': 'Actual browser inputs plus explicitly controlled Storage fixtures and isolated read-only Node CLI. Not native Obsidian.'}
(OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result'] != 'passed' for c in checks) else 0)
