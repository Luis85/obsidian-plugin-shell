"""Actual external-starter selection/export controls and isolated canonical safety fixtures."""
import hashlib
import json
import os
import subprocess
import tempfile
import time
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[4]
HTML=ROOT/'docs/concepts/companion/index.html'
OUT=ROOT/'reports/concepts/project-starters';OUT.mkdir(parents=True,exist_ok=True)
# Explicit host-boundary substitutions: in-memory Storage, and SHA-256 through Node because an inline page is not a secure context.
STORAGE="""<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});Object.defineProperty(window.crypto,'subtle',{value:{digest:async(name,bytes)=>new Uint8Array(await window.testDigest(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes))).buffer}});</script>"""
# The twelve focused example starters are external JSON definitions; the workspace embeds none.
EXAMPLES=['agent-ready','blank','command-utility','context-menu','custom-file-view','daily-journal','import-integration','knowledge-collection','note-inspector','quick-capture','tasks-projects','vault-dashboard']
checks,errors,requests,fatal=[],[],[],None

def check(name,value,scope='Actual controls and canonical state readback'):
    checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope})
    print(('PASS ' if value else 'FAIL ')+name,flush=True)
    assert value,name

def js(code,arg=None):return page.evaluate(code,arg)
def act(action,value=None,scope='#content'):
    suffix='' if value is None else '[data-value='+json.dumps(value)+']'
    page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def settle():
    for _ in range(200):
        if not js('starterWorkspaceUi.loading'):return
        time.sleep(0.05)
    raise AssertionError('Starter definitions did not finish loading')
def load_examples():
    page.locator('#starter-definition-files').set_input_files([str(ROOT/'configs/starters'/(identifier+'.json')) for identifier in EXAMPLES]);settle()
def reset():
    page.goto('about:blank')
    page.set_content(STORAGE+HTML.read_text());act('nav','starters','#sidebar');load_examples()
def configure(identifier):act('starter-open',identifier)
def review():act('starter-review',scope='#modal')
def apply():
    page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
    # A confirmed starter opens the untrusted setup review; close it to keep designing.
    if js('modalType==="wizard"'):act('close',scope='#modal')
