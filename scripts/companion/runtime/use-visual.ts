import { computed, inject, nextTick, watch, onScopeDispose, reactive, shallowReactive, ref, toRaw, type App, type InjectionKey, type WatchStopHandle } from 'vue';
import { detailTextValue } from './detail-runtime.ts';
import { parseDetailControl, copyDetailData, type DetailData } from './detail-controls.ts';
import { compositionStyle, compositionTheme } from '../composition-contract.mjs';
import { mapDetailPayload } from './detail-actions.ts';
import { visualSession, visualTransition, visualVisible, visualRead, type Session } from '../visual/visual-session.mjs';
import type { UiNode, ValueExpression, VisualState, Interaction, VisualAction } from '../visual/visual-ir.mjs';
import { visualIndex, visualExpressions, visualMapping, visualRawInput, visualControl, VISUAL_RUNTIME_CONTROLS, VISUAL_RUNTIME_INTERACTIVE, VISUAL_RUNTIME_LOCAL,
  type VisualExternalAdapter, type VisualRequest, type VisualSpec } from './visual-runtime.ts';
export interface VisualPort {
  sourceId: string; operationId: string; direction: string; requiresInput: boolean;
  readonly data: unknown; readonly pending: boolean; readonly error: string | null;
  run(input?: unknown): Promise<unknown>;
}
export interface VisualContext {
  ports: VisualPort[];
  navigate(target: string): void;
  handle(request: VisualRequest): Promise<unknown>;
}
export const visualKey: InjectionKey<VisualContext> = Symbol('generated-visuals');
export function provideVisualContext(app: App, context: VisualContext): void { app.provide(visualKey, context); }
interface ExternalMount { create: () => VisualExternalAdapter; bind: (el: unknown) => void; adapter: VisualExternalAdapter | null; el: HTMLElement | null; stop: WatchStopHandle | null; mounted: boolean; dirty: boolean; generation: number }
const isElement = (value: unknown): value is HTMLElement => typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
/** Reads through the proxy first: Object.hasOwn alone is not tracked, so a key added later would never re-render. */
const has = (record: Readonly<Record<string, unknown>>, key: string): boolean => { void record[key]; return Object.hasOwn(record, key); };
const requiredImplementation = (error: unknown) => error instanceof Error && (error.name === 'NotImplementedError' || /^(NOT_IMPLEMENTED|IMPLEMENTATION_REQUIRED)\b/.test(error.message));
/** Each mount owns its drafts and session. Typed conversions and mapping never imply a save. */
export function useVisual(spec: VisualSpec, props: { designState?: VisualState; designScenario?: string } & Record<string, unknown>,
  emitInteraction: (request: VisualRequest) => void, emitDeclared?: (event: string, payload: unknown) => void) {
  const context = inject(visualKey, undefined); const index = visualIndex(spec);
  const values = shallowReactive<Record<string, DetailData>>({}); const drafts = shallowReactive<Record<string, unknown>>({});
  const errors = reactive<Record<string, string>>({}); const pending = ref(false); const message = ref('');
  const session = reactive<Session>(visualSession()), localState = ref<VisualState | null>(null), narrow = ref(false), host = ref<HTMLElement | null>(null), dark = ref(false);
  let observer: ResizeObserver | undefined, themeObserver: MutationObserver | undefined;
  const externals = new Map<string, ExternalMount>(); let disposed = false; let epoch = 0;
  const sources = new Set([...index.values()].flatMap(visualExpressions).flatMap(e => e.kind === 'source' ? [e.sourceId + '\u0000' + e.operationId] : []));
  const findPort = (source: string, operation: string) => context?.ports.find(p => p.sourceId === source && p.operationId === operation);
  const ports = () => context?.ports.filter(port => sources.has(port.sourceId + '\u0000' + port.operationId)) ?? [];
  const control = (node: UiNode | undefined) => node?.kind === 'component' && node.ref.kind === 'nuxt-ui' && VISUAL_RUNTIME_CONTROLS.includes(node.ref.entryId) ? node : null;
  /** The rendered state; transitions inside this mount's own pending span ignore that span. */
  function derive(ownPending: boolean): VisualState {
    if (localState.value) return localState.value;
    if (props.designState) return props.designState;
    if (props.designScenario) return session.state;
    if ((ownPending && pending.value) || ports().some(p => p.pending)) return 'loading';
    if (message.value || ports().some(p => p.error)) return 'error';
    if (ports().some(p => Array.isArray(p.data) && p.data.length === 0)) return 'empty';
    return 'default';
  }
  const state = computed<VisualState>(() => derive(true));
  const width = (): 'narrow' | 'wide' => (narrow.value ? 'narrow' : 'wide');
  const current = (): Session => ({ ...session, values: { ...values }, state: state.value, width: width() });
  /** Unproxied copy for visualTransition, which structured-clones its input. */
  const frozen = (): Session => ({ ...toRaw(session), values: { ...toRaw(values) }, state: derive(false), width: width() });
  onScopeDispose(() => { disposed = true; for (const mount of externals.values()) teardown(mount); observer?.disconnect(); themeObserver?.disconnect(); host.value = null; });
  watch(() => props.designScenario, id => {
    const next = visualSession(spec.scenarios.find(s => s.id === id)); epoch++;
    for (const target of [values, drafts, errors, session.hidden]) for (const key of Object.keys(target)) delete target[key];
    for (const [key, value] of Object.entries(next.values)) values[key] = copyDetailData(value);
    session.bindings = next.bindings; session.state = next.state; session.width = next.width; session.focused = null; session.emitted = [];
    localState.value = null; narrow.value = next.width === 'narrow'; message.value = '';
  }, { immediate: true });
  function sourceData(sourceId: string, operationId: string): unknown {
    const fixture = session.bindings.find(b => b.sourceId === sourceId && b.operationId === operationId);
    return fixture ? fixture.value : findPort(sourceId, operationId)?.data;
  }
  function value(expr: ValueExpression | undefined): unknown {
    if (!expr) return undefined;
    if (expr.kind === 'literal') return expr.value;
    if (expr.kind === 'prop') return has(props, expr.name) ? props[expr.name] : undefined;
    if (expr.kind === 'state') return has(values, expr.nodeId) ? values[expr.nodeId] : undefined;
    return visualRead(sourceData(expr.sourceId, expr.operationId), expr.field);
  }
  function visible(id: string): boolean { return visualVisible(spec, current(), id); }
  function enabled(id: string): boolean { return !disposed && !pending.value && !['loading', 'disabled'].includes(state.value) && visible(id); }
  function model(id: string): unknown {
    const node = control(index.get(id));
    if (has(drafts, id)) return drafts[id];
    if (has(values, id)) return values[id];
    return value(node?.props.modelValue);
  }
  function parse(node: NonNullable<ReturnType<typeof control>>, input: unknown): DetailData {
    return node.control ? parseDetailControl(visualRawInput(input), visualControl(node.control)) : copyDetailData(input ?? null);
  }
  function setDraft(id: string, input: unknown): boolean {
    const node = control(index.get(id)); if (!node || !enabled(id)) return false;
    drafts[id] = input;
    try { values[id] = parse(node, input); delete errors[id]; message.value = ''; return true; } catch {
      errors[id] = 'Enter a valid ' + (node.control?.kind ?? 'text') + ' value. Your previous valid value is retained.'; return false;
    }
  }
  function snapshot(validate: boolean): Record<string, DetailData> {
    const result: Record<string, DetailData> = Object.fromEntries(Object.entries(values).map(([key, entry]) => [key, copyDetailData(entry)]));
    if (!validate) return result;
    for (const [id, node] of index) {
      const field = control(node); if (!field || !visible(id)) continue;
      if (errors[id]) throw new Error('VISUAL_INPUT_INVALID');
      const entry = has(values, id) ? values[id] : value(field.props.modelValue);
      if (field.control || entry !== undefined) result[id] = parse(field, entry);
    }
    return result;
  }
  function focus(id: string): void {
    const target = host.value?.querySelector<HTMLElement>('[data-design-node="' + id + '"]');
    (target?.matches('button,input,textarea,select,[tabindex]') ? target : target?.querySelector<HTMLElement>('button,input,textarea,select,[tabindex]'))?.focus();
  }
  function applyLocal(next: Session, actions: VisualAction[]): void {
    for (const [key, entry] of Object.entries(next.values)) values[key] = copyDetailData(entry);
    for (const action of actions) if (action.kind === 'set-value') { delete drafts[action.nodeId]; delete errors[action.nodeId]; }
    Object.assign(session.hidden, next.hidden); session.focused = next.focused;
    if (spec.kind === 'page') session.emitted = next.emitted.slice(-50);
    if (actions.some(a => a.kind === 'set-state')) localState.value = next.state;
  }
  async function perform(nodeId: string, action: VisualAction, captured: Record<string, DetailData>, payload: unknown): Promise<void> {
    if (action.kind === 'navigate') { if (!context) throw new Error('VISUAL_CONTEXT_MISSING'); context.navigate(action.surfaceId); return; }
    if (action.kind !== 'emit' && action.kind !== 'source') return;
    const input = mapDetailPayload(visualMapping(action.kind === 'source' ? action.input : action.payload), { values: captured, props, payload, read: sourceData });
    if (action.kind === 'emit') {
      if (spec.kind === 'page') return; // pages record emits in the session only
      if (!emitDeclared) throw new Error('VISUAL_EMITTER_MISSING'); emitDeclared(action.event, input); return;
    }
    if (props.designScenario) throw new Error('VISUAL_SCENARIO_READ_ONLY');
    const port = findPort(action.sourceId, action.operationId); if (!port) throw new Error('VISUAL_PORT_MISSING: ' + nodeId);
    const outcome = await port.run(input);
    if (!outcome || typeof outcome !== 'object' || !('ok' in outcome) || outcome.ok !== true) throw new Error('VISUAL_SOURCE_FAILED');
  }
  const isLocal = (interaction: Interaction) => interaction.actions.length > 0 && interaction.actions.every(a => VISUAL_RUNTIME_LOCAL.includes(a.kind));
  /** Runs every interaction declared for one event in order, inside one pending span and epoch; the first failure stops the rest. */
  async function invoke(nodeId: string, interactions: Interaction[], payload: unknown): Promise<void> {
    if (!interactions.length || !enabled(nodeId)) return;
    let validated: Record<string, DetailData> = {};
    try { if (!interactions.every(isLocal)) validated = snapshot(true); } catch { message.value = 'Correct the input errors before continuing.'; return; }
    const requestEpoch = epoch, stale = () => disposed || requestEpoch !== epoch;
    pending.value = true; message.value = '';
    try {
      for (const interaction of interactions) {
        const actions = interaction.actions, captured = { ...validated, ...snapshot(false) };
        const request: VisualRequest = { definitionId: spec.id, nodeId, interactionId: interaction.id, event: interaction.event, values: captured, payload };
        emitInteraction(request);
        if (stale()) return;
        if (!actions.length) { if (!context) throw new Error('VISUAL_CONTEXT_MISSING'); await context.handle(request); if (stale()) return; continue; }
        const next = visualTransition(spec, frozen(), nodeId, interaction.id);
        applyLocal(next, actions);
        for (const action of actions) { await perform(nodeId, action, captured, payload); if (stale()) return; }
        if (actions.some(a => a.kind === 'focus') && next.focused) { await nextTick(); if (stale()) return; focus(next.focused); }
      }
    } catch (error) {
      if (!stale()) message.value = requiredImplementation(error) ? 'Interaction implementation required.' : 'The interaction could not be completed. Your input is retained.';
    } finally { if (!disposed) pending.value = false; }
  }
  function trigger(nodeId: string, event: string, payload: unknown): void {
    const node = index.get(nodeId);
    void invoke(nodeId, node && 'events' in node ? node.events.filter(i => i.event === event) : [], payload);
  }
  /** Author accessibility notes, bound as aria-description; never interpolated into template syntax. */
  function a11y(id: string): string | undefined { const note = index.get(id)?.a11y; return note ? note : undefined; }
  function text(id: string): string { const node = index.get(id); return node?.kind === 'text' ? detailTextValue(value(node.value), '') : ''; }
  function resolved(id: string): Record<string, unknown> {
    const node = index.get(id);
    return node?.kind === 'component' || node?.kind === 'external' ? Object.fromEntries(Object.entries(node.props).map(([name, expr]) => [name, value(expr)])) : {};
  }
  function nodeProps(id: string): Record<string, unknown> {
    const node = index.get(id), result = resolved(id);
    if (node?.kind !== 'component' || node.ref.kind !== 'nuxt-ui') return result;
    if (control(node)) Object.assign(result, { modelValue: model(id), 'onUpdate:modelValue': (input: unknown) => { if (setDraft(id, input)) trigger(id, 'update:modelValue', values[id]); } });
    if (node.ref.entryId === 'u-table' && !Object.hasOwn(node.props, 'loading')) result.loading = state.value === 'loading';
    if (VISUAL_RUNTIME_INTERACTIVE.includes(node.ref.entryId) && !Object.hasOwn(node.props, 'disabled')) result.disabled = ['loading', 'disabled'].includes(state.value);
    return result;
  }
  function attrs(id: string): Record<string, unknown> {
    const node = index.get(id), result: Record<string, unknown> = {};
    if (node?.kind === 'element') for (const [name, expr] of Object.entries(node.attrs)) result[name] = value(expr);
    result['data-design-node'] = id; return result;
  }
  function on(id: string): Record<string, (payload?: unknown) => void> {
    const node = index.get(id); if (!node || (node.kind !== 'element' && node.kind !== 'component')) return {};
    const events = node.events.filter(i => !(control(node) && i.event === 'update:modelValue')).map(i => i.event);
    return Object.fromEntries([...new Set(events)].map(event => [event, (payload?: unknown) => { trigger(id, event, payload); }]));
  }
  function style(id: string): Record<string, string | number> {
    const node = index.get(id);
    return node?.layout ? compositionStyle({ kind: 'region', layout: node.layout.mode, ui: node.layout.ui }, spec.designSystem, narrow.value) : {};
  }
  const theme = computed(() => compositionTheme(spec.designSystem, dark.value));
  function teardown(mount: ExternalMount): void {
    const adapter = mount.adapter; mount.stop?.(); mount.stop = null; mount.adapter = null; mount.el = null; mount.mounted = false; mount.dirty = false; mount.generation++;
    if (!adapter) return;
    try { adapter.destroy(); } catch (error) { if (!disposed) message.value = failedExternal(error); }
  }
  function failedExternal(error: unknown): string { return requiredImplementation(error) ? 'External component implementation required.' : 'The external component could not be displayed.'; }
  function update(mount: ExternalMount, adapter: VisualExternalAdapter, next: Record<string, unknown>): void {
    try { adapter.update(next); } catch (error) { if (!disposed && mount.adapter === adapter) message.value = failedExternal(error); }
  }
  /** Mounts after render; an element removed or replaced before the tick is never mounted. */
  async function mountExternal(id: string, mount: ExternalMount, el: HTMLElement, generation: number): Promise<void> {
    await nextTick();
    if (disposed || mount.generation !== generation) return;
    let adapter: VisualExternalAdapter;
    try { adapter = mount.create(); } catch (error) { message.value = failedExternal(error); return; }
    mount.adapter = adapter;
    mount.stop = watch(() => resolved(id), next => { if (mount.adapter !== adapter) return; if (mount.mounted) update(mount, adapter, next); else mount.dirty = true; }, { deep: true });
    try {
      await adapter.mount(el, resolved(id), (event, payload) => { if (!disposed && mount.adapter === adapter) trigger(id, event, payload); });
    } catch (error) { if (!disposed && mount.adapter === adapter) message.value = failedExternal(error); return; }
    if (disposed || mount.adapter !== adapter) return;
    mount.mounted = true;
    if (mount.dirty) { mount.dirty = false; update(mount, adapter, resolved(id)); }
  }
  /** Function-ref callback for an external node's mount element; stable per node so re-renders do not remount. */
  function external(id: string, createAdapter: () => VisualExternalAdapter): (el: unknown) => void {
    const existing = externals.get(id); if (existing) return existing.bind;
    const mount: ExternalMount = { create: createAdapter, adapter: null, el: null, stop: null, mounted: false, dirty: false, generation: 0, bind: el => {
      if (disposed || el === mount.el) return;
      if (mount.el) teardown(mount);
      if (isElement(el) && index.get(id)?.kind === 'external') { mount.el = el; void mountExternal(id, mount, el, ++mount.generation); }
    } };
    externals.set(id, mount); return mount.bind;
  }
  function attach(value: unknown): void {
    if (!isElement(value) || host.value === value) return;
    host.value = value; observer?.disconnect();
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(entries => { const size = entries[0]?.contentRect.width; if (size && !props.designScenario) narrow.value = size <= 640; }); observer.observe(value); }
    const body = value.ownerDocument.body, root = value.ownerDocument.documentElement;
    const readTheme = () => { dark.value = body.classList.contains('theme-dark') || root.dataset.theme === 'dark'; }; readTheme();
    if (typeof MutationObserver !== 'undefined') { themeObserver?.disconnect(); themeObserver = new MutationObserver(readTheme); themeObserver.observe(body, { attributes: true, attributeFilter: ['class'] }); themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] }); }
  }
  return { state, visible, style, text, a11y, props: nodeProps, attrs, on, message, errors, pending, attach, theme, external };
}
