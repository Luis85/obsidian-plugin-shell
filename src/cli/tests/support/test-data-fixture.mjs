// Shared immutable test inputs: no endpoints, credentials or user data.
export function fixtureManifest() {
  const schema = { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, title: { type: 'string' }, completed: { type: 'boolean', default: false } }, required: ['id', 'title', 'completed'], additionalProperties: false };
  const manifest = { schema: 1, engine: 'shell-fixtures/1', target: '.test-vault', seed: 42, count: 3, locale: 'en', referenceDate: '2026-01-01T00:00:00.000Z', entities: [], operations: [] };
  const base = { source: 'tasks', kind: 'api', direction: 'read', method: 'GET', resource: '/tasks', input: { none: true }, output: { schema: { type: 'array', items: schema } }, behavior: 'list', dataset: 'tasks', keyField: 'id', scenario: 'populated', latencyMs: 0, errorStatus: 503, rules: [] };
  manifest.operations = [
    { ...base, id: 'ds-operation-1', slug: 'list-tasks' },
    { ...base, id: 'ds-operation-2', slug: 'save-task', direction: 'write', method: 'POST', input: { schema }, output: { none: true }, behavior: 'upsert' },
    { ...base, id: 'ds-operation-3', slug: 'delete-task', direction: 'write', method: 'DELETE', input: { schema: { type: 'object', properties: { id: schema.properties.id }, required: ['id'], additionalProperties: false } }, output: { none: true }, behavior: 'delete' },
    { ...base, id: 'ds-operation-4', slug: 'seed-notes', source: 'vault', kind: 'vault', method: 'adapter', resource: 'Records/Tasks', behavior: 'fixture' },
  ];
  return structuredClone(manifest);
}
export function entityManifest() {
  const manifest = fixtureManifest();
  const properties = { id: { type: 'string', format: 'uuid' }, type: { type: 'string', const: 'person' }, name: { type: 'string' }, email: { type: 'string', format: 'email' }, mentor: { type: 'string' }, friends: { type: 'array', items: { type: 'string' } } };
  const schema = { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
  manifest.entities = [{ id: 'er-entity-1', slug: 'person', folder: 'Records/People', schema, relationships: [{ key: 'mentor', target: 'er-entity-1', many: false }, { key: 'friends', target: 'er-entity-1', many: true }] }];
  const op = manifest.operations[3]; op.resource = 'Records/People'; op.output = { entity: 'er-entity-1', many: true, schema: { type: 'array', items: schema } }; manifest.operations = [op];
  return manifest;
}
