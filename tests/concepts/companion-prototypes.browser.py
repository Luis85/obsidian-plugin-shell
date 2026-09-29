"""Real authoring UI: isolated A/B snapshots, activation, checkpoints and portable exports."""
import hashlib
import json
import os
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'reports/companion-mvp'
HTML = OUT / 'index.html'
results, errors, requests = [], [], []
dialog_replies = []

def handle_dialog(dialog):
    if dialog_replies and not dialog_replies.pop(0):
        dialog.dismiss()
    else:
        dialog.accept()


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    results.append(name)


def workspace(page):
    return page.evaluate('structuredClone(project().prototypes)')


def action(page, name):
    page.locator('#pm-root [data-pm="' + name + '"]').first.click()
    if name == 'open':
        expect(page.locator('#pm-root')).to_have_count(0)
        expect(page.locator('#jm-root')).to_be_visible()
    else:
        expect(page.locator('#pm-root')).not_to_have_attribute('aria-busy', 'true')


def create_form(page, kind, values):
    action(page, kind)
    for key, value in values.items():
        page.locator('.pm-form [name="' + key + '"]').fill(value)
    page.locator('.pm-form button[type=submit]').click()
    expect(page.locator('.pm-form')).to_have_count(0)


def select(page, index):
    page.locator('#pm-root [data-index="' + index + '"]').click()


def manage(page):
    page.locator('#sidebar [data-value="prototypes"]').click()
    expect(page.locator('#pm-root h1')).to_have_text('Manage prototypes')


def export(page, kind, filename):
    with page.expect_download() as pending:
        action(page, kind)
    path = OUT / filename
    pending.value.save_as(path)
    return path


