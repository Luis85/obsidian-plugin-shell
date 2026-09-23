import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { evidenceFixture, evidenceCli, producedPacket } from './evidence-fixture.mjs';
import { runEvidence } from '../../scripts/testing/evidence-runner.mjs';

test('real producer retains exact source, cases and whole-session acceptance with a blocked release guard', async t => {
  const root = await evidenceFixture(t); const result = await producedPacket(root);
  assert.equal(result.run.status, 0, result.run.stderr + result.run.stdout);
  assert.equal(result.packet.before.checkout.kind, 'archive');
  assert.equal(result.packet.result.cases[0].name, 'actual child assertion');
  assert.equal(result.packet.result.cases[0].mode, 'tooling-generated');
  const check = evidenceCli(root, 'check', result.path); assert.equal(check.status, 0, check.stderr);
  const report = evidenceCli(root, 'report', result.session); assert.equal(report.status, 0, report.stderr);
  const value = JSON.parse(report.stdout); assert.equal(value.acceptance.length, 96); assert.equal(value.release.status, 'blocked');
  assert.equal(value.sourceCoverage.length, 0); assert.equal(value.execution.totalRuns, 1);
});

test('a deliberately faulty real assertion and a skipped real assertion cannot produce passing evidence', async t => {
  for (const body of ['test("actual fault", () => assert.equal(2 + 2, 5));', 'test.skip("actual skip", () => {});', 'import { createFaultLedger } from "../../scripts/testing/fault-ledger.mjs"; test("overflow", () => { const ledger = createFaultLedger(1); ledger.record("FAULT", "fixture"); ledger.record("FAULT", "fixture"); ledger.assertExpected([{code:"FAULT",scope:"fixture",count:1}]); });']) {
    const root = await evidenceFixture(t, body); const result = await producedPacket(root);
    assert.notEqual(result.run.status, 0); assert.equal(result.packet.status, 'failed');
    assert.notEqual(evidenceCli(root, 'check', result.path).status, 0);
    const report = evidenceCli(root, 'report', result.session); assert.equal(report.status, 1);
    assert.equal(JSON.parse(report.stdout).execution.errors.length, 1);
  }
});

test('real CLI rejects empty suites and source changes during execution', async t => {
  for (const body of ['', 'import { writeFileSync } from "node:fs"; test("changes source", () => writeFileSync("src/input.ts", "changed"));']) {
    const root = await evidenceFixture(t, body); const result = await producedPacket(root);
    assert.notEqual(result.run.status, 0); assert.equal(result.packet.status, 'failed');
    assert.match(result.packet.failure, /EVIDENCE_(EMPTY|SUITE_INVENTORY|SOURCE_CHANGED)/);
  }
});

test('real CLI rejects unknown packet schema, hooks, retries, wrong modes, duplicate and missing raw cases', async t => {
  const root = await evidenceFixture(t); const result = await producedPacket(root);
  assert.equal(result.run.status, 0);
  const original = JSON.stringify(result.packet);
  for (const change of [packet => { packet.schemaVersion = 99; }, packet => { packet.command = 'anything'; }, packet => { packet.execution.retry = 1; }, packet => { packet.result.cases[0].mode = 'native'; }, packet => { packet.result.cases.push(packet.result.cases[0]); }, packet => { delete packet.raw.stdout; }, packet => { packet.finishedAt = 'invalid'; }]) {
    const packet = JSON.parse(original); change(packet); await writeFile(result.path, JSON.stringify(packet));
    assert.notEqual(evidenceCli(root, 'check', result.path).status, 0);
  }
  await writeFile(result.path, original); assert.equal(evidenceCli(root, 'check', result.path).status, 0);
  const rawPath = join(dirname(result.path), result.packet.raw.stdout.file);
  const raw = await readFile(rawPath, 'utf8'); await writeFile(rawPath, '{malformed');
  assert.notEqual(evidenceCli(root, 'check', result.path).status, 0);
  await writeFile(rawPath, raw); assert.equal(evidenceCli(root, 'check', result.path).status, 0);
});

