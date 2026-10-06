import type { UiNode, ComponentNode, Interaction, Mapping, ComponentDefinition, VisualState, VisualAction, Scalar, Scenario } from '#shared/companion/visual/visual-ir.mjs';
import { visualCatalogEntry } from '#shared/companion/visual/visual-catalog.mjs';
import { visualSession, visualTransition, visualVisible, type Session } from '#shared/companion/visual/visual-session.mjs';
import { visualMapping, visualRawInput, visualControl, VISUAL_RUNTIME_CONTROLS, VISUAL_RUNTIME_INTERACTIVE, type VisualSpec } from '../../../../templates/companion/runtime/visual-runtime.ts';
import { mapDetailPayload } from '../../../../templates/companion/runtime/detail-actions.ts';
import { parseDetailControl, copyDetailData, type DetailData } from '../../../../templates/companion/runtime/detail-controls.ts';
import { literal, type Model } from './model.ts';
import { relativeImport, type Add } from './file-code.ts';
import { sample, sampleCode } from './schema-code.ts';
import { visualDefinitionPath } from './visual-model.ts';

const vtStates: VisualState[] = ['default', 'loading', 'empty', 'error', 'disabled'];
/** Nuxt UI entries whose root (or $attrs target) is always in the DOM, so their node marker is observable in tests. */
const vtMarked = new Set(['u-button', 'u-input', 'u-textarea', 'u-select', 'u-checkbox', 'u-switch', 'u-form', 'u-form-field', 'u-table', 'u-card', 'u-badge', 'u-avatar', 'u-tabs', 'u-breadcrumb', 'u-alert', 'u-progress', 'u-skeleton', 'u-separator', 'u-command-palette']);
/** Entries that render authored slot content without user interaction (overlays and menus do not). */
const vtSlotted = new Set(['u-button', 'u-card', 'u-form', 'u-form-field', 'u-badge']);
/** Designed DOM events that can be dispatched natively on the marked element of these entries. */
const vtNative: Record<string, string[]> = { 'u-button': ['click', 'focus', 'blur', 'keydown'], 'u-input': ['click', 'focus', 'blur', 'keydown', 'change', 'input'], 'u-textarea': ['click', 'focus', 'blur', 'keydown', 'change', 'input'] };
const vtDom = new Set(['click', 'focus', 'blur', 'keydown', 'change', 'input', 'submit']);
export interface Rendered { node: UiNode; marked: boolean }
const vtEntry = (node: UiNode) => (node.kind === 'component' && node.ref.kind === 'nuxt-ui' ? node.ref.entryId : null);
/** Child lists this SFC renders: element children, slot fallbacks and the authored slots of slotted entries. */
function vtRenderedChildren(node: UiNode, entry: string | null): UiNode[][] {
  if (node.kind === 'element') return [node.children];
  if (node.kind === 'slot') return [node.fallback];
  return node.kind === 'component' && entry && vtSlotted.has(entry) ? Object.values(node.slots) : [];
}
/** Nodes this SFC renders itself; project-instance slot content is rendered (and tested) by the child definition. */
export function visualRendered(roots: UiNode[]): Rendered[] {
  const out: Rendered[] = [];
  const visit = (list: UiNode[]): void => { for (const node of list) {
    const entry = vtEntry(node);
    out.push({ node, marked: entry === null || vtMarked.has(entry) });
    for (const children of vtRenderedChildren(node, entry)) visit(children);
  } };
  visit(roots); return out;
}
const vtVisibility = (spec: VisualSpec, rendered: Rendered[], session: Session) => Object.fromEntries(rendered.filter(r => r.marked).map(r => [r.node.id, visualVisible(spec, session, r.node.id)]));
const vtSession = (state: VisualState): Session => ({ ...visualSession(), state });
/** Fixture raw input per control, mirroring what a person types or toggles. */
function vtRaw(node: ComponentNode): unknown {
  const kind = node.control?.kind ?? '';
  if (['u-checkbox', 'u-switch'].includes(vtEntry(node) ?? '') || kind === 'checkbox') return true;
  const raw: Record<string, string> = { number: '0', date: '2026-01-01', 'datetime-local': '2026-01-01T12:30', 'json-file': '{"fixture":true}', 'json-editor': '{"fixture":true}', select: node.control?.options?.[0]?.value ?? '' };
  return raw[kind] ?? 'fixture';
}
function vtParsed(node: ComponentNode, raw: unknown): DetailData | undefined {
  try { return node.control ? parseDetailControl(visualRawInput(raw), visualControl(node.control)) : copyDetailData(raw); } catch { return undefined; }
}
const vtEvent = (mapping: Mapping): boolean => mapping.kind === 'event' || (mapping.kind === 'object' && Object.values(mapping.fields).some(vtEvent));
/** The payload a declarative mapping produces for the fixture drafts, props and sample source outputs; null when it depends on the DOM event. */
function vtMapped(m: Model, mapping: Mapping, values: Record<string, DetailData>, props: Record<string, unknown>): { value: unknown } | null {
  if (vtEvent(mapping)) return null;
  const read = (sourceId: string, operationId: string) => sample(m.sources.find(s => s.id === sourceId)?.operations.find(o => o.id === operationId)?.output ?? null);
  try { return { value: mapDetailPayload(visualMapping(mapping), { values, props, payload: undefined, read }) }; } catch { return null; }
}
const vtPropValue = (type: string, changed = false): unknown => (type === 'boolean' ? changed : type === 'number' ? (changed ? 1 : 0) : changed ? 'changed' : 'fixture');
/** Every declared prop gets a typed fixture value, so prop-mapped payloads and emit guards are exercised. */
export const visualFixtureProps = (spec: VisualSpec | ComponentDefinition): Record<string, unknown> => ('template' in spec ? Object.fromEntries(spec.props.map(p => [p.name, vtPropValue(p.type)])) : {});
const vtExpectValue = (value: unknown) => (value === undefined ? 'undefined' : literal(value));

