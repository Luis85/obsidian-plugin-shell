import { computed, inject, nextTick, onScopeDispose, reactive, ref, useId, watch, type App, type InjectionKey } from 'vue';
import { detailValue, detailTextValue, type DetailDocument, type DetailRequest, type DetailState } from './detail-runtime.ts';
import { compositionSession, compositionStyle, compositionTheme, compositionTransition, compositionVisible } from '../composition-contract.mjs';
export interface DetailPort {
  sourceId: string; operationId: string; direction: string; requiresInput: boolean;
  readonly data: unknown; readonly pending: boolean; readonly error: string | null;
  run(input?: unknown): Promise<unknown>;
}
export interface DetailContext { ports: DetailPort[]; navigate(target: string): void; handle(request: DetailRequest): Promise<unknown> }
export const detailKey: InjectionKey<DetailContext> = Symbol('generated-details');
export function provideDetailContext(app: App, context: DetailContext): void { app.provide(detailKey, context); }
/** Each mount owns its scenario, values and effects; source bindings never imply writes. */
export function useDetail(document: DetailDocument, props: { designState?: DetailState; designScenario?: string } & Record<string, unknown>, emit: (request: DetailRequest) => void, publish: (name:string,payload:unknown) => void = () => {}) {
  const context = inject(detailKey, undefined), prefix = useId();
  const session = reactive(compositionSession()), values = session.values, pending = ref(false), message = ref('');
  const localState = ref<DetailState | null>(null), narrow = ref(false), host = ref<HTMLElement | null>(null), dark = ref(false);
  let disposed = false, observer: ResizeObserver | undefined, themeObserver: MutationObserver | undefined;
  const ports = () => context?.ports.filter(port => document.nodes.some(n => n.binding?.sourceId === port.sourceId && n.binding.operationId === port.operationId)) ?? [];
  const state = computed<DetailState>(() => {
    if (localState.value) return localState.value;
    if (props.designState) return props.designState;
    if (props.designScenario) return session.state;
    if (pending.value || ports().some(p => p.pending)) return 'loading';
    if (message.value || ports().some(p => p.error)) return 'error';
    return ports().some(p => Array.isArray(p.data) && p.data.length === 0) ? 'empty' : 'default';
  });
  const current = () => ({ ...session, state:state.value, width:(narrow.value ? 'narrow' : 'wide') as 'narrow'|'wide' });
  const visible = computed(() => new Set(document.nodes.filter(n => compositionVisible(document,current(),n)).map(n => n.id)));
  watch(() => props.designScenario, id => {
    const next = compositionSession(document.scenarios?.find(s => s.id === id));
    for (const key of Object.keys(values)) delete values[key]; Object.assign(values,next.values);
    for (const key of Object.keys(session.hidden)) delete session.hidden[key];
    session.bindings=next.bindings; session.state=next.state; session.width=next.width;
    localState.value=null; narrow.value=next.width==='narrow'; message.value='';
  },{immediate:true});
  function read(index:number):unknown {
    const node=document.nodes[index]!;
    if (Object.hasOwn(values,node.id)) return values[node.id];
    if (node.contentProp && Object.hasOwn(props,node.contentProp)) return props[node.contentProp];
    const fixture=node.binding && session.bindings.find(b=>b.sourceId===node.binding!.sourceId && b.operationId===node.binding!.operationId);
    const port=node.binding && context?.ports.find(p=>p.sourceId===node.binding!.sourceId && p.operationId===node.binding!.operationId);
    const result=node.binding ? detailValue(fixture ? fixture.value : port ? port.data : undefined,node.binding.field) : undefined;
    return result === undefined ? (['input','textarea','number'].includes(node.kind)?'':node.text) : result;
  }
  function display(index:number):string { return detailTextValue(read(index),''); }
  function rows(index:number):unknown[] { const v=read(index); return Array.isArray(v)?v.slice(0,50):[]; }
  function cell(row:unknown,key:string):string { return detailTextValue(detailValue(row,key),''); }
  function style(index:number) { return compositionStyle(document.nodes[index],document.designSystem,narrow.value); }
  const theme = computed(() => compositionTheme(document.designSystem,dark.value));
  function update(index:number,event:Event):void {
    const node=document.nodes[index]!;
    if (disposed || pending.value || ['loading','disabled'].includes(state.value) || !visible.value.has(node.id)) return;
    const input=event.target;
    if (input && 'value' in input && typeof input.value==='string') values[node.id]=node.kind==='checkbox' && 'checked' in input ? input.checked : node.kind==='number' && input.value!=='' ? Number(input.value) : input.value;
  }
  async function invoke(nodeId:string,event:string,payload:unknown):Promise<void> {
    if (disposed || pending.value || ['loading','disabled'].includes(state.value) || !visible.value.has(nodeId)) return;
    const edge=document.edges.find(e=>e.source===nodeId && e.event===event); if (!edge) return;
    const request:DetailRequest={documentId:document.id,ownerId:document.ownerId,edgeId:edge.id,nodeId,event,values:{...values},payload};
    message.value='';
    try {
      emit(request);
      if (edge.effect) {
        const next=compositionTransition(document,JSON.parse(JSON.stringify(current())),edge.id);
        Object.assign(values,next.values); Object.assign(session.hidden,next.hidden);
        if (edge.effect.type==='state') localState.value=next.state;
        if (edge.effect.type==='emit') publish(String(edge.effect.value),edge.effect.payload);
        if (next.focused) { await nextTick(); if (!disposed) { const target=host.value?.querySelector<HTMLElement>('[data-design-node="'+next.focused+'"]'); (target?.matches('button,input,textarea,select')?target:target?.querySelector<HTMLElement>('button,input,textarea,select'))?.focus(); } }
      } else {
        if (!context) throw new Error('DETAIL_CONTEXT_MISSING');
        if (edge.targetSurfaceId) context.navigate(edge.targetSurfaceId);
        else { pending.value=true; await context.handle(request); }
      }
    } catch(error) {
      if (!disposed) message.value=error instanceof Error && error.message.startsWith('NOT_IMPLEMENTED:')?'Interaction implementation required.':'The interaction could not be completed. Your input is retained.';
    } finally { if (!disposed) pending.value=false; }
  }
  function listeners(nodeId:string):Record<string,(payload:unknown)=>void> { return Object.fromEntries(document.edges.filter(e=>e.source===nodeId).map(e=>[e.event,payload=>{void invoke(nodeId,e.event,payload);} ])); }
  function tab(index:number,value:string):void { if (!['loading','disabled'].includes(state.value)) { values[document.nodes[index]!.id]=value; void invoke(document.nodes[index]!.id,'change',value); } }
  function attach(value:unknown):void {
    if (!(value instanceof HTMLElement) || host.value===value) return;
    host.value=value; observer?.disconnect();
    if (typeof ResizeObserver!=='undefined') { observer=new ResizeObserver(entries=>{const w=entries[0]?.contentRect.width;if(w && !props.designScenario)narrow.value=w<=640;}); observer.observe(value); }
    const body=value.ownerDocument.body, root=value.ownerDocument.documentElement;
    const readTheme=()=>{dark.value=body.classList.contains('theme-dark') || root.dataset.theme==='dark';};readTheme();
    if (typeof MutationObserver!=='undefined') {themeObserver?.disconnect();themeObserver=new MutationObserver(readTheme);themeObserver.observe(body,{attributes:true,attributeFilter:['class']});themeObserver.observe(root,{attributes:true,attributeFilter:['data-theme']});}
  }
  onScopeDispose(()=>{disposed=true;observer?.disconnect();themeObserver?.disconnect();host.value=null;});
  return {prefix,values,state,visible,pending,message,display,read,rows,cell,style,theme,update,listeners,tab,attach};
}
