"""Concept06 actual embedded Vue Flow interactions, with named negative model fixtures.
Requires pre-provisioned Python Playwright and Chromium. Exact HTML injection and
explicit Storage substitute; no native host, filesystem deployment or CLI execution.
"""
from pathlib import Path
import argparse, hashlib, json, time
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[2]
a = argparse.ArgumentParser()
a.add_argument('--html', default=str(ROOT/'docs/concepts/companion/index.html'))
a.add_argument('--out', default=str(ROOT/'reports/concepts/companion-connections'))
a.add_argument('--browser', default='/usr/bin/chromium')
args = a.parse_args(); HTML = Path(args.html); OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
checks, errors, requests = [], [], []; page = None

def check(name, ok=True, scope='browser interaction / resulting state'):
    checks.append({'name': name, 'passed': bool(ok), 'scope': scope})
    print('PASS' if ok else 'FAIL', name, flush=True)
    assert ok, name

def v(p, code): return p.evaluate(code)
def act(p, action, value=None, scope=''):
    sel=f'{scope} [data-action="{action}"]'+(f'[data-value="{value}"]' if value is not None else '')
    p.locator(sel.strip()).first.click(); p.wait_for_timeout(75)
    # Concept07: these retained fixtures qualify Structure mode; content mode has its own suite.
    if (action=="nav" and value=="sitemap") or (action=="workflow-stage" and value=="structure"):
        p.locator('[data-action="brick-display"][data-value="structure"]').click();p.wait_for_timeout(80)

def card(p, node): return p.locator(f'.map-node[data-node="{node}"]')
def port(p, node, side):
    name={'right':'out-right','bottom':'out-bottom','left':'in-left','top':'in-top'}[side]
    return card(p,node).locator(f'[data-handleid="{name}"]')
def select(p,node='node-2'):
    card(p,node).locator('.map-card-title').click();p.wait_for_timeout(60)
def focus(p,node='node-2'):
    select(p,node);act(p,'canvas-focus');p.wait_for_timeout(70)
def close(p): act(p,'close',scope='#modal')
def state(p):return v(p,'JSON.stringify(designSnapshot(design()))')
def shot(p,name):p.screenshot(path=str(OUT/name))
def edge_click(p,eid):
    p.locator(f'[data-flow-edge="{eid}"]').click();p.wait_for_timeout(100)
