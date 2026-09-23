"""Concept-only regression checks for the reconciled content workspace.
Runs the exact self-contained HTML in an already provisioned Chromium. No real
CLI, vault, package installation or application-server operation is performed.
"""
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/reconciliation'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None

def check(name, condition, scope='browser interaction'):
    checks.append({'name': name, 'result': 'passed' if condition else 'failed', 'scope': scope})
    assert condition, name
    print('PASS', name, flush=True)

def act(p, name, value=None, scope=''):
    q = f'{scope} [data-action="{name}"]'
    if value is not None:
        q += f'[data-value="{value}"]'
    p.locator(q.strip()).first.click()

def js(p, code):
    return p.evaluate(code)

def edit(p):
    p.locator('.map-node[data-node="node-2"] .map-card-title').click()
    act(p, 'ref-content', 'node-2', '#ref-node-toolbar')
    p.wait_for_selector('.ref-editor')

def canonical(p):
    return js(p, 'JSON.stringify(design().nodes.find(n=>n.id==="node-2"))')

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    def new(width=1600, height=1000, theme='light'):
        p = browser.new_page(viewport={'width': width, 'height': height}, accept_downloads=True)
        p.set_default_timeout(6000)
        p.on('pageerror', lambda e: errors.append(str(e)))
        p.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        p.on('request', lambda r: requests.append(r.url))
        p.set_content(HTML.read_text())
        act(p, 'sample', scope='main')
        p.evaluate('(t)=>{state.settings.theme=t;render();}', theme)
        if width < 650:
            act(p, 'menu')
        act(p, 'nav', 'sitemap', '#sidebar')
        p.wait_for_selector('.vue-flow__node')
        p.wait_for_timeout(150)
        return p
    p = None
    try:
        p = new()
        check('Reconciled concept preserves five example surfaces', p.locator('.vue-flow__node').count() == 5)
        check('Malformed canvas state is rejected without throwing', js(p, '[null,3,"bad",[]].every(value=>validCanvas(value)===false)'), 'model validation fixture')
        edit(p)
        saved = canonical(p)
        revision = js(p, 'design().revision')
        first = js(p, 'referenceUi.content.bricks[0].id')
        body = p.locator('#ref-body-' + first)
        body.fill('Draft that must not be committed by a hidden keyboard shortcut.')
        act(p, 'close', scope='#modal')
        check('Closing a dirty draft opens explicit protection', p.locator('#discard-dialog').is_visible())
        p.keyboard.press('Control+Enter')
        check('Control Enter cannot save underneath discard confirmation', canonical(p) == saved and js(p, 'design().revision') == revision and p.locator('#discard-dialog').is_visible())
        p.keyboard.press('Meta+Enter')
        check('Command Enter cannot save underneath discard confirmation', canonical(p) == saved and p.locator('#discard-dialog').is_visible())
        p.locator('#discard-keep').click()
        check('Keeping edits restores the same draft text', 'hidden keyboard shortcut' in body.input_value())
        p.locator('#ref-title-' + first).fill(' ')
        act(p, 'ref-content-save')
        check('Blank name validation focuses the exact field', js(p, 'document.activeElement.id') == 'ref-title-' + first and p.locator('#ref-title-' + first).get_attribute('aria-invalid') == 'true')
        check('Validation failure retains every draft and saved value', canonical(p) == saved and 'hidden keyboard shortcut' in body.input_value())
        p.locator('#ref-title-' + first).fill('Find the right note')
        check('Correcting invalid input removes obsolete field error', p.locator('#ref-title-' + first).get_attribute('aria-invalid') is None and p.locator('#ref-content-error').inner_text() == '')
        body.fill('Three words here')
        check('Content count updates while typing', p.locator('#ref-count-' + first).inner_text().startswith('16 /'))
        check('No editor controls become invisible through opacity', p.locator('.ref-format-toolbar').nth(1).evaluate('(e)=>getComputedStyle(e).opacity') == '1')
        before_remove = js(p, 'JSON.stringify(referenceUi.content.bricks)')
        act(p, 'ref-block-remove', first)
        check('Removal advertises local Undo and leaves saved screen alone', p.locator('#ref-draft-recovery').is_visible() and canonical(p) == saved)
        act(p, 'ref-editor-library')
        act(p, 'ref-editor-preview')
        check('Undo removal survives the library-preview transition', p.locator('#ref-draft-recovery').is_visible())
        act(p, 'ref-block-restore')
        check('Undo remove restores exact instance identity, text and order', js(p, 'JSON.stringify(referenceUi.content.bricks)') == before_remove)
        # Exercise removing every block through the UI, not a model shortcut.
        while p.locator('.ref-write-block').count():
            act(p, 'ref-block-remove')
        check('Removing final block exposes useful empty state', p.locator('.ref-empty-content').is_visible() and p.locator('.ref-mini-empty').is_visible())
        act(p, 'ref-block-restore')
        check('Last removed block is recoverable in an empty draft', p.locator('.ref-write-block').count() == 1 and not p.locator('#ref-draft-recovery').is_visible())
        remaining = js(p, 'referenceUi.content.bricks[0].id')
        p.locator('#ref-body-' + remaining).fill('Content preserved for manual reconciliation.')
        # Explicit fixture simulates an external canonical revision, not native CAS.
        p.evaluate('design().revision++')
        act(p, 'ref-content-save')
        check('Concurrent revision refuses save and focuses recovery', canonical(p) == saved and js(p, 'document.activeElement.id') == 'ref-content-error', 'controlled concurrent-revision fixture')
        with p.expect_download() as download:
            act(p, 'ref-draft-export')
        exported = json.loads(Path(download.value.path()).read_text())
        check('Explicit draft export retains unsaved wording and stable surface', exported['kind'] == 'screen-content-draft' and exported['surface'] == 'node-2' and exported['blocks'][0]['content'] == 'Content preserved for manual reconciliation.')
        check('Draft export has no process, vault or host-path payload', set(exported) == {'schema','kind','surface','label','sourceRevision','blocks'} and canonical(p) == saved)
        p.screenshot(path=str(OUT / '01-draft-recovery.png'))
        act(p, 'close', scope='#modal'); p.locator('#discard-confirm').click()
        edit(p)
        first = js(p, 'referenceUi.content.bricks[0].id')
        limit = js(p, 'BRICK_LIMITS.content')
        body = p.locator('#ref-body-' + first)
        body.fill('x' * limit)
        body.select_text()
        act(p, 'ref-format', first + ':bold')
        check('Formatting over the limit explains failure without dropping text', body.input_value() == 'x' * limit and 'exceed the content limit' in p.locator('#ref-content-error').inner_text())
        # beforeunload browser protection: inspect cancellation of a synthetic event.
        check('Dirty content requests browser unload protection', js(p, '(()=>{const e=new Event("beforeunload",{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()'), 'synthetic beforeunload event')
        act(p, 'close', scope='#modal'); p.locator('#discard-confirm').click()
        check('Closed clean editor does not block unload', not js(p, '(()=>{const e=new Event("beforeunload",{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented})()'), 'synthetic beforeunload event')
        p.locator('.map-node[data-node="node-2"] .map-card-title').click()
        p.locator('.ref-arrange-popover summary').click()
        p.keyboard.press('Escape')
        check('Escape closes Arrange without losing selected screen', not p.locator('.ref-arrange-popover').evaluate('(e)=>e.open') and js(p, 'designUi.selected') == 'node-2')
        p.locator('.ref-arrange-popover summary').click()
        p.locator('.ref-zoom-dock').click(position={'x':4,'y':4})
        check('Pointer outside closes Arrange without consuming navigation', not p.locator('.ref-arrange-popover').evaluate('(e)=>e.open'))
        # New before/after insertion model: explicit model check, plus actual drag
        # evidence is in the reference and retained-graph suites.
        edit(p)
        order = js(p, 'referenceUi.content.bricks.map(b=>b.id)')
        p.evaluate('([a,b])=>moveReferenceBlock(a,0,b,false)', order[:2])
        check('Dropping already preceding block before target is a no-op', js(p, 'referenceUi.content.bricks.map(b=>b.id)') == order, 'model insertion fixture')
        p.evaluate('([a,b])=>moveReferenceBlock(a,0,b,true)', order[:2])
        check('Dropping after target produces expected reading order', js(p, 'referenceUi.content.bricks.map(b=>b.id)') == [order[1], order[0], *order[2:]], 'model insertion fixture')
        p.screenshot(path=str(OUT / '02-content-editor.png'))
        p.close()
        for width, height, theme in [(1600,1000,'light'),(1024,850,'dark'),(390,844,'dark')]:
            p = new(width,height,theme)
            if width < 650:
                act(p,'canvas-outline')
                p.locator('#map-search').fill('collection')
                act(p,'ref-reveal','node-2'); act(p,'ref-panel-close',scope='.outline-tree')
                act(p,'canvas-focus',scope='.ref-zoom-dock')
            edit(p)
            check(f'Content footer fits {width}px {theme} viewport', p.locator('.ref-editor-footer').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}'))
            check(f'No document overflow at {width}px {theme}', js(p, 'document.documentElement.scrollWidth<=innerWidth'))
            p.screenshot(path=str(OUT / f'03-editor-{width}-{theme}.png'))
            p.close()
        check('No observed page or console errors', not errors, 'browser observation')
        check('No observed network requests', not requests, 'browser observation')
    except Exception as exc:
        fatal = str(exc)
        print('FAIL', fatal, flush=True)
        if p and not p.is_closed():
            p.screenshot(path=str(OUT / 'failure.png'))
    finally:
        browser.close()
        (OUT / 'checks.json').write_text(json.dumps({
            'scope':'Browser concept; model and synthetic events are labeled separately',
            'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),
            'checks':checks,'passed':sum(c['result']=='passed' for c in checks),
            'failed':sum(c['result']=='failed' for c in checks),
            'fatal':fatal,'errors':errors,'requests':requests
        },indent=2)+'\n')
if fatal:
    raise SystemExit(1)
