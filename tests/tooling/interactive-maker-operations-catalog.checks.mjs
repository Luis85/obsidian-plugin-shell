const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { capabilityCatalog, validateCatalog, validateCatalogParity, catalogDigest } from '../../bin/adapters/operations/catalog.ts';
import { handleRequest, validateMessage, protocolHandlers } from '../../bin/adapters/operations/protocol.ts';

// Drives the data-only capability catalog and discovery protocol (bin/adapters/operations) under the maker floors.
const request = (operation = 'capabilities.read', extra = {}) => ({ protocolVersion: 1, type: 'request', requestId: 'probe-1', operation, input: {}, ...extra });
const mutated = mutate => { const value = structuredClone(capabilityCatalog()); mutate(value); return value; };
const rejects = (mutate, code) => assert.throws(() => validateCatalog(mutated(mutate)), { message: code });
const cliOperation = value => value.operations.find(item => item.cli);
const plannedOperation = value => value.operations.find(item => item.status === 'planned');
const firstSchema = value => value.operations[0].inputSchema;

test('the shipped catalog validates, digests deterministically and matches the protocol handlers', () => {
  const catalog = capabilityCatalog();
  assert.equal(validateCatalog(catalog), true);
  assert.match(catalogDigest(), /^[a-f0-9]{64}$/); assert.equal(catalogDigest(catalog), catalogDigest());
  assert.equal(validateCatalogParity(catalog, catalog.makers.map(item => item.id), Object.keys(protocolHandlers)), true);
  assert.equal(validateCatalogParity(catalog, catalog.makers.map(item => item.id)), true);
  assert.throws(() => validateCatalogParity(catalog, catalog.makers.map(item => item.id), ['capabilities.read']), { message: 'CATALOG_HANDLER_DRIFT' });
  assert.throws(() => validateCatalogParity(catalog, []), { message: 'CATALOG_HANDLER_DRIFT' });
});

test('catalog envelopes, names and descriptors fail with stable codes', () => {
  assert.throws(() => validateCatalog({ value: undefined }), { message: 'CATALOG_JSON' });
  assert.throws(() => validateCatalog([]), { message: 'CATALOG_VERSION' });
  rejects(value => { value.schemaVersion = 2; }, 'CATALOG_VERSION');
  rejects(value => { value.makers = {}; }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0] = 'maker'; }, 'CATALOG_ALIASES');
  rejects(value => { value.makers[0].aliases = 'x'; }, 'CATALOG_ALIASES');
  rejects(value => { value.makers[0].id = 'Not A Slug'; }, 'CATALOG_DUPLICATE_ID_OR_ALIAS');
  rejects(value => { value.makers[0].id = 'a'.repeat(65); }, 'CATALOG_DUPLICATE_ID_OR_ALIAS');
  rejects(value => { value.operations[1].aliases = [value.operations[0].id]; }, 'CATALOG_DUPLICATE_ID_OR_ALIAS');
  rejects(value => { value.makers[0].status = 'beta'; }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0].description = ''; }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0].sideEffects = [1]; }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0].network = 'always'; }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0].version = 1; }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0].options.push(value.makers[0].options[0]); }, 'CATALOG_INVALID');
  rejects(value => { value.makers[0].options.push('--invented'); }, 'CATALOG_OPTION_DRIFT');
  rejects(value => { delete value.makers[0].inputSchema.properties.options.properties; }, 'CATALOG_OPTION_DRIFT');
  rejects(value => { delete value.makers[0].inputSchema.properties; }, 'CATALOG_SCHEMA');
});

test('only the reviewed JSON Schema subset is accepted', () => {
  rejects(value => { value.operations[0].inputSchema = null; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).type = 'executable'; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).$ref = '#'; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).enum = []; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).maxLength = 0; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).maxItems = 1.5; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).pattern = 7; }, 'CATALOG_SCHEMA');
  rejects(value => { firstSchema(value).items = { type: 'string' }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].inputSchema = { type: 'string', properties: { a: { type: 'string' } } }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].inputSchema = { type: 'object', properties: [] }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].inputSchema = { type: 'object', properties: { a: { type: 'nope' } } }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].inputSchema = { type: 'object', required: ['missing'] }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].inputSchema = { type: 'object', additionalProperties: true }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].inputSchema = { type: 'array', additionalProperties: false }; }, 'CATALOG_SCHEMA');
  const accepted = mutated(value => { value.operations[0].inputSchema = { type: 'object', additionalProperties: false, required: ['list'],
    properties: { list: { type: 'array', maxItems: 3, items: { type: 'string', enum: ['a'], maxLength: 4, pattern: '^a$' } } } }; });
  assert.equal(validateCatalog(accepted), true);
});

