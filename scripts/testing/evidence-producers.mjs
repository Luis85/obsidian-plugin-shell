import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { vitestReport, playwrightReport, toolingReport, artifactReport, nativeReport, completeResult, object } from './evidence-adapters.mjs';
import { assertCoverageGates } from '../quality/coverage-inventory.mjs';
import { filesUnder } from './evidence-identity.mjs';
import { performanceProtocol, summarizePerformance, candidateSizes } from './performance-report.mjs';
import { sourceInputs, sha256 } from './source-inputs.mjs';

// Trusted code owns commands and modes. Reports cannot supply hooks or arguments.
export function producerCommand(root, producer, files, output) {
  switch (producer) {
    case 'runtime': return ['node_modules/vitest/vitest.mjs', 'run', '--retry=0', '--allowOnly=false', '--reporter=json', '--reporter=./scripts/testing/evidence-vitest-reporter.mjs', `--outputFile=${join(output, 'framework.json')}`];
    case 'coverage': return ['node_modules/vitest/vitest.mjs', 'run', '--retry=0', '--allowOnly=false', '--coverage', '--config', 'vitest.production.config.mjs', '--reporter=json', '--reporter=./scripts/testing/evidence-vitest-reporter.mjs', `--outputFile=${join(output, 'framework.json')}`];
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
export async function adaptProducer(producer, raw, root, files, exitCode) {
  let result;
  if (producer === 'runtime' || producer === 'coverage') result = vitestReport(JSON.parse(raw.framework), root, JSON.parse(raw.attempts));
  else if (producer === 'browser') result = playwrightReport(JSON.parse(raw.stdout), root);
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
