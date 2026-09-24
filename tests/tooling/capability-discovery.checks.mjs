import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, cp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertJsonData, parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { spawnSync } from 'node:child_process';
import { capabilityCatalog, validateCatalog, validateCatalogParity } from '../../scripts/operations/catalog.mjs';
import { builtinRecipes, parseArguments } from '../../scripts/makers/arguments.mjs';
import { builtinHandlers } from '../../scripts/makers/dispatch.mjs';
import { handleRequest, validateMessage, protocolHandlers } from '../../scripts/operations/protocol.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = resolve(root, 'scripts/operations/cli.mjs');
const request = (operation = 'capabilities.read', input = {}) => ({
  protocolVersion: 1, type: 'request', requestId: 'probe-001', operation, input,
});
function invoke(args, options = {}) {
  const run = spawnSync(process.execPath, [cli, ...args], {
    cwd: root, encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024, ...options,
  });
  assert.equal(run.error, undefined, run.error?.message);
  return run;
}
async function fixture(work) {
  const folder = await mkdtemp(join(tmpdir(), 'shell-capabilities-'));
  try { return await work(folder); } finally { await rm(folder, { recursive: true, force: true }); }
}

test('[CAP-01] catalog enumerates the actual fourteen maker handlers and preserves legacy parsing', () => {
  const catalog = capabilityCatalog();
  assert.deepEqual(catalog.makers.map(item => item.id), builtinRecipes);
  assert.deepEqual([...builtinRecipes].sort(), Object.keys(builtinHandlers).sort());
  assert.equal(catalog.makers.length, 14);
  assert.equal(validateCatalog(catalog), true);
  assert.equal(validateCatalogParity(catalog, Object.keys(builtinHandlers), Object.keys(protocolHandlers)), true);
  assert.deepEqual(parseArguments(['feature', 'books', '--preset', 'project', '--dry-run']), {
    maker: 'feature', name: 'books', options: { '--preset': 'project', '--dry-run': true },
  });
});

test('[CAP-02] missing handlers, duplicate IDs/aliases, unsupported schemas and false implementation claims fail', () => {
  const valid = capabilityCatalog();
  for (const mutate of [
    value => value.makers.push(structuredClone(value.makers[0])),
    value => { value.makers[1].aliases = [value.makers[0].id]; },
    value => { value.operations[0].aliases = [value.operations[1].id]; },
    value => { value.operations[0].inputSchema.type = 'executable'; },
    value => { value.operations.find(item => item.status === 'planned').transports = ['protocol']; },
    value => { value.protocolVersion = 99; },
  ]) {
    const invalid = structuredClone(valid); mutate(invalid);
    assert.throws(() => validateCatalog(invalid), /CATALOG_/);
  }
  assert.throws(() => validateCatalogParity(valid, Object.keys(builtinHandlers).slice(1)), /CATALOG_HANDLER_DRIFT/);
  assert.throws(() => validateCatalogParity(valid, [...Object.keys(builtinHandlers), 'invented']), /CATALOG_HANDLER_DRIFT/);
});

test('[CAP-03] data-only CLI discovery never imports custom recipes or executes consumer scripts/configuration', () => fixture(async folder => {
  await mkdir(join(folder, 'scripts/makers/custom'), { recursive: true });
  const hostile = `import { writeFileSync } from 'node:fs'; writeFileSync('executed.txt', 'bad'); throw new Error('executed');`;
  await writeFile(join(folder, 'scripts/makers/custom/registry.mjs'), hostile);
  await writeFile(join(folder, 'vite.config.mjs'), hostile);
  await writeFile(join(folder, 'package.json'), JSON.stringify({ scripts: { prepare: 'node vite.config.mjs', capabilities: 'node vite.config.mjs' } }));
  const before = await readFile(join(folder, 'package.json'), 'utf8');
  for (const args of [[], ['catalog'], ['makers'], ['--request']]) {
    const run = invoke(args, { cwd: folder, input: JSON.stringify(request()) });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotThrow(() => JSON.parse(run.stdout));
  }
  assert.equal(await readFile(join(folder, 'package.json'), 'utf8'), before);
  assert.deepEqual((await readdir(folder)).sort(), ['package.json', 'scripts', 'vite.config.mjs']);
}));

