import type { UiNode, ComponentNode, Interaction, Mapping, ComponentDefinition, VisualState } from '../visual/visual-ir.mjs';
import { visualCatalogEntry } from '../visual/visual-catalog.mjs';
import { visualSession, visualTransition, visualVisible, type Session } from '../visual/visual-session.mjs';
import { visualMapping, visualRawInput, visualControl, VISUAL_RUNTIME_CONTROLS, VISUAL_RUNTIME_INTERACTIVE, type VisualSpec } from '../../../templates/companion/runtime/visual-runtime.ts';
import { mapDetailPayload } from '../../../templates/companion/runtime/detail-actions.ts';
import { parseDetailControl, copyDetailData, type DetailData } from '../../../templates/companion/runtime/detail-controls.ts';
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
/** Nodes this SFC renders itself; project-instance slot content is rendered (and tested) by the child definition. */
export function visualRendered(roots: UiNode[]): Rendered[] {
  const out: Rendered[] = [];
  const visit = (list: UiNode[]): void => { for (const node of list) {
    const entry = node.kind === 'component' && node.ref.kind === 'nuxt-ui' ? node.ref.entryId : null;
    out.push({ node, marked: entry === null || vtMarked.has(entry) });
    if (node.kind === 'element') visit(node.children);
    else if (node.kind === 'slot') visit(node.fallback);
    else if (node.kind === 'component' && entry && vtSlotted.has(entry)) for (const children of Object.values(node.slots)) visit(children);
  } };
  visit(roots); return out;
}
const vtEntry = (node: UiNode) => (node.kind === 'component' && node.ref.kind === 'nuxt-ui' ? node.ref.entryId : null);
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

