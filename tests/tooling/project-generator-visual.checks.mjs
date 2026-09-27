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
  for (const name of ['visible', 'style', 'text', 'a11y', 'props', 'attrs', 'on', 'message', 'attach', 'theme', 'state', 'external']) assert.match(text, new RegExp('\\b' + name + '\\b'));
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
test('a11y returns author accessibility notes and undefined when absent or empty', () => {
  const { model } = mountVisual(page([text('vn-1', lit('a'), { a11y: 'Totals for the current filter' }), text('vn-2', lit('b'), { a11y: '' }), text('vn-3', lit('c'))]));
  assert.equal(model.a11y('vn-1'), 'Totals for the current filter');
  assert.equal(model.a11y('vn-2'), undefined); assert.equal(model.a11y('vn-3'), undefined); assert.equal(model.a11y('vn-404'), undefined);
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
// Local effects, source calls and navigation run in the authored order; a failed source stops the rest of the interaction.
test('mixed interactions run actions in authored order and stop at the first failing action', async () => {
  for (const ok of [true, false]) {
    const seen = [], { port: save } = port('orders', 'save', null, async input => { seen.push([input, model.visible('vn-4'), model.state.value]); return { ok }; });
    const actions = [{ kind: 'set-value', nodeId: 'vn-2', value: 'typed' }, { kind: 'source', sourceId: 'orders', operationId: 'save', input: { kind: 'draft', nodeId: 'vn-2' } }, { kind: 'toggle', nodeId: 'vn-4' }, { kind: 'navigate', surfaceId: 'surface-b' }, { kind: 'set-state', state: 'empty' }];
    const spec = page([nuxt('vn-1', 'u-button', {}, { events: [act('vi-1', 'click', actions)] }), nuxt('vn-2', 'u-input'), text('vn-3', { kind: 'state', nodeId: 'vn-2' }), text('vn-4', lit('Shown until toggled'))]);
    const { model, navigated } = mountVisual(spec, {}, [save]);
    model.on('vn-1').click(); await settle();
    assert.deepEqual(seen, [['typed', true, 'loading']], 'the source sees the earlier set-value and not the later toggle');
    assert.equal(model.text('vn-3'), 'typed');
    assert.deepEqual([model.visible('vn-4'), navigated, model.state.value], ok ? [false, ['surface-b'], 'empty'] : [true, [], 'error'], ok ? 'all actions ran' : 'nothing after the failed source ran');
  }
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

const { visualSfc } = await import('../../scripts/companion/compiler/visual-code.ts');
const { writeFile } = await import('node:fs/promises');
const { readFileSync } = await import('node:fs');
const { visualNodes } = await import('../../scripts/companion/visual/visual-ir.mjs');
const { parse: parseSfc, compileTemplate } = await import('vue/compiler-sfc');
/** Golden fixture: the reviewed v5 seed plus an editor wrapping a declared package and a placeholder component. */
function goldenFixture() {
  const doc = structuredClone(self), design = doc.design, store = JSON.parse(readFileSync('tests/fixtures/companion/visual-v5.json', 'utf8'));
  const [page] = design.nodes.filter(n => n.kind === 'page');
  design.nodes.push(...[['node-customers', 'customers', 'Customers'], ['node-settings', 'customer-settings', 'Settings']].map(([id, slug, label]) => ({ ...page, id, slug, label, parent: null, components: [], bricks: [] })));
  const [library] = design.library;
  design.library.push(...[['library-search', 'SearchField'], ['library-editor', 'RichEditor'], ['library-pending', 'PendingCard']].map(([id, name]) => ({ ...library, id, name })));
  const [source] = design.dataSources.sources, [operation] = source.operations;
  design.dataSources.sources.push({ ...source, id: 'customers', slug: 'customers', name: 'Customers', operations: [{ ...operation, id: 'list', slug: 'list-customers', name: 'List customers', output: { mode: 'fields', entity: null, many: false, fields: [{ name: 'items', type: 'array', required: false }], schema: null } }] });
  const act = (id, event, actions) => ({ id, event, label: 'Interaction ' + id, notes: '', acceptance: '', actions });
  Object.assign(store.pages[0].root[0].children.find(n => n.id === 'vn-10'), { a11y: 'evil "a11y" {{ note }}' });
  store.pages[0].root[0].children.find(n => n.id === 'vn-10').ref.revisionId = 'vr-24';
  store.pages[0].root[0].children.unshift(text('vn-25', lit('{{ evil }} </template><script>alert(1)</script>'), { layout: store.pages[0].root[0].layout }));
  store.components.push({ id: 'vc-26', libraryId: 'library-editor', exportName: 'RichEditor', description: 'Rich text editor', notes: '',
    props: [{ name: 'doc', type: 'string', required: true }, { name: 'readonly', type: 'boolean', required: false }], slots: [{ name: 'toolbar', required: false }],
    emits: [{ name: 'change', payloadType: 'string' }, { name: 'ready', payloadType: 'void' }, { name: 'raw', payloadType: 'unknown' }], variants: [], scenarios: [],
    dependencies: [{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text editing' }],
    template: [{ id: 'vn-27', kind: 'element', tag: 'section', a11y: 'evil element note', attrs: { 'aria-label': lit('Editor') }, events: [], children: [
      { id: 'vn-28', kind: 'slot', name: 'toolbar', a11y: 'evil slot note', fallback: [text('vn-29', { kind: 'prop', name: 'doc' }, { role: 'span', a11y: '' })], layout: store.pages[0].root[0].layout },
      { id: 'vn-30', kind: 'external', package: '@tiptap/vue-3', adapter: 'editor', a11y: 'evil editor note', props: { content: { kind: 'prop', name: 'doc' }, editable: lit(true) }, events: [act('vi-31', 'update', [{ kind: 'emit', event: 'change', payload: { kind: 'event' } }])] },
      { id: 'vn-32', kind: 'element', tag: 'input', attrs: { placeholder: lit('Title') }, children: [], events: [act('vi-33', 'change', [{ kind: 'emit', event: 'ready', payload: { kind: 'none' } }])] },
      nuxt('vn-34', 'u-card', {}, { a11y: 'evil card note', slots: { header: [text('vn-35', lit('Preview'), { role: 'h3', a11y: 'evil text note' })] } }),
    ] }] });
  store.components.push({ id: 'vc-36', libraryId: 'library-pending', exportName: 'PendingCard', description: 'Not designed yet', props: [{ name: 'title', type: 'string', required: false }], slots: [{ name: 'actions', required: false }], emits: [], variants: [], scenarios: [], template: [] });
  store.nextId = 37; design.visualDesigns = store;
  return doc;
}
const golden = new Set(['vp-2', 'vc-1', 'vc-26', 'vc-36']);
test('SFC lowering matches reviewed golden files', async () => {
  const m = projectModel(goldenFixture()), store = visualDefinitions(m), specs = visualSpecs(m).filter(s => golden.has(s.id));
  assert.deepEqual(specs.map(s => s.id).sort(), [...golden].sort());
  for (const spec of specs) {
    const actual = visualSfc(m, spec, store), path = 'tests/fixtures/companion/visual-golden/' + spec.id + '.vue.txt';
    if (process.env.UPDATE_GOLDEN) await writeFile(path, actual);
    assert.equal(actual, await readFile(path, 'utf8'), spec.id);
    assert.doesNotMatch(actual, /v-html|innerHTML|\beval\b|evil|alert/);
    const { descriptor, errors } = parseSfc(actual, { filename: spec.id + '.vue' });
    assert.deepEqual(errors, [], spec.id);
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, id: spec.id, filename: spec.id + '.vue' }).errors, [], spec.id);
  }
});
test('every lowered node carries its marker and visibility guard; externals bind through the adapter only', async () => {
  const m = projectModel(goldenFixture()), store = visualDefinitions(m), [editor] = visualSpecs(m).filter(s => s.id === 'vc-26');
  const code = visualSfc(m, editor, store);
  for (const node of visualNodes(editor.template)) {
    assert.ok(code.includes(`data-design-node="${node.id}" v-if="model.visible('${node.id}')"`), node.id);
    assert.equal(code.includes(`:style="model.style('${node.id}')"`), Boolean(node.layout), node.id);
  }
  assert.match(code, /import \{ createAdapter as createAdapter_0 \} from "\.\/library-editor\/editor\.adapter\.ts";/);
  assert.match(code, /:ref="model\.external\('vn-30', createAdapter_0\)"/);
  assert.doesNotMatch(code, /model\.on\('vn-30'\)|model\.props\('vn-30'\)/);
});
test('every node with accessibility notes binds them through model.a11y, and only those nodes', () => {
  const m = projectModel(goldenFixture()), store = visualDefinitions(m);
  let described = 0;
  for (const spec of visualSpecs(m).filter(s => golden.has(s.id))) {
    const code = visualSfc(m, spec, store), roots = spec.kind === 'page' ? spec.root : spec.template;
    for (const node of visualNodes(roots)) {
      const tag = code.split('<').find(t => t.includes(`data-design-node="${node.id}" v-if=`)) ?? '';
      assert.equal(tag.includes(`:aria-description="model.a11y('${node.id}')"`), Boolean(node.a11y), node.id);
      if (node.a11y) described++;
    }
  }
  assert.equal(described, 6);
});
test('pinned instances render the live component only while its contract satisfies the pinned revision', () => {
  const m = projectModel(goldenFixture()), store = visualDefinitions(m), [customers] = visualSpecs(m).filter(s => s.id === 'vp-2');
  const live = changes => { const next = structuredClone(store); changes(next.components.find(c => c.id === 'vc-1')); return () => visualSfc(m, customers, next); };
  assert.doesNotThrow(live(() => {}));
  assert.doesNotThrow(live(c => { c.props.push({ name: 'extra', type: 'number', required: false }); }));
  const pinned = /VISUAL_INVALID: Page "Customers": node vn-10 pins SearchField revision vr-24 \(version 1\.0\.0\), but the live contract no longer satisfies it: /;
  assert.throws(live(c => { c.props = []; }), new RegExp(pinned.source + 'prop query: string[.]$'));
  assert.throws(live(c => { c.props[0].type = 'number'; }), new RegExp(pinned.source + 'prop query: string[.]$'));
  assert.throws(live(c => { c.props.push({ name: 'limit', type: 'number', required: true }); }), new RegExp(pinned.source + 'new required prop limit[.]$'));
  assert.throws(live(c => { c.slots = []; c.emits = []; }), new RegExp(pinned.source + 'slot actions, emit search[.]$'));
  const orphan = structuredClone(customers); orphan.root[0].children.find(n => n.id === 'vn-10').ref.revisionId = 'vr-999';
  assert.throws(() => visualSfc(m, orphan, store), /node vn-10 pins SearchField revision vr-999, which does not exist/);
});
test('names and identifiers that could escape template syntax stop lowering', () => {
  const m = projectModel(goldenFixture()), store = visualDefinitions(m), [editor] = visualSpecs(m).filter(s => s.id === 'vc-26');
  const broken = mutate => { const spec = structuredClone(editor); mutate(spec); return () => visualSfc(m, spec, store); };
  assert.throws(broken(s => { s.template[0].id = `vn-27" onclick="x`; }), /VISUAL_INVALID: .*RichEditor.*vn-27/);
  assert.throws(broken(s => { s.template[0].children[0].name = 'toolbar"><script'; }), /VISUAL_INVALID: .*RichEditor.*slot/);
  assert.throws(broken(s => { s.template[0].children[1].adapter = '../evil'; }), /VISUAL_INVALID: .*RichEditor.*adapter/);
  assert.throws(broken(s => { s.template[0].tag = 'script'; }), /VISUAL_INVALID: .*RichEditor.*script/);
  assert.throws(broken(s => { s.exportName = 'Teleport'; }), /VISUAL_INVALID: .*Teleport/);
  assert.throws(broken(s => { s.libraryId = '../escape'; }), /VISUAL_INVALID: .*RichEditor.*library/);
  const [customers] = visualSpecs(m).filter(s => s.id === 'vp-2'), paged = structuredClone(customers);
  paged.root.push(structuredClone(editor.template[0].children[1]));
  assert.throws(() => visualSfc(m, paged, store), /VISUAL_INVALID: Page "Customers": external node vn-30 is only valid in a component template/);
  const scripted = broken(s => { s.emits[0].name = '</script><script>x'; })();
  assert.ok(!scripted.includes('</script><script>'));
  const lt = String.fromCharCode(92) + 'u003c', gt = String.fromCharCode(92) + 'u003e';
  assert.ok(scripted.includes(`case "${lt}/script${gt}${lt}script${gt}x": if (typeof payload === "string")`));
});

const { projectFiles } = await import('../../scripts/companion/compiler/project-files.ts');
test('self-project generates visual files and no detail artifacts', async () => {
  const files = await projectFiles(process.cwd(), projectModel(self)); const paths = files.map(f => f.path);
  assert.ok(paths.some(p => /presentation\/components\/details\/vp-\d+\.vue$/.test(p)));
  assert.ok(paths.some(p => /domain\/visual\/vc-\d+\.ts$/.test(p)));
  assert.ok(paths.includes('design/visual-traceability.json'));
  assert.equal(paths.some(p => /use-detail\.ts$|domain\/details\/|detail-traceability/.test(p)), false);
  const sfc = files.find(f => /details\/vp-\d+\.vue$/.test(f.path)).content; assert.match(sfc, /useVisual\(spec/);
  // Lowering quotes import specifiers with JSON literals (see the golden files), so either quote style is accepted.
  assert.ok(files.some(f => f.path.endsWith('.vue') && /from (["'])@nuxt\/ui\/components\/[A-Z]\w+\.vue\1/.test(f.content)));
  assert.ok(files.some(f => f.path.endsWith('domain/components/' + self.design.visualDesigns.components[0].libraryId + '.ts')));
});
test('declared packages merge into package.json with extension-owned adapters, adapter tests and a license note', async () => {
  const doc = structuredClone(self), store = doc.design.visualDesigns, [component] = store.components, before = JSON.parse(await readFile('package.json', 'utf8'));
  component.dependencies = [{ package: '@tiptap/vue-3', version: '2.11.5', purpose: 'Rich text\nediting' }];
  const interactionId = 'vi-' + (store.nextId + 1);
  component.template.push({ id: 'vn-' + store.nextId, kind: 'external', package: '@tiptap/vue-3', adapter: 'editor', props: { content: lit('') }, events: [act(interactionId, 'update', [])] }); store.nextId += 2;
  const files = await projectFiles(process.cwd(), projectModel(doc)), get = path => files.find(f => f.path === path);
  const pkg = JSON.parse(get('package.json').content), names = Object.keys(pkg.dependencies);
  assert.equal(pkg.dependencies['@tiptap/vue-3'], '2.11.5'); assert.deepEqual(names, [...names].sort()); assert.deepEqual(pkg.devDependencies, before.devDependencies);
  assert.equal(JSON.parse(get('package-lock.json').content).packages[''].dependencies['@tiptap/vue-3'], undefined);
  const adapter = get(`src/generated/presentation/components/library/${component.libraryId}/editor.adapter.ts`);
  assert.equal(adapter.ownership, 'extension');
  for (const part of ['import type { VisualExternalAdapter } from "../../../../domain/visual-runtime.ts";', 'import { NotImplementedError } from "../../../../domain/contract.ts";', '// Implement with: import … from "@tiptap/vue-3"', 'export interface Props extends Record<string, unknown> {\n  "content": unknown;\n}', 'export function createAdapter(): VisualExternalAdapter<Props>'])
    assert.ok(adapter.content.includes(part), part);
  assert.equal(adapter.content.match(/throw new NotImplementedError\("@tiptap\/vue-3 adapter editor", "(mount|update|destroy)"\)/g).length, 3);
  const lifecycle = get(`tests/project/acceptance/${component.libraryId}-editor.adapter.test.ts`).content;
  assert.match(lifecycle, /it\.todo\("\[[a-z0-9-]+\/editor\] implement the @tiptap\/vue-3 adapter/);
  assert.ok(lifecycle.includes(`vi.mock("../../../src/generated/presentation/components/library/${component.libraryId}/editor.adapter.ts"`));
  assert.ok(lifecycle.includes(`fake.emit("update", 'fixture'); await flushPromises();`) && lifecycle.includes(`toContain("${interactionId}");`));
  assert.ok(lifecycle.includes('expect(fake.log).toEqual(["mount","destroy"]);'));
  const notes = get('PROJECT-IMPLEMENTATION.md').content;
  assert.ok(notes.includes(`- @tiptap/vue-3@2.11.5 (${component.exportName}): Rich text editing`));
  assert.ok(notes.includes("Licenses of these packages are the author's responsibility"));
  assert.ok(notes.includes(`- \`src/generated/presentation/components/library/${component.libraryId}/editor.adapter.ts\` (@tiptap/vue-3, ${component.exportName})`), 'the real adapter path');
  assert.ok(!notes.includes('library/<library>/'), 'no placeholder path');
  assert.deepEqual(JSON.parse(get('design/visual-traceability.json').content).adapters.map(a => [a.package, a.adapter]), [['@tiptap/vue-3', 'editor']]);
  assert.ok((await projectFiles(process.cwd(), projectModel(self))).find(f => f.path === 'PROJECT-IMPLEMENTATION.md').content.includes('No visual component declares a third-party package.'));
});
