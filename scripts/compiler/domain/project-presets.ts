import { CompilerError, diagnostic } from './diagnostics.ts';
export type ProjectTarget = 'plugin' | 'webapp' | 'website' | 'cli';
export type ProjectFramework = 'nuxtui' | 'vanilla' | 'angular' | 'none';
export interface ProjectPreset { id: string; label: string; description: string; projectType: ProjectTarget | 'hybrid'; defaultFramework: ProjectFramework }
export interface ProjectCatalog {
  schemaVersion: 1; version: number;
  frameworks: { id: ProjectFramework; label: string; description: string }[];
  targets: { id: ProjectTarget; label: string; frameworks: ProjectFramework[] }[];
  presets: ProjectPreset[];
  angularPins: Record<string, string>;
}
export interface ProjectSelection {
  schemaVersion: 1; catalogVersion: number; preset: string;
  projectType: ProjectTarget | 'hybrid'; framework: ProjectFramework; targets: ProjectTarget[];
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'lower', message));
}
function record(value: unknown): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'Project selection/catalog must be an object.');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, allowed: string[]): void {
  check(Object.keys(value).every(key => allowed.includes(key)), 'Unknown project selection/catalog field.');
}
function array(value: unknown): unknown[] {
  check(Array.isArray(value) && value.length > 0 && value.length <= 40, 'Expected a non-empty bounded project catalog list.');
  return value;
}
function label(value: unknown): void {
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= 1000 && !/[\u0000-\u001f\u007f-\u009f]/.test(value), 'Catalog text must be bounded, non-empty and control-free.');
}
function ids(values: unknown[], valid: readonly string[]): void {
  check(new Set(values).size === values.length && values.every(value => typeof value === 'string' && valid.includes(value)), 'Catalog has duplicate or unsupported adapter IDs.');
}
/** Pure validated data boundary shared by CLI discovery and compiler lowering. */
export function readProjectCatalog(value: unknown): ProjectCatalog {
  const data = record(value); exact(data, ['schemaVersion', 'version', 'frameworks', 'targets', 'presets', 'angularPins']);
  check(data.schemaVersion === 1 && Number.isSafeInteger(data.version) && Number(data.version) > 0, 'Unsupported project catalog version.');
  const frameworks = array(data.frameworks).map(value => {
    const item = record(value); exact(item, ['id', 'label', 'description']); label(item.label); label(item.description); return item;
  });
  ids(frameworks.map(item => item.id), ['nuxtui', 'vanilla', 'angular', 'none']);
  const targets = array(data.targets).map(value => {
    const item = record(value); exact(item, ['id', 'label', 'frameworks']); label(item.label);
    ids(array(item.frameworks), frameworks.map(item => String(item.id)));
    check(item.id === 'cli' ? JSON.stringify(item.frameworks) === '["none"]' : !array(item.frameworks).includes('none'), 'Only CLI uses the none frontend.');
    return item;
  });
  ids(targets.map(item => item.id), ['plugin', 'webapp', 'website', 'cli']);
  const presetIds = new Set<string>();
  for (const value of array(data.presets)) {
    const item = record(value); exact(item, ['id', 'label', 'description', 'projectType', 'defaultFramework']);
    check(typeof item.id === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(item.id) && !presetIds.has(item.id), 'Preset IDs must be portable and unique.');
    presetIds.add(item.id); label(item.label); label(item.description);
    const target = targets.find(target => target.id === item.projectType);
    check(item.projectType === 'hybrid' || target, 'Preset references an unknown project type.');
    check(frameworks.some(framework => framework.id === item.defaultFramework), 'Unknown default framework.');
    check(item.projectType === 'hybrid' ? item.defaultFramework !== 'none' : array(target!.frameworks).includes(item.defaultFramework), 'Preset default is incompatible with its target.');
  }
  const pins = record(data.angularPins);
  const required = ['@angular/core', '@angular/common', '@angular/compiler', '@angular/platform-browser', '@angular/compiler-cli', 'rxjs', 'tslib'];
  exact(pins, required);
  check(required.every(name => typeof pins[name] === 'string' && /^\d+\.\d+\.\d+$/.test(String(pins[name]))), 'Angular dependencies need exact version pins.');
  check(new Set(required.filter(name => name.startsWith('@angular/')).map(name => pins[name])).size === 1, 'Angular packages must use one version.');
  return data as unknown as ProjectCatalog;
}
export function projectPreset(catalog: ProjectCatalog, id: unknown): ProjectPreset {
  const selected = catalog.presets.find(item => item.id === id);
  check(selected, 'Choose a preset from new presets --json.'); return selected;
}
export function availableFrameworks(catalog: ProjectCatalog, targets: readonly ProjectTarget[]): ProjectFramework[] {
  const visual = targets.filter(target => target !== 'cli');
  if (!visual.length) return ['none'];
  return catalog.frameworks.filter(item => item.id !== 'none' && visual.every(target => catalog.targets.find(row => row.id === target)?.frameworks.includes(item.id))).map(item => item.id);
}
/** Defaults are resolved once and become part of the reviewed sidecar and compiler fingerprint. */
export function resolveProjectSelection(catalog: ProjectCatalog, value: unknown): ProjectSelection {
  const input = record(value); exact(input, ['schemaVersion', 'catalogVersion', 'preset', 'framework', 'targets']);
  check(input.schemaVersion === 1 && input.catalogVersion === catalog.version, 'Use the current project catalogVersion from new presets --json.');
  const preset = projectPreset(catalog, input.preset);
  const requested = input.targets === undefined && preset.projectType !== 'hybrid' ? [preset.projectType] : array(input.targets);
  ids(requested, catalog.targets.map(item => item.id));
  check(preset.projectType === 'hybrid' ? requested.length >= 2 : requested.length === 1 && requested[0] === preset.projectType,
    'Hybrid requires at least two distinct targets; other presets must keep their own target.');
  const targets = catalog.targets.filter(item => requested.includes(item.id)).map(item => item.id);
  const framework = input.framework === undefined ? preset.defaultFramework : input.framework;
  check(availableFrameworks(catalog, targets).includes(framework as ProjectFramework), 'The frontend framework is incompatible with the selected targets. CLI alone requires none.');
  return { schemaVersion: 1, catalogVersion: catalog.version, preset: preset.id, projectType: preset.projectType, framework: framework as ProjectFramework, targets };
}
/** Revalidate even direct compiler callers; never trust a TypeScript assertion at runtime. */
export function validateProjectSelection(catalog: ProjectCatalog, value: unknown): ProjectSelection {
  const input = record(value); exact(input, ['schemaVersion', 'catalogVersion', 'preset', 'projectType', 'framework', 'targets']);
  const { projectType, ...request } = input;
  const selected = resolveProjectSelection(catalog, request);
  check(projectType === selected.projectType, 'Project type conflicts with the selected preset.');
  return selected;
}

/** Replay only caller-owned selection fields; projectType is resolved from the catalog. */
export function projectSelectionRequest(selection: ProjectSelection): Omit<ProjectSelection, 'projectType'> {
  return { schemaVersion: selection.schemaVersion, catalogVersion: selection.catalogVersion, preset: selection.preset,
    framework: selection.framework, targets: [...selection.targets] };
}