test('[CAP-04] fresh Git-free copy discovers capabilities without installed packages or concept assets', () => fixture(async folder => {
  for (const path of ['scripts/operations', 'scripts/contracts']) {
    await mkdir(join(folder, path), { recursive: true });
    await cp(join(root, path), join(folder, path), { recursive: true });
  }
  await mkdir(join(folder, 'scripts/makers'), { recursive: true });
  await cp(join(root, 'scripts/makers/recipes.json'), join(folder, 'scripts/makers/recipes.json'));
  const run = spawnSync(process.execPath, ['scripts/operations/cli.mjs', 'catalog'], { cwd: folder, encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), capabilityCatalog());
  assert.equal((await readdir(folder)).includes('node_modules'), false);
}));

test('[CAP-05] supported discovery uses identical protocol results and cannot mutate the shared catalog', () => {
  const message = request();
  const result = handleRequest(message);
  assert.equal(validateMessage(result), true);
  assert.equal(result.type, 'result');
  assert.equal(result.requestId, message.requestId);
  assert.equal(result.receipt.authorization, 'none');
  assert.deepEqual(result.receipt.sideEffects, []);
  assert.equal(result.receipt.outcome, 'succeeded');
  const run = invoke(['--request'], { input: JSON.stringify(message) });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), result);
  result.output.makers[0].id = 'changed-by-client';
  assert.equal(handleRequest(message).output.makers[0].id, 'feature');
  const makers = handleRequest(request('makers.list'));
  assert.deepEqual(makers.output, capabilityCatalog().makers);
});

test('[CAP-06] future/malformed envelopes and executable or machine-local input fail before any handler', () => {
  const cases = [
    { ...request(), protocolVersion: 2 }, { ...request(), requestId: '../escape' },
    { ...request(), approval: 'imported-trust' }, request('capabilities.read', { root: '/private' }),
    request('capabilities.read', { command: 'touch bad' }), request('capabilities.read', { token: 'secret' }),
    { ...request(), input: { toJSON() { throw new Error('must not execute'); } } },
    JSON.parse('{"protocolVersion":1,"type":"request","requestId":"probe","operation":"capabilities.read","input":{"__proto__":{}}}'),
  ];
  for (const value of cases) {
    const result = handleRequest(value);
    assert.equal(result.type, 'error');
    assert.equal(result.receipt.outcome, 'rejected');
    assert.deepEqual(result.receipt.sideEffects, []);
    assert.equal(result.receipt.authorization, 'none');
    assert.equal(validateMessage(result), true);
    assert.doesNotMatch(JSON.stringify(result), /private|secret|touch bad|imported-trust/);
  }
});

test('[CAP-07] unknown, planned and CLI-only operations are visible but never executed by the protocol', () => {
  const catalog = capabilityCatalog();
  for (const operation of [...catalog.operations.filter(item => !item.transports.includes('protocol')).map(item => item.id), 'unknown.operation']) {
    const result = handleRequest(request(operation));
    assert.equal(result.type, 'error');
    assert.ok(['CAPABILITY_PLANNED', 'CLI_HANDOFF_REQUIRED', 'UNKNOWN_OPERATION'].includes(result.error.code));
    assert.equal(result.receipt.outcome, 'rejected');
    assert.deepEqual(result.receipt.sideEffects, []);
  }
});

test('[CAP-08] protocol validates progress, receipts and error/result invariants, not only requests', () => {
  const result = handleRequest(request());
  const progress = { protocolVersion: 1, type: 'progress', requestId: 'probe-001', operation: 'capabilities.read', sequence: 0, phase: 'discovery', completed: 0, total: 1 };
  assert.equal(validateMessage(progress), true);
  for (const invalid of [
    { ...progress, completed: 2 }, { ...progress, sequence: -1 }, { ...progress, extra: true },
    { ...result, receipt: { ...result.receipt, authorization: 'approved' } },
    { ...result, receipt: { ...result.receipt, outcome: 'uncertain' } },
    { ...result, receipt: { ...result.receipt, sideEffects: ['filesystem-write'] } },
    { ...result, receipt: { ...result.receipt, requestId: 'different' } },
    { ...result, receipt: { ...result.receipt, catalogDigest: 'not-a-hash' } },
  ]) assert.throws(() => validateMessage(invalid), /PROTOCOL_/);
});