test('fresh-input checking rejects stale source, added tests, absent reports and invalid acceptance modes', async t => {
  const root = await evidenceFixture(t); const result = await producedPacket(root);
  assert.equal(result.run.status, 0);
  const source = join(root, 'src/input.ts'); const original = await readFile(source);
  await writeFile(source, 'changed'); assert.notEqual(evidenceCli(root, 'check', result.path).status, 0);
  await writeFile(source, original); assert.equal(evidenceCli(root, 'check', result.path).status, 0);
  await writeFile(join(root, 'tests/tooling/new.checks.mjs'), ''); assert.notEqual(evidenceCli(root, 'check', result.path).status, 0);
  await rm(join(root, 'tests/tooling/new.checks.mjs')); assert.equal(evidenceCli(root, 'check', result.path).status, 0);
  const crosswalkPath = join(root, 'docs/testing/acceptance-crosswalk.json'); const crosswalk = JSON.parse(await readFile(crosswalkPath));
  crosswalk.acceptance[0].requiredModes = ['unit']; await writeFile(crosswalkPath, JSON.stringify(crosswalk));
  assert.notEqual(evidenceCli(root, 'report', result.session).status, 0);
  await rm(result.path); assert.notEqual(evidenceCli(root, 'report', result.session).status, 0);
});

test('session inventory retains a failed first attempt even when the next real run passes', async t => {
  const body = 'import { existsSync } from "node:fs"; test("controlled external failure", () => assert.equal(existsSync("reports/inject-failure"), false));';
  const root = await evidenceFixture(t, body); await mkdir(join(root, 'reports')); await writeFile(join(root, 'reports/inject-failure'), 'fail');
  const first = await producedPacket(root); assert.equal(first.run.status, 1);
  await rm(join(root, 'reports/inject-failure'));
  const second = await producedPacket(root); assert.equal(second.run.status, 0); assert.equal(first.session, second.session);
  const report = evidenceCli(root, 'report', second.session); assert.equal(report.status, 1);
  const value = JSON.parse(report.stdout); assert.equal(value.execution.totalRuns, 2); assert.equal(value.execution.errors.length, 1);
  assert.ok(value.acceptance.every(row => row.state === 'not-run'));
  await rm(dirname(first.path), { recursive: true }); assert.notEqual(evidenceCli(root, 'report', second.session).status, 0);
});

test('a hung actual producer is terminated as an owned process tree and retains its timeout verdict', async t => {
  const root = await evidenceFixture(t, 'test("hung producer", async () => new Promise(() => setInterval(() => {}, 1000)));');
  const result = await runEvidence(root, 'tooling', { timeoutMs: 1000 });
  assert.equal(result.packet.status, 'failed'); assert.equal(result.packet.failure, 'EVIDENCE_TIMEOUT');
  assert.notEqual(evidenceCli(root, 'check', result.path).status, 0);
});

test('actual CLI distinguishes a literal archive from malformed local Git metadata without falling back to archive', async t => {
  const root = await evidenceFixture(t);
  const first = await producedPacket(root); assert.equal(first.run.status, 0, first.run.stderr);
  assert.equal(first.packet.before.checkout.kind, 'archive');
  await writeFile(join(root, '.git'), 'gitdir: missing-owned-checkout-metadata\n');
  const malformed = evidenceCli(root, 'run', 'tooling');
  assert.equal(malformed.status, 2); assert.match(malformed.stderr, /EVIDENCE_GIT_STATE/);
  assert.equal(malformed.stdout, '');
  await rm(join(root, '.git'));
  const restored = await producedPacket(root); assert.equal(restored.run.status, 0, restored.run.stderr);
  assert.equal(restored.packet.before.checkout.kind, 'archive');
  assert.equal(evidenceCli(root, 'check', first.path).status, 0);
});

test('whole-session CLI rejects real repeated case-inventory drift while identical same-producer repetitions pass', async t => {
  const body = 'import { existsSync } from "node:fs"; test("stable case", () => assert.equal(2 + 2, 4)); if (existsSync("reports/extra-case")) test("conditional extra case", () => assert.equal(3 + 3, 6));';
  const root = await evidenceFixture(t, body);
  const first = await producedPacket(root); const second = await producedPacket(root);
  assert.equal(first.run.status, 0); assert.equal(second.run.status, 0); assert.equal(first.session, second.session);
  const same = evidenceCli(root, 'report', first.session); assert.equal(same.status, 0, same.stderr);
  assert.equal(JSON.parse(same.stdout).execution.totalRuns, 2);
  await writeFile(join(root, 'reports/extra-case'), 'register another genuine assertion');
  const different = await producedPacket(root); assert.equal(different.run.status, 0); assert.equal(different.session, first.session);
  assert.equal(different.packet.result.counts.total, 2);
  assert.equal(evidenceCli(root, 'check', different.path).status, 0, 'each execution is independently passing');
  const drift = evidenceCli(root, 'report', first.session); assert.equal(drift.status, 1);
  const report = JSON.parse(drift.stdout);
  assert.deepEqual(report.execution.errors, [{ id: different.packet.id, producer: 'tooling', error: 'EVIDENCE_REPEAT_OUTCOME_DRIFT' }]);
  assert.ok(report.acceptance.every(row => row.state === 'not-run'));
});
