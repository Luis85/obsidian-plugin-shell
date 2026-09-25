"""Actual starter selection/export controls and isolated canonical safety fixtures."""
import hashlib
import json
import os
import subprocess
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
HTML=ROOT/'docs/concepts/companion/index.html'
OUT=ROOT/'reports/concepts/project-starters';OUT.mkdir(parents=True,exist_ok=True)
STORAGE="""<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks,errors,requests,fatal=[],[],[],None

def check(name,value,scope='Actual controls and canonical state readback'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    print(('PASS ' if value else 'FAIL ')+name,flush=True)
    assert value,name

def js(code,arg=None):return page.evaluate(code,arg)
def act(action,value=None,scope='#content'):
    suffix='' if value is None else '[data-value='+json.dumps(value)+']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def reset():
    page.goto('about:blank')
    page.set_content(STORAGE+HTML.read_text());act('nav','starters','#sidebar')
def configure(identifier):act('starter-open',identifier)
def review():act('starter-review',scope='#modal')
def apply():page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);page.set_default_timeout(8000)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    try:
        page.set_content(STORAGE+HTML.read_text())
        check('Welcome exposes a starter entry without creating a project',page.locator('#content [data-action="nav"][data-value="starters"]').count()==1 and js('project()===null'))
        act('nav','starters','#sidebar')
        check('Gallery shows nine built-in project starters',page.locator('.starter-card').count()==9)
        check('Browsing does not initialize the project',js('project()===null'))
        check('Gallery calls out the runnable shell and remaining work','not a finished plugin' in page.locator('#content').inner_text())
        page.screenshot(path=str(OUT/'01-gallery-dark.png'))
        page.locator('#starter-search').fill('research')
        check('Search finds a use case by tags',page.locator('.starter-card').count()==1 and 'Knowledge Collection' in page.locator('.starter-card').inner_text())
        check('Search retains the focused field',page.locator('#starter-search').evaluate('(e)=>e===document.activeElement'))
        page.locator('#starter-search').fill('does-not-exist')
        check('No-results state retains Start Blank',page.locator('.starter-empty [data-action="starter-open"][data-value="blank"]').count()==1)
        act('starter-clear');page.locator('#starter-category').select_option('Capture')
        check('Category filter yields capture and journal starters',page.locator('.starter-card').count()==2)
        page.locator('#starter-category').select_option('all');configure('quick-capture')
        check('Configuration previews scope without project mutation',js('project()===null') and 'Still yours to implement' in page.locator('#modal').inner_text())
        page.locator('#f-starter-name').fill('Abandoned draft');act('close',scope='#modal')
        check('Dirty starter form requires explicit discard',page.locator('#discard-dialog').is_visible())
        page.locator('#discard-confirm').click();check('Discard preserves empty workspace',js('project()===null'))
        configure('quick-capture');page.locator('#f-starter-id').fill('../unsafe');review()
        check('Invalid identity is rejected without mutation',js('project()===null') and len(page.locator('#starter-error').inner_text())>0)
        page.locator('#f-starter-id').fill('capture-tools');page.locator('#f-starter-name').fill('Capture Tools');review()
        check('Reviewed copy retains configured identity and original internal labels',js('projectTransferUi.candidate.id==="capture-tools" && projectTransferUi.candidate.name==="Capture Tools" && projectTransferUi.candidate.design.nodes.some(n=>n.label==="Capture an idea")'))
        check('Starter provenance is disclosed in review',page.locator('#starter-review-context').count()==1)
        act('starter-back',scope='#modal')
        check('Back preserves configured identity',page.locator('#f-starter-id').input_value()=='capture-tools')
        page.locator('.starter-folders summary').click();page.locator('#f-starter-codebaseFolder').fill('plugin/src');page.locator('#f-starter-testsFolder').fill('plugin/tests');review()
        check('Custom folders survive configuration and review',js('projectTransferUi.candidate.folders.codebaseFolder==="plugin/src" && projectTransferUi.candidate.folders.testsFolder==="plugin/tests"'))
        act('project-import-apply',scope='#modal')
        check('Explicit confirmation is mandatory',js('project()===null') and 'confirm' in page.locator('#project-transfer-error').inner_text())
        page.screenshot(path=str(OUT/'02-starter-review.png'));apply()
        check('Confirmation installs exactly one planning project',js('project().id==="capture-tools" && !project().trusted && !project().enabled && project().phase==="planning" && validState(state)'))
        check('Starter provenance survives normal export',js('JSON.parse(companionJson()).notes.some(n=>n.includes("quick-capture @ 1.0.0"))'))
        original=js('companionProjectToken()');act('starter-generate')
        check('Handoff uses real plan/hash/apply and qualified project verification',all(t in page.locator('#modal').inner_text() for t in ['companion:scaffold','--apply','npm ci','verify:project','dist/main.js']))
        with page.expect_download() as event:act('project-backup',scope='#modal')
        download=event.value;download.save_as(str(OUT/'configured-project.json'));exported=(OUT/'configured-project.json').read_text()
        check('Actual handoff download is the complete configured project',json.loads(exported)==json.loads(js('companionJson()')) and download.suggested_filename=='capture-tools.companion.json')
        probe=subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',"import {projectModel} from './scripts/companion/compiler/model.ts';let t='';for await(const c of process.stdin)t+=c;const m=projectModel(JSON.parse(t));console.log(JSON.stringify({id:m.project.id,source:m.sourceRoot,tests:m.testRoot}));"],input=exported,text=True,capture_output=True,cwd=ROOT,timeout=20)
        check('Actual browser download is consumed by the real compiler',probe.returncode==0 and json.loads(probe.stdout)=={'id':'capture-tools','source':'plugin/src/generated','tests':'plugin/tests/project'},'Actual Node compiler subprocess on downloaded bytes')
        act('close',scope='#modal');act('nav','starters','#sidebar');configure('blank');review();act('close',scope='#modal')
        check('Cancelled replacement preserves the full current project and files',js('companionProjectToken()')==original)
        # Controlled states are safety negative proofs, not real native operations.
        configure('blank');js('state.vaultFiles["unrelated.md"]="keep"');review()
        check('Changed project/file snapshot blocks configuration submit','changed' in page.locator('#starter-error').inner_text() and js('project().id==="capture-tools"'))
        act('close',scope='#modal');configure('blank');review();js('state.vaultFiles["unrelated.md"]="changed after review"');page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        check('Changes after review block confirmed replacement','changed' in page.locator('#project-transfer-error').inner_text() and js('project().id==="capture-tools"'))
        act('close',scope='#modal');js('save()');configure('blank');review()
        pasted=js('projectTransferUi.text');page.locator('#project-import-text').fill(pasted+' ')
        check('Edited import bytes invalidate provenance and old review',js('!projectTransferUi.starter && !projectTransferUi.candidate') and page.locator('#starter-review-context').count()==0 and page.locator('#modal [data-action="project-import-apply"]').is_disabled())
        act('close',scope='#modal');page.locator('#discard-confirm').click()
        configure('blank');review();apply()
        check('Start Blank has no example domain, recipes, PRDs or detail designs',js('project().design.semantic.entities.length===0 && project().design.dataSources.sources.length===0 && project().design.prds.length===0 && project().design.library.length===0 && project().design.detailDesigns.documents.length===0'))
        check('Confirmed replacement retains unrelated host files',js('state.vaultFiles["unrelated.md"]==="changed after review"'))
        # Every built-in goes through real configuration/review/confirm, not just JSON parsing.
        for identifier in js('starterCatalog.starters.map(s=>s.id)'):
            act('nav','starters','#sidebar');before=js('JSON.stringify(starterCatalog)');configure(identifier);review();apply()
            check(identifier+' can be selected, reviewed, retained and round-tripped',js('validState(state) && companionCandidate(companionJson()).id===project().id'))
            check(identifier+' leaves the built-in source unchanged',js('JSON.stringify(starterCatalog)')==before)
        act('nav','starters','#sidebar');act('theme',scope='body');page.screenshot(path=str(OUT/'03-gallery-light.png'))
        page.set_viewport_size({'width':820,'height':1000});page.screenshot(path=str(OUT/'04-gallery-narrow.png'))
        check('Gallery cards do not overflow their content region at narrow width',js('[...document.querySelectorAll(".starter-card")].every(e=>e.getBoundingClientRect().right<=document.getElementById("content").getBoundingClientRect().right+1)'))
        # Explicit storage and ownership guards use fresh controlled contexts.
        page.set_viewport_size({'width':1440,'height':1000});reset();js('storageWarning="Controlled storage failure"');configure('blank')
        check('Storage warning prevents opening replacement',not page.locator('#modal').is_visible() and js('project()===null'))
        reset();js('state.activeRun={id:"controlled-busy"}');configure('blank')
        check('Active run prevents replacement',not page.locator('#modal').is_visible() and js('project()===null'))
        reset();js('state.vaultFiles["Project.md"]="foreign record"');configure('blank')
        check('Unowned Project.md is never replaced',not page.locator('#modal').is_visible() and js('state.vaultFiles["Project.md"]==="foreign record"'))
        reset();configure('blank');review();before=js('companionProjectToken()');js('window.__originalSetItem=localStorage.setItem;localStorage.setItem=()=>{throw Error("controlled quota")};void 0');page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        check('Failed persistence rolls back the in-memory replacement',js('companionProjectToken()')==before and 'could not be saved' in page.locator('#project-transfer-error').inner_text())
        js('localStorage.setItem=window.__originalSetItem;void 0');check('No browser runtime error or network request',not errors and not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal);page.screenshot(path=str(OUT/'failure.png'))
    finally:
        browser.close()
report={'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'scope':'Offline Chromium controls, complete download/compiler handoff, canonical round trips, and controlled failure fixtures. Not native Obsidian, real quota exhaustion, screen-reader or touch qualification.'}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
