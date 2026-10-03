import type { AdoptionReport, Finding } from './contracts.ts';
import { generatedAppDirectory, kitDirectory } from './paths.ts';

export type StrategyId = 'A' | 'B' | 'C';
export type Fit = 'recommended' | 'possible' | 'not-advised';
export interface StrategyOption { id: StrategyId; title: string; summary: string; fit: Fit; reasons: string[]; limits: string[] }
export interface Recommendation { primary: StrategyId; options: StrategyOption[]; headline: string; stack: 'angular' | 'vue' | 'other-web' | 'obsidian' | 'none' }

const has = (report: AdoptionReport, id: string): Finding | undefined => report.findings.find(item => item.id === id);
const frameworkIds = (report: AdoptionReport): string[] => report.frameworks.map(item => item.id);

/** The frontend stack the legacy project actually uses, for the starter and strategy choice. */
export function stackOf(report: AdoptionReport): Recommendation['stack'] {
  const ids = frameworkIds(report);
  if (report.angular) return 'angular';
  if (ids.some(id => ['vue', 'nuxt'].includes(id))) return 'vue';
  if (ids.some(id => ['react', 'next', 'svelte', 'sveltekit', 'solid', 'preact', 'astro', 'lit'].includes(id))) return 'other-web';
  return ids.includes('obsidian-plugin') ? 'obsidian' : 'none';
}
function inTreeAngular(report: AdoptionReport): { feasible: boolean; reasons: string[] } {
  const angular = report.angular;
  if (!angular) return { feasible: false, reasons: ['No Angular workspace was detected.'] };
  const gap = has(report, 'ANGULAR_TARGET_GAP'), unknown = has(report, 'ANGULAR_TARGET_UNKNOWN') ?? has(report, 'ANGULAR_VERSION_UNKNOWN');
  if (gap) return { feasible: false, reasons: [gap.message] };
  if (unknown) return { feasible: false, reasons: [unknown.message + ' In-tree generation is not recommended until the version is confirmed.'] };
  const reasons = [`Angular ${angular.major} is within one major of the Workbench target ${report.targets.angular.version ?? 'unknown'} or newer.`];
  const modules = has(report, 'ANGULAR_NGMODULE_BASED');
  if (modules) reasons.push('Mixed module style: the generated standalone components need a lazy bridging route.');
  return { feasible: true, reasons };
}
function optionA(report: AdoptionReport, feasible: { feasible: boolean; reasons: string[] }, primary: StrategyId): StrategyOption {
  const fit: Fit = primary === 'A' ? 'recommended' : feasible.feasible ? 'possible' : 'not-advised';
  return {
    id: 'A', title: 'Sidecar CLI kit plus a dedicated generated Angular folder in this repository', fit, reasons: feasible.reasons,
    summary: `Extract the CLI kit to ${kitDirectory}, author new screens design-first in design/project.json and generate them into ${generatedAppDirectory}, a separate package that is wired to the legacy app behind a route and a flag.`,
    limits: ['The generated package keeps its own package.json, lockfile and TypeScript configuration; it is not merged into the legacy src tree.',
      `Mounting ${generatedAppDirectory} inside the legacy router is optional manual work that needs a matching Angular major and a spike; the generated webapp mirrors its routes in the URL hash, which can collide with the legacy router.`],
  };
}
function optionB(report: AdoptionReport, primary: StrategyId): StrategyOption {
  const stack = stackOf(report);
  const reasons = stack === 'angular' ? ['A separate app never touches the legacy toolchain, so version gaps and legacy builders do not block it.']
    : ['A separate app works with any existing frontend stack because nothing is compiled into the legacy build.'];
  if (stack === 'vue') reasons.push('Vue was detected: prefer the webapp-nuxtui starter (Vue 3) over Angular so the second stack is avoided.');
  return {
    id: 'B', title: 'Separate Workbench-generated app or workspace beside the legacy project', fit: primary === 'B' ? 'recommended' : 'possible', reasons,
    summary: `Use the same kit and design files, but generate a standalone app (default ${generatedAppDirectory}) with its own CI job and deployment. The legacy app links to it; no code is shared at build time.`,
    limits: ['Two deployables: routing, authentication and styling are not shared automatically.', 'Visual consistency with the legacy UI is a design task, not a generator feature.'],
  };
}
function optionC(report: AdoptionReport, primary: StrategyId): StrategyOption {
  const obsidian = report.frameworks.find(item => item.id === 'obsidian-plugin');
  const fit: Fit = primary === 'C' ? 'recommended' : obsidian ? 'possible' : 'not-advised';
  return {
    id: 'C', title: 'Obsidian plugin target', fit,
    reasons: obsidian ? [`An Obsidian plugin manifest was found (${obsidian.detail ?? 'minAppVersion unknown'}).`] : ['No Obsidian plugin manifest was found; this option only applies to plugins.'],
    summary: 'Treat the project as a plugin: keep it in place, use the kit for design-first authoring, review gates and new views, and compare its layout with a generated plugin before moving code.',
    limits: ['An existing plugin is not a shell-generated project; commands such as generate and check assume the shell layout, so adoption starts with design and gates, not regeneration.'],
  };
}
function headline(primary: StrategyId, stack: Recommendation['stack']): string {
  if (primary === 'C') return 'Adopt Workbench as a design-and-review sidecar for this Obsidian plugin (option C), starting read-only.';
  if (primary === 'A') return 'Add the CLI kit as a sidecar and generate new screens into a dedicated Angular folder behind a flag (option A).';
  if (stack === 'angular') return 'Generate new screens as a separate app and keep the legacy Angular workspace untouched (option B).';
  return 'Use Workbench design-first next to the existing project and generate a separate app (option B).';
}
export function recommend(report: AdoptionReport): Recommendation {
  const stack = stackOf(report), tree = inTreeAngular(report);
  let primary: StrategyId = 'B';
  if (stack === 'obsidian') primary = 'C';
  else if (stack === 'angular' && tree.feasible) primary = 'A';
  return { primary, stack, headline: headline(primary, stack), options: [optionA(report, tree, primary), optionB(report, primary), optionC(report, primary)] };
}
