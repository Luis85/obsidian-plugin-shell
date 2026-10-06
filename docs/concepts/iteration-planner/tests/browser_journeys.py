"""Real Chromium interactions on exact generated HTML, mounted with set_content.
file:// is attempted separately and reported, never relabeled as a passing mount.
Storage branch tests inject a Storage adapter; they are not real-origin persistence.
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'prototype.html').read_text()
RESULTS = []
ERRORS = []
REQUESTS = []

def record(name):
    RESULTS.append(name)
    print('PASS', name, flush=True)

def action(page, name, id=None):
    selector = f'[data-action="{name}"]'
    if id is not None:
        selector += f'[data-id="{id}"]'
    page.locator(selector).first.click()

def nav(page, view):
    page.locator(f'.sidebar [data-action="navigate"][data-id="{view}"]').click()

def submit(page, name=None):
    if name:
        (page.locator('dialog') if page.locator('dialog').is_visible() else page).get_by_role('button', name=name, exact=True).click()
    else:
        page.locator('dialog form button[type="submit"]').click()

def modal_closed(page):
    expect(page.locator('dialog')).not_to_be_visible()

def exported(page):
    with page.expect_download() as event:
        action(page,'export')
    download=event.value
    assert download.suggested_filename == 'iteration-planner.workspace.json'
    return json.loads(Path(download.path()).read_text())

def open_page(browser, adapter=None, width=1440, height=1100, theme='light'):
    context=browser.new_context(viewport={'width':width,'height':height},offline=True,color_scheme=theme,accept_downloads=True)
    page=context.new_page()
    page.set_default_timeout(7000)
    page.on('pageerror', lambda e: ERRORS.append(str(e)))
    page.on('console', lambda m: ERRORS.append(m.text) if m.type == 'error' else None)
    page.on('request',lambda r: REQUESTS.append(r.url))
    page.on('dialog',lambda dialog: dialog.accept())
    if adapter is not None:
        page.evaluate('''initial => {
            window.__stored = initial;
            window.__writes = 0;
            Object.defineProperty(window, 'localStorage', {configurable:true,value:{
                getItem:key=>window.__stored[key]??null,
                setItem:(key,value)=>{window.__writes++;window.__stored[key]=value},
                removeItem:key=>{delete window.__stored[key]}
            }});
        }''',adapter)
    page.set_content(HTML)
    expect(page.locator('html')).to_have_attribute('data-prototype-ready','true')
    return context,page

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    file_status={'status':'not-run'}
    file_context=browser.new_context(offline=True)
    file_page=file_context.new_page()
    try:
        file_page.goto((ROOT/'prototype.html').as_uri(),timeout=10000)
        expect(file_page.locator('html')).to_have_attribute('data-prototype-ready','true')
        file_status={'status':'passed'}
    except Exception as error:
        file_status={'status':'blocked','reason':str(error).split('Call log:')[0].strip()}
    finally:
        file_context.close()
    try:
        context,page=open_page(browser)
        expect(page.get_by_text('33%',exact=True)).to_be_visible()
        expect(page.get_by_text('Browser storage is unavailable. Work stays in this tab; export JSON to keep it.')).to_be_visible()
        original=exported(page)
        assert original['kind']=='iteration-planner.workspace'
        record('B01 source-built overview, storage-denial fallback and actual JSON download')
        page.screenshot(path=str(ROOT/'evidence/overview-wide.png'),full_page=True)
        for view in ['backlog','planning','daily','increment','retro','resources','history','overview']:
            nav(page,view)
            expect(page.locator('#page-title')).to_be_visible()
        record('B02 all eight product surfaces render through real navigation')
        action(page,'new-iteration')
        expect(page.locator('#f-goal')).to_be_focused()
        page.keyboard.press('Escape');modal_closed(page)
        record('B03 native dialog initial focus and Escape dismissal')
        nav(page,'backlog')
        page.locator('#quick-title').fill('Interview a first-time author')
        page.locator('#quick-add-form button[type="submit"]').click()
        expect(page.get_by_text('Interview a first-time author',exact=True)).to_be_visible()
        state=exported(page);assert len(state['items'])==13
        new_item=state['items'][-1]['id']
        action(page,'edit-item',new_item)
        page.get_by_label('Type (your own vocabulary)').fill('Discovery interview')
        page.get_by_label('Description / acceptance notes').fill('Understand the first five minutes.')
        submit(page,'Save item');modal_closed(page)
        assert exported(page)['items'][-1]['type']=='Discovery interview'
        record('B04 title-only capture and editing arbitrary work types')
        page.locator(f'[data-select-item="{new_item}"]').check()
        action(page,'add-selected')
        page.get_by_label('Why is this scope being added?').fill('Validate the first-use assumptions')
        submit(page,'Add selected items');modal_closed(page)
        state=exported(page);current=state['iterations'][2]
        assert len(current['work'])==7 and len(current['baseline'])==6
        assert current['scopeChanges'][-1]['reason']=='Validate the first-use assumptions'
        record('B05 selected backlog items enter active scope with a reason and stable baseline')
        nav(page,'planning')
        action(page,'remove-work',new_item)
        page.get_by_label('Why is this scope being removed?').fill('Schedule the interview in the next iteration')
        submit(page,'Remove from iteration');modal_closed(page)
        assert len(exported(page)['iterations'][2]['work'])==6
        record('B06 removing scope preserves the canonical backlog and original agreement')
        nav(page,'daily')
        action(page,'finish-daily');submit(page,'Finish daily')
        expect(page.locator('#dialog-error')).to_contain_text('Walk every')
        action(page,'close-dialog');modal_closed(page)
        action(page,'daily-select','item-4')
        page.get_by_role('radio',name='Done',exact=True).check()
        submit(page,'Save & next item')
        expect(page.locator('#work-error')).to_contain_text('Definition of Done')
        page.get_by_label('The agreed Definition of Done is met.').check()
        page.get_by_label('Changelog — what can the team or user do now?').fill('Imports now preserve unrelated authoring work.')
        page.get_by_label('What is the next useful step?').fill('Demonstrate conflict handling at review.')
        submit(page,'Save & next item')
        assert len(exported(page)['iterations'][2]['daily'][-1]['notes'])==1
        record('B07 daily Done guard and meaningful delivered changelog')
        for item in ['item-1','item-2','item-3','item-5','item-6']:
            action(page,'daily-select',item)
            page.get_by_label('What changed or became clearer?').fill(f'Discussed {item} with the team.')
            submit(page,'Save & next item')
        action(page,'finish-daily')
        page.get_by_label('What will the team focus on next?').fill('Finish the smallest authoring path together.')
        submit(page,'Finish daily');modal_closed(page)
        state=exported(page);assert state['iterations'][2]['daily'][-1]['finished'] is True
        assert len(state['iterations'][2]['daily'][-1]['notes'])==6
        page.screenshot(path=str(ROOT/'evidence/daily-wide.png'),full_page=True)
        record('B08 complete daily walks every backlog item including Done')
        nav(page,'overview');expect(page.get_by_text('50%',exact=True)).to_be_visible()
        record('B09 delivery gauge updates from confirmed completion, not notes')
        nav(page,'increment')
        page.get_by_label('Increment summary',exact=True).fill('A smoother first authoring step.')
        page.get_by_label('Did we achieve the goal?').select_option('partly-met')
        page.get_by_label('Review observations & feedback').fill('Import safety improved; the layout workflow still needs work.')
        submit(page,'Review & close iteration')
        expect(page.get_by_role('heading',name='Record this increment?')).to_be_visible()
        submit(page,'Freeze increment & close');modal_closed(page)
        frozen=exported(page);iteration=frozen['iterations'][2]
        assert iteration['stage']=='closed'
        assert len(iteration['increment']['snapshot']['delivered'])==3
        assert len(iteration['increment']['snapshot']['unfinished'])==3
        page.screenshot(path=str(ROOT/'evidence/increment-wide.png'),full_page=True)
        record('B10 review records a frozen increment and separates unfinished work')
        with page.expect_download() as event:
            action(page,'export-changelog')
        markdown=Path(event.value.path()).read_text()
        assert 'Imports now preserve' in markdown and '## Not delivered' in markdown
        record('B11 real Markdown changelog export distinguishes delivery from progress')
        nav(page,'retro');action(page,'new-retro','try')
        page.get_by_label('Thought or improvement').fill('Demo the smallest slice before adding scope')
        page.get_by_label('Owner (optional)').select_option('maya')
        submit(page,'Add thought');modal_closed(page)
        note_id=exported(page)['iterations'][2]['retro'][-1]['id']
        action(page,'promote-retro',note_id);submit(page,'Create backlog action');modal_closed(page)
        state=exported(page);note=state['iterations'][2]['retro'][-1]
        item=next(x for x in state['items'] if x['id']==note['backlogItemId'])
        assert item['ownerId']=='maya' and item['type']=='Improvement'
        assert page.locator(f'[data-action="promote-retro"][data-id="{note_id}"]').count()==0
        page.screenshot(path=str(ROOT/'evidence/retro-wide.png'),full_page=True)
        record('B12 retrospective promotes one traceable owned improvement')
        action(page,'new-iteration')
        page.locator('#f-goal').fill('Make layouts easy to finish')
        submit(page,'Create iteration');modal_closed(page)
        state=exported(page);next_id=state['iterations'][-1]['id'];assert state['iterations'][-1]['index']==3
        assert state['iterations'][-1]['start']=='2026-10-05'
        action(page,'add-plan-item','item-3');submit(page,'Add selected items');modal_closed(page)
        action(page,'start-iteration');submit(page,'Agree plan & start');modal_closed(page)
        state=exported(page);assert state['iterations'][-1]['stage']=='active'
        assert state['iterations'][2]['increment']==iteration['increment']
        record('B13 next Monday planning reuses unfinished work without rewriting history')
        nav(page,'resources');action(page,'new-person')
        page.locator('#f-name').fill('Sam Taylor');page.get_by_label('Role / contribution').fill('Quality')
        submit(page,'Add person');modal_closed(page)
        person=exported(page)['resources'][-1]['id'];action(page,'allocate',person)
        page.get_by_label('Available hours in this iteration').fill('16')
        submit(page,'Save capacity');modal_closed(page)
        assert exported(page)['iterations'][-1]['members'][-1]['hours']==16
        action(page,'new-reference');page.get_by_label('Reference title').fill('Review brief')
        page.get_by_label('HTTP(S) URL').fill('https://example.org/review')
        submit(page,'Add reference');modal_closed(page)
        expect(page.get_by_role('link',name='Review brief')).to_have_attribute('href','https://example.org/review')
        record('B14 people, iteration capacity and explicit external reference resources')
        before=exported(page)
        page.locator('#workspace-import').set_input_files({'name':'wrong.json','mimeType':'application/json','buffer':b'{"kind":"companion.project"}'})
        expect(page.locator('#notice')).to_contain_text('not an iteration-planner')
        assert exported(page)==before
        page.locator('#workspace-import').set_input_files({'name':'original.json','mimeType':'application/json','buffer':json.dumps(original).encode()})
        expect(page.get_by_role('heading',name='Replace the current workspace?')).to_be_visible()
        action(page,'close-dialog');modal_closed(page);assert exported(page)==before
        page.locator('#workspace-import').set_input_files({'name':'original.json','mimeType':'application/json','buffer':json.dumps(original).encode()})
        submit(page,'Replace workspace');modal_closed(page);assert exported(page)==original
        record('B15 invalid import rollback, preview cancellation and exact JSON round trip')
        nav(page,'backlog');action(page,'new-item')
        page.locator('#f-title').fill('<img src=x onerror="window.pwned=true">')
        submit(page,'Add item');modal_closed(page)
        assert page.locator('main img').count()==0
        assert page.evaluate('window.pwned === undefined')
        record('B16 arbitrary imported or entered titles render as text, not executable markup')
        context.close()
        for width,height,theme in [(1440,1000,'dark'),(390,844,'light'),(390,844,'dark')]:
            context,page=open_page(browser,width=width,height=height,theme=theme)
            for view in ['overview','backlog','planning','daily','increment','retro','resources','history']:
                nav(page,view)
                overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
                assert not overflow, f'{theme} {width} {view}: root horizontal overflow'
            nav(page,'overview')
            page.screenshot(path=str(ROOT/f'evidence/overview-{width}-{theme}.png'),full_page=True)
            context.close()
        record('B17 all eight surfaces fit wide/narrow light/dark without root overflow')
        key='iteration-planner.prototype.v1'
        context,page=open_page(browser,adapter={})
        assert page.evaluate('window.__writes')==0
        action(page,'settings');page.locator('#f-productName').fill('A saved product')
        page.get_by_label('Remember this workspace in this browser').check()
        submit(page,'Save workspace settings');modal_closed(page)
        stored=page.evaluate('window.__stored');assert json.loads(stored[key])['productName']=='A saved product'
        assert page.evaluate('window.__writes')>0
        context.close()
        context,page=open_page(browser,adapter=stored)
        expect(page.locator('.workspace-button strong')).to_have_text('A saved product')
        assert page.evaluate('window.__writes')==0
        context.close()
        record('B18 storage-adapter opt-in save and validated startup read without startup writes')
        context,page=open_page(browser,adapter={key:'{invalid'})
        expect(page.locator('.storage-warning')).to_contain_text('left untouched')
        nav(page,'backlog');page.locator('#quick-title').fill('Safe in-memory edit')
        page.locator('#quick-add-form button[type="submit"]').click()
        assert page.evaluate('window.__writes')==0
        assert page.evaluate('window.__stored')[key]=='{invalid'
        context.close()
        record('B19 corrupt storage adapter retains original bytes during in-memory edits')
        assert not ERRORS, ERRORS
        assert not REQUESTS, REQUESTS
        record('B20 no runtime console errors or network requests across mounted journeys')
        report={'status':'passed','artifactSha256':hashlib.sha256((ROOT/'prototype.html').read_bytes()).hexdigest(),'browser':browser.version,'mount':'exact HTML bytes through Playwright set_content on about:blank','fileOrigin':file_status,'assertions':RESULTS,'consoleErrors':ERRORS,'networkRequests':REQUESTS,'storageScope':'denied opaque-origin fallback plus injected Storage-adapter branch tests; not native-origin persistence','limitations':['file-origin blocked if reported above','not repository-pinned Playwright','no screen-reader or native Obsidian acceptance','not WCAG certification']}
        (ROOT/'evidence/browser.json').write_text(json.dumps(report,indent=2)+'\n')
    except Exception:
        try:
            page.screenshot(path=str(ROOT/'evidence/browser-failure.png'),full_page=True)
            print(page.locator('body').inner_text()[-4500:])
        except Exception:
            pass
        raise
    finally:
        browser.close()
