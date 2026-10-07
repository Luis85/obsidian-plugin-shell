const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runCompiler, compilerPhases, compilerVersion } from '../compiler/application/pipeline.ts';
import { artifactCollector, validateArtifacts, canonicalJson, portableArtifactPath } from '../compiler/domain/artifacts.ts';
import { diagnostic, diagnosticCatalog, CompilerError, CompilationFailure, orderedDiagnostics } from '../compiler/domain/diagnostics.ts';
import { referenceDiagnostics } from '../compiler/domain/references.ts';
import { sourceReferenceDiagnostics } from '../compiler/domain/source-references.ts';
import { parseSelection, selectionClosure, SelectionError } from '../compiler/domain/selection.ts';
import { readProjectGenerator, projectSelection, validateProjectSelection, angularPackages } from '../compiler/adapters/project/selection.ts';
import { frameworkAdapter } from '../compiler/adapters/project/framework-registry.ts';

// Drives the inward-only compiler core (src/cli/compiler/{domain,application}) to the maker core floors.
const artifact = (path, content = 'safe', extra = {}) => ({ path, content, ownership: 'managed', producer: 'fixture', ...extra });
const template = Object.freeze({ fingerprint: 'fixture', frameworkFiles: [], skillFiles: [], text() { throw new Error('unexpected template read'); } });
const hash = (value, encoding) => createHash('sha256').update(value, encoding === 'base64' ? 'base64' : 'utf8').digest('hex');
const ports = overrides => ({ validate: value => value, resolve: () => {},
  lower: () => [], emit: async () => [artifact('src/main.ts')], dependencies: () => ({ ready: true, diagnostics: [] }), hash, ...overrides });
const codes = values => values.map(value => value.code);
const pointers = values => values.map(value => value.source?.jsonPointer);

test('the pipeline runs every phase, sorts artifacts and fingerprints encoded content', async () => {
  const events = [];
  const warning = diagnostic('COMPILER_ADAPTER_REQUIRED', 'lower', 'adapter pending');
  const pending = diagnostic('COMPILER_DEPENDENCY_RESOLUTION_REQUIRED', 'emit', 'resolve packages');
  const result = await runCompiler({ source: '{"a":1}', sourceName: 'p.json', template, outputKind: 'project' }, ports({
    lower: () => [warning], emit: async () => [artifact('b.txt'), artifact('a.bin', 'AA==', { encoding: 'base64' })],
    dependencies: () => ({ ready: false, diagnostics: [pending] }) }), { onEvent: event => events.push(event) });
  assert.equal(result.status, 'ok'); assert.equal(result.outputKind, 'project'); assert.equal(result.compilerVersion, compilerVersion);
  assert.deepEqual(result.artifacts.map(file => file.path), ['a.bin', 'b.txt']);
  assert.equal('migration' in result, false); assert.deepEqual(result.model, { a: 1 });
  assert.ok(!compilerPhases.includes('migrate'), 'schema 6 input is validated directly; no migrate phase exists');
  assert.equal(result.readiness.generation, 'completed'); assert.equal(result.readiness.dependencies, 'resolution-required');
  assert.deepEqual(codes(result.diagnostics).sort(), ['COMPILER_ADAPTER_REQUIRED', 'COMPILER_DEPENDENCY_RESOLUTION_REQUIRED']);
  assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(events.filter(event => event.event === 'started').map(event => event.phase), [...compilerPhases]);
  const locked = await runCompiler({ source: '{}', template }, ports());
  assert.equal(locked.outputKind, 'obsidian-plugin'); assert.equal(locked.readiness.dependencies, 'locked');
  assert.notEqual(locked.fingerprint, result.fingerprint);
});

test('analysis without a template stops after resolve and never emits', async () => {
  const result = await runCompiler({ source: '{}' }, ports({ emit: () => { throw new Error('must not emit'); } }));
  assert.equal(result.status, 'ok'); assert.equal(result.readiness.generation, 'not-run'); assert.equal(result.fingerprint, null);
});

test('parse failures, unknown kinds and oversized inputs are stable errors with default source names', async () => {
  const invalid = await runCompiler({ source: '{', template }, ports());
  assert.deepEqual(codes(invalid.diagnostics), ['COMPILER_JSON_INVALID']); assert.equal(invalid.diagnostics[0].source.file, 'project.json');
  assert.deepEqual(codes((await runCompiler({ source: '{}', outputKind: 'other' }, ports())).diagnostics), ['COMPILER_SCHEMA_INVALID']);
  assert.deepEqual(codes((await runCompiler({ source: ' '.repeat(4_000_001) }, ports())).diagnostics), ['COMPILER_INPUT_LIMIT']);
});

