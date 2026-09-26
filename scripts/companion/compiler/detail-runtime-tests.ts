import { literal, symbol, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
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
it('composition value effects replace invalid raw drafts while preserving typed mapped actions',async()=>{
 const design:DetailDocument={...doc,nodes:[{...doc.nodes[0]!,id:'amount',control:{kind:'number'}},{...doc.nodes[0]!,id:'fix',kind:'button'},{...doc.nodes[0]!,id:'save',kind:'button'}],edges:[
 {...doc.edges[0]!,id:'fix',source:'fix',target:'amount',event:'click',effect:{type:'value',value:0}},
 {...doc.edges[0]!,id:'save',source:'save',target:'amount',event:'click',action:{kind:'source',sourceId:'source',operationId:'save',input:{kind:'draft',nodeId:'amount'}}}]};
 const run=vi.fn(async(_input?:unknown)=>({ok:true}));const wrapper=subject({ports:[{sourceId:'source',operationId:'save',direction:'write',requiresInput:true,data:null,pending:false,error:null,run}],navigate:()=>{},handle:async()=>{throw Error('WRONG_HANDLER');}},design);
 try{const model=wrapper.vm.model;const input=document.createElement('input');input.value='invalid';const event=new Event('input');input.dispatchEvent(event);await model.update(0,event);
 model.listeners('fix').click!(undefined);await flushPromises();expect(model.display(0)).toBe('0');expect(model.errors.amount).toBeUndefined();
 model.listeners('save').click!(undefined);await flushPromises();expect(run).toHaveBeenCalledExactlyOnceWith(0);
 }finally{wrapper.unmount();}
});
it('saved fixture scenarios never execute a real source action',async()=>{
 const design:DetailDocument={...doc,scenarios:[{id:'review',name:'Review',state:'default',width:'wide',values:{input:'fixture'},bindings:[]}],edges:[{...doc.edges[0]!,action:{kind:'source',sourceId:'source',operationId:'save',input:{kind:'draft',nodeId:'input'}}}]};
 const run=vi.fn(async()=>({ok:true}));const context:DetailContext={ports:[{sourceId:'source',operationId:'save',direction:'write',requiresInput:true,data:null,pending:false,error:null,run}],navigate:()=>{},handle:async()=>{}};
 const wrapper=mount(defineComponent({setup:()=>({model:useDetail(design,{designScenario:'review'},()=>{})}),render:()=>null}),{global:{plugins:[{install(app:App){provideDetailContext(app,context);}}]}});
 try{wrapper.vm.model.listeners('input').change!(undefined);await flushPromises();expect(run).not.toHaveBeenCalled();expect(wrapper.vm.model.values.input).toBe('fixture');expect(wrapper.vm.model.message.value).toContain('retained');}finally{wrapper.unmount();}
});
it('typed drafts map false and zero to a source call and retain raw invalid input', async () => {
  const design: DetailDocument = { ...doc, nodes: [
    {...doc.nodes[0]!,id:'amount',control:{kind:'number'}},
    {...doc.nodes[0]!,id:'enabled',control:{kind:'checkbox'}},
    {...doc.nodes[0]!,id:'save',kind:'button'},
  ],edges:[{...doc.edges[0]!,id:'save-event',source:'save',target:'amount',event:'click',action:{kind:'source',sourceId:'source',operationId:'save',input:{kind:'object',fields:{amount:{kind:'draft',nodeId:'amount'},enabled:{kind:'draft',nodeId:'enabled'}}}}}]};
  const run=vi.fn(async (_input?:unknown)=>({ok:false}));
  const wrapper=subject({ports:[{sourceId:'source',operationId:'save',direction:'write',requiresInput:true,data:null,pending:false,error:null,run}],navigate:()=>{},handle:async()=>{throw Error('WRONG_HANDLER');}},design);
  const model=wrapper.vm.model;
  try {
    const number=document.createElement('input'); number.value='0'; const e=new Event('input');number.dispatchEvent(e);await model.update(0,e);
    const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=false;const c=new Event('input');checkbox.dispatchEvent(c);await model.update(1,c);
    model.listeners('save').click!(undefined);await flushPromises();expect(run).toHaveBeenCalledExactlyOnceWith({amount:0,enabled:false});
    expect(model.values.amount).toBe(0);expect(model.values.enabled).toBe(false);expect(model.message.value).toContain('retained');
    number.value='invalid';number.dispatchEvent(e);expect(await model.update(0,e)).toBe(false);expect(model.display(0)).toBe('invalid');expect(model.values.amount).toBe(0);
    model.listeners('save').click!(undefined);await flushPromises();expect(run).toHaveBeenCalledTimes(1);
  } finally {wrapper.unmount();}
});
it('JSON file selection is bounded, latest-selection-wins and ignored after disposal', async () => {
  const design:DetailDocument={...doc,nodes:[{...doc.nodes[0]!,control:{kind:'json-file',maxBytes:1000}}],edges:[]};
  const wrapper=subject({ports:[],navigate:()=>{},handle:async()=>undefined},design);const model=wrapper.vm.model;
  const input=document.createElement('input');input.type='file';const event=new Event('change');
  let first:(s:string)=>void=()=>{};const oldFile={size:20,text:()=>new Promise<string>(resolve=>{first=resolve;})};
  Object.defineProperty(input,'files',{configurable:true,value:[oldFile]});input.dispatchEvent(event);const pending=model.update(0,event);
  Object.defineProperty(input,'files',{configurable:true,value:[{size:12,text:async()=>JSON.stringify({new:true})}]});
  input.dispatchEvent(event);expect(await model.update(0,event)).toBe(true);first(JSON.stringify({old:true}));expect(await pending).toBe(false);expect(model.values.input).toEqual({new:true});
  Object.defineProperty(input,'files',{configurable:true,value:[{size:2000,text:async()=>JSON.stringify({tooLarge:true})}]});input.dispatchEvent(event);
  expect(await model.update(0,event)).toBe(false);expect(model.values.input).toEqual({new:true});
  Object.defineProperty(input,'files',{configurable:true,value:[]});input.dispatchEvent(event);await model.update(0,event);expect(Object.hasOwn(model.values,'input')).toBe(false);
  Object.defineProperty(input,'files',{configurable:true,value:[oldFile]});input.dispatchEvent(event);const late=model.update(0,event);wrapper.unmount();first(JSON.stringify({late:true}));expect(await late).toBe(false);expect(Object.hasOwn(model.values,'input')).toBe(false);
});
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
  for (const doc of documents) for (const node of doc.nodes.filter(n => n.binding && ['text','heading','alert','input','number','textarea','checkbox','select','table','list'].includes(n.kind))) {
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
    const value=detailValue(${sampleCode(op.output)},${literal(node.binding!.field)}); const element=wrapper.get(${literal('[data-design-node="'+node.id+'"]')});
    ${node.kind==='table'?`expect(element.findAll('tbody tr')).toHaveLength(Array.isArray(value)&&value.length?Math.min(value.length,50):1);
    for(const [i,item] of (Array.isArray(value)?value.slice(0,50):[]).entries()) for(const [j,key] of ${literal(node.options||[])}.entries())expect(element.findAll('tbody tr')[i]!.findAll('td')[j]!.text()).toBe(detailTextValue(detailValue(item,key),''));`:node.kind==='list'?`expect(element.findAll('li')).toHaveLength(Array.isArray(value)&&value.length?Math.min(value.length,50):${node.options?.length||0});`:['input','number','textarea','checkbox','select'].includes(node.kind)?`expect(element.find('input,select,textarea').exists()).toBe(true);`: `expect(element.text()).toBe(detailTextValue(value,${literal(node.text)}));`}
    expect(port.pending).toBe(false); expect(port.error).toBe(null);
  } finally { wrapper.unmount(); disposePinia(pinia); }
});
`);
  }
}
