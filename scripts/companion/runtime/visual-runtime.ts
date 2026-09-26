import type { PageDefinition, ComponentDefinition, ComponentNode, UiNode, Mapping, ValueExpression } from '../visual/visual-ir.mjs';
import { copyDetailData, type DetailData, type DetailControl } from './detail-controls.ts';
import type { DetailMapping } from './detail-actions.ts';
export type { VisualState } from '../visual/visual-ir.mjs';
/** Data-only contracts shared by generated visual SFCs, their runtime and extension-owned adapters. */
export type VisualPageSpec = PageDefinition & { kind: 'page'; designSystem?: unknown };
export type VisualComponentSpec = ComponentDefinition & { kind: 'component'; designSystem?: unknown };
export type VisualSpec = VisualPageSpec | VisualComponentSpec;
export interface VisualRequest {
  definitionId: string; nodeId: string; interactionId: string; event: string;
  values: Readonly<Record<string, DetailData>>; payload: unknown;
}
/** Hand-owned bridge to a declared third-party package. Errors are reported by the runtime, never thrown into Vue. */
export interface VisualExternalAdapter<P = Record<string, unknown>> {
  mount(el: HTMLElement, props: P, emit: (event: string, payload: unknown) => void): void | Promise<void>;
  update(props: P): void;
  destroy(): void;
}
/** Catalog entries that bind a form value (mirrors VISUAL_CONTROL_ENTRIES) and entries that accept `disabled`. */
export const VISUAL_RUNTIME_CONTROLS: readonly string[] = Object.freeze(['u-input', 'u-textarea', 'u-select', 'u-checkbox', 'u-switch']);
export const VISUAL_RUNTIME_INTERACTIVE: readonly string[] = Object.freeze([...VISUAL_RUNTIME_CONTROLS, 'u-button']);
export const VISUAL_RUNTIME_LOCAL: readonly string[] = Object.freeze(['set-state', 'toggle', 'set-value', 'focus']);
export function visualChildren(node: UiNode): UiNode[][] {
  if (node.kind === 'element') return [node.children];
  if (node.kind === 'slot') return [node.fallback];
  if (node.kind === 'component') return Object.values(node.slots);
  return [];
}
/** Every node by ID, in reading order (children, slot fallbacks and instance slots). */
export function visualIndex(spec: VisualSpec): Map<string, UiNode> {
  const index = new Map<string, UiNode>();
  const visit = (list: UiNode[], depth: number): void => {
    if (depth > 16) throw new Error('VISUAL_DEPTH_LIMIT');
    for (const node of list) { index.set(node.id, node); for (const children of visualChildren(node)) visit(children, depth + 1); }
  };
  visit('root' in spec ? spec.root : spec.template, 0);
  return index;
}
/** The value expressions a node renders: text value, element attributes or component/external props. */
export function visualExpressions(node: UiNode): ValueExpression[] {
  if (node.kind === 'text') return [node.value];
  if (node.kind === 'element') return Object.values(node.attrs);
  if (node.kind === 'component' || node.kind === 'external') return Object.values(node.props);
  return [];
}
/** IR mappings carry unknown literals; copying them yields the bounded data the payload mapper accepts. */
export function visualMapping(mapping: Mapping, depth = 0): DetailMapping {
  if (depth > 6) throw new Error('VISUAL_MAPPING_LIMIT');
  if (mapping.kind === 'value') return { kind: 'value', value: copyDetailData(mapping.value) };
  if (mapping.kind === 'object') return { kind: 'object', fields: Object.fromEntries(Object.entries(mapping.fields).map(([key, field]) => [key, visualMapping(field, depth + 1)])) };
  return mapping;
}
const VISUAL_RUNTIME_CONTROL_KINDS: readonly DetailControl['kind'][] = Object.freeze(['text', 'textarea', 'number', 'checkbox', 'date', 'datetime-local', 'select', 'json-file', 'json-editor', 'markdown-editor']);
/** Narrows an IR control declaration to the parser contract; unknown kinds are rejected, never guessed. */
export function visualControl(control: NonNullable<ComponentNode['control']>): DetailControl {
  const kind = VISUAL_RUNTIME_CONTROL_KINDS.find(entry => entry === control.kind);
  if (!kind) throw new Error('VISUAL_CONTROL_INVALID');
  return { ...control, kind };
}
/** Converts a model value into the raw form the control parser accepts. */
export function visualRawInput(value: unknown): string | boolean {
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(copyDetailData(value));
}
/** Display text for a bound value: absent values use the fallback, structured data is shown as JSON. */
export function visualTextValue(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
