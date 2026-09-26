"""Real storymap controls and pointer moves, with explicitly labeled failure fixtures."""
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
OUT = ROOT / 'reports/concepts/storymaps'
OUT.mkdir(parents=True, exist_ok=True)
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks, errors, requests = [], [], []
fatal = None


def check(name, value, scope='Actual browser controls and canonical model readback'):
    checks.append({'name': name, 'result': 'passed' if value else 'failed', 'scope': scope})
    print(('PASS ' if value else 'FAIL ') + name, flush=True)
    assert value, name


def js(code, arg=None):
    return page.evaluate(code, arg)


def act(action, value=None, scope='#content'):
    suffix = '' if value is None else '[data-value=' + json.dumps(value) + ']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()


def save():
    act('sm-save', scope='#modal')
    page.wait_for_function('!document.getElementById("modal").open')


def nav(view):
    act('nav', view, '#sidebar')


def create(kind, title, parent='', release=''):
    act('sm-add', kind + (':' + parent if parent else '') + (':' + release if release else ''))
    page.locator('#sm-title').fill(title)
    save()


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    page.set_default_timeout(7000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('project-example'); page.locator('#project-import-confirm').check(); act('project-import-apply', scope='#modal')
        check('Self-project imports a real editable storymap', js('smStore().maps.length===1 && validState(state)'))
        nav('storymaps')
        check('Navigation opens the project storymaps overview', page.locator('#content h1').inner_text() == 'Storymaps' and page.locator('.sm-map-link').count() == 1)
        original_id = js('smStore().maps[0].id')
        nav('prds'); prior_prd = js('selectedPrd().id'); act('sm-open-prd', original_id)
        page.wait_for_selector('#sm-flow .sm-card')
        check('PRD entry opens the same canonical map using Vue Flow', js('smUi.map') == original_id and page.locator('#sm-flow .vue-flow').count() == 1)
        act('sm-return')
        check('Return restores the originating PRD identity', js('state.view==="prds" && selectedPrd().id===' + json.dumps(prior_prd)))
        act('sm-new', prior_prd); page.locator('#sm-title').fill('Restore a developer’s context'); page.locator('#sm-purpose').fill('Resume a saved design without losing its context.'); save()
        new_id = js('smCurrentMap().id')
        check('Create from PRD links context but does not fabricate activities or stories', js('smCurrentMap().prds.length===1 && smCurrentMap().activities.length===0 && smCurrentMap().stories.length===0'))
        check('Creation from PRD retains the return affordance', page.locator('[data-action="sm-return"]').count() == 1)
        create('activity', 'Resume the design')
        a_id = js('smCurrentMap().activities[0].id')
        act('sm-select', a_id); create('step', 'Find saved work', a_id)
        s_id = js('smCurrentMap().steps[0].id')
        check('An activity owns the new step', js('smCurrentMap().steps[0].activityId') == a_id)
        act('sm-add', 'story:' + s_id + ':')
        page.locator('#sm-title').fill('Reopen <saved> work & notes')
        page.locator('#sm-description').fill('Restore the selected design and retain the user’s notes.')
        page.locator('#sm-acceptance').fill('Given a saved project, reopening it restores the authored data.')
        target = js('design().nodes.find(n=>n.slug==="storymap-detail").id')
        page.locator('[data-field="sm-surfaceRef"][data-key=' + json.dumps(target) + ']').check()
        page.locator('[data-field="sm-requirementRef"]').first.check()
        page.locator('#sm-ui').select_option('none'); act('sm-save', scope='#modal')
        check('No-UI conflict is explained without silently dropping links', 'no-UI' in page.locator('#sm-form-error').inner_text() and js('smCurrentMap().stories.length===0 && smUi.form.record.surfaces.length===1'))
        page.locator('#sm-ui').select_option('surface'); page.locator('#sm-surfaceQuery').fill('no matching surface')
        check('Filtering the reference picker retains hidden selections', page.locator('[data-field="sm-surfaceRef"]').count() == 0 and js('smUi.form.record.surfaces.length===1'))
        save(); story_id = js('smCurrentMap().stories[0].id')
        check('Story saves its content and both artifact-reference types', js('smCurrentMap().stories[0].surfaces.length===1 && smCurrentMap().stories[0].requirements.length===1 && smCurrentMap().stories[0].acceptance.length>0'))
        check('Authored markup is rendered as text, not executable HTML', 'Reopen <saved> work & notes' in page.locator('#content').inner_text() and page.locator('#content saved').count() == 0)
        create('release', 'First useful return'); release_id = js('smCurrentMap().releases[0].id')
        act('sm-select', a_id); create('step', 'Continue editing', a_id); second_step = js('smCurrentMap().steps[1].id')
        act('sm-select', story_id); act('sm-move', story_id, '#sm-inspector'); history = js('design().history.length'); before_entry = js('JSON.stringify(designSnapshot(design()))')
        page.locator('#sm-stepId').select_option(second_step); page.locator('#sm-releaseId').select_option(release_id)
        page.locator('[data-action="sm-save"]').focus(); page.keyboard.press('Enter'); page.wait_for_function('!document.getElementById("modal").open')
        check('Storymap planning metadata stays outside the legacy boilerplate compiler input', js('!Object.hasOwn(generationSnapshot(design()), "storymaps")'))
        check('Keyboard-submitted non-drag move updates step and release in one history entry', js('smCurrentMap().stories[0].stepId') == second_step and js('smCurrentMap().stories[0].releaseId') == release_id and 1 <= js('design().history.length') <= history + 1 and js('JSON.stringify(design().history.at(-1))') == before_entry)
        act('sm-history', 'undo'); check('Undo restores both assignments together', js('smCurrentMap().stories[0].stepId') == s_id and js('smCurrentMap().stories[0].releaseId') is None)
        page.locator('#content').focus(); page.keyboard.press('Control+Shift+z')
        check('Redo shortcut restores the semantic move', js('smCurrentMap().stories[0].stepId') == second_step and js('smCurrentMap().stories[0].releaseId') == release_id)
        act('sm-fit'); page.wait_for_function('smUi.api.getNodes.value.every(n=>n.dimensions.width>0)')
        coords = js('''id=>{const n=smUi.api.findNode(id),l=smLayout(smCurrentMap()),c=l.columns[0],lane=l.lanes.find(l=>l.id===null),v=smUi.api.viewport.value,b=smUi.root.getBoundingClientRect();return {x:b.x+v.x+(n.position.x+5)*v.zoom,y:b.y+v.y+(n.position.y+50)*v.zoom,tx:b.x+v.x+(c.x+5)*v.zoom,ty:b.y+v.y+(lane.y+16+50)*v.zoom};}''', story_id)
        history = js('design().history.length'); before_entry = js('JSON.stringify(designSnapshot(design()))'); page.mouse.move(coords['x'], coords['y']); page.mouse.down(); page.mouse.move(coords['tx'], coords['ty'], steps=18)
        check('Actual drag shows a semantic destination and insertion marker', page.locator('#sm-drop-status.visible').count() == 1 and not page.locator('#sm-insertion').is_hidden())
        page.mouse.up(); page.wait_for_function('!smUi.drag')
        check('Actual pointer drop commits the intended cell, not coordinates', js('smCurrentMap().stories[0].stepId') == s_id and js('smCurrentMap().stories[0].releaseId') is None and 1 <= js('design().history.length') <= history + 1 and js('JSON.stringify(design().history.at(-1))') == before_entry)
        check('Persistent story has no renderer coordinates', js('!Object.hasOwn(smCurrentMap().stories[0],"position")'))
        before = js('JSON.stringify(designSnapshot(design()))'); act('sm-fit')
        box = page.locator('[data-sm-item=' + json.dumps(story_id) + ']').bounding_box()
        page.mouse.move(box['x'] + 4, box['y'] + box['height']/2); page.mouse.down(); page.mouse.move(box['x'] + 60, box['y'] - 40, steps=8); page.keyboard.press('Escape'); page.mouse.up()
        check('Escape during pointer drag cancels without mutating saved data', js('JSON.stringify(designSnapshot(design()))') == before and js('!smUi.drag'))
        act('sm-select', story_id); serial = js('smUi.serial'); viewport = js('JSON.stringify(smUi.api.viewport.value)'); act('sm-select', a_id)
        check('Locate selection becomes available without a full render', not page.locator('[data-action="sm-locate"]').is_disabled())
        check('Selection changes do not remount or reframe the graph', js('smUi.serial') == serial and js('JSON.stringify(smUi.api.viewport.value)') == viewport)
        act('sm-select', story_id); act('sm-edit', story_id, '#sm-inspector'); page.locator('#sm-title').fill('Unsaved replacement title'); act('sm-delete', scope='#modal')
        check('Removal review does not apply unsubmitted edits', js('smCurrentMap().stories[0].title') == 'Reopen <saved> work & notes')
        page.keyboard.press('Escape')
        check('Escape from removal returns to the exact draft', page.locator('#sm-title').input_value() == 'Unsaved replacement title')
        act('close', scope='#modal'); check('Closing a dirty form asks to keep or discard', page.locator('#discard-dialog[open]').count() == 1)
        page.locator('#discard-confirm').click(); check('Discard restores neither stale edits nor a deleted item', js('smCurrentMap().stories[0].title') == 'Reopen <saved> work & notes')
        act('sm-mode', 'outline')
        check('Outline exposes the same authored story and editing actions', page.locator('.sm-outline-story').count() == 2 and page.locator('.sm-outline [data-action="sm-move"]').count() >= 4)
        act('sm-edit', story_id); page.locator('#sm-releaseId').select_option(release_id); save()
        act('sm-edit', release_id); act('sm-delete', scope='#modal'); act('sm-delete-confirm', scope='#modal')
        check('Removing a release retains its story in Unplanned', js('smCurrentMap().releases.length===0 && smCurrentMap().stories.length===1 && smCurrentMap().stories[0].releaseId===null'))
        act('sm-history', 'undo'); check('Undo restores the release and its membership', js('smCurrentMap().releases.length===1 && smCurrentMap().stories[0].releaseId!==null'))
        act('sm-surface', target)
        check('Sitemap link locates the original surface identity', js('state.view==="sitemap" && designUi.selected===' + json.dumps(target)))
        act('canvas-inspector', 'intent')
        check('Sitemap inspector exposes reverse storymap references', page.locator('.sm-backlinks [data-action="sm-backlink"]').count() >= 2)
        act('sm-backlink', new_id + ':' + story_id)
        check('Backlink opens the same map with the correct item selected', js('smUi.map') == new_id and js('smUi.item') == story_id)
        act('sm-return'); check('Backlink return preserves sitemap selection', js('state.view==="sitemap" && designUi.selected===' + json.dumps(target)))
        nav('storymaps'); act('sm-duplicate', new_id); duplicate = js('smUi.map')
        check('Duplicating creates another map with independent internal identities', duplicate != new_id and js('smCurrentMap().stories[0].id') != story_id)
        act('sm-overview'); act('sm-archive', duplicate)
        check('Archived maps leave the default active list', page.locator('.sm-map-link').count() == 2)
        page.locator('#sm-statusFilter').select_option('archived'); act('sm-open', duplicate)
        check('Archived map has disabled authoring controls', page.locator('[data-action="sm-add"][data-value="activity"]').is_disabled())
        act('sm-archive', duplicate); check('Restore makes the map editable again', js('smCurrentMap().status==="draft"'))
        act('sm-overview'); page.locator('#sm-statusFilter').select_option('active'); page.locator('#sm-query').fill('no results')
        check('Overview search offers recoverable empty results', page.locator('.sm-map-link').count() == 0 and page.locator('[data-action="sm-clear-filters"]').count() == 1)
        act('sm-clear-filters'); nav('prds'); act('sm-prd-links', prior_prd)
        page.locator('[data-field="sm-mapRef"][data-key=' + json.dumps(duplicate) + ']').uncheck(); save()
        check('PRD linking changes relations without deleting the map', js('smStore().maps.length===3') and page.locator('[data-action="sm-open-prd"][data-value=' + json.dumps(duplicate) + ']').count() == 0)
        act('sm-open-prd', new_id); act('sm-mode', 'outline'); act('sm-edit', story_id)
        page.locator('#sm-title').fill('Rejected stale title'); js('window.__goal=design().goal;design().goal="Concurrent authored change"')
        act('sm-save', scope='#modal')
        check('Same-revision concurrent authoring blocks save and retains draft', 'project changed' in page.locator('#sm-form-error').inner_text() and page.locator('#sm-title').input_value() == 'Rejected stale title' and js('smCurrentMap().stories[0].title') != 'Rejected stale title', 'Controlled concurrent-state fixture through actual Save')
        js('design().goal=window.__goal;modalOriginal=null'); act('close', scope='#modal')
        act('sm-edit', story_id); page.locator('#sm-title').fill('Cannot persist this title')
        snapshot = js('JSON.stringify(design())'); stored = js('__saved[STORAGE_KEY]')
        js('window.__normalSet=localStorage.setItem;localStorage.setItem=()=>{throw Error("quota")};void 0')
        act('sm-save', scope='#modal')
        check('Failed persistence rolls back canonical data and history', js('JSON.stringify(design())') == snapshot and js('__saved[STORAGE_KEY]') == stored, 'Controlled Storage failure through actual Save')
        check('Save failure keeps the editable draft', page.locator('#sm-title').input_value() == 'Cannot persist this title', 'Controlled Storage failure')
        js('localStorage.setItem=window.__normalSet;storageWarning="";modalOriginal=null'); act('close', scope='#modal')
        act('sm-edit', story_id); page.locator('#sm-title').fill('Storage-conflicting title'); js('window.__disk=__saved[STORAGE_KEY];__saved[STORAGE_KEY]="other-window"')
        act('sm-save', scope='#modal')
        check('Stale storage is not overwritten by a storymap edit', js('__saved[STORAGE_KEY]==="other-window"') and 'storage conflict' in page.locator('#sm-form-error').inner_text(), 'Controlled two-session Storage fixture')
        js('__saved[STORAGE_KEY]=window.__disk;storageWarning="";modalOriginal=null'); act('close', scope='#modal')
        js('tdUi.busy=true'); act('sm-add', 'activity')
        check('Active operations block authoring before opening a draft', js('!document.getElementById("modal").open') and 'current operation' in page.locator('#sm-page-error').inner_text(), 'Controlled active-operation fixture')
        js('tdUi.busy=false;smUi.error="";render()')
        js('id=>{design().nodes.find(n=>n.id===id).label="Renamed storymap editor";designChanged();render();}', target)
        check('Referenced surface names follow the canonical identity', 'Renamed storymap editor' in page.locator('.sm-outline').inner_text(), 'Controlled external rename; rendered reference readback')
        js('id=>{const r=smCurrentMap().stories[0].surfaces.find(r=>r.id===id);r.id="deleted-target";designChanged();render();}', target)
        check('Missing target is explicit but the story remains valid authoring data', 'target missing' in page.locator('.sm-outline').inner_text() and js('validSavedDesign(design())'), 'Controlled unresolved-reference fixture')
        page.locator('.sm-export-menu summary').click()
        with page.expect_download() as event:
            act('sm-export')
        event.value.save_as(str(OUT / 'storymap.md'))
        check('Actual Markdown export preserves text, release context and missing references', 'First useful return' in (OUT/'storymap.md').read_text() and 'target missing' in (OUT/'storymap.md').read_text())
        document = js('companionJson()'); act('project-export')
        with page.expect_download() as event:
            act('download-text', scope='#modal')
        event.value.save_as(str(OUT/'project.companion.json'))
        check('Actual full JSON download retains all storymaps', json.loads((OUT/'project.companion.json').read_text()) == json.loads(document) and len(json.loads(document)['design']['storymaps']['maps']) == 3)
        act('close', scope='#modal')
        with tempfile.TemporaryDirectory(prefix='storymap-cli-') as tmp:
            vault=Path(tmp)/'vault'; vault.mkdir(); keep=vault/'keep.md';keep.write_text('foreign record')
            run=subprocess.run(['node',str(ROOT/'scripts/companion/generate.mjs'),'--input',str(OUT/'project.companion.json'),'--vault',str(vault),'--target','plugins/companion'],capture_output=True,timeout=15)
            check('Read-only CLI returns the browser’s exact Storymaps export bytes',run.returncode==0 and run.stdout==(OUT/'project.companion.json').read_bytes() and not run.stderr,'Actual CLI subprocess')
            check('Storymap handoff writes no target or foreign file', list(vault.iterdir())==[keep] and keep.read_text()=='foreign record','Actual isolated filesystem')
        # Confirmation is rendered only after parsing; locator auto-wait preserves the strict CSP.
        nav('overview'); act('project-import'); page.locator('#project-import-file').set_input_files(str(OUT/'project.companion.json')); page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        check('Reviewed import preserves the full semantic document', json.loads(js('companionJson()')) == json.loads(document))
        check('Current stored project validates after import', js('validState(JSON.parse(__saved[STORAGE_KEY]))'))
        legacy=json.loads(document);legacy['schemaVersion']=1;legacy['design']['schema']=1;del legacy['design']['storymaps']; legacy['design'].pop('detailDesigns', None)
        check('Legacy version-one import starts with an empty storymap collection', js('text=>smStore(companionCandidate(text).design).maps.length===0',json.dumps(legacy)), 'Legacy migration contract fixture')
        nav('storymaps');act('sm-open',original_id);act('sm-mode','map')
        for width,theme,mode in [(1440,'dark','map'),(1440,'light','map'),(960,'dark','map'),(390,'dark','outline')]:
            page.set_viewport_size({'width':width,'height':1000 if width>600 else 900})
            js('([theme,mode])=>{state.settings.theme=theme;smUi.mode=mode;render();}',[theme,mode])
            if mode=='map': page.wait_for_selector('#sm-flow .sm-card')
            check('Storymap layout fits '+str(width)+'px '+theme,js('document.documentElement.scrollWidth<=innerWidth && document.querySelector(".sm-workspace").getBoundingClientRect().right<=innerWidth'))
            if width == 1440 and mode == 'map':
                check('Zoom controls stay within the visible desktop pane in '+theme, js('document.querySelector(".sm-viewport-controls").getBoundingClientRect().bottom < innerHeight-24'))
            page.locator('#toasts .toast').wait_for(state='detached', timeout=10000)
            page.screenshot(path=str(OUT/f'{width}-{theme}-{mode}.png'))
        check('No page or console errors in exercised flows',not errors)
        check('No unexpected network requests',not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal)
        try: page.screenshot(path=str(OUT/'failure.png'))
        except Exception: pass
    finally:
        browser.close()
report={'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,
        'scope':'Real controls, keyboard submissions and pointer drags plus labeled controlled Storage/concurrency fixtures. Not native Obsidian or maximum-scale browser qualification.'}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
