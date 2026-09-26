"""Product-audit regressions on the exact standalone concept; not native acceptance."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/product-audit'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""


def check(name, value, scope='Browser controls and canonical state readback'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name


def js(code):
    return page.evaluate(code)


def act(action, value=None, scope=''):
    selector = f'{scope} [data-action="{action}"]'.strip()
    if value is not None:
        selector += f'[data-value="{value}"]'
    page.locator(selector).first.click()


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
        page.keyboard.press('Tab')
        check('First keyboard stop is the visible skip-to-content link',
              js('document.activeElement.matches(".skip-link")') and page.locator('.skip-link').bounding_box()['y'] >= 0)
        page.keyboard.press('Enter')
        check('Skip link moves focus into the workspace', js('document.activeElement.id==="content"'))
        check('Keyboard bypass does not create a project', js('!project()'))
        shot('01-fresh.png')
        act('sample', scope='main')
        check('A sample without requirements points to an outcome rather than implying readiness',
              js('workflowNext().stage==="brief"') and 'No active requirements yet' in page.locator('.overview-facts').inner_text())
        check('Overview exposes optional findings without turning them into blockers',
              js('workflowFacts().warnings.length>0&&workflowFacts().blockers.length===0') and
              '0 blocking' in page.locator('.overview-detail').inner_text() and page.locator('.attention-severity').count() > 0)
        check('The complete findings list remains available', page.locator('.overview-detail [data-action="workflow-checks"]').count() == 1)
        shot('02-overview.png')
        destinations = {'semantic-folder': 'entities', 'data-source-shape': 'sources',
                        'requirement-component': 'prds', 'acceptance-missing': 'prds', 'component-version': 'components'}
        for code, route in destinations.items():
            check(f'{code} review opens its owning editor',
                  page.evaluate('(code)=>workflowIssueDestination({code}).value', code) == route, 'Issue routing fixture')
        check('Surface-specific issues retain their direct node destination',
              js('workflowIssueDestination({code:"orphan",node:"node-2"}).action==="workflow-node"'), 'Issue routing fixture')
        check('Unknown issues retain the full review fallback',
              js('workflowIssueDestination({code:"future-check"}).action==="workflow-checks"'), 'Issue routing fixture')
        for route, stage in [('sources', 'structure'), ('entities', 'structure'), ('designsystem', 'components'),
                             ('testdata', 'review'), ('prepare', 'build')]:
            page.evaluate('(route)=>setView(route)', route)
            check(f'{route} has one current workflow step',
                  page.locator('.workflow-rail [aria-current="step"]').count() == 1 and
                  page.locator('.workflow-rail [aria-current="step"]').get_attribute('data-value') == stage)
        js('setView("overview");showModal("palette")')
        page.keyboard.press('ArrowUp')
        check('Up from palette search selects the last result', js('document.activeElement===document.querySelector("#palette-results button:last-child")'))
        page.locator('#palette-search').focus()
        page.keyboard.press('ArrowDown')
        check('Down from palette search selects the first result', js('document.activeElement===document.querySelector("#palette-results button")'))
        page.locator('#palette-search').fill('no-such-action-91823')
        page.keyboard.press('ArrowUp')
        check('Empty palette remains keyboard-safe', js('document.activeElement.id==="palette-search"') and page.locator('.no-results').is_visible())
        page.keyboard.press('Escape')
        js('showModal("settings")')
        check('Preferences offers recovery before a storage failure', page.locator('#modal [data-action="storage-recovery"]').is_visible())
        page.keyboard.press('Control+k')
        page.wait_for_function('() => document.querySelector("#modal .dialog-feedback")?.textContent.includes("Finish or close")')
        check('Blocked actions are explained inside the active modal',
              page.locator('#modal .dialog-feedback').is_visible() and page.locator('#toasts').inner_text() == '')
        check('Modal feedback is polite and does not take focus',
              page.locator('#modal .dialog-feedback').get_attribute('role') == 'status' and not js('document.activeElement.matches(".dialog-feedback")'))
        shot('03-modal-feedback.png')
        js('notify("<img src=x onerror=alert(1)>")')
        page.wait_for_function('() => document.querySelector(".dialog-feedback")?.textContent.startsWith("<img")')
        check('Feedback renders untrusted text inertly', page.locator('.dialog-feedback img').count() == 0)
        act('storage-recovery', scope='#modal')
        check('Session export describes drafts and private data boundaries',
              'Unsubmitted form drafts are not included' in page.locator('#modal').inner_text() and
              json.loads(page.locator('#copy-text').input_value())['project']['design']['goal'] == js('design().goal'))
        js('closeModal();window.__before=__saved[STORAGE_KEY];__saved[STORAGE_KEY]="{newer-unsupported-data";save();showModal("settings")')
        act('storage-retained', scope='#modal')
        check('Retained export preserves raw newer or malformed bytes separately from the session',
              page.locator('#copy-text').input_value() == '{newer-unsupported-data' and js('__saved[STORAGE_KEY]==="{newer-unsupported-data"'))
        js('closeModal();showModal("reset")')
        act('reset-confirm', scope='#modal')
        check('Stale-session reset fails closed without deleting newer saved data',
              js('!!project()&&__saved[STORAGE_KEY]==="{newer-unsupported-data"&&storageWarning.startsWith("Reset blocked")'), 'Controlled storage race fixture')
        check('Blocked reset remains in the dialog with actionable feedback', page.locator('#modal').is_visible())
        shot('04-recovery.png')
        js('closeModal();__saved[STORAGE_KEY]=__before;storageWarning="";setView("sources")')
        act('ds-example')
        shot('05-sources.png')
        js('setView("testdata")')
        act('td-enable')
        check('Source opt-in produces multiple operation choices', page.locator('#td-operation option').count() >= 2)
        page.locator('#td-operation').focus()
        js('tdPaintSimulation()')
        check('Operation-panel redraw preserves selector focus', js('document.activeElement.id==="td-operation"'))
        op = page.locator('#td-operation option').nth(1).get_attribute('value')
        page.locator('#td-operation').select_option(op)
        check('Changing the operation preserves keyboard position and selected identity',
              js('document.activeElement.id==="td-operation"') and js('tdUi.operation') == op)
        js('window.__statusNode=document.getElementById("td-operation-status")')
        act('td-simulate')
        page.wait_for_function('() => !tdUi.busy&&tdUi.status.includes("completed")')
        check('Completed operation returns focus to Run without leaving the panel',
              js('document.activeElement.dataset.action==="td-simulate"'))
        check('Stable live status announces a summary, not the JSON payload',
              js('__statusNode===document.getElementById("td-operation-status")') and
              page.locator('#td-operation-status').inner_text() == 'Operation completed in memory. Inspect the result below.' and
              page.locator('#td-simulation-panel pre[role="status"]').count() == 0)
        # Explicit slow fixture exercises cancellation and focus, not a production service.
        js('const settings=designCopy(tdSettings());settings.recipes.forEach(r=>{r.scenario="slow";r.latencyMs=1000});tdCommit(settings);render()')
        act('td-simulate')
        check('A running operation focuses Cancel and locks its contract controls',
              js('tdUi.busy&&document.activeElement.dataset.action==="td-cancel"') and page.locator('#td-operation').is_disabled())
        act('td-cancel')
        page.wait_for_function('() => !tdUi.busy&&tdUi.status.includes("cancelled")')
        check('Cancellation is explicit and returns keyboard access to Run',
              js('document.activeElement.dataset.action==="td-simulate"') and not page.locator('#td-operation').is_disabled())
        act('td-simulate')
        page.locator('#sidebar [data-action="nav"]').first.focus()
        page.wait_for_function('() => !tdUi.busy')
        check('Async completion does not steal focus from outside the panel',
              js('!!document.activeElement.closest("#sidebar")'))
        js('project().vault=".qa-vault";render()')
        check('Retained nondefault target copy reflects the actual project setting',
              '.qa-vault' in page.locator('.td-workspace .callout').inner_text() and js('project().vault===".qa-vault"'))
        act('td-target')
        check('Target confirmation identifies the actual previous vault', '.qa-vault' in page.locator('#modal').inner_text())
        act('td-target-confirm', scope='#modal')
        check('Target switch preserves its declared-only boundary and identifies the old target',
              js('project().vault===vaultTestRoot()') and '.qa-vault files were not moved' in page.locator('#toasts').inner_text())
        shot('06-test-data.png')
        js('project().vault=vaultTestRoot();setView("designsystem")')
        act('sg-starter')
        act('sg-section', 'colors')
        check('Complete palette discloses the bounded three-pair assessment',
              'All 3 default pairs evaluated' in page.locator('.sg-contrast-coverage').inner_text())
        js('design().designSystem.colors=design().designSystem.colors.filter(c=>c.id!=="muted");render()')
        check('Missing default color keys disclose skipped checks rather than an all-pass impression',
              'Not evaluated: muted / background' in page.locator('.sg-contrast-coverage').inner_text())
        check('Markdown and HTML exports include the same incomplete-coverage disclosure',
              js('sgMarkdown(styleGuide()).includes("Not evaluated: muted / background")&&sgHtml(styleGuide()).includes("Not evaluated: muted / background")'), 'Exported string readback')
        page.locator('.sg-contrast').scroll_into_view_if_needed()
        shot('07-palette-coverage.png')
        js('design().designSystem=sgStarter();setView("overview");window.__designBeforeTour=designFingerprint(design());state.tourIndex=0;startTour()')
        for index in range(11):
            check(f'Tour step {index + 1} is reachable with its named heading and Next or Finish action',
                  page.locator('#tour #tour-title').inner_text() != '' and
                  page.locator('#tour [data-action="tour-next"]').is_visible())
            if index == 6:
                shot('08-tour.png')
            if index == 10:
                check('Final tour index remains a valid persisted state', js('validState(JSON.parse(JSON.stringify(state)))'), 'Full state validator')
            act('tour-next', scope='#tour')
        check('Completed tour closes without executing or changing the generation fingerprint',
              js('!activeTour&&!document.getElementById("tour").open&&!state.activeRun&&designFingerprint(design())===__designBeforeTour'))
        for width, theme in [(1440, 'dark'), (960, 'light'), (560, 'dark'), (390, 'light')]:
            page.set_viewport_size({'width': width, 'height': 900})
            page.evaluate('([theme])=>{state.settings.theme=theme;setView("overview")}', [theme])
            check(f'Overview at {width}px in {theme} stays within the viewport', js('document.documentElement.scrollWidth<=innerWidth'))
            check(f'Overview at {width}px keeps one primary heading', page.locator('main h1').count() == 1)
            if width <= 560:
                check(f'Next-step action at {width}px sits below readable copy, not alongside a squeezed column', js('''
                    (()=>{const text=document.querySelector('.next-task>.grow').getBoundingClientRect(),
                    button=document.querySelector('.next-task>.btn').getBoundingClientRect();
                    return button.top>=text.bottom&&text.width>=200;})()
                '''))
            shot(f'09-overview-{width}-{theme}.png')
        check('Exercised product-audit paths have no observed runtime errors or network requests', not errors and not requests)
    except Exception:
        fatal = traceback.format_exc()
        print(fatal, flush=True)
        shot('failure.png')
    finally:
        browser.close()
        report = {'scope': 'Exact HTML; Chromium with controlled Storage, actual input plus explicitly identified fixtures; no native or screen-reader certification',
                  'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(),
                  'passed': sum(c['result'] == 'passed' for c in checks), 'failed': sum(c['result'] == 'failed' for c in checks),
                  'fatal': fatal, 'checks': checks, 'errors': errors, 'requests': requests}
        (OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
if fatal or errors or requests or report['failed']:
    raise SystemExit(1)
