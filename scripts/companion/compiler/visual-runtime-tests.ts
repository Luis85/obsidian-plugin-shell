import type { ComponentDefinition, ExternalNode, UiNode, ValueExpression } from '../visual/visual-ir.mjs';
import { visualCatalogEntry } from '../visual/visual-catalog.mjs';
import { visualRead, visualSession, visualVisible } from '../visual/visual-session.mjs';
import { visualTextValue, type VisualSpec } from '../runtime/visual-runtime.ts';
import { literal, symbol, type Model } from './model.ts';
import { componentFile, relativeImport, type Add } from './file-code.ts';
import { sample, sampleCode } from './schema-code.ts';
import { visualDefinitionPath, visualComponentPath } from './visual-model.ts';
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
it('runs mixed actions in authored order and stops at the first failing action', async () => {
  for (const ok of [true, false]) {
    const seen: unknown[] = [], navigated: string[] = [], note: UiNode = { id: 'note', kind: 'text', role: 'p', value: { kind: 'literal', value: 'Note' } };
    const run = vi.fn(async (input?: unknown) => { seen.push([input, wrapper.vm.model.visible('note')]); return { ok }; });
    const go = button('go', [{ kind: 'set-value', nodeId: 'input', value: 'typed' }, { kind: 'source', sourceId: 'source', operationId: 'save', input: { kind: 'draft', nodeId: 'input' } }, { kind: 'toggle', nodeId: 'note' }, { kind: 'navigate', surfaceId: 'next' }]);
    const wrapper = subject({ ports: [port(run)], navigate: target => { navigated.push(target); }, handle: wrong }, page([control('input', 'text'), note, go]));
    try { const model = wrapper.vm.model; model.on('go').click!(); await flushPromises();
      expect(seen).toEqual([['typed', true]]); expect(model.visible('note')).toBe(!ok); expect(navigated).toEqual(ok ? ['next'] : []);
    } finally { wrapper.unmount(); }
  }
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

/** Legacy parity: at most 50 table rows are asserted row by row; the bound data itself is compared in full. */
const vrRows = 50;
/** Text a table cell shows for a primitive value (TanStack's default cell renders value.toString()); plain objects are not asserted. */
const vrCell = (value: unknown): string | null => (value === undefined || value === null ? '' : typeof value === 'object' && !Array.isArray(value) ? null : String(value));
const vrPort = (slug: string) => 'port' + slug.replace(/[^A-Za-z0-9]/g, '');
/** The rendered component name Vue records for a project instance (script-setup __name comes from the file name). */
function vrComponentName(specs: VisualSpec[], node: UiNode): string {
  if (node.kind !== 'component') return '';
  if (node.ref.kind === 'nuxt-ui') return visualCatalogEntry(node.ref.entryId)?.component.slice(1) ?? '';
  const ref = node.ref, target = specs.find(s => s.id === ref.componentId);
  return target?.kind === 'component' ? componentFile(target.libraryId, 'component') : '';
}
/** Assertions for one source expression: text content, element attribute, or the prop the rendered component instance received. */
function vrExpect(specs: VisualSpec[], node: UiNode, name: string | null, expected: unknown): string[] {
  const selector = literal(`[data-design-node="${node.id}"]`);
  if (node.kind === 'text') return [`expect(wrapper.get(${selector}).text()).toBe(${literal(visualTextValue(expected, '').trim())});`];
  if (node.kind === 'element') return typeof expected === 'string' || typeof expected === 'number' ? [`expect(wrapper.get(${selector}).attributes(${literal(name)})).toBe(${literal(String(expected))});`] : [`expect(wrapper.find(${selector}).exists()).toBe(true);`];
  // External props reach the adapter, not the DOM; the adapter lifecycle test covers their delivery.
  if (node.kind !== 'component') return [`expect(wrapper.find(${selector}).exists()).toBe(true);`];
  const lines = [`expect(bound(wrapper.findAllComponents({ name: ${literal(vrComponentName(specs, node))} }), ${literal(node.id)}, ${literal(name)})).toEqual(${expected === undefined ? 'undefined' : literal(expected)});`];
  if (node.ref.kind !== 'nuxt-ui' || node.ref.entryId !== 'u-table' || name !== 'data') return lines;
  const rows = Array.isArray(expected) ? expected.slice(0, vrRows) : [], declared = node.props.columns;
  const columns = declared?.kind === 'literal' && Array.isArray(declared.value)
    ? declared.value.flatMap(c => (c && typeof c === 'object' && typeof (c as { accessorKey?: unknown }).accessorKey === 'string' ? [(c as { accessorKey: string }).accessorKey] : []))
    : Object.keys(rows[0] && typeof rows[0] === 'object' ? rows[0] : {});
  lines.push(`expect(wrapper.get(${selector}).findAll('tbody tr')).toHaveLength(${rows.length || 1});`);
  rows.forEach((row, i) => columns.forEach((key, j) => {
    const text = vrCell(row && typeof row === 'object' ? (row as Record<string, unknown>)[key] : undefined);
    if (text !== null) lines.push(`expect(wrapper.get(${selector}).findAll('tbody tr')[${i}]!.findAll('td')[${j}]!.text()).toBe(${literal(text)});`);
  }));
  return lines;
}
/** Source-bound nodes render validated store output through the real Pinia store and generated context; every source expression is asserted. */
function vrBindings(m: Model, specs: VisualSpec[], spec: VisualSpec, add: Add): void {
  const roots = spec.kind === 'page' ? spec.root : spec.template, session = { ...visualSession(), state: 'default' as const };
  const cases = visualRendered(roots).filter(r => r.marked).flatMap(({ node }) => {
    const named: [string | null, ValueExpression][] = node.kind === 'text' ? [[null, node.value]] : Object.entries(node.kind === 'element' ? node.attrs : node.kind === 'component' || node.kind === 'external' ? node.props : {});
    const bindings = named.flatMap(([name, expr]) => (expr.kind === 'source' ? [{ name, expr }] : []));
    if (!bindings.length) return [];
    const operations = [...new Map(bindings.map(({ expr }) => [expr.sourceId + '\u0000' + expr.operationId, expr])).values()].map(expr => {
      const source = m.sources.find(s => s.id === expr.sourceId)!; return { source, op: source.operations.find(o => o.id === expr.operationId)! };
    });
    const output = (sourceId: string, operationId: string) => sample(operations.find(o => o.source.id === sourceId && o.op.id === operationId)!.op.output);
    const checks = visualVisible(spec, session, node.id) ? bindings.flatMap(({ name, expr }) => vrExpect(specs, node, name, visualRead(output(expr.sourceId, expr.operationId), expr.field))) : [`expect(wrapper.find(${literal(`[data-design-node="${node.id}"]`)}).exists()).toBe(false);`];
    const runs = operations.map(({ source, op }) => `const ${vrPort(op.slug)} = context.ports.find(p => p.sourceId === ${literal(source.id)} && p.operationId === ${literal(op.id)})!;
    await ${vrPort(op.slug)}.run(${sampleCode(op.input)}); await flushPromises();
    expect(${vrPort(op.slug)}.pending).toBe(false); expect(${vrPort(op.slug)}.error).toBe(null);`);
    return [`it(${literal('[' + node.id + '] displays validated source output through the actual Pinia store')}, async () => {
  const pinia = createPinia(); const context = createVisualContext(fixtureSources(), pinia, () => {});
  const wrapper = mount(Subject, { props: ${literal(visualFixtureProps(spec))}, global: { plugins: [pinia], provide: { [visualKey as symbol]: context } } });
  try {
    ${runs.join('\n    ')}
    ${checks.join('\n    ')}
  } finally { wrapper.unmount(); disposePinia(pinia); }
});`];
  });
  if (!cases.length) return;
  const path = `${m.testRoot}/visual/${spec.id}-bindings.test.ts`, usesBound = cases.some(c => c.includes('bound('));
  add(path, `// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
${usesBound ? "import type { ComponentPublicInstance } from 'vue';\n" : ''}import { fixtureSources } from '../fixtures/visual-sources.ts';
import Subject from ${literal(relativeImport(path, visualDefinitionPath(m, spec)))};
import { createVisualContext } from ${literal(relativeImport(path, `${m.sourceRoot}/bootstrap/visual-context.ts`))};
import { visualKey } from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/composables/use-visual.ts`))};
${usesBound ? `/** The value one rendered component instance (found by its node marker) received for a bound prop, declared or fallthrough. */
function bound(found: { vm: ComponentPublicInstance }[], id: string, name: string): unknown {
  const instance = found.find(c => c.vm.$attrs['data-design-node'] === id); if (!instance) throw new Error('Missing component instance ' + id);
  const props: Record<string, unknown> = instance.vm.$props;
  return Object.hasOwn(props, name) ? props[name] : instance.vm.$attrs[name];
}
` : ''}${cases.join('\n')}
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
import Subject from ${literal(relativeImport(path, visualComponentPath(m, component)))};
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
  for (const spec of specs) vrBindings(m, specs, spec, add);
  for (const adapter of adapters) vrAdapter(m, adapter.component, adapter.node, adapter.path, add);
}
