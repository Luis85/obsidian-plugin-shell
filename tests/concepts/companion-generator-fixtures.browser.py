"""Actual prototype export -> reviewed shell generation -> runnable recipes, in a disposable vault."""
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
OUT = ROOT / 'reports/concepts/generator-fixtures'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""


def check(name, value):
    checks.append({'name': name, 'result': 'passed' if value else 'failed',
                   'scope': 'Actual browser controls, downloaded bytes and real CLI in disposable vault; simulated browser Storage'})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name


def command(args, cwd=ROOT):
    run = subprocess.run(['node', *args], cwd=cwd, capture_output=True, text=True, timeout=45)
    assert run.returncode == 0, run.stderr + run.stdout
    return json.loads(run.stdout)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.on('request', lambda request: requests.append(request.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        page.locator('[data-action="project-example"]').click()
        page.locator('#project-import-confirm').check()
        page.locator('[data-action="project-import-apply"]').click()
        page.locator('#content [data-action="project-export"]').first.click()
        with page.expect_download() as download:
            page.locator('#modal [data-action="download-text"]').click()
        exported = OUT / 'project.companion.json'
        download.value.save_as(str(exported))
        check('Actual download retains the authored source recipes', json.loads(exported.read_text())['design']['dataSources']['testing']['recipes'])
        page.locator('#modal [data-action="close"]').first.click()
        page.locator('#sidebar [data-action="nav"][data-value="testdata"]').click()
        page.locator('[data-action="td-preview"]').click()
        preview = page.evaluate('tdUi.preview')
        check('Prototype preview produces canonical metadata for entity notes', bool(preview) and all('"schema_version": 1' in f['content'] for f in preview['generated']['files'] if f['path'].endswith('.md')))
        with tempfile.TemporaryDirectory(prefix='companion-generator-browser-') as temporary:
            vault = Path(temporary)
            keep = vault / 'keep.md'
            keep.write_text('Unrelated note')
            args = [str(ROOT / 'shell.mjs'), 'generate', '--input', str(exported), '--vault', str(vault), '--target', 'implementation']
            plan = command(args)
            check('Real generator accepts downloaded browser bytes without conflicts', plan['mode'] == 'plan' and not plan['conflicts'])
            check('Planning creates no implementation directory or vault data', list(vault.iterdir()) == [keep])
            result = command(args + ['--apply', plan['planHash']])
            target = vault / 'implementation'
            check('Exact reviewed approval produces the independent source project', result['mode'] == 'applied' and (target / 'src/main.ts').is_file())
            manifest = json.loads((target / 'scripts/test-data/manifest.json').read_text())
            check('Browser preview and generated manifest agree exactly', manifest == preview['manifest'])
            fixture_plan = command(['scripts/test-data/cli.mjs', 'plan'], target)
            check('Generated fixture planning neither seeds notes nor installs dependencies', not fixture_plan['blockers'] and not (target / '.test-vault').exists() and not (target / 'node_modules').exists())
            verified = command(['scripts/test-data/verify.mjs'], target)
            check('The independently generated recipe engine verifies the browser fixture inventory', verified['status'] == 'fixture-contracts-verified' and verified['files'] == len(preview['generated']['files']))
            check('Connected native repositories include inbound restriction dependencies', 'GDesignToken' in (target / 'src/generated/bootstrap/relationships.ts').read_text())
            check('Generation leaves unrelated notes and native acceptance unchanged', keep.read_text() == 'Unrelated note' and verified['nativeAcceptance'] == 'not-run')
        check('The browser makes no network requests or console/page errors', not requests and not errors)
    except Exception as error:
        fatal = str(error)
        traceback.print_exc()
    finally:
        browser.close()

(OUT / 'checks.json').write_text(json.dumps({'checks': checks, 'errors': errors, 'requests': requests, 'fatal': fatal,
    'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'nativeAcceptance': 'not-run'}, indent=2) + '\n')
raise SystemExit(0 if checks and not fatal and not errors and not requests and all(c['result'] == 'passed' for c in checks) else 1)