test('reference errors fail before validation and report the failed resolve event', async () => {
  const events = [];
  const source = JSON.stringify({ design: { nodes: [{ id: 'a', parent: 'missing' }] } });
  const result = await runCompiler({ source, template }, ports({ validate: () => { throw new Error('must not validate'); } }), { onEvent: event => events.push(event) });
  assert.equal(result.status, 'failed'); assert.equal(result.readiness.generation, 'failed');
  assert.deepEqual(events.at(-1), { phase: 'resolve', event: 'failed' });
  assert.equal(result.diagnostics[0].source.file, 'project.json');
});

test('cancellation, typed, invalid-artifact and unknown failures never return artifacts', async () => {
  const controller = new AbortController(); controller.abort();
  const cancelled = await runCompiler({ source: '{}', template }, ports(), { signal: controller.signal });
  assert.equal(cancelled.status, 'cancelled'); assert.deepEqual(codes(cancelled.diagnostics), ['COMPILER_CANCELLED']);
  const failures = [];
  const unsafe = await runCompiler({ source: '{}', template }, ports({ emit: async () => [artifact('../escape')] }), { onFailure: (error, phase) => failures.push(phase) });
  assert.deepEqual(codes(unsafe.diagnostics), ['COMPILER_PATH_COLLISION']); assert.deepEqual(unsafe.artifacts, []); assert.deepEqual(failures, ['emit']);
  const internal = await runCompiler({ source: '{}', template }, ports({ validate: () => { throw new Error('secret path'); } }));
  assert.deepEqual(codes(internal.diagnostics), ['COMPILER_INTERNAL']); assert.equal(internal.diagnostics[0].phase, 'validate');
  assert.ok(!JSON.stringify(internal).includes('secret'));
});

test('diagnostics carry catalog help, severity, ordering and truncation', () => {
  assert.equal(diagnostic('COMPILER_ADAPTER_REQUIRED', 'lower', 'x').severity, 'warning');
  const located = diagnostic('COMPILER_SCHEMA_INVALID', 'validate', 'x', { file: 'f', jsonPointer: '/a' });
  assert.equal(located.help, diagnosticCatalog.COMPILER_SCHEMA_INVALID); assert.equal(located.severity, 'error'); assert.equal(located.retryable, false);
  assert.ok(!('source' in diagnostic('COMPILER_INTERNAL', 'emit', 'x')));
  const b = diagnostic('COMPILER_SCHEMA_INVALID', 'validate', 'b', { file: 'f', jsonPointer: '/b' });
  assert.deepEqual(orderedDiagnostics([b, located, located]).map(value => value.message), ['x', 'x', 'b']);
  const many = Array.from({ length: 12 }, (_, index) => diagnostic('COMPILER_SCHEMA_INVALID', 'validate', String(index).padStart(2, '0')));
  const truncated = orderedDiagnostics(many, 10);
  assert.equal(truncated.length, 10); assert.equal(truncated.at(-1).code, 'COMPILER_DIAGNOSTICS_TRUNCATED'); assert.match(truncated.at(-1).message, /^3 additional/);
  const failure = new CompilationFailure([diagnostic('COMPILER_ADAPTER_REQUIRED', 'lower', 'w'), b]);
  assert.equal(failure.diagnostic, b); assert.equal(failure.name, 'CompilerError'); assert.equal(failure.diagnostics.length, 2);
  assert.equal(new CompilationFailure([]).diagnostic.code, 'COMPILER_INTERNAL');
  const cause = new Error('cause');
  assert.equal(new CompilerError(b, { cause }).cause, cause);
});

test('artifact validation rejects unsafe, oversized, aliased and nested outputs', () => {
  for (const path of ['', 'a/./b', 'a/../b', 'trailing.', 'trailing ', 'nul.txt', '.git/config', 'x/node_modules/y', 'bad|char', 'x'.repeat(501)]) assert.equal(portableArtifactPath(path), false, path);
  assert.equal(portableArtifactPath('src/ok file.ts'), true);
  assert.throws(() => validateArtifacts(Array.from({ length: 5001 }, (_, index) => artifact(`f${index}`))), error => error.diagnostic.code === 'COMPILER_TEMPLATE_INVALID');
  for (const files of [[artifact('A.ts'), artifact('a.ts')], [artifact('dir'), artifact('dir/child.ts')], [artifact('../x')]])
    assert.throws(() => validateArtifacts(files), error => error instanceof CompilerError && error.diagnostic.code === 'COMPILER_PATH_COLLISION');
  validateArtifacts([artifact('dir/a.ts'), artifact('dir/b.ts')]);
});

