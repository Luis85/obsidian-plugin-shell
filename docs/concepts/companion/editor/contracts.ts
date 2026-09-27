import type { Component } from 'vue';
import type { SitemapDesign } from '../../../../scripts/companion/sitemap/model.ts';
import type { SitemapHost } from '../../../../scripts/companion/sitemap/session.ts';

export interface EditorHost extends SitemapHost<SitemapDesign> {
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
  applyNodeChanges(changes: unknown[]): void;
  $destroy(): void;
  fitView(options?: Record<string, unknown>): Promise<unknown>;
  zoomIn(): Promise<unknown>;
  zoomOut(): Promise<unknown>;
  setCenter(x: number, y: number, options?: Record<string, unknown>): Promise<unknown>;
}
/** This runtime is already pinned/hash-verified by the companion assembly. It uses the same Vue global. */
declare global {
  interface Window {
    VueFlowCore: { VueFlow: Component; Handle: Component; Position: { Top: string; Bottom: string }; useVueFlow(id: string): FlowApi };
  }
}
