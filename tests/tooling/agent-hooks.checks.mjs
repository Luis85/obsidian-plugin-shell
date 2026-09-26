import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boundedOutput, npmCommand, parseHookInput, projectRootFor } from '../../scripts/agent/hook-io.mjs';
import { editedTarget, postEditOutcome, relatedArguments, watchedRoots } from '../../scripts/agent/post-edit-tests.mjs';
import { stopOutcome } from '../../scripts/agent/stop-check.mjs';

const hooks = fileURLToPath(new URL('../../scripts/agent/', import.meta.url));
/** A minimal generated-project shape with fake Vitest and check commands that record their arguments. */
async function project(t) {
  const root = await mkdtemp(join(tmpdir(), 'agent hooks ü-')); t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['src/core', 'product/code', 'scripts', 'node_modules/vitest', '.obsidian-sandbox']) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node check.mjs' } }));
  await writeFile(join(root, 'vitest.project.config.mjs'), 'export default {};\n');
  await writeFile(join(root, 'tsconfig.project.json'), JSON.stringify({ include: ['src/**/*.ts', 'product/code/**/*.vue', '*.ts'] }));
  const fake = variable => `console.log(JSON.stringify(process.argv.slice(2)));\nconsole.error('\\u001b[31mFAIL\\u001b[39m src/core/a.test.ts');\nprocess.exit(Number(process.env.${variable} ?? 0));\n`;
  await writeFile(join(root, 'node_modules/vitest/vitest.mjs'), fake('FAKE_VITEST_EXIT'));
  await writeFile(join(root, 'check.mjs'), fake('FAKE_CHECK_EXIT'));
  return root;
}
const run = (script, input, env = {}) => spawnSync(process.execPath, [join(hooks, script)], { input: JSON.stringify(input), encoding: 'utf8', timeout: 60000, env: { ...process.env, ...env } });

test('[AGENT-HOOKS-01] hook input parsing, output bounding and npm resolution are defensive and deterministic', () => {
  assert.deepEqual(parseHookInput('{"tool_name":"Edit"}'), { tool_name: 'Edit' });
  for (const bad of ['', 'not json', '[1]', 'null', 'x'.repeat(1_000_001)]) assert.deepEqual(parseHookInput(bad), {});
  const long = boundedOutput(`\u001b[31mred\u001b[0m\r\n\n\n\n${'y'.repeat(5000)}`, 100);
  assert.ok(long.startsWith('…(truncated)\n')); assert.equal(long.length, 100 + '…(truncated)\n'.length);
  assert.equal(boundedOutput('\u001b[1mbold\u001b[22m\r\n\n\n\nend'), 'bold\n\nend');
  assert.deepEqual(npmCommand(['test'], { npm_execpath: '/x/npm-cli.js' }, 'linux'), { command: process.execPath, args: ['/x/npm-cli.js', 'test'], shell: false });
  assert.deepEqual(npmCommand(['test'], {}, 'win32'), { command: 'npm.cmd', args: ['test'], shell: true });
  assert.deepEqual(npmCommand(['test'], {}, 'linux'), { command: 'npm', args: ['test'], shell: false });
});
test('[AGENT-HOOKS-02] only project source and test files under watched roots select related tests', async t => {
  const root = await project(t);
  assert.equal(projectRootFor(join(root, 'src/core')), root);
  assert.deepEqual(watchedRoots(root).sort(), ['product/code', 'src', 'tests']);
  assert.deepEqual(editedTarget({ tool_input: { file_path: join(root, 'src/core/a.ts') } }), { root, file: 'src/core/a.ts' });
  assert.deepEqual(editedTarget({ cwd: root, tool_input: { file_path: 'product/code/View.vue' } }), { root, file: 'product/code/View.vue' });
  for (const path of ['scripts/tool.mjs', 'README.md', 'src/core/data.json', '.obsidian-sandbox/x.ts', 'node_modules/vitest/x.ts', '../outside.ts'])
    assert.equal(editedTarget({ cwd: root, tool_input: { file_path: path } }), null, path);
  assert.equal(editedTarget({ tool_input: { file_path: join(tmpdir(), 'no-project', 'a.ts') } }), null);
  assert.equal(editedTarget({}), null);
  assert.deepEqual(relatedArguments('src/a.ts').slice(1, 4), ['related', 'src/a.ts', '--run']);
});
test('[AGENT-HOOKS-03] related-test failures feed back with exit 2; passes are silent; unfinished runs never claim failure', () => {
  const target = { root: '/p', file: 'src/a.ts' };
  assert.deepEqual(postEditOutcome(target, { status: 0, stdout: 'ok' }), { code: 0, message: '' });
  const failed = postEditOutcome(target, { status: 1, stdout: 'FAIL src/a.test.ts > adds', stderr: '' });
  assert.equal(failed.code, 2); assert.match(failed.message, /src\/a\.ts fail after this edit[\s\S]*FAIL src\/a\.test\.ts > adds/);
  const timeout = postEditOutcome(target, { status: null, signal: 'SIGTERM', error: Object.assign(new Error('spawnSync ETIMEDOUT'), { code: 'ETIMEDOUT' }) });
  assert.equal(timeout.code, 1); assert.match(timeout.message, /did not finish \(ETIMEDOUT\)/);
});
test('[AGENT-HOOKS-04] the PostToolUse hook process runs vitest related for the edited file and reports failures on stderr', async t => {
  const root = await project(t);
  const input = { hook_event_name: 'PostToolUse', tool_name: 'Edit', cwd: root, tool_input: { file_path: join(root, 'src/core/a.ts') } };
  const passed = run('post-edit-tests.mjs', input);
  assert.equal(passed.status, 0, passed.stderr); assert.equal(passed.stdout, ''); assert.equal(passed.stderr, '');
  const failed = run('post-edit-tests.mjs', input, { FAKE_VITEST_EXIT: '1' });
  assert.equal(failed.status, 2); assert.match(failed.stderr, /"related","src\/core\/a\.ts","--run","--config","vitest\.project\.config\.mjs"/);
  assert.match(failed.stderr, /FAIL src\/core\/a\.test\.ts/); assert.doesNotMatch(failed.stderr, /\u001b/);
  const skipped = run('post-edit-tests.mjs', { ...input, tool_input: { file_path: join(root, 'scripts/tool.mjs') } }, { FAKE_VITEST_EXIT: '1' });
  assert.equal(skipped.status, 0); assert.equal(skipped.stderr, '');
});
test('[AGENT-HOOKS-05] the Stop hook blocks once on a failing fast check, then reports without looping', async t => {
  const root = await project(t);
  const input = { hook_event_name: 'Stop', cwd: join(root, 'src'), stop_hook_active: false };
  const passed = run('stop-check.mjs', input);
  assert.equal(passed.status, 0, passed.stderr); assert.equal(passed.stderr, '');
  const blocked = run('stop-check.mjs', input, { FAKE_CHECK_EXIT: '1' });
  assert.equal(blocked.status, 2); assert.match(blocked.stderr, /Do not finish yet\. npm run check -- --fast failed \(exit 1\)/);
  assert.match(blocked.stderr, /\["--fast"\]/);
  const retried = run('stop-check.mjs', { ...input, stop_hook_active: true }, { FAKE_CHECK_EXIT: '1' });
  assert.equal(retried.status, 0); assert.match(JSON.parse(retried.stdout).systemMessage, /still fails after one retry/);
  assert.deepEqual(stopOutcome({}, { status: null, error: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) }).code, 2);
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: {} }));
  assert.equal(run('stop-check.mjs', input, { FAKE_CHECK_EXIT: '1' }).status, 0);
});