test('artifact collection requires explicit replacement and canonical JSON omits undefined', () => {
  const collector = artifactCollector([artifact('x', 'one', { producer: 'framework' })]);
  collector.add(artifact('y')); collector.add(artifact('x', 'two'), 'framework');
  assert.deepEqual(collector.values().map(file => [file.path, file.content]), [['x', 'two'], ['y', 'safe']]);
  assert.throws(() => collector.add(artifact('x', 'three')), /fixture would replace fixture/);
  const unnamed = artifactCollector([artifact('z', 'a', { producer: undefined })]);
  assert.throws(() => unnamed.add(artifact('z', 'b', { producer: undefined }), 'framework'), /unknown would replace unknown/);
  assert.equal(unnamed.get('missing'), undefined);
  assert.equal(canonicalJson({ b: [3, { d: undefined, c: null }], a: 'x' }), '{"a":"x","b":[3,{"c":null}]}');
  assert.equal(canonicalJson(5), '5');
});

test('design references report duplicates, parents, components and links in pointer order', () => {
  const document = { design: {
    nodes: [{ id: 'a', slug: 'same', components: [{ id: 'known' }, { id: 'gone' }, { id: 7 }] }, { id: 'A', slug: 'Same', parent: 'missing' }, { id: 4, parent: 'a' }],
    library: [{ id: 'known' }, { id: 'known' }], links: [{ id: 'l', from: 'a', to: 'nowhere' }, { id: 9, from: 'void' }] } };
  const result = referenceDiagnostics(document, 'p.json');
  assert.deepEqual(pointers(result), ['/design/library/1/id', '/design/links/0/to', '/design/links/1/from', '/design/nodes/0/components/1/id',
    '/design/nodes/1/id', '/design/nodes/1/parent', '/design/nodes/1/slug']);
  assert.deepEqual(result.find(value => value.code === 'COMPILER_DUPLICATE_ID' && value.source.jsonPointer === '/design/nodes/1/id').related,
    [{ file: 'p.json', jsonPointer: '/design/nodes/0/id', entityId: 'a' }]);
  assert.equal(result.find(value => value.source.jsonPointer === '/design/links/1/from').source.entityId, undefined);
  const withoutLibrary = referenceDiagnostics({ design: { nodes: [{ id: 'a', components: [{ id: 'gone' }] }], links: 'invalid' } }, 'p.json');
  assert.deepEqual(withoutLibrary, []);
  for (const document of [null, [], { design: [] }, { design: { nodes: 'x' } }, { design: { nodes: [1] } }, { design: { nodes: Array(201).fill({}) } }])
    assert.deepEqual(referenceDiagnostics(document, 'p.json'), []);
});

test('source references name missing entities, sources, operations, surfaces and relationship endpoints', () => {
  const design = { nodes: [{ id: 'home' }], semantic: { entities: [{ id: 'task' }], relationships: [{ id: 'r', source: 'task', target: 'ghost' }, { id: 2, source: 'none' }] },
    dataSources: { sources: [{ id: 's', operations: [{ id: 'list', input: { mode: 'entity', entity: 'task' }, output: { mode: 'entity', entity: 'note' } }, { id: 'raw', output: { mode: 'value' } }] }],
      flows: [{ id: 'f1', source: 's', operation: 'missing', card: 'home' }, { id: 'f2', source: 'nope', card: 'away' }, { id: 'f3', source: 's', operation: 'list' }, { id: 'f4' }] } };
  const result = sourceReferenceDiagnostics({ design }, 'p.json');
  assert.deepEqual(pointers(result), ['/design/dataSources/sources/0/operations/0/output/entity', '/design/dataSources/flows/0/operation',
    '/design/dataSources/flows/1/source', '/design/dataSources/flows/1/card', '/design/semantic/relationships/0/target', '/design/semantic/relationships/1/source']);
  assert.ok(result.every(value => value.code === 'COMPILER_REFERENCE_MISSING'));
  assert.equal(result.at(-1).source.entityId, undefined);
  assert.deepEqual(sourceReferenceDiagnostics(null, 'p.json'), []);
  assert.deepEqual(sourceReferenceDiagnostics({ design: { dataSources: { sources: Array(201).fill({}) } } }, 'p.json'), []);
});