const vtLocalKinds = ['set-state', 'toggle', 'set-value', 'focus'];
// Test titles are shared with the traceability ids below, so a renamed case cannot silently orphan its id.
const vtGroupTitle = (ids: string[], event: string): string => '[' + ids.join(', ') + '] dispatches the designed ' + event + ' interaction';
const vtStateTitle = (state: VisualState): string => 'renders declared ' + state + ' visibility including hidden ancestors';
const vtDescribe = (spec: VisualSpec): string => spec.id + ' ' + (spec.kind === 'page' ? spec.name : spec.exportName);
/** One designed (node, event) group in the state where its node is visible. */
interface VtCase { m: Model; spec: VisualSpec; rendered: Rendered[]; node: UiNode; group: Interaction[]; state: VisualState; ports: string[] }
/** Fixture input for every visible runtime control, unless the group only runs local effects. */
function vtFills(c: VtCase): { values: Record<string, DetailData>; fills: string[] } {
  const values: Record<string, DetailData> = {}, fills: string[] = [];
  if (c.group.every(i => i.actions.length && i.actions.every(a => vtLocalKinds.includes(a.kind)))) return { values, fills };
  for (const { node: control } of c.rendered) {
    if (control.kind !== 'component' || !VISUAL_RUNTIME_CONTROLS.includes(vtEntry(control) ?? '') || !visualVisible(c.spec, vtSession(c.state), control.id)) continue;
    const raw = vtRaw(control), parsed = vtParsed(control, raw); if (parsed === undefined) continue;
    values[control.id] = parsed; fills.push(`await fill(wrapper.findAllComponents({ name: ${literal(visualCatalogEntry(vtEntry(control) ?? '')?.component.slice(1))} }), ${literal(control.id)}, ${literal(raw)});`);
  }
  return { values, fills };
}
/** The interaction requests, business hooks and navigation the group must dispatch. */
function vtDispatchLines(group: Interaction[]): string[] {
  const ids = group.map(i => i.id), todo = group.filter(i => !i.actions.length).map(i => i.id);
  const targets = group.flatMap(i => i.actions).flatMap(a => (a.kind === 'navigate' ? [a.surfaceId] : []));
  return [`expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-${ids.length})).toEqual(${literal(ids)});`,
    todo.length ? `expect(f.handle.mock.calls.map(([request]) => request.interactionId)).toEqual(${literal(todo)});` : 'expect(f.handle).not.toHaveBeenCalled();',
    targets.length ? `expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(${literal(targets)});` : 'expect(f.navigate).not.toHaveBeenCalled();'];
}
/** A mapped emit is asserted only when its payload is known; the generated guard refuses payloads that violate the contract. */
function vtEmitLine(c: VtCase, action: VisualAction & { kind: 'emit' }, values: Record<string, DetailData>, props: Record<string, unknown>): string[] {
  if (c.spec.kind !== 'component') return [];
  const mapped = vtMapped(c.m, action.payload, values, props), emit = c.spec.emits.find(e => e.name === action.event);
  if (!mapped || !emit) return [];
  const fits = emit.payloadType === 'unknown' || (emit.payloadType === 'void' ? mapped.value === undefined : typeof mapped.value === emit.payloadType);
  return [fits ? `expect(wrapper.emitted(${literal(action.event)})?.at(-1)).toEqual([${vtExpectValue(mapped.value)}]);` : `expect(wrapper.emitted(${literal(action.event)})).toBeUndefined();`];
}
/** Mapped source calls and component emits, in authored order. */
function vtActionLines(c: VtCase, values: Record<string, DetailData>, props: Record<string, unknown>): string[] {
  return c.group.flatMap(i => i.actions).flatMap(action => {
    if (action.kind === 'emit') return vtEmitLine(c, action, values, props);
    if (action.kind !== 'source') return [];
    const mapped = vtMapped(c.m, action.input, values, props), port = c.ports.indexOf(action.sourceId + '\u0000' + action.operationId);
    return mapped ? [`expect(f.runs[${port}]).toHaveBeenCalledWith(${vtExpectValue(mapped.value)});`] : [];
  });
}
function vtValueLine(id: string, entry: string, value: Scalar): string[] {
  if (['u-input', 'u-textarea'].includes(entry) && typeof value !== 'boolean') return [`expect(marked(wrapper.element, ${literal(id)}).value).toBe(${literal(value === null ? '' : String(value))});`];
  if (['u-checkbox', 'u-switch'].includes(entry) && typeof value === 'boolean') return [`expect(marked(wrapper.element, ${literal(id)}).getAttribute('aria-checked')).toBe(${literal(String(value))});`];
  return [];
}
/** Observable result of one local effect on a marked node that stays visible. */
function vtTargetLines(c: VtCase, action: VisualAction, session: Session): string[] {
  const nodeId = 'nodeId' in action ? action.nodeId : null, target = c.rendered.find(r => r.marked && r.node.id === nodeId)?.node;
  if (!target || !visualVisible(c.spec, session, target.id)) return [];
  if (action.kind === 'set-value') return vtValueLine(target.id, vtEntry(target) ?? '', action.value);
  return action.kind === 'focus' && session.focused === target.id ? [`expect(marked(wrapper.element, ${literal(target.id)}).contains(document.activeElement)).toBe(true);`] : [];
}
/** The session after the group's transitions; null when a transition is refused. */
function vtTransitions(c: VtCase): Session | null {
  let session = vtSession(c.state);
  try { for (const i of c.group) if (i.actions.length) session = visualTransition(c.spec, session, c.node.id, i.id); } catch { return null; }
  return session;
}
/** Executable local effects: resulting state, visibility, values and focus after the group's transitions. */
function vtEffectLines(c: VtCase): string[] {
  const actions = c.group.flatMap(i => i.actions), session = vtTransitions(c);
  if (!session || !actions.some(a => vtLocalKinds.includes(a.kind))) return [];
  return [...(actions.some(a => a.kind === 'set-state') ? [`expect(wrapper.attributes('data-design-state')).toBe(${literal(session.state)});`] : []),
    `expectVisible(wrapper.element, ${literal(vtVisibility(c.spec, c.rendered, session))});`, ...actions.flatMap(a => vtTargetLines(c, a, session))];
}
/** Assertions for one designed (node, event): dispatch, hooks, navigation, mapped source/emit payloads and executable local effects. */
function vtGroup(c: VtCase, event: string): string {
  const props = visualFixtureProps(c.spec), ids = c.group.map(i => i.id), { values, fills } = vtFills(c);
  const lines = [...vtDispatchLines(c.group), ...vtActionLines(c, values, props), ...vtEffectLines(c)];
  return `it(${literal(vtGroupTitle(ids, event))}, async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...${literal(props)}, designState: ${literal(c.state)} }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    ${fills.map(line => line + '\n    ').join('')}${fills.length ? 'f.reset();\n    ' : ''}await wrapper.get(${literal(`[data-design-node="${c.node.id}"]`)}).trigger(${literal(event)}); await flushPromises();
    ${lines.join('\n    ')}
  } finally { wrapper.unmount(); }
});`;
}

