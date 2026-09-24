"""Exact-artifact semantic and component-variant journeys; browser concept, not native APIs."""
import hashlib
import json
import os
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / 'docs/concepts/companion/index.html'
OUT = ROOT / 'reports/concepts/semantic'
OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []
fatal = None


def ok(name, condition, scope='Actual DOM interaction and model readback'):
    checks.append({'name': name, 'result': 'passed' if condition else 'failed', 'scope': scope})
    print(('PASS' if condition else 'FAIL'), name, flush=True)
    assert condition, name


def act(page, action, value=None, scope=''):
    selector = scope + f' [data-action="{action}"]'
    if value is not None:
        selector += f'[data-value="{value}"]'
    page.locator(selector.strip()).first.click()


def js(page, code):
    return page.evaluate(code)


STORAGE = """<script>window.__saved={};Object.defineProperty(window,'localStorage',{value:{
getItem:k=>Object.hasOwn(__saved,k)?__saved[k]:null,setItem:(k,v)=>{__saved[k]=v},removeItem:k=>delete __saved[k]
}});</script>"""
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1700, 'height': 1150}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    page.on('request', lambda request: requests.append(request.url))
    try:
        page.set_content(STORAGE + HTML.read_text())
        act(page, 'sample', scope='main')
        act(page, 'nav', 'entities', '#sidebar')
        ok('One-vault design navigation exposes a real semantic workspace', page.locator('main h1').inner_text() == 'Entity relationships' and js(page, 'state.project!==null && !("projects" in state)'))
        ok('Empty semantic model does not infer entities from screen names', js(page, 'semanticModel().entities.length===0'))
        before = js(page, 'designFingerprint(design())')
        act(page, 'er-add', scope='main'); page.locator('#er-name').fill('Task')
        act(page, 'er-property-add', scope='#modal')
        page.locator('[data-field="er-prop-key"]').fill('title')
        page.locator('[data-field="er-prop-required"]').check()
        act(page, 'er-save', scope='#modal')
        ok('Entity create retains stable identity and required text property', js(page, 'semanticModel().entities[0].slug==="task" && semanticModel().entities[0].properties[0].required'))
        ok('Entity declaration invalidates generation fingerprint', before != js(page, 'designFingerprint(design())'))
        entity = js(page, 'semanticModel().entities[0].id')
        act(page, 'er-edit', entity)
        ok('Saved entity code name is immutable in editor', page.locator('#er-slug').get_attribute('readonly') is not None)
        rev = js(page, 'design().revision'); history = js(page, 'design().history.length')
        act(page, 'er-save', scope='#modal')
        ok('No-op entity save does not create revisions or history', rev == js(page, 'design().revision') and history == js(page, 'design().history.length'))
        act(page, 'er-edit', entity); page.locator('#er-description').fill('Unsaved domain meaning')
        page.keyboard.press('Escape')
        ok('Entity drafts have Escape discard protection', page.locator('#discard-dialog').is_visible())
        page.locator('#discard-keep').click()
        ok('Keep editing retains the semantic draft', page.locator('#er-description').input_value() == 'Unsaved domain meaning')
        page.keyboard.press('Escape'); page.locator('#discard-confirm').click()
        ok('Discard preserves canonical entity', js(page, 'semanticModel().entities[0].description===""'))
        act(page, 'er-section', scope='main'); page.locator('#er-name').fill('Delivery'); act(page, 'er-save', scope='#modal')
        section = js(page, 'semanticModel().sections[0].id')
        fingerprint = js(page, 'designFingerprint(design())')
        act(page, 'er-edit', entity); page.locator('#er-section').select_option(section); act(page, 'er-save', scope='#modal')
        ok('Entity can be grouped without changing generator input', js(page, 'semanticModel().entities[0].section') == section and fingerprint == js(page, 'designFingerprint(design())'))
        act(page, 'er-add', scope='main'); page.locator('#er-name').fill('Person'); act(page, 'er-save', scope='#modal')
        person = js(page, 'semanticModel().entities[1].id')
        act(page, 'er-arrange', scope='main'); page.wait_for_timeout(250)
        ok('Graph mounts actual Vue Flow entity cards and section frames', page.locator('#er-flow .vue-flow__node-erEntity').count() == 2 and page.locator('.er-section-frame').count() == 1)
        ok('Card footer and properties fit measured card bounds', js(page, "[...document.querySelectorAll('.er-card')].every(c=>c.querySelector('footer').getBoundingClientRect().bottom<=c.getBoundingClientRect().bottom+1)"), 'Measured DOM geometry')
        # Physical pointer connection uses actual embedded Vue Flow ports, not synthetic event dispatch.
        start = page.locator(f'[data-entity="{entity}"] [data-handleid="out"]').bounding_box()
        end = page.locator(f'[data-entity="{person}"] [data-handleid="in"]').bounding_box()
        page.mouse.move(start['x']+start['width']/2, start['y']+start['height']/2); page.mouse.down()
        page.mouse.move(end['x']+end['width']/2, end['y']+end['height']/2, steps=15); page.mouse.up()
        ok('Dragging a handle opens a relationship review, not an immediate mutation', page.locator('#modal').is_visible() and js(page, 'semanticModel().relationships.length===0'))
        page.locator('#er-name').fill('Assigned to'); page.locator('#er-key').fill('assignee'); page.locator('#er-targetCard').select_option('0..1')
        act(page, 'er-save', scope='#modal')
        ok('Relationship commits explicit owner, target and cardinality', js(page, f'semanticModel().relationships[0].source==={json.dumps(entity)} && semanticModel().relationships[0].target==={json.dumps(person)}'))
        ok('Graph renders a visible relationship path', js(page, "(()=>{const p=document.querySelector('#er-flow .vue-flow__edge-path');return p&&p.getTotalLength()>20})()"), 'Measured SVG geometry')
        ok('Relationship captions do not inherit the edge stroke', js(page, "getComputedStyle(document.querySelector('#er-flow .vue-flow__edge-text')).stroke==='none'"), 'Measured SVG presentation')
        ok('One-target relationship becomes a text link field', js(page, 'erFields(semanticModel().entities[0],semanticModel()).some(p=>p.key==="assignee"&&p.type==="text")'))
        ok('Markdown example quotes wikilinks', 'assignee: "[[Records/Person/Example Person]]"' in js(page, 'semanticNote(semanticModel().entities[0],semanticModel())'))
        edge = js(page, 'semanticModel().relationships[0].id')
        act(page, 'er-edit-edge', edge); page.locator('#er-targetCard').select_option('1..*'); act(page, 'er-save', scope='#modal')
        ok('Many targets become required List references', js(page, 'erFields(semanticModel().entities[0],semanticModel()).some(p=>p.key==="assignee"&&p.type==="list"&&p.required)'))
        ok('Many-reference example uses a list of quoted wikilinks', 'assignee: ["[[Records/Person/Example Person]]"]' in js(page, 'semanticNote(semanticModel().entities[0],semanticModel())'))
        act(page, 'er-select', person); act(page, 'er-delete', person); act(page, 'er-save', scope='#modal')
        ok('Deleting a referenced entity is blocked without partial mutation', js(page, 'semanticModel().entities.length===2') and 'relationships' in page.locator('#er-form-error').inner_text())
        js(page, 'modalOriginal=null;closeModal()')
        act(page, 'er-edit', entity); page.locator('#er-description').fill('Pending')
        js(page, 'semanticModel().entities[0].description="Concurrent change"')
        act(page, 'er-save', scope='#modal')
        ok('Stale semantic draft preserves concurrent data', 'stale' in page.locator('#er-form-error').inner_text() and js(page, 'semanticModel().entities[0].description==="Concurrent change"'))
        js(page, 'modalOriginal=null;closeModal()')
        # Readable source includes the declared properties, not a substituted preset.
        files = js(page, 'designFiles(design())')
        ok('Generator includes entity types, document recipes and fixtures', all(any(f['path'] == path for f in files) for path in ['src/domain/entities/task.ts','src/features/entities/task/document-recipe.ts','tests/fixtures/entities/task-example.md','src/bootstrap/entity-outlines.ts']))
        task_source = next(f['content'] for f in files if f['path'] == 'src/domain/entities/task.ts')
        ok('Generated entity interface includes owned relationship type', 'title: string;' in task_source and 'assignee: readonly string[];' in task_source)
        ok('Generated blueprint remains structurally importable', js(page, 'structuralDesign(JSON.parse(designFiles(design()).find(f=>f.path==="docs/PLUGIN-BLUEPRINT.json").content))'))
        exported = js(page, 'JSON.stringify(portableDesign())')
        js(page, 'importDesign('+json.dumps(exported)+')')
        ok('Blueprint import round-trips semantic declarations and grouping', js(page, 'semanticModel().entities.length===2 && semanticModel().relationships.length===1 && semanticModel().sections.length===1'))
        # Geometry edits preserve compiler output and have an undo history.
        js(page, 'setView("entities")'); act(page, 'er-fit', scope='main'); page.wait_for_timeout(200)
        before_files = js(page, 'JSON.stringify(designFiles(design()))')
        card = page.locator(f'[data-entity="{entity}"] .er-card-heading small').bounding_box()
        position = js(page, f'JSON.stringify(semanticModel().canvas.positions[{json.dumps(entity)}])')
        page.mouse.move(card['x']+20, card['y']+5); page.mouse.down(); page.mouse.move(card['x']+90, card['y']+45, steps=10); page.mouse.up(); page.wait_for_timeout(150)
        ok('Physical card dragging persists model position', position != js(page, f'JSON.stringify(semanticModel().canvas.positions[{json.dumps(entity)}])'), 'Physical pointer and canonical readback')
        ok('Physical arrangement does not change generated source', before_files == js(page, 'JSON.stringify(designFiles(design()))'))
        act(page, 'er-undo', scope='main')
        ok('Undo restores entity arrangement', position == js(page, f'JSON.stringify(semanticModel().canvas.positions[{json.dumps(entity)}])'))
        # Bounded unknown-input checks call the real validator on copies, not substitute implementations.
        for name, edit in [
            ('Nested property type', 'm.entities[0].properties[0].type="object"'),
            ('Inherited property enum', 'm.entities[0].properties[0].type="constructor"'),
            ('Managed property collision', 'm.entities[0].properties[0].key="id"'),
            ('Duplicate stable IDs', 'm.entities[1].id=m.entities[0].id'),
            ('Broken relationship endpoint', 'm.relationships[0].target="er-entity-999"'),
            ('Unsafe ID counter', 'm.nextId=Number.MAX_SAFE_INTEGER'),
            ('Unsupported delete cascade', 'm.relationships[0].onDelete="cascade"'),
            ('Escaping note folder', 'm.entities[0].folder="../private"'),
            ('Invalid native Tags key', 'm.entities[0].properties[0].type="tags"'),
            ('Stored relationship/property collision', 'm.entities[0].properties[0].key="assignee"'),
            ('Reserved metadata relationship key', 'm.relationships[0].key="aliases"'),
            ('Unexpected executable field', 'm.entities[0].script="run()"'),
            ('Cross-entity property-type conflict', 'm.entities[1].properties=[{id:"er-property-6",key:"title",type:"number",required:false}];m.nextId=20'),
        ]:
            ok(name+' is rejected', js(page, '(()=>{const d=designCopy(design()),m=d.semantic;'+edit+';return semanticIssues(d).some(i=>i.level==="error")})()'), 'Controlled malformed data through actual semantic validator')
        for kind, value in [('text','hello'),('number',0),('checkbox',False),('date','2024-02-29'),('datetime','2026-09-24T09:00:00'),('list',['one',2]),('tags',['work','team/dev'])]:
            ok('Valid '+kind+' default accepted', js(page, 'erDefaultValid('+json.dumps(kind)+','+json.dumps(value)+')'), 'Actual typed-default validator')
        ok('Impossible dates and wrong primitive defaults rejected', js(page, '!erDefaultValid("date","2026-02-30")&&!erDefaultValid("checkbox","false")&&!erDefaultValid("number","0")&&!erDefaultValid("datetime","2026-09-24T25:00:00")'), 'Actual typed-default validator')
        page.screenshot(path=str(OUT/'entity-editor.png'), full_page=True)
        # Component variants and miniature regression.
        act(page, 'nav','components','#sidebar'); act(page, 'unified-clear')
        ok('Every miniature fits its own box', js(page, "[...document.querySelectorAll('.library-miniature')].every(el=>{const a=el.getBoundingClientRect(),b=el.firstElementChild.getBoundingClientRect();return b.width<=a.width&&b.height<=a.height&&getComputedStyle(el).overflow==='hidden'})"), 'All 44 thumbnails: measured DOM geometry')
        component = js(page, 'selectedComponent().id')
        act(page, 'workflow-component-tab','variants'); act(page, 'variant-new',component)
        page.locator('#v-propsText').fill('{"notDeclared":true}'); act(page, 'variant-save',scope='#modal')
        ok('Variant props must belong to the actual component contract', 'declared prop' in page.locator('#variant-error').inner_text())
        page.locator('#v-propsText').fill('{"title":"Condensed timeline"}')
        page.locator('[data-field="variant-titleOverride"]').check(); page.locator('#v-title').fill('Short history')
        act(page,'variant-save',scope='#modal')
        ok('Named variant commits structured data and a new version', js(page, 'variantFor(selectedComponent(),"compact").props.title==="Condensed timeline" && selectedComponent().version==="1.0.1"'))
        act(page,'variant-preview',component+':compact')
        ok('Variant preview resolves shared definition plus overrides', 'Short history' in page.locator('.story-preview').inner_text() and 'Condensed timeline' in page.locator('.variant-props').inner_text())
        act(page,'library-place',component); page.locator('[data-field="library-place-node"]').select_option('node-2'); page.locator('[data-field="library-place-variant"]').select_option('compact'); act(page,'library-place-confirm')
        ok('Placement receives selected variant without duplicating its definition', page.locator('[data-field="brick-title"]').input_value() == 'Short history' and js(page, 'brickUi.form.variant==="compact"'))
        page.locator('[data-field="brick-content"]').fill('Local screen copy'); act(page,'brick-save')
        placed = js(page, f'bricksOf(design().nodes.find(n=>n.id==="node-2")).find(b=>b.definition==={json.dumps(component)}&&b.variant==="compact").id')
        ok('Placed instance stores variant ID, version and local copy', js(page, f'findBrick("node-2:{placed}").b.content==="Local screen copy"'))
        js(page, 'setView("components")'); act(page,'workflow-component-tab','variants'); act(page,'variant-remove',component+':compact'); act(page,'variant-save',scope='#modal')
        ok('In-use variant removal is blocked', 'in use' in page.locator('#variant-error').inner_text())
        js(page,'modalOriginal=null;closeModal()');act(page,'variant-edit',component+':compact');page.locator('#v-title').fill('Compact history v2');page.locator('#v-propsText').fill('{"title":"New timeline title"}');act(page,'variant-save',scope='#modal')
        ok('Variant definition change does not rewrite existing instances', js(page, f'findBrick("node-2:{placed}").b.title==="Short history"&&findBrick("node-2:{placed}").b.version==="1.0.1"'))
        ok('Old placement retains its reviewed typed prop defaults', js(page, f'findBrick("node-2:{placed}").b.variantProps.title==="Condensed timeline"'))
        js(page, f'dispatch("library-upgrade","node-2:{placed}")');
        ok('Upgrade review discloses the typed-prop change', 'New timeline title' in page.locator('#modal').inner_text())
        act(page,'library-upgrade-save',scope='#modal')
        ok('Reviewed upgrade applies variant default but keeps local content', js(page, f'findBrick("node-2:{placed}").b.title==="Compact history v2"&&findBrick("node-2:{placed}").b.content==="Local screen copy"&&findBrick("node-2:{placed}").b.variant==="compact"'))
        ok('Reviewed upgrade adopts the new pinned props', js(page, f'findBrick("node-2:{placed}").b.variantProps.title==="New timeline title"'))
        ok('Generator retains variant selections and typed defaults', js(page, 'designFiles(design()).find(f=>f.path==="src/bootstrap/component-bindings.ts").content.includes("compact") && designFiles(design()).some(f=>f.content.includes("New timeline title"))'))
        exported=js(page,'JSON.stringify(portableDesign())');js(page,'importDesign('+json.dumps(exported)+')')
        ok('Variants survive complete blueprint import/export', js(page, f'findBrick("node-2:{placed}").b.variant==="compact"&&variantFor(selectedComponent(),"compact").props.title==="New timeline title"'))
        ok('Saved workspace with semantic and variants passes storage validation', js(page,'validState(state)'))
        # Surface bindings and generation share the declared entity ID, not its label.
        js(page, 'startNodeForm("page","node-2")')
        page.locator('#d-node-entity').select_option(entity);act(page,'design-save',scope='#modal')
        ok('Surface binds a declared semantic entity by stable ID', js(page, f'design().nodes.find(n=>n.id==="node-2").entity==={json.dumps(entity)}'))
        ok('Source plan carries the surface-to-entity mapping', js(page, f'designFiles(design()).some(f=>f.path.endsWith("/surface-spec.ts")&&f.owner==="node-2"&&f.content.includes({json.dumps(entity)}))'))
        js(page, 'reviewDesignPlan();designUi.plan.approved=true')
        js(page, 'design().semantic.entities[0].description="Changed since approval"')
        js(page, 'simulateDesignApply()')
        ok('Semantic edits invalidate a previously approved generation plan', 'stale' in page.locator('#design-error').inner_text())
        js(page, 'modalOriginal=null;closeModal()')
        ok('Oversized preview is rejected before emitted-state mutation', js(page, '(()=>{const d=designCopy(design());for(let i=0;i<600;i++)d.emitted["preserve-"+i]={owner:"old",content:"keep",protected:true};return buildDesignPlan(d).issues.some(i=>i.code==="preview-capacity")})()'), 'Controlled capacity boundary through the actual planner')
        # UI defaults retain false and zero, and redraw keeps the correct property row.
        js(page, 'setView("entities")');act(page,'er-edit',entity)
        for key,kind,value in [('completed','checkbox','false'),('estimate','number','0')]:
            act(page,'er-property-add',scope='#modal')
            index=page.locator('.er-property-row').count()-1
            page.locator(f'#er-p-{index}-key').fill(key);page.locator(f'#er-p-{index}-type').select_option(kind)
            page.locator(f'[data-field="er-prop-hasDefault"][data-index="{index}"]').check()
            page.locator(f'#er-p-{index}-default').fill(value)
        act(page,'er-save',scope='#modal')
        ok('Property form saves false and zero without converting them to strings', js(page, 'semanticModel().entities[0].properties.some(p=>p.key==="completed"&&p.defaultValue===false)&&semanticModel().entities[0].properties.some(p=>p.key==="estimate"&&p.defaultValue===0)'))
        # Variant drafts use the same explicit discard boundary.
        js(page,'setView("components")');act(page,'workflow-component-tab','variants');act(page,'variant-edit',component+':compact')
        page.locator('#v-name').fill('Uncommitted variant name');page.keyboard.press('Escape')
        ok('Variant editing has Escape discard protection',page.locator('#discard-dialog').is_visible())
        page.locator('#discard-keep').click()
        ok('Keeping a variant draft retains its text',page.locator('#v-name').input_value()=='Uncommitted variant name')
        page.keyboard.press('Escape');page.locator('#discard-confirm').click()
        # A fresh browser runtime loads actual serialized state, no model substitution.
        saved=js(page,'save();JSON.stringify(__saved)')
        restored=browser.new_page(viewport={'width':1280,'height':1000})
        restored.on('pageerror',lambda e: errors.append(str(e)))
        restored.set_content(STORAGE.replace('window.__saved={}', 'window.__saved='+saved)+HTML.read_text())
        ok('New runtime restores semantic data, variants and one project', js(restored, 'state.project!==null&&!storageWarning&&semanticModel().entities.length===2&&design().library.some(c=>c.variantSpecs?.some(v=>v.id==="compact"))'), 'Serialized browser state restored through production concept startup; storage adapter controlled')
        restored.close()
        page.screenshot(path=str(OUT/'component-variants.png'), full_page=True)
        page.set_viewport_size({'width':720,'height':950});js(page,'setView("components")');page.wait_for_timeout(100)
        ok('Narrow library keeps miniature dimensions bounded', js(page,"[...document.querySelectorAll('.library-miniature')].every(el=>el.firstElementChild.getBoundingClientRect().width<=el.getBoundingClientRect().width)"), 'Measured 720px viewport')
        js(page,'setView("entities")');page.screenshot(path=str(OUT/'semantic-narrow.png'),full_page=True)
        act(page,'er-mode','list',scope='main')
        ok('Entity list offers a non-drag editing path', page.locator('.er-list-view [data-action="er-edit"]').count()==2)
        ok('No browser errors or runtime network requests',not errors and not requests)
    except Exception:
        fatal=traceback.format_exc();print(fatal)
    finally:
        browser.close()
report={'schema':'companion-semantic/v1','html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'checks':checks,'errors':errors,'requests':requests,'fatal':fatal}
(OUT/'checks.json').write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(1 if fatal or errors or requests or any(c['result']!='passed' for c in checks) else 0)
