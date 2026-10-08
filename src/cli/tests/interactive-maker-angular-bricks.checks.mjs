import assert from 'node:assert/strict';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument, documentText } from '../domain/document.ts';
import { runOperations } from '../application/operations.ts';
import { projectModel } from '../compiler/emitters/model.ts';
import { angularBrickFiles } from '../compiler/adapters/project/angular-bricks.ts';
import { angularDefinitionSource } from '../compiler/adapters/project/angular-brick-templates.ts';
import { visualLiteral, visualAllocate, visualText } from '#shared/companion/visual/visual-ir.mjs';
function design() {
  return runOperations(newDocument('Bricks <script>'), [
    { op: 'page.add', title: 'Home', as: 'home' }, { op: 'sitemap.route', page: '@home', path: '/' },
    { op: 'page.add', title: 'Details', as: 'details' },
    { op: 'component.add', title: 'Product card', as: 'card' },
    { op: 'page.attach', page: '@home', components: [{ id: '@card' }, { id: '@card' }] },
    { op: 'page.layout', id: '@home', layout: 'grid' },
    { op: 'interaction.add', page: '@home', title: 'Open details', as: 'open' },
    { op: 'interaction.action', page: '@home', id: '@open', action: { kind: 'navigate', target: '@details' } },
    { op: 'entity.add', title: 'Order' }, { op: 'data-source.add', title: 'Order API', kind: 'api' },
    { op: 'journey.add', title: 'Browse', pages: ['@home', '@details'] },
  ]);
}
const definition = (files, id) => JSON.parse(files['design/angular-capabilities.json']).definitions.find(item => item.id === id);
const source = (files, id) => files[definition(files, id).source];
test('Angular emits reusable component sources, native layouts/actions and a complete contract manifest', () => {
  const { document, aliases } = design(), before = documentText(document);
  const files = angularBrickFiles(projectModel(document));
  assert.equal(documentText(document), before);
  assert.match(source(files, aliases.card), /Product card/);
  const home = source(files, aliases.home);
  assert.equal(JSON.parse(home.match(/template: (.*), styles:/)[1]).split('<' + definition(files, aliases.card).selector + ' ').length - 1, 2);
  assert.match(home, /data-wb-layout/); assert.match(home, /grid-template-columns/);
  assert.match(home, /"navigate"/); assert.match(home, new RegExp(aliases.details));
  assert.match(files['src/plugin/ui/Starter.ts'], /hashchange/); assert.match(files['src/plugin/ui/Starter.ts'], /removeEventListener/);
  assert.match(files['src/plugin/core/brick-manifest.ts'], /Order API/); assert.match(files['src/plugin/core/brick-manifest.ts'], /Browse/);
  assert.deepEqual(JSON.parse(files['design/angular-capabilities.json']).adapterRequirements, []);
  assert.deepEqual(angularBrickFiles(projectModel(document)), files);
});
test('user content remains escaped data; no markup or executable template injection', () => {
  const { document } = design(), component = document.design.visualDesigns.components[0];
  const payload = '</script><script>alert(1)</script> {{7*7}} @if(true){x} "';
  component.template[0].value = visualLiteral(payload);
  const files = angularBrickFiles(projectModel(document));
  const generated = source(files, component.id);
  assert.ok(!generated.includes('</script>')); assert.match(generated, /\\u003c/);
  const template = JSON.parse(generated.match(/template: (.*), styles:/)[1]);
  assert.ok(!template.includes(payload)); assert.ok(template.includes('[textContent]="read(0)"'));
});
test('props, named slots, defaults and variants compile to isolated instance bindings', () => {
  const { document, aliases } = design(), store = document.design.visualDesigns, component = store.components[0];
  component.props = [{ name: 'caption', type: 'string', required: false, default: 'Default caption' }];
  component.slots = [{ name: 'footer', required: false }]; component.emits = [{ name: 'confirm', payloadType: 'string' }];
  component.variants = [{ id: 'alt', name: 'Alternate', values: { caption: 'Alternate caption' } }];
  component.template = [visualText(visualAllocate(store, 'vn'), '', 'p')];
  component.template[0].value = { kind: 'prop', name: 'caption' };
  component.template.push({ id: visualAllocate(store, 'vn'), kind: 'slot', name: 'footer', fallback: [visualText(visualAllocate(store, 'vn'), 'Fallback')] });
  const page = store.pages.find(item => item.ownerId === aliases.home), instances = page.root[0].children;
  instances[0].props.caption = visualLiteral('Instance one'); instances[0].slots.footer = [visualText(visualAllocate(store, 'vn'), 'Footer one')];
  instances[1].variantId = 'alt';
  const files = angularBrickFiles(projectModel(document));
  assert.match(source(files, aliases.card), /ng-content/);
  assert.match(source(files, aliases.home), /Instance one/); assert.match(source(files, aliases.home), /Alternate caption/);
  assert.match(source(files, aliases.home), /Footer one/);
});
test('unimplemented framework adapters are visible and returned as machine-readable requirements', () => {
  const node = { id: 'vn-1', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-button' }, props: {}, slots: {}, events: [] };
  const definition = { key: 'node-1', name: 'Brick0', selector: 'wb-brick-0', nodes: [node] }, gaps = [];
  const source = angularDefinitionSource(definition, [definition], gaps);
  assert.match(source, /data-adapter-required/); assert.equal(gaps.length, 1); assert.match(gaps[0].reason, /Angular adapter/);
  definition.nodes = [{ id: 'vn-2', kind: 'external', package: 'example', adapter: 'chart', props: {}, events: [] }];
  assert.match(angularDefinitionSource(definition, [definition], gaps), /requires an adapter/);
});

test('component source identities remain stable after adding another component', () => {
  const { document, aliases } = design();
  const before = angularBrickFiles(projectModel(document));
  const changed = runOperations(document, [{ op: 'component.add', title: 'Later component' }]).document;
  const after = angularBrickFiles(projectModel(changed));
  assert.equal(definition(before, aliases.home).source, definition(after, aliases.home).source);
  assert.equal(definition(before, aliases.card).source, definition(after, aliases.card).source);
  assert.equal(source(before, aliases.card), source(after, aliases.card));
});
test('pinned revisions retain their template when the draft component changes', () => {
  const { document, aliases } = design(), store = document.design.visualDesigns, component = store.components[0];
  const revision = { id: visualAllocate(store, 'vr'), componentId: component.id, version: '1.0.0',
    contract: { props: [], slots: [], emits: [], variants: [] }, template: structuredClone(component.template) };
  store.revisions.push(revision);
  store.pages[0].root[0].children[0].ref.revisionId = revision.id;
  component.template[0].value = visualLiteral('New draft');
  const files = angularBrickFiles(projectModel(document));
  assert.match(source(files, revision.id), /Product card/); assert.doesNotMatch(source(files, revision.id), /New draft/);
  assert.match(source(files, aliases.card), /New draft/);
  assert.match(source(files, aliases.home), new RegExp(definition(files, revision.id).selector));
});


test('visibility cannot be overridden by a node layout and accessibility notes stay escaped', () => {
  const { document, aliases } = design();
  const grid = document.design.visualDesigns.pages[0].root[0];
  grid.visibleIn = ['empty']; grid.a11y = 'A <grid> description';
  const generated = source(angularBrickFiles(projectModel(document)), aliases.home);
  assert.match(generated, /display:none!important/); assert.match(generated, /aria-description/);
  assert.match(generated, /A \\u003cgrid\\u003e description/);
});
test('declared component events do not also bind bubbling native events of the same name', () => {
  const { document, aliases } = design(), store = document.design.visualDesigns;
  store.components[0].emits = [{ name: 'click', payloadType: 'void' }];
  const instance = store.pages[0].root[0].children[0];
  instance.events = [{ id: visualAllocate(store, 'vi'), event: 'click', label: 'Component click',
    actions: [{ kind: 'set-state', state: 'empty' }], notes: '', acceptance: '' }];
  const files = angularBrickFiles(projectModel(document));
  const template = JSON.parse(source(files, aliases.home).match(/template: (.*), styles:/)[1]);
  const tag = template.split('<' + definition(files, aliases.card).selector + ' ')[1].split('>')[0];
  assert.match(tag, /\(emitted\)=/); assert.ok(!tag.includes('(click)='));
  assert.match(source(files, aliases.card), /emitTypes = {"click":"void"}/);
});
