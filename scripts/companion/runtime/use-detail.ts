import { computed, inject, onScopeDispose, reactive, ref, useId, type App, type InjectionKey } from 'vue';
import { detailValue, detailTextValue, visibleDetails, type DetailDocument, type DetailRequest, type DetailState } from './detail-runtime.ts';
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
/** State and draft values belong to this mount. Bindings never imply persistence. */
export function useDetail(document: DetailDocument, props: { designState?: DetailState }, emit: (request: DetailRequest) => void) {
  const context = inject(detailKey, undefined); const prefix = useId();
  const values = reactive<Record<string, string>>({}); const pending = ref(false); const message = ref('');
  let disposed = false; onScopeDispose(() => { disposed = true; });
  const ports = () => context?.ports.filter(port => document.nodes.some(n => n.binding?.sourceId === port.sourceId && n.binding.operationId === port.operationId)) ?? [];
  const state = computed<DetailState>(() => {
    if (props.designState) return props.designState;
    if (pending.value || ports().some(p => p.pending)) return 'loading';
    if (message.value || ports().some(p => p.error)) return 'error';
    if (ports().some(p => Array.isArray(p.data) && p.data.length === 0)) return 'empty';
    return 'default';
  });
  const visible = computed(() => new Set(visibleDetails(document, state.value).map(n => n.id)));
  function display(index: number): string {
    const node = document.nodes[index]!;
    if (Object.hasOwn(values, node.id)) return values[node.id]!;
    const port = node.binding && context?.ports.find(p => p.sourceId === node.binding!.sourceId && p.operationId === node.binding!.operationId);
    return detailTextValue(port ? detailValue(port.data, node.binding!.field) : undefined, node.kind === 'input' ? '' : node.text);
  }
  function update(index: number, event: Event): void {
    const node = document.nodes[index]!;
    if (disposed || pending.value || ['loading', 'disabled'].includes(state.value) || !visible.value.has(node.id)) return;
    const input = event.target;
    if (input && 'value' in input && typeof input.value === 'string') values[node.id] = input.value;
  }
  async function invoke(nodeId: string, event: string, payload: unknown): Promise<void> {
    if (disposed || pending.value || ['loading', 'disabled'].includes(state.value) || !visible.value.has(nodeId)) return;
    const edge = document.edges.find(e => e.source === nodeId && e.event === event); if (!edge) return;
    const request: DetailRequest = { documentId: document.id, ownerId: document.ownerId, edgeId: edge.id, nodeId, event, values: { ...values }, payload };
    pending.value = true; message.value = '';
    try {
      emit(request);
      if (!context) throw new Error('DETAIL_CONTEXT_MISSING');
      if (edge.targetSurfaceId) context.navigate(edge.targetSurfaceId);
      else await context.handle(request);
    } catch (error) {
      if (!disposed) message.value = error instanceof Error && error.message.startsWith('NOT_IMPLEMENTED:') ? 'Interaction implementation required.' : 'The interaction could not be completed. Your input is retained.';
    } finally { if (!disposed) pending.value = false; }
  }
  function listeners(nodeId: string): Record<string, (payload: unknown) => void> {
    return Object.fromEntries(document.edges.filter(e => e.source === nodeId).map(edge => [edge.event, payload => { void invoke(nodeId, edge.event, payload); }]));
  }
  return { prefix, values, state, visible, pending, message, display, update, listeners };
}
