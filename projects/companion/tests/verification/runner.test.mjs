import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runNodeTests, evaluateRecords } from '../../scripts/testing/run-node-tests.mjs';
async function fixture(t, body) {
  const root = await mkdtemp(join(tmpdir(), 'shell runner é-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts/testing'), { recursive: true });
  await copyFile(new URL('../../scripts/testing/node-reporter.mjs', import.meta.url), join(root, 'scripts/testing/node-reporter.mjs'));
  await writeFile(join(root, 'case.test.mjs'), `import { test } from 'node:test';\n${body}`);
  return root;
}
test('[RUN-01] real child success has exact test evidence', async (t) => {
  const root = await fixture(t, "test('[CHILD-01] works', () => {});");
  const result = await runNodeTests(root, ['case.test.mjs'], ['CHILD-01']);
  assert.equal(result.status, 'passed'); assert.equal(result.counts.tests, 1);
  assert.match(result.command.find((arg) => arg.startsWith('--test-reporter=')), /^--test-reporter=file:\/\//);
  assert.ok(result.command.some((arg) => arg.includes('%20') && arg.includes('%C3%A9')));
});
test('[RUN-02] deliberately failing child produces nonzero and failed evidence', async (t) => {
  const root = await fixture(t, "test('[CHILD-01] fails', () => { throw new Error('intentional'); });");
  const result = await runNodeTests(root, ['case.test.mjs'], ['CHILD-01']);
  assert.equal(result.status, 'failed'); assert.notEqual(result.exitCode, 0);
});
test('[RUN-03] zero tests or missing inventory cannot pass', async (t) => {
  const root = await fixture(t, '// deliberately no tests');
  const result = await runNodeTests(root, ['case.test.mjs'], ['CHILD-01']);
  assert.notEqual(result.status, 'passed');
  assert.throws(() => evaluateRecords('', 0, ['CHILD-01']), /SUMMARY/);
});
test('[RUN-04] skip is not success even when the child exit is zero', async (t) => {
  const root = await fixture(t, "test.skip('[CHILD-01] skipped', () => {});");
  const result = await runNodeTests(root, ['case.test.mjs'], ['CHILD-01']);
  assert.equal(result.status, 'failed'); assert.equal(result.exitCode, 0);
});
test('[RUN-05] malformed reporter output fails closed', () => {
  assert.throws(() => evaluateRecords('{bad', 0, []));
  assert.throws(() => evaluateRecords(JSON.stringify({ schemaVersion: 99, kind: 'summary' }), 0, []), /SCHEMA/);
});
test('[RUN-06] hung child is bounded and never reported as passed', async (t) => {
  const root = await fixture(t, "test('[CHILD-01] hangs', async () => { await new Promise(() => setInterval(() => {}, 1000)); });");
  const result = await runNodeTests(root, ['case.test.mjs'], ['CHILD-01'], { timeoutMs: 1500 });
  assert.equal(result.status, 'infrastructure-error'); assert.equal(result.reason, 'TEST_TIMEOUT');
});