def draw(p,origin='node-2',target='node-3',cancel=False):
    act(p,'canvas-fit')
    one=port(p,origin,'right').bounding_box();two=port(p,target,'left').bounding_box()
    p.mouse.move(one['x']+one['width']/2,one['y']+one['height']/2);p.mouse.down()
    p.mouse.move(two['x']+two['width']/2,two['y']+two['height']/2,steps=14)
    if cancel:p.keyboard.press('Escape')
    p.mouse.up();p.wait_for_timeout(140)

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
    def new(raw='',width=1600,height=1080):
        global page
        p=b.new_page(viewport={'width':width,'height':height});page=p;p.set_default_timeout(6000)
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
        p.on('request',lambda r:requests.append(r.url))
        p.evaluate('''raw=>{window.fixtureStore={};if(raw)fixtureStore['shell-workbench-concept-v1']=raw;
          Object.defineProperty(window,'localStorage',{value:{getItem:k=>fixtureStore[k]??null,
          setItem:(k,v)=>fixtureStore[k]=String(v),removeItem:k=>delete fixtureStore[k]},configurable:true});}''',raw)
        p.set_content(HTML.read_text())
        if not v(p,'state.projects.length'):act(p,'sample',scope='main')
        if not p.locator('#sidebar').is_visible():act(p,'menu')
        act(p,'nav','sitemap','#sidebar');p.wait_for_selector('.vue-flow__node');p.wait_for_timeout(160)
        return p
    try:
        p=new();check('Same bundled Vue / Pinia / Vue Flow runtime remains active',v(p,'!!flowUi.api && !!flowUi.store && Vue.version==="3.5.43"'))
        check('Containment and user-flow edges are separately projected and inspectable',v(p,'flowEdgeProjection(design()).every(e=>e.selectable) && flowEdgeProjection(design()).some(e=>e.type==="structure")'))
        focus(p);before=state(p);history=v(p,'design().history.length')
        port(p,'node-2','right').click()
        check('Stationary handle click opens a contextual menu, not a draft edge',p.locator('#connection-menu').count()==1 and not v(p,'document.getElementById("modal").open'))
        check('Menu names source, direction and distinct creation choices','From Collection' in p.locator('#connection-menu').inner_text() and 'New native view' in p.locator('#connection-menu').inner_text())
        check('Menu opening changes no design data or history',state(p)==before and v(p,'design().history.length')==history)
        check('Handle exposes expanded menu semantics',port(p,'node-2','right').get_attribute('aria-expanded')=='true')
        shot(p,'01-handle-menu.png');p.keyboard.press('Escape')
        check('Escape dismisses the menu and returns focus to its handle',p.locator('#connection-menu').count()==0 and port(p,'node-2','right').evaluate('(e)=>e===document.activeElement'))
        p.keyboard.press('Enter');check('Keyboard opens the same handle menu',p.locator('#connection-menu').count()==1)
        p.keyboard.press('End');check('Menu End reaches the existing-card action',p.locator('#connection-menu [data-action="connection-existing"]').evaluate('(e)=>e===document.activeElement'))
        p.keyboard.press('Home');check('Menu Home restores the first enabled creation item',p.locator('#connection-menu [data-value="page"]').evaluate('(e)=>e===document.activeElement'))
        p.keyboard.press('ArrowDown');check('Arrow navigation reaches the independent view action',p.locator('#connection-menu [data-value="view"]').evaluate('(e)=>e===document.activeElement'));p.keyboard.press('Escape')
        port(p,'node-2','right').click();act(p,'connection-new','page','#connection-menu')
        check('Connected-screen editor starts with the owning view, not a nested screen',p.locator('#connection-parent').input_value()=='node-1')
        p.locator('#connection-label').fill('Review inbox')
        check('Card name suggests an editable code name and action label',p.locator('#connection-slug').input_value()=='review-inbox' and p.locator('#connection-actionLabel').input_value()=='Open Review inbox')
        p.locator('#connection-slug').fill('inbox-review');p.locator('#connection-label').fill('Review work inbox')
        check('A manually supplied code name is not overwritten',p.locator('#connection-slug').input_value()=='inbox-review')
        p.locator('#connection-linkKind').select_option('conditional');act(p,'connection-save')
        check('Missing condition blocks the whole combined operation',v(p,'design().nodes.length===5 && design().links.length===2') and 'condition' in p.locator('#connection-error').inner_text())
        p.locator('#connection-condition').fill('There are notes awaiting review.')
        check('Editing a rejected draft clears obsolete validation feedback',p.locator('#connection-error').inner_text()=='')
        p.locator('.connection-intent-details summary').click();p.locator('#connection-intent').fill('Review recent notes without losing the collection context.')
        p.locator('#connection-goals').fill('Identify actionable notes\nReturn to the same filters')
        shot(p,'02-create-connected-screen.png');act(p,'connection-save')
        new_id=v(p,'design().nodes.at(-1).id');eid=v(p,'design().links.at(-1).id')
        check('One save creates a screen and one typed connection',v(p,'design().nodes.length===6 && design().links.length===3'))
        check('Combined operation is one undo unit',v(p,'design().history.length')==history+1)
        check('Screen is a sibling inside its owner; existing parent is unchanged',v(p,'design().nodes.at(-1).parent==="node-1" && design().nodes.find(n=>n.id==="node-2").parent==="node-1"'))
        check('New card is placed to the chosen right side without overlap',v(p,'canvasState().positions[design().nodes.at(-1).id].x>canvasState().positions["node-2"].x'))
        check('Connection records selected ports, meaning and condition',v(p,'design().links.at(-1).sourceHandle==="out-right" && design().links.at(-1).targetHandle==="in-left" && design().links.at(-1).kind==="conditional"'))
        check('New card retains authored intent and goals',v(p,'design().nodes.at(-1).goals.length===2 && design().nodes.at(-1).intent.includes("collection")'))
        act(p,'canvas-fit');shot(p,'03-connected-map.png');edge_click(p,eid)
        check('Quick-created line opens the same existing type editor',v(p,'modalType==="design-connect" && designUi.form.id==="'+eid+'"'))
        p.locator('#d-link-kind').select_option('return');act(p,'design-link-save')
        check('Editing a quick-created edge retains its identity',v(p,'design().links.find(e=>e.id==="'+eid+'").kind==="return"'));act(p,'design-undo')
        act(p,'design-undo');check('Undo removes the new card and connection together',v(p,'design().nodes.length===5 && design().links.length===2'))
        act(p,'design-redo');check('Redo restores the same card and edge IDs',v(p,'design().nodes.at(-1).id==="'+new_id+'" && design().links.at(-1).id==="'+eid+'"'))
        act(p,'canvas-fit');edge_click(p,'contains-'+new_id)
        check('The automatically created structural line is also editable',p.locator('#modal h2').inner_text()=='Edit structural relationship')
        check('Structure explains Contains rather than pretending it is a user action','Structure, not a user action' in p.locator('#modal').inner_text())
        p.locator('#connection-structure-parent').select_option('node-3');act(p,'connection-structure-save')
        check('Reparenting preserves the independent flow edge',v(p,'design().nodes.find(n=>n.id==="'+new_id+'").parent==="node-3" && design().links.some(e=>e.id==="'+eid+'")'))
        act(p,'design-undo');check('Undo restores the structural parent only',v(p,'design().nodes.find(n=>n.id==="'+new_id+'").parent==="node-1" && design().links.length===3'))
        act(p,'canvas-fit');edge_click(p,'contains-'+new_id);p.locator('#connection-structure-parent').select_option('');act(p,'connection-structure-save')
        check('Orphaning an internal screen is blocked without changing the model','native view' in p.locator('#connection-error').inner_text() and v(p,'design().nodes.find(n=>n.id==="'+new_id+'").parent==="node-1"'))
        close(p);check('Structural draft has the shared unsaved-change guard',p.locator('#discard-dialog[open]').count()==1);p.locator('#discard-confirm').click();p.close()

        # The original failing route: Add inside creates structure, and it is no longer dead.
        p=new();focus(p,'node-1');act(p,'canvas-card-menu','node-1')
        check('Card menu separates journey extension from structural containment','Extend the user journey' in p.locator('#modal').inner_text() and 'Organize the structure' in p.locator('#modal').inner_text())
        shot(p,'04-card-menu.png');act(p,'canvas-menu-child','node-1');p.locator('#d-node-label').fill('Embedded review');p.locator('#d-node-slug').fill('embedded-review');act(p,'design-save');child=v(p,'design().nodes.at(-1).id');act(p,'canvas-fit')
        check('Add inside keeps its intentional structural-only semantics',v(p,'design().nodes.at(-1).parent==="node-1" && design().links.length===2'))
        edge_click(p,'contains-'+child);shot(p,'05-structural-editor.png');act(p,'connection-from-structure',child)
        check('Structure can initiate a distinct reviewed user-flow link',v(p,'modalType==="design-connect" && designUi.form.from==="node-1" && designUi.form.to==="'+child+'"'))
        act(p,'design-link-save');check('Added navigation does not remove Contains',v(p,'design().nodes.at(-1).parent==="node-1" && design().links.length===3'))
        select(p,child);act(p,'canvas-inspector','details');p.locator('.inspector-body details').filter(has=p.locator('#map-position-x')).locator('summary').click()
        at=v(p,'canvasState().positions["node-1"]');p.locator('#map-position-x').fill(str(at['x']+600));p.locator('#map-position-y').fill(str(at['y']));act(p,'canvas-position',child)
        check('Structural line reroutes to horizontal sides after moving a child',v(p,'flowEdgeProjection(design()).find(e=>e.id==="contains-'+child+'").sourceHandle==="structure-out-right"'))
        p.locator('#map-layout').select_option('vertical');check('Vertical layout reroutes structure downwards',v(p,'flowEdgeProjection(design()).find(e=>e.id==="contains-'+child+'").sourceHandle==="structure-out-bottom"'))
        p.locator('#map-layout').select_option('horizontal');check('Horizontal layout no longer forces bottom-to-top structure',v(p,'flowEdgeProjection(design()).filter(e=>e.data.containment).every(e=>e.sourceHandle==="structure-out-right")'))
        shot(p,'06-horizontal-layout.png');p.close()

        for side,kind in [('left','view'),('top','page'),('bottom','modal'),('right','view')]:
            p=new();focus(p);old=state(p);port(p,'node-2',side).click();act(p,'connection-new',kind,'#connection-menu')
            close(p);check(f'{side.title()} creation cancelled with no partial card or edge',state(p)==old)
            port(p,'node-2',side).click();act(p,'connection-new',kind,'#connection-menu');act(p,'connection-save')
            if side in ('left','top'):
                check(f'{side.title()} incoming handle creates a preceding card',v(p,'design().links.at(-1).from===design().nodes.at(-1).id && design().links.at(-1).to==="node-2"'))
            else:
                check(f'{side.title()} outgoing handle creates a following card',v(p,'design().links.at(-1).from==="node-2" && design().links.at(-1).to===design().nodes.at(-1).id'))
            axis='x' if side in ('left','right') else 'y';op='<' if side in ('left','top') else '>'
            check(f'{side.title()} placement follows the clicked side',v(p,f'canvasState().positions[design().nodes.at(-1).id].{axis}{op}canvasState().positions["node-2"].{axis}'))
            if kind=='view':check(f'{side.title()} native view stays at plugin root',v(p,'design().nodes.at(-1).parent===null'))
            if kind=='modal':check('New dialog uses Open dialog semantics',v(p,'design().links.at(-1).kind==="open"'))
            p.close()

        p=new();focus(p);port(p,'node-2','left').click();act(p,'connection-existing',scope='#connection-menu')
        check('Incoming handle offers a pointer-free existing-source workflow',v(p,'modalType==="design-connect" && designUi.form.to==="node-2" && designUi.form.targetHandle==="in-left"'));close(p)
        draw(p);check('Real handle dragging still opens exactly one connection draft',v(p,'modalType==="design-connect"') and p.locator('#connection-menu').count()==0);close(p)
        draw(p,cancel=True);check('Escape during a drag opens no menu and creates no edge',not v(p,'document.getElementById("modal").open') and p.locator('#connection-menu').count()==0 and v(p,'design().links.length===2'))
        focus(p);port(p,'node-2','bottom').click();r=p.locator('#map-viewport').bounding_box();p.mouse.click(r['x']+16,r['y']+16);p.wait_for_timeout(100)
        check('Blank-canvas click dismisses the menu and clears the card selection',p.locator('#connection-menu').count()==0 and v(p,'designUi.selected===null'))
        focus(p);port(p,'node-2','right').click();act(p,'connection-new','page','#connection-menu');p.locator('#connection-label').fill('Unsaved notes');close(p)
        check('Connected-card form uses the shared dirty-discard guard',p.locator('#discard-dialog[open]').count()==1);p.locator('#discard-keep').click()
        check('Keep editing preserves the typed draft',p.locator('#connection-label').input_value()=='Unsaved notes');close(p);p.locator('#discard-confirm').click()
        check('Discard does not add either entity',v(p,'design().nodes.length===5 && design().links.length===2'))
        act(p,'canvas-fit');focus(p,'node-1');act(p,'design-edit','node-1');p.locator('#d-node-kind').select_option('action');act(p,'design-save')
        check('Changing a container kind cannot silently orphan existing screens',v(p,'design().nodes.find(n=>n.id==="node-1").kind==="view"') and bool(p.locator('#design-error').inner_text()))
        close(p);p.locator('#discard-confirm').click();p.close()

        p=new();act(p,'canvas-fit');p.wait_for_timeout(400)
        p.locator('.vue-flow__edge[data-id="edge-4"]').focus();p.keyboard.press('Enter');p.wait_for_timeout(100)
        check('A focused user-flow line opens its editor with Enter',v(p,'modalType==="design-connect" && designUi.form.id==="edge-4"'));close(p)
        p.locator('.vue-flow__edge[data-id="contains-node-2"]').focus();p.keyboard.press('Space');p.wait_for_timeout(100)
        check('A focused structural line opens its relationship editor with Space',v(p,'modalType==="connection-structure"'));close(p)
        focus(p,'node-2');act(p,'canvas-card-menu','node-2');act(p,'canvas-menu-remove','node-2');before=state(p);p.evaluate('designChanged()')
        act(p,'design-remove-confirm','node-2')
        check('A stale card-removal review preserves the card and its links',v(p,'design().nodes.some(n=>n.id==="node-2") && design().links.length===2'),'negative model fixture');close(p)
        act(p,'canvas-inspector','links');act(p,'canvas-remove-edge','edge-4');p.evaluate('designChanged()');act(p,'canvas-remove-edge-confirm','edge-4')
        check('A stale connection-removal review preserves its edge',v(p,'design().links.some(e=>e.id==="edge-4")'),'negative model fixture');close(p);p.close()

        # Explicit fixture-based concurrency and bounds controls, not pointer evidence.
        p=new();focus(p);port(p,'node-2','right').click();act(p,'connection-new','page','#connection-menu');before=v(p,'design().nodes.length');p.evaluate('designChanged()');act(p,'connection-save')
        check('Stale combined plan refuses all mutation',v(p,'design().nodes.length')==before and 'stale' in p.locator('#connection-error').inner_text(),'negative model fixture');close(p)
        focus(p);port(p,'node-2','right').click();act(p,'connection-new','page','#connection-menu');p.evaluate('state.activeRun={id:"fixture"}');act(p,'connection-save')
        check('Active run blocks a directly submitted quick-create form',v(p,'design().nodes.length')==before and 'active' in p.locator('#connection-error').inner_text(),'negative model fixture');p.evaluate('state.activeRun=null');close(p)
        check('Auto placement leaves a gap around every existing rectangle',v(p,'(()=>{const d=design(),pos=proposedCardPosition(d,"node-2","right");return Object.values(canvasState().positions).every(n=>pos.x+MAP_SIZE.w+32<=n.x||pos.x>=n.x+MAP_SIZE.w+32||pos.y+MAP_SIZE.h+32<=n.y||pos.y>=n.y+MAP_SIZE.h+32)})()'),'model fixture')
        check('Generated snapshot still excludes viewport preferences',v(p,'!Object.hasOwn(generationSnapshot(design()),"canvas")'),'model fixture');p.close()

        p=new();focus(p);port(p,'node-2','right').click();act(p,'connection-new','page','#connection-menu');p.locator('#connection-label').fill('Persistent review');act(p,'connection-save')
        data=v(p,'fixtureStore["shell-workbench-concept-v1"]');p.close();p=new(data)
        check('Controlled Storage restores a quick-created card and relation',v(p,'design().nodes.some(n=>n.label==="Persistent review") && design().links.length===3'),'controlled Storage fixture')
        check('Popover state is not restored as a pending command',p.locator('#connection-menu').count()==0 and not v(p,'document.getElementById("modal").open'));p.close()
        for width,height,theme in [(1600,1080,'light'),(1024,900,'dark'),(390,844,'dark')]:
            p=new(width=width,height=height)
            if theme=='light':act(p,'theme')
            if width<650:act(p,'canvas-expand')
            focus(p);port(p,'node-2','right').click();box=p.locator('#connection-menu').bounding_box()
            check(f'Handle menu stays within {width}px viewport',box['x']>=0 and box['x']+box['width']<=width and box['y']>=0 and box['y']+box['height']<=height)
            shot(p,f'07-menu-{width}-{theme}.png');act(p,'connection-new','page','#connection-menu');box=p.locator('#modal').bounding_box()
            check(f'Combined form fits {width}px viewport',box['width']<=width and v(p,'document.documentElement.scrollWidth<=innerWidth'))
            shot(p,f'08-form-{width}-{theme}.png');p.close()
        check('No page or runtime console errors across all exercised routes',not errors)
        check('No runtime network requests',not requests)
    except Exception:
        if page and not page.is_closed():shot(page,'failure.png')
        raise
    finally:
        (OUT/'connection-checks.json').write_text(json.dumps({'scope':'Bundled Vue Flow concept; HTML injection and controlled Storage',
        'html_sha256':hashlib.sha256(HTML.read_bytes()).hexdigest(),'browser':b.version,'checks':checks,'errors':errors,'requests':requests},indent=2))
        b.close()
