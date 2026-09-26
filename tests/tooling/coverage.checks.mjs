import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertCoverageInventory, assertCoverageGates, assertSelectedCoreGate } from '../../scripts/quality/coverage-inventory.mjs';
test('[COV-02-01] silently omitted production input makes the coverage inventory fail', () => {
  const source = resolve('src/bootstrap/mount-ui.ts');
  assert.throws(() => assertCoverageInventory({ total: {}, [source]: {} }, [source, 'src/main.ts']), /INCOMPLETE_PRODUCTION_COVERAGE/);
  assert.throws(() => assertCoverageInventory({ [source]: {} }, [source]), /MISSING_COVERAGE_TOTAL/);
  assert.equal(assertCoverageInventory({ total: {}, [source]: {} }, [source]).productionInputs, 1);
});
test('[COV-03-02] the actual CLI fails closed for deficient, omitted and malformed production reports', () => {
  const root = mkdtempSync(join(tmpdir(), 'shell-coverage-')); const script = resolve('scripts/quality/coverage-inventory.mjs');
  try {
    mkdirSync(join(root, 'src/domain'), { recursive: true }); mkdirSync(join(root, 'reports/production-coverage'), { recursive: true });
    const source = join(root, 'src/domain/value.ts'); writeFileSync(source, 'export const value = 1;');
    const report = join(root, 'reports/production-coverage/coverage-summary.json');
    const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', timeout: 10000 });
    writeFileSync(report, JSON.stringify({ total: counts(), [source]: counts() })); assert.equal(run().status, 0);
    for (const value of [{ total: counts(), [source]: counts(89) }, { total: counts() }, { total: counts(), [source]: {} },
      { total: counts(0, 0), [source]: counts(0, 0) }, { total: counts(), [source]: counts(1e308, 1e308) }, { total: {}, [source]: counts() }]) {
      writeFileSync(report, JSON.stringify(value)); const result = run(); assert.equal(result.status, 1); assert.match(result.stderr, /COVERAGE/);
    }
    const second = join(root, 'src/domain/second.ts'); writeFileSync(second, 'export const second = 2;');
    writeFileSync(report, JSON.stringify({ total: counts(), [source]: counts(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), [second]: counts() }));
    const overflow = run(); assert.equal(overflow.status, 1); assert.match(overflow.stderr, /INVALID_COVERAGE_SUM/);
    mkdirSync(join(root, 'src/features/tasks'), { recursive: true }); mkdirSync(join(root, 'src/presentation'), { recursive: true });
    const feature = join(root, 'src/features/tasks/entity.ts'); const view = join(root, 'src/presentation/view.vue');
    writeFileSync(feature, 'export const task = 1;'); writeFileSync(view, '<template>View</template>');
    // Global coverage is 95%, but business coverage is 93.33%; moving code to a
    // feature must not silently remove it from the stricter denominator.
    writeFileSync(report, JSON.stringify({ total: counts(380, 400), [source]: counts(), [second]: counts(), [feature]: counts(80), [view]: counts() }));
    const featureFailure = run(); assert.equal(featureFailure.status, 1); assert.match(featureFailure.stderr, /domainApplicationFeatures.lines/);
    writeFileSync(report, JSON.stringify({ total: counts(385, 400), [source]: counts(), [second]: counts(), [feature]: counts(85), [view]: counts() }));
    assert.equal(run().status, 0);
    writeFileSync(report, '{ malformed'); assert.equal(run().status, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
const counts = (covered = 100, total = 100) => Object.fromEntries(['lines', 'statements', 'functions', 'branches'].map(key => [key, { total, covered, pct: total ? 100 * covered / total : 100 }]));
test('[COV-03-01] production and domain/application/features thresholds are independent and validate raw counts', () => {
  const domain = resolve('src/domain/example.ts'); const view = resolve('src/presentation/example.vue');
  const report = { total: counts(200, 200), [domain]: counts(), [view]: counts() };
  assert.equal(assertCoverageGates(report, [domain, view]).scopes.production.lines.pct, 100);
  assert.throws(() => assertCoverageGates({ ...report, [domain]: counts(94) }, [domain, view]), /domainApplicationFeatures.lines/);
  assert.throws(() => assertCoverageGates({ ...report, [view]: counts(70) }, [domain, view]), /production.lines/);
  for (const metric of ['lines', 'statements', 'functions', 'branches']) {
    const value = { ...counts(), [metric]: { total: 100, covered: 0, pct: 100 } };
    assert.throws(() => assertCoverageGates({ ...report, [domain]: value }, [domain, view]), /COVERAGE_BELOW_THRESHOLD/);
    for (const invalid of [null, { total: -1, covered: 0 }, { total: 1, covered: 2 }, { total: 100, covered: NaN }]) {
      assert.throws(() => assertCoverageGates({ ...report, [view]: { ...counts(), [metric]: invalid } }, [domain, view]), /INVALID_COVERAGE_METRIC/);
    }
  }
  assert.throws(() => assertCoverageGates(null, [domain]), /INVALID_COVERAGE_REPORT/);
  assert.throws(() => assertCoverageGates({ total: counts(), [view]: counts() }, [view]), /EMPTY_COVERAGE_SCOPE/);
  assert.throws(() => assertCoverageGates({ total: counts(), [domain]: counts(0, 0), [view]: counts() }, [domain, view]), /EMPTY_COVERAGE_SCOPE: domainApplicationFeatures/);
  assert.throws(() => assertCoverageGates({ ...report, total: counts(199, 200) }, [domain, view]), /INCONSISTENT_COVERAGE_TOTAL/);
});
test('[COV-04-01] the selected-core gate reads its own scope and thresholds from the shared production run', () => {
  const domain = resolve('src/domain/example.ts'); const view = resolve('src/presentation/example.vue');
  const floors = { lines: 95, statements: 90, functions: 90, branches: 90 };
  const report = { total: counts(200, 200), [domain]: counts(), [view]: counts(10) };
  const result = assertSelectedCoreGate(report, [domain], floors);
  assert.equal(result.selectedCoreInputs, 1); assert.equal(result.totals.lines.pct, 100);
  assert.throws(() => assertSelectedCoreGate({ ...report, [domain]: counts(94) }, [domain], floors), /selectedCore.lines/);
  assert.throws(() => assertSelectedCoreGate({ ...report, [domain]: { ...counts(), branches: { total: 100, covered: 89, pct: 89 } } }, [domain], floors), /selectedCore.branches/);
  assert.throws(() => assertSelectedCoreGate(report, [domain, resolve('src/domain/omitted.ts')], floors), /INCOMPLETE_SELECTED_CORE_COVERAGE/);
  assert.throws(() => assertSelectedCoreGate(report, [], floors), /EMPTY_COVERAGE_SCOPE: selectedCore/);
  assert.throws(() => assertSelectedCoreGate({ ...report, [domain]: counts(0, 0) }, [domain], floors), /EMPTY_COVERAGE_SCOPE: selectedCore.lines/);
  assert.throws(() => assertSelectedCoreGate(report, [domain], { ...floors, branches: undefined }), /INVALID_SELECTED_CORE_THRESHOLDS/);
  assert.throws(() => assertSelectedCoreGate(null, [domain], floors), /INVALID_COVERAGE_REPORT/);
});
test('[COV-04-02] the CLI applies the selected-core config only when requested and fails closed below its floor', () => {
  const root = mkdtempSync(join(tmpdir(), 'shell-core-coverage-')); const script = resolve('scripts/quality/coverage-inventory.mjs');
  try {
    mkdirSync(join(root, 'src/domain'), { recursive: true }); mkdirSync(join(root, 'src/presentation'), { recursive: true }); mkdirSync(join(root, 'reports/production-coverage'), { recursive: true });
    const domain = join(root, 'src/domain/value.ts'); const view = join(root, 'src/presentation/view.vue');
    writeFileSync(domain, 'export const value = 1;'); writeFileSync(view, '<template>View</template>');
    writeFileSync(join(root, 'vitest.config.mjs'), "export default { test: { coverage: { include: ['src/domain/**/*.ts'], thresholds: { lines: 99, statements: 90, functions: 90, branches: 90 } } } };");
    const report = join(root, 'reports/production-coverage/coverage-summary.json');
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', timeout: 10000 });
    // Production (90%) and business (95%) floors pass at 97%; only the selected-core 99% line floor fails.
    writeFileSync(report, JSON.stringify({ total: counts(194, 200), [domain]: counts(97), [view]: counts(97) }));
    assert.equal(run().status, 0);
    const failed = run('--selected-core'); assert.equal(failed.status, 1); assert.match(failed.stderr, /selectedCore.lines/);
    writeFileSync(report, JSON.stringify({ total: counts(199, 200), [domain]: counts(), [view]: counts(99) }));
    const passed = run('--selected-core'); assert.equal(passed.status, 0, passed.stderr); assert.equal(JSON.parse(passed.stdout).selectedCore.selectedCoreInputs, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
