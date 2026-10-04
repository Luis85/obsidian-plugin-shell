import type { Interaction } from '../../../scripts/companion/visual/visual-ir.mjs';
import type { VisualSpec } from '../../../templates/companion/runtime/visual-runtime.ts';
import { resolveSurfaceAcceptance, validateSurfaceAcceptance, type ResolvedSurfaceAcceptance } from '../../../scripts/companion/sitemap/acceptance.ts';
import type { SitemapDesign } from '../../../scripts/companion/sitemap/model.ts';
import { literal, row, type Model, type Screen } from './model.ts';
import type { Add } from './file-code.ts';
import { navigationTests } from './navigation-code.ts';
import { visualStateTestIds } from './visual-tests.ts';

/** Placeholder shape for evidence filled in later by tooling; the compiler never claims a test ran. */
export interface TraceEvidence { kind: string; path: string; commit?: string }
const vitest = (id: string): string => 'vitest:' + id;
const visualId = (id: string): string => vitest('visual-definitions:' + id);

/** Declared UX acceptance blocks with defaults applied, keyed by surface id. Surfaces without a block are absent. */
function surfaceAcceptanceBlocks(m: Model): Map<string, ResolvedSurfaceAcceptance> {
  const blocks = new Map<string, ResolvedSurfaceAcceptance>();
  for (const node of Array.isArray(row(m.document.design).nodes) ? (row(m.document.design).nodes as unknown[]).map(row) : []) {
    if (node.acceptance === undefined) continue;
    validateSurfaceAcceptance(node.acceptance);
    blocks.set(String(node.id), resolveSurfaceAcceptance(node.acceptance));
  }
  return blocks;
}
/** One title per required state, keyboard step, focus return and the minimum width (always: it has a default); themes are covered by the ui-quality e2e ids. */
function acceptanceTitles(screen: Screen, block: ResolvedSurfaceAcceptance): string[] {
  const head = `[${screen.id}] ${screen.label}: `;
  return [
    ...block.states.map(state => `${head}renders the ${state} state`),
    ...block.keyboardPath.map((step, index) => `${head}keyboard step ${index + 1} reaches ${step}`),
    ...(block.focusReturn ? [`${head}returns focus to the invoking control on close`] : []),
    `${head}stays usable at ${block.minWidth}px width`,
  ];
}
const uxPath = (m: Model, screen: Screen): string => `${m.testRoot}/ux-acceptance/${screen.slug}.test.ts`;

/** Emits one it.todo file per surface that declares obligations (nothing for surfaces without a block or without items). Returns ids per surface. */
export function surfaceAcceptanceTests(m: Model, add: Add): Map<string, string[]> {
  const ids = new Map<string, string[]>(), blocks = surfaceAcceptanceBlocks(m);
  for (const screen of m.screens) {
    const block = blocks.get(screen.id), titles = block ? acceptanceTitles(screen, block) : [];
    if (!titles.length) continue;
    const path = uxPath(m, screen);
    add(path, `import { it } from 'vitest';\n// Declared UX acceptance obligations. A todo is not evidence: replace each with an observable assertion.\n${titles.map(title => `it.todo(${literal(title)});\n`).join('')}`);
    ids.set(screen.id, titles.map(title => vitest(`${path}#${title}`)));
  }
  return ids;
}
/** Deterministic ids of the generated tests covering one interaction: acceptance TODO, dispatch test and navigation tests it can reach. */
export function interactionTestIds(m: Model, spec: VisualSpec, interaction: Interaction, acceptance: string | null, dispatch: Map<string, string>): string[] {
  const owner = spec.kind === 'page' ? spec.ownerId : null, targets = interaction.actions.flatMap(a => (a.kind === 'navigate' ? [a.surfaceId] : []));
  const navigation = owner === null ? [] : navigationTests(m).filter(t => t.from === owner && targets.includes(t.to)).map(t => vitest(t.id));
  const dispatched = dispatch.get(interaction.id);
  return [...(acceptance ? [vitest(acceptance)] : []), ...(dispatched ? [visualId(dispatched)] : []), ...navigation];
}
/** One entry per surface in model order: its resolved acceptance block (null when none), covering test ids and an evidence placeholder. */
export function surfaceTrace(m: Model, specs: VisualSpec[], uxIds: Map<string, string[]>): Record<string, unknown>[] {
  const blocks = surfaceAcceptanceBlocks(m), journeys = (m.document.design as SitemapDesign).sitemap?.journeys ?? [], navigation = navigationTests(m);
  return m.screens.map(screen => {
    const pages = specs.filter(spec => spec.kind === 'page' && spec.ownerId === screen.id), block = blocks.get(screen.id) ?? null;
    const themes = block?.themes ?? resolveSurfaceAcceptance({}).themes;
    const testIds = [
      ...(uxIds.get(screen.id) ?? []),
      ...navigation.filter(t => t.from === screen.id || t.to === screen.id).map(t => vitest(t.id)),
      ...pages.flatMap(spec => visualStateTestIds(spec).map(visualId)),
      ...(pages.length ? themes.map(theme => `ui-quality:${screen.id}:${theme}`) : []),
      ...journeys.flatMap(journey => journey.steps.filter(step => !step.unresolved && step.surface === screen.id).map(step => `journey:${journey.id}/${step.id}`)),
    ];
    const evidence: TraceEvidence[] = [];
    return { id: screen.id, kind: screen.kind, label: screen.label, definitionIds: pages.map(spec => spec.id), acceptance: block, testIds: [...new Set(testIds)], evidence };
  });
}
