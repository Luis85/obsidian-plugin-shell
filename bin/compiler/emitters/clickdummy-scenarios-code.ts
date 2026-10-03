import { literal, type Model } from './model.ts';
import { visualSpecs } from './visual-model.ts';
import { editorBindings } from '../../../scripts/companion/sitemap/editor-bindings.ts';
import type { SitemapDesign } from '../../../scripts/companion/sitemap/model.ts';
import type { Add } from './file-code.ts';

/** Only scenario identity/presentation metadata is duplicated; values stay in the existing visual specs. */
export function clickdummyScenariosCode(model: Model, add: Add): void {
  // A rich editor owns its dataset. Static page scenarios must not masquerade as editor scenarios.
  const editors = new Set(editorBindings(model.document.design as SitemapDesign).map(binding => binding.surface));
  const scenarios = visualSpecs(model).flatMap(spec => spec.kind === 'page' && !editors.has(spec.ownerId) ? spec.scenarios.map(scenario => ({
    id: scenario.id, definition: spec.id, surface: spec.ownerId, name: scenario.name,
    state: scenario.state, width: scenario.width,
  })) : []);
  add('harness/prototype/clickdummy-scenarios.ts', `export interface PreviewScenario {
  id: string; definition: string; surface: string; name: string;
  state: 'default' | 'loading' | 'empty' | 'error' | 'disabled'; width: 'wide' | 'narrow';
}
const scenarios: readonly PreviewScenario[] = ${literal(scenarios)};
/** Detached choices are scoped by canonical surface, never a similarly named page. */
export function scenariosForSurface(surface: string): PreviewScenario[] {
  return scenarios.filter(item => item.surface === surface).map(item => ({ ...item }));
}
export function resolveScenario(surface: string, id: string): PreviewScenario | null {
  if (id === '') return null;
  const scenario = scenariosForSurface(surface).find(item => item.id === id);
  if (!scenario) throw new Error('PREVIEW_SCENARIO_UNAVAILABLE');
  return scenario;
}
`);
}
