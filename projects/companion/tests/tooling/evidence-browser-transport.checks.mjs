import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile, mkdir, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as producers from '../../scripts/testing/evidence-producers.mjs';

// Synthetic parser input only: these tests do not claim a browser or Playwright run.
const root = process.cwd(), files = ['tests/e2e/probe.spec.ts'];
const report = () => ({ config: {}, errors: [], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 },
  suites: [{ specs: [{ file: files[0], title: 'parser fixture', tests: [{ expectedStatus: 'passed', status: 'expected',
    results: [{ status: 'passed', retry: 0 }], repeatEachIndex: 0 }] }] }] });
const parse = (raw, exit = 0, version = 2) => producers.adaptProducer('browser', raw, root, files, exit, version);

test('browser evidence keeps diagnostic stdout separate from strict structured results', async () => {
  const raw = { stdout: 'GitCommitInfo diagnostic\nnot JSON\n', stderr: 'retained warning\n', framework: JSON.stringify(report()) };
  assert.equal((await parse(raw)).status, 'passed');
  assert.equal(raw.stdout, 'GitCommitInfo diagnostic\nnot JSON\n');
  assert.equal((await parse(raw, 1)).status, 'failed');
});
test('new browser packets never fall back to stdout when their report is absent or malformed', async () => {
  const stdout = JSON.stringify(report());
  for (const framework of [undefined, '', '{}', 'GitCommitInfo\n' + stdout]) {
    await assert.rejects(parse({ stdout, stderr: '', ...(framework === undefined ? {} : { framework }) }));
  }
  await assert.rejects(parse({ stdout: '{}', framework: stdout }, 0, 99), /EVIDENCE_SCHEMA/);
});
test('legacy stdout transport is selected only by its explicit packet version and remains strict', async () => {
  const stdout = JSON.stringify(report());
  assert.equal((await parse({ stdout, stderr: '' }, 0, 1)).status, 'passed');
  await assert.rejects(parse({ stdout: 'warning\n' + stdout, framework: stdout }, 0, 1));
});
test('separating diagnostic streams does not excuse failed assertions, retries or framework errors', async () => {
  for (const edit of [value => value.errors.push({ message: 'unhandled framework error' }),
    value => { value.suites[0].specs[0].tests[0].results[0].status = 'failed'; },
    value => { value.suites[0].specs[0].tests[0].results[0].retry = 1; }]) {
    const value = report(); edit(value);
    assert.equal((await parse({ stdout: '', stderr: '', framework: JSON.stringify(value) })).status, 'failed');
  }
});
test('producer-owned report paths replace all casing variants of ambient overrides without mutating the parent', () => {
  const parent = { PATH: 'unchanged', NODE_TEST_CONTEXT: 'child-v8', PLAYWRIGHT_JSON_OUTPUT_FILE: '/private/wrong',
    Playwright_Json_Output_Name: 'redirect.json', playwright_json_output_dir: '/private/redirect', KEEP: 'yes' };
  const original = { ...parent }, output = join(root, 'reports/evidence/test-run');
  const env = producers.producerEnvironment('browser', output, null, parent);
  assert.deepEqual(parent, original);
  assert.deepEqual(Object.keys(env).filter(key => key.toUpperCase().startsWith('PLAYWRIGHT_JSON_OUTPUT')), ['PLAYWRIGHT_JSON_OUTPUT_FILE']);
  assert.equal(env.PLAYWRIGHT_JSON_OUTPUT_FILE, join(output, 'framework.json'));
  assert.equal(env.SHELL_EVIDENCE_OUTPUT, output); assert.equal(env.NODE_TEST_CONTEXT, undefined);
  assert.equal(env.KEEP, 'yes'); assert.equal(env.PATH, 'unchanged');
  assert.equal(producers.producerEnvironment('tooling', output, null, parent).PLAYWRIGHT_JSON_OUTPUT_FILE, undefined);
});
test('raw inventories are versioned and demand a separate framework report for current browser packets', () => {
  assert.deepEqual(producers.producerRawKeys('browser', 1), ['stdout', 'stderr']);
  assert.deepEqual(producers.producerRawKeys('browser', 2), ['stdout', 'stderr', 'framework']);
  assert.deepEqual(producers.producerRawKeys('runtime', 2), ['stdout', 'stderr', 'framework', 'attempts']);
  assert.throws(() => producers.producerRawKeys('browser', 99), /EVIDENCE_SCHEMA/);
});
test('owned framework reports are bounded UTF-8 files; absent, invalid and oversized reports fail', async t => {
  const output = await realpath(await mkdtemp(join(tmpdir(), 'evidence-report-')));
  t.after(() => rm(output, { recursive: true, force: true }));
  const path = join(output, 'framework.json');
  await assert.rejects(producers.readFrameworkReport(output), { code: 'ENOENT' });
  await writeFile(path, JSON.stringify(report()));
  assert.equal(await producers.readFrameworkReport(output), JSON.stringify(report()));
  await writeFile(path, Buffer.from([0xff])); await assert.rejects(producers.readFrameworkReport(output));
  await truncate(path, 32_000_001); await assert.rejects(producers.readFrameworkReport(output), /EVIDENCE_REPORT_LIMIT/);
  await rm(path); await mkdir(path); await assert.rejects(producers.readFrameworkReport(output), /EVIDENCE_REPORT_FILE/);
});
