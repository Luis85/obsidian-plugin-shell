import { relative, resolve } from 'node:path';

export function object(value, keys, code = 'EVIDENCE_SCHEMA') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(code);
}
function integer(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('EVIDENCE_COUNTS');
  return value;
}
function fileName(root, file) {
  if (typeof file !== 'string') throw new Error('EVIDENCE_CASE_FILE');
  const path = relative(root, resolve(root, file)).replaceAll('\\', '/');
  if (!path || path.startsWith('..')) throw new Error('EVIDENCE_CASE_FILE');
  return path;
}
function item(file, name, mode, status, attempt = 0, repetition = 0) {
  if (typeof name !== 'string' || !name || !['passed', 'failed', 'skipped', 'pending', 'todo', 'disabled', 'timedOut', 'interrupted'].includes(status)) throw new Error('EVIDENCE_CASE');
  return { file, name, mode, status, attempt: integer(attempt), repetition: integer(repetition) };
}
export function vitestReport(raw, root, attempts) {
  object(raw, ['numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests', 'snapshot', 'startTime', 'success', 'testResults', 'coverageMap']);
  if (!Array.isArray(raw.testResults) || !raw.testResults.length) throw new Error('EVIDENCE_EMPTY');
  const totalSuites = integer(raw.numTotalTestSuites);
  const passedSuites = integer(raw.numPassedTestSuites);
  const failedSuites = integer(raw.numFailedTestSuites);
  const pendingSuites = integer(raw.numPendingTestSuites);
  if (!totalSuites || totalSuites < raw.testResults.length || totalSuites !== passedSuites + failedSuites + pendingSuites) throw new Error('EVIDENCE_COUNTS');
  object(attempts, ['schemaVersion', 'reason', 'unhandledErrors', 'cases']);
  if (attempts.schemaVersion !== 1 || !Array.isArray(attempts.cases) || !Array.isArray(attempts.unhandledErrors)) throw new Error('EVIDENCE_ATTEMPTS');
  const cases = raw.testResults.flatMap(suite => {
    if (!Array.isArray(suite.assertionResults) || !suite.assertionResults.length || !['passed', 'failed'].includes(suite.status)) throw new Error('EVIDENCE_EMPTY_SUITE');
    if ((suite.status === 'failed' && failedSuites === 0) || (suite.status === 'passed' && suite.assertionResults.some(test => test.status === 'failed'))) throw new Error('EVIDENCE_STATUS');
    const file = fileName(root, suite.name);
    return suite.assertionResults.map(test => {
      const diagnostics = attempts.cases.filter(entry => fileName(root, entry.file) === file && entry.name === test.fullName);
      if (diagnostics.length !== 1) throw new Error('EVIDENCE_ATTEMPTS');
      const diagnostic = diagnostics[0];
      object(diagnostic, ['file', 'name', 'status', 'retry', 'repeat', 'flaky', 'errors']);
      if (!Array.isArray(diagnostic.errors) || typeof diagnostic.flaky !== 'boolean') throw new Error('EVIDENCE_ATTEMPTS');
      if (diagnostic.status !== (test.status === 'todo' ? 'skipped' : test.status)) throw new Error('EVIDENCE_STATUS');
      return item(file, test.fullName, file.endsWith('-components.test.ts') ? 'component' : 'unit', diagnostic.flaky || diagnostic.errors.length ? 'failed' : test.status, diagnostic.retry, diagnostic.repeat);
    });
  });
  const counts = { total: integer(raw.numTotalTests), passed: integer(raw.numPassedTests), failed: integer(raw.numFailedTests), skipped: integer(raw.numPendingTests) + integer(raw.numTodoTests ?? 0) };
  const assertions = raw.testResults.flatMap(suite => suite.assertionResults);
  if (counts.total !== cases.length || counts.passed !== assertions.filter(test => test.status === 'passed').length || counts.failed !== assertions.filter(test => test.status === 'failed').length || counts.total !== counts.passed + counts.failed + counts.skipped) throw new Error('EVIDENCE_COUNTS');
  if (attempts.cases.length !== cases.length) throw new Error('EVIDENCE_ATTEMPTS');
  return { cases, frameworkPassed: raw.success === true && passedSuites === totalSuites && raw.testResults.every(suite => suite.status === 'passed') && attempts.reason === 'passed' && !attempts.unhandledErrors.length };
}
export function playwrightReport(raw, root) {
  object(raw, ['config', 'suites', 'errors', 'stats']);
  if (!Array.isArray(raw.suites) || !Array.isArray(raw.errors) || !raw.stats) throw new Error('EVIDENCE_SCHEMA');
  const cases = [];
  let specs = 0;
  function visit(suite, parents = []) {
    for (const spec of suite.specs ?? []) {
      specs += 1;
      if (!Array.isArray(spec.tests) || !spec.tests.length) throw new Error('EVIDENCE_EMPTY');
      for (const test of spec.tests) {
        if (!Array.isArray(test.results) || !test.results.length) throw new Error('EVIDENCE_EMPTY');
        for (const result of test.results) cases.push(item(fileName(root, spec.file.startsWith('tests/') ? spec.file : `tests/e2e/${spec.file}`), [...parents, spec.title, test.projectName ?? ''].filter(Boolean).join(' > '), 'browser-integrated', result.status, result.retry, test.repeatEachIndex ?? 0));
        if (test.expectedStatus !== 'passed' || test.status !== 'expected') cases.at(-1).status = 'failed';
      }
    }
    for (const child of suite.suites ?? []) visit(child, [...parents, child.title]);
  }
  for (const suite of raw.suites) visit(suite);
  const total = ['expected', 'unexpected', 'flaky', 'skipped'].reduce((sum, key) => sum + integer(raw.stats[key]), 0);
  if (total !== specs || !cases.length) throw new Error('EVIDENCE_COUNTS');
  return { cases, frameworkPassed: !raw.errors.length && !raw.stats.unexpected && !raw.stats.flaky && !raw.stats.skipped };
}
export function toolingReport(text, root) {
  const rows = text.trim().split('\n').map(line => JSON.parse(line));
  for (const row of rows) {
    object(row, row.kind === 'summary' ? ['kind', 'schemaVersion', 'success', 'counts'] : ['kind', 'schemaVersion', 'name', 'file', 'status', 'type', 'nesting', 'error']);
    if (row.schemaVersion !== 1 || !['case', 'summary'].includes(row.kind)) throw new Error('EVIDENCE_SCHEMA');
  }
  const summaries = rows.filter(row => row.kind === 'summary');
  if (summaries.length !== 1) throw new Error('EVIDENCE_SUMMARY');
  const summary = summaries[0];
  const cases = rows.filter(row => row.kind === 'case' && row.type === 'test').map(row => {
    if (resolve(root, row.name) === resolve(root, row.file)) throw new Error('EVIDENCE_EMPTY_SUITE');
    const file = fileName(root, row.file);
    return item(file, row.name, file.startsWith('tests/tooling/evidence-') ? 'node-baseline' : 'tooling-generated', row.status);
  });
  if (integer(summary.counts.tests) !== cases.length || integer(summary.counts.passed) !== cases.filter(test => test.status === 'passed').length) throw new Error('EVIDENCE_COUNTS');
  const windowsOnly = new Map([
    ['[PLAN-03-09] Windows root case aliases support setup while destination case collisions still fail', 'tests/tooling/file-plan.checks.mjs'],
    ['[PLAN-03-10] real Windows 8.3 aliases support safe plans and dependency-free setup dry run', 'tests/tooling/file-plan.checks.mjs'],
    ['[MAKER-SHORT-PATH] generated DOM tests run when the temporary parent uses a real Windows 8.3 alias', 'tests/tooling/maker-paths.checks.mjs'],
    ['[NATIVE-ISOLATION-03] Windows case aliases produce canonical requested vault paths', 'tests/tooling/native-isolation.checks.mjs'],
  ]);
  const expectedPlatformSkips = process.platform === 'win32' ? [] : cases.filter(test => test.status === 'skipped' && windowsOnly.get(test.name) === test.file).map(test => ({ file: test.file, name: test.name }));
  return { cases, expectedPlatformSkips, frameworkPassed: summary.success === true && rows.every(row => row.status !== 'failed') && ['failed', 'cancelled', 'todo'].every(key => integer(summary.counts[key]) === 0) && integer(summary.counts.skipped) === expectedPlatformSkips.length };
}
export function artifactReport(raw) {
  object(raw, ['mode', 'nativeHostTested', 'assets']);
  if (raw.mode !== 'artifact-static' || raw.nativeHostTested !== false || !Array.isArray(raw.assets) || raw.assets.length !== 3) throw new Error('EVIDENCE_ARTIFACT');
  const assets = assetRecords(raw.assets, true);
  return { cases: [item('scripts/quality/check-artifacts.mjs', 'complete artifact ownership, provenance and size gate', 'artifact', 'passed')], frameworkPassed: true, assets: assets.map(asset => ({ ...asset, file: `dist/${asset.file}` })) };
}
function assetRecords(assets, requireBytes = false) {
  if (!Array.isArray(assets) || JSON.stringify(assets.map(asset => asset?.file).sort()) !== JSON.stringify(['main.js', 'manifest.json', 'styles.css'])) throw new Error('EVIDENCE_ASSET_INVENTORY');
  for (const asset of assets) {
    object(asset, ['file', 'bytes', 'sha256']);
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || (requireBytes && (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1))) throw new Error('EVIDENCE_ASSET_SCHEMA');
  }
  return assets;
}
export function nativeReport(raw, expectedChecks) {
  object(raw, ['mode', 'status', 'sourceCommit', 'targetApp', 'attemptDirectory', 'assets', 'checks', 'errors', 'identity', 'launcherVersion', 'resolvedVersions', 'window', 'installedAssets', 'userAgent', 'headerContract', 'themeTransitions', 'phase', 'reason', 'themeFailure', 'nativeControlLabels', 'visibleText', 'cleanupFailure', 'scratchPreserved', 'profile', 'generatedViewCommands', 'repository', 'items', 'itemOwnership', 'performance']);
  if (raw.mode !== 'native-obsidian' || !Array.isArray(raw.checks) || !Array.isArray(raw.errors) || !Array.isArray(raw.assets)) throw new Error('EVIDENCE_NATIVE');
  assetRecords(raw.assets); assetRecords(raw.installedAssets);
  if (new Set(raw.checks).size !== raw.checks.length || JSON.stringify([...raw.checks].sort()) !== JSON.stringify([...expectedChecks].sort())) throw new Error('EVIDENCE_NATIVE_CHECKS');
  if (raw.launcherVersion !== '3.2.1' || raw.targetApp !== '1.13.7' || !Array.isArray(raw.resolvedVersions) || raw.resolvedVersions.length !== 2 || !Array.isArray(raw.installedAssets) || raw.assets.length !== 3 || raw.installedAssets.length !== 3 || raw.assets.some(asset => !raw.installedAssets.some(installed => installed.file === asset.file && installed.sha256 === asset.sha256))) throw new Error('EVIDENCE_NATIVE_IDENTITY');
  if (raw.resolvedVersions[0] !== raw.targetApp || typeof raw.resolvedVersions[1] !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(raw.resolvedVersions[1])) throw new Error('EVIDENCE_NATIVE_HOST_VERSION');
  if (expectedChecks.includes('native-items-controlled-adapter-rejection-retains-draft-no-success')) {
    if (raw.itemOwnership?.mode !== 'controlled-adapter-in-native-host' || raw.itemOwnership.status !== 'passed' || raw.itemOwnership.reason || raw.itemOwnership.cleanupFailure || raw.itemOwnership.nativeDiskFailure !== false || JSON.stringify(raw.itemOwnership.counts) !== JSON.stringify({ calls: 2, completed: 1, failed: 1 }) || raw.itemOwnership.diagnostics?.length !== 1 || raw.itemOwnership.diagnostics[0].code !== 'settings.write' || raw.itemOwnership.diagnostics[0].operation !== 'settings.save') throw new Error('EVIDENCE_NATIVE_CONTROL');
    if (raw.items?.mode !== 'real-native-io-with-read-only-call-observer' || JSON.stringify(raw.items.restartQueryWrites) !== JSON.stringify({ calls: 0, active: 0, maximumActive: 0, failures: 0 })) throw new Error('EVIDENCE_NATIVE_CONTROL');
  }
  return { cases: raw.checks.map(name => item('scripts/testing/check-native.mjs', name, 'native', raw.status === 'passed' ? 'passed' : 'failed')),
    frameworkPassed: raw.status === 'passed' && !raw.errors.length && !raw.cleanupFailure && !raw.scratchPreserved && !raw.reason,
    candidateSource: raw.sourceCommit, adapterControlScope: raw.itemOwnership?.mode ?? null, assets: raw.assets.map(asset => ({ ...asset, file: `dist/${asset.file}` })) };
}
export function completeResult(result, files, exitCode) {
  if (!result.cases.length) throw new Error('EVIDENCE_EMPTY');
  const identities = result.cases.map(test => JSON.stringify([test.file, test.name, test.attempt, test.repetition]));
  if (new Set(identities).size !== identities.length) throw new Error('EVIDENCE_DUPLICATE_CASE');
  const actual = [...new Set(result.cases.map(test => test.file))].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...files].sort())) throw new Error('EVIDENCE_SUITE_INVENTORY');
  const counts = { total: result.cases.length, passed: result.cases.filter(test => test.status === 'passed').length, expectedPlatformSkips: result.expectedPlatformSkips?.length ?? 0 };
  const passing = test => (test.status === 'passed' || (test.status === 'skipped' && result.expectedPlatformSkips?.some(skip => skip.file === test.file && skip.name === test.name))) && test.attempt === 0 && test.repetition === 0;
  return { ...result, counts, status: exitCode === 0 && result.frameworkPassed && result.cases.every(passing) ? 'passed' : 'failed' };
}
