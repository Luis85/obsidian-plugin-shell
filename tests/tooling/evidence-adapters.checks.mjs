import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { evidenceFixture, runtimeEvidenceFixture, browserEvidenceFixture, evidenceCli } from './evidence-fixture.mjs';
import { vitestReport, playwrightReport, nativeReport, artifactReport, completeResult } from '../../scripts/testing/evidence-adapters.mjs';
import { adaptProducer } from '../../scripts/testing/evidence-producers.mjs';
import { performanceProtocol, summarizePerformance, candidateSizes } from '../../scripts/testing/performance-report.mjs';
import { sourceInputs, sha256 } from '../../scripts/testing/source-inputs.mjs';
import { nativeOwnershipFixture } from './native-ownership-fixture.mjs';
import { nativeLaunchFixture, nativeForeignNoticeFixture } from './native-launch-fixture.mjs';

test('real Vitest JSON and public reporter diagnostics qualify a genuine pass and reject failure, retry, repeat and skip', async t => {
  for (const [body, passing] of [
    ['test("real Vitest pass", () => expect(2 + 2).toBe(4));', true],
    ['test("real Vitest fault", () => expect(2 + 2).toBe(5));', false],
    ['let attempt = 0; test("real Vitest retry", { retry: 1 }, () => expect(++attempt).toBe(2));', false],
    ['test("real Vitest repeat", { repeats: 1 }, () => expect(true).toBe(true));', false],
    ['test.skip("real Vitest skipped", () => expect(true).toBe(true));', false],
  ]) {
    const root = await runtimeEvidenceFixture(t, body);
    const run = evidenceCli(root, 'run', 'runtime'); const output = JSON.parse(run.stdout);
    assert.equal(run.status === 0, passing, run.stdout + run.stderr);
    assert.equal(evidenceCli(root, 'check', output.path).status === 0, passing);
    const packet = JSON.parse(await readFile(output.path, 'utf8'));
    if (passing) {
      const directory = dirname(output.path);
      const framework = JSON.parse(await readFile(join(directory, packet.raw.framework.file), 'utf8'));
      const attempts = JSON.parse(await readFile(join(directory, packet.raw.attempts.file), 'utf8'));
      assert.equal(vitestReport(framework, root, attempts).cases.length, 1);
      for (const change of [value => { value.numTotalTests += 1; }, value => { value.schemaVersion = 99; }, value => { value.testResults[0].assertionResults = []; }]) {
        const changed = structuredClone(framework); change(changed);
        assert.throws(() => vitestReport(changed, root, attempts));
      }
      // Actual independent-review reproducer: altering status alone used to pass
      // after updating the raw receipt hash. Check through the real CLI each time.
      for (const [kind, original, change] of [
        ['attempts', attempts, value => { value.cases[0].status = 'failed'; }],
        ['framework', framework, value => { value.testResults[0].status = 'failed'; }],
        ['framework', framework, value => { value.numPassedTestSuites = -1; }],
        ['framework', framework, value => { value.numTotalTestSuites += 1; }],
      ]) {
        const modified = structuredClone(original); change(modified); const bytes = JSON.stringify(modified);
        const altered = structuredClone(packet); const path = join(directory, packet.raw[kind].file);
        await writeFile(path, bytes);
        altered.raw[kind] = { file: packet.raw[kind].file, bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
        await writeFile(output.path, JSON.stringify(altered));
        const rejected = evidenceCli(root, 'check', output.path); assert.notEqual(rejected.status, 0, rejected.stdout);
        await writeFile(path, JSON.stringify(original));
      }
      // Restore canonical receipt bytes and metadata before the next negative.
      for (const [kind, original] of [['framework', framework], ['attempts', attempts]]) {
        const bytes = JSON.stringify(original); await writeFile(join(directory, packet.raw[kind].file), bytes);
        packet.raw[kind] = { file: packet.raw[kind].file, bytes: Buffer.byteLength(bytes), sha256: createHash('sha256').update(bytes).digest('hex') };
      }
      await writeFile(output.path, JSON.stringify(packet)); assert.equal(evidenceCli(root, 'check', output.path).status, 0);
      attempts.unhandledErrors.push({ name: 'Error', message: 'independent fault' });
      assert.equal(vitestReport(framework, root, attempts).frameworkPassed, false);
      await writeFile(join(directory, packet.raw.attempts.file), JSON.stringify(attempts));
      assert.notEqual(evidenceCli(root, 'check', output.path).status, 0);
    }
  }
});

test('framework adapters reject mode substitution, malformed shapes, empty and incomplete inventory', () => {
  assert.throws(() => playwrightReport({ schemaVersion: 99 }, process.cwd()), /SCHEMA/);
  assert.throws(() => nativeReport({ mode: 'unit', checks: [], errors: [], assets: [] }, []), /NATIVE/);
  assert.throws(() => artifactReport({ mode: 'native', nativeHostTested: true, assets: [] }), /ARTIFACT/);
  assert.throws(() => completeResult({ cases: [], frameworkPassed: true }, ['tests/runtime/missing.test.ts'], 0), /EMPTY/);
});

test('real Playwright JSON records passing assertions, first-failure retries and asset drift without claiming browser UI coverage', async t => {
  for (const [body, passing] of [
    ['test("real reporter assertion", () => expect(2 + 2).toBe(4));', true],
    ['test.describe.configure({ retries: 1 }); test("real retry", ({}, info) => expect(info.retry).toBe(1));', false],
  ]) {
    const root = await browserEvidenceFixture(t, body);
    const run = evidenceCli(root, 'run', 'browser'); const output = JSON.parse(run.stdout);
    assert.equal(run.status === 0, passing, run.stdout + run.stderr);
    assert.equal(evidenceCli(root, 'check', output.path).status === 0, passing);
    if (passing) {
      await writeFile(join(root, 'dist/main.js'), 'different bytes');
      const stale = evidenceCli(root, 'check', output.path); assert.notEqual(stale.status, 0); assert.match(stale.stderr, /ASSET_MISMATCH/);
    }
  }
});

test('native performance adapter rejects crafted classification, budget, size, graph and resolved-host lies against measured fixture bytes', async t => {
  // Samples/check completion and attribution below are explicit parser fixtures,
  // not native execution evidence. Asset compression is measured by the real code.
  const root = await evidenceFixture(t); await mkdir(join(root, 'dist')); await mkdir(join(root, 'reports/bundling'), { recursive: true });
  // Reproduce the removed-consumer context regardless of this checkout's profile.
  // Only this isolated fixture may select the profile for its crafted report.
  const profilePath = join(root, 'scripts/testing/native-profile.json');
  await writeFile(profilePath, JSON.stringify({ profile: 'foundation' }));
  const assets = [];
  for (const [file, bytes] of [['main.js', 'module.exports = {};\n'], ['styles.css', '.fixture{}'], ['manifest.json', '{}']]) {
    await writeFile(join(root, 'dist', file), bytes); assets.push({ file, sha256: sha256(bytes) });
  }
  const graph = { schemaVersion: 1, mode: 'build-module-attribution', asset: { ...assets[0], bytes: Buffer.byteLength('module.exports = {};\n') },
    tools: { node: process.version, vite: 'fixture', rolldown: 'fixture' },
    serializer: { package: 'yaml', version: 'fixture', modules: [{ id: 'yaml/fixture.js', renderedLength: 10 }], renderedLength: 10 },
    definition: 'Synthetic graph for parser rejection tests; no real bundling attribution claim.' };
  const graphPath = join(root, 'reports/bundling', `${assets[0].sha256}.json`); await writeFile(graphPath, JSON.stringify(graph));
  const checks = JSON.parse(await readFile(join(root, 'docs/testing/native-evidence-checks.json'))).profiles.showcase;
  const samples = Object.keys(performanceProtocol.budgets).flatMap(kind => Array.from({ length: 33 }, (_, index) => ({ kind, index,
    warmup: index < 3, startMs: index * 20, endMs: index * 20 + 10, durationMs: 10, status: 'passed' })));
  const report = { ...nativeOwnershipFixture(true), ...nativeLaunchFixture(), ...nativeForeignNoticeFixture(), mode: 'native-obsidian', status: 'passed', sourceCommit: 'a'.repeat(40), targetApp: '1.13.7', launcherVersion: '3.2.1',
    resolvedVersions: ['1.13.7', '1.13.7'], assets, installedAssets: assets, checks, errors: [],
    items: { mode: 'real-native-io-with-read-only-call-observer', restartQueryWrites: { calls: 0, active: 0, maximumActive: 0, failures: 0 } },
    performance: { schemaVersion: 1, mode: 'native-obsidian', status: 'passed', classification: 'shared-runner', sourceCommit: 'a'.repeat(40),
      sourceInputsDigest: (await sourceInputs(root)).digest, dependencyLockSha256: sha256(await readFile(join(root, 'package-lock.json'))),
      protocol: performanceProtocol, protocolSha256: sha256(JSON.stringify(performanceProtocol)), assets, samples,
      summary: summarizePerformance(samples), budgetStatus: 'within-proposed-budgets', sizes: await candidateSizes(join(root, 'dist'), join(root, 'reports/bundling')) } };
  const parse = value => adaptProducer('native', { native: JSON.stringify(value) }, root, ['scripts/testing/check-native.mjs'], 0);
  await assert.rejects(parse(report), /EVIDENCE_NATIVE_PROFILE/);
  await writeFile(profilePath, JSON.stringify({ profile: 'showcase' }));
  report.performance.sourceInputsDigest = (await sourceInputs(root)).digest;
  assert.equal((await parse(report)).status, 'passed');
  for (const change of [
    value => { value.performance.classification = 'universally-qualified'; },
    value => { value.performance.budgetStatus = 'exceeds-proposed-budgets'; },
    value => { value.performance.sizes.assets[0].gzipBytes += 1; },
    value => { value.performance.sizes.assets[0].sha256 = 'b'.repeat(64); },
    value => { value.performance.sizes.serializerAttribution.serializer.renderedLength += 1; },
    value => { value.resolvedVersions[0] = '1.12.0'; },
    value => { value.resolvedVersions[1] = 'latest'; },
  ]) {
    const changed = structuredClone(report); change(changed); await assert.rejects(parse(changed), /EVIDENCE_(PERFORMANCE|NATIVE_HOST_VERSION)/);
    assert.equal((await parse(report)).status, 'passed');
  }
  const changedGraph = structuredClone(graph); changedGraph.serializer.version = 'other-fixture';
  await writeFile(graphPath, JSON.stringify(changedGraph)); await assert.rejects(parse(report), /EVIDENCE_PERFORMANCE/);
});