test('[CAP-09] malformed, oversized and deep stdin fail with bounded non-leaking JSON errors', () => {
  for (const input of ['{"secret":', 'x'.repeat(1024 * 1024 + 1), '['.repeat(40) + '0' + ']'.repeat(40)]) {
    const run = invoke(['--request'], { input });
    assert.equal(run.status, 1);
    const message = JSON.parse(run.stdout);
    assert.equal(message.type, 'error');
    assert.ok(run.stdout.length < 2000);
    assert.doesNotMatch(run.stdout, /secret|SyntaxError|at file:/);
  }
  const run = invoke(['--unknown-secret']);
  assert.equal(run.status, 1);
  assert.doesNotMatch(run.stdout + run.stderr, /unknown-secret/);
});

test('[CAP-10] data-only catalog input schemas and entrypoints match declared current CLI contracts', async () => {
  const catalog = capabilityCatalog();
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  for (const item of catalog.operations.filter(item => item.cli)) {
    assert.equal(pkg.scripts[item.cli.script], item.cli.command);
    for (const path of item.cli.sourceFiles) assert.ok((await readFile(join(root, path))).length > 0);
  }
  const first = invoke(['catalog']); const second = invoke(['catalog']);
  assert.equal(first.status, 0); assert.equal(second.status, 0);
  assert.equal(first.stdout, second.stdout);
});


test('[CAP-11] original maker list/help entrypoints and recipe option contracts remain usable', () => {
  for (const flag of ['--list', '--help']) {
    const run = spawnSync(process.execPath, ['scripts/makers/cli.mjs', flag, '--json'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 0, run.stderr);
    const output = JSON.parse(run.stdout);
    assert.equal(output.version, 2);
    assert.deepEqual(output.recipes, builtinRecipes);
    assert.match(output.help, /trusted explicit local custom recipe/);
  }
  for (const item of capabilityCatalog().makers) {
    const options = Object.entries(item.inputSchema.properties.options.properties).flatMap(([key, shape]) => shape.type === 'boolean' ? [key] : [key, shape.enum?.[0] ?? 'example']);
    assert.equal(parseArguments([item.id, 'example', ...options]).maker, item.id);
  }
});

test('[CAP-12] accessors, custom prototypes, non-finite values, sparse arrays and cycles cannot cross JSON boundaries', () => {
  let called = 0;
  const getter = Object.defineProperty({}, 'value', { enumerable: true, get() { called++; throw new Error('executed'); } });
  const cyclic = {}; cyclic.self = cyclic;
  const symbol = { [Symbol('hidden')]: 'secret' };
  const cases = [getter, new Date(), Object.create({ secret: true }), NaN, Infinity, undefined, [,,], cyclic, symbol, { callback() { called++; } }];
  for (const value of cases) {
    assert.throws(() => assertJsonData(value), /JSON_DATA_INVALID/);
    assert.equal(handleRequest({ ...request(), input: value }).type, 'error');
  }
  assert.equal(called, 0);
  const valid = { empty: '', off: false, zero: 0, nullable: null, unicode: 'Wohnung · 日本語', nested: [true, 0] };
  assert.deepEqual(parseJsonData(JSON.stringify(valid)), valid);
});

test('[CAP-13] protocol registration drift, malformed descriptors and falsified outputs are rejected', () => {
  const catalog = capabilityCatalog();
  assert.throws(() => validateCatalogParity(catalog, Object.keys(builtinHandlers), ['capabilities.read']), /CATALOG_HANDLER_DRIFT/);
  for (const mutate of [
    value => { delete value.makers[0].inputSchema.properties.options; },
    value => { value.operations[0].transports.push('protocol'); },
    value => { value.operations[0].inputSchema.additionalProperties = true; },
    value => { value.operations[0].inputSchema.required = ['missing']; },
    value => { value.operations[0].cli.sourceFiles = ['../outside.mjs']; },
    value => { value.makers[0].options.push('--invented'); },
  ]) {
    const invalid = structuredClone(catalog); mutate(invalid);
    assert.throws(() => validateCatalog(invalid), /CATALOG_/);
  }
  const result = handleRequest(request());
  result.output.makers.pop();
  assert.throws(() => validateMessage(result), /PROTOCOL_/);
  const error = handleRequest(request('unknown.operation'));
  error.error.message = 'Leak user input';
  assert.throws(() => validateMessage(error), /PROTOCOL_/);
});