def handoff_checks():
    modal=page.locator('#modal');text=modal.inner_text();command=modal.locator('.command code').inner_text()
    check('Generation shows the starter command with the project id and reviewed recipe',command=='node bin/app new ../capture-tools --starter quick-capture' and 'companion:scaffold' not in text)
    check('Execution stays a separate reviewed shell step','This browser does not run processes' in text and '--yes' in text and 'starters run' in text and js('state.runs.length')==0)
    check('Starter and project exports are both offered',modal.locator('.dialog-footer [data-action="starter-export"]').count()==1 and modal.locator('.dialog-footer [data-action="project-export"]').count()==1)
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'05-handoff-narrow.png'))
    check('Handoff has no horizontal overflow at phone width',js('(()=>{const d=document.getElementById("modal");return d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll(".command")].every(e=>e.getBoundingClientRect().right<=d.getBoundingClientRect().right+1)})()'))
    page.set_viewport_size({'width':1440,'height':1000})

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('SHELL_CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);page.set_default_timeout(8000)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.expose_function('testDigest',lambda text:list(hashlib.sha256(text.encode('utf-8')).digest()))
    try:
        page.set_content(STORAGE+HTML.read_text())
        check('Welcome exposes a starter entry without creating a project',page.locator('#content [data-action="nav"][data-value="starters"]').count()==1 and js('project()===null'))
        act('nav','starters','#sidebar')
        check('The workspace starts with no embedded starter definitions',page.locator('.starter-card').count()==0 and js('starterCatalog.starters.length===0') and 'No starter definitions loaded' in page.locator('#content').inner_text())
        load_examples()
        check('Gallery shows the twelve selected example starter definitions',page.locator('.starter-card').count()==12 and not js('starterWorkspaceUi.error'))
        check('A starter with development tooling is offered and keeps its tooling',page.locator('[data-action="starter-open"][data-value="agent-ready"]').count()==1 and js('starterEntry("agent-ready").document.tooling.airship.enabled===true && starterEntry("agent-ready").document.tooling.hindsight.enabled===true'))
        check('Browsing does not initialize the project',js('project()===null'))
        check('Gallery calls out external definitions and a separate shell','External, editable JSON definitions' in page.locator('#content').inner_text())
        page.screenshot(path=str(OUT/'01-gallery-dark.png'))
        page.locator('#starter-search').fill('research')
        check('Search finds a use case by tags',page.locator('.starter-card').count()==1 and 'Knowledge Collection' in page.locator('.starter-card').inner_text())
        check('Search retains the focused field',page.locator('#starter-search').evaluate('(e)=>e===document.activeElement'))
        page.locator('#starter-search').fill('does-not-exist')
        check('No-results state offers clearing filters and a blank project',page.locator('.starter-empty [data-action="starter-clear"]').count()==1 and page.locator('.starter-empty [data-action="starter-blank"]').count()==1)
        act('starter-clear');page.locator('#starter-category').select_option('Capture')
        check('Category filter yields capture and journal starters',page.locator('.starter-card').count()==2)
        page.locator('#starter-category').select_option('all');configure('quick-capture')
        check('Configuration previews scope without project mutation',js('project()===null') and 'Remaining development and qualification' in page.locator('#modal').inner_text())
        page.locator('#starter-name').fill('Abandoned draft');act('close',scope='#modal')
        check('Dirty starter form requires explicit discard',page.locator('#discard-dialog').is_visible())
        page.locator('#discard-confirm').click();check('Discard preserves empty workspace',js('project()===null'))
        configure('quick-capture');page.locator('#starter-id').fill('../unsafe');review()
        check('Invalid identity is rejected without mutation',js('project()===null') and len(page.locator('#starter-error').inner_text())>0)
        page.locator('#starter-id').fill('capture-tools');page.locator('#starter-name').fill('Capture Tools');review()
        check('Reviewed copy retains configured identity and original internal labels',js('projectTransferUi.candidate.id==="capture-tools" && projectTransferUi.candidate.name==="Capture Tools" && projectTransferUi.candidate.design.nodes.some(n=>n.label==="Capture an idea")'))
        check('Starter provenance is disclosed in review',page.locator('#starter-review-context').count()==1)
        act('starter-back',scope='#modal')
        check('Back preserves configured identity',page.locator('#starter-id').input_value()=='capture-tools')
        page.locator('#starter-codebaseFolder').fill('plugin/src');page.locator('#starter-testsFolder').fill('plugin/tests');review()
        check('Custom folders survive configuration and review',js('projectTransferUi.candidate.folders.codebaseFolder==="plugin/src" && projectTransferUi.candidate.folders.testsFolder==="plugin/tests"'))
        act('project-import-apply',scope='#modal')
        check('Explicit confirmation is mandatory',js('project()===null') and 'confirm' in page.locator('#project-transfer-error').inner_text())
        page.screenshot(path=str(OUT/'02-starter-review.png'));page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
        check('Confirmation opens the untrusted setup review',js('modalType==="wizard" && !state.wizard.trusted'));act('close',scope='#modal')
        check('Confirmation installs exactly one planning project',js('project().id==="capture-tools" && !project().trusted && !project().enabled && project().phase==="planning" && validState(state)'))
        check('Starter provenance survives normal export',js('JSON.parse(companionJson()).notes.some(n=>n.includes("quick-capture @ 1.0.0"))'))
        original=js('companionProjectToken()');act('starter-generate');handoff_checks()
        act('starter-export',scope='#modal');starter=json.loads(js('modalData.text'))
        check('Starter export carries the edited project, identity defaults and the unapproved recipe',starter['id']=='quick-capture' and starter['generator']['document']==json.loads(js('companionJson()')) and next(i for i in starter['inputs'] if i['id']=='id')['default']=='capture-tools' and starter['generator']['document']['executable'] is False)
        act('close',scope='#modal');act('starter-generate');act('project-export',scope='#modal')
        with page.expect_download() as event:act('download-text',scope='#modal')
        download=event.value;download.save_as(str(OUT/'configured-project.json'));exported=(OUT/'configured-project.json').read_text()
        check('Actual project download is the complete configured schema 6 project',json.loads(exported)==json.loads(js('companionJson()')) and json.loads(exported)['schemaVersion']==6 and download.suggested_filename=='capture-tools.companion.json')
        model="import {projectModel} from './src/cli/compiler/emitters/model.ts';let t='';for await(const c of process.stdin)t+=c;const m=projectModel(JSON.parse(t));console.log(JSON.stringify({id:m.project.id,source:m.sourceRoot,tests:m.testRoot}));"
        probe=subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',model],input=exported,text=True,capture_output=True,cwd=ROOT,timeout=20)
        check('Actual browser download is consumed by the real compiler',probe.returncode==0 and json.loads(probe.stdout)=={'id':'capture-tools','source':'plugin/src/generated','tests':'plugin/tests/project'},'Actual Node compiler subprocess on downloaded bytes')
        with tempfile.TemporaryDirectory(prefix='companion-handoff-') as scratch:
            work=Path(scratch)/'framework-checkout';(work/'configs/starters').mkdir(parents=True);(work/'configs/starters/quick-capture.json').write_text(json.dumps(starter,indent=2)+'\n')
            run=subprocess.run(['node',str(ROOT/'bin/app'),'new','../capture-tools','--starter','quick-capture','--json'],text=True,capture_output=True,cwd=work,timeout=120)
            result=json.loads(run.stdout) if run.returncode==0 else {}
            check('The displayed starter command plans the exported starter without writing',result.get('status')=='planned' and result['data']['summary']['identity']['id']=='capture-tools' and result['data']['written'] is False and sorted(p.name for p in Path(scratch).iterdir())==['framework-checkout'],'Actual framework CLI subprocess on the exported starter: '+run.stderr[-400:])
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
        check('Start Blank has no example domain, recipes, PRDs or page and component designs',js('project().design.semantic.entities.length===0 && project().design.dataSources.sources.length===0 && project().design.prds.length===0 && project().design.library.length===0 && veStore(project().design).pages.length===0 && veStore(project().design).components.length===0'))
        check('Confirmed replacement retains unrelated host files',js('state.vaultFiles["unrelated.md"]==="changed after review"'))
        # Every loaded example goes through real configuration/review/confirm, not just JSON parsing.
        for identifier in js('starterCatalog.starters.map(s=>s.id)'):
            act('nav','starters','#sidebar');before=js('JSON.stringify(starterCatalog)');configure(identifier)
            if identifier=='custom-file-view':page.locator('#starter-extension').fill('board')
            if identifier=='context-menu':page.locator('#starter-extensions').fill('md,txt')
            review();apply()
            if identifier=='custom-file-view':check('Configured native extension survives actual project export',js('JSON.parse(companionJson()).design.nativeIntegrations.fileTypes[0].extension==="board"'))
            if identifier=='context-menu':check('Configured file-menu filters survive actual project export',js('JSON.parse(companionJson()).design.nativeIntegrations.contextMenus[0].extensions')==['md','txt'])
            check(identifier+' can be selected, reviewed, retained and round-tripped',js('validState(state) && companionCandidate(companionJson()).id===project().id'))
            check(identifier+' leaves the loaded definition unchanged',js('JSON.stringify(starterCatalog)')==before)
        native_before=js('JSON.stringify(design().nativeIntegrations)')
        js('recordDesign();delete design().nativeIntegrations;designChanged();designTravel("undo")')
        check('Undo restores native declarations exactly',js('JSON.stringify(design().nativeIntegrations)')==native_before)
        js('designTravel("redo")');check('Redo removes absent native declarations rather than leaking stale registrations',js('!Object.hasOwn(design(),"nativeIntegrations")'))
        js('designTravel("undo")');check('Blueprint export retains the native namespace',js('JSON.stringify(portableDesign().nativeIntegrations)')==native_before)
        js('importDesign(JSON.stringify({...portableDesign(),nativeIntegrations:undefined}))')
        check('Blueprint replacement clears omitted native declarations',js('!Object.hasOwn(design(),"nativeIntegrations")'))
        js('designTravel("undo")');check('Blueprint import undo restores native declarations',js('JSON.stringify(design().nativeIntegrations)')==native_before)
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
