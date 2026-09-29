import type { Component } from 'vue';
import type { SitemapDesign } from '../../../../scripts/companion/sitemap/model.ts';
import type { SitemapHost } from '../../../../scripts/companion/sitemap/session.ts';

export interface EditorViewState {
  lens: 'hierarchy' | 'navigation' | 'journey';
  journeyId: string;
  query: string;
  treeOpen: boolean;
  inspectorOpen: boolean;
  tab: string;
  focused?: boolean;
  priorPanels?: { tree: boolean; inspector: boolean };
}
export interface EditorHost extends SitemapHost<SitemapDesign> {
  viewState?: EditorViewState;
  idPrefix?: string;
  ownerId?: string;
  storageLabel?: string;
  exportRecovery?(value: unknown): void;
  selected: string | null;
  select(id: string): void;
  openPage(id: string): void;
  openComponents(): void;
  openSources(): void;
  importProject(): void;
  exportProject(): void;
}
export interface FlowNode { id: string; position: {x: number; y: number}; data?: unknown }
export interface FlowApi {
  setNodes(nodes: FlowNode[]): void;
  applyNodeChanges(changes: unknown[]): void;
  $destroy(): void;
  fitView(options?: Record<string, unknown>): Promise<unknown>;
  zoomIn(): Promise<unknown>;
  zoomOut(): Promise<unknown>;
  setCenter(x: number, y: number, options?: Record<string, unknown>): Promise<unknown>;
}
export interface FlowRuntime { VueFlow: Component; Handle: Component; Position: { Top: string; Bottom: string }; useVueFlow(id: string): FlowApi }

/** This runtime is already pinned/hash-verified by the companion assembly. It uses the same Vue global. */
declare global {
  interface Window {
    VueFlowCore: FlowRuntime;
  }
}