const vtGroupTitle = (ids: string[], event: string): string => '[' + ids.join(', ') + '] dispatches the designed ' + event + ' interaction';
const vtStateTitle = (state: VisualState): string => 'renders declared ' + state + ' visibility including hidden ancestors';
const vtDescribe = (spec: VisualSpec): string => spec.id + ' ' + (spec.kind === 'page' ? spec.name : spec.exportName);
/** The natively dispatched (node, event) groups of a definition, in generation order. */
function vtDispatchGroups(spec: VisualSpec, rendered: Rendered[]): { node: UiNode; event: string; group: Interaction[]; state: VisualState }[] {
  const groups: { node: UiNode; event: string; group: Interaction[]; state: VisualState }[] = [];
  for (const { node, marked } of rendered) {
    const entry = vtEntry(node), events = node.kind === 'element' || (node.kind === 'component' && entry) ? node.events : [];
    if (!marked || (node.kind === 'component' && !vtNative[entry ?? ''])) continue;
    const state = (['default', 'empty', 'error'] as const).find(s => visualVisible(spec, vtSession(s), node.id)); if (!state) continue;
    for (const event of [...new Set(events.map(i => i.event))].filter(e => vtDom.has(e) && (node.kind === 'element' || vtNative[entry ?? '']?.includes(e))))
      groups.push({ node, event, group: events.filter(i => i.event === event), state });
  }
  return groups;
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

/** Assertions for one designed (node, event): dispatch, hooks, navigation, mapped source/emit payloads and executable local effects. */
function vtGroup(m: Model, spec: VisualSpec, rendered: Rendered[], node: UiNode, event: string, group: Interaction[], state: VisualState, ports: string[]): string {
  const props = visualFixtureProps(spec), ids = group.map(i => i.id), local = group.every(i => i.actions.length && i.actions.every(a => ['set-state', 'toggle', 'set-value', 'focus'].includes(a.kind)));
  const controls = local ? [] : rendered.flatMap(r => (r.node.kind === 'component' && VISUAL_RUNTIME_CONTROLS.includes(vtEntry(r.node) ?? '') && visualVisible(spec, vtSession(state), r.node.id) ? [r.node] : []));
  const values: Record<string, DetailData> = {}, fills: string[] = [];
  for (const control of controls) {
    const raw = vtRaw(control), parsed = vtParsed(control, raw); if (parsed === undefined) continue;
    values[control.id] = parsed; fills.push(`await fill(wrapper.findAllComponents({ name: ${literal(visualCatalogEntry(vtEntry(control) ?? '')?.component.slice(1))} }), ${literal(control.id)}, ${literal(raw)});`);
  }
  const lines = [`expect((wrapper.emitted<[VisualRequest]>('interaction') ?? []).map(([request]) => request.interactionId).slice(-${ids.length})).toEqual(${literal(ids)});`];
  const todo = group.filter(i => !i.actions.length).map(i => i.id);
  lines.push(todo.length ? `expect(f.handle.mock.calls.map(([request]) => request.interactionId)).toEqual(${literal(todo)});` : 'expect(f.handle).not.toHaveBeenCalled();');
  const actions = group.flatMap(i => i.actions), targets = actions.flatMap(a => (a.kind === 'navigate' ? [a.surfaceId] : []));
  lines.push(targets.length ? `expect(f.navigate.mock.calls.map(([target]) => target)).toEqual(${literal(targets)});` : 'expect(f.navigate).not.toHaveBeenCalled();');
  for (const action of actions) {
    if (action.kind === 'source') {
      const mapped = vtMapped(m, action.input, values, props), port = ports.indexOf(action.sourceId + '\u0000' + action.operationId);
      if (mapped) lines.push(`expect(f.runs[${port}]).toHaveBeenCalledWith(${vtExpectValue(mapped.value)});`);
    } else if (action.kind === 'emit' && spec.kind === 'component') {
      const mapped = vtMapped(m, action.payload, values, props), emit = spec.emits.find(e => e.name === action.event);
      if (!mapped || !emit) continue;
      const fits = emit.payloadType === 'unknown' || (emit.payloadType === 'void' ? mapped.value === undefined : typeof mapped.value === emit.payloadType);
      // The generated guard refuses payloads that violate the emit contract instead of emitting them.
      lines.push(fits ? `expect(wrapper.emitted(${literal(action.event)})?.at(-1)).toEqual([${vtExpectValue(mapped.value)}]);` : `expect(wrapper.emitted(${literal(action.event)})).toBeUndefined();`);
    }
  }
  let session: Session | null = vtSession(state);
  try { for (const i of group) if (i.actions.length) session = visualTransition(spec, session!, node.id, i.id); } catch { session = null; }
  if (session && actions.some(a => ['set-state', 'toggle', 'set-value', 'focus'].includes(a.kind))) {
    if (actions.some(a => a.kind === 'set-state')) lines.push(`expect(wrapper.attributes('data-design-state')).toBe(${literal(session.state)});`);
    lines.push(`expectVisible(wrapper.element, ${literal(vtVisibility(spec, rendered, session))});`);
    for (const a of actions) {
      const nodeId = 'nodeId' in a ? a.nodeId : null, target = rendered.find(r => r.marked && r.node.id === nodeId)?.node;
      if (!target || !visualVisible(spec, session, target.id)) continue;
      if (a.kind === 'set-value' && ['u-input', 'u-textarea'].includes(vtEntry(target) ?? '') && typeof a.value !== 'boolean') lines.push(`expect(marked(wrapper.element, ${literal(target.id)}).value).toBe(${literal(a.value === null ? '' : String(a.value))});`);
      if (a.kind === 'set-value' && ['u-checkbox', 'u-switch'].includes(vtEntry(target) ?? '') && typeof a.value === 'boolean') lines.push(`expect(marked(wrapper.element, ${literal(target.id)}).getAttribute('aria-checked')).toBe(${literal(String(a.value))});`);
      if (a.kind === 'focus' && session.focused === target.id) lines.push(`expect(marked(wrapper.element, ${literal(target.id)}).contains(document.activeElement)).toBe(true);`);
    }
  }
  return `it(${literal(vtGroupTitle(ids, event))}, async () => {
  const f = fixture(); const wrapper = mount(Subject, { attachTo: document.body, props: { ...${literal(props)}, designState: ${literal(state)} }, global: { provide: { [visualKey as symbol]: f.context } } });
  try {
    ${fills.map(line => line + '\n    ').join('')}${fills.length ? 'f.reset();\n    ' : ''}await wrapper.get(${literal(`[data-design-node="${node.id}"]`)}).trigger(${literal(event)}); await flushPromises();
    ${lines.join('\n    ')}
  } finally { wrapper.unmount(); }
});`;
}

const vtPorts = (m: Model) => m.sources.flatMap(s => s.operations.map(o => ({ key: s.id + '\u0000' + o.id, code: `{ sourceId: ${literal(s.id)}, operationId: ${literal(o.id)}, direction: ${literal(o.direction)}, requiresInput: ${o.input !== null}, data: ${sampleCode(o.output)}, pending: false, error: null, run: runs[RUN]! }` })));
/** One describe block per definition: per-state visibility and disabled controls, scenarios and natively dispatched interactions. */
function vtDefinition(m: Model, spec: VisualSpec, subject: string): string[] {
  const roots = spec.kind === 'page' ? spec.root : spec.template, rendered = visualRendered(roots), props = visualFixtureProps(spec), ports = vtPorts(m);
  const states = vtStates.map(state => {
    const disabled = ['loading', 'disabled'].includes(state) ? rendered.filter(r => r.marked && VISUAL_RUNTIME_INTERACTIVE.includes(vtEntry(r.node) ?? '') && r.node.kind === 'component' && !Object.hasOwn(r.node.props, 'disabled') && visualVisible(spec, vtSession(state), r.node.id)).map(r => r.node.id) : [];
    return `it(${literal(vtStateTitle(state))}, () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...${literal(props)}, designState: ${literal(state)} }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expectVisible(wrapper.element, ${literal(vtVisibility(spec, rendered, vtSession(state)))});${disabled.length ? `\n    for (const id of ${literal(disabled)}) expect(disabledWithin(marked(wrapper.element, id)), id).toBe(true);` : ''}
  } finally { wrapper.unmount(); }
});`;
  });
  const scenarios = roots.length ? spec.scenarios.map(scenario => `it(${literal('scenario ' + scenario.name + ' renders its state and visibility')}, () => {
  const f = fixture(); const wrapper = mount(Subject, { props: { ...${literal(props)}, designScenario: ${literal(scenario.id)} }, global: { provide: { [visualKey as symbol]: f.context } } });
  try { expect(wrapper.attributes('data-design-state')).toBe(${literal(scenario.state)}); expectVisible(wrapper.element, ${literal(vtVisibility(spec, rendered, visualSession(scenario)))}); } finally { wrapper.unmount(); }
});`) : [];
  const groups = vtDispatchGroups(spec, rendered).map(({ node, event, group, state }) => vtGroup(m, spec, rendered, node, event, group, state, ports.map(p => p.key)));
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
