/** Shared sitemap projections over canonical design.nodes/design.links. No host or UI imports. */
export type SurfaceKind = 'view' | 'page' | 'group' | 'modal' | 'settings' | 'action';

export interface Surface {
  id: string;
  kind: SurfaceKind;
  label: string;
  parent: string | null;
  slug?: string;
  nav?: boolean;
  entry?: boolean;
  [key: string]: unknown;
}

export interface Transition {
  id: string;
  from: string;
  to: string;
  kind: string;
  label: string;
  [key: string]: unknown;
}

export interface SitemapRoute {
  id: string;
  surface: string;
  path: string;
}

/** via names the incoming design.links identity. A null via never invents navigation. */
export interface JourneyStep {
  id: string;
  surface: string;
  via: string | null;
  unresolved?: true;
  lastKnownLabel?: string;
}

export interface SitemapJourney {
  id: string;
  name: string;
  steps: JourneyStep[];
}

export interface SitemapExtension {
  schema: 1;
  routes: SitemapRoute[];
  journeys: SitemapJourney[];
}

export interface SitemapFeature {
  id: string;
  name: string;
  surfaces: string[];
  entryPoints: string[];
  components: string[];
  requirements: string[];
  dependsOn: string[];
}

export interface FeatureExtension {
  schema: 1;
  items: SitemapFeature[];
}

export interface Position { x: number; y: number }
export interface SitemapCanvas {
  positions: Record<string, Position>;
  collapsed?: string[];
  [key: string]: unknown;
}

/** A structural contract, not a replacement for the complete project/envelope validator. */
export interface SitemapDesign {
  nodes: Surface[];
  links: Transition[];
  sitemap?: SitemapExtension;
  features?: FeatureExtension;
  canvas?: SitemapCanvas;
  [key: string]: unknown;
}

export interface SitemapFinding {
  code: 'JOURNEY_UNRESOLVED' | 'JOURNEY_TRANSITION_REQUIRED' | 'JOURNEY_CONDITION_UNIMPLEMENTED';
  journey: string;
  step: string;
  message: string;
}

export type SitemapCommand =
  | { type: 'create'; surface: Surface }
  | { type: 'link'; transition: Transition }
  | { type: 'transition-edit'; transition: Transition }
  | { type: 'transition-remove' | 'route-remove' | 'journey-remove'; id: string; review: string }
  | { type: 'move'; surface: string; parent: string | null; before: string | null }
  | { type: 'rename'; surface: string; label: string }
  | { type: 'arrange'; positions: Record<string, Position> }
  | { type: 'route'; route: SitemapRoute }
  | { type: 'journey'; journey: SitemapJourney }
  | { type: 'feature'; feature: SitemapFeature }
  | { type: 'remove'; surface: string; review: string };

export interface RemovalImpact {
  surface: string;
  children: string[];
  links: string[];
  routes: string[];
  journeySteps: string[];
  features: string[];
  externalReferences: string[];
  canRemove: boolean;
  /** Exact private preimage, not a cryptographic signature or a portable approval. Do not log. */
  review: string;
}

export const SITEMAP_LIMITS = Object.freeze({
  nodes: 60, links: 120, routes: 60, journeys: 64, steps: 120,
  totalSteps: 4096, features: 60, depth: 40, values: 120_000,
  bytes: 4_000_000, reviewBytes: 8_001_024, coordinate: 50_000, history: 20, historyBytes: 8_000_000,
});
