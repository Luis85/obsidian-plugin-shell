/** Shared browser/compiler translation. This module describes fixtures; it performs no I/O. */
const fixtureDefaults = { schema: 1, seed: 42, referenceDate: '2026-01-01T00:00:00.000Z', locale: 'en', count: 12, recipes: [] };
const fixtureProviders = ['auto', 'sequence', 'name', 'email', 'integer', 'boolean', 'date', 'uuid', 'literal'];
function fixtureRequire(ok, message) { if (!ok) throw new Error('FIXTURE_CONTRACT: ' + message); }
function fixtureCopy(value, depth = 0, budget = { count: 0 }) {
  fixtureRequire(depth <= 40 && ++budget.count <= 120000, 'Input limit exceeded.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') { fixtureRequire(Number.isFinite(value), 'Invalid number.'); return value; }
  fixtureRequire(value && typeof value === 'object' && (Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value))), 'Only JSON data is supported.');
  const result = Array.isArray(value) ? [] : {};
  const keys = Reflect.ownKeys(value);
  fixtureRequire(!Array.isArray(value) || value.length <= 120000 && keys.length === value.length + 1, 'Sparse or oversized arrays are not supported.');
  for (const key of keys) {
    if (Array.isArray(value) && key === 'length') continue;
    fixtureRequire(typeof key === 'string' && (!Array.isArray(value) || /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < value.length), 'Only JSON keys are supported.');
    const field = Object.getOwnPropertyDescriptor(value, key);
    fixtureRequire(!['__proto__', 'constructor', 'prototype'].includes(key) && field && field.enumerable && 'value' in field, 'Unsafe data property.');
    // Unsaved optional browser fields use undefined; portable JSON omits these object members.
    if (field.value === undefined && !Array.isArray(value)) continue;
    result[key] = fixtureCopy(field.value, depth + 1, budget);
  }
  fixtureRequire(!Array.isArray(value) || result.length === value.length, 'Sparse arrays are not supported.');
  return result;
}
function fixtureKeys(value, keys) { return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)); }
function fixtureSettings(testing, sources) {
  fixtureRequire(fixtureKeys(testing, ['schema', 'seed', 'referenceDate', 'locale', 'count', 'recipes']) && testing.schema === 1, 'Unsupported recipe collection.');
  fixtureRequire(Number.isSafeInteger(testing.seed) && testing.seed >= 0 && testing.seed <= 2147483647 && Number.isInteger(testing.count) && testing.count >= 1 && testing.count <= 100 && ['en', 'de'].includes(testing.locale), 'Invalid seed, count or locale.');
  fixtureRequire(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(testing.referenceDate) && Number.isFinite(Date.parse(testing.referenceDate)) && new Date(testing.referenceDate).toISOString() === testing.referenceDate, 'Use a fixed UTC reference date.');
  fixtureRequire(Array.isArray(testing.recipes) && testing.recipes.length <= 288, 'Too many recipes.');
  const seen = new Set();
  for (const recipe of testing.recipes) {
    fixtureRequire(fixtureKeys(recipe, ['source', 'operation', 'enabled', 'behavior', 'dataset', 'keyField', 'scenario', 'latencyMs', 'errorStatus', 'rules']), 'Invalid recipe fields.');
    const source = sources.find(s => s.id === recipe.source);
    fixtureRequire(source?.operations.some(op => op.id === recipe.operation) && !seen.has(recipe.operation), 'Missing or duplicate recipe operation.'); seen.add(recipe.operation);
    fixtureRequire(typeof recipe.enabled === 'boolean' && ['fixture', 'list', 'upsert', 'delete'].includes(recipe.behavior) && /^[a-z][a-z0-9-]*$/.test(recipe.dataset) && /^[A-Za-z][A-Za-z0-9_]*$/.test(recipe.keyField) && !['constructor', 'prototype'].includes(recipe.keyField), 'Invalid recipe behavior or identity.');
    fixtureRequire(['populated', 'empty', 'error', 'slow'].includes(recipe.scenario) && Number.isInteger(recipe.latencyMs) && recipe.latencyMs >= 0 && recipe.latencyMs <= 5000 && Number.isInteger(recipe.errorStatus) && recipe.errorStatus >= 400 && recipe.errorStatus <= 599, 'Invalid recipe scenario.');
    fixtureRequire(Array.isArray(recipe.rules) && recipe.rules.length <= 80, 'Too many field rules.');
    const paths = new Set();
    for (const rule of recipe.rules) {
      const key = rule.side + ':' + rule.path;
      fixtureRequire(fixtureKeys(rule, ['side', 'path', 'provider', 'argument']) && ['input', 'output'].includes(rule.side) && typeof rule.path === 'string' && rule.path.length <= 200 && fixtureProviders.includes(rule.provider) && typeof rule.argument === 'string' && rule.argument.length <= 1000 && !paths.has(key), 'Invalid or duplicate field rule.'); paths.add(key);
    }
    fixtureRequire(!recipe.enabled || source.status !== 'deprecated', 'Disable recipes for deprecated sources.');
  }
}
function fixtureEntity(entity, semantic) {
  const relationships = semantic.relationships.filter(r => r.source === entity.id);
  const fields = [...entity.properties, ...relationships.map(r => ({ key: r.key, type: r.targetCard.endsWith('*') ? 'list' : 'text', required: r.targetCard.startsWith('1'), relationship: r.id }))];
  const properties = { id: { type: 'string', format: 'uuid' }, type: { type: 'string', const: entity.slug } };
  for (const field of fields) {
    fixtureRequire(!Object.hasOwn(properties, field.key), 'Duplicate entity property.');
    const type = { text: 'string', number: 'number', checkbox: 'boolean', date: 'string', datetime: 'string', tags: 'array', list: 'array' }[field.type];
    fixtureRequire(type, 'Unsupported entity field.'); const schema = { type };
    if (type === 'array') schema.items = { type: field.type === 'list' && !field.relationship ? ['string', 'number'] : 'string' };
    if (field.type === 'date') schema.format = 'date';
    if (field.type === 'datetime') schema.format = 'date-time';
    if (Object.hasOwn(field, 'defaultValue')) schema.default = field.defaultValue;
    properties[field.key] = schema;
  }
  return { id: entity.id, slug: entity.slug, folder: entity.folder, schema: { type: 'object', properties, required: ['id', 'type', ...fields.filter(f => f.required).map(f => f.key)], additionalProperties: false }, relationships: relationships.map(r => ({ key: r.key, target: r.target, many: r.targetCard.endsWith('*') })) };
}
function fixtureShape(shape, entities) {
  fixtureRequire(shape && !['unspecified', undefined].includes(shape.mode), 'Declare every enabled operation shape.');
  if (shape.mode === 'none') return { none: true };
  if (shape.mode === 'entity') {
    const entity = entities.find(e => e.id === shape.entity); fixtureRequire(entity, 'Missing fixture entity.');
    return { entity: shape.entity, many: shape.many, schema: shape.many ? { type: 'array', items: entity.schema } : entity.schema };
  }
  let schema = shape.schema;
  if (shape.mode === 'fields') {
    schema = { type: 'object', properties: Object.fromEntries(shape.fields.map(f => [f.name, f.type === 'array' ? { type: 'array', items: { type: f.listItems || 'string' } } : f.type === 'object' ? { type: 'object', properties: {}, required: [], additionalProperties: true } : { type: f.type }])), required: shape.fields.filter(f => f.required).map(f => f.name), additionalProperties: true };
    if (shape.many) schema = { type: 'array', items: schema };
  } else fixtureRequire(shape.mode === 'schema', 'Unsupported fixture shape.');
  function normalize(s) {
    fixtureRequire(s && typeof s === 'object', 'Missing fixture schema.');
    if (s.type === 'object') { s.properties = Object.fromEntries(Object.entries(s.properties ?? {}).map(([key, child]) => [key, normalize(child)])); s.required ??= []; }
    if (s.type === 'array') s.items = normalize(s.items);
    return s;
  }
  return { schema: normalize(schema) };
}
export function buildCompanionFixtureManifest(design) {
  design = fixtureCopy(design);
  const sources = design.dataSources?.sources ?? [], settings = design.dataSources?.testing ?? fixtureDefaults;
  fixtureSettings(settings, sources);
  const semantic = design.semantic ?? { entities: [], relationships: [] }, entities = semantic.entities.map(e => fixtureEntity(e, semantic));
  const operations = settings.recipes.filter(r => r.enabled).map(recipe => {
    const source = sources.find(s => s.id === recipe.source), operation = source.operations.find(o => o.id === recipe.operation);
    const native = operation.implementation;
    if (native) fixtureRequire(source.kind === 'vault' && native.kind === 'note' && ['list','create','update','delete'].includes(native.operation) && entities.some(e=>e.id===native.entity && e.folder===operation.resource), 'Invalid native fixture declaration.');
    return { ...(native ? {noteEntity:native.entity} : {}), id: operation.id, source: source.slug, slug: operation.slug, kind: source.kind, direction: operation.direction, method: operation.method, resource: operation.resource || (source.kind === 'api' ? '/' : ''), input: fixtureShape(operation.input, entities), output: fixtureShape(operation.output, entities), behavior: recipe.behavior, dataset: recipe.dataset, keyField: recipe.keyField, scenario: recipe.scenario, latencyMs: recipe.latencyMs, errorStatus: recipe.errorStatus, rules: recipe.rules };
  });
  return { schema: 1, engine: 'shell-fixtures/1', target: '.test-vault', noteMetadata: {schema_version:1,created_at:settings.referenceDate}, seed: settings.seed, count: settings.count, locale: settings.locale, referenceDate: settings.referenceDate, entities, operations };
}
