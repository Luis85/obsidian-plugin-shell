/** Real child-process stream tests; no Vite install or synthetic build result is implied. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const helper = new URL('../scripts/lib/worker-output.mjs', import.meta.url).href;
function run(body) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval',
    `import { withBuildDiagnostics } from ${JSON.stringify(helper)};
${body}`],
  { encoding: 'utf8', timeout: 10000, maxBuffer: 1_000_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result;
}
test('worker keeps console and direct async diagnostics off its single JSON result', () => {
  const result = run(String.raw`const original = process.stdout.write;
    const value = await withBuildDiagnostics(async () => {
      console.log('[success] Nuxt UI detected components');
      console.info('info diagnostic');
      await new Promise(resolve => process.stdout.write(Buffer.from('direct diagnostic\n'), resolve));
      await Promise.resolve(); console.warn('warning diagnostic');
      return { status: 'ok', value: 7 };
    });
    if (process.stdout.write !== original) throw new Error('stdout not restored');
    console.log(JSON.stringify(value));`);
  assert.deepEqual(JSON.parse(result.stdout), { status: 'ok', value: 7 });
  assert.equal(result.stdout.trim().split('\n').length, 1);
  for (const phrase of ['[success] Nuxt UI', 'info diagnostic', 'direct diagnostic', 'warning diagnostic'])
    assert.ok(result.stderr.includes(phrase), phrase);
});
test('worker restores stdout on rejected compilation without laundering failure', () => {
  const result = run(String.raw`const original = process.stdout.write; const failure = new Error('compile failed');
    try { await withBuildDiagnostics(async () => {
      console.log('before failure'); await Promise.resolve(); throw failure;
    }); throw new Error('unexpected success'); }
    catch (error) {
      if (error !== failure || process.stdout.write !== original) throw error;
      console.log(JSON.stringify({ status: 'failed', message: error.message }));
    }`);
  assert.deepEqual(JSON.parse(result.stdout), { status: 'failed', message: 'compile failed' });
  assert.match(result.stderr, /before failure/);
});
test('worker stream restoration also covers a synchronous throw', () => {
  const result = run(String.raw`const original = process.stdout.write;
    try { await withBuildDiagnostics(() => { throw new Error('sync failure'); }); }
    catch (error) {
      if (process.stdout.write !== original) throw new Error('stdout not restored');
      console.log(JSON.stringify({ message: error.message }));
    }`);
  assert.deepEqual(JSON.parse(result.stdout), { message: 'sync failure' });
});
test('only the isolated build-worker CLI wraps compilation diagnostics', () => {
  const source = fs.readFileSync(new URL('../scripts/lib/build-worker.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(isMain\(import.meta.url\)\) cli/);
  assert.match(source, /console.log\(JSON.stringify\(await withBuildDiagnostics\(\(\) => compile\(options\)\)\)\)/);
});
