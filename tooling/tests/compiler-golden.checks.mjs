import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileProject, loadTemplateSnapshot } from '../../src/cli/compiler/index.ts';
import { artifactDigests, goldenDifferences, goldenDocument, productPath, readGolden, starterCases } from '../compiler/golden.mjs';
import { companionStarterIds, starterDocumentText } from '#shared/testing/starter-documents.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const template = await loadTemplateSnapshot(root);
const golden = await readGolden(root), cases = await starterCases(root, template);
const digest = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const changedHash = hash => (hash[0] === '0' ? '1' : '0') + hash.slice(1);

test('every Companion starter matches its reviewed generated-output baseline', () => {
  assert.deepEqual(goldenDifferences(golden, cases), []);
  assert.deepEqual(cases.map(item => item.starter), companionStarterIds());
  assert.deepEqual(golden.starters.map(item => item.starter), companionStarterIds());
});
test('the recorded baseline is exactly what --write would record', () => {
  assert.deepEqual(goldenDocument(cases), golden);
});
test('the product scope covers generated source, tests, preview, design records and entry points only', async () => {
  const result = await compileProject({ source: starterDocumentText('quick-capture'), template });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const model = result.model, scoped = result.artifacts.filter(file => productPath(model, file.path)).map(file => file.path);
  for (const path of ['src/main.ts', 'design/project.json', 'PROJECT-IMPLEMENTATION.md', 'harness/prototype/clickdummy.ts'])
    assert.ok(scoped.includes(path), path);
  // The registry is the consumer's template file plus generated registrations; renamed or removed examples change it.
  assert.ok(!scoped.includes('src/bootstrap/features.ts'));
  assert.ok(scoped.some(path => path.startsWith(model.sourceRoot + '/')) && scoped.some(path => path.startsWith(model.testRoot + '/')));
  assert.ok(!scoped.includes('package.json') && !scoped.includes('README.md') && !scoped.some(path => path.startsWith('.claude/')));
  assert.equal(JSON.parse(result.artifacts.find(file => file.path === 'design/project.json').content).schemaVersion, 6);
});

// Negative controls: the checker must fail on any undeclared change, never absorb it.
const target = cases.find(item => item.starter === 'daily-journal'), path = Object.keys(target.files).find(name => name.endsWith('.vue'));
const variant = edit => cases.map(item => item.starter === target.starter ? edit(clone(item)) : item);
test('a changed generated file fails the baseline', () => {
  const differences = goldenDifferences(golden, variant(item => { item.files[path] = changedHash(item.files[path]); return item; }));
  assert.deepEqual(differences, ['daily-journal: changed ' + path]);
});
test('a missing generated file fails the baseline', () => {
  const differences = goldenDifferences(golden, variant(item => { delete item.files[path]; return item; }));
  assert.deepEqual(differences, ['daily-journal: missing ' + path]);
});
test('an extra, undeclared generated file fails the baseline', () => {
  const extra = 'src/generated/application/unreviewed.ts';
  const differences = goldenDifferences(golden, variant(item => { item.files[extra] = digest('export {};\n'); return item; }));
  assert.deepEqual(differences, ['daily-journal: undeclared ' + extra]);
});
test('a changed shared file is reported for every starter', () => {
  const shared = Object.keys(golden.shared)[0];
  const differences = goldenDifferences(golden, cases.map(item => ({ ...item, files: { ...item.files, [shared]: changedHash(item.files[shared]) } })));
  assert.deepEqual(differences, cases.map(item => item.starter + ': changed ' + shared));
});
test('changed starter input, unreviewed or removed starters and another compiler version fail the baseline', () => {
  assert.deepEqual(goldenDifferences(golden, variant(item => { item.sourceSha256 = changedHash(item.sourceSha256); return item; })), ['daily-journal: starter input changed']);
  assert.deepEqual(goldenDifferences(golden, [...cases, { ...clone(target), starter: 'unreviewed' }]), ['unreviewed: starter has no reviewed baseline']);
  assert.deepEqual(goldenDifferences(golden, cases.filter(item => item !== target)), ['daily-journal: starter missing from configs/starters']);
  assert.deepEqual(goldenDifferences({ ...golden, compilerVersion: '0.0.0' }, cases), ['baseline: compiler 0.0.0 differs from 1.0.0']);
});
test('real compiler output with one unreviewed byte fails the baseline', async () => {
  const bytes = await readFile(join(root, 'configs/starters/quick-capture.json'));
  const result = await compileProject({ source: starterDocumentText('quick-capture'), sourceName: 'quick-capture.json', template });
  const runtime = result.model.sourceRoot + '/domain/detail-actions.ts';
  const artifacts = result.artifacts.map(file => file.path === runtime ? { ...file, content: file.content + '// unreviewed\n' } : file);
  const actual = cases.map(item => item.starter === 'quick-capture' ? { ...item, sourceSha256: digest(bytes), files: artifactDigests(result.model, artifacts) } : item);
  assert.deepEqual(goldenDifferences(golden, actual), ['quick-capture: changed ' + runtime]);
});

test('the same template snapshot stays deterministic while telemetry changes', async () => {
  const source = starterDocumentText('blank'), events = [];
  const first = await compileProject({ source, template }, { onEvent: event => events.push(event) }), again = await compileProject({ source, template });
  assert.equal(first.fingerprint, again.fingerprint); assert.deepEqual(first.artifacts, again.artifacts); assert.ok(events.length);
  assert.deepEqual([...new Set(events.map(event => event.phase))], ['parse', 'validate', 'resolve', 'lower', 'emit']);
});
test('the live consumer registry reaches generated output', async () => {
  const source = starterDocumentText('blank'), registry = template.text('src/bootstrap/features.ts');
  const retained = '// consumer-owned registration context\n' + registry;
  const files = template.frameworkFiles.map(file => file.path === 'src/bootstrap/features.ts' ? { ...file, content: retained } : file);
  const texts = new Map(files.map(file => [file.path, file.content]));
  const edited = { ...template, frameworkFiles: files, fingerprint: digest(JSON.stringify(files)), text: name => texts.has(name) ? texts.get(name) : template.text(name) };
  const result = await compileProject({ source, template: edited });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  assert.ok(result.artifacts.find(file => file.path === 'src/bootstrap/features.ts').content.startsWith('// consumer-owned registration context\n'));
  assert.notEqual(result.fingerprint, (await compileProject({ source, template })).fingerprint);
});
