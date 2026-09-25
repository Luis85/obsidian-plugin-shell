/** Shared deterministic fixture engine. Pure data in/out; never executes expressions or I/O. */
export function createFixtureEngine() {
  const version = 'shell-fixtures/1';
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const key = value => typeof value === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
  const slug = value => typeof value === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) && value.length <= 60;
  const fail = message => { throw new Error(message); };
  function folder(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 180 && value.split('/').every(part => /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(part));
  }
  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
    return value >>> 0;
  }
  function schemaValid(s, depth = 0, budget = { count: 0 }) {
    if (!plain(s) || depth > 6 || ++budget.count > 160) return false;
    const allowed = ['type', 'properties', 'required', 'additionalProperties', 'items', 'description', 'format', 'enum', '$schema', 'const', 'default'];
    if (Object.keys(s).some(k => !allowed.includes(k))) return false;
    const types = Array.isArray(s.type) ? s.type : [s.type];
    if (!types.length || types.some(t => !['string', 'number', 'integer', 'boolean', 'null', 'object', 'array'].includes(t))) return false;
    if (types.length > 1 && types.some(t => ['object', 'array'].includes(t))) return false;
    if (s.format && (s.type !== 'string' || !['date', 'date-time', 'uuid', 'email', 'uri'].includes(s.format))) return false;
    if (s.type === 'object') {
      if (!plain(s.properties) || Object.keys(s.properties).length > 80 || !Object.entries(s.properties).every(([k, v]) => key(k) && schemaValid(v, depth + 1, budget))) return false;
      if (!Array.isArray(s.required) || !s.required.every(k => Object.hasOwn(s.properties, k))) return false;
    }
    if (s.type === 'array' && !schemaValid(s.items, depth + 1, budget)) return false;
    if (s.enum && (!Array.isArray(s.enum) || !s.enum.length || s.enum.length > 30)) return false;
    return true;
  }
  function matches(value, s, depth = 0) {
    if (!s || depth > 7) return false;
    if (Object.hasOwn(s, 'const') && JSON.stringify(value) !== JSON.stringify(s.const)) return false;
    if (s.enum && !s.enum.some(v => JSON.stringify(v) === JSON.stringify(value))) return false;
    if (Array.isArray(s.type)) return s.type.some(type => matches(value, { ...s, type }, depth + 1));
    if (s.type === 'null') return value === null;
    if (s.type === 'boolean') return typeof value === 'boolean';
    if (s.type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (s.type === 'integer') return Number.isSafeInteger(value);
    if (s.type === 'array') return Array.isArray(value) && value.length <= 500 && value.every(v => matches(v, s.items, depth + 1));
    if (s.type === 'object') return plain(value) && Object.keys(value).length <= 100 && (s.required || []).every(k => Object.hasOwn(value, k)) && Object.entries(value).every(([k, v]) => key(k) && (s.properties[k] ? matches(v, s.properties[k], depth + 1) : s.additionalProperties !== false));
    if (typeof value !== 'string' || value.length > 10000) return false;
    if (s.format === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
    if (s.format === 'date-time') return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
    if (s.format === 'uuid') return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (s.format === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (s.format === 'uri') { try { return new URL(value).protocol === 'https:'; } catch { return false; } }
    return true;
  }
  function validate(manifest) {
    if (!plain(manifest) || manifest.schema !== 1 || manifest.engine !== version || manifest.target !== '.test-vault') fail('Unsupported test-data manifest or target.');
    if (!Number.isSafeInteger(manifest.seed) || manifest.seed < 0 || manifest.seed > 2147483647 || !Number.isInteger(manifest.count) || manifest.count < 1 || manifest.count > 100) fail('Use a seed from 0 to 2147483647 and 1–100 records.');
    if (!['en', 'de'].includes(manifest.locale) || !/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(manifest.referenceDate) || Number.isNaN(Date.parse(manifest.referenceDate)) || new Date(manifest.referenceDate).toISOString() !== manifest.referenceDate) fail('Choose a supported locale and a fixed UTC reference date.');
    if (!Array.isArray(manifest.entities) || manifest.entities.length > 60 || !Array.isArray(manifest.operations) || manifest.operations.length > 288) fail('Fixture inventory exceeds its bounded limit.');
    if (manifest.noteMetadata !== undefined && (!plain(manifest.noteMetadata) || Object.keys(manifest.noteMetadata).sort().join(',') !== 'created_at,schema_version' || manifest.noteMetadata.schema_version !== 1 || manifest.noteMetadata.created_at !== manifest.referenceDate)) fail('Invalid canonical note metadata.');
    const entities = new Map();
    for (const e of manifest.entities) {
      if (!slug(e.id) || entities.has(e.id) || !slug(e.slug) || !folder(e.folder) || !schemaValid(e.schema) || e.schema.type !== 'object') fail('Invalid entity fixture contract.');
      if (manifest.noteMetadata && ['schema_version','created_at'].some(key => Object.hasOwn(e.schema.properties,key))) fail('Canonical note metadata collides with an authored field.');
      if (!Array.isArray(e.relationships) || e.relationships.length > 160 || !e.relationships.every(r => key(r.key) && slug(r.target) && typeof r.many === 'boolean')) fail('Invalid fixture relationship.');
      entities.set(e.id, e);
    }
    for (const e of entities.values()) for (const r of e.relationships) if (!entities.has(r.target)) fail('A fixture relationship target is missing.');
    const ids = new Set(), names = new Set();
    for (const op of manifest.operations) {
      if (!slug(op.source) || !slug(op.slug) || !slug(op.id) || ids.has(op.id) || !['api', 'database', 'vault'].includes(op.kind) || !['read', 'write', 'both'].includes(op.direction)) fail('Invalid source operation.');
      if (!['fixture', 'list', 'upsert', 'delete'].includes(op.behavior) || !slug(op.dataset) || !key(op.keyField) || !['populated', 'empty', 'error', 'slow'].includes(op.scenario)) fail('Invalid fixture recipe.');
      if (!Number.isInteger(op.latencyMs) || op.latencyMs < 0 || op.latencyMs > 5000 || !Number.isInteger(op.errorStatus) || op.errorStatus < 400 || op.errorStatus > 599) fail('Invalid simulated failure or delay.');
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'adapter'].includes(op.method)) fail('Invalid test method.');
      if (typeof op.resource !== 'string' || op.resource.length > 240 || /[\\\x00-\x1f?#]/.test(op.resource) || op.resource.split('/').some(p => ['..', '.'].includes(p))) fail('Invalid test resource.');
      if (op.kind === 'api' && (!/^\/[a-zA-Z0-9_\-/{},.]*$/.test(op.resource) || op.method === 'adapter')) fail('API simulation needs an HTTP method and absolute resource path.');
      if (op.kind !== 'api' && op.method !== 'adapter') fail('Non-API operations use an application adapter.');
      for (const side of ['input', 'output']) {
        const s = op[side];
        if (!plain(s) || (s.none !== true && !schemaValid(s.schema)) || s.entity && !entities.has(s.entity)) fail('Declare complete input and output shapes before generating.');
      }
      if (op.scenario === 'empty' && op.kind !== 'vault' && !op.output.none && op.output.schema.type !== 'array') fail('Empty responses require a collection output; use the error scenario for a missing single record.');
      if (op.method === 'HEAD' && !op.output.none) fail('HEAD operations must declare no output payload.');
      if (op.kind === 'api') {
        const segments = op.resource.split('/').slice(1), params = segments.filter(v => /^\{[a-zA-Z][a-zA-Z0-9_]*\}$/.test(v)).map(v => v.slice(1, -1));
        if (segments.some(v => !/^[a-zA-Z0-9_,.-]*$/.test(v) && !/^\{[a-zA-Z][a-zA-Z0-9_]*\}$/.test(v)) || new Set(params).size !== params.length) fail('Mock path parameters must occupy a complete unique path segment.');
        if (params.length && (op.input.none || op.input.schema.type !== 'object' || params.some(k => !op.input.schema.properties[k] || !['string', 'number', 'integer', 'boolean'].includes(op.input.schema.properties[k].type)))) fail('Every mock path parameter needs a declared scalar input property.');
        if (['GET', 'HEAD'].includes(op.method) && !op.input.none && op.input.schema.type !== 'object') fail('HTTP query inputs must be an object of named fields.');
        if (['GET', 'HEAD'].includes(op.method) && ['upsert', 'delete'].includes(op.behavior)) fail('Safe HTTP methods cannot mutate a test dataset.');
      }
      if (op.behavior === 'list' && (op.output.none || op.output.schema.type !== 'array' || !op.input.none)) fail('List behavior needs a collection output and no input; custom filtering is not inferred.');
      if (['upsert', 'delete'].includes(op.behavior) && (op.input.none || op.input.schema.type !== 'object' || !op.input.schema.properties[op.keyField])) fail('Write behavior needs an object input containing the declared key.');
      if (op.behavior !== 'fixture' && op.direction === 'read' && op.behavior !== 'list') fail('Read-only recipes cannot mutate a test dataset.');
      if (op.noteEntity !== undefined && (op.kind !== 'vault' || !entities.has(op.noteEntity) || entities.get(op.noteEntity).folder !== op.resource || !manifest.noteMetadata)) fail('Invalid canonical note fixture mapping.');
      if (op.kind === 'vault' && !folder(op.resource)) fail('Vault fixtures need an explicit safe note folder.');
      if (!Array.isArray(op.rules) || op.rules.length > 80) fail('Invalid generator rules.');
      const paths = new Set();
      for (const r of op.rules) {
        if (!['input', 'output'].includes(r.side) || typeof r.path !== 'string' || r.path.length > 200 || !/^(\/(?:[a-zA-Z][a-zA-Z0-9_-]*|\*))*$/.test(r.path) || paths.has(r.side + r.path)) fail('Invalid or duplicate field rule.');
        if (!['auto', 'sequence', 'name', 'email', 'integer', 'boolean', 'date', 'uuid', 'literal'].includes(r.provider) || typeof r.argument !== 'string' || r.argument.length > 1000) fail('Unsupported generator provider.');
        if (op[r.side].entity && r.provider !== 'auto') fail('Entity values are shared across sources: define their defaults in Entities. Operation overrides apply to custom DTO shapes.');
        let node = op[r.side].schema;
        for (const segment of r.path.split('/').slice(1)) node = segment === '*' ? node?.items : node?.properties?.[segment];
        if (!node) fail('A generator rule references a removed field. Reopen its recipe.');
        paths.add(r.side + r.path);
      }
      if (names.has(op.source + '/' + op.slug)) fail('Duplicate operation method name.');
      names.add(op.source + '/' + op.slug); ids.add(op.id);
    }
    return manifest;
  }
  function scalar(s, context, rule, provider) {
    const n = hash(context.token), name = context.path.split('/').at(-1) || 'value';
    if (rule?.provider === 'literal') { try { return JSON.parse(rule.argument); } catch { fail('Literal generators need a valid JSON value.'); } }
    if (Object.hasOwn(s, 'const')) return copy(s.const);
    if (Object.hasOwn(s, 'default') && (!rule || rule.provider === 'auto')) return copy(s.default);
    if (s.enum) return copy(s.enum[n % s.enum.length]);
    const type = Array.isArray(s.type) ? s.type.find(t => t !== 'null') || 'null' : s.type;
    const selected = rule?.provider && rule.provider !== 'auto' ? rule.provider : s.format || (type === 'string' && /email/i.test(name) ? 'email' : type === 'string' && /name/i.test(name) ? 'name' : type);
    if (provider && ['name', 'email'].includes(selected)) return provider({ ...context, seed: n, kind: selected });
    if (selected === 'sequence') return (rule.argument || name + '-') + String(context.index + 1).padStart(4, '0');
    if (selected === 'uuid' || name === 'id' && type === 'string') {
      const h = Array.from({ length: 4 }, (_, i) => hash(context.token + ':' + i).toString(16).padStart(8, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20)}`;
    }
    if (selected === 'email') return `fixture-${n.toString(36)}@example.invalid`;
    if (selected === 'name') return (context.locale === 'de' ? ['Alex', 'Mika', 'Kim', 'Lena'] : ['Alex', 'Jordan', 'Casey', 'Sam'])[n % 4] + ' Example ' + (context.index + 1);
    if (selected === 'date' || selected === 'date-time') { const date = new Date(Date.parse(context.referenceDate) + (n % 365) * 86400000).toISOString(); return selected === 'date' ? date.slice(0, 10) : date; }
    if (selected === 'uri') return `https://example.invalid/fixture/${n}`;
    if (selected === 'boolean') return n % 2 === 0;
    if (selected === 'number' || selected === 'integer') return selected === 'integer' ? n % 10000 : (n % 100000) / 100;
    if (selected === 'null') return null;
    return `${name}-${(context.index + 1).toString().padStart(4, '0')}-${n.toString(36)}`;
  }
  function value(s, context, rules, provider, budget) {
    if (++budget.values > 200000) fail('Fixture expansion exceeds 200,000 values. Reduce count or simplify nested arrays.');
    const rule = rules.find(r => r.path === context.path && r.side === context.side);
    if (rule?.provider === 'literal' || Object.hasOwn(s, 'const') || Object.hasOwn(s, 'default') && (!rule || rule.provider === 'auto') || s.enum) return scalar(s, context, rule, provider);
    if (s.type === 'object') return Object.fromEntries(Object.entries(s.properties).map(([k, field]) => [k, value(field, { ...context, path: context.path + '/' + k, token: context.token + '/' + k }, rules, provider, budget)]));
    if (s.type === 'array') return Array.from({ length: 2 }, (_, i) => value(s.items, { ...context, index: i, path: context.path + '/*', token: context.token + '/' + i }, rules, provider, budget));
    return scalar(s, context, rule, provider);
  }
  function generate(input, options = {}) {
    const m = validate(copy(input)), budget = { values: 0, bytes: 0 }, files = new Map(), pools = new Map(), entityMap = new Map(m.entities.map(e => [e.id, e]));
    const context = (token, index, side = 'output') => ({ token: `${m.seed}|${token}|${index}`, index, path: '', side, locale: m.locale, referenceDate: m.referenceDate });
    const notePath = (e, i) => `${e.folder}/fixture-${e.slug}-${String(i + 1).padStart(4, '0')}.md`;
    function put(path, content, owner) {
      if ([...files.keys()].some(p => p !== path && p.toLowerCase() === path.toLowerCase())) fail('Case-insensitive fixture collision.');
      if (files.has(path) && files.get(path).content !== content) fail('Fixture file collision: ' + path);
      if (!files.has(path)) budget.bytes += new TextEncoder().encode(content).length;
      if (files.size >= 3000 && !files.has(path) || budget.bytes > 5000000) fail('Fixture preview exceeds 3,000 files or 5 MB. Reduce record count or enabled recipes.');
      files.set(path, { path, content, owner });
    }
    for (const e of m.entities) pools.set(e.id, Array.from({ length: m.count }, (_, i) => value(e.schema, context(e.id, i), [], options.provider, budget)));
    // Allocate every identity first; cyclic/self relationships do not recurse.
    for (const e of m.entities) pools.get(e.id).forEach((record, i) => {
      for (const r of e.relationships) {
        const target = entityMap.get(r.target), link = '[[' + notePath(target, i).slice(0, -3) + ']]';
        record[r.key] = r.many ? [link] : link;
      }
      if (!matches(record, e.schema)) fail('Generated entity violates its declared property types: ' + e.slug);
    });
    const needed = new Set();
    function requireEntity(id) { if (needed.has(id)) return; needed.add(id); for (const r of entityMap.get(id).relationships) requireEntity(r.target); }
    function payload(op, side) {
      const shape = op[side]; if (shape.none) return undefined;
      if (shape.entity) return copy(shape.many ? pools.get(shape.entity) : pools.get(shape.entity)[0]);
      const c = context(op.source + ':' + op.id + ':' + side, 0, side);
      return shape.schema.type === 'array' ? Array.from({ length: m.count }, (_, i) => value(shape.schema.items, { ...c, index: i, path: '/*', token: c.token + '/' + i }, op.rules, options.provider, budget)) : value(shape.schema, c, op.rules, options.provider, budget);
    }
    const operations = m.operations.map(op => {
      const inputValue = payload(op, 'input'); let outputValue = payload(op, 'output');
      if (op.scenario === 'empty' && !op.output.none && op.output.schema.type === 'array') outputValue = [];
      for (const [side, generated] of [['input', inputValue], ['output', outputValue]]) if (!op[side].none && !matches(generated, op[side].schema)) fail('Generated ' + side + ' does not match ' + op.source + '/' + op.slug + '. Check its field rules.');
      const base = `.fixtures/${op.source}/${op.slug}`;
      for (const [side, generated] of [['input', inputValue], ['output', outputValue]]) if (generated !== undefined) put(base + '-' + side + '.json', JSON.stringify(generated, null, 2) + '\n', op.id);
      if (op.kind === 'vault' && !['empty', 'error'].includes(op.scenario)) {
        const side = op.direction === 'write' ? 'input' : 'output', shape = op[side];
        if (shape.none) fail('Vault recipe has no record payload.');
        if (op.noteEntity) { requireEntity(op.noteEntity); } else if (shape.entity) {
          if (entityMap.get(shape.entity).folder !== op.resource) fail('Vault operation folder and entity folder differ. Declare one explicit folder before seeding.');
          requireEntity(shape.entity);
        } else {
          const records = Array.isArray(side === 'input' ? inputValue : outputValue) ? (side === 'input' ? inputValue : outputValue) : [side === 'input' ? inputValue : outputValue];
          records.forEach((r, i) => put(`${op.resource}/fixture-${op.source}-${op.slug}-${String(i + 1).padStart(4, '0')}.md`, markdown(r), op.id));
        }
      }
      return { ...op, inputValue, outputValue };
    });
    for (const id of needed) pools.get(id).forEach((record, i) => put(notePath(entityMap.get(id), i), markdown(m.noteMetadata ? { ...record, ...m.noteMetadata } : record), id));
    const items = [...files.values()].sort((a, b) => a.path.localeCompare(b.path, 'en'));
    const lower = new Set(); let bytes = 0;
    for (const file of items) { if (lower.has(file.path.toLowerCase())) fail('Case-insensitive output collision.'); lower.add(file.path.toLowerCase()); bytes += new TextEncoder().encode(file.content).length; }
    if (items.length > 3000 || bytes > 5000000) fail('Fixture preview exceeds 3,000 files or 5 MB. Reduce record count or enabled recipes.');
    return { engine: version, seed: m.seed, count: m.count, locale: m.locale, referenceDate: m.referenceDate, files: items, operations, bytes, provider: options.providerName || 'builtin-v1' };
  }
  function markdown(record) {
    const scalarValue = v => v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v);
    if (!plain(record) || !Object.entries(record).every(([k, v]) => key(k) && (scalarValue(v) || Array.isArray(v) && v.every(scalarValue)))) fail('Vault notes need a flat object of Obsidian-compatible scalar/list properties. Nested DTOs need an explicit mapping.');
    return '---\n' + Object.entries(record).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join('\n') + '\n---\n\nSynthetic test fixture. Do not use as production data.\n';
  }
  return Object.freeze({ version, validate, generate, matches, markdown });
}
