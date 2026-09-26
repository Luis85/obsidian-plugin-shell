import type { ComponentDefinition, ExternalNode } from '../visual/visual-ir.mjs';
import { visualRead, visualSession, visualVisible } from '../visual/visual-session.mjs';
import { visualExpressions, visualTextValue, type VisualSpec } from '../runtime/visual-runtime.ts';
import { literal, symbol, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
import { sample, sampleCode } from './schema-code.ts';
import { visualDefinitionPath } from './visual-model.ts';
import { visualFixtureProps, visualRendered } from './visual-tests.ts';

/** Generic runtime behavior of the copied use-visual composable, independent of any authored definition. */
function vrRuntime(m: Model, add: Add): void {
  const path = `${m.testRoot}/visual-runtime.test.ts`;
  add(path, `// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest';
import { defineComponent, nextTick, reactive, type App } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useVisual, provideVisualContext, type VisualContext, type VisualPort } from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/composables/use-visual.ts`))};
import type { VisualPageSpec, VisualRequest } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/visual-runtime.ts`))};
import type { UiNode, VisualAction, Scenario } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/visual/visual-ir.mjs`))};
const button = (id: string, actions: VisualAction[]): UiNode => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId: 'u-button' }, props: {}, slots: {}, events: [{ id, event: 'click', label: 'Run ' + id, notes: '', acceptance: '', actions }] });
const control = (id: string, kind: string, entryId = 'u-input', maxBytes?: number): UiNode => ({ id, kind: 'component', ref: { kind: 'nuxt-ui', entryId }, props: {}, slots: {}, events: [], control: { kind, ...(maxBytes ? { maxBytes } : {}) } });
const shown = (id: string, nodeId: string): UiNode => ({ id, kind: 'text', role: 'p', value: { kind: 'state', nodeId } });
const page = (root: UiNode[], scenarios: Scenario[] = []): VisualPageSpec => ({ kind: 'page', id: 'vp-runtime', ownerId: 'surface', name: 'Runtime', root, scenarios, notes: '' });
const port = (run: VisualPort['run'], operationId = 'save'): VisualPort => ({ sourceId: 'source', operationId, direction: 'write', requiresInput: true, data: null, pending: false, error: null, run });
function subject(context: VisualContext, spec: VisualPageSpec, props: Record<string, unknown> = {}) {
  return mount(defineComponent({ setup: () => ({ model: useVisual(spec, props, () => {}) }), render: () => null }), { global: { plugins: [{ install(app: App) { provideVisualContext(app, context); } }] } });
}
function update(model: ReturnType<typeof useVisual>, id: string, value: unknown): void {
  const handler = model.props(id)['onUpdate:modelValue']; if (typeof handler !== 'function') throw new Error('NOT_A_CONTROL'); handler(value);
}
const wrong = async (): Promise<unknown> => { throw new Error('WRONG_HANDLER'); };
it('value effects replace invalid raw drafts while preserving typed mapped actions', async () => {
  const run = vi.fn(async (_input?: unknown) => ({ ok: true }));
  const wrapper = subject({ ports: [port(run)], navigate: () => {}, handle: wrong }, page([control('amount', 'number'), button('fix', [{ kind: 'set-value', nodeId: 'amount', value: 0 }]), button('save', [{ kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'draft', nodeId: 'amount' } }])]));
  try { const model = wrapper.vm.model; update(model, 'amount', 'invalid'); expect(model.errors.amount).toMatch(/valid number/);
    model.on('fix').click!(); await flushPromises(); expect(model.props('amount').modelValue).toBe(0); expect(model.errors.amount).toBeUndefined();
    model.on('save').click!(); await flushPromises(); expect(run).toHaveBeenCalledExactlyOnceWith(0);
  } finally { wrapper.unmount(); }
});
it('saved fixture scenarios never execute a real source action', async () => {
  const run = vi.fn(async (_input?: unknown) => ({ ok: true }));
  const design = page([control('input', 'text'), button('save', [{ kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'draft', nodeId: 'input' } }])], [{ id: 'review', name: 'Review', state: 'default', width: 'wide', values: { input: 'fixture' }, bindings: [] }]);
  const wrapper = subject({ ports: [port(run)], navigate: () => {}, handle: wrong }, design, { designScenario: 'review' });
  try { const model = wrapper.vm.model; model.on('save').click!(); await flushPromises();
    expect(run).not.toHaveBeenCalled(); expect(model.props('input').modelValue).toBe('fixture'); expect(model.message.value).toContain('retained');
  } finally { wrapper.unmount(); }
});
it('typed drafts map false and zero to a source call and retain raw invalid input', async () => {
  const run = vi.fn(async (_input?: unknown) => ({ ok: false }));
  const save = button('save', [{ kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'object', fields: { amount: { kind: 'draft', nodeId: 'amount' }, enabled: { kind: 'draft', nodeId: 'enabled' } } } }]);
  const wrapper = subject({ ports: [port(run)], navigate: () => {}, handle: wrong }, page([control('amount', 'number'), control('enabled', 'checkbox', 'u-checkbox'), save]));
  try { const model = wrapper.vm.model; update(model, 'amount', '0'); update(model, 'enabled', false);
    model.on('save').click!(); await flushPromises(); expect(run).toHaveBeenCalledExactlyOnceWith({ amount: 0, enabled: false }); expect(model.message.value).toContain('retained');
    update(model, 'amount', 'invalid'); expect(model.props('amount').modelValue).toBe('invalid'); expect(model.errors.amount).toMatch(/valid number/);
    model.on('save').click!(); await flushPromises(); expect(run).toHaveBeenCalledTimes(1); expect(model.message.value).toContain('Correct the input errors');
  } finally { wrapper.unmount(); }
});
it('JSON controls are byte-bounded, keep the last valid value and ignore input after disposal', async () => {
  const wrapper = subject({ ports: [], navigate: () => {}, handle: async () => undefined }, page([control('json', 'json-file', 'u-textarea', 20), shown('shown', 'json')]));
  const model = wrapper.vm.model;
  update(model, 'json', JSON.stringify({ new: true })); expect(model.text('shown')).toBe(JSON.stringify({ new: true }, null, 2));
  update(model, 'json', JSON.stringify({ tooLarge: 'x'.repeat(40) })); expect(model.errors.json).toBeDefined(); expect(model.text('shown')).toBe(JSON.stringify({ new: true }, null, 2));
  update(model, 'json', '{bad}'); expect(model.text('shown')).toBe(JSON.stringify({ new: true }, null, 2));
  update(model, 'json', ''); expect(model.errors.json).toBeUndefined(); expect(model.text('shown')).toBe('');
  wrapper.unmount(); update(model, 'json', JSON.stringify({ late: true })); expect(model.text('shown')).toBe('');
});
it('retains drafts and reports unimplemented behavior without pretending success', async () => {
  const wrapper = subject({ ports: [], navigate: () => {}, handle: async () => { throw new Error('NOT_IMPLEMENTED: change'); } }, page([control('input', 'text'), button('change', [])]));
  try { const model = wrapper.vm.model; update(model, 'input', 'Preserve me'); model.on('change').click!(); await flushPromises();
    expect(model.props('input').modelValue).toBe('Preserve me'); expect(model.state.value).toBe('error'); expect(model.message.value).toBe('Interaction implementation required.');
  } finally { wrapper.unmount(); }
});
it('ignores duplicate dispatch while pending and late results after unmount', async () => {
  let finish: () => void = () => {}; const handle = vi.fn((_request: VisualRequest) => new Promise<void>(resolve => { finish = resolve; }));
  const wrapper = subject({ ports: [], navigate: () => {}, handle }, page([button('change', [])])); const model = wrapper.vm.model;
  model.on('change').click!(); model.on('change').click!(); expect(handle).toHaveBeenCalledOnce();
  expect(model.state.value).toBe('loading'); wrapper.unmount(); finish(); await flushPromises();
  model.on('change').click!(); expect(handle).toHaveBeenCalledOnce(); expect(model.message.value).toBe('');
});
it('maps source pending, error and empty states without starting a source operation', async () => {
  const run = vi.fn(async (_input?: unknown) => undefined);
  const source = reactive({ ...port(run, 'read'), direction: 'read', requiresInput: false, data: undefined as unknown, pending: false, error: null as string | null });
  const wrapper = subject({ ports: [source], navigate: () => {}, handle: async () => undefined }, page([{ id: 'bound', kind: 'text', role: 'p', value: { kind: 'source', sourceId: 'source', operationId: 'read', field: '' } }]));
  try { const model = wrapper.vm.model; expect(model.state.value).toBe('default');
    source.pending = true; await nextTick(); expect(model.state.value).toBe('loading');
    source.pending = false; source.error = 'failed'; await nextTick(); expect(model.state.value).toBe('error');
    source.error = null; source.data = []; await nextTick(); expect(model.state.value).toBe('empty');
    source.data = [{ title: 'Loaded' }]; await nextTick(); expect(model.state.value).toBe('default');
    expect(run).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); }
});
`);
}

/** Source-bound nodes render validated store output through the real Pinia store and generated context. */
function vrBindings(m: Model, spec: VisualSpec, add: Add): void {
  const roots = spec.kind === 'page' ? spec.root : spec.template, session = { ...visualSession(), state: 'default' as const };
  const cases = visualRendered(roots).filter(r => r.marked).flatMap(({ node }) => visualExpressions(node).filter(e => e.kind === 'source').slice(0, 1).map(expr => {
    const source = m.sources.find(s => s.id === expr.sourceId)!, op = source.operations.find(o => o.id === expr.operationId)!;
    const visible = visualVisible(spec, session, node.id), selector = literal(`[data-design-node="${node.id}"]`);
    const check = node.kind === 'text' && visible ? `expect(wrapper.get(${selector}).text()).toBe(${literal(visualTextValue(visualRead(sample(op.output), expr.field), '').trim())});` : `expect(wrapper.find(${selector}).exists()).toBe(${visible});`;
    return `it(${literal('[' + node.id + '] displays validated source output through the actual Pinia store')}, async () => {
  const pinia = createPinia(); const context = createVisualContext(fixtureSources(), pinia, () => {});
  const wrapper = mount(Subject, { props: ${literal(visualFixtureProps(spec))}, global: { plugins: [pinia], provide: { [visualKey as symbol]: context } } });
  try { const port = context.ports.find(p => p.sourceId === ${literal(source.id)} && p.operationId === ${literal(op.id)})!;
    await port.run(${sampleCode(op.input)}); await flushPromises();
    ${check}
    expect(port.pending).toBe(false); expect(port.error).toBe(null);
  } finally { wrapper.unmount(); disposePinia(pinia); }
});`;
  }));
  if (!cases.length) return;
  const path = `${m.testRoot}/visual/${spec.id}-bindings.test.ts`;
  add(path, `// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { fixtureSources } from '../fixtures/visual-sources.ts';
