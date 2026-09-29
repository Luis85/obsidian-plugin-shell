import { operationCatalog } from './operations.ts';
const reference = { type: 'string', minLength: 1, description: 'Persisted ID or @alias created earlier in the same transaction.' };
const title = { type: 'string', minLength: 1, maxLength: 120 };
const choice = { oneOf: [
  { type: 'object', required: ['title'], additionalProperties: false, properties: { title } },
  { type: 'object', required: ['id'], additionalProperties: false, properties: { id: reference } },
] };
const properties: Record<string, unknown> = {
  kind: { enum: ['vault', 'api', 'database', 'entity', 'data-source'] },
  path: { type: 'string', pattern: '^/(?:[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*)?$' },
  parent: { oneOf: [reference, { type: 'null' }] }, from: reference, to: reference,
  pages: { type: 'array', minItems: 1, maxItems: 120, items: reference },
  properties: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false,
    required: ['key', 'type', 'required'], properties: { key: { type: 'string', minLength: 1, maxLength: 60 },
      type: { enum: ['text', 'number', 'checkbox', 'date', 'datetime', 'tags', 'list'] }, required: { type: 'boolean' } } } }, title, id: reference, page: reference, source: reference,
  layout: { enum: ['stack', 'row', 'grid'] }, direction: { enum: ['up', 'down'] },
  components: { type: 'array', minItems: 1, maxItems: 60, items: choice },
  action: { oneOf: [
    { type: 'object', required: ['kind'], additionalProperties: false, properties: { kind: { const: 'todo' } } },
    { type: 'object', required: ['kind', 'target'], additionalProperties: false, properties: { kind: { const: 'navigate' }, target: reference } },
    { type: 'object', required: ['kind', 'state'], additionalProperties: false, properties: { kind: { const: 'set-state' }, state: { enum: ['default', 'loading', 'empty', 'error', 'disabled'] } } },
  ] },
};
export const sketchSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Shell sketch transaction', type: 'object',
  additionalProperties: false, required: ['schemaVersion', 'operations'],
  properties: { schemaVersion: { const: 1 }, title: { ...title, maxLength: 80, description: 'Required only when creating a new project.' }, operations: {
    type: 'array', maxItems: 500, items: { oneOf: operationCatalog.map(item => ({ type: 'object', additionalProperties: false,
      required: ['op', ...item.fields.filter(field => field !== 'source')], properties: {
        op: { const: item.op }, as: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9-]*$', description: 'Creation operations only.' },
        ...Object.fromEntries(item.fields.map(field => [field, field === 'kind' ? { enum: item.op === 'brick.rename' ? ['entity', 'data-source'] : ['vault', 'api', 'database'] } : properties[field]])),
      } })) },
  } },
};
