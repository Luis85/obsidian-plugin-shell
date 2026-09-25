import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, writeFile, mkdir, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runNode, npmEntry } from '../../scripts/framework/process.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';
import { failure } from '../../scripts/framework/contracts.ts';
import { fixtureManifest } from './test-data-fixture.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
async function fixture(t, code = '') {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'framework-process-'))); t.after(() => rm(directory, {recursive: true, force: true}));
  await writeFile(join(directory, 'child.mjs'), code); return {root: directory, frameworkRoot: root};
}
const run = (ctx, args) => executeOperation(parseCliArguments(args), ctx);
test('argument arrays and split UTF-8 survive process execution without a shell', async t => {
  const ctx = await fixture(t, `const bytes = Buffer.from('Grüße'); process.stdout.write(bytes.subarray(0, 3)); setTimeout(() => { process.stdout.write(bytes.subarray(3)); process.stdout.write(JSON.stringify(process.argv.slice(2))); }, 5);`);
  const output = await runNode(ctx, 'child.mjs', ['$(touch should-not-exist)', 'semi;colon', 'two words'], 10000);
  assert.equal(output.stdout, 'Grüße'+JSON.stringify(['$(touch should-not-exist)', 'semi;colon', 'two words']));
  assert.deepEqual(await readdir(ctx.root), ['child.mjs']);
});
test('failed subprocess results retain real exit code and never become success', async t => {
  const ctx = await fixture(t, `console.log('retained diagnosis'); process.exitCode = 7;`);
  await assert.rejects(runNode(ctx, 'child.mjs', [], 10000), error => {
    const result = failure('test', error); assert.equal(result.status, 'failed');
    assert.equal(result.data.execution.exitCode, 7); assert.equal(result.data.automaticRetry, false); return true;
  });
});
test('timeouts and progress-consumer errors terminate the owned process', async t => {
  const ctx = await fixture(t, `console.log('started'); setInterval(() => {}, 1000);`);
  await assert.rejects(runNode(ctx, 'child.mjs', [], 100), error => error.code === 'TIMEOUT');
  await assert.rejects(runNode({...ctx, progress() { throw Error('presentation failed'); }}, 'child.mjs', [], 10000), error => error.code === 'PROGRESS_FAILED');
});
test('output is bounded without mixing process output into a JSON result', async t => {
  const ctx = await fixture(t, `process.stdout.write('x'.repeat(2_000_000));`); let logged = 0;
  const result = await runNode({...ctx, progress(text) { logged += Buffer.byteLength(text); }}, 'child.mjs', [], 10000);
  assert.equal(result.truncated, true); assert.ok(result.stdout.length <= 1_048_576); assert.ok(logged < 1_049_000);
});
test('file-plan failures expose bounded recovery metadata without reading arbitrary getters', () => {
  const error = new Error('PLAN_STALE: target'); let calls = 0;
  error.report = {status: 'failed', written: ['one'], preserved: ['two'], remaining: [], recoveryPath: '.codex-authoring.lock', get cause() { calls++; throw Error('not invoked'); }};
  const response = failure('generate', error);
  assert.equal(response.diagnostics[0].code, 'PLAN_STALE'); assert.deepEqual(response.data.recovery.preserved, ['two']); assert.equal(calls, 0); assert.equal(response.data.automaticRetry, false);
});
test('npm silent and direct CLI discovery return the same contract', async () => {
  const direct = spawnSync(process.execPath, [join(root, 'shell.mjs'), 'capabilities', '--json'], {cwd: root, encoding: 'utf8', timeout: 30000});
  const indirect = spawnSync(process.execPath, [await npmEntry(), 'run', '--silent', 'shell', '--', 'capabilities', '--json'], {cwd: root, encoding: 'utf8', timeout: 30000});
  assert.equal(direct.status, 0, direct.stderr); assert.equal(indirect.status, 0, indirect.stderr);
  assert.deepEqual(JSON.parse(indirect.stdout), JSON.parse(direct.stdout));
});
test('shared fixture commands require hash-bound approval and preserve unrelated vault files', async t => {
  const ctx = await fixture(t);
  assert.equal((await run(ctx, ['setup', '--id', 'test-fixtures', '--name', 'Fixtures', '--author', 'Example', '--yes'])).status, 'applied');
  await run(ctx, ['vault', 'prepare', '--yes']);
  await writeFile(join(ctx.root, 'fixtures.json'), JSON.stringify(fixtureManifest()));
  await mkdir(join(ctx.root, '.test-vault/Notes')); await writeFile(join(ctx.root, '.test-vault/Notes/Manual.md'), 'preserve');
  const planned = await run(ctx, ['data', 'plan', '--input', 'fixtures.json']); assert.equal(planned.status, 'planned');
  assert.equal((await run(ctx, ['data', 'apply', '--input', 'fixtures.json', '--yes'])).diagnostics[0].code, 'FIXTURE_APPROVAL');
  const applied = await run(ctx, ['data', 'apply', '--input', 'fixtures.json', '--apply', planned.data.approval]); assert.equal(applied.status, 'applied', JSON.stringify(applied));
  const reset = await run(ctx, ['data', 'reset-plan', '--input', 'fixtures.json']);
  assert.equal((await run(ctx, ['data', 'reset', '--input', 'fixtures.json', '--apply', reset.data.approval])).status, 'applied');
  assert.equal(await readFile(join(ctx.root, '.test-vault/Notes/Manual.md'), 'utf8'), 'preserve');
});
test('dry-run dominates public execution flags and never launches a release adapter', async t => {
  const ctx = await fixture(t);
  await mkdir(join(ctx.root, 'scripts/release'), { recursive: true });
  await writeFile(join(ctx.root, 'scripts/release/cli.mjs'), `import {writeFileSync} from 'node:fs'; writeFileSync('release-adapter-started', 'unexpected'); console.log('{}');`);
  const response = await run(ctx, ['release', 'operate', '--input', 'request.json', '--execute', '--authorize', 'reviewed-candidate', '--yes', '--dry-run']);
  assert.equal(response.status, 'planned');
  assert.equal(response.data.execution, 'not-run');
  assert.ok(!(await readdir(ctx.root)).includes('release-adapter-started'));
});
