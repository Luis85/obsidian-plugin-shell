import { literal, symbol, type Model } from './model.ts';
import { relativeImport, type Add } from './data-code.ts';
import { sampleCode } from './schema-code.ts';
import type { DetailDocument } from '../runtime/detail-runtime.ts';
export function detailRuntimeTests(m: Model, documents: DetailDocument[], add: Add): void {
  const path = `${m.testRoot}/detail-runtime.test.ts`;
  add(path, `// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest';
import { defineComponent, nextTick, reactive, type App } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { useDetail, provideDetailContext, type DetailContext } from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/composables/use-detail.ts`))};
import type { DetailDocument, DetailRequest } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/detail-runtime.ts`))};
const doc: DetailDocument = { id: 'test-document', kind: 'page', ownerId: 'test-page', ownerLabel: 'Test', notes: '',
 nodes: [{ id: 'input', kind: 'input', label: 'Draft', text: '', parentId: null, layout: 'stack', component: null, props: {}, binding: null, a11y: '', visibleIn: ['default', 'loading', 'error', 'disabled'] }],
 edges: [{ id: 'change', source: 'input', target: 'output', event: 'change', label: 'Save', notes: '', acceptance: '', targetSurfaceId: null }] };
function subject(context: DetailContext, design = doc) {
  return mount(defineComponent({ setup: () => ({ model: useDetail(design, {}, () => {}) }), render: () => null }), { global: { plugins: [{ install(app: App) { provideDetailContext(app, context); } }] } });
}
it('retains drafts and reports unimplemented behavior without pretending success', async () => {
  const wrapper = subject({ ports: [], navigate: () => {}, handle: async () => { throw new Error('NOT_IMPLEMENTED: change'); } });
  try { const model = wrapper.vm.model; const input = document.createElement('input'); input.value = 'Preserve me';
    const event = new Event('input'); input.dispatchEvent(event); model.update(0, event);
    model.listeners('input').change!(undefined); await flushPromises();
    expect(model.values.input).toBe('Preserve me'); expect(model.state.value).toBe('error'); expect(model.message.value).toBe('Interaction implementation required.');
  } finally { wrapper.unmount(); }
});
it('ignores duplicate dispatch while pending and late results after unmount', async () => {
  let finish: () => void = () => {}; const handle = vi.fn((_request: DetailRequest) => new Promise<void>(resolve => { finish = resolve; }));
  const wrapper = subject({ ports: [], navigate: () => {}, handle }); const model = wrapper.vm.model;
  model.listeners('input').change!(undefined); model.listeners('input').change!(undefined); expect(handle).toHaveBeenCalledOnce();
  expect(model.state.value).toBe('loading'); wrapper.unmount(); finish(); await flushPromises();
  model.listeners('input').change!(undefined); expect(handle).toHaveBeenCalledOnce(); expect(model.message.value).toBe('');
});
it('maps source pending, error and empty states without starting a source operation', async () => {
  const run = vi.fn(async () => undefined);
  const port = reactive({ sourceId: 'source', operationId: 'read', direction: 'read', requiresInput: false, data: undefined as unknown, pending: false, error: null as string | null, run });
  const design = structuredClone(doc); design.nodes[0]!.binding = { sourceId: 'source', operationId: 'read', field: '' };
  const wrapper = subject({ ports: [port], navigate: () => {}, handle: async () => undefined }, design);
  try { const model = wrapper.vm.model; expect(model.state.value).toBe('default');
    port.pending = true; await nextTick(); expect(model.state.value).toBe('loading');
    port.pending = false; port.error = 'failed'; await nextTick(); expect(model.state.value).toBe('error');
    port.error = null; port.data = []; await nextTick(); expect(model.state.value).toBe('empty');
    port.data = [{ title: 'Loaded' }]; await nextTick(); expect(model.state.value).toBe('default');
    expect(run).not.toHaveBeenCalled();
  } finally { wrapper.unmount(); }
});
`);
  const fixture = `${m.testRoot}/fixtures/detail-sources.ts`;
  add(fixture, m.sources.map(source => `import { create${symbol(source.slug)}Service } from ${literal(relativeImport(fixture, `${m.sourceRoot}/application/${source.slug}/service.ts`))};`).join('\n') + `\nexport function fixtureSources() { return {${m.sources.map(s => `${literal(s.slug)}: create${symbol(s.slug)}Service({${s.operations.map(op => `${literal(op.slug)}: async () => structuredClone(${sampleCode(op.output)})`).join(',')}})`).join(',')}}; }\n`);
  for (const doc of documents) for (const node of doc.nodes.filter(n => n.binding && n.kind === 'text')) {
    const source = m.sources.find(s => s.id === node.binding!.sourceId)!;
    const op = source.operations.find(o => o.id === node.binding!.operationId)!;
    const test = `${m.testRoot}/details/${node.id}-binding.test.ts`;
    const component = `${m.sourceRoot}/presentation/components/${doc.kind === 'component' ? 'library/' + doc.ownerId : 'details/' + doc.id}.vue`;
    add(test, `// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, disposePinia } from 'pinia';
import { fixtureSources } from '../fixtures/detail-sources.ts';
import Subject from ${literal(relativeImport(test, component))};
import { createDetailContext } from ${literal(relativeImport(test, `${m.sourceRoot}/bootstrap/detail-context.ts`))};
import { detailKey } from ${literal(relativeImport(test, `${m.sourceRoot}/presentation/composables/use-detail.ts`))};
import { detailValue, detailTextValue } from ${literal(relativeImport(test, `${m.sourceRoot}/domain/detail-runtime.ts`))};
it(${literal('[' + node.id + '] displays validated source output through the actual Pinia store')}, async () => {
  const pinia = createPinia(); const sources = fixtureSources(); const context = createDetailContext(sources, pinia, () => {});
  const wrapper = mount(Subject, { global: { plugins: [pinia], provide: { [detailKey as symbol]: context } } });
  try { const port = context.ports.find(p => p.operationId === ${literal(op.id)} && p.sourceId === ${literal(source.id)})!;
    await port.run(${sampleCode(op.input)}); await flushPromises();
    expect(wrapper.get(${literal('[data-design-node="' + node.id + '"]')}).text()).toBe(detailTextValue(detailValue(${sampleCode(op.output)}, ${literal(node.binding!.field)}), ${literal(node.text)}));
    expect(port.pending).toBe(false); expect(port.error).toBe(null);
  } finally { wrapper.unmount(); disposePinia(pinia); }
});
`);
  }
}
