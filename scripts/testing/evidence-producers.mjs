import { readFile, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { vitestReport, playwrightReport, toolingReport, artifactReport, nativeReport, completeResult, object } from './evidence-adapters.mjs';
import { assertCoverageGates } from '../quality/coverage-inventory.mjs';
import { filesUnder } from './evidence-identity.mjs';
import { performanceProtocol, summarizePerformance, candidateSizes } from './performance-report.mjs';
import { sourceInputs, sha256 } from './source-inputs.mjs';

// Version 2 separates a browser framework report from console diagnostics. Historical
// version 1 parsing remains explicit; it is never a fallback for a missing new report.
export const evidencePacketVersion = 2;
export function producerRawKeys(producer, version = evidencePacketVersion) {
  if (![1, evidencePacketVersion].includes(version)) throw new Error('EVIDENCE_SCHEMA');
  return ['stdout', 'stderr', ...(['runtime', 'coverage'].includes(producer) ? ['framework', 'attempts'] : []),
    ...(producer === 'browser' && version === 2 ? ['framework'] : []),
    ...(['coverage', 'native'].includes(producer) ? [producer] : [])];
}
export function producerEnvironment(producer, output, candidate, parent = process.env) {
  const env = { ...parent, TZ: 'UTC', LANG: 'C.UTF-8', NODE_OPTIONS: '', FORCE_COLOR: '0', SHELL_EVIDENCE_OUTPUT: output };
  delete env.NODE_TEST_CONTEXT;
  // Windows environment keys are case-insensitive; preserve unrelated configuration.
  for (const key of Object.keys(env)) if (key.toUpperCase().startsWith('PLAYWRIGHT_JSON_OUTPUT')) delete env[key];
  if (producer === 'browser') env.PLAYWRIGHT_JSON_OUTPUT_FILE = join(output, 'framework.json');
  if (candidate) env.GITHUB_SHA = candidate.sourceCommit;
  return env;
}
/** Read only the current run's fixed report; never reuse a prior file or parse a console substring. */
export async function readFrameworkReport(output) {
  const path = join(output, 'framework.json'), limit = 32_000_000;
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) throw new Error('EVIDENCE_REPORT_FILE');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const actual = await handle.stat();
    if (!actual.isFile() || actual.nlink !== 1 || actual.dev !== entry.dev || actual.ino !== entry.ino) throw new Error('EVIDENCE_REPORT_FILE');
    if (actual.size > limit) throw new Error('EVIDENCE_REPORT_LIMIT');
    const chunks = []; let size = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      size += chunk.length;
      if (size > limit) throw new Error('EVIDENCE_REPORT_LIMIT');
      chunks.push(chunk);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
  } finally { await handle.close(); }
}

