import { requireSketch } from '#shared/contracts/sketch-errors.ts';
import type { ComponentTemplate, ComponentTemplateEntry, ComponentTemplateQuery } from '../domain/component-template.ts';

function same(value: string, expected?: string): boolean {
  return expected === undefined || value.toLowerCase() === expected.toLowerCase();
}

function searchableTemplateText(template: ComponentTemplate): string {
  return [template.id, template.name, template.category, template.description,
    ...template.tags, ...template.capabilities].join(' ').toLowerCase();
}

function matchesSearch(template: ComponentTemplate, needle?: string): boolean {
  return needle === undefined || searchableTemplateText(template).includes(needle);
}

function matchesExact(value: string, expected?: string): boolean {
  return expected === undefined || value === expected;
}

function includesSame(values: readonly string[], expected?: string): boolean {
  return expected === undefined || values.some(value => same(value, expected));
}

function matchesTemplateShape(template: ComponentTemplate, query: ComponentTemplateQuery, needle?: string): boolean {
  return [
    matchesSearch(template, needle),
    matchesExact(template.templateType, query.templateType),
    matchesExact(template.atomicLevel, query.atomicLevel),
  ].every(value => value);
}

function matchesTemplateMetadata(template: ComponentTemplate, query: ComponentTemplateQuery): boolean {
  return [
    same(template.category, query.category),
    includesSame(template.tags, query.tag),
    includesSame(template.recommendedFor, query.recommendedFor),
  ].every(value => value);
}

function matchesTemplate(template: ComponentTemplate, query: ComponentTemplateQuery, needle?: string): boolean {
  return matchesTemplateShape(template, query, needle) && matchesTemplateMetadata(template, query);
}
export function filterComponentTemplates(
  entries: readonly ComponentTemplateEntry[],
  query: ComponentTemplateQuery = {},
): ComponentTemplateEntry[] {
  const needle = query.query?.trim().toLowerCase();
  return entries.filter(entry => matchesTemplate(entry.template, query, needle));
}

export function componentTemplateSummary(entry: ComponentTemplateEntry) {
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

export function componentTemplateTree(entries: readonly ComponentTemplateEntry[], id: string) {
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

export function componentTemplateCoverage(entries: readonly ComponentTemplateEntry[]) {
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
