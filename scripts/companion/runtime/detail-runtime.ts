import type { DetailControl, DetailData } from './detail-controls.ts';
import type { DetailAction } from './detail-actions.ts';
/** Data-only contracts shared by the compiler and generated presentation. */
export type DetailState = 'default' | 'loading' | 'empty' | 'error' | 'disabled';
export type DetailLiteral = string | number | boolean;
export interface DetailBinding { sourceId: string; operationId: string; field: string }
export interface DetailElement {
  id: string; kind: 'region' | 'text' | 'input' | 'button' | 'component' | 'slot';
  label: string; text: string; parentId: string | null; layout: 'stack' | 'row' | 'grid';
  component: { id: string; version: string; variantId: string } | null;
  props: Record<string, DetailLiteral>; binding: DetailBinding | null;
  a11y: string; visibleIn: DetailState[]; control?: DetailControl; slots?: Record<string, string[]>;
}
export interface DetailInteraction {
  id: string; source: string; target: string; event: string; label: string;
  notes: string; acceptance: string; targetSurfaceId: string | null; action?: DetailAction;
}
export interface DetailDocument {
  id: string; kind: 'page' | 'component'; ownerId: string; ownerLabel: string;
  notes: string; nodes: DetailElement[]; edges: DetailInteraction[];
}
export interface DetailRequest {
  documentId: string; ownerId: string; edgeId: string; nodeId: string;
  event: string; values: Readonly<Record<string, DetailData>>; payload: unknown;
}
/** Reads data paths, never expressions; inherited properties are not traversed. */
export function detailValue(value: unknown, field: string): unknown {
  if (field === '') return value;
  for (const key of field.split('.')) {
    if (['constructor', 'prototype', '__proto__'].includes(key) || !value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return undefined;
    value = descriptor.value;
  }
  return value;
}
export function visibleDetails(document: DetailDocument, state: DetailState): DetailElement[] {
  const byId = new Map(document.nodes.map(node => [node.id, node]));
  const slotOwners = new Map(document.nodes.flatMap(n => Object.values(n.slots ?? {}).flat().map(id => [id, n.id] as const)));
  return document.nodes.filter(node => {
    const visited = new Set<string>(); let cursor: DetailElement | undefined = node;
    while (cursor) {
      if (visited.has(cursor.id) || !cursor.visibleIn.includes(state)) return false;
      visited.add(cursor.id);
      const parent = cursor.parentId ?? slotOwners.get(cursor.id);
      if (!parent) return true;
      cursor = byId.get(parent);
    }
    return false;
  });
}
export function detailTextValue(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
