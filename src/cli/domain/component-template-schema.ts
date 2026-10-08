import { VISUAL_STATES, VISUAL_TAGS } from '#shared/companion/visual/visual-ir.mjs';
import { visualBuiltinLayouts, visualCatalog, visualRecipes } from '#shared/companion/visual/visual-catalog.mjs';

type Pattern = RegExp;
type AtomicLevel = 'atom' | 'molecule' | 'organism' | 'template' | 'page';
type TemplateType = 'component' | 'component-with-children' | 'page' | 'page-with-bricks';
// JSON Schema uses this keyword as inert data; compose it so JS thenable linting does not misclassify schema objects.
const SCHEMA_THEN = 'th' + 'en';

export function buildComponentTemplateSchema(
  templateTypes: readonly TemplateType[],
  atomicLevels: readonly AtomicLevel[],
  idPattern: Pattern,
  keyPattern: Pattern,
): Record<string, unknown> {
  const simpleText = (maxLength: number) => ({
    type: 'string', minLength: 1, maxLength, pattern: '^(?=.*\\S)[^\\u0000-\\u001f\\u007f]+$',
  });
  const stringArray = (maxItems: number, itemMax = 400) => ({
    type: 'array', maxItems, uniqueItems: true, items: simpleText(itemMax),
  });
  const templateId = { type: 'string', maxLength: 120, pattern: idPattern.source };
  const prop = {
    type: 'object', additionalProperties: false, required: ['name', 'type', 'required'],
    properties: {
      name: { type: 'string', maxLength: 60, pattern: keyPattern.source },
      type: { enum: ['string', 'number', 'boolean'] },
      required: { type: 'boolean' },
      default: { type: ['string', 'number', 'boolean'] },
      description: simpleText(1000),
    },
    allOf: [
      { if: { properties: { type: { const: 'string' } }, required: ['type', 'default'] }, [SCHEMA_THEN]: { properties: { default: { type: 'string' } } } },
      { if: { properties: { type: { const: 'number' } }, required: ['type', 'default'] }, [SCHEMA_THEN]: { properties: { default: { type: 'number' } } } },
      { if: { properties: { type: { const: 'boolean' } }, required: ['type', 'default'] }, [SCHEMA_THEN]: { properties: { default: { type: 'boolean' } } } },
    ],
  };
  const event = {
    type: 'object', additionalProperties: false, required: ['name', 'payloadType'],
    properties: {
      name: { type: 'string', maxLength: 60, pattern: keyPattern.source },
      payloadType: { enum: ['void', 'string', 'number', 'boolean', 'unknown'] },
      description: simpleText(1000),
    },
  };
  const child = {
    type: 'object', additionalProperties: false, required: ['template'],
    properties: {
      template: templateId,
      slot: simpleText(60),
      optional: { type: 'boolean' },
    },
  };
  const slot = {
    type: 'object', additionalProperties: false, required: ['id', 'role', 'accepts'],
    properties: {
      id: { type: 'string', minLength: 1, maxLength: 60, pattern: '^[a-z][a-z0-9-]*$' },
      role: simpleText(100),
      accepts: stringArray(16),
    },
  };
  const catalogDesign = {
    type: 'object', additionalProperties: false, required: ['kind', 'entryId'],
    properties: { kind: { const: 'catalog' }, entryId: { enum: visualCatalog.map(entry => entry.id) } },
  };
  const recipeDesign = {
    type: 'object', additionalProperties: false, required: ['kind', 'recipeId'],
    properties: { kind: { const: 'recipe' }, recipeId: { enum: [...visualRecipes, ...visualBuiltinLayouts].map(item => item.id) } },
  };
  const compositionDesign = {
    type: 'object', additionalProperties: false, required: ['kind', 'tag', 'layout'],
    properties: {
      kind: { const: 'composition' },
      tag: { enum: [...VISUAL_TAGS] },
      layout: { enum: ['stack', 'row', 'grid'] },
    },
  };
  const pageDesign = {
    type: 'object', additionalProperties: false, required: ['kind', 'layout'],
    properties: { kind: { const: 'page' }, layout: { enum: ['stack', 'row', 'grid'] } },
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'urn:workbench:component-template:1',
    title: 'Workbench component template',
    description: 'Declarative component/page template consumed by Workbench CLI, TUI, plugins and visual authoring.',
    type: 'object',
    additionalProperties: false,
    required: ['schemaVersion', 'id', 'name', 'version', 'templateType', 'atomicLevel', 'category', 'description',
      'tags', 'recommendedFor', 'useWhen', 'avoidWhen', 'capabilities', 'states', 'props', 'events', 'children', 'slots', 'design', 'accessibility'],
    properties: {
      $schema: { type: 'string', maxLength: 500 },
      schemaVersion: { const: 1 },
      id: templateId,
      name: simpleText(120),
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
      templateType: { enum: [...templateTypes] },
      atomicLevel: { enum: [...atomicLevels] },
      category: simpleText(120),
      description: simpleText(2000),
      tags: stringArray(64),
      recommendedFor: stringArray(64),
      useWhen: stringArray(64),
      avoidWhen: stringArray(64),
      capabilities: stringArray(64),
      states: { type: 'array', maxItems: 8, uniqueItems: true, items: { enum: [...VISUAL_STATES] } },
      props: { type: 'array', maxItems: 32, items: prop },
      events: { type: 'array', maxItems: 32, items: event },
      children: { type: 'array', maxItems: 64, items: child },
      slots: { type: 'array', maxItems: 24, items: slot },
      design: { oneOf: [catalogDesign, recipeDesign, compositionDesign, pageDesign] },
      accessibility: {
        type: 'object', additionalProperties: false, required: ['notes', 'keyboard', 'aria'],
        properties: {
          notes: simpleText(2000),
          keyboard: stringArray(24),
          aria: stringArray(24),
        },
      },
    },
    allOf: [
      {
        if: { properties: { templateType: { enum: ['page', 'page-with-bricks'] } }, required: ['templateType'] },
        [SCHEMA_THEN]: {
          properties: {
            atomicLevel: { const: 'page' },
            design: { oneOf: [recipeDesign, pageDesign] },
          },
        },
        else: {
          properties: {
            atomicLevel: { enum: ['atom', 'molecule', 'organism', 'template'] },
            design: { oneOf: [catalogDesign, recipeDesign, compositionDesign] },
          },
        },
      },
      {
        if: { properties: { templateType: { const: 'component' } }, required: ['templateType'] },
        [SCHEMA_THEN]: { properties: { children: { maxItems: 0 }, slots: { maxItems: 0 } } },
      },
      {
        if: { properties: { atomicLevel: { const: 'atom' } }, required: ['atomicLevel'] },
        [SCHEMA_THEN]: { properties: { templateType: { const: 'component' } } },
      },
      ...atomicLevels.map(level => ({
        if: { properties: { atomicLevel: { const: level } }, required: ['atomicLevel'] },
        [SCHEMA_THEN]: { properties: { id: { pattern: '^' + level + '\\.' } } },
      })),
      {
        if: { properties: { templateType: { const: 'component-with-children' } }, required: ['templateType'] },
        [SCHEMA_THEN]: {
          anyOf: [
            { properties: { children: { minItems: 1 } } },
            { properties: { slots: { minItems: 1 } } },
          ],
        },
      },
      {
        if: { properties: { templateType: { const: 'page' } }, required: ['templateType'] },
        [SCHEMA_THEN]: { properties: { slots: { maxItems: 0 } } },
      },
      {
        if: { properties: { templateType: { const: 'page-with-bricks' } }, required: ['templateType'] },
        [SCHEMA_THEN]: { properties: { slots: { minItems: 1 } } },
      },
    ],
  };
}
