/** Actual shared runtime with real Vue reactivity and explicitly controlled data/handler ports. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, effectScope, nextTick, reactive, ref } from 'vue';
import { useVisual, provideVisualContext } from '../../../templates/companion/runtime/use-visual.ts';
const literal = value => ({ kind: 'literal', value });
const button = (id, actions) => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-button' }, props: {}, slots: {}, events: [{ id: 'vi-' + id, event: 'click', label: id, notes: '', acceptance: '', actions }] });
const layout = { mode: 'row', ui: { gap: 8, padding: 4, columns: 2, align: 'start', justify: 'start', wrap: false, overflow: 'visible', widthMode: 'fill', width: 320, minWidth: 0, maxWidth: 1200, narrow: { layout: 'stack', columns: 1, hidden: false }, tokens: { gap: '', padding: '', color: '', background: '', radius: '', typography: '' } } };
const spec = {
  kind: 'page', id: 'vp-orders', ownerId: 'orders', name: 'Orders', notes: '',
  root: [
    { id: 'title', layout, kind: 'text', role: 'p', value: { kind: 'source', sourceId: 'orders', operationId: 'read', field: 'title' } },
    { id: 'draft', kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-input' }, props: { modelValue: literal('base') }, slots: {}, events: [] },
    { id: 'zero', kind: 'text', role: 'p', value: { kind: 'state', nodeId: 'zero' } },
    { id: 'false', kind: 'text', role: 'p', value: { kind: 'state', nodeId: 'false' } },
    button('clear', [{ kind: 'set-value', nodeId: 'draft', value: '' }]),
    button('navigate', [{ kind: 'navigate', surfaceId: 'next-page' }]),
    button('read', [{ kind: 'source', sourceId: 'orders', operationId: 'read', input: { kind: 'none' } }]),
    button('write', [{ kind: 'source', sourceId: 'orders', operationId: 'write', input: { kind: 'none' } }]),
    button('hook', []),
  ],
  scenarios: [
    { id: 'filled', name: 'Filled', state: 'default', width: 'wide', values: { draft: 'authored draft', zero: 0, false: false }, bindings: [{ sourceId: 'orders', operationId: 'read', value: { title: 'Authored order' } }] },
    { id: 'empty', name: 'Empty', state: 'empty', width: 'narrow', values: { draft: '' }, bindings: [{ sourceId: 'orders', operationId: 'read', value: { title: 'No orders' } }] },
  ],
};
const settle = async () => { for (let index = 0; index < 5; index++) await nextTick(); };
function mount(t, options = {}) {
  const active = ref(options.scenario ?? 'filled'), events = [], calls = [], navigated = [], handled = [], props = reactive(options.props ?? {});
  const app = createApp({}), scope = effectScope();
  const ports = ['read', 'write'].map(operationId => ({ sourceId: 'orders', operationId, direction: operationId, requiresInput: false, data: { title: 'Synthetic baseline' }, pending: false, error: null,
    async run() { calls.push(operationId); return { ok: true }; } }));
  provideVisualContext(app, { ports, scenarioReadOnly: options.readOnly, scenario: id => id === 'vp-orders' ? active.value : undefined,
    navigate: id => navigated.push(id), handle: async request => { handled.push(request); return options.handle?.(request); } });
  const model = app.runWithContext(() => scope.run(() => useVisual(options.spec ?? spec, props, event => events.push(event))));
  t.after(() => scope.stop());
  return { model, active, props, events, calls, navigated, handled, scope };
}
test('preview-owned scenarios supply exact samples and false/zero values without mutating the spec', async t => {
  const original = structuredClone(spec), { model, active } = mount(t);
  assert.equal(model.style('title').flexDirection, 'row');
  assert.equal(model.text('title'), 'Authored order'); assert.equal(model.props('draft').modelValue, 'authored draft');
  assert.equal(model.text('zero'), '0'); assert.equal(model.text('false'), 'false');
  model.props('draft')['onUpdate:modelValue']('session edit'); assert.equal(model.props('draft').modelValue, 'session edit');
  active.value = 'empty'; await settle(); assert.equal(model.state.value, 'empty'); assert.equal(model.props('draft').modelValue, '');
  assert.equal(model.text('title'), 'No orders'); assert.equal(model.style('title').flexDirection, 'column'); assert.deepEqual(spec, original);
  active.value = 'filled'; await settle(); assert.equal(model.props('draft').modelValue, 'authored draft');
});
test('scenarios refuse both source reads/writes and implementation hooks but retain local navigation/effects', async t => {
  const { model, calls, handled, navigated } = mount(t);
  for (const id of ['read', 'write', 'hook']) {
    model.on(id).click(); await settle();
    assert.equal(model.message.value, 'The interaction could not be completed. Your input is retained.');
    assert.equal(model.props('draft').modelValue, 'authored draft');
  }
  assert.deepEqual(calls, []); assert.deepEqual(handled, []);
  model.on('clear').click(); await settle(); assert.equal(model.props('draft').modelValue, '');
  model.on('navigate').click(); await settle(); assert.deepEqual(navigated, ['next-page']);
});
test('an explicit component scenario takes precedence and an empty override disables the preview context', async t => {
  const { model, props, active, calls, handled } = mount(t, { props: { designScenario: 'empty' } });
  assert.equal(model.state.value, 'empty'); active.value = 'filled'; await settle(); assert.equal(model.text('title'), 'No orders');
  props.designScenario = ''; await settle(); assert.equal(model.text('title'), 'Synthetic baseline');
  model.on('read').click(); await settle(); model.on('hook').click(); await settle();
  assert.deepEqual(calls, ['read']); assert.equal(handled.length, 1);
});
test('selection is scoped to the exact definition and each mount keeps an independent draft', async t => {
  const a = mount(t), b = mount(t), foreign = mount(t, { spec: { ...spec, id: 'vp-unrelated' } });
  assert.equal(foreign.model.text('title'), 'Synthetic baseline');
  a.model.props('draft')['onUpdate:modelValue']('A only'); assert.equal(b.model.props('draft').modelValue, 'authored draft');
  a.active.value = 'empty'; await settle(); assert.equal(b.model.state.value, 'default');
  a.scope.stop(); a.active.value = 'filled'; await settle(); assert.equal(a.model.props('draft').modelValue, '');
  a.model.on('hook').click(); await settle(); assert.deepEqual(a.handled, []);
});
test('native/default contexts retain source execution and explicit design-state overrides', async t => {
  const { model, calls, handled, props } = mount(t, { scenario: undefined, props: { designScenario: '' } });
  for (const id of ['read', 'write', 'hook']) { model.on(id).click(); await settle(); }
  assert.deepEqual(calls, ['read', 'write']); assert.equal(handled.length, 1);
  props.designState = 'disabled'; await settle(); model.on('write').click(); await settle(); assert.equal(calls.length, 2);
});
test('scenario changes release pending UI state and late completion cannot clear a newer request', async t => {
  const completions = [], { model, active, handled } = mount(t, { scenario: '', handle: () => new Promise(resolve => completions.push(resolve)) });
  model.on('hook').click(); await settle(); assert.equal(model.pending.value, true);
  active.value = 'filled'; await settle(); assert.equal(model.pending.value, false); assert.equal(model.props('draft').modelValue, 'authored draft');
  active.value = ''; await settle(); model.on('hook').click(); await settle(); assert.equal(handled.length, 2);
  completions[0](); await settle(); assert.equal(model.pending.value, true);
  completions[1](); await settle(); assert.equal(model.pending.value, false); assert.equal(model.message.value, '');
});

test('inherited scenario mode blocks nested definitions without injecting a foreign scenario', async t => {
  const { model, calls, handled } = mount(t, { spec: { ...spec, id: 'vp-modal' }, readOnly: () => true });
  assert.equal(model.text('title'), 'Synthetic baseline');
  for (const id of ['read', 'write', 'hook']) { model.on(id).click(); await settle(); }
  assert.deepEqual(calls, []); assert.deepEqual(handled, []);
  assert.equal(model.message.value, 'The interaction could not be completed. Your input is retained.');
});