test('selection parsing and closure are bounded, deterministic and reject defects by code', () => {
  assert.equal(parseSelection(undefined), null); assert.equal(parseSelection('all'), null);
  assert.deepEqual(parseSelection('page:home'), { kind: 'page', id: 'home' });
  for (const value of ['other:x', 'page:', 'page:' + 'x'.repeat(121), 'page:a\u0001']) assert.throws(() => parseSelection(value), { code: 'GENERATION_SCOPE_INVALID' });
  const requested = { kind: 'feature', id: 'f' };
  const closure = selectionClosure(requested, 'feature:f', [{ key: 'feature:f', dependencies: ['page:b', 'page:a', 'page:a'] },
    { key: 'page:a', dependencies: ['component:c'] }, { key: 'page:b', dependencies: ['component:c'] }, { key: 'component:c', dependencies: [] }]);
  assert.deepEqual(closure.included, ['component:c', 'feature:f', 'page:a', 'page:b']);
  assert.deepEqual(closure.dependencies.map(edge => edge.from + '>' + edge.to), ['feature:f>page:a', 'feature:f>page:b', 'page:a>component:c', 'page:b>component:c']);
  assert.notEqual(closure.requested, requested);
  const cases = [
    [Array.from({ length: 5001 }, (_, index) => ({ key: `k${index}`, dependencies: [] })), 'GENERATION_SCOPE_LIMIT'],
    [Array.from({ length: 3 }, (_, index) => ({ key: `k${index}`, dependencies: Array(40001).fill('k0') })), 'GENERATION_SCOPE_LIMIT'],
    [[{ key: 'a', dependencies: [] }, { key: 'a', dependencies: [] }], 'GENERATION_SCOPE_GRAPH'],
    [[{ key: 'a', dependencies: 'b' }], 'GENERATION_SCOPE_GRAPH'], [[{ key: '', dependencies: [] }], 'GENERATION_SCOPE_GRAPH'],
    [[{ key: 'a', dependencies: [''] }], 'GENERATION_SCOPE_GRAPH'], [[{ key: 'b', dependencies: [] }], 'GENERATION_SCOPE_UNKNOWN'],
    [[{ key: 'a', dependencies: ['b'] }, { key: 'b', dependencies: ['a'] }], 'GENERATION_SCOPE_CYCLE'],
    [[{ key: 'a', dependencies: ['ghost'] }], 'GENERATION_SCOPE_REFERENCE'],
  ];
  for (const [nodes, code] of cases) assert.throws(() => selectionClosure(requested, 'a', nodes), error => error instanceof SelectionError && error.code === code && error.name === 'SelectionError');
});

test('project starter data is strict and labels stay descriptive', () => {
  const generator = { kind: 'project', projectType: 'hybrid', framework: 'vanilla', targets: ['plugin', 'cli'] };
  assert.deepEqual(readProjectGenerator(generator), generator);
  const identity = { id: 'starter', version: '1.0.0', sha256: 'a'.repeat(64) };
  const selection = projectSelection(identity, generator);
  assert.deepEqual(validateProjectSelection(selection), selection);
  assert.ok(frameworkAdapter('none')?.label.includes('command-line'));
  for (const value of [null, { ...generator, extra: 1 }, { ...generator, kind: 'other' }, { ...generator, targets: ['cli', 'plugin'] }, { ...generator, framework: 'none' }])
    assert.throws(() => readProjectGenerator(value), error => error instanceof CompilerError && error.diagnostic.code === 'COMPILER_SCHEMA_INVALID');
  for (const value of [{ ...selection, schemaVersion: 1 }, { ...selection, starter: { ...identity, sha256: 'x' } }, { ...selection, starter: { ...identity, version: 'v1' } }])
    assert.throws(() => validateProjectSelection(value), error => error.diagnostic.code === 'COMPILER_SCHEMA_INVALID');
});

test('Angular starters need one exact pin per required package and one Angular version', () => {
  const angularPins = Object.fromEntries(angularPackages.map(name => [name, name.startsWith('@angular/') ? '20.1.0' : '7.8.2']));
  const generator = { kind: 'project', projectType: 'webapp', framework: 'angular', targets: ['webapp'], angularPins };
  assert.deepEqual(readProjectGenerator(generator).angularPins, angularPins);
  const invalid = [{ ...generator, angularPins: undefined }, { ...generator, angularPins: { ...angularPins, extra: '1.0.0' } },
    { ...generator, angularPins: { ...angularPins, rxjs: '^7.8.2' } }, { ...generator, angularPins: { ...angularPins, '@angular/core': '20.2.0' } },
    { ...generator, framework: 'vanilla' }, { ...generator, projectType: 'mobile' }, { ...generator, framework: 'Bad Id' }, { ...generator, targets: [] },
    { ...generator, targets: ['tablet'] }, { ...generator, targets: ['plugin', 'webapp'] }, { ...generator, projectType: 'hybrid', targets: ['webapp'] }];
  for (const value of invalid) assert.throws(() => readProjectGenerator(value), error => error.diagnostic.code === 'COMPILER_SCHEMA_INVALID');
  const cli = { kind: 'project', projectType: 'cli', framework: 'none', targets: ['cli'] };
  assert.deepEqual(readProjectGenerator(cli), cli);
  assert.throws(() => projectSelection({ id: 'Bad', version: '1.0.0', sha256: 'a'.repeat(64) }, cli), error => error.diagnostic.code === 'COMPILER_SCHEMA_INVALID');
});