const vtPorts = (m: Model) => m.sources.flatMap(s => s.operations.map(o => ({ key: s.id + '\u0000' + o.id, code: `{ sourceId: ${literal(s.id)}, operationId: ${literal(o.id)}, direction: ${literal(o.direction)}, requiresInput: ${o.input !== null}, data: ${sampleCode(o.output)}, pending: false, error: null, run: runs[RUN]! }` })));
/** Interactive controls that the loading and disabled states must disable. */
function vtDisabled(spec: VisualSpec, rendered: Rendered[], state: VisualState): string[] {
  if (!['loading', 'disabled'].includes(state)) return [];
  return rendered.filter(r => r.marked && VISUAL_RUNTIME_INTERACTIVE.includes(vtEntry(r.node) ?? '') && r.node.kind === 'component' && !Object.hasOwn(r.node.props, 'disabled') && visualVisible(spec, vtSession(state), r.node.id)).map(r => r.node.id);
}
function vtStateCase(spec: VisualSpec, rendered: Rendered[], props: Record<string, unknown>, state: VisualState): string {
  const disabled = vtDisabled(spec, rendered, state);
  return `it(${literal(vtStateTitle(state))}, () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...${literal(props)}, designState: ${literal(state)} }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, ${literal(vtVisibility(spec, rendered, vtSession(state)))});${disabled.length ? `\n    for (const id of ${literal(disabled)}) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);` : ''}
  } finally { wrapper.unmount(); }
});`;
}
function vtScenarioCase(spec: VisualSpec, rendered: Rendered[], props: Record<string, unknown>, scenario: Scenario): string {
  return `it(${literal('scenario ' + scenario.name + ' renders its state and visibility')}, () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...${literal(props)}, designScenario: ${literal(scenario.id)} }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe(${literal(scenario.state)}); expectVisible(wrapper.element, ${literal(vtVisibility(spec, rendered, visualSession(scenario)))}); } finally { wrapper.unmount(); }
});`;
}
/** Designed interactions on a marked node whose DOM event can be dispatched natively. */
function vtDispatchable(node: UiNode, marked: boolean): Interaction[] {
  const native = vtNative[vtEntry(node) ?? ''];
  if (!marked) return [];
  if (node.kind === 'element') return node.events.filter(i => vtDom.has(i.event));
  return node.kind === 'component' && native ? node.events.filter(i => vtDom.has(i.event) && native.includes(i.event)) : [];
}
interface VtDispatchGroup { node: UiNode; event: string; group: Interaction[]; state: VisualState }
/** Every dispatchable (node, event), in generation order, with the first enabled state that shows the node. */
function vtDispatchGroups(spec: VisualSpec, rendered: Rendered[]): VtDispatchGroup[] {
  return rendered.flatMap(({ node, marked }) => {
    const events = vtDispatchable(node, marked);
    const state = events.length ? (['default', 'empty', 'error'] as const).find(s => visualVisible(spec, vtSession(s), node.id)) : undefined;
    if (!state) return [];
    return [...new Set(events.map(i => i.event))].map(event => ({ node, event, group: events.filter(i => i.event === event), state }));
  });
}
/** One case per dispatchable (node, event). */
function vtInteractionCases(m: Model, spec: VisualSpec, rendered: Rendered[], ports: string[]): string[] {
  return vtDispatchGroups(spec, rendered).map(({ node, event, group, state }) => vtGroup({ m, spec, rendered, node, group, state, ports }, event));
}
/** Deterministic ids ("describe > title") of the generated state-visibility tests of a definition. */
export const visualStateTestIds = (spec: VisualSpec): string[] => vtStates.map(state => vtDescribe(spec) + ' > ' + vtStateTitle(state));
/** Deterministic ids of the generated dispatch tests of a definition, keyed by the interaction ids each one covers. */
export function visualDispatchTestIds(spec: VisualSpec): Map<string, string> {
  const ids = new Map<string, string>();
  for (const { event, group } of vtDispatchGroups(spec, visualRendered(spec.kind === 'page' ? spec.root : spec.template)))
    for (const interaction of group) ids.set(interaction.id, vtDescribe(spec) + ' > ' + vtGroupTitle(group.map(i => i.id), event));
  return ids;
}
/** One describe block per definition: per-state visibility and disabled controls, scenarios and natively dispatched interactions. */
function vtDefinition(m: Model, spec: VisualSpec, subject: string): string[] {
  const roots = spec.kind === 'page' ? spec.root : spec.template, rendered = visualRendered(roots), props = visualFixtureProps(spec);
  const states = vtStates.map(state => vtStateCase(spec, rendered, props, state));
  const scenarios = roots.length ? spec.scenarios.map(scenario => vtScenarioCase(spec, rendered, props, scenario)) : [];
  const groups = vtInteractionCases(m, spec, rendered, vtPorts(m).map(p => p.key));
  return [...states, ...scenarios, ...groups].map(test => `describe(${literal(vtDescribe(spec))}, () => {\nconst Subject = ${subject};\n${test}\n});`);
}

