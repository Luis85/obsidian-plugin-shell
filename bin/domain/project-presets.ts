import { object, keys, list, text } from './data.ts';
import { requireSketch } from './errors.ts';
export type ProjectTarget = 'plugin' | 'webapp' | 'website' | 'cli';
export interface ProjectPreset { id: string; label: string; targets: ProjectTarget[]; frontends: string[] }
export interface ProjectFrontend { id: string; label: string; framework: string; ui: string; targets: ProjectTarget[] }
export interface PresetCatalog { schemaVersion: 1; version: number; presets: ProjectPreset[]; frontends: ProjectFrontend[]; runtimes: { id: ProjectTarget; label: string }[] }
export interface ProjectSelection { preset: string; frontend: string; framework: string; ui: string; targets: ProjectTarget[] }
const targetIds: readonly string[] = ['plugin', 'webapp', 'website', 'cli'];
const engines: Record<string, { framework: string; ui: string; targets: readonly string[] }> = {
  'nuxt-ui': { framework: 'vue', ui: 'nuxt-ui', targets: targetIds },
  vanilla: { framework: 'none', ui: 'native', targets: targetIds },
  angular: { framework: 'angular', ui: 'native', targets: ['plugin', 'webapp', 'cli'] },
  none: { framework: 'none', ui: 'none', targets: ['cli'] },
};
function names(value: unknown, label: string): string[] {
  const result = list(value, label, 20).map(item => text(item, label));
  requireSketch(new Set(result).size === result.length, 'PRESET_DUPLICATE', `Duplicate ${label}.`);
  return result;
}
function targets(value: unknown): ProjectTarget[] {
  const result = names(value, 'targets');
  requireSketch(result.every(id => targetIds.includes(id)), 'PRESET_TARGET', 'Unknown project runtime.');
  return result as ProjectTarget[];
}
/** Catalog data selects registered emitters, never executable module paths. */
export function readPresetCatalog(value: unknown): PresetCatalog {
  const data = object(value); keys(data, ['schemaVersion', 'version', 'presets', 'frontends', 'runtimes']);
  requireSketch(data.schemaVersion === 1 && Number.isSafeInteger(data.version) && Number(data.version) > 0, 'PRESET_VERSION', 'Unsupported preset catalog.');
  const runtimes = list(data.runtimes, 'runtimes', 4).map(raw => {
    const row = object(raw); keys(row, ['id', 'label']);
    return { id: targets([row.id])[0]!, label: text(row.label, 'runtime.label') };
  });
  requireSketch(runtimes.length === targetIds.length && new Set(runtimes.map(item => item.id)).size === runtimes.length, 'PRESET_TARGET', 'Declare every registered runtime exactly once.');
  const frontends = list(data.frontends, 'frontends', 20).map(raw => {
    const row = object(raw); keys(row, ['id', 'label', 'framework', 'ui', 'targets']);
    const id = text(row.id, 'frontend.id');
    const engine = Object.hasOwn(engines, id) ? engines[id] : undefined;
    requireSketch(engine, 'PRESET_FRONTEND', 'Frontend has no registered emitter.');
    const supported = targets(row.targets);
    requireSketch(row.framework === engine.framework && row.ui === engine.ui && supported.length > 0 && supported.every(target => engine.targets.includes(target)),
      'PRESET_CAPABILITY', 'Catalog metadata cannot expand an emitter capability.');
    return { id, label: text(row.label, 'frontend.label'), framework: engine.framework, ui: engine.ui, targets: supported };
  });
  const presets = list(data.presets, 'presets', 20).map(raw => {
    const row = object(raw); keys(row, ['id', 'label', 'targets', 'frontends']);
    const id = text(row.id, 'preset.id'), selected = targets(row.targets), choices = names(row.frontends, 'frontends');
    requireSketch(/^[a-z][a-z0-9-]*$/.test(id), 'PRESET_ID', 'Use portable preset IDs.');
    requireSketch((id === 'hybrid' ? selected.length === 0 : selected.length > 0) && choices.length > 0, 'PRESET_TARGET', 'Preset needs runtimes and frontends.');
    requireSketch(choices.every(choice => frontends.some(item => item.id === choice)), 'PRESET_FRONTEND', 'Preset references an unknown frontend.');
    return { id, label: text(row.label, 'preset.label'), targets: selected, frontends: choices };
  });
  for (const group of [presets, frontends]) requireSketch(group.length > 0 && new Set(group.map(item => item.id)).size === group.length, 'PRESET_DUPLICATE', 'Empty or duplicate catalog IDs.');
  return { schemaVersion: 1, version: Number(data.version), presets, frontends, runtimes };
}
export function projectTargets(catalog: PresetCatalog, presetId: unknown, input?: unknown): ProjectTarget[] {
  const preset = catalog.presets.find(item => item.id === presetId);
  requireSketch(preset, 'PRESET_UNKNOWN', 'Choose a project preset from new presets.');
  if (preset.id !== 'hybrid') {
    requireSketch(input === undefined, 'PRESET_TARGET', 'Only hybrid accepts explicit targets.');
    return [...preset.targets];
  }
  const selected = targets(input);
  requireSketch(selected.length >= 2, 'PRESET_HYBRID', 'Hybrid needs at least two distinct runtimes.');
  return selected.sort((a, b) => targetIds.indexOf(a) - targetIds.indexOf(b));
}
export function compatibleFrontends(catalog: PresetCatalog, presetId: string, selected: ProjectTarget[]): ProjectFrontend[] {
  const preset = catalog.presets.find(item => item.id === presetId);
  requireSketch(preset, 'PRESET_UNKNOWN', 'Unknown project preset.');
  return catalog.frontends.filter(item => preset.frontends.includes(item.id) && selected.every(target => item.targets.includes(target)));
}
export function resolveProjectSelection(catalog: PresetCatalog, input: unknown): ProjectSelection {
  const data = object(input); keys(data, ['preset', 'frontend', 'targets']);
  const selected = projectTargets(catalog, data.preset, data.targets);
  const choices = compatibleFrontends(catalog, String(data.preset), selected);
  const requested = data.frontend ?? (selected.every(target => target === 'cli') ? 'none' : undefined);
  const frontend = choices.find(item => item.id === requested);
  requireSketch(frontend, 'PRESET_INCOMPATIBLE', `Choose a compatible frontend: ${choices.map(item => item.id).join(', ')}.`);
  return { preset: String(data.preset), frontend: frontend.id, framework: frontend.framework, ui: frontend.ui, targets: selected };
}
