import type { Scenario, ValueExpression, VisualState, PageDefinition, ComponentDefinition } from './visual-ir.mjs';
export interface Session { state: VisualState; width: 'wide' | 'narrow'; values: Record<string, unknown>; bindings: Scenario['bindings']; hidden: Record<string, boolean>; focused: string | null; emitted: { name: string; source: string; payload?: unknown }[]; navigation: string | null; requests: { sourceId: string; operationId: string; interactionId: string }[] }
export function visualSession(scenario?: Scenario | null): Session;
export function visualVisible(definition: PageDefinition | ComponentDefinition, session: Session, nodeId: string): boolean;
export function visualTransition(definition: PageDefinition | ComponentDefinition, session: Session, nodeId: string, interactionId: string): Session;
export function visualRead(value: unknown, field: string): unknown;
export function visualValue(session: Session, expr: ValueExpression, props?: Record<string, unknown>): unknown;
export function visualTestSource(definition: PageDefinition | ComponentDefinition): string;
