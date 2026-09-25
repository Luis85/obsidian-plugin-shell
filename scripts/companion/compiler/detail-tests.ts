import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './data-code.ts';
import { visibleDetails, type DetailDocument } from '../runtime/detail-runtime.ts';
export function detailTests(m: Model, doc: DetailDocument, component: string, add: Add): void {
  const path = `${m.testRoot}/details/${doc.id}.test.ts`; const root = m.sourceRoot;
  const cases = doc.edges.filter(e => doc.nodes.find(n => n.id === e.source)?.kind !== 'component').map(edge => {
    const source = doc.nodes.find(n => n.id === edge.source)!;
    const state = source.visibleIn.find(s => !['loading', 'disabled'].includes(s) && visibleDetails(doc, s).some(n => n.id === source.id));
    if (!state) return '';
    const selector = `[data-design-node="${source.id}"]${source.kind === 'input' ? ' input' : ''}`;
    return `it(${literal('[' + edge.id + '] dispatches the designed ' + edge.event + ' interaction')}, async () => {
  const navigate = vi.fn(); const handle = vi.fn(async () => undefined);
  const wrapper = mount(Subject, { props: { designState: ${literal(state)} }, global: { provide: { [detailKey as symbol]: { ports: [], navigate, handle } } } });
  try { await wrapper.get(${literal(selector)}).trigger(${literal(edge.event)}); await flushPromises();
    ${edge.targetSurfaceId ? `expect(navigate).toHaveBeenCalledWith(${literal(edge.targetSurfaceId)}); expect(handle).not.toHaveBeenCalled();` : `expect(handle).toHaveBeenCalledOnce(); expect(handle.mock.calls[0]![0]).toMatchObject({ edgeId: ${literal(edge.id)}, documentId: ${literal(doc.id)} }); expect(navigate).not.toHaveBeenCalled();`}
  } finally { wrapper.unmount(); }
});`;
  }).join('\n');
  add(path, `// @vitest-environment happy-dom
import { it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import Subject from ${literal(relativeImport(path, component))};
import { specification } from ${literal(relativeImport(path, `${root}/domain/details/${doc.id}.ts`))};
import { visibleDetails, type DetailState, type DetailRequest } from ${literal(relativeImport(path, `${root}/domain/detail-runtime.ts`))};
import { detailKey } from ${literal(relativeImport(path, `${root}/presentation/composables/use-detail.ts`))};
for (const state of ['default', 'loading', 'empty', 'error', 'disabled'] as DetailState[]) {
  it('renders declared ' + state + ' visibility including hidden ancestors', () => {
    const wrapper = mount(Subject, { props: { designState: state } });
    try { const visible = new Set(visibleDetails(specification, state).map(n => n.id));
      for (const node of specification.nodes) expect(wrapper.find('[data-design-node="' + node.id + '"]').exists()).toBe(visible.has(node.id));
      if (['loading', 'disabled'].includes(state)) for (const button of wrapper.findAll('button, input')) expect(button.attributes('disabled')).toBeDefined();
    } finally { wrapper.unmount(); }
  });
}
${cases.replaceAll('vi.fn(async () => undefined)', 'vi.fn(async (_request: DetailRequest) => undefined)')}
`);
}
