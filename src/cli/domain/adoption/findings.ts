import type { AngularFacts, Finding, RuntimeFacts, Severity, ToolingFacts, WorkbenchTargets } from './contracts.ts';
import { severityOrder } from './contracts.ts';
import type { InventoryView } from './source.ts';
import { majorOf, rangeAdmitsMajor } from './version.ts';

type PathProbe = Pick<InventoryView, 'has' | 'count'>;

export const finding = (id: string, severity: Severity, message: string, evidence: string[] = []): Finding => ({ id, severity, message, evidence: [...new Set(evidence)].sort() });

/** Stable order: severity first, then id, then evidence. */
export function sortFindings(findings: Finding[]): Finding[] {
  const key = (item: Finding): string => `${severityOrder.indexOf(item.severity)}|${item.id}|${item.evidence.join(',')}`;
  return [...findings].sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
}
function versionGap(angular: AngularFacts, targets: WorkbenchTargets): Finding[] {
  const evidence = [angular.workspace];
  const { major } = angular, target = targets.angular;
  if (major === null) return [finding('ANGULAR_VERSION_UNKNOWN', 'warn', 'The Angular version range could not be read from package.json.', evidence)];
  if (target.major === null) {
    return [finding('ANGULAR_TARGET_UNKNOWN', 'info', 'The Angular version Workbench generates could not be read: extract the starters ZIP beside the CLI kit so configs/starters/webapp-angular.json is available.', evidence)];
  }
  const gap = target.major - major, source = target.source ?? 'the Angular starter';
  if (gap === 0) return [finding('ANGULAR_VERSION_ALIGNED', 'info', `Angular ${major} matches the Workbench target (${source} pins ${target.version}).`, evidence)];
  if (gap < 0) return [finding('ANGULAR_AHEAD_OF_TARGET', 'warn', `Angular ${major} is newer than the Workbench target ${target.version} (${source}); generated source is not verified against it.`, evidence)];
  if (gap === 1) return [finding('ANGULAR_ONE_MAJOR_BEHIND', 'warn', `Angular ${major} is one major behind the Workbench target ${target.version}; compile a generated sample in this workspace before choosing in-tree generation.`, evidence)];
  return [finding('ANGULAR_TARGET_GAP', 'block', `Angular ${major} is ${gap} majors behind the Workbench target ${target.version} (${source}): generated Angular source cannot be compiled inside this workspace. Use a separate generated app, or upgrade Angular first.`, evidence)];
}
function moduleStyle(angular: AngularFacts): Finding[] {
  const { components, standaloneComponents, ngModules } = angular.sourceCounts;
  if (!ngModules || standaloneComponents * 2 >= components) return [];
  const evidence = angular.routing.files.slice(0, 3);
  return [finding('ANGULAR_NGMODULE_BASED', 'warn', `NgModule-based application: ${ngModules} modules and ${standaloneComponents} of ${components} components are standalone (estimate). Generated components are standalone and need a bridging route or a separate app.`, evidence)];
}
function builders(angular: AngularFacts): Finding[] {
  const webpack = angular.projects.filter(project => project.builderClass === 'webpack');
  if (!webpack.length) return [];
  return [finding('ANGULAR_WEBPACK_BUILDER', 'warn', `Legacy webpack builder in ${webpack.map(project => project.name).join(', ')}; Workbench output is built with the application (esbuild) builder, so an in-tree build would need a builder migration.`, [angular.workspace])];
}
function angularMisc(angular: AngularFacts): Finding[] {
  const found: Finding[] = [];
  if (angular.workspace === 'dependency-only') found.push(finding('ANGULAR_NO_WORKSPACE_CONFIG', 'info', 'Angular is a dependency but no angular.json or Nx project configuration was found.', []));
  if (angular.ssr) found.push(finding('ANGULAR_SSR', 'info', 'Server-side rendering is configured; the Workbench Angular output is a client-rendered browser app.', [angular.workspace]));
  if (!angular.sourceCounts.sourceFiles) found.push(finding('ANGULAR_SOURCE_NOT_READ', 'warn', 'No application TypeScript was read, so component, module and route counts are zero.', [angular.workspace]));
  return found;
}
export function angularFindings(angular: AngularFacts | null, targets: WorkbenchTargets): Finding[] {
  if (!angular) return [finding('NO_ANGULAR_DETECTED', 'info', 'No Angular dependency or workspace configuration was found; Angular-specific steps do not apply.')];
  return [...versionGap(angular, targets), ...moduleStyle(angular), ...builders(angular), ...angularMisc(angular)];
}
function pinned(runtime: RuntimeFacts): Array<[string, string]> {
  const { node } = runtime;
  const candidates: Array<[string, string | null]> = [['.nvmrc', node.nvmrc], ['.node-version', node.nodeVersionFile], ['.tool-versions', node.toolVersions]];
  return candidates.flatMap(([file, value]): Array<[string, string]> => value === null ? [] : [[file, value]]);
}
function nodeFindings(runtime: RuntimeFacts, targets: WorkbenchTargets): Finding[] {
  const target = targets.node.major;
  if (target === null) return [];
  const found: Finding[] = [];
  const pins = pinned(runtime);
  for (const [file, value] of pins) {
    const major = majorOf(value);
    if (major !== null && major !== target) found.push(finding('NODE_MAJOR_DIFFERS', 'warn', `${file} pins Node ${value}; the Workbench CLI kit is qualified on Node ${targets.node.version ?? target}. Run the kit with its own Node and keep the project's pin.`, [file]));
  }
  if (rangeAdmitsMajor(runtime.node.engines, target) === false) found.push(finding('NODE_ENGINES_EXCLUDE_TARGET', 'warn', `engines.node "${runtime.node.engines}" excludes Node ${target}, which the CLI kit needs; do not change engines to make room for it.`, ['package.json']));
  if (!pins.length && runtime.node.engines === null) found.push(finding('NODE_UNPINNED', 'info', 'No Node version is pinned (.nvmrc, .node-version, .tool-versions or engines.node).', []));
  return found;
}
function typescriptFindings(runtime: RuntimeFacts, targets: WorkbenchTargets): Finding[] {
  const { range, major, strict, configs } = runtime.typescript;
  const found: Finding[] = [];
  const target = targets.typescript;
  if (major !== null && target.major !== null && major !== target.major) {
    found.push(finding('TYPESCRIPT_MAJOR_DIFFERS', 'warn', `TypeScript ${range} differs from the repository-pinned ${target.version}; generated source is type-checked with ${target.version} only inside its own project.`, ['package.json']));
  }
  if (strict === false) found.push(finding('TYPESCRIPT_NOT_STRICT', 'warn', 'tsconfig.json disables strict mode; generated source assumes strict type checking and must not share this configuration.', configs.slice(0, 1)));
  return found;
}
function lockfileFindings(runtime: RuntimeFacts, hasPackage: boolean): Finding[] {
  const { lockfiles } = runtime.packageManager;
  if (lockfiles.length > 1) return [finding('MULTIPLE_LOCKFILES', 'warn', `Several package-manager lockfiles are present (${lockfiles.join(', ')}); the kit and generated app use npm with an exact lock, so pick the project's manager before adding installs.`, lockfiles)];
  if (!lockfiles.length && hasPackage) return [finding('NO_LOCKFILE', 'warn', 'No lockfile was found; dependency versions are not reproducible.', ['package.json'])];
  return [];
}
function conflictFindings(tooling: ToolingFacts, view: PathProbe): Finding[] {
  const found: Finding[] = [];
  const runners = tooling.testing.filter(name => ['karma', 'jest', 'vitest'].includes(name));
  if (runners.length > 1) found.push(finding('MULTIPLE_TEST_RUNNERS', 'warn', `More than one unit-test runner is configured (${runners.join(', ')}); decide which gate the new code uses.`, []));
  if (!tooling.testing.length) found.push(finding('NO_TEST_RUNNER', 'warn', 'No test runner was detected, so there is no baseline gate to protect the legacy code.', []));
  if (view.count(/(^|\/)\.eslintrc(?:\.[a-z]+)?$/) > 0 && view.count(/(^|\/)eslint\.config\.[cm]?[jt]s$/) > 0) found.push(finding('TOOL_CONFIG_CONFLICT', 'warn', 'Both legacy .eslintrc and flat eslint.config files exist; ESLint resolves only one.', []));
  if (tooling.lint.includes('tslint')) found.push(finding('TOOL_CONFIG_CONFLICT', 'warn', 'TSLint is deprecated; do not extend it to the new code.', ['tslint.json']));
  if (tooling.format.includes('prettier') && tooling.format.includes('biome')) found.push(finding('TOOL_CONFIG_CONFLICT', 'warn', 'Prettier and Biome formatters are both configured.', []));
  return found;
}
export function toolchainFindings(runtime: RuntimeFacts, tooling: ToolingFacts, targets: WorkbenchTargets, view: PathProbe, hasPackage: boolean): Finding[] {
  return [...nodeFindings(runtime, targets), ...typescriptFindings(runtime, targets), ...lockfileFindings(runtime, hasPackage), ...conflictFindings(tooling, view)];
}