/** Bounded generated UI suites retain every case; source size does not grow with the catalog. */
export function visualTests(m: Model, specs: VisualSpec[], add: Add): void {
  if (!specs.length) return;
  const path = `${m.testRoot}/visual/definitions.test.ts`, ports = vtPorts(m);
  const cases = specs.flatMap((spec, i) => vtDefinition(m, spec, 'Subject' + i).map(code => ({ index: i, code })));
  const render = (selected: typeof cases): string => {
    const blocks = selected.map(entry => entry.code), filled = blocks.some(b => b.includes('await fill('));
    const included = new Set(selected.map(entry => entry.index));
    return `// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
${specs.flatMap((spec, i) => included.has(i) ? [`import Subject${i} from ${literal(relativeImport(path, visualDefinitionPath(m, spec)))};\n`] : []).join('')}import { visualKey, type VisualContext } from ${literal(relativeImport(path, `${m.sourceRoot}/presentation/composables/use-visual.ts`))};
import type { VisualRequest } from ${literal(relativeImport(path, `${m.sourceRoot}/domain/visual-runtime.ts`))};
${filled ? "import type { ComponentPublicInstance } from 'vue';\n" : ''}function fixture() {
  const handle = vi.fn(async (_request: VisualRequest) => undefined); const navigate = vi.fn((_target: string) => {});
  const runs = Array.from({ length: ${ports.length} }, () => vi.fn(async (_input?: unknown) => ({ ok: true })));
  const context: VisualContext = { ports: [${ports.map((p, i) => p.code.replace('RUN', String(i))).join(',\n    ')}], navigate, handle };
  return { context, handle, navigate, runs, reset() { handle.mockClear(); navigate.mockClear(); for (const run of runs) run.mockClear(); } };
}
function marked(root: Element, id: string): HTMLInputElement { const found = root.querySelector<HTMLInputElement>('[data-design-node="' + id + '"]'); if (!found) throw new Error('Missing node ' + id); return found; }
function expectVisible(root: Element, expected: Record<string, boolean>): void { for (const [id, visible] of Object.entries(expected)) expect(root.querySelector('[data-design-node="' + id + '"]') !== null, id).toBe(visible); }
function disabledWithin(element: Element): boolean { return [element, ...element.querySelectorAll('*')].some(e => e.hasAttribute('disabled') || e.hasAttribute('data-disabled') || e.getAttribute('aria-disabled') === 'true'); }
${filled ? `/** Sets a control the way its component does: by emitting update:modelValue from the rendered instance. */
async function fill(found: { vm: ComponentPublicInstance }[], id: string, raw: unknown): Promise<void> {
  const control = found.find(c => c.vm.$attrs['data-design-node'] === id); if (!control) throw new Error('Missing control ' + id);
  control.vm.$.emit('update:modelValue', raw); await flushPromises();
}
` : ''}${blocks.join('\n')}
`;
  };
  let selected: typeof cases = [], part = 0;
  const lines = (text: string) => text.split('\n').length;
  const flush = () => { if (selected.length) { add(part ? path.replace('.test.ts', '-' + (part + 1) + '.test.ts') : path, render(selected)); part++; selected = []; } };
  for (const test of cases) {
    if (lines(render([...selected, test])) > 400) flush();
    selected.push(test);
    if (lines(render(selected)) > 400) throw new Error('VISUAL_TEST_TOO_LARGE: Split this definition interaction into smaller reviewed steps.');
  }
  flush();
}
