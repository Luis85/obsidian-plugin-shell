import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { sha256 } from './source-inputs.mjs';

export const performanceProtocol = Object.freeze({
  schemaVersion: 1, warmups: 3, samples: 30, clock: 'renderer performance.now()',
  percentile: 'nearest-rank: sorted[ceil(0.95 * n) - 1]', itemCount: 100,
  initialization: 'Immediately before await plugins.enablePlugin(id), after awaited disable; finish after runtime registration and empty diagnostics; excludes host startup and unload.',
  readiness: 'Immediately before workspace.getLeaf(tab).setViewState; finish after Documents click, 100 exact fixture labels, aria-busy=false and two animation frames; includes mount, query, render and paint opportunity.',
  fixture: '100 stable-ID plugin-data item records, labels Reference item 001 through 100; schema 1; collection revision 100; each record revision 1.',
  policy: 'Three retained warmups then 30 sequential samples per metric; no retries, outlier removal or early readiness marker. Correctness failures abort and retain partial results.',
  budgets: { 'warm-initialization': 200, 'items-readiness': 500 },
});

export function summarizePerformance(samples) {
  if (!Array.isArray(samples)) throw new Error('PERFORMANCE_SAMPLES_MISSING');
  const kinds = Object.keys(performanceProtocol.budgets); const batchSize = performanceProtocol.warmups + performanceProtocol.samples;
  if (samples.some((row, index) => row?.kind !== kinds[Math.floor(index / batchSize)])) throw new Error('PERFORMANCE_SAMPLE_ORDER');
  const summaries = [];
  for (const kind of Object.keys(performanceProtocol.budgets)) {
    const selected = samples.filter(row => row.kind === kind);
    if (selected.length !== performanceProtocol.warmups + performanceProtocol.samples) throw new Error(`PERFORMANCE_SAMPLE_COUNT:${kind}`);
    for (const [index, row] of selected.entries()) {
      if (row.index !== index || row.warmup !== (index < performanceProtocol.warmups)
        || row.status !== 'passed' || row.error !== undefined || !Number.isFinite(row.startMs) || !Number.isFinite(row.endMs)
        || row.startMs < 0 || row.endMs < row.startMs || row.durationMs !== row.endMs - row.startMs) throw new Error(`PERFORMANCE_INVALID_SAMPLE:${kind}:${index}`);
    }
    const measured = selected.filter(row => !row.warmup).map(row => row.durationMs).sort((a, b) => a - b);
    const p95Ms = measured[Math.ceil(measured.length * 0.95) - 1];
    summaries.push({ kind, samples: measured.length, p95Ms, budgetMs: performanceProtocol.budgets[kind], withinProposedBudget: p95Ms <= performanceProtocol.budgets[kind] });
  }
  if (samples.length !== (performanceProtocol.warmups + performanceProtocol.samples) * summaries.length) throw new Error('PERFORMANCE_UNKNOWN_SAMPLE');
  return summaries;
}

/** Read the candidate only. Compression does not rebuild, rewrite or replace any asset. */
export async function candidateSizes(directory, attributionDirectory = resolve('reports/bundling')) {
  const assets = [];
  for (const file of ['main.js', 'styles.css', 'manifest.json']) {
    const path = join(directory, file); const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size === 0) throw new Error(`PERFORMANCE_ASSET_INVALID:${file}`);
    const bytes = await readFile(path);
    const limitBytes = file === 'main.js' ? 1024 * 1024 : file === 'styles.css' ? 100 * 1024 : null;
    assets.push({ file, sha256: sha256(bytes), bytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 9 }).length,
      brotliBytes: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      limitBytes, withinBudget: limitBytes === null || bytes.length <= limitBytes });
  }
  const serializerAttribution = await readAttribution(attributionDirectory, assets[0]);
  return { schemaVersion: 1, mode: 'retained-asset-size', compression: { gzipLevel: 9, brotliQuality: 11, node: process.version }, assets, serializerAttribution,
    status: assets.every(asset => asset.withinBudget) ? 'passed' : 'failed' };
}

async function readAttribution(directory, asset) {
  let bytes;
  try {
    const path = join(directory, `${asset.sha256}.json`); const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || !stat.size) throw new Error('PERFORMANCE_ATTRIBUTION_INVALID');
    bytes = await readFile(path);
  }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { package: 'yaml', status: 'unattributed', reason: 'The accepted build module graph is unavailable. Aggregate bytes cannot establish serializer contribution.' };
  }
  const report = JSON.parse(bytes.toString('utf8')); const serializer = report.serializer;
  if (report.schemaVersion !== 1 || report.mode !== 'build-module-attribution' || report.asset?.file !== 'main.js'
    || report.asset?.sha256 !== asset.sha256 || report.asset?.bytes !== asset.bytes || serializer?.package !== 'yaml'
    || typeof serializer.version !== 'string' || !Array.isArray(serializer.modules) || !serializer.modules.length
    || serializer.modules.some(module => typeof module.id !== 'string' || !module.id.startsWith('yaml/') || !Number.isSafeInteger(module.renderedLength) || module.renderedLength < 0)
    || new Set(serializer.modules.map(module => module.id)).size !== serializer.modules.length
    || serializer.renderedLength !== serializer.modules.reduce((sum, module) => sum + module.renderedLength, 0)
    || !report.tools?.node || !report.tools?.vite || !report.tools?.rolldown || typeof report.definition !== 'string') throw new Error('PERFORMANCE_ATTRIBUTION_INVALID');
  return { ...report, status: 'measured', reportSha256: sha256(bytes) };
}
