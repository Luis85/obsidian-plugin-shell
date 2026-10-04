import { computed, inject, nextTick, watch, onScopeDispose, reactive, shallowReactive, ref, toRaw, type App, type InjectionKey, type WatchStopHandle } from 'vue';
import { parseDetailControl, copyDetailData, type DetailData } from './detail-controls.ts';
import { compositionStyle, compositionTheme } from '../../../scripts/companion/composition-contract.mjs';
import { mapDetailPayload } from './detail-actions.ts';
import { visualSession, visualTransition, visualVisible, visualRead, type Session } from '../../../scripts/companion/visual/visual-session.mjs';
import type { UiNode, ValueExpression, VisualState, Interaction, VisualAction } from '../../../scripts/companion/visual/visual-ir.mjs';
import { visualIndex, visualParents, visualExpressions, visualTextValue, visualMapping, visualRawInput, visualControl, VISUAL_RUNTIME_CONTROLS, VISUAL_RUNTIME_INTERACTIVE, VISUAL_RUNTIME_LOCAL,
  type VisualExternalAdapter, type VisualRequest, type VisualSpec } from './visual-runtime.ts';
export interface VisualPort {
  sourceId: string; operationId: string; direction: string; requiresInput: boolean;
  readonly data: unknown; readonly pending: boolean; readonly error: string | null;
  run(input?: unknown): Promise<unknown>;
}
export interface VisualContext {
  ports: VisualPort[];
  /** Optional per-definition scenario selection supplied by a preview owner, never a source provider. */
  scenario?(definitionId: string): string | undefined;
  /** Inherited by nested definitions and dialogs even when they have no selected scenario. */
  scenarioReadOnly?(): boolean;
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
const NATIVE_INPUT_TYPES: readonly string[] = ['number', 'date', 'datetime-local'];
const succeeded = (outcome: unknown): boolean => outcome !== null && typeof outcome === 'object' && 'ok' in outcome && outcome.ok === true;
type NuxtNode = Extract<UiNode, { kind: 'component' }> & { ref: { kind: 'nuxt-ui'; entryId: string } };
const nuxtNode = (node: UiNode | undefined): node is NuxtNode =>
  node?.kind === 'component' && node.ref.kind === 'nuxt-ui';
const jsonFileInput = (node: Extract<UiNode, { kind: 'component' }>): boolean => node.ref.kind === 'nuxt-ui' && node.ref.entryId === 'u-input' && node.control?.kind === 'json-file';
function chosenFiles(event: unknown): { target: HTMLInputElement; files: FileList } | null {
  const target = event && typeof event === 'object' && 'target' in event ? event.target : null;
  return target instanceof HTMLInputElement && target.files?.length ? { target, files: target.files } : null;
}
/** One UTF-8 file within the byte limit; null when the read went stale before it was decoded. */
async function boundedJsonText(files: FileList, limit: number, stale: () => boolean): Promise<string | null> {
  const file = files[0]!;
  if (files.length !== 1 || file.size > limit) throw new Error('VISUAL_FILE_LIMIT');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (stale()) return null;
  if (bytes.length > limit) throw new Error('VISUAL_FILE_LIMIT');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
/** Each mount owns its drafts and session. Typed conversions and mapping never imply a save. */
export function useVisual(spec: VisualSpec, props: { designState?: VisualState; designScenario?: string } & Record<string, unknown>,
  emitInteraction: (request: VisualRequest) => void, emitDeclared?: (event: string, payload: unknown) => void) {
  const context = inject(visualKey, undefined); const index = visualIndex(spec), parents = visualParents(index);
  const scenarioId = () => props.designScenario ?? context?.scenario?.(spec.id);
  const scenarioReadOnly = () => Boolean(scenarioId() || context?.scenarioReadOnly?.());
  const values = shallowReactive<Record<string, DetailData>>({}); const drafts = shallowReactive<Record<string, unknown>>({});
  const errors = reactive<Record<string, string>>({}); const pending = ref(false); const message = ref('');
  const session = reactive<Session>(visualSession()), localState = ref<VisualState | null>(null), narrow = ref(false), host = ref<HTMLElement | null>(null), dark = ref(false);
  let observer: ResizeObserver | undefined, themeObserver: MutationObserver | undefined;
  const fileReads = new Map<string, number>();
  const externals = new Map<string, ExternalMount>(); let disposed = false; let epoch = 0;
  const sources = new Set([...index.values()].flatMap(visualExpressions).flatMap(e => e.kind === 'source' ? [e.sourceId + '\u0000' + e.operationId] : []));
  const findPort = (source: string, operation: string) => context?.ports.find(p => p.sourceId === source && p.operationId === operation);
  const ports = () => context?.ports.filter(port => sources.has(port.sourceId + '\u0000' + port.operationId)) ?? [];
  const control = (node: UiNode | undefined) => node?.kind === 'component' && node.ref.kind === 'nuxt-ui' && VISUAL_RUNTIME_CONTROLS.includes(node.ref.entryId) ? node : null;
  /** The rendered state; transitions inside this mount's own pending span ignore that span. */
  function derive(ownPending: boolean): VisualState {
    if (localState.value) return localState.value;
    if (props.designState) return props.designState;
    if (scenarioId()) return session.state;
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
  watch(scenarioId, id => {
    const next = visualSession(spec.scenarios.find(s => s.id === id)); epoch++;
    for (const target of [values, drafts, errors, session.hidden]) for (const key of Object.keys(target)) delete target[key];
    for (const [key, value] of Object.entries(next.values)) values[key] = copyDetailData(value);
    session.bindings = next.bindings; session.state = next.state; session.width = next.width; session.focused = null; session.emitted = [];
    localState.value = null; narrow.value = next.width === 'narrow'; message.value = ''; pending.value = false;
  }, { immediate: true });
  function sourceData(sourceId: string, operationId: string): unknown {
    const fixture = session.bindings.find(b => b.sourceId === sourceId && b.operationId === operationId);
    return fixture ? fixture.value : findPort(sourceId, operationId)?.data;
  }
  function value(expr: ValueExpression | undefined, seen = new Set<string>()): unknown {
    if (!expr) return undefined;
    if (expr.kind === 'literal') return expr.value;
    if (expr.kind === 'prop') return has(props, expr.name) ? props[expr.name] : undefined;
    if (expr.kind === 'state') {
      if (has(values, expr.nodeId)) return values[expr.nodeId];
      if (seen.has(expr.nodeId)) return undefined; // An uninitialized cycle has no value; never recurse indefinitely.
      return value(control(index.get(expr.nodeId))?.props.modelValue, new Set([...seen, expr.nodeId]));
    }
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
  /** One local effect at its authored position, as visualTransition defines it; a page also records its emits. */
  function applyLocal(nodeId: string, action: VisualAction): void {
    if (action.kind === 'set-state') localState.value = action.state;
    else if (action.kind === 'toggle') session.hidden[action.nodeId] = !session.hidden[action.nodeId];
    else if (action.kind === 'set-value') { values[action.nodeId] = copyDetailData(action.value); delete drafts[action.nodeId]; delete errors[action.nodeId]; }
    else if (action.kind === 'focus') session.focused = action.nodeId;
    else if (action.kind === 'emit' && spec.kind === 'page') session.emitted = [...session.emitted, { name: action.event, source: nodeId, ...(action.payload.kind === 'value' ? { payload: action.payload.value } : {}) }].slice(-50);
  }
  function emitEvent(event: string, input: DetailData | undefined): void {
    if (spec.kind === 'page') return; // pages record emits in the session only
    if (!emitDeclared) throw new Error('VISUAL_EMITTER_MISSING'); emitDeclared(event, input);
  }
  async function runSource(nodeId: string, sourceId: string, operationId: string, input: DetailData | undefined): Promise<void> {
    if (scenarioReadOnly()) throw new Error('VISUAL_SCENARIO_READ_ONLY');
    const port = findPort(sourceId, operationId); if (!port) throw new Error('VISUAL_PORT_MISSING: ' + nodeId);
    const outcome = await port.run(input);
    if (!succeeded(outcome)) throw new Error('VISUAL_SOURCE_FAILED');
  }
  async function perform(nodeId: string, action: VisualAction, captured: Record<string, DetailData>, payload: unknown): Promise<void> {
    if (action.kind === 'navigate') { if (!context) throw new Error('VISUAL_CONTEXT_MISSING'); context.navigate(action.surfaceId); return; }
    if (action.kind !== 'emit' && action.kind !== 'source') return;
    const input = mapDetailPayload(visualMapping(action.kind === 'source' ? action.input : action.payload), { values: captured, props, payload, read: sourceData });
    if (action.kind === 'emit') emitEvent(action.event, input);
    else await runSource(nodeId, action.sourceId, action.operationId, input);
  }
  const isLocal = (interaction: Interaction) => interaction.actions.length > 0 && interaction.actions.every(a => VISUAL_RUNTIME_LOCAL.includes(a.kind));
  /** Validated values for interactions that leave the runtime; null (with a message) while any visible input is invalid. */
  function validatedValues(interactions: Interaction[]): Record<string, DetailData> | null {
    try { return interactions.every(isLocal) ? {} : snapshot(true); } catch { message.value = 'Correct the input errors before continuing.'; return null; }
  }
  interface Run { nodeId: string; validated: Record<string, DetailData>; payload: unknown; stale: () => boolean }
  async function handOff(run: Run, request: VisualRequest): Promise<boolean> {
    if (scenarioReadOnly()) throw new Error('VISUAL_SCENARIO_READ_ONLY');
    if (!context) throw new Error('VISUAL_CONTEXT_MISSING');
    await context.handle(request); return !run.stale();
  }
  async function runActions(run: Run, interaction: Interaction): Promise<boolean> {
    visualTransition(spec, frozen(), run.nodeId, interaction.id); // refuses a disabled source or hidden focus target before any effect
    for (const action of interaction.actions) {
      if (!VISUAL_RUNTIME_LOCAL.includes(action.kind)) { await perform(run.nodeId, action, { ...run.validated, ...snapshot(false) }, run.payload); if (run.stale()) return false; }
      applyLocal(run.nodeId, action);
      if (action.kind === 'focus') { await nextTick(); if (run.stale()) return false; focus(action.nodeId); }
    }
    return true;
  }
  async function runInteraction(run: Run, interaction: Interaction): Promise<boolean> {
    const captured = { ...run.validated, ...snapshot(false) };
    const request: VisualRequest = { definitionId: spec.id, nodeId: run.nodeId, interactionId: interaction.id, event: interaction.event, values: captured, payload: run.payload };
    emitInteraction(request);
    if (run.stale()) return false;
    return interaction.actions.length ? runActions(run, interaction) : handOff(run, request);
  }
  const failureMessage = (error: unknown) => requiredImplementation(error) ? 'Interaction implementation required.' : 'The interaction could not be completed. Your input is retained.';
  /** Runs every interaction declared for one event, and every action of each, in authored order inside one pending span and
   * epoch; the first failure stops the rest. Source and emit mappings read drafts as the earlier actions left them. */
  async function invoke(nodeId: string, interactions: Interaction[], payload: unknown): Promise<void> {
    if (!interactions.length || !enabled(nodeId)) return;
    const validated = validatedValues(interactions); if (!validated) return;
    const requestEpoch = epoch, run: Run = { nodeId, validated, payload, stale: () => disposed || requestEpoch !== epoch };
    pending.value = true; message.value = '';
    try { for (const interaction of interactions) if (!await runInteraction(run, interaction)) return; }
    catch (error) { if (!run.stale()) message.value = failureMessage(error); }
    finally { if (!run.stale()) pending.value = false; }
  }
  function trigger(nodeId: string, event: string, payload: unknown): void {
    const node = index.get(nodeId);
    void invoke(nodeId, node && 'events' in node ? node.events.filter(i => i.event === event) : [], payload);
  }
  /** Author accessibility notes, bound as aria-description; never interpolated into template syntax. */
  function a11y(id: string): string | undefined { const note = index.get(id)?.a11y; return note ? note : undefined; }
  function text(id: string): string { const node = index.get(id); return node?.kind === 'text' ? visualTextValue(value(node.value), '') : ''; }
  function resolved(id: string): Record<string, unknown> {
    const node = index.get(id);
    return node?.kind === 'component' || node?.kind === 'external' ? Object.fromEntries(Object.entries(node.props).map(([name, expr]) => [name, value(expr)])) : {};
  }
/** Only explicit state bindings own two-way overlay state. Literal/prop/source bindings remain read-only. */
  function overlayBinding(node: UiNode | undefined): string | undefined {
    return node?.kind === 'component' && node.ref.kind === 'nuxt-ui' && ['u-modal', 'u-drawer'].includes(node.ref.entryId)
      && node.props.open?.kind === 'state' ? node.props.open.nodeId : undefined;
  }
  /** JSON stays inert: trusted runtime closures adapt an explicit item selection to the shared event contract. */
  function menuItems(id: string, input: unknown, path: number[] = []): unknown {
    if (!Array.isArray(input) || path.length > 12) return input;
    return input.map((item: unknown, position) => {
      const here = [...path, position];
      if (Array.isArray(item)) return menuItems(id, item, here);
      if (!item || typeof item !== 'object') return item;
      const copy = copyDetailData(item);
      if (!copy || Array.isArray(copy) || typeof copy !== 'object') return copy;
      const data = { id: typeof copy.id === 'string' ? copy.id : here.join('.'), label: typeof copy.label === 'string' ? copy.label : '', path: here };
      return { ...copy, ...(copy.children ? { children: menuItems(id, copy.children, here) } : {}), onSelect: () => {
        if (!copy.disabled && !['label', 'separator'].includes(String(copy.type)) && !copy.children && enabled(id)) trigger(id, 'item:select', data);
      } };
    });
  }
  /** A newer read, a state change or disposal makes this read stale. */
  function beginFileRead(id: string): () => boolean {
    const token = (fileReads.get(id) ?? 0) + 1, started = epoch; fileReads.set(id, token);
    return () => disposed || started !== epoch || token !== fileReads.get(id) || !enabled(id);
  }
  function acceptJsonText(id: string, node: UiNode, text: string | null): void {
    if (text === null || !setDraft(id, text)) return;
    void invoke(id, 'events' in node ? node.events.filter(item => ['update:modelValue', 'change'].includes(item.event)) : [], values[id]);
  }
  /** Bounded local file intake. A superseded read, state change or disposal cannot overwrite newer input. */
  async function readJsonControl(id: string, event: unknown): Promise<void> {
    const node = control(index.get(id)); if (!node || !enabled(id)) return;
    const stale = beginFileRead(id), chosen = chosenFiles(event); if (!chosen) return;
    try { acceptJsonText(id, node, await boundedJsonText(chosen.files, node.control?.maxBytes ?? 1_000_000, stale)); }
    catch { if (!stale()) errors[id] = 'Select one valid UTF-8 JSON file within the size limit. Your previous valid value is retained.'; }
    finally { if (!stale()) chosen.target.value = ''; }
  }
  /** The label of the nearest enclosing u-form-field; Nuxt UI associates it with the control (label for=id). */
  function fieldLabel(id: string): string {
    for (let at = parents.get(id); at !== undefined; at = parents.get(at)) {
      const node = index.get(at);
      if (node?.kind !== 'component' || node.ref.kind !== 'nuxt-ui' || node.ref.entryId !== 'u-form-field') continue;
      const label = value(node.props.label);
      return typeof label === 'string' ? label.trim() : '';
    }
    return '';
  }
  /** A field without a visible label, its own aria-label or a labelled form field is named after its authored node name,
   * so assistive technology can announce it. A form-field label is never overridden by the node name. */
  function accessibleName(id: string, node: UiNode, result: Record<string, unknown>): void {
    if (Object.hasOwn(result, 'label') || Object.hasOwn(result, 'aria-label') || fieldLabel(id)) return;
    if (node.name) result['aria-label'] = node.name;
  }
  /** Typed control input: model binding, select items, native input type and the bounded JSON file picker. */
  function controlProps(id: string, node: NuxtNode, result: Record<string, unknown>): void {
    const field = control(node), kind = node.control?.kind;
    if (field) Object.assign(result, { modelValue: model(id), 'onUpdate:modelValue': (input: unknown) => { if (setDraft(id, input)) trigger(id, 'update:modelValue', values[id]); } });
    if (kind === 'select') result.items = (node.control?.options ?? []).map(option => ({ ...option }));
    if (kind && NATIVE_INPUT_TYPES.includes(kind)) result.type = kind;
    if (jsonFileInput(node)) jsonFileProps(id, result);
    if (field) accessibleName(id, node, result);
  }
  function jsonFileProps(id: string, result: Record<string, unknown>): void {
    delete result.modelValue; delete result['onUpdate:modelValue'];
    result.type = 'file'; result.accept = '.json,application/json'; result.multiple = false;
    result.onChange = (event: unknown) => { void readJsonControl(id, event); };
  }
  /** Menu adapters, two-way overlay state and the loading/disabled states the runtime owns unless authored. */
  function stateProps(id: string, node: NuxtNode, result: Record<string, unknown>): void {
    const entry = node.ref.entryId, authored = (name: string) => Object.hasOwn(node.props, name);
    if (entry === 'u-dropdown-menu') result.items = menuItems(id, result.items);
    const openTarget = overlayBinding(node);
    if (openTarget) result['onUpdate:open'] = (input: unknown) => {
      if (typeof input === 'boolean' && enabled(id) && setDraft(openTarget, input)) trigger(id, 'update:open', input);
    };
    if (entry === 'u-table' && !authored('loading')) result.loading = state.value === 'loading';
    if (VISUAL_RUNTIME_INTERACTIVE.includes(entry) && !authored('disabled')) result.disabled = ['loading', 'disabled'].includes(state.value);
  }
  function nodeProps(id: string): Record<string, unknown> {
    const node = index.get(id), result = resolved(id);
    if (!nuxtNode(node)) return result;
    controlProps(id, node, result); stateProps(id, node, result);
    return result;
  }
  function attrs(id: string): Record<string, unknown> {
    const node = index.get(id), result: Record<string, unknown> = {};
    if (node?.kind === 'element') for (const [name, expr] of Object.entries(node.attrs)) result[name] = value(expr);
    result['data-design-node'] = id; return result;
  }
  /** Model updates, the JSON file change, overlay open state and menu selection are bound by nodeProps. */
  function runtimeBound(node: UiNode, event: string): boolean {
    if (control(node) && (event === 'update:modelValue' || (event === 'change' && nuxtNode(node) && jsonFileInput(node)))) return true;
    if (overlayBinding(node) && event === 'update:open') return true;
    return event === 'item:select' && nuxtNode(node) && node.ref.entryId === 'u-dropdown-menu';
  }
  function on(id: string): Record<string, (payload?: unknown) => void> {
    const node = index.get(id); if (!node || (node.kind !== 'element' && node.kind !== 'component')) return {};
    const events = node.events.filter(i => !runtimeBound(node, i.event)).map(i => i.event);
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
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(entries => { const size = entries[0]?.contentRect.width; if (size && !scenarioId()) narrow.value = size <= 640; }); observer.observe(value); }
    const body = value.ownerDocument.body, root = value.ownerDocument.documentElement;
    const readTheme = () => { dark.value = body.classList.contains('theme-dark') || root.dataset.theme === 'dark'; }; readTheme();
    if (typeof MutationObserver !== 'undefined') { themeObserver?.disconnect(); themeObserver = new MutationObserver(readTheme); themeObserver.observe(body, { attributes: true, attributeFilter: ['class'] }); themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] }); }
  }
  return { state, visible, style, text, a11y, props: nodeProps, attrs, on, message, errors, pending, attach, theme, external };
}