def run(page):
    page.goto(HTML.as_uri())
    # Import a real built-in through the actual existing import UI, not a substituted project store.
    page.locator('[data-action="project-import"]').first.click()
    page.locator('#project-import-file').set_input_files(ROOT / 'docs/concepts/companion/starters/quick-capture.companion.json')
    expect(page.locator('#project-import-summary')).to_be_visible()
    page.locator('#project-import-confirm').check()
    page.locator('[data-action="project-import-apply"]').click()
    seed = page.evaluate('companionProjectDocument()')
    manage(page)
    expect(page.locator('[data-pm=generate]')).to_be_disabled()
    create_form(page, 'create', {'id': 'exploration', 'name': 'Product exploration', 'description': 'Sitemap A versus B'})
    a = workspace(page)['prototypes'][0]['versions'][0]['variants'][0]['document']
    check('new prototype captures the complete canonical working project', a == seed)
    check('new workspace never silently activates its first variant', workspace(page)['active'] is None)
    # A rejected form must preserve user input and give keyboard focus to its error.
    action(page, 'fork')
    page.locator('.pm-form [name=id]').fill('main')
    page.locator('.pm-form [name=name]').fill('Duplicate draft kept')
    page.locator('.pm-form [name=hypothesis]').fill('This must survive validation')
    before_error = workspace(page)
    page.locator('.pm-form button[type=submit]').click()
    expect(page.locator('.pm-message[role=alert]')).to_be_focused()
    expect(page.locator('.pm-form [name=name]')).to_have_value('Duplicate draft kept')
    expect(page.locator('.pm-form [name=hypothesis]')).to_have_value('This must survive validation')
    check('rejected form preserves its values and never writes a partial variant', workspace(page) == before_error)
    dialog_replies.append(False)
    page.locator('[data-index="0,0,0"]').click()
    expect(page.locator('.pm-form [name=name]')).to_have_value('Duplicate draft kept')
    check('dismissing the navigation guard preserves the unsubmitted form', workspace(page) == before_error)
    action(page, 'cancel')
    create_form(page, 'fork', {'id': 'sitemap-b', 'name': 'Sitemap B', 'hypothesis': 'A different first destination'})
    action(page, 'open')
    expect(page.locator('#jm-root')).to_be_visible()
    expect(page.locator('.jm-context [role=status]')).to_contain_text('Saved project')
    page.locator('.jm-lensbar').get_by_role('button', name='Outline', exact=True).click()
    target = next(n for n in a['design']['nodes'] if n['kind'] == 'page')
    page.locator('.jm-tree button').filter(has_text=target['label']).first.click()
    expect(page.locator('#jm-name')).to_have_value(target['label'])
    page.locator('#jm-name').fill('Variant B dashboard')
    page.get_by_role('button', name='Save name', exact=True).click()
    page.get_by_role('button', name='Edit route', exact=True).click()
    page.locator('#jm-route').fill('/variant-b-dashboard')
    page.locator('.jm-dialog').get_by_role('button', name='Apply', exact=True).click()
    expect(page.locator('.jm-dialog')).to_have_count(0)
    b = page.evaluate('companionProjectDocument()')
    manage(page)
    select(page, '0,0,1')
    check('opening and editing B leaves both saved snapshots and activation unchanged', workspace(page)['active'] is None and all(v['document'] == a for v in workspace(page)['prototypes'][0]['versions'][0]['variants']))
    action(page, 'save')
    saved = workspace(page)
    check('explicit draft save isolates B from A and retains full mock data', saved['prototypes'][0]['versions'][0]['variants'][0]['document'] == a and saved['prototypes'][0]['versions'][0]['variants'][1]['document'] == b and b['design']['dataSources'] == a['design']['dataSources'])
    before_compare = workspace(page)
    action(page, 'compare')
    page.locator('[data-pm-comparison]').select_option('exploration/v1/main')
    expect(page.locator('.pm-comparison')).to_contain_text('/design/sitemap')
    expect(page.locator('.pm-comparison')).to_contain_text('/variant-b-dashboard')
    check('comparison reveals real sitemap differences without writes', workspace(page) == before_compare)
    page.locator('[data-pm-query]').fill('Sitemap B')
    page.locator('[data-pm-query]').press('Home')
    page.locator('[data-pm-query]').press('ArrowRight')
    page.locator('[data-pm-query]').press('x')
    check('typing into the middle of a search preserves caret position', page.locator('[data-pm-query]').input_value() == 'Sxitemap B' and page.locator('[data-pm-query]').evaluate('(element)=>element.selectionStart') == 2)
    page.locator('[data-pm-query]').fill('Sitemap B')
    expect(page.locator('.pm-row')).to_have_count(1)
    expect(page.locator('.pm-row')).to_have_attribute('data-key','exploration/v1/sitemap-b')
    page.locator('[data-pm-status]').select_option('active')
    expect(page.locator('.pm-list')).to_contain_text('No matching variants')
    check('search and status filters preserve all saved data and the selected detail', workspace(page) == before_compare and 'Sitemap B' in page.locator('.pm-title h2').inner_text())
    action(page, 'reset-filter')
    action(page, 'compare')
    create_form(page, 'prototype-details', {'name':'Product alternatives','description':'Compare the first destination'})
    create_form(page, 'version-details', {'label':'Design exploration'})
    check('display metadata updates retain portable IDs and snapshot contents', workspace(page)['prototypes'][0]['id'] == 'exploration' and workspace(page)['prototypes'][0]['versions'][0]['variants'][1]['document'] == b)
    select(page, '0,0,0')
    action(page, 'review')
    expect(page.locator('[data-pm=save]')).to_be_disabled()
    action(page, 'approved')
    action(page, 'activate')
    pinned = json.loads(export(page, 'generate', 'prototypes-active-a.json').read_text())
    check('export uses pinned A while working copy is still B', pinned == a and page.evaluate('companionProjectDocument()') == b)
    expect(page.locator('[data-pm=archive]')).to_be_disabled()
    expect(page.locator('[data-pm=save]')).to_be_disabled()
    select(page, '0,0,1')
    action(page, 'approved')
    action(page, 'activate')
    current = workspace(page)
    statuses = [v['status'] for v in current['prototypes'][0]['versions'][0]['variants']]
    check('activation explicitly switches to B and demotes A', statuses == ['approved', 'active'] and current['active']['variantId'] == 'sitemap-b')
    page.reload()
    manage(page)
    check('actual browser persistence retains all versions, variants and activation', workspace(page) == current)
    bundle = export(page, 'export', 'prototypes-workspace.json')
    check('workspace JSON export is lossless', json.loads(bundle.read_text()) == current)
    action(page, 'import')
    page.locator('.pm-import').set_input_files(bundle)
    expect(page.locator('.pm-message')).to_contain_text('Workspace imported')
    check('real workspace import round trip preserves the active source', workspace(page) == current)
    folders = export(page, 'directory', 'prototypes-folders.zip')
    with zipfile.ZipFile(folders) as archive:
        check('folder export uses the required prototype root', set(archive.namelist()) == {'docs/concepts/prototypes.json', 'docs/concepts/exploration/prototype.json', 'docs/concepts/exploration/versions/v1/variants/main/project.json', 'docs/concepts/exploration/versions/v1/variants/sitemap-b/project.json'})
        manifest = json.loads(archive.read('docs/concepts/exploration/prototype.json'))
        for v in manifest['item']['versions'][0]['variants']:
            check('manifest pins exact ' + v['id'] + ' snapshot bytes', hashlib.sha256(archive.read(v['document']['path'])).hexdigest() == v['document']['sha256'])
    select(page, '0,0,1')
    action(page, 'seal')
    expect(page.locator('[data-pm=fork]')).to_be_disabled()
    create_form(page, 'version', {'id': 'v2'})
    newer = workspace(page)
    check('new version retains sealed v1 and copies complete editable drafts', newer['prototypes'][0]['versions'][0]['sealed'] and all(v['status'] == 'draft' for v in newer['prototypes'][0]['versions'][1]['variants']) and newer['active']['versionId'] == 'v1')
    select(page, '0,1,1')
    action(page, 'compare')
    page.locator('[data-pm-comparison]').select_option('exploration/v1/main')
    before_restore = workspace(page)
    working_before = page.evaluate('companionProjectDocument()')
    action(page, 'restore-snapshot')
    restored = workspace(page)
    recovery = next(v for v in restored['prototypes'][0]['versions'] if v['id'] == 'recovery-1')
    check('restore retains full previous draft in a sealed recovery version', recovery['sealed'] and recovery['variants'][0]['document'] == before_restore['prototypes'][0]['versions'][1]['variants'][1]['document'])
    check('restore changes only saved draft, never working copy or active generator selection', restored['active'] == before_restore['active'] and page.evaluate('companionProjectDocument()') == working_before and restored['prototypes'][0]['versions'][1]['variants'][1]['document'] == a)
    page.locator('[data-pm-comparison]').select_option('exploration/recovery-1/sitemap-b')
    action(page, 'restore-snapshot')
    check('recovery checkpoint can restore the previous draft without destroying history', workspace(page)['prototypes'][0]['versions'][1]['variants'][1]['document'] == b and len(workspace(page)['prototypes'][0]['versions']) == 4)
    page.screenshot(path=str(OUT / 'prototypes-polish-dark.png'), full_page=True)
    page.evaluate("document.documentElement.dataset.theme='light'")
    page.screenshot(path=str(OUT / 'prototypes-polish-light.png'), full_page=True)
    action(page, 'compare')
    create_form(page, 'create', {'id': 'onboarding', 'name': 'Onboarding exploration'})
    check('multiple prototypes coexist in the same project', len(workspace(page)['prototypes']) == 2)
    action(page, 'archive')
    check('archival retains all prototype data', workspace(page)['prototypes'][1]['archived'] and len(workspace(page)['prototypes'][1]['versions']) == 1)
    action(page, 'archive')
    action(page, 'deactivate')
    expect(page.locator('[data-pm=generate]')).to_be_disabled()
    check('deactivation blocks managed export without deleting snapshots', workspace(page)['active'] is None and len(workspace(page)['prototypes']) == 2)
    page.screenshot(path=str(OUT / 'prototypes-workspace.png'), full_page=True)
    check('no uncaught browser errors', not errors)
    check('prototype management is offline', not requests)


OUT.mkdir(parents=True, exist_ok=True)
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})
        page.on('dialog', handle_dialog)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('file:') else (requests.append(route.request.url), route.abort())[1])
        run(page)
        browser.close()
finally:
    (OUT / 'prototypes-browser.json').write_text(json.dumps({'htmlSha256': hashlib.sha256(HTML.read_bytes()).hexdigest(), 'assertions': results, 'errors': errors, 'externalRequests': requests}, indent=2) + '\n')
print(f'Passed {len(results)} prototype management browser assertions')
