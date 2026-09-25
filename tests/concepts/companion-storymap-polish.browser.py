"""Exercise Storymaps review, fast entry, references, navigation and read-only safeguards."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/storymap-polish'
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks, errors, requests = [], [], []
fatal = None


def check(name, value, scope='Actual controls with canonical model readback'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name


def js(code, arg=None):
    return page.evaluate(code, arg)


def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()


def nav(view):
    if not page.locator('#sidebar').is_visible():
        page.locator('[data-action="menu"]').first.click()
    act('nav', view, '#sidebar')


def save():
    act('sm-save', scope='#modal')
    page.wait_for_function('() => !document.getElementById("modal").open')


def shot(name):
    page.screenshot(path=str(OUT / name))


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('project-example'); page.locator('#project-import-confirm').check(); act('project-import-apply', scope='#modal')
        nav('storymaps'); original = js('smStore().maps[0].id'); act('sm-open', original)
        page.wait_for_selector('#sm-flow .sm-card')
        check('Initial map prioritizes the canvas rather than an empty inspector', page.locator('.sm-editor').get_attribute('data-details') == 'closed')
        before = js('companionJson()'); serial = js('smUi.serial')
        page.locator('#sm-itemQuery').fill('acceptance notes')
        check('Searching inside a map does not remount Vue Flow', js('smUi.serial') == serial)
        check('Matching stories have named locate controls', page.locator('.sm-find-result').count() >= 1)
        check('Search preserves all saved stories and coordinates remain transient', js('companionJson()') == before)
        page.locator('#sm-itemQuery').fill('definitely absent story')
        check('Empty search explains recovery without removing the map', 'No saved stories were removed' in page.locator('#sm-find-results').inner_text() and page.locator('.sm-card-story').count() == 5)
        act('sm-find-clear')
        first_release = js('smCurrentMap().releases[0].id'); page.locator('#sm-releaseFilter').select_option(first_release)
        check('Release search lists only the selected slice', page.locator('.sm-find-result').count() == 3)
        page.locator('#sm-findingFilter').select_option('acceptance')
        check('Review filters compose with release selection', page.locator('.sm-find-result').count() == 3)
        act('sm-mode', 'outline')
        check('Outline filtering retains activity and step context', page.locator('.sm-outline-story[data-sm-item]').count() == 3 and page.locator('.sm-outline-activity h2').first.inner_text() == 'Shape the plugin experience')
        check('Search and representation switches are read-only', js('companionJson()') == before)
        act('sm-find-clear'); act('sm-mode', 'map')
        story_id = js('smCurrentMap().stories.find(s=>s.requirements.length).id')
        act('sm-find-item', story_id) if page.locator(f'[data-action="sm-find-item"][data-value="{story_id}"]').count() else act('sm-select', story_id)
        check('Selecting a card reveals its details', page.locator('.sm-editor').get_attribute('data-details') == 'open')
        page.locator('#sm-itemQuery').fill('definitely absent story')
        check('Selection outside search results is explained and retained', 'Selected story is outside' in page.locator('#sm-find-results').inner_text() and js('smUi.item') == story_id)
        act('sm-find-clear')
        page.locator('#sm-inspector [data-action="sm-details"]').click()
        check('Closing details restores focus to its toolbar control', js('document.activeElement?.dataset.action') == 'sm-details')
        act('sm-details'); page.locator('#sm-itemQuery').fill('existing screens')
        js('productUi.requirementSearch="a stale search that hides every requirement"')
        act('sm-requirement', scope='#sm-inspector')
        check('Requirement links reveal the exact target despite an earlier PRD search', js('state.view==="prds" && productUi.requirementSearch===""') and js('document.activeElement?.dataset.action') == 'product-requirement-edit')
        act('sm-return-map')
        check('Returning from a requirement restores map selection and filters', js('smUi.item') == story_id and page.locator('#sm-itemQuery').input_value() == 'existing screens')
        act('sm-find-clear'); act('sm-surface', scope='#sm-inspector')
        check('Linked sitemap opens the shared target and offers return navigation', js('state.view==="sitemap"') and page.locator('[data-action="sm-return-map"]').count() > 0)
        act('sm-return-map')
        check('Sitemap round-trip preserves story identity', js('smUi.item') == story_id)
        act('dt-page', scope='#sm-inspector'); act('dt-back')
        check('Page editor integration and Back retain the same map', js('state.view==="storymaps" && smUi.map===' + json.dumps(original)))
        before = js('companionJson()'); act('sm-mode', 'review')
        check('Review lists actionable missing acceptance notes', page.locator('.sm-review-list li').count() >= 5)
        check('Release review explicitly distinguishes scope from completion', 'not a completion score' in page.locator('.sm-review').inner_text())
        check('Review does not author findings or grant readiness', js('companionJson()') == before)
        act('sm-repair', story_id)
        check('Repair opens the exact referenced story rather than creating a copy', js('smUi.form.id') == story_id and page.locator('#sm-title').input_value() == js('smItem(smCurrentMap(),smUi.form.id).record.title'))
        page.locator('#sm-requirementQuery').fill('no requirement matches')
        check('Requirement picker reports selections outside the search', '1 selected outside this search' in page.locator('.sm-reference-picker').last.inner_text())
        act('close', scope='#modal')
        check('Picker searches alone never cause a discard prompt', not page.locator('#modal').is_visible() and not page.locator('#discard-dialog[open]').count())
        act('sm-mode', 'map'); step_id = js('smCurrentMap().steps[0].id')
        act('sm-add', 'story:' + step_id + ':' + first_release)
        act('sm-save', scope='#modal')
        check('Blank title is explained at the focused field without losing the draft', page.locator('#sm-title').get_attribute('aria-invalid') == 'true' and js('document.activeElement.id') == 'sm-title')
        page.locator('#sm-title').fill('First fast-entry story')
        check('Correcting the title clears its invalid-field state immediately', page.locator('#sm-title').get_attribute('aria-invalid') is None)
        count = js('smCurrentMap().stories.length'); act('sm-save-another', scope='#modal')
        check('Save and add another commits exactly one story', js('smCurrentMap().stories.length') == count + 1)
        check('Next story keeps step and release but not content or links', js('smUi.form.record.stepId') == step_id and js('smUi.form.record.releaseId') == first_release and page.locator('#sm-title').input_value() == '' and js('smUi.form.record.requirements.length===0 && smUi.form.record.surfaces.length===0'))
        check('The next unsubmitted story remains a clean draft', js('formCheckpoint()===modalOriginal'))
        page.locator('#sm-title').fill('Second fast-entry story'); page.locator('#sm-title').press('Control+Enter')
        page.wait_for_function('() => !document.getElementById("modal").open')
        check('Keyboard submission saves the second story exactly once', js('smCurrentMap().stories.length') == count + 2)
        page.wait_for_function('() => document.activeElement?.dataset.action === "sm-select"')
        check('Save returns focus to the saved story', js('document.activeElement.dataset.value') == js('smUi.item'))
        # Controlled source deletion fixture: the product must keep unresolved references.
        js('''() => { const s=smCurrentMap().stories[0];smCommit(store=>{store.maps[0].stories[0].surfaces.push({id:"missing-screen",label:"<img src=x onerror=alert(1)>"})});render(); }''')
        check('Missing references have a visible card indicator', page.locator('.sm-has-missing').count() == 1)
        act('sm-mode', 'review')
        check('Missing-target review escapes authored labels', page.locator('.sm-review img').count() == 0 and '<img src=x' in page.locator('.sm-review').inner_text())
        act('sm-repair', js('smCurrentMap().stories[0].id')); page.locator('[data-field="sm-surfaceRef"][data-key="missing-screen"]').click(); save()
        check('Repair removes only the explicitly unlinked target', js('!smCurrentMap().stories[0].surfaces.some(r=>r.id==="missing-screen")'))
        act('sm-overview'); act('sm-archive', original); page.locator('#sm-statusFilter').select_option('all'); act('sm-open', original)
        archived = js('companionJson()')
        check('Archived map has restore, not metadata-edit controls', page.locator('[data-action="sm-map-edit"]').count() == 0 and page.locator('[data-action="sm-archive"]').count() == 1)
        act('sm-mode', 'review')
        check('Review remains available on archived maps without repair writes', page.locator('.sm-review').count() == 1 and page.locator('.sm-review [data-action="sm-repair"]:enabled').count() == 0)
        rejected = js('''() => {try {smCommit(store=>store.maps[0].purpose="overwrite archive");return false;}catch(e){return e.message.includes("Restore");}}''')
        check('Canonical transaction rejects alternate archived-metadata writes', rejected and js('companionJson()') == archived, 'Controlled stale/alternate command fixture')
        nav('prds'); act('sm-prd-links', js('selectedPrd().id'))
        check('PRD link editor locks archived map choices', page.locator(f'[data-field="sm-mapRef"][data-key="{original}"]').is_disabled())
        act('close', scope='#modal'); nav('storymaps'); act('sm-open', original); act('sm-archive', original)
        check('Restore enables editing without replacing the map', js('smCurrentMap().status==="draft"') and page.locator('[data-action="sm-map-edit"]').count() == 1)
        # Token conflict, persistence rollback and pause guards remain enforced.
        act('sm-map-edit'); page.locator('#sm-title').fill('A still-unsaved title')
        js('smCommit(store=>{store.maps[0].purpose+=" Intervening saved change."})'); snapshot = js('companionJson()'); act('sm-save', scope='#modal')
        check('Concurrent semantic edit rejects stale Save and retains entered title', 'changed during this edit' in page.locator('#sm-form-error').inner_text() and page.locator('#sm-title').input_value() == 'A still-unsaved title' and js('companionJson()') == snapshot)
        act('close', scope='#modal'); page.locator('#discard-confirm').click()
        check('Discarding a stale draft leaves no misleading page error', not page.locator('#sm-page-error').inner_text())
        js('state.activeRun="controlled-pause-fixture";render()')
        check('Active project operation visibly pauses map authoring', page.locator('[data-action="sm-add"]:enabled').count() == 0 and page.locator('[data-action="sm-history"]:enabled').count() == 0 and 'Editing is paused' in page.locator('.sm-notice').inner_text(), 'Controlled active-run state; real disabled controls')
        js('state.activeRun=null;render()')
        check('Test-data busy guard rejects writes before mutation', js('''() => {tdUi.busy=true;try{smCanWrite();return false;}catch(e){return e.message.includes("current operation");}finally{tdUi.busy=false;}}'''), 'Controlled test-data command guard; navigation cancels that session')
        act('sm-mode', 'review'); act('sm-add', 'activity'); page.locator('#sm-title').fill('Review structural repair'); save()
        activity_id = js('smCurrentMap().activities.at(-1).id')
        act('sm-add', 'step:' + activity_id, '.sm-review'); page.locator('#sm-title').fill('A review-created step'); save()
        new_step = js('smCurrentMap().steps.at(-1).id'); act('sm-add', 'story:' + new_step, '.sm-review')
        check('Structural findings open the missing child creation directly', js('smUi.form.kind === "story" && smUi.form.record.stepId === ' + json.dumps(new_step)))
        act('close', scope='#modal'); act('sm-history', 'undo'); act('sm-history', 'undo')
        act('sm-map-edit'); page.locator('#sm-purpose').fill('A long outcome with explicit user intent. ' * 25); save()
        check('Long outcomes disclose their full saved content on demand', page.locator('.sm-long-purpose').count() == 1 and not page.locator('.sm-long-purpose').get_attribute('open'))
        page.locator('.sm-long-purpose summary').click()
        check('Expanded outcomes preserve the full authored text', len(page.locator('.sm-long-purpose p').inner_text()) > 800)
        act('sm-history', 'undo')
        # Batch visual and geometry checks across the shipped concept representations.
        for width, theme, mode in [(1440, 'dark', 'map'), (1440, 'light', 'review'), (960, 'dark', 'review'), (390, 'dark', 'outline')]:
            page.set_viewport_size({'width': width, 'height': 1000 if width > 600 else 900})
            js('([theme,mode])=>{state.settings.theme=theme;smUi.mode=mode;smUi.details=false;render();}', [theme, mode])
            if mode == 'map': page.wait_for_selector('#sm-flow .sm-card')
            check(f'Polished {mode} fits {width}px {theme}', js('document.documentElement.scrollWidth<=innerWidth'))
            shot(f'{width}-{theme}-{mode}.png')
        act('sm-edit', js('smCurrentMap().stories[0].id'))
        check('Narrow story form keeps Save and Cancel inside the viewport', js('''() => [...document.querySelectorAll('#modal [data-action="sm-save"],#modal [data-action="close"]')].every(e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth && r.left>=0;})'''))
        shot('390-story-form.png'); act('close', scope='#modal')
        act('sm-add', 'story:' + step_id)
        check('Narrow fast entry keeps every footer action within the dialog', js('''() => [...document.querySelectorAll('#modal .dialog-footer .btn')].length>0 && [...document.querySelectorAll('#modal .dialog-footer .btn')].every(e=>{const r=e.getBoundingClientRect();return r.right<=innerWidth && r.left>=0;})'''))
        shot('390-create-story.png'); act('close', scope='#modal'); act('sm-overview')
        check('Narrow overview has no page-level or table-level horizontal scroll', js('document.documentElement.scrollWidth<=innerWidth && document.querySelector(".sm-table-scroll").scrollWidth<=document.querySelector(".sm-table-scroll").clientWidth'))
        shot('390-overview.png')
        check('No page or console errors occurred', not errors)
        check('No network requests occurred', not requests)
    except Exception:
        fatal = traceback.format_exc(); print(fatal)
        try: shot('failure.png')
        except Exception: pass
    finally:
        browser.close()
report = {'html_sha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'checks': checks, 'errors': errors, 'requests': requests, 'fatal': fatal,
          'scope': 'Actual UI controls, keyboard, layout and model readback, plus labeled alternate-command/storage fixtures. Memory Storage is not actual-origin or native persistence evidence.'}
(OUT / 'checks.json').write_text(json.dumps(report, indent=2) + '\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result'] != 'passed' for c in checks) else 0)
