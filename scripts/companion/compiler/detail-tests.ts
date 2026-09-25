import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
import { componentMembers, detailDefinitions } from './detail-model.ts';
import { sampleCode } from './schema-code.ts';
import { mapDetailPayload } from '../runtime/detail-actions.ts';
import { parseDetailControl } from '../runtime/detail-controls.ts';
import { visibleDetails, type DetailDocument } from '../runtime/detail-runtime.ts';
export function detailTests(m: Model, doc: DetailDocument, component: string, add: Add): void {
  const path = `${m.testRoot}/details/${doc.id}.test.ts`; const root = m.sourceRoot;
  const properties = doc.kind === 'component' ? Object.fromEntries(Object.entries(componentMembers(detailDefinitions(m).find(c=>c.id===doc.ownerId)!).props).map(([key,type])=>[key,type === 'boolean' ? false : type === 'number' ? 0 : 'fixture'])) : {};
  const inputText = (node: typeof doc.nodes[number]) => ({number:'0',checkbox:true,date:'2026-01-01','datetime-local':'2026-01-01T12:30','json-file':'{"fixture":true}','json-editor':'{"fixture":true}',select:node.control?.options?.[0]?.value ?? ''} as Record<string,string|boolean>)[node.control?.kind ?? ''] ?? 'fixture';
  const fixturePorts = m.sources.flatMap(source=>source.operations.map(op=>`{sourceId:${literal(source.id)},operationId:${literal(op.id)},data:${sampleCode(op.output)},pending:false,error:null,direction:${literal(op.direction)},requiresInput:${op.input!==null},run}`)).join(',');
  const cases = doc.edges.filter(e => doc.nodes.find(n => n.id === e.source)?.kind !== 'component').map(edge => {
    const source = doc.nodes.find(n => n.id === edge.source)!;
    const state = source.visibleIn.find(s => !['loading', 'disabled'].includes(s) && visibleDetails(doc, s).some(n => n.id === source.id));
    if (!state) return '';
    const selector = `[data-design-node="${source.id}"]${['input','number','textarea','checkbox','select'].includes(source.kind) ? ' :is(input,textarea,select)' : source.kind==='tabs'?' button':''}`;
    const nodes = edge.effect?[]:visibleDetails(doc,state).filter(n=>['input','number','textarea','checkbox','select'].includes(n.kind));
    const values = Object.fromEntries(nodes.map(n=>[n.id,parseDetailControl(inputText(n),n.control)]));
    const initialize = nodes.map(n=>{
      const selector = literal('[data-design-node="'+n.id+'"] :is(input,textarea,select)');
      return n.control?.kind === 'json-file' ? `Object.defineProperty(wrapper.get(${selector}).element,'files',{configurable:true,value:[{size:16,text:async()=>${literal(inputText(n))}}]}); await wrapper.get(${selector}).trigger('change'); await flushPromises();` : `await wrapper.get(${selector}).setValue(${literal(inputText(n))}); await flushPromises();`;
    }).join('\n');
    let assertion = edge.targetSurfaceId ? `expect(navigate).toHaveBeenCalledWith(${literal(edge.targetSurfaceId)}); expect(handle).not.toHaveBeenCalled();` : `expect(handle).toHaveBeenCalledOnce(); expect(handle.mock.calls[0]![0]).toMatchObject({ edgeId: ${literal(edge.id)}, documentId: ${literal(doc.id)} }); expect(navigate).not.toHaveBeenCalled();`;
    if(edge.effect){
      const effect=edge.effect;
      const target='[data-design-node="'+edge.target+'"]';
      if(effect.type==='state')assertion=`expect(wrapper.attributes('data-design-state')).toBe(${literal(effect.value)});`;
      if(effect.type==='toggle')assertion=`expect(wrapper.find(${literal(target)}).exists()).toBe(false);`;
      if(effect.type==='value')assertion=`expect(wrapper.html()).toContain(${literal(String(effect.value))});`;
      if(effect.type==='emit')assertion=`expect(wrapper.emitted(${literal(String(effect.value))})).toHaveLength(1);`;
      if(effect.type==='focus')assertion=`expect(wrapper.get(${literal(target)}).element.contains(document.activeElement) || wrapper.get(${literal(target)}).element===document.activeElement).toBe(true);`;
      assertion+=' expect(handle).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();';
    }
    if (edge.action) {
      const value = mapDetailPayload(edge.action.kind==='source'?edge.action.input:edge.action.payload,{values,props:properties,payload:source.kind==='input'?values[source.id]:undefined,read:(s,o)=>JSON.parse(sampleCode(m.sources.find(x=>x.id===s)!.operations.find(x=>x.id===o)!.output))});
      assertion = edge.action.kind==='source' ? `expect(run).toHaveBeenCalledWith(${value===undefined?'undefined':literal(value)}); expect(handle).not.toHaveBeenCalled();` : `expect(wrapper.emitted(${literal(edge.action.event)})?.at(-1)).toEqual([${value===undefined?'undefined':literal(value)}]); expect(handle).not.toHaveBeenCalled();`;
    }
    return `it(${literal('[' + edge.id + '] dispatches the designed ' + edge.event + ' interaction')}, async () => {
  const navigate = vi.fn(); const handle = vi.fn(async () => undefined); const run = vi.fn(async (_input?:unknown)=>({ok:true}));
  const wrapper = mount(Subject, { attachTo: document.body, props: { ...${literal(properties)}, designState: ${literal(state)} }, global: { provide: { [detailKey as symbol]: { ports: [${fixturePorts}], navigate, handle } } } });
  try { ${initialize}
    handle.mockClear(); navigate.mockClear(); run.mockClear();
    await wrapper.get(${literal(selector)}).trigger(${literal(source.kind==='tabs'?'click':edge.event)}); await flushPromises();
    ${assertion}
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
      if (['loading', 'disabled'].includes(state)) for (const button of wrapper.findAll('button, input, textarea, select')) expect(button.attributes('disabled')).toBeDefined();
    } finally { wrapper.unmount(); }
  });
}
${cases.replaceAll('vi.fn(async () => undefined)', 'vi.fn(async (_request: DetailRequest) => undefined)')}
`);
}
