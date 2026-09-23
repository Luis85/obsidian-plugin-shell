import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performanceProtocol, summarizePerformance, candidateSizes } from '../../scripts/testing/performance-report.mjs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function samples() {
  return Object.keys(performanceProtocol.budgets).flatMap(kind => Array.from({ length: 33 }, (_, index) => ({ kind, index, warmup: index < 3, startMs: 100, endMs: 100 + index, durationMs: index, status: 'passed' })));
}
test('performance summary uses all 30 measured samples and nearest-rank p95 without discarding slow samples', () => {
  const raw = samples(); raw[32].endMs = 1100; raw[32].durationMs = 1000;
  const result = summarizePerformance(raw);
  assert.equal(result[0].p95Ms, 31); assert.equal(result[0].samples, 30);
  raw[31].endMs = 1100; raw[31].durationMs = 1000;
  assert.equal(summarizePerformance(raw)[0].withinProposedBudget, false);
});
test('performance controls reject missing, duplicate, failed warmup, malformed, extra and wrong-clock samples', () => {
  for (const mutate of [rows => rows.pop(), rows => { rows[1] = { ...rows[0] }; }, rows => { rows[0].status = 'failed'; },
    rows => { rows[4].durationMs = Number.NaN; }, rows => rows.push({ ...rows[0], kind: 'unknown' }), rows => { rows[8].endMs = 0; },
    rows => { rows[5].warmup = true; }, rows => { rows[5].error = 'retained failure'; }, rows => rows.reverse()]) {
    const raw = samples(); mutate(raw); assert.throws(() => summarizePerformance(raw), /PERFORMANCE_/);
  }
  assert.throws(() => summarizePerformance(null), /PERFORMANCE_SAMPLES_MISSING/);
});
test('candidate diagnostics compress existing bytes without rewriting and enforce uncompressed budgets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shell-size-'));
  try {
    for (const file of ['main.js', 'styles.css', 'manifest.json']) await writeFile(join(directory, file), file.repeat(100));
    const before = await readFile(join(directory, 'main.js')); const valid = await candidateSizes(directory);
    assert.equal(valid.status, 'passed'); assert.equal(valid.assets[0].bytes, before.length);
    assert.ok(valid.assets[0].gzipBytes < before.length); assert.deepEqual(await readFile(join(directory, 'main.js')), before);
    const attribution = { schemaVersion: 1, mode: 'build-module-attribution', asset: valid.assets[0], tools: { node: process.version, vite: '8.3.0', rolldown: '1.0.0' },
      serializer: { package: 'yaml', version: '2.9.1', modules: [{ id: 'yaml/a.js', renderedLength: 50 }], renderedLength: 50 }, definition: 'Test graph fixture' };
    const graphPath = join(directory, `${valid.assets[0].sha256}.json`);
    await writeFile(graphPath, JSON.stringify(attribution));
    assert.equal((await candidateSizes(directory, directory)).serializerAttribution.status, 'measured');
    for (const invalid of [{ ...attribution, schemaVersion: 2 }, { ...attribution, asset: { ...attribution.asset, sha256: 'wrong' } },
      { ...attribution, serializer: { ...attribution.serializer, modules: [] } }, { ...attribution, serializer: { ...attribution.serializer, renderedLength: 0 } }]) {
      await writeFile(graphPath, JSON.stringify(invalid)); await assert.rejects(candidateSizes(directory, directory), /PERFORMANCE_ATTRIBUTION_INVALID/);
    }
    const cli = () => spawnSync(process.execPath, ['scripts/testing/asset-sizes.mjs', directory], { encoding: 'utf8' });
    const success = cli(); assert.equal(success.status, 0, success.stderr); assert.equal(JSON.parse(success.stdout).status, 'passed');
    await writeFile(join(directory, 'styles.css'), Buffer.alloc(100 * 1024 + 1));
    assert.equal((await candidateSizes(directory)).status, 'failed');
    const oversized = cli(); assert.equal(oversized.status, 1); assert.equal(JSON.parse(oversized.stdout).status, 'failed');
    await writeFile(join(directory, 'styles.css'), ''); await assert.rejects(candidateSizes(directory), /PERFORMANCE_ASSET_INVALID/);
    assert.equal(cli().status, 1);
    await writeFile(join(directory, 'styles.css'), 'body{}');
    await rm(join(directory, 'manifest.json')); await assert.rejects(candidateSizes(directory), /ENOENT/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