test('operations cannot over-claim transports or point their CLI at unsafe sources', () => {
  rejects(value => { value.operations[0].outputSchema = { type: 'function' }; }, 'CATALOG_SCHEMA');
  rejects(value => { value.operations[0].transports = ['http']; }, 'CATALOG_INVALID');
  rejects(value => { value.operations[0].transports = ['protocol', 'protocol', 'cli']; }, 'CATALOG_INVALID');
  rejects(value => { plannedOperation(value).transports = ['protocol']; }, 'CATALOG_FALSE_SUPPORT');
  rejects(value => { delete plannedOperation(value).reason; }, 'CATALOG_FALSE_SUPPORT');
  rejects(value => { const item = value.operations.find(entry => entry.transports.length === 1); item.transports = []; }, 'CATALOG_FALSE_SUPPORT');
  rejects(value => { delete cliOperation(value).cli; }, 'CATALOG_CLI');
  rejects(value => { cliOperation(value).cli.script = 3; }, 'CATALOG_CLI');
  rejects(value => { cliOperation(value).cli.sourceFiles = []; }, 'CATALOG_CLI');
  rejects(value => { cliOperation(value).cli.sourceFiles = ['../outside.mjs']; }, 'CATALOG_CLI');
  rejects(value => { cliOperation(value).cli = 'npm run x'; }, 'CATALOG_CLI');
});

test('discovery answers supported operations and refuses everything else with fixed messages', () => {
  const read = handleRequest(request());
  assert.equal(read.type, 'result'); assert.deepEqual(read.output, capabilityCatalog()); assert.equal(validateMessage(read), true);
  assert.deepEqual(handleRequest(request('makers.list')).output, capabilityCatalog().makers);
  const code = value => handleRequest(value).error.code;
  assert.equal(code(request('source.make')), 'CLI_HANDOFF_REQUIRED');
  assert.equal(code(request('template.export')), 'CAPABILITY_PLANNED');
  assert.equal(code(request('unknown.operation')), 'UNKNOWN_OPERATION');
  assert.equal(code({ ...request(), protocolVersion: 2 }), 'UNKNOWN_VERSION');
  assert.equal(code([]), 'UNKNOWN_VERSION');
  assert.equal(code(request('capabilities.read', { type: 'progress' })), 'INVALID_REQUEST');
  assert.equal(code({ toJSON: () => 1 }), 'INVALID_REQUEST');
  const anonymous = handleRequest(null);
  assert.deepEqual([anonymous.requestId, anonymous.operation, anonymous.error.code], ['invalid-request', 'unresolved', 'INVALID_REQUEST']);
  const echoed = handleRequest(request('source.make'));
  assert.deepEqual([echoed.requestId, echoed.operation, echoed.receipt.outcome], ['probe-1', 'source.make', 'rejected']);
  assert.equal(validateMessage(echoed), true);
});

test('messages are validated per type, including progress, receipts and fixed error text', () => {
  const result = handleRequest(request());
  const progress = { protocolVersion: 1, type: 'progress', requestId: 'probe-1', operation: 'makers.list', sequence: 0, phase: 'discovery', completed: 1, total: 2 };
  assert.equal(validateMessage(progress), true);
  const invalid = [
    { ...progress, completed: 3 }, { ...progress, sequence: -1 }, { ...progress, phase: 'execute' }, { ...progress, operation: 'source.make' },
    { ...result, output: [] }, { ...result, operation: 'source.make', receipt: { ...result.receipt, operation: 'source.make' } },
    { ...result, receipt: { ...result.receipt, catalogDigest: '0'.repeat(64) } }, { ...result, receipt: { ...result.receipt, catalogDigest: 'short' } },
    { ...result, receipt: { ...result.receipt, outcome: 'rejected' } }, { ...result, receipt: { ...result.receipt, authorization: 'granted' } },
    { ...result, receipt: { ...result.receipt, requestId: 'other' } }, { ...result, receipt: [] },
    { ...request(), input: { root: '/' } }, { ...request(), type: 'notice' }, { ...request(), requestId: '../x' }, 'text',
  ];
  for (const message of invalid) assert.throws(() => validateMessage(message), { message: 'PROTOCOL_INVALID' });
  assert.throws(() => validateMessage({ value: undefined }), { message: 'PROTOCOL_JSON' });
  const error = handleRequest(request('template.export'));
  assert.equal(validateMessage(error), true);
  for (const value of [{ code: 'CAPABILITY_PLANNED', message: 'changed' }, { code: 'INVENTED', message: 'x' }, { code: 1, message: 'x' }])
    assert.throws(() => validateMessage({ ...error, error: value }), { message: 'PROTOCOL_INVALID' });
});
