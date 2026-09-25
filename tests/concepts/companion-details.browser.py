"""Page/component editors: actual controls, gestures and scoped failure fixtures."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/details'
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks, errors, requests, fatal = [], [], [], None

def check(name, value, scope='Actual browser controls and canonical model readback'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name

def js(code, arg=None): return page.evaluate(code, arg)
def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def field(key):
    if key == 'props' and not page.locator('[data-field="dt-props"]').is_visible():
        page.locator('.dt-advanced-props > summary').click()
    return page.locator('[data-field="dt-' + key + '"]').first
def save():
    act('dt-save', scope='#modal')
    page.locator("#modal").wait_for(state="hidden")
def add(kind, label):
    act('dt-add', kind); field('label').fill(label); save()
def shot(name): page.screenshot(path=str(OUT / name))
def navigate(view): act('nav', view, '#sidebar')

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1600, 'height': 1000})
    page.set_default_timeout(7000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('project-example'); page.locator('#project-import-confirm').check(); act('project-import-apply', scope='#modal')
        check('Self-project imports page and component detail documents', js('dtStore().documents.length===3 && validState(state)'))
        check('Golden JSON matches the complete current authoring model', json.loads(js('companionJson(companionExampleProject())')) == json.loads((HTML.parent / 'companion-project.json').read_text()))
        navigate('pages'); check('Pages overview excludes view and group containers', page.locator('.dt-page-card').count() == js('design().nodes.filter(dtPageEligible).length'))
        before = js('JSON.stringify(design())'); owner = js('design().nodes.find(n=>n.slug==="overview").id')
        act('dt-page', owner)
        check('Opening an unstarted page never authors a document', before == js('JSON.stringify(design())') and page.locator('[data-action="dt-start"]').count() == 1)
        act('dt-start'); page.wait_for_selector('#dt-flow .vue-flow__node')
        check('Start creates exactly one root region and a real Vue Flow island', js('dtDocument().nodes.length===1 && !!dtUi.api') and page.locator('#dt-flow .vue-flow').count() == 1)
        check('Page editor keeps the Pages navigation active and correct header', page.locator('#sidebar .nav-item.active').inner_text() == 'Pages' and 'Page editor' in page.locator('#header').inner_text())
        root_id = js('dtDocument().nodes[0].id'); act('dt-select', root_id)
        add('text', 'Welcome message'); text_id = js('dtUi.selected')
        check('Adding inside selected region stores semantic parent', js('dtDocument().nodes.find(n=>n.id===dtUi.selected).parentId') == root_id)
        act('dt-edit', scope='#dt-inspector'); field('text').fill('Hello <script>window.detailAttack=1</script>'); field('a11y').fill('Concise welcome message with an appropriate heading.'); save()
        check('Authored text is saved without code execution', js('!window.detailAttack && dtDocument().nodes.find(n=>n.id===dtUi.selected).text.includes("<script>")'))
        add('input', 'Project name'); input_id = js('dtUi.selected')
        act('dt-edit', scope='#dt-inspector'); field('a11y').fill('Visible label, required value, clear inline validation feedback.'); field('text').fill('Enter a project name'); save()
        add('button', 'Save project'); button_id = js('dtUi.selected')
        act('dt-connect'); field('source').select_option(button_id); field('target').select_option(input_id); field('label').fill('Validate project name'); field('event').fill('submit'); field('acceptance').fill('Given a blank name\nWhen Save is selected\nThen explain the missing value'); save()
        check('Interaction contract persists trigger and acceptance, not executable code', js('dtDocument().edges[0].event==="submit" && dtDocument().edges[0].acceptance.includes("Given")'))
        act('dt-mode', 'outline'); check('Outline exposes the same elements and interaction contracts without drag', page.locator('.dt-outline-main .dt-tree-row').count() == 4 and 'Validate project name' in page.locator('.dt-outline-main').inner_text())
        act('dt-select', button_id); revision = js('design().revision'); act('dt-order', '-1')
        check('Non-drag reorder changes semantic intent and revision', js('design().revision') == revision + 1 and js('dtDocument().nodes[2].id') == button_id)
        act('dt-undo'); check('Undo restores reading order', js('dtDocument().nodes[3].id') == button_id)
        act('dt-redo'); check('Redo reapplies reading order', js('dtDocument().nodes[2].id') == button_id)
        act('dt-select', text_id); act('dt-edit', scope='#dt-inspector'); field('parentId').select_option(''); save()
        check('Non-drag reparent moves only containment', js('dtDocument().nodes.find(n=>n.id===' + json.dumps(text_id) + ').parentId===null'))
        act('dt-undo'); act('dt-select', root_id); before = js('dtDocument().nodes.length'); act('dt-duplicate')
        check('Duplicating region clones descendants and internal edges with unique identities', js('dtDocument().nodes.length') == before * 2 and js('new Set(dtDocument().nodes.map(n=>n.id)).size===dtDocument().nodes.length && dtDocument().edges.length===2'))
        act('dt-edit', scope='#dt-inspector'); act('dt-remove', scope='#modal'); act('dt-remove-confirm', scope='#modal')
        check('Confirmed deletion removes only duplicated subtree and its edges', js('dtDocument().nodes.length') == before and js('dtDocument().edges.length===1'))
        act('dt-select', root_id); add('component', 'Review instance'); instance_id = js('dtUi.selected')
        act('dt-edit', scope='#dt-inspector'); field('componentId').select_option('project-json-review'); field('props').fill('{"busy":"wrong type"}'); act('dt-save', scope='#modal')
        check('Incompatible instance props are rejected with draft retained', js('document.getElementById("modal").open') and 'declared component type' in page.locator('#dt-form-error').inner_text())
        field('props').fill('{"title":"Review local project","busy":false}'); save(); library_before = js('JSON.stringify(design().library)')
        check('Instance preserves a stable pinned definition, variant and local overrides', js('dtDocument().nodes.find(n=>n.id===dtUi.selected).component.id==="project-json-review" && dtDocument().nodes.find(n=>n.id===dtUi.selected).props.title==="Review local project"'))
        act('dt-component', 'project-json-review'); page.wait_for_selector('#dt-flow .vue-flow__node')
        check('Instance drill-down opens component editor with same canonical definition', js('dtUi.kind==="component" && dtDocument().ownerId==="project-json-review"') and page.locator('#sidebar .nav-item.active').inner_text() == 'Component library')
        shot('01-component-editor.png')
        act('dt-back'); check('Back restores originating page and selected instance', js('dtUi.ownerId') == owner and js('dtUi.selected') == instance_id)
        check('Instance editing did not mutate reusable library contracts', library_before == js('JSON.stringify(design().library)'))
        act('dt-select', input_id); act('dt-edit', scope='#dt-inspector'); source = js('design().dataSources.sources[0].id'); page.locator('#modal summary').filter(has_text='Data binding').click(); field('sourceId').select_option(source); field('bindingField').fill('name'); save()
        check('Binding stores source operation identity and field without provider execution', js('dtDocument().nodes.find(n=>n.id===dtUi.selected).binding.field==="name"'))
        act('dt-edit', scope='#dt-inspector'); field('label').fill(''); act('dt-save', scope='#modal')
        check('Blank label is rejected without losing draft or owner', js('document.getElementById("modal").open') and 'label' in page.locator('#dt-form-error').inner_text())
        field('label').fill('Project name'); save()
        act('dt-mode', 'preview'); check('Preview escapes authored markup and follows explicit semantic order', page.locator('.dt-wireframe script').count() == 0 and not js('!!window.detailAttack') and 'Hello <script>' in page.locator('.dt-wireframe').inner_text())
        check('Preview expands reusable internals and retains instance props', 'Review imported project' not in page.locator('.dt-wireframe').inner_text() and 'Review local project' in page.locator('.dt-wireframe').inner_text() and page.locator('.dt-wire-slot').count() == 1)
        act('dt-width', 'narrow'); check('Narrow preview is bounded to 375px', page.locator('.dt-wireframe').bounding_box()['width'] <= 375)
        before = js('JSON.stringify(design())'); act('dt-state', 'error'); check('Preview state selection changes no saved design data', before == js('JSON.stringify(design())'))
        shot('02-page-preview-narrow.png')
        # Use seeded state-specific content to verify visibility behavior.
        import_owner = js('design().nodes.find(n=>n.slug==="import-project").id'); js('dtOpen("page",'+json.dumps(import_owner)+')'); act('dt-mode', 'preview'); act('dt-state', 'default')
        check('Default preview hides loading/error-only content', 'Your existing work is unchanged' not in page.locator('.dt-wireframe').inner_text())
        act('dt-state', 'error'); check('Error preview shows explicitly authored error content', 'Your existing work is unchanged' in page.locator('.dt-wireframe').inner_text())
        act('dt-mode', 'canvas'); act('dt-fit'); page.wait_for_timeout(150)
        text_id = js('dtDocument().nodes.find(n=>n.kind==="input").id'); before = js('JSON.stringify(dtDocument().nodes.find(n=>n.id==='+json.dumps(text_id)+').position)'); fingerprint = js('designFingerprint(design())'); revision = js('design().revision')
        title = page.locator('#dt-flow .vue-flow__node[data-id='+json.dumps(text_id)+'] .dt-flow-title'); box = title.bounding_box(); x = box['x']+box['width']/2; y = box['y']+box['height']/2
        page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x+50,y+35,steps=8); page.mouse.up(); page.wait_for_timeout(120)
        check('Actual pointer drag persists canvas position', before != js('JSON.stringify(dtDocument().nodes.find(n=>n.id==='+json.dumps(text_id)+').position)'))
        check('Canvas drag leaves semantic fingerprint and revision unchanged', fingerprint == js('designFingerprint(design())') and revision == js('design().revision'))
        act('dt-undo'); check('Undo restores geometry without invalidating semantic intent', before == js('JSON.stringify(dtDocument().nodes.find(n=>n.id==='+json.dumps(text_id)+').position)') and fingerprint == js('designFingerprint(design())'))
        title = page.locator('#dt-flow .vue-flow__node[data-id='+json.dumps(text_id)+'] .dt-flow-title'); box = title.bounding_box(); x = box['x']+box['width']/2; y = box['y']+box['height']/2
        before = js('JSON.stringify(design())'); page.mouse.move(x,y); page.mouse.down(); page.mouse.move(x+60,y+45,steps=8); page.keyboard.press('Escape'); page.mouse.up(); page.wait_for_timeout(120)
        check('Escape during actual drag cancels without changing canonical data', before == js('JSON.stringify(design())'))
        # Real handle connection opens a draft; cancellation adds no edge.
        source_handle = page.locator('#dt-flow .vue-flow__node[data-id='+json.dumps(text_id)+'] .source'); target_id = js('dtDocument().nodes.find(n=>n.component).id'); target_handle = page.locator('#dt-flow .vue-flow__node[data-id='+json.dumps(target_id)+'] .target')
        before = js('JSON.stringify(design())'); source_handle.drag_to(target_handle); page.locator("#modal").wait_for(state="visible")
        check('Actual handle connection opens an interaction draft without immediate mutation', js('dtUi.form.type==="edge"') and before == js('JSON.stringify(design())'))
        act('close', scope='#modal'); check('Cancelling connection leaves existing graph unchanged', before == js('JSON.stringify(design())'))
        # Controlled failure fixtures exercise same public Save action used above.
        act('dt-select', text_id); act('dt-edit', scope='#dt-inspector'); field('label').fill('Retained draft'); js('design().revision++;save();'); before = js('JSON.stringify(design())'); act('dt-save', scope='#modal')
        check('Stale draft rejected without overwriting concurrent work', before == js('JSON.stringify(design())') and 'changed during' in page.locator('#dt-form-error').inner_text(), 'Controlled concurrent-change fixture, real Save control')
        js('modalOriginal=null;closeModal()'); act('dt-edit', scope='#dt-inspector'); field('label').fill('Quota draft'); before = js('JSON.stringify(design())'); js('window.__realSet=localStorage.setItem;localStorage.setItem=()=>{throw Error("quota")};true'); act('dt-save', scope='#modal')
        check('Failed persistence rolls back design and both history stacks, retaining draft', before == js('JSON.stringify(design())') and field('label').input_value() == 'Quota draft' and 'could not be saved' in page.locator('#dt-form-error').inner_text(), 'Controlled quota failure, real Save control')
        js('localStorage.setItem=window.__realSet;storageWarning="";modalOriginal=null;closeModal();save();'); act('dt-edit', scope='#dt-inspector'); field('label').fill('Conflict draft'); before = js('JSON.stringify(design())'); js('localStorage.setItem(STORAGE_KEY,"foreign-window");'); act('dt-save', scope='#modal')
        check('Foreign storage revision blocks edits before mutation', before == js('JSON.stringify(design())') and 'storage conflict' in page.locator('#dt-form-error').inner_text(), 'Controlled foreign-storage fixture, real Save control')
        js('localStorage.setItem(STORAGE_KEY,persistenceSnapshot);storageWarning="";modalOriginal=null;closeModal();save();')
        raw = js('companionJson()'); check('Full JSON round-trip preserves every authored detail field', js('(text)=>JSON.stringify(companionProjectDocument(companionCandidate(text)))===JSON.stringify(JSON.parse(text))', raw))
        check('New data survives existing persistence validation', js('validState(state)'))
        check('Saved internal route reloads into Pages without losing data', js('loadState().view==="pages" && JSON.stringify(loadState().project.design.detailDesigns)===JSON.stringify(dtStore())'), 'Persistence loader against browser storage adapter')
        # Check library and storymap entry points and cleanup of old islands.
        navigate('components'); act('product-component-select', 'project-json-review'); act('dt-component', 'project-json-review'); check('Library entry opens existing component design without duplication', js('dtStore().documents.filter(d=>d.kind==="component"&&d.ownerId==="project-json-review").length===1'))
        check('Component internal route also reloads into its library safely', js('validState(state) && loadState().view==="components" && !storageWarning'))
        navigate('storymaps'); check('Leaving detail editor unmounts and destroys its renderer', js('dtUi.app===null && dtUi.api===null'))
        act('sm-open', js('smStore().maps[0].id')); linked = js('smCurrentMap().stories.find(s=>s.surfaces.some(r=>dtPageEligible(design().nodes.find(n=>n.id===r.id))))'); act('sm-select', linked['id']); target = js('smCurrentMap().stories.find(s=>s.id==='+json.dumps(linked['id'])+').surfaces.find(r=>dtPageEligible(design().nodes.find(n=>n.id===r.id))).id'); act('dt-page', target)
        check('Storymap linked-surface entry opens the page detail layer', js('state.view==="page-editor" && dtUi.ownerId') == target)
        act('dt-back'); check('Return to storymap restores its selected story', js('state.view==="storymaps" && smUi.item') == linked['id'])
        js('dtOpen("page",'+json.dumps(import_owner)+')'); act('dt-fit'); shot('03-page-editor-dark.png')
        js('state.settings.theme="light";render();'); shot('04-page-editor-light.png')
        check('Desktop layout has no horizontal document overflow in light theme', js('document.documentElement.scrollWidth<=innerWidth'))
        page.set_viewport_size({'width':390,'height':844}); act('dt-mode','outline'); shot('05-mobile-outline.png')
        check('Small-screen outline remains usable without horizontal overflow', js('document.documentElement.scrollWidth<=innerWidth') and page.locator('.dt-outline-main').is_visible())
        act('dt-edit', js('dtDocument().nodes.find(n=>n.kind==="input").id')); shot('06-mobile-element-form.png')
        check('Small-screen modal fits the viewport', page.locator('#modal').bounding_box()['width'] <= 390)
        js('modalOriginal=null;closeModal();'); page.set_viewport_size({'width':1600,'height':1000})
        check('No browser errors or external requests', not errors and not requests)
    except Exception as e:
        fatal = str(e); traceback.print_exc(); shot('failure.png')
    browser.close()
report = {'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'scope':'Browser concept only; real controls and gestures plus labeled injected failures. Not native host or generated application acceptance.'}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
