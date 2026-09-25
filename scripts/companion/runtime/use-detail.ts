import { computed, inject, onScopeDispose, reactive, shallowReactive, ref, useId, type App, type InjectionKey } from 'vue';
import { detailValue, detailTextValue, visibleDetails, type DetailDocument, type DetailRequest, type DetailState } from './detail-runtime.ts';
import { parseDetailControl, copyDetailData, type DetailData } from './detail-controls.ts';
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
export function useDetail(document: DetailDocument, props: { designState?: DetailState }, emit: (request: DetailRequest) => void,
  emitDeclared?: (event: string, payload: unknown) => void) {
  const context = inject(detailKey, undefined); const prefix = useId();
  const values = shallowReactive<Record<string, DetailData>>({}); const raw = reactive<Record<string, string>>({});
  const errors = reactive<Record<string, string>>({}); const pending = ref(false); const message = ref('');
  const selections = new Map<string, number>(); let disposed = false;
  onScopeDispose(() => { disposed = true; selections.clear(); });
  const findPort = (source: string, operation: string) => context?.ports.find(p => p.sourceId === source && p.operationId === operation);
  const ports = () => context?.ports.filter(port => document.nodes.some(n => n.binding?.sourceId === port.sourceId && n.binding.operationId === port.operationId)) ?? [];
  const state = computed<DetailState>(() => {
    if (props.designState) return props.designState;
    if (pending.value || ports().some(p => p.pending)) return 'loading';
    if (message.value || ports().some(p => p.error)) return 'error';
    if (ports().some(p => Array.isArray(p.data) && p.data.length === 0)) return 'empty';
    return 'default';
  });
  const visible = computed(() => new Set(visibleDetails(document, state.value).map(n => n.id)));
  function bound(index: number): unknown {
    const node = document.nodes[index]!;
    if (Object.hasOwn(values, node.id)) return values[node.id];
    const port = node.binding && findPort(node.binding.sourceId, node.binding.operationId);
    return port ? detailValue(port.data, node.binding!.field) : undefined;
  }
  function display(index: number): string {
    const node = document.nodes[index]!;
    if (Object.hasOwn(raw, node.id)) return raw[node.id]!;
    return detailTextValue(bound(index), node.kind === 'input' ? '' : node.text);
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
  function snapshot(): Record<string, DetailData> {
    const result: Record<string, DetailData> = Object.fromEntries(Object.entries(values).map(([key,value])=>[key,copyDetailData(value)]));
    for (const [index, node] of document.nodes.entries()) {
      if (node.kind !== 'input' || !visible.value.has(node.id)) continue;
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
    try { captured = snapshot(); } catch { message.value = 'Correct the input errors before continuing.'; return; }
    const request: DetailRequest = { documentId: document.id, ownerId: document.ownerId, edgeId: edge.id, nodeId, event, values: captured, payload };
    pending.value = true; message.value = '';
    try {
      emit(request);
      if (edge.action) {
        const action = edge.action;
        const input = mapDetailPayload(action.kind === 'source' ? action.input : action.payload, {
          values: captured, props, payload, read: (source, operation) => findPort(source, operation)?.data,
        });
        if (action.kind === 'emit') {
          if (!emitDeclared) throw new Error('DETAIL_EMITTER_MISSING'); emitDeclared(action.event, input);
        } else {
          const port = findPort(action.sourceId, action.operationId); if (!port) throw new Error('DETAIL_PORT_MISSING');
          const outcome = await port.run(input);
          if (!outcome || typeof outcome !== 'object' || !('ok' in outcome) || outcome.ok !== true) throw new Error('DETAIL_SOURCE_FAILED');
        }
      } else {
        if (!context) throw new Error('DETAIL_CONTEXT_MISSING');
        if (edge.targetSurfaceId) context.navigate(edge.targetSurfaceId); else await context.handle(request);
      }
    } catch (error) {
      if (!disposed) message.value = error instanceof Error && error.message.startsWith('NOT_IMPLEMENTED:') ? 'Interaction implementation required.' : 'The interaction could not be completed. Your input is retained.';
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
  return { prefix, values, state, visible, pending, message, errors, display, checked, update, listeners, inputListeners };
}
