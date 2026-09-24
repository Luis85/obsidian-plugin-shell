"""ER paths, guidelines, edit transactions and interaction states on the exact artifact."""
import hashlib
import json
import os
import re
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/er-polish'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None
STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{
getItem:k=>__saved[k]??null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]}});</script>"""


def ok(name, condition, scope='Real DOM interaction with canonical state readback'):
    checks.append({'name': name, 'result': 'passed' if condition else 'failed', 'scope': scope})
    print(('PASS ' if condition else 'FAIL ') + name, flush=True)
    assert condition, name


def act(action, value=None, within=''):
    sel = within + f' [data-action="{action}"]'
    if value is not None:
        sel += f'[data-value="{value}"]'
    page.locator(sel.strip()).first.click()


def js(code):
    return page.evaluate(code)


def drag(selector, dx, dy, hold=False):
    box = page.locator(selector).bounding_box()
    x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x+dx, y+dy, steps=14)
    if not hold:
        page.mouse.up(); page.wait_for_timeout(80)


ENDPOINTS = """()=>[...document.querySelectorAll('#er-flow .vue-flow__edge')].map(g=>{
 const edge=erUi.api.findEdge(g.dataset.id),path=g.querySelector('.vue-flow__edge-path'),ctm=path.getScreenCTM();
 return ['source','target'].map((kind,i)=>{
 const el=document.querySelector('#er-flow [data-id="'+edge[kind]+'"] [data-handleid="'+edge[kind+'Handle']+'"]');
 const r=el.getBoundingClientRect(),side=['left','right','top','bottom'].find(s=>el.classList.contains('vue-flow__handle-'+s));
 const point=path.getPointAtLength(i?path.getTotalLength():0).matrixTransform(ctm);
 const x=side==='left'?r.left:side==='right'?r.right:r.left+r.width/2,y=side==='top'?r.top:side==='bottom'?r.bottom:r.top+r.height/2;
 return Math.hypot(point.x-x,point.y-y)<2;
 });
}).flat()"""
HIT_TEST = """()=>{
 const root=document.getElementById('er-flow'),bounds=root.getBoundingClientRect();let tested=0,missed=0;
 for(const g of root.querySelectorAll('.vue-flow__edge')){const path=g.querySelector('.vue-flow__edge-path');
  for(const f of [.12,.28,.43,.57,.73,.88]){const p=path.getPointAtLength(path.getTotalLength()*f).matrixTransform(path.getScreenCTM());
   if(p.x<=bounds.left+3||p.x>=bounds.right-3||p.y<=bounds.top+3||p.y>=bounds.bottom-3)continue;
   const hit=document.elementFromPoint(p.x,p.y);if(hit?.closest('.er-card,.er-section-frame button'))continue;
   tested++;if(!hit?.closest('.vue-flow__edge'))missed++;
  }
 }return {tested,missed};
}"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1700, 'height': 1250}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('request', lambda r: requests.append(r.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act('sample', within='main'); act('nav', 'entities', '#sidebar'); act('er-example')
        page.wait_for_function('erUi.api.getNodes.value.every(n=>n.dimensions.width>0)&&!erUi.fitRequested')
        ids = js('Object.fromEntries(semanticModel().entities.map(e=>[e.name,e.id]))')
        task, person, project = ids['Task'], ids['Person'], ids['Project']
        edge = js('semanticModel().relationships[1].id')
        before = js('JSON.stringify(designFiles(design()))')
        ok('Fit waits for measured nodes and contains all entity cards', js("(()=>{const b=document.getElementById('er-flow').getBoundingClientRect();return [...document.querySelectorAll('.er-card')].every(c=>{const r=c.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom})})()"), 'Rendered geometry')
        ok('The actual edge SVG permits world-coordinate paths while the outer view clips', js("[...document.querySelectorAll('#er-flow svg.vue-flow__edges')].every(s=>getComputedStyle(s).overflow==='visible')&&getComputedStyle(document.getElementById('er-flow')).overflow==='hidden'"), 'Computed presentation')
        ok('Many cardinalities use three prongs opening toward their entity', js("(()=>{const g=document.querySelector('.er-cardinality'),lines=g.querySelectorAll('line');return lines[0].getAttribute('x1')==='1'&&lines[0].getAttribute('y1')==='-6'&&lines[0].getAttribute('x2')==='14'&&lines[1].getAttribute('y1')==='6'})()"), 'Actual rendered cardinality geometry')
        page.mouse.move(10,10)
        ok('Connected secondary ports remain visible without hover so lines do not end in empty space', js("erUi.api.getEdges.value.every(e=>['source','target'].every(k=>{const h=document.querySelector('#er-flow [data-id=\"'+e[k]+'\"] [data-handleid=\"'+e[k+'Handle']+'\"]');return h&&getComputedStyle(h).opacity==='1';}))"))
        ok('Every rendered relationship endpoint meets its actual handle', all(js(ENDPOINTS)), 'SVG endpoints transformed to actual handle pixels')
        hit = js(HIT_TEST)
        ok('Visible connector segments are physically hit-testable', hit['tested'] >= 4 and hit['missed'] == 0, 'document.elementFromPoint on actual SVG samples')
        # Move the entire model far from the origin: reproduces the supplied clipping report.
        js('for(const p of Object.values(semanticModel().canvas.positions)){p.x+=24000;p.y-=18000;}render();erFit()')
        page.wait_for_function('erUi.api.getNodes.value.every(n=>n.dimensions.width>0)&&!erUi.fitRequested')
        hit = js(HIT_TEST)
        ok('Translated positive/negative world paths remain visible and hit-testable', hit['tested'] >= 4 and hit['missed'] == 0, 'Translated-world rendered hit testing')
        ok('Translated endpoints still meet both real handles', all(js(ENDPOINTS)), 'Rendered endpoint geometry')
        style = page.add_style_tag(content='#er-flow svg.vue-flow__edges{overflow:hidden!important}')
        bad = js(HIT_TEST)
        ok('The clipping regression probe fails when the old overflow bug is reintroduced', bad['missed'] > 0, 'Negative rendering fixture; not just getTotalLength')
        style.evaluate('(s)=>s.remove()')
        ok('Removing the faulty rule restores the hit-tested lines', js(HIT_TEST)['missed'] == 0)
        js('erCommit(semanticArrange,true);render();erFit()'); page.wait_for_timeout(150)
        act('er-select', task)
        ok('Sidebar selection and diagram selection agree', page.locator(f'.er-catalog-item[data-value="{task}"]').get_attribute('aria-pressed') == 'true' and js('erUi.api.findNode('+json.dumps(task)+').selected'))
        act('er-edit', task)
        ok('Entity title click opens the actual edit draft rather than swallowing the action', js('erUi.form.editing') and page.locator('#er-slug').get_attribute('readonly') is not None)
        act('close', within='#modal')
        act('er-mode', 'relationships')
        ok('Relationships have a discoverable non-canvas editing surface', page.locator('.er-relationship-item').count() == 2 and page.locator('[data-action="er-mode"][data-value="relationships"]').get_attribute('aria-pressed') == 'true')
        act('er-edge', edge)
        ok('Inspector explains both cardinalities with words and the owning field', 'zero or one Person' in page.locator('#er-inspector').inner_text() and 'task.assignee' in page.locator('#er-inspector').inner_text())
        act('er-edit-edge', edge)
        ok('Cardinality choices include human-readable meanings', 'Zero or one (0..1)' in page.locator('#er-targetCard').inner_text())
        page.locator('#er-targetCard').select_option('1..*')
        ok('Relationship preview explains mandatory plural storage before save', 'one or more Person' in page.locator('#modal').inner_text() and 'assignee: ["[[' in page.locator('.er-reference-example').inner_text())
        page.keyboard.press('Escape');page.locator('#discard-confirm').click()
        ok('Cancelling a cardinality review retains the previous field type', js('semanticModel().relationships[1].targetCard==="0..1"'))
        act('er-mode', 'map');act('er-fit');page.wait_for_timeout(100)
        # Relationship hover highlights its endpoints and owning property without writing data.
        saved = js('JSON.stringify(__saved)');hist = js('design().history.length')
        point = js("(()=>{const g=document.querySelector('#er-flow [data-er-route="+edge+"]'),p=g.querySelector('.vue-flow__edge-text').getBoundingClientRect();return {x:p.x+p.width/2,y:p.y+p.height/2}})()")
        page.mouse.move(point['x'],point['y']);page.wait_for_timeout(50)
        ok('Hovering a connection highlights both endpoint cards and the owning property', page.locator('#er-flow .er-related').count() == 2 and page.locator('#er-flow .er-owned-field').count() == 1)
        ok('Hover and selection create no source writes or undo entries', saved == js('JSON.stringify(__saved)') and hist == js('design().history.length'))
        page.mouse.click(point['x'],point['y'])
        ok('Clicking the caption selects that relationship', js('erUi.edge') == edge)
        # Numeric positioning is the pointer-only alternative to dragging.
        act('er-select', task);act('er-position', task)
        page.locator('#er-x').fill('480');page.locator('#er-y').fill('80')
        act('er-save', within='#modal')
        ok('Position form commits explicit coordinates', js('semanticModel().canvas.positions['+json.dumps(task)+'].x===480'))
        act('er-position', task);page.locator('#er-reference').select_option(project);act('er-align','top')
        ok('Alignment previews coordinates without changing canonical positions', page.locator('#er-y').input_value() == '60' and js('semanticModel().canvas.positions['+json.dumps(task)+'].y===80'))
        act('er-save',within='#modal')
        ok('Alignment commits one visual edit and leaves generator bytes unchanged', before == js('JSON.stringify(designFiles(design()))'))
        act('er-position',task);page.locator('#er-x').fill('100001');act('er-save',within='#modal')
        ok('Out-of-world coordinates keep the draft and original position', '100000' in page.locator('#er-form-error').inner_text() and js('semanticModel().canvas.positions['+json.dumps(task)+'].x===480'))
        page.keyboard.press('Escape');page.locator('#discard-confirm').click()
        # Set up a controlled layout, then use physical dragging at several zooms.
        js('erCommit(m=>{m.canvas.positions['+json.dumps(task)+']={x:460,y:160};m.canvas.positions['+json.dumps(project)+']={x:60,y:60};m.canvas.positions['+json.dumps(person)+']={x:60,y:600};},true);render();erUi.api.setViewport({x:5,y:10,zoom:.8})')
        page.wait_for_timeout(100)
        hist=js('design().history.length');pos=js('JSON.stringify(semanticModel().canvas.positions['+json.dumps(task)+'])')
        drag(f'[data-entity="{task}"] .er-card-heading small', 0, -84, True)
        ok('Physical drag displays alignment guidelines', page.locator('#er-guides line').count() > 0)
        ok('Guide feedback and preview movement do not commit during dragging', hist == js('design().history.length') and pos == js('JSON.stringify(semanticModel().canvas.positions['+json.dumps(task)+'])'))
        page.screenshot(path=str(OUT/'guidelines.png'),full_page=True)
        page.mouse.up();page.wait_for_timeout(80)
        ok('Drop snaps entity top to the matching entity and clears guidelines', js('semanticModel().canvas.positions['+json.dumps(task)+'].y===60') and page.locator('#er-guides line').count() == 0)
        ok('The section frame encloses its live members after the drop', js("erSectionNodes(semanticModel()).every(f=>{const s=semanticModel().sections.find(s=>'frame-'+s.id===f.id);return semanticModel().entities.filter(e=>e.section===s.id).every(e=>{const r=erRect(semanticModel(),e);return r.x>=f.position.x&&r.y>=f.position.y&&r.x+r.width<=f.position.x+parseFloat(f.style.width)&&r.y+r.height<=f.position.y+parseFloat(f.style.height)})})"), 'Actual model geometry')
        act('er-undo');page.wait_for_timeout(60)
        ok('Undo restores the entire pre-drag arrangement', pos == js('JSON.stringify(semanticModel().canvas.positions['+json.dumps(task)+'])'))
        # The snapping threshold is in pixels at every zoom and Alt bypasses both systems.
        for zoom in [.2,.8,2]:
            result=js('erSnapPosition(semanticModel(),'+json.dumps(task)+',{x:463,y:60+4/'+str(zoom)+'},'+str(zoom)+')')
            ok('Guideline tolerance is stable at zoom '+str(zoom), result['position']['y']==60, 'Pure helper using actual model and pixel-normalized distance')
        result=js('erSnapPosition(semanticModel(),'+json.dumps(task)+',{x:463,y:63},.8,true)')
        ok('Alt free-move bypasses guidelines and grid', result['position']=={'x':463,'y':63} and not result['guides'], 'Pure geometry helper')
        # Escape cancels physical move and still allows the next gesture.
        pos=js('JSON.stringify(semanticModel().canvas.positions['+json.dumps(task)+'])')
        drag(f'[data-entity="{task}"] .er-card-heading small', 44, 22, True)
        page.keyboard.press('Escape');page.mouse.up();page.wait_for_timeout(60)
        ok('Escape during dragging preserves saved position and clears guides', pos==js('JSON.stringify(semanticModel().canvas.positions['+json.dumps(task)+'])') and page.locator('#er-guides line').count()==0)
        page.locator(f'[data-entity="{project}"] .er-card-heading small').click()
        ok('A new pointer click selects another entity after drag cancellation', js('erUi.selected')==project)
        # Keyboard movement used to be transient Vue Flow state; it must commit and undo.
        act('er-select',task);act('er-focus',task);node=page.locator(f'#er-flow .vue-flow__node[data-id="{task}"]');node.focus()
        x=js('semanticModel().canvas.positions['+json.dumps(task)+'].x');page.keyboard.press('Shift+ArrowRight')
        ok('Keyboard nudge is persisted in the semantic canvas, not only Vue Flow', js('semanticModel().canvas.positions['+json.dumps(task)+'].x')==x+20)
        page.keyboard.press('Control+z');page.wait_for_timeout(80)
        ok('Keyboard undo restores that nudge', js('semanticModel().canvas.positions['+json.dumps(task)+'].x')==x)
        act('er-focus',task);node.focus();page.keyboard.press('Enter')
        ok('Keyboard Enter opens the correct entity', page.locator('#modal').is_visible() and js('erUi.form.id')==task)
        count=page.locator('.er-property-row').count();page.keyboard.press('Control+Enter')
        ok('Ctrl Enter appends and focuses a new property row', page.locator('.er-property-row').count()==count+1 and js('document.activeElement.id')==f'er-p-{count}-key')
        page.keyboard.press('Escape');page.locator('#discard-confirm').click()
        # Quick authoring, duplicate prevention, invalid values and repeated add.
        act('er-add');page.locator('#er-name').fill('Milestone');act('er-quick-property','title');act('er-quick-property','due')
        ok('Quick properties create the declared types without duplicates', js('erUi.form.properties[0].required&&erUi.form.properties[1].type==="date"') and page.locator('[data-action="er-quick-property"][data-value="title"]').is_disabled())
        page.locator('#er-folder').fill('Records/Delivery');page.locator('#er-name').fill('Delivery Milestone')
        ok('Renaming a new entity preserves an explicitly edited note folder', page.locator('#er-folder').input_value()=='Records/Delivery')
        act('er-save-next',within='#modal')
        ok('Save and add another commits once and opens a fresh draft', js('semanticModel().entities.length===4&&!erUi.form.id&&!erUi.form.editing') and page.locator('#modal').is_visible())
        act('close',within='#modal')
        # Self-reference, reverse/stacked layouts and height changes retain valid endpoints.
        js('erBeginRelationship('+json.dumps(task)+','+json.dumps(task)+')');page.locator('#er-key').fill('parent');page.locator('#er-name').fill('Child of');act('er-save',within='#modal')
        act('er-fit');page.wait_for_timeout(80)
        ok('Self-reference has a non-zero outside-card path', js("(()=>{const r=semanticModel().relationships.at(-1),g=document.querySelector('[data-er-route=\"'+r.id+'\"]');return g&&g.querySelector('path').getTotalLength()>100&&g.dataset.obstructed==='false'})()"), 'Rendered SVG route')
        ok('All endpoints remain attached after self-reference and new entity additions', all(js(ENDPOINTS)), 'Rendered endpoint geometry')
        for positions in [{'x':-600,'y':70},{'x':450,'y':-440}]:
            js('erCommit(m=>{m.canvas.positions['+json.dumps(person)+']='+json.dumps(positions)+';},true);render();erFit()');page.wait_for_timeout(80)
            ok('Automatic facing ports stay attached for '+str(positions), all(js(ENDPOINTS)), 'Rendered reverse/above-node geometry')
        act('er-edit',task);act('er-quick-property','status');act('er-save',within='#modal');act('er-fit');page.wait_for_timeout(80)
        ok('Adding fields refreshes measured height and all attached endpoints', all(js(ENDPOINTS)), 'Rendered geometry after dimension change')
        page.locator('#er-query').fill('assignee')
        ok('Entity search includes relationship-owned properties', page.locator('.er-catalog-item').count()==1 and page.locator('.er-catalog-item').get_attribute('data-value')==task)
        page.locator('#er-query').fill('no match here');act('er-clear-search')
        ok('Clear search restores all entities and keyboard focus', page.locator('.er-catalog-item').count()==4 and js('document.activeElement.id')=='er-query')
        js('erCommit(semanticArrange,true);render()');act('er-select',task);act('er-fit');page.wait_for_timeout(80)
        card=page.locator(f'[data-entity="{task}"]');page.mouse.move(10,10)
        page.screenshot(path=str(OUT/'editor-dark.png'),full_page=True)
        # The same real pointer path exposes both connection acceptance and cancellation states.
        handle = page.locator(f'[data-entity="{task}"] [data-handleid="out"]')
        target = page.locator(f'[data-entity="{person}"] [data-handleid="in"]')
        source_box, target_box = handle.bounding_box(), target.bounding_box()
        before_links = js('JSON.stringify(semanticModel().relationships)')
        page.mouse.move(source_box['x']+source_box['width']/2,source_box['y']+source_box['height']/2)
        page.mouse.down();page.mouse.move(target_box['x']+target_box['width']/2,target_box['y']+target_box['height']/2,steps=16)
        ok('Drag-to-connect shows a valid target and a visible themed acceptance state', target.evaluate('(e)=>e.classList.contains("valid")') and target.evaluate('(e)=>getComputedStyle(e).outlineStyle')!='none')
        page.keyboard.press('Escape');page.mouse.up();page.wait_for_timeout(60)
        ok('Escape cancels connector creation without a draft or model mutation', before_links==js('JSON.stringify(semanticModel().relationships)') and not page.locator('#modal').is_visible())
        page.locator(f'[data-entity="{person}"] .er-card-heading small').click()
        ok('A new pointer click selects an entity after connection cancellation', js('erUi.selected')==person)
        act('er-select',task)
        toolbar_button=page.locator('[data-action="er-help"]');toolbar_button.hover()
        normal_press=toolbar_button.evaluate('(e)=>getComputedStyle(e).boxShadow')
        page.mouse.down()
        ok('Toolbar button has genuine pressed feedback while the pointer is held', normal_press!=toolbar_button.evaluate('(e)=>getComputedStyle(e).boxShadow'))
        page.mouse.move(10,10);page.mouse.up()
        ok('Releasing the toolbar button removes pressed feedback', toolbar_button.evaluate('(e)=>getComputedStyle(e).boxShadow')==normal_press)
        before_layout=js('JSON.stringify(designFiles(design()))')
        page.locator('[data-field="er-guidelines"]').uncheck();page.locator('[data-field="er-snap"]').uncheck()
        ok('Guideline and grid toggles retain the unchecked setting without altering generator input', js('!semanticModel().canvas.guides&&!semanticModel().canvas.snap') and before_layout==js('JSON.stringify(designFiles(design()))'))
        page.locator('[data-field="er-guidelines"]').check();page.locator('[data-field="er-snap"]').check()
        # State assertions use computed styles, not screenshots alone.
        normal=page.locator(f'[data-entity="{person}"]').evaluate('(e)=>getComputedStyle(e).borderColor')
        page.locator(f'[data-entity="{person}"]').hover()
        ok('Entity hover changes its visible border', normal!=page.locator(f'[data-entity="{person}"]').evaluate('(e)=>getComputedStyle(e).borderColor'))
        ok('Secondary ports become visible on entity hover', page.locator(f'[data-entity="{person}"] .er-secondary-port:not(.er-connected-port)').first.evaluate('(e)=>getComputedStyle(e).opacity')=='1')
        page.mouse.move(10,10)
        ok('Unused secondary ports recede without being removed from layout', page.locator(f'[data-entity="{person}"] .er-secondary-port:not(.er-connected-port)').first.evaluate('(e)=>getComputedStyle(e).opacity')=='0')
        for theme in ['light','dark']:
            js('state.settings.theme='+json.dumps(theme)+';render();erFit()');page.wait_for_timeout(80)
            ok(theme+' selected view has distinct active styling', page.locator('[data-action="er-mode"][data-value="map"]').evaluate('(e)=>getComputedStyle(e).backgroundColor')!=page.locator('[data-action="er-mode"][data-value="list"]').evaluate('(e)=>getComputedStyle(e).backgroundColor'))
            act('er-focus',task);page.keyboard.press('Tab');node.focus()
            ok(theme+' keyboard focus has a visible non-zero outline', node.evaluate('(e)=>getComputedStyle(e).outlineStyle')!='none' and node.evaluate('(e)=>parseFloat(getComputedStyle(e).outlineWidth)>0'))
        js('state.settings.theme="light";render();erFit()');page.wait_for_timeout(80);page.screenshot(path=str(OUT/'editor-light.png'),full_page=True)
        page.set_viewport_size({'width':700,'height':1100});act('er-mode','relationships')
        ok('Narrow pane retains the relationship editing alternative without horizontal overflow', js('document.documentElement.scrollWidth<=innerWidth') and page.locator('.er-relationship-item').count()==3)
        page.screenshot(path=str(OUT/'narrow-relationships.png'),full_page=True)
        # Read-only state is both visible and guarded, not merely a cosmetic button style.
        js('state.activeRun="controlled-busy-fixture";render()');before=js('JSON.stringify(semanticModel())')
        ok('Editing and arrangement controls are disabled during a run', page.locator('main [data-action="er-add"]').first.is_disabled() and page.locator('[data-action="er-arrange"]').is_disabled())
        js('handleSemanticAction("er-add","")')
        ok('Programmatic editing cannot bypass the run guard', before==js('JSON.stringify(semanticModel())') and not page.locator('#modal').is_visible(), 'Controlled busy-state boundary through actual action')
        js('state.activeRun=null;render()')
        tokens=sorted(set(re.findall(r'var\((--[a-zA-Z0-9-]+)',(ROOT/'docs/concepts/companion/src/semantic.css').read_text())))
        ok('Every semantic interaction color resolves to an existing theme token', page.evaluate('(keys)=>keys.every(k=>getComputedStyle(document.documentElement).getPropertyValue(k).trim())',tokens), 'Computed source-token inventory')
        ok('No browser errors or runtime network requests', not errors and not requests, 'Captured page/console error and request events')
    except Exception:
        fatal=traceback.format_exc();print(fatal,flush=True)
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
    finally:
        report={'sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'html_bytes':HTML.stat().st_size,'checks':checks,'errors':errors,'requests':requests,'fatal':fatal,'scope':'Concept browser; controlled Storage fixture, no native Obsidian/real CLI qualification.'}
        (OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
        browser.close()
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
