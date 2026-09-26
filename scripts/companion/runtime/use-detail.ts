import { computed, inject, nextTick, watch, onScopeDispose, reactive, shallowReactive, ref, useId, type App, type InjectionKey } from 'vue';
import { detailValue, detailTextValue, visibleDetails, type DetailDocument, type DetailRequest, type DetailState } from './detail-runtime.ts';
import { parseDetailControl, copyDetailData, type DetailData } from './detail-controls.ts';
import { compositionSession, compositionStyle, compositionTheme, compositionTransition, compositionVisible } from '../composition-contract.mjs';
import { mapDetailPayload } from './detail-actions.ts';
export interface DetailPort {
  sourceId: string; operationId: string; direction: string; requiresInput: boolean;
  readonly data: unknown; readonly pending: boolean; readonly error: string | null;
  run(input?: unknown): Promise<unknown>;
}
export interface DetailContext {
  ports: DetailPort[];
  navigate(target: string): void;
  handle(request: DetailRequest): Promise<unknown>;
}
export const detailKey: InjectionKey<DetailContext> = Symbol('generated-details');
export function provideDetailContext(app: App, context: DetailContext): void { app.provide(detailKey, context); }
/** Each mount owns its drafts. Typed conversions and mapping never imply a save. */
export function useDetail(document: DetailDocument, props: { designState?: DetailState; designScenario?: string } & Record<string,unknown>, emit: (request: DetailRequest) => void,
  emitDeclared?: (event: string, payload: unknown) => void) {
  const context = inject(detailKey, undefined); const prefix = useId();
  const values = shallowReactive<Record<string, DetailData>>({}); const raw = reactive<Record<string, string>>({});
  const errors = reactive<Record<string, string>>({}); const pending = ref(false); const message = ref('');
  const session=reactive(compositionSession()), localState=ref<DetailState|null>(null), narrow=ref(false), host=ref<HTMLElement|null>(null), dark=ref(false);
  let observer:ResizeObserver|undefined,themeObserver:MutationObserver|undefined;
  const selections = new Map<string, number>(); let disposed = false; let epoch=0;
  const isInput=(kind:string)=>['input','number','textarea','checkbox','select'].includes(kind);
  onScopeDispose(() => { disposed = true; selections.clear(); observer?.disconnect();themeObserver?.disconnect();host.value=null; });
  const findPort = (source: string, operation: string) => context?.ports.find(p => p.sourceId === source && p.operationId === operation);
  const ports = () => context?.ports.filter(port => document.nodes.some(n => n.binding?.sourceId === port.sourceId && n.binding.operationId === port.operationId)) ?? [];
  const state = computed<DetailState>(() => {
    if(localState.value)return localState.value;
    if (props.designState) return props.designState;
    if(props.designScenario)return session.state;
    if (pending.value || ports().some(p => p.pending)) return 'loading';
    if (message.value || ports().some(p => p.error)) return 'error';
    if (ports().some(p => Array.isArray(p.data) && p.data.length === 0)) return 'empty';
    return 'default';
  });
  const current=()=>({...session,values:{...values},state:state.value,width:(narrow.value?'narrow':'wide') as 'narrow'|'wide'});
  const visible = computed(() => new Set(visibleDetails(document,state.value).filter(n=>compositionVisible(document,current(),n)).map(n=>n.id)));
  watch(()=>props.designScenario,id=>{
    const next=compositionSession(document.scenarios?.find(s=>s.id===id));epoch++;selections.clear();
    for(const target of [values,raw,errors,session.hidden])for(const key of Object.keys(target))delete target[key];
    for(const [key,value] of Object.entries(next.values))values[key]=copyDetailData(value);
    session.bindings=next.bindings;session.state=next.state;session.width=next.width;
    localState.value=null;narrow.value=next.width==='narrow';message.value='';
  },{immediate:true});
  function bound(index: number): unknown {
    const node = document.nodes[index]!;
    if (Object.hasOwn(values, node.id)) return values[node.id];
    if(node.contentProp && Object.hasOwn(props,node.contentProp))return props[node.contentProp];
    const fixture=node.binding && session.bindings.find(b=>b.sourceId===node.binding!.sourceId&&b.operationId===node.binding!.operationId);
    if(fixture)return detailValue(fixture.value,node.binding!.field);
    const port = node.binding && findPort(node.binding.sourceId, node.binding.operationId);
    return port ? detailValue(port.data, node.binding!.field) : undefined;
  }
  function display(index: number): string {
    const node = document.nodes[index]!;
    if (Object.hasOwn(raw, node.id)) return raw[node.id]!;
    return detailTextValue(bound(index), isInput(node.kind) ? '' : node.text);
  }
  function checked(index: number): boolean { return bound(index) === true; }
  function enabled(id: string): boolean { return !disposed && !pending.value && !['loading', 'disabled'].includes(state.value) && visible.value.has(id); }
  async function update(index: number, event: Event): Promise<boolean> {
    const node = document.nodes[index]!; if (!enabled(node.id)) return false;
    const target = event.target; if (!target || !('value' in target) || typeof target.value !== 'string') return false;
    const version = (selections.get(node.id) ?? 0) + 1; selections.set(node.id, version);
    const current = () => !disposed && selections.get(node.id) === version;
    const control = node.control ?? { kind: 'text' }; let input: string | boolean = target.value;
    if (control.kind === 'checkbox') { if (!('checked' in target) || typeof target.checked !== 'boolean') return false; input = target.checked; }
    if (typeof input === 'string' && control.kind !== 'json-file') raw[node.id] = input;
    try {
      if (control.kind === 'json-file') {
        const files = 'files' in target ? target.files : undefined;
        if (files && typeof files === 'object' && 'length' in files && files.length === 0) { delete values[node.id]; delete errors[node.id]; return false; }
        if (!files || typeof files !== 'object' || !('length' in files) || files.length !== 1 || !('0' in files)) throw new Error('DETAIL_FILE_INVALID');
        const file = files[0];
        if (!file || typeof file !== 'object' || !('size' in file) || typeof file.size !== 'number' || file.size > (control.maxBytes ?? 4_000_000) || !('text' in file) || typeof file.text !== 'function') throw new Error('DETAIL_FILE_INVALID');
        input = await file.text();
        if (!current()) return false;
        if (typeof input !== 'string') throw new Error('DETAIL_FILE_INVALID');
      }
      const parsed = parseDetailControl(input, control);
      if (!current()) return false;
      values[node.id] = parsed; delete errors[node.id]; message.value = ''; return true;
    } catch {
      if (current()) errors[node.id] = 'Enter a valid ' + control.kind + ' value. Your previous valid value is retained.';
      return false;
    }
  }
  function snapshot(validate=true): Record<string, DetailData> {
    const result: Record<string, DetailData> = Object.fromEntries(Object.entries(values).map(([key,value])=>[key,copyDetailData(value)]));
    if(!validate)return result;
    for (const [index, node] of document.nodes.entries()) {
      if (!isInput(node.kind) || !visible.value.has(node.id)) continue;
      if (errors[node.id]) throw new Error('DETAIL_INPUT_INVALID');
      if (node.control?.kind === 'json-file') {
        if (node.control.required && !Object.hasOwn(result, node.id)) throw new Error('DETAIL_INPUT_REQUIRED');
      } else result[node.id] = parseDetailControl(node.control?.kind === 'checkbox' ? checked(index) : display(index), node.control);
    }
    return result;
  }
  async function invoke(nodeId: string, event: string, payload: unknown): Promise<void> {
    if (!enabled(nodeId)) return;
    const edge = document.edges.find(e => e.source === nodeId && e.event === event); if (!edge) return;
    let captured: Record<string, DetailData>;
    try { captured = snapshot(!edge.effect); } catch { message.value = 'Correct the input errors before continuing.'; return; }
    const request: DetailRequest = { documentId: document.id, ownerId: document.ownerId, edgeId: edge.id, nodeId, event, values: captured, payload };
    const effectSession=JSON.parse(JSON.stringify(current()));const requestEpoch=epoch;
    pending.value = true; message.value = '';
    try {
      emit(request);
      if(disposed || requestEpoch!==epoch)return;
      if(edge.effect){
        const next=compositionTransition(document,effectSession,edge.id);
        for(const [key,value] of Object.entries(next.values))values[key]=copyDetailData(value);
        Object.assign(session.hidden,next.hidden);
        if(edge.effect.type==='value'){delete raw[edge.target];delete errors[edge.target];}
        if(edge.effect.type==='state')localState.value=next.state;
        if(edge.effect.type==='emit'){if(!emitDeclared)throw new Error('DETAIL_EMITTER_MISSING');emitDeclared(String(edge.effect.value),edge.effect.payload);}
        if(next.focused){await nextTick();if(!disposed&&requestEpoch===epoch){const target=host.value?.querySelector<HTMLElement>('[data-design-node="'+next.focused+'"]');(target?.matches('button,input,textarea,select')?target:target?.querySelector<HTMLElement>('button,input,textarea,select'))?.focus();}}
      } else if (edge.action) {
        const action = edge.action;
        const input = mapDetailPayload(action.kind === 'source' ? action.input : action.payload, {
          values: captured, props, payload, read: (source, operation) => findPort(source, operation)?.data,
        });
        if (action.kind === 'emit') {
          if (!emitDeclared) throw new Error('DETAIL_EMITTER_MISSING'); emitDeclared(action.event, input);
        } else {
          if(props.designScenario)throw new Error('DETAIL_SCENARIO_READ_ONLY');
          const port = findPort(action.sourceId, action.operationId); if (!port) throw new Error('DETAIL_PORT_MISSING');
          const outcome = await port.run(input);
          if (!outcome || typeof outcome !== 'object' || !('ok' in outcome) || outcome.ok !== true) throw new Error('DETAIL_SOURCE_FAILED');
        }
      } else {
        if (!context) throw new Error('DETAIL_CONTEXT_MISSING');
        if (edge.targetSurfaceId) context.navigate(edge.targetSurfaceId); else await context.handle(request);
      }
    } catch (error) {
      if (!disposed && requestEpoch===epoch) message.value = error instanceof Error && error.message.startsWith('NOT_IMPLEMENTED:') ? 'Interaction implementation required.' : 'The interaction could not be completed. Your input is retained.';
    } finally { if (!disposed) pending.value = false; }
  }
  function listeners(nodeId: string): Record<string, (payload: unknown) => void> {
    return Object.fromEntries(document.edges.filter(e => e.source === nodeId).map(edge => [edge.event, payload => { void invoke(nodeId, edge.event, payload); }]));
  }
  function inputListeners(index: number): Record<string, (payload: Event) => void> {
    const node = document.nodes[index]!; const declared = listeners(node.id);
    return { ...declared, input: event => { void update(index, event).then(ok => { if (ok && !disposed) declared.input?.(values[node.id]); }); },
      change: event => { void update(index, event).then(ok => { if (ok && !disposed) declared.change?.(values[node.id]); }); } };
  }
  function read(index:number):unknown { const value=bound(index);return value===undefined?(isInput(document.nodes[index]!.kind)?'':document.nodes[index]!.text):value; }
  function rows(index:number):unknown[] {const value=read(index);return Array.isArray(value)?value.slice(0,50):[];}
  function cell(row:unknown,key:string):string {return detailTextValue(detailValue(row,key),'');}
  function style(index:number){return compositionStyle(document.nodes[index],document.designSystem,narrow.value);}
  const theme=computed(()=>compositionTheme(document.designSystem,dark.value));
  function tab(index:number,value:string):void {const node=document.nodes[index]!;if(!enabled(node.id)||!node.options?.includes(value))return;values[node.id]=value;void invoke(node.id,'change',value);}
  function attach(value:unknown):void {
    if(!(value instanceof HTMLElement)||host.value===value)return;
    host.value=value;observer?.disconnect();
    if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width&&!props.designScenario)narrow.value=width<=640;});observer.observe(value);}
    const body=value.ownerDocument.body,root=value.ownerDocument.documentElement;
    const readTheme=()=>{dark.value=body.classList.contains('theme-dark')||root.dataset.theme==='dark';};readTheme();
    if(typeof MutationObserver!=='undefined'){themeObserver?.disconnect();themeObserver=new MutationObserver(readTheme);themeObserver.observe(body,{attributes:true,attributeFilter:['class']});themeObserver.observe(root,{attributes:true,attributeFilter:['data-theme']});}
  }
  return { prefix, values, state, visible, pending, message, errors, display, checked, update, listeners, inputListeners,read,rows,cell,style,theme,tab,attach };
}