// Trusted code owns commands and modes. Reports cannot supply hooks or arguments.
export function producerCommand(root, producer, files, output) {
  switch (producer) {
    case 'runtime': return ['node_modules/vitest/vitest.mjs', 'run', '--retry=0', '--allowOnly=false', '--reporter=json', '--reporter=./scripts/testing/evidence-vitest-reporter.mjs', `--outputFile=${join(output, 'framework.json')}`];
    case 'coverage': return ['node_modules/vitest/vitest.mjs', 'run', '--retry=0', '--allowOnly=false', '--coverage', '--config', 'configs/testing/vitest.production.config.mjs', '--reporter=json', '--reporter=./scripts/testing/evidence-vitest-reporter.mjs', `--outputFile=${join(output, 'framework.json')}`];
    case 'browser': return ['node_modules/@playwright/test/cli.js', 'test', '--retries=0', '--repeat-each=1', '--forbid-only', '--reporter=json'];
    case 'tooling': return ['--unhandled-rejections=strict', '--test', '--test-concurrency=1', `--test-reporter=${pathToFileURL(join(root, 'scripts/testing/node-reporter.mjs')).href}`, ...files];
    case 'artifact': return ['scripts/quality/check-artifacts.mjs'];
    case 'native': return ['scripts/testing/check-native.mjs', '--allow-download'];
    default: throw new Error('EVIDENCE_PRODUCER');
  }
}
async function nativePerformance(report, root) {
  const value = report.performance;
  const summary = summarizePerformance(value.samples);
  const budgetStatus = summary.every(metric => metric.withinProposedBudget) ? 'within-proposed-budgets' : 'exceeds-proposed-budgets';
  if (!['controlled-reference', 'shared-runner'].includes(value.classification) || value.budgetStatus !== budgetStatus) throw new Error('EVIDENCE_PERFORMANCE_CLASSIFICATION');
  const sizes = await candidateSizes(join(root, 'dist'), join(root, 'reports/bundling'));
  if (value.schemaVersion !== 1 || value.status !== 'passed' || value.reason || value.cleanupFailure || value.mode !== 'native-obsidian'
    || value.sourceCommit !== report.sourceCommit || value.sourceInputsDigest !== (await sourceInputs(root)).digest
    || value.dependencyLockSha256 !== sha256(await readFile(join(root, 'package-lock.json')))
    || value.protocolSha256 !== sha256(JSON.stringify(performanceProtocol)) || JSON.stringify(value.protocol) !== JSON.stringify(performanceProtocol)
    || JSON.stringify(value.assets) !== JSON.stringify(report.assets) || JSON.stringify(value.summary) !== JSON.stringify(summary)
    || JSON.stringify(value.sizes) !== JSON.stringify(sizes) || sizes.status !== 'passed' || sizes.serializerAttribution.status !== 'measured'
    || sizes.assets.some(asset => !report.assets.some(expected => expected.file === asset.file && expected.sha256 === asset.sha256))) throw new Error('EVIDENCE_PERFORMANCE');
  return { classification: value.classification, summary, budgetStatus };
}
export async function adaptProducer(producer, raw, root, files, exitCode, version = evidencePacketVersion) {
  producerRawKeys(producer, version);
  let result;
  if (producer === 'runtime' || producer === 'coverage') result = vitestReport(JSON.parse(raw.framework), root, JSON.parse(raw.attempts));
  else if (producer === 'browser') {
    const text = version === 1 ? raw.stdout : raw.framework;
    if (typeof text !== 'string' || !text.length) throw new Error('EVIDENCE_REPORT_MISSING');
    result = playwrightReport(JSON.parse(text), root);
  }
  else if (producer === 'tooling') result = toolingReport(raw.stdout, root);
  else if (producer === 'artifact') result = artifactReport(JSON.parse(raw.stdout));
  else if (producer === 'native') {
    const expected = JSON.parse(await readFile(join(root, 'docs/testing/native-evidence-checks.json'), 'utf8'));
    object(expected, ['schemaVersion', 'profiles']);
    let profile = 'showcase';
    try {
      const configured = JSON.parse(await readFile(join(root, 'scripts/testing/native-profile.json'), 'utf8'));
      object(configured, ['profile']); profile = configured.profile;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (expected.schemaVersion !== 1 || !['foundation', 'showcase'].includes(profile) || !Array.isArray(expected.profiles[profile])) throw new Error('EVIDENCE_NATIVE_POLICY');
    const report = JSON.parse(raw.native); const checks = [...expected.profiles[profile]];
    if ((report.profile ?? 'showcase') !== profile) throw new Error('EVIDENCE_NATIVE_PROFILE');
    if (profile === 'foundation' && Array.isArray(report.generatedViewCommands) && report.generatedViewCommands.length) checks.push('native-consumer-generated-view-commands-open-and-reuse-owned-leaves');
    result = nativeReport(report, checks);
    if (report.performance) result.performance = await nativePerformance(report, root);
  } else throw new Error('EVIDENCE_PRODUCER');
  if (producer === 'coverage') {
    const sources = await filesUnder(root, 'src', /\.(ts|vue)$/);
    // Coverage paths are absolute in the real framework output. The existing gate
    // uses the current root for its independent business-domain floor.
    if (root !== process.cwd()) throw new Error('EVIDENCE_COVERAGE_ROOT');
    result.coverage = assertCoverageGates(JSON.parse(raw.coverage), sources);
  }
  return completeResult(result, files, exitCode);
}
