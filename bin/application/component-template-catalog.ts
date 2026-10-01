import { requireSketch } from '../domain/errors.ts';
import type { ComponentTemplate, ComponentTemplateQuery } from '../domain/component-template.ts';
import type { LoadedComponentTemplate } from '../adapters/component-template-repository.ts';

function same(value: string, expected?: string): boolean {
  return expected === undefined || value.toLowerCase() === expected.toLowerCase();
}

export function filterComponentTemplates(
  entries: readonly LoadedComponentTemplate[],
  query: ComponentTemplateQuery = {},
): LoadedComponentTemplate[] {
  const needle = query.query?.trim().toLowerCase();
  return entries.filter(({ template }) => {
    const searchable = [
      template.id,
      template.name,
      template.category,
      template.description,
      ...template.tags,
      ...template.capabilities,
    ].join(' ').toLowerCase();
    return (!needle || searchable.includes(needle))
      && (!query.templateType || template.templateType === query.templateType)
      && (!query.atomicLevel || template.atomicLevel === query.atomicLevel)
      && same(template.category, query.category)
      && (!query.tag || template.tags.some(tag => same(tag, query.tag)))
      && (!query.recommendedFor || template.recommendedFor.some(item => same(item, query.recommendedFor)));
  });
}

export function componentTemplateSummary(entry: LoadedComponentTemplate) {
  const template = entry.template;
  return {
    id: template.id,
    name: template.name,
    version: template.version,
    templateType: template.templateType,
    atomicLevel: template.atomicLevel,
    category: template.category,
    description: template.description,
    tags: template.tags,
    recommendedFor: template.recommendedFor,
    children: template.children.length,
    slots: template.slots.length,
    origin: entry.origin,
    file: entry.file,
    sha256: entry.sha256,
  };
}

export function componentTemplateTree(entries: readonly LoadedComponentTemplate[], id: string) {
  const byId = new Map(entries.map(entry => [entry.template.id, entry.template]));
  const root = byId.get(id);
  requireSketch(root, 'TEMPLATE_UNKNOWN', 'Component template not found; use templates list.');

  const visit = (template: ComponentTemplate): unknown => ({
    id: template.id,
    name: template.name,
    atomicLevel: template.atomicLevel,
    templateType: template.templateType,
    children: template.children.map(child => ({
      slot: child.slot ?? null,
      optional: child.optional ?? false,
      template: visit(byId.get(child.template)!),
    })),
  });
  return visit(root);
}

export function componentTemplateCoverage(entries: readonly LoadedComponentTemplate[]) {
  const templates = entries.map(entry => entry.template);
  const atomic = ['atom', 'molecule', 'organism', 'template', 'page'];
  const types = ['component', 'component-with-children', 'page', 'page-with-bricks'];
  const atomicLevels = Object.fromEntries(atomic.map(level => [
    level,
    templates.filter(template => template.atomicLevel === level).length,
  ]));
  const templateTypes = Object.fromEntries(types.map(type => [
    type,
    templates.filter(template => template.templateType === type).length,
  ]));
  const categories = [...new Set(templates.map(template => template.category))].sort();
  const requiredCategories = ['Actions', 'Forms', 'Navigation', 'Data display', 'Feedback', 'Visualization', 'Layout', 'Pages'];
  const missingCategories = requiredCategories.filter(category => !categories.includes(category));
  const described = templates.filter(template =>
    Boolean(template.description && template.useWhen.length && template.accessibility.notes)).length;
  return {
    templates: templates.length,
    atomicLevels,
    templateTypes,
    categories,
    missingCategories,
    documentation: { described, complete: described === templates.length },
    references: {
      children: templates.reduce((sum, template) => sum + template.children.length, 0),
      valid: true,
    },
    baselineComplete: templates.length >= 40
      && Object.values(atomicLevels).every(value => Number(value) > 0)
      && missingCategories.length === 0
      && described === templates.length,
  };
}
