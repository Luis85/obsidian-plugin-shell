/** Framework-free prototype workspace. Snapshots are ordinary, independently valid project JSON. */
import type { AuthoringDocument } from '../authoring-contract.ts';
export type VariantStatus = 'draft' | 'review' | 'approved' | 'active' | 'archived';
export interface PrototypeSelection { prototypeId: string; versionId: string; variantId: string }
export interface PrototypeVariant {
  id: string; name: string; hypothesis: string; status: VariantStatus; revision: number;
  document: AuthoringDocument;
}
export interface PrototypeVersion { id: string; label: string; sealed: boolean; variants: PrototypeVariant[] }
export interface ManagedPrototype { id: string; name: string; description: string; archived: boolean; versions: PrototypeVersion[] }
export interface PrototypeWorkspace {
  kind: 'workbench-prototype-workspace'; schemaVersion: 1; projectId: string; revision: number;
  active: PrototypeSelection | null; prototypes: ManagedPrototype[];
}
export type ValidateDocument = (input: unknown) => AuthoringDocument;
export type PrototypeAction =
  | { type: 'create'; id: string; name: string; description: string; document: AuthoringDocument }
  | { type: 'version'; prototypeId: string; id: string; from: string }
  | { type: 'prototype-details'; prototypeId: string; name: string; description: string }
  | { type: 'version-details'; prototypeId: string; versionId: string; label: string }
  | { type: 'restore-snapshot'; selection: PrototypeSelection; source: PrototypeSelection; recoveryId: string }
  | { type: 'fork'; selection: PrototypeSelection; id: string; name: string; hypothesis: string }
  | { type: 'save'; selection: PrototypeSelection; document: AuthoringDocument }
  | { type: 'details'; selection: PrototypeSelection; name: string; hypothesis: string }
  | { type: 'status'; selection: PrototypeSelection; status: Exclude<VariantStatus, 'active'> }
  | { type: 'activate'; selection: PrototypeSelection }
  | { type: 'deactivate' }
  | { type: 'seal'; prototypeId: string; versionId: string }
  | { type: 'archive'; prototypeId: string; archived: boolean };
const PROTOTYPE_ROOT = 'docs/concepts';
export const PROTOTYPE_REGISTRY = PROTOTYPE_ROOT + '/prototypes.json';
export const PROTOTYPE_MAX_BYTES = 32_000_000;
export const variantStatuses: readonly VariantStatus[] = ['draft', 'review', 'approved', 'active', 'archived'];
export function prototypeFolder(id: string): string { return `${PROTOTYPE_ROOT}/${id}`; }
export function snapshotPath(s: PrototypeSelection): string { return `${prototypeFolder(s.prototypeId)}/versions/${s.versionId}/variants/${s.variantId}/project.json`; }
export function selectionKey(s: PrototypeSelection | null): string { return s ? `${s.prototypeId}/${s.versionId}/${s.variantId}` : ''; }