import Subject from ${literal(relativeImport(path, visualDefinitionPath(m, spec)))};
import { createVisualContext } from ${literal(relativeImport(path, `${m.sourceRoot}/bootstrap/visual-context.ts`))};
import { visualKey } from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/composables/use-visual.ts`))};
${cases.join('\n')}
`);
}

/** Each adapter keeps a business TODO and proves the runtime lifecycle with a fake adapter substituted for the stub. */
function vrAdapter(m: Model, component: ComponentDefinition, node: ExternalNode, adapterPath: string, add: Add): void {
  const path = `${m.testRoot}/acceptance/${component.libraryId}-${node.adapter}.adapter.test.ts`, spec = { ...component, kind: 'component' as const };
  const rendered = visualRendered(component.template).some(r => r.node === node);
  const state = rendered ? (['default', 'empty', 'error'] as const).find(s => visualVisible(spec, { ...visualSession(), state: s }, node.id)) : undefined;
  const todo = `it.todo(${literal(`[${component.libraryId}/${node.adapter}] implement the ${node.package} adapter (mount, update, destroy) and its acceptance`)});`;
  const bound = Object.values(node.props).flatMap(e => (e.kind === 'prop' ? component.props.filter(p => p.name === e.name) : []))[0];
  const routed = node.events[0];
  const steps = ['mount', ...(bound ? ['update'] : []), 'destroy'];
  add(path, `// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import type { VisualRequest } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/visual-runtime.ts`))};
