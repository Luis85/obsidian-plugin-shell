import { pluginRegistry } from './registry.ts';
import type { WorkbenchPluginObject } from './api.ts';
import { validateComponentTemplate, type ComponentTemplate } from '../domain/component-template.ts';

export function pluginComponentTemplates(
  registry: readonly WorkbenchPluginObject[] = pluginRegistry,
): readonly ComponentTemplate[] {
  const templates = registry
    .filter(plugin => plugin.config?.enabled !== false)
    .flatMap(plugin => plugin.componentTemplates ?? [])
    .map(template => validateComponentTemplate(structuredClone(template)));
  const ids = new Set<string>();
  for (const template of templates) {
    if (ids.has(template.id)) throw new Error('WORKBENCH_PLUGIN_TEMPLATE_DUPLICATE:' + template.id);
    ids.add(template.id);
  }
  return Object.freeze(templates);
}
