import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createApp, effectScope, nextTick, reactive } from 'vue';
import { Window } from 'happy-dom';

// Resolves through ancestor node_modules so the check also runs inside git worktrees.
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
test('visual runtime type-checks under the generator configuration', () => {
  const run = spawnSync(process.execPath, [tsc, '--noEmit', '--project', 'tsconfig.generator.json'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
test('runtime exposes the IR surface used by generated SFCs', async () => {
  const text = await readFile('scripts/companion/runtime/use-visual.ts', 'utf8');
  for (const name of ['visible', 'style', 'text', 'props', 'attrs', 'on', 'message', 'attach', 'theme', 'state', 'external']) assert.match(text, new RegExp('\\b' + name + '\\b'));
  assert.doesNotMatch(text, /\beval\b|new Function/);
});

const { useVisual, provideVisualContext } = await import('../../scripts/companion/runtime/use-visual.ts');
const { visualIndex } = await import('../../scripts/companion/runtime/visual-runtime.ts');
const dom = new Window();
globalThis.HTMLElement ??= dom.HTMLElement;

const lit = value => ({ kind: 'literal', value });
const act = (id, event, actions, extra = {}) => ({ id, event, label: 'Interaction ' + id, actions, notes: '', acceptance: '', ...extra });
const text = (id, value, extra = {}) => ({ id, kind: 'text', role: 'p', value, ...extra });
const nuxt = (id, entryId, props = {}, extra = {}) => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props, slots: {}, events: [], ...extra });
const ui = { gap: 8, padding: 4, columns: 2, align: 'start', justify: 'start', wrap: false, overflow: 'visible', widthMode: 'fill', width: 320, minWidth: 0, maxWidth: 1200, narrow: { layout: 'stack', columns: 1, hidden: false }, tokens: { gap: '', padding: '', color: '', background: '', radius: '', typography: '' } };
function page(root, scenarios = []) { return { kind: 'page', id: 'vp-1', ownerId: 'surface-a', name: 'Orders', root, scenarios, notes: '' }; }
function port(sourceId, operationId, data, run = async () => ({ ok: true })) {
  const calls = []; return { calls, port: { sourceId, operationId, direction: 'read', requiresInput: false, data, pending: false, error: null, run: async input => { calls.push(input); return run(input); } } };
}
function mountVisual(spec, props = {}, ports = [], declared) {
  const requests = [], handled = [], navigated = [], emitted = [];
  const app = createApp({});
  provideVisualContext(app, { ports, navigate: target => { navigated.push(target); }, handle: async request => { handled.push(request); if (props.failHandle) throw new Error('IMPLEMENTATION_REQUIRED: ' + request.interactionId); } });
  const scope = effectScope(); const reactiveProps = reactive(props);
  const model = app.runWithContext(() => scope.run(() => useVisual(spec, reactiveProps, request => { requests.push(request); }, declared === false ? undefined : (event, payload) => { emitted.push([event, payload]); })));
  return { model, scope, props: reactiveProps, requests, handled, navigated, emitted };
}
const settle = async () => { for (let i = 0; i < 5; i++) { await nextTick(); await new Promise(resolve => setImmediate(resolve)); } };

test('visualIndex walks children, slot fallbacks and component slots', () => {
  const spec = page([{ id: 'vn-1', kind: 'element', tag: 'div', attrs: {}, events: [], children: [nuxt('vn-2', 'u-card', {}, { slots: { default: [text('vn-3', lit('a'))] } })] }]);
  spec.root.push({ id: 'vn-4', kind: 'slot', name: 'extra', fallback: [text('vn-5', lit('b'))] });
  assert.deepEqual([...visualIndex(spec).keys()], ['vn-1', 'vn-2', 'vn-3', 'vn-4', 'vn-5']);
});
test('local interactions update session state, values and visibility without the implementation hook', async () => {
  const spec = page([
    nuxt('vn-1', 'u-button', { label: lit('Toggle') }, { events: [act('vi-1', 'click', [{ kind: 'toggle', nodeId: 'vn-2' }, { kind: 'set-value', nodeId: 'vn-3', value: 'Ready' }])] }),
    text('vn-2', lit('Hidden later'), { layout: { mode: 'row', ui } }),
    text('vn-3', { kind: 'state', nodeId: 'vn-3' }),
    nuxt('vn-4', 'u-button', {}, { events: [act('vi-2', 'click', [{ kind: 'set-state', state: 'empty' }])] }),
    text('vn-5', lit('Empty only'), { visibleIn: ['empty'] }),
  ]);
  const { model, handled, requests } = mountVisual(spec);
  assert.equal(model.visible('vn-2'), true); assert.equal(model.visible('vn-5'), false);
  assert.equal(model.style('vn-2').flexDirection, 'row'); assert.deepEqual(model.style('vn-3'), {});
  assert.deepEqual(model.attrs('vn-1'), { 'data-design-node': 'vn-1' });
  assert.equal(model.props('vn-1').label, 'Toggle'); assert.equal(model.props('vn-1').disabled, false);
  model.on('vn-1').click(); await settle();
  assert.equal(model.visible('vn-2'), false); assert.equal(model.text('vn-3'), 'Ready');
  model.on('vn-4').click(); await settle();
  assert.equal(model.state.value, 'empty'); assert.equal(model.visible('vn-5'), true);
  assert.equal(handled.length, 0); assert.deepEqual(requests.map(r => r.interactionId), ['vi-1', 'vi-2']);
  assert.equal(model.message.value, '');
});
test('source actions run the matching port with the mapped payload and report failures', async () => {
  const save = port('orders', 'save', null, async input => (input.title === 'bad' ? { ok: false } : { ok: true }));
  const list = port('orders', 'list', { total: 3 });
  const spec = page([
    nuxt('vn-1', 'u-input', { modelValue: lit('') }),
    text('vn-2', { kind: 'source', sourceId: 'orders', operationId: 'list', field: 'total' }),
    nuxt('vn-3', 'u-button', {}, { events: [act('vi-1', 'click', [{ kind: 'source', sourceId: 'orders', operationId: 'save', input: { kind: 'object', fields: { title: { kind: 'draft', nodeId: 'vn-1' }, total: { kind: 'source', sourceId: 'orders', operationId: 'list', field: 'total' } } } }])] }),
  ]);
  const { model } = mountVisual(spec, {}, [save.port, list.port]);
  assert.equal(model.text('vn-2'), '3');
  model.props('vn-1')['onUpdate:modelValue']('Paper'); assert.equal(model.props('vn-1').modelValue, 'Paper');
  model.on('vn-3').click(); await settle();
  assert.deepEqual(save.calls, [{ title: 'Paper', total: 3 }]); assert.equal(model.message.value, '');
  model.props('vn-1')['onUpdate:modelValue']('bad'); model.on('vn-3').click(); await settle();
  assert.equal(model.message.value, 'The interaction could not be completed. Your input is retained.');
});
test('controls parse typed drafts, keep invalid input and follow loading or disabled states', async () => {
  const spec = page([
    nuxt('vn-1', 'u-input', { modelValue: lit('4'), type: lit('number') }, { control: { kind: 'number', required: true }, events: [act('vi-1', 'update:modelValue', [{ kind: 'set-value', nodeId: 'vn-2', value: 'changed' }])] }),
    text('vn-2', { kind: 'state', nodeId: 'vn-2' }),
    nuxt('vn-3', 'u-table', { data: lit([]) }),
    nuxt('vn-4', 'u-button', { disabled: lit(true) }),
  ]);
  const { model, props } = mountVisual(spec, { designState: 'default' });
  assert.equal(model.props('vn-1').modelValue, '4'); assert.equal(model.props('vn-3').loading, false); assert.equal(model.props('vn-4').disabled, true);
  model.props('vn-1')['onUpdate:modelValue']('12'); await settle();
  assert.equal(model.props('vn-1').modelValue, '12'); assert.equal(model.text('vn-2'), 'changed'); assert.equal(model.errors['vn-1'], undefined);
  model.props('vn-1')['onUpdate:modelValue']('twelve');
  assert.equal(model.props('vn-1').modelValue, 'twelve'); assert.match(model.errors['vn-1'], /valid number/);
  props.designState = 'loading'; await settle();
  assert.equal(model.props('vn-1').disabled, true); assert.equal(model.props('vn-3').loading, true); assert.equal(model.props('vn-4').disabled, true);
});
test('empty actions emit the request and reach the implementation hook', async () => {
  const spec = page([nuxt('vn-1', 'u-button', {}, { events: [act('vi-1', 'click', [])] })]);
  const { model, requests, handled } = mountVisual(spec, { failHandle: true });
  model.on('vn-1').click('payload'); await settle();
  assert.equal(requests.length, 1); assert.deepEqual(handled.map(r => [r.definitionId, r.nodeId, r.interactionId, r.event, r.payload]), [['vp-1', 'vn-1', 'vi-1', 'click', 'payload']]);
  assert.equal(model.message.value, 'Interaction implementation required.');
});
test('navigate and component emit actions use the context and declared emitter', async () => {
  const component = { kind: 'component', id: 'vc-1', libraryId: 'lib', exportName: 'Picker', description: '', props: [{ name: 'label', type: 'string', required: false }], slots: [], emits: [{ name: 'pick', payloadType: 'unknown' }], variants: [], scenarios: [],
    template: [nuxt('vn-1', 'u-button', { label: { kind: 'prop', name: 'label' } }, { events: [act('vi-1', 'click', [{ kind: 'emit', event: 'pick', payload: { kind: 'object', fields: { label: { kind: 'prop', name: 'label' }, at: { kind: 'event' } } } }, { kind: 'navigate', surfaceId: 'surface-b' }])] })] };
  const { model, emitted, navigated } = mountVisual(component, { label: 'Choose' });
  assert.equal(model.props('vn-1').label, 'Choose');
  model.on('vn-1').click(7); await settle();
  assert.deepEqual(emitted, [['pick', { label: 'Choose', at: 7 }]]); assert.deepEqual(navigated, ['surface-b']);
  const missing = mountVisual(component, { label: 'Choose' }, [], false);
  missing.model.on('vn-1').click(1); await settle();
  assert.equal(missing.model.message.value, 'The interaction could not be completed. Your input is retained.');
});
test('design scenarios provide fixture bindings, values and state, and reject source writes', async () => {
  const save = port('orders', 'save', null);
  const spec = page([
    text('vn-1', { kind: 'source', sourceId: 'orders', operationId: 'list', field: 'name' }),
    text('vn-2', { kind: 'state', nodeId: 'vn-2' }),
    nuxt('vn-3', 'u-button', {}, { events: [act('vi-1', 'click', [{ kind: 'source', sourceId: 'orders', operationId: 'save', input: { kind: 'none' } }])] }),
  ], [{ id: 'sc-1', name: 'Review', state: 'error', width: 'narrow', values: { 'vn-2': 'from scenario' }, bindings: [{ sourceId: 'orders', operationId: 'list', value: { name: 'Fixture' } }] }]);
  const { model } = mountVisual(spec, { designScenario: 'sc-1' }, [save.port]);
  assert.equal(model.state.value, 'error'); assert.equal(model.text('vn-1'), 'Fixture'); assert.equal(model.text('vn-2'), 'from scenario');
  model.on('vn-3').click(); await settle();
  assert.equal(save.calls.length, 0); assert.equal(model.message.value, 'The interaction could not be completed. Your input is retained.');
});
test('external adapters mount once, update on prop changes, route events and are destroyed exactly once', async () => {
  const log = [], adapters = [];
  const createAdapter = () => { const n = adapters.length + 1; const adapter = { mount: async (el, props, emit) => { log.push([n, 'mount', el.tagName, props.value]); adapter.emit = emit; }, update: props => { log.push([n, 'update', props.value]); }, destroy: () => { log.push([n, 'destroy']); } }; adapters.push(adapter); return adapter; };
  const component = { kind: 'component', id: 'vc-1', libraryId: 'lib', exportName: 'Editor', description: '', props: [{ name: 'doc', type: 'string', required: false }], slots: [], emits: [], variants: [], scenarios: [], dependencies: [{ package: 'editor-lib', version: '1.0.0', purpose: 'Editing' }],
    template: [{ id: 'vn-1', kind: 'external', package: 'editor-lib', adapter: 'editor', props: { value: { kind: 'prop', name: 'doc' } }, events: [act('vi-1', 'change', [{ kind: 'set-value', nodeId: 'vn-2', value: 'edited' }])] }, text('vn-2', { kind: 'state', nodeId: 'vn-2' })] };
  const { model, scope, props, requests } = mountVisual(component, { doc: 'first' });
  const bind = model.external('vn-1', createAdapter);
  assert.equal(model.external('vn-1', createAdapter), bind);
  const el = dom.document.createElement('div');
  bind(el); bind(el); await settle();
  assert.equal(adapters.length, 1); assert.deepEqual(log, [[1, 'mount', 'DIV', 'first']]);
  props.doc = 'second'; await settle();
  assert.deepEqual(log.at(-1), [1, 'update', 'second']);
  adapters[0].emit('change', 'x'); await settle();
  assert.equal(model.text('vn-2'), 'edited');
  bind(null); bind(null); await settle();
  assert.deepEqual(log.at(-1), [1, 'destroy']);
  bind(dom.document.createElement('section')); await settle();
  assert.equal(adapters.length, 2); assert.deepEqual(log.at(-1), [2, 'mount', 'SECTION', 'second']);
  const routed = requests.length; adapters[0].emit('change', 'stale'); await settle();
  assert.equal(requests.length, routed);
  scope.stop(); scope.stop();
  assert.deepEqual(log.filter(entry => entry[1] === 'destroy'), [[1, 'destroy'], [2, 'destroy']]);
  adapters[1].emit('change', 'late'); props.doc = 'third'; await settle();
  assert.deepEqual(log.filter(entry => entry[1] === 'update'), [[1, 'update', 'second']]);
  const removed = mountVisual(component, { doc: 'only' }), removedBind = removed.model.external('vn-1', createAdapter);
  removedBind(dom.document.createElement('div')); await settle(); removedBind(null); removed.scope.stop();
  assert.deepEqual(log.filter(entry => entry[0] === 3 && entry[1] === 'destroy').length, 1);
});
test('external adapter failures surface as a message instead of throwing into Vue', async () => {
  const component = { kind: 'component', id: 'vc-1', libraryId: 'lib', exportName: 'Editor', description: '', props: [], slots: [], emits: [], variants: [], scenarios: [],
    template: [{ id: 'vn-1', kind: 'external', package: 'editor-lib', adapter: 'editor', props: {}, events: [] }] };
  const { model } = mountVisual(component);
  const failing = { mount: () => { const error = new Error('Adapter "editor" is not implemented.'); error.name = 'NotImplementedError'; throw error; }, update() {}, destroy() {} };
  const bind = model.external('vn-1', () => failing);
  assert.doesNotThrow(() => bind(dom.document.createElement('div'))); await settle();
  assert.equal(model.message.value, 'External component implementation required.');
});
test('every interaction declared for one event runs, in order, within one pending span', async () => {
  const spec = page([
    nuxt('vn-1', 'u-button', {}, { events: [act('vi-1', 'click', [{ kind: 'set-value', nodeId: 'vn-2', value: 'first' }]), act('vi-2', 'click', [{ kind: 'toggle', nodeId: 'vn-3' }, { kind: 'navigate', surfaceId: 'surface-b' }])] }),
    text('vn-2', { kind: 'state', nodeId: 'vn-2' }), text('vn-3', lit('Toggled')),
  ]);
  const { model, requests, navigated } = mountVisual(spec);
  model.on('vn-1').click(); await settle();
  assert.equal(model.text('vn-2'), 'first'); assert.equal(model.visible('vn-3'), false); assert.deepEqual(navigated, ['surface-b']);
  assert.deepEqual(requests.map(r => r.interactionId), ['vi-1', 'vi-2']); assert.equal(model.message.value, ''); assert.equal(model.state.value, 'default');
});
const editorTemplate = (props, extra = []) => ({ kind: 'component', id: 'vc-1', libraryId: 'lib', exportName: 'Editor', description: '', props: [], slots: [], emits: [], variants: [], scenarios: [], dependencies: [{ package: 'editor-lib', version: '1.0.0', purpose: 'Editing' }],
  template: [{ id: 'vn-1', kind: 'external', package: 'editor-lib', adapter: 'editor', props, events: [] }, ...extra] });
const recorder = log => () => ({ mount: (el, props) => { log.push(['mount', el.isConnected, props.value]); }, update: props => { log.push(['update', props.value]); }, destroy: () => { log.push(['destroy']); } });
test('state-bound external props update the adapter after a local set-value', async () => {
  const log = [];
  const component = editorTemplate({ value: { kind: 'state', nodeId: 'vn-2' } }, [nuxt('vn-2', 'u-button', {}, { events: [act('vi-1', 'click', [{ kind: 'set-value', nodeId: 'vn-2', value: 'new' }])] })]);
  const { model } = mountVisual(component);
  model.external('vn-1', recorder(log))(dom.document.createElement('div')); await settle();
  assert.deepEqual(log, [['mount', false, undefined]]);
  model.on('vn-2').click(); await settle();
  assert.deepEqual(log.at(-1), ['update', 'new']);
});
test('external adapters mount after render and never mount an element removed before the tick', async () => {
  const log = []; let created = 0; const create = recorder(log);
  const { model } = mountVisual(editorTemplate({ value: lit('v') }));
  const bind = model.external('vn-1', () => { created++; return create(); });
  const el = dom.document.createElement('div');
  bind(el); assert.equal(created, 0); dom.document.body.appendChild(el); await settle();
  assert.equal(created, 1); assert.deepEqual(log, [['mount', true, 'v']]);
  bind(null); const gone = dom.document.createElement('div'); bind(gone); bind(null); await settle();
  assert.equal(created, 1); assert.deepEqual(log, [['mount', true, 'v'], ['destroy']]);
});

const { projectModel } = await import('../../scripts/companion/compiler/model.ts');
const { migrateCompanionDocument } = await import('../../scripts/companion/project-contract.mjs');
const { visualDefinitions, visualSpecs, visualNuxtImports, visualContractTypes, visualComponentPath, visualPagePath, visualComponentName, visualLibraryWithoutDefinition, visualPackages } = await import('../../scripts/companion/compiler/visual-model.ts');
const self = migrateCompanionDocument(JSON.parse(await readFile('docs/concepts/companion/companion-project.json', 'utf8'))).document;
test('model exposes validated definitions and explicit Nuxt UI imports', () => {
  const m = projectModel(self), store = visualDefinitions(m);
  assert.equal(visualSpecs(m).length, store.pages.length + store.components.length);
  const imports = visualNuxtImports(store.pages.flatMap(p => p.root));
  assert.ok(imports.every(i => /^@nuxt\/ui\/components\/[A-Z][A-Za-z]+\.vue$/.test(i.path)));
  assert.match(visualContractTypes(store.components[0]), /export interface ComponentProps[\s\S]*export interface ComponentEvents[\s\S]*export interface ComponentSlots/);
});
test('invalid visual data stops generation with a named reason', () => {
  const bad = structuredClone(self); bad.design.visualDesigns.pages[0].root.push({ id: 'vn-999999', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-evil' }, props: {}, slots: {}, events: [] });
  assert.throws(() => visualDefinitions(projectModel(bad)), /u-evil/);
});
test('specs list pages then components with the project design system and generated paths', () => {
  const m = projectModel(self), store = visualDefinitions(m), specs = visualSpecs(m);
  assert.deepEqual(specs.map(s => s.kind), [...store.pages.map(() => 'page'), ...store.components.map(() => 'component')]);
  assert.deepEqual(specs.map(s => s.id), [...store.pages, ...store.components].map(d => d.id));
  assert.ok(self.design.designSystem); for (const spec of specs) assert.deepEqual(spec.designSystem, self.design.designSystem);
  const [page] = store.pages, [component] = store.components;
  assert.equal(visualPagePath(m, page), m.sourceRoot + '/presentation/components/details/' + page.id + '.vue');
  assert.equal(visualComponentPath(m, component), m.sourceRoot + '/presentation/components/library/' + component.libraryId + '.vue');
  assert.equal(visualComponentName(component), component.exportName);
  assert.deepEqual(visualLibraryWithoutDefinition(m).map(l => l.id), m.components.filter(l => !store.components.some(c => c.libraryId === l.id)).map(l => l.id));
  const trimmed = structuredClone(self); Object.assign(trimmed.design.visualDesigns, { pages: [], components: [], revisions: [] });
  assert.equal(visualLibraryWithoutDefinition(projectModel(trimmed)).length, m.components.length);
  const absent = structuredClone(self); delete absent.design.visualDesigns;
  assert.deepEqual(visualDefinitions(projectModel(absent)), { schema: 3, nextId: 1, catalog: { id: 'nuxt-ui', version: 1 }, pages: [], components: [], layouts: [], revisions: [] });
});
test('source references are validated against the model operations', () => {
  const bad = structuredClone(self), store = bad.design.visualDesigns;
  store.pages[0].root.push({ id: 'vn-' + store.nextId++, kind: 'text', role: 'p', value: { kind: 'source', sourceId: 'missing-source', operationId: 'op', field: '' } });
  assert.doesNotThrow(() => projectModel(bad));
  assert.throws(() => visualDefinitions(projectModel(bad)), /VISUAL_INVALID: .*missing-source\/op/);
});
test('Nuxt UI imports are unique, sorted and cover slot content', () => {
  const nodes = [nuxt('vn-1', 'u-card', {}, { slots: { default: [nuxt('vn-2', 'u-button'), { id: 'vn-3', kind: 'element', tag: 'div', attrs: {}, events: [], children: [nuxt('vn-4', 'u-badge'), nuxt('vn-5', 'u-button')] }] } }), nuxt('vn-6', 'u-form-field')];
  assert.deepEqual(visualNuxtImports(nodes), [
    { name: 'UBadge', path: '@nuxt/ui/components/Badge.vue' }, { name: 'UButton', path: '@nuxt/ui/components/Button.vue' },
    { name: 'UCard', path: '@nuxt/ui/components/Card.vue' }, { name: 'UFormField', path: '@nuxt/ui/components/FormField.vue' },
  ]);
});
test('component contracts declare typed props, emits and slots', () => {
  const source = visualContractTypes({ props: [{ name: 'title', type: 'string', required: true }, { name: 'count', type: 'number', required: false }], slots: [{ name: 'actions', required: false }, { name: 'body', required: true }], emits: [{ name: 'close', payloadType: 'void' }, { name: 'pick', payloadType: 'unknown' }, { name: 'toggle', payloadType: 'boolean' }], variants: [] });
  assert.equal(source, 'export interface ComponentProps {\n  "title": string;\n  "count"?: number;\n}\nexport interface ComponentEvents {\n  "close": [payload: undefined];\n  "pick": [payload: unknown];\n  "toggle": [payload: boolean];\n}\nexport interface ComponentSlots {\n  "actions"?: () => unknown;\n  "body": () => unknown;\n}\n');
  assert.equal(visualContractTypes({ props: [], slots: [], emits: [], variants: [] }), 'export interface ComponentProps {\n}\nexport interface ComponentEvents {\n}\nexport interface ComponentSlots {\n}\n');
});
test('declared component packages merge as exact pins and framework conflicts name both versions', () => {
  const withDeps = dependencies => { const doc = structuredClone(self); doc.design.visualDesigns.components[0].dependencies = dependencies; return projectModel(doc); };
  const framework = { vue: '3.5.43', '@nuxt/ui': '4.11.2', typescript: '6.0.3' };
  assert.deepEqual(visualPackages(projectModel(self), framework), {});
  const name = self.design.visualDesigns.components[0].exportName;
  const merged = visualPackages(withDeps([{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text' }, { package: 'vue', version: '3.5.43', purpose: 'Same pin' }, { package: 'a-lib', version: '1.0.0', purpose: 'Sorting' }]), framework);
  assert.deepEqual(Object.entries(merged), [['@tiptap/vue-3', '2.11.5'], ['a-lib', '1.0.0'], ['vue', '3.5.43']]);
  assert.throws(() => visualPackages(withDeps([{ package: 'vue', version: '3.0.0', purpose: 'Old' }]), framework), { message: 'VISUAL_INVALID: vue is pinned to 3.5.43 by the framework and 3.0.0 by ' + name + '.' });
});