import Subject from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/components/library/${component.libraryId}.vue`))};
const fake = vi.hoisted(() => ({ log: [] as string[], emit: (_event: string, _payload: unknown): void => {} }));
vi.mock(${literal(relativeImport(path, adapterPath))}, () => ({ createAdapter: () => ({
  mount: (_el: HTMLElement, _props: Record<string, unknown>, emit: (event: string, payload: unknown) => void) => { fake.log.push('mount'); fake.emit = emit; },
  update: () => { fake.log.push('update'); }, destroy: () => { fake.log.push('destroy'); },
}) }));
${todo}
${state ? `it(${literal(`[${component.libraryId}/${node.adapter}] mounts after render, updates on prop changes, routes events and is destroyed on unmount`)}, async () => {
  const wrapper = mount(Subject, { attachTo: document.body, props: { ...${literal(visualFixtureProps(component))}, designState: ${literal(state)} } });
  await flushPromises(); expect(fake.log).toEqual(['mount']);
${bound ? `  await wrapper.setProps({ ${literal(bound.name)}: ${literal(bound.type === 'boolean' ? true : bound.type === 'number' ? 1 : 'changed')} }); await flushPromises();\n` : ''}${routed ? `  fake.emit(${literal(routed.event)}, 'fixture'); await flushPromises();
  expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId)).toContain(${literal(routed.id)});\n` : ''}  wrapper.unmount(); expect(fake.log).toEqual(${literal(steps)});
});` : ''}
`);
}

/** Runtime suite, fixture services, per-definition binding tests and adapter lifecycle tests. */
export function visualRuntimeTests(m: Model, specs: VisualSpec[], adapters: { component: ComponentDefinition; node: ExternalNode; path: string }[], add: Add): void {
  vrRuntime(m, add);
  const fixture = `${m.testRoot}/fixtures/visual-sources.ts`;
  add(fixture, m.sources.map(source => `import { create${symbol(source.slug)}Service } from ${literal(relativeImport(fixture, `${m.sourceRoot}/application/${source.slug}/service.ts`))};`).join('\n') + `\nexport function fixtureSources() { return {${m.sources.map(s => `${literal(s.slug)}: create${symbol(s.slug)}Service({${s.operations.map(op => `${literal(op.slug)}: async () => structuredClone(${sampleCode(op.output)})`).join(',')}})`).join(',')}}; }\n`);
  for (const spec of specs) vrBindings(m, spec, add);
  for (const adapter of adapters) vrAdapter(m, adapter.component, adapter.node, adapter.path, add);
}
