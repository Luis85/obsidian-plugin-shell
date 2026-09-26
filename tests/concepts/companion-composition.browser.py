"""Full self-project composition: real controls plus explicitly scoped model/performance probes."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
HTML=ROOT/'docs/concepts/companion/index.html'
OUT=ROOT/'reports/concepts/composition';OUT.mkdir(parents=True,exist_ok=True)
STORAGE="""<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""
checks,errors,requests,fatal=[],[],[],None

def check(name,value,scope='Actual browser controls and canonical model readback'):
 checks.append({'name':name,'result':'passed' if value else 'failed','scope':scope});print(('PASS ' if value else 'FAIL ')+name,flush=True);assert value,name

def js(code,arg=None):return page.evaluate(code,arg)
def act(action,value=None,scope='#content'):
 suffix='' if value is None else '[data-value='+json.dumps(value)+']'
 page.locator(f'{scope} [data-action="{action}"]{suffix}').first.click()
def field(name):return page.locator('[data-field="'+name+'"]')
def save():
 act('cp-save',scope='#modal');page.locator('#modal').wait_for(state='hidden')
def shot(name):page.screenshot(path=str(OUT/name))

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True);page.set_default_timeout(10000)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url))
 try:
  page.set_content(STORAGE+HTML.read_text());act('project-example');page.locator('#project-import-confirm').check();act('project-import-apply',scope='#modal')
  check('Complete self-project imports through review and explicit confirmation',js('validState(state)&&dtStore().documents.length===81&&dtStore().revisions.length===54'))
  check('Golden JSON equals the actual embedded self-project',json.loads(js('companionJson(companionExampleProject())'))==json.loads((HTML.parent/'companion-project.json').read_text()))
  act('nav','pages','#sidebar');check('Pages reports complete page and component design coverage','27/27 page designs' in page.locator('#content').inner_text() and '54/54 component designs' in page.locator('#content').inner_text())
  field('dt-page-search').fill('page-editor');owner=js('design().nodes.find(n=>n.slug==="page-editor").id');act('dt-page',owner);page.wait_for_selector('#dt-flow .vue-flow')
  check('Page editor retains Vue Flow and a grouped semantic element palette',page.locator('#dt-flow .vue-flow').count()==1 and all(s in page.locator('#content').inner_text() for s in ['Structure','Input and actions','Data and feedback']))
  root=js('dtDocument().nodes.find(n=>!n.parentId).id');act('dt-select',root);act('cp-layout',root);field('cp-gap').fill('24');field('cp-token-gap').select_option('');field('cp-padding').fill('20');save()
  check('Layout controls persist numeric declarations rather than CSS source',js('dtDocument().nodes[0].ui.gap===24&&dtDocument().nodes[0].ui.padding===20&&validState(state)'))
  act('dt-mode','preview');check('Preview uses saved gap and padding',page.locator('[data-design-node="'+root+'"]').first.evaluate('(e)=>getComputedStyle(e).gap==="24px"&&getComputedStyle(e).padding==="20px"'))
  act('dt-undo');check('Undo remains available on the complete 81-design project',js('dtDocument().nodes[0].ui.gap!==24&&dtStore().revisions.length===54'))
  act('dt-mode','preview');snapshot=js('JSON.stringify(design())');act('cp-play')
  focus=js('dtDocument().edges.find(e=>e.effect?.type==="focus")');page.locator('[data-cp-key="root:'+focus['source']+'"]').click()
  check('Play executes focus on the actual target control',js('(id)=>document.activeElement.closest("[data-design-node]").dataset.designNode===id',focus['target']))
  page.locator('[data-design-node="'+focus['target']+'"] input').fill('Retained preview query');check('Preview input remains ephemeral',snapshot==js('JSON.stringify(design())') and js('cpUi.session.values',None).get(focus['target'])=='Retained preview query')
  act('cp-reset');check('Reset restores the scenario without writing authoring data',snapshot==js('JSON.stringify(design())') and js('Object.keys(cpUi.session.values).length===0'))
  act('cp-compare');field('cp-preview-comparison').select_option('widths');check('Wide and narrow frames share one authored document',page.locator('.cp-compare>section').count()==2 and snapshot==js('JSON.stringify(design())'));shot('01-responsive-comparison.png')
  field('cp-preview-comparison').select_option('states');check('Default/error comparison reveals actual authored feedback','Your saved design is unchanged' in page.locator('.cp-compare>section').nth(1).inner_text())
  act('cp-compare');act('cp-scenario');field('cp-name').fill('Search fixture');field('cp-values').fill(json.dumps({focus['target']:'Literal fixture <script>safe</script>'}));save()
  scenario=js('dtDocument().scenarios.at(-1).id');field('cp-preview-scenario').select_option(scenario)
  check('Saved scenario restores literal values into the actual input',page.locator('[data-design-node="'+focus['target']+'"] input').input_value()=='Literal fixture <script>safe</script>')
  act('cp-scenario',scenario);recipe=js('tdSettings().recipes.find(r=>r.enabled).operation');field('cp-recipe').select_option(recipe);act('cp-capture-recipe',scope='#modal');check('Recipe capture runs only the seeded memory generator',js('cpUi.form.record.recipe.engine==="shell-fixtures/1"&&JSON.parse(cpUi.form.bindingsText).length>0'));save()
  check('Captured recipe provenance is portable authoring data',js('dtDocument().scenarios.at(-1).recipe.operationId')==recipe)
  act('dt-mode','outline');siblings=js('dtDocument().nodes.filter(n=>n.parentId===dtDocument().nodes[0].id&&!n.component).slice(0,2).map(n=>n.id)')
  for id in siblings:act('cp-multi',id)
  check('Checkboxes provide non-drag multiple selection',js('cpSelection().length')==2)
  act('cp-align','left');act('cp-group');check('Grouping creates one semantic region without losing children',js('cpSelection().length===1&&dtDocument().nodes.filter(n=>n.parentId===dtUi.selected).length===2'))
  count=js('dtDocument().nodes.length');act('cp-copy');act('dt-select',root);act('cp-paste');check('Copy/paste remaps descendants to unique local identities',js('dtDocument().nodes.length')==count+3 and js('new Set(dtDocument().nodes.map(n=>n.id)).size===dtDocument().nodes.length&&validState(state)'))
  act('dt-undo');act('dt-undo')
  instance=js('dtDocument().nodes.find(n=>n.component&&cpDefinition(n).slots.trim())');act('dt-select',instance['id']);act('cp-add-slot');field('dt-label').fill('Page-owned extra content');field('dt-text').fill('Owned by this page, not by the reusable definition.');act('dt-save',scope='#modal');page.locator('#modal').wait_for(state='hidden')
  check('Named-slot editing retains page ownership and published component identity',js('(id)=>dtDocument().nodes.some(n=>n.label==="Page-owned extra content"&&n.parentId===id&&n.slotName)',instance['id']))
  old=js('(id)=>JSON.stringify(dtStore().revisions.find(r=>r.id===id))',instance['component']['revisionId']);act('dt-select',instance['id']);act('dt-component',instance['component']['id']);act('dt-mode','outline')
  text=js('dtDocument().nodes.find(n=>n.kind==="text"||n.kind==="heading").id');act('dt-edit',text);field('dt-text').fill('New working component title');act('dt-save',scope='#modal');page.locator('#modal').wait_for(state='hidden');act('dt-mode','review');act('cp-publish');act('cp-save',scope='#modal')
  check('Revision publication requires explicit confirmation',page.locator('#modal').is_visible() and 'Confirm' in page.locator('#cp-error').inner_text())
  field('cp-confirmed').check();save();check('Publishing never rewrites an existing immutable snapshot',old==js('(id)=>JSON.stringify(dtStore().revisions.find(r=>r.id===id))',instance['component']['revisionId']))
  check('Component review shows transitive impact and explicit pinned state','Direct and transitive usage' in page.locator('#content').inner_text() and 'Pinned' in page.locator('#content').inner_text());shot('02-component-revisions.png')
  act('dt-back');act('dt-select',instance['id']);act('cp-pin',instance['id']);check('Instance upgrade shows old and working contracts plus retained slot mappings',page.locator('#modal table').count()==1 and page.locator('[data-field^="cp-remap-"]').count()>=1)
  field('cp-confirmed').check();save();check('Reviewed upgrade changes only this pin and preserves page-owned slot content',js('(id)=>{const n=dtDocument().nodes.find(n=>n.id===id);return n.component.revisionId!=='+json.dumps(instance['component']['revisionId'])+'&&dtDocument().nodes.some(c=>c.label==="Page-owned extra content"&&c.parentId===id)}',instance['id']))
  act('dt-mode','preview');act('cp-tests');check('UI-effect test export includes real assertions and explicit scope','node:test' in page.locator('#modal textarea').input_value() and 'assert.equal' in page.locator('#modal textarea').input_value());act('close',scope='#modal')
  check('Current complete project round-trips under the shared v4 contract',js('(()=>{const s=companionJson(project());return JSON.stringify(parseCompanionDocument(s).design.detailDesigns)===JSON.stringify(JSON.parse(s).design.detailDesigns)})()'))
  # Controlled direct route selection covers every canonical design and actual rendered DOM.
  inventory=js('dtStore().documents.map(d=>({id:d.id,kind:d.kind,ownerId:d.ownerId}))')
  for item in inventory:
   js('(d)=>{dtOpen(d.kind,d.ownerId);dtUi.mode="preview";cpUi.compare=false;cpUi.session=null;render()}',item)
   check('Rendered design '+item['id'],page.locator('.dt-preview-shell').is_visible() and page.locator('.dt-wireframe [data-design-node]').count()>0,'Direct canonical route selection and actual rendered DOM, not 81 independent end-user journeys')
  measurements=js('''()=>{const doc=dtDocument(),times=[];for(let i=0;i<30;i++){const start=performance.now();cpUi.session=null;render();times.push(performance.now()-start)}return {samples:times,p95:[...times].sort((a,b)=>a-b)[28],nodes:doc.nodes.length,scope:'Synchronous complete render calls; shared Chromium runner, not native latency or paint timing'}}''')
  (OUT/'render-timing.json').write_text(json.dumps(measurements,indent=2));check('Thirty unfiltered renderer samples retained',len(measurements['samples'])==30 and all(v>=0 for v in measurements['samples']),'Measured diagnostic; no arbitrary performance qualification threshold')
  js('dtOpen("page",design().nodes.find(n=>n.slug==="page-editor").id);dtUi.mode="canvas";render()');page.wait_for_selector('#dt-flow .vue-flow');shot('03-page-canvas-dark.png')
  js('state.settings.theme="light";dtUi.mode="preview";render()');shot('04-page-preview-light.png')
  page.set_viewport_size({'width':390,'height':844});act('dt-mode','outline');shot('05-mobile-outline.png');check('Narrow outline has no horizontal document overflow',js('document.documentElement.scrollWidth<=innerWidth'))
  root=js('dtDocument().nodes[0].id');act('dt-select',root);act('cp-layout',root);shot('06-mobile-layout-form.png');check('Layout form is bounded and save action remains reachable',page.locator('#modal').bounding_box()['width']<=390 and page.locator('#modal [data-action="cp-save"]').is_visible());act('close',scope='#modal')
  act('dt-back');check('Leaving canvas releases the Vue Flow app',js('!dtUi.app'))
  check('No browser errors or external requests',not errors and not requests)
 except Exception as e:
  fatal=str(e);traceback.print_exc();shot('failure.png')
 browser.close()
(OUT/'checks.json').write_text(json.dumps({'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'scope':'Browser concept, controlled Storage adapter, actual controls and explicitly scoped model/render probes; not native qualification.'},indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
