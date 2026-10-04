import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hookTimeout, runInProcessGroup } from '../../scripts/agent/process-group.mjs';

const hooks = fileURLToPath(new URL('../../scripts/agent/', import.meta.url));
const skip = process.platform === 'win32' ? 'POSIX process groups; Windows ends the tree with taskkill /T /F, which this host cannot exercise' : false;
/** A script (CommonJS `-e` or ESM file) that starts a long-lived grandchild, records its pid and then waits itself. */
const spawner = (pidFile, ignoreTerm = false) => {
  const trap = ignoreTerm ? "process.on('SIGTERM', () => {}); " : '';
  const grandchild = `${trap}setInterval(() => {}, 1000)`;
  return `const { spawn } = process.getBuiltinModule('node:child_process'); const { writeFileSync } = process.getBuiltinModule('node:fs'); ${trap}
const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' });
writeFileSync(${JSON.stringify(pidFile)}, String(grandchild.pid)); console.log('started'); setInterval(() => {}, 1000);`;
};
/** A killed grandchild may linger as a zombie until its (possibly absent) init reaps it; a zombie is gone for our purposes. */
function alive(pid) {
  try { process.kill(pid, 0); } catch { return false; }
  try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return true; }
}
const gone = async pid => { for (let attempt = 0; attempt < 40 && alive(pid); attempt += 1) await new Promise(resolve => setTimeout(resolve, 100)); return !alive(pid); };
async function workdir(t) {
  const root = await mkdtemp(join(tmpdir(), 'process group ü-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
const cleanup = (t, pidFile) => t.after(() => { try { process.kill(Number(readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch { /* already gone */ } });

test('[PROCESS-GROUP-01] the result mirrors spawnSync: output, exit status, spawn errors and the environment override', async () => {
  const ok = await runInProcessGroup(process.execPath, ['-e', 'console.log("out"); console.error("err"); process.exit(3)'], { cwd: tmpdir(), timeout: 20_000, env: process.env });
  assert.deepEqual([ok.status, ok.signal, ok.stdout.trim(), ok.stderr.trim(), 'error' in ok], [3, null, 'out', 'err', false]);
  const missing = await runInProcessGroup('definitely-not-a-command-xyz', [], { cwd: tmpdir(), timeout: 5000, env: process.env });
  assert.equal(missing.error.code, 'ENOENT'); assert.equal(missing.status, null);
  const bounded = await runInProcessGroup(process.execPath, ['-e', 'process.stdout.write("x".repeat(5000) + "END")'], { cwd: tmpdir(), timeout: 20_000, env: process.env, maxBuffer: 100 });
  assert.equal(bounded.stdout.length, 100); assert.ok(bounded.stdout.endsWith('END'), 'the tail (where failure summaries are) is kept');
  const env = await runInProcessGroup(process.execPath, ['-e', 'console.log(process.env.GROUP_PROBE)'], { cwd: tmpdir(), timeout: 20_000, env: { ...process.env, GROUP_PROBE: 'seen' } });
  assert.equal(env.stdout.trim(), 'seen');
  assert.equal(hookTimeout({ X: '1500' }, 'X', 9), 1500);
  for (const bad of [undefined, '0', '-5', '1.5', 'abc', '']) assert.equal(hookTimeout({ X: bad }, 'X', 9), 9, String(bad));
});

test('[PROCESS-GROUP-02] a timeout reports ETIMEDOUT and leaves no grandchild running', { skip }, async t => {
  const root = await workdir(t); const pidFile = join(root, 'pid'); cleanup(t, pidFile);
  const started = Date.now();
  const result = await runInProcessGroup(process.execPath, ['-e', spawner(pidFile)], { cwd: root, timeout: 1500, env: process.env });
  assert.equal(result.error.code, 'ETIMEDOUT'); assert.equal(result.status, null); assert.match(result.stdout, /started/);
  assert.ok(Date.now() - started < 10_000, 'returns promptly after the kill');
  assert.ok(await gone(Number(await readFile(pidFile, 'utf8'))), 'the grandchild died with its group');
});

test('[PROCESS-GROUP-03] a process that ignores SIGTERM is still ended by the group SIGKILL', { skip }, async t => {
  const root = await workdir(t); const pidFile = join(root, 'pid'); cleanup(t, pidFile);
  const result = await runInProcessGroup(process.execPath, ['-e', spawner(pidFile, true)], { cwd: root, timeout: 1000, env: process.env });
  assert.equal(result.error.code, 'ETIMEDOUT');
  assert.ok(await gone(Number(await readFile(pidFile, 'utf8'))));
});

test('[PROCESS-GROUP-04] a terminated hook takes its group down with it', { skip }, async t => {
  const root = await workdir(t); const pidFile = join(root, 'pid'); cleanup(t, pidFile);
  const script = join(root, 'host.mjs');
  await writeFile(script, `import { runInProcessGroup } from ${JSON.stringify(new URL('process-group.mjs', `file://${hooks}`).href)};
await runInProcessGroup(process.execPath, ['-e', ${JSON.stringify(spawner(pidFile))}], { cwd: ${JSON.stringify(root)}, timeout: 60000, env: process.env });`);
  const host = spawn(process.execPath, [script], { stdio: 'ignore' });
  for (let attempt = 0; attempt < 100 && !existsSync(pidFile); attempt += 1) await new Promise(resolve => setTimeout(resolve, 50));
  const grandchild = Number(await readFile(pidFile, 'utf8'));
  assert.ok(alive(grandchild));
  host.kill('SIGTERM');
  await new Promise(resolve => host.once('exit', resolve));
  assert.ok(await gone(grandchild), 'the hook\'s own termination does not orphan the check');
});

/** A generated-project shape whose check and vitest commands start a grandchild and then hang. */
async function hangingProject(t) {
  const root = await workdir(t); const pidFile = join(root, 'pid'); cleanup(t, pidFile);
  for (const folder of ['src/core', 'node_modules/vitest', 'configs/testing', 'configs/types']) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { check: 'node check.mjs' } }));
  await writeFile(join(root, 'configs/testing/vitest.project.config.mjs'), 'export default {};\n');
  await writeFile(join(root, 'configs/types/tsconfig.project.json'), JSON.stringify({ include: ['../../src/**/*.ts'] }));
  await writeFile(join(root, 'check.mjs'), spawner(pidFile));
  await writeFile(join(root, 'node_modules/vitest/vitest.mjs'), spawner(pidFile));
  return { root, pidFile };
}
const runHook = (script, input, env) => new Promise(resolve => {
  const child = spawn(process.execPath, [join(hooks, script)], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('close', status => resolve({ status, stdout, stderr }));
  child.stdin.end(JSON.stringify(input));
});

test('[PROCESS-GROUP-05] the Stop hook reports a timed-out check without blocking and leaves no test process behind', { skip }, async t => {
  const { root, pidFile } = await hangingProject(t);
  const result = await runHook('stop-check.mjs', { hook_event_name: 'Stop', cwd: root }, { CLAUDE_PROJECT_DIR: root, SHELL_STOP_CHECK_TIMEOUT_MS: '2000' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(JSON.parse(result.stdout).systemMessage, /The fast check did not finish within 2s, so this stop was not gated/);
  assert.ok(await gone(Number(await readFile(pidFile, 'utf8'))), 'the grandchild of npm run check is gone');
});

test('[PROCESS-GROUP-06] the post-edit hook reports an unfinished run (exit 1) and leaves no test process behind', { skip }, async t => {
  const { root, pidFile } = await hangingProject(t);
  const input = { hook_event_name: 'PostToolUse', tool_name: 'Edit', cwd: root, tool_input: { file_path: join(root, 'src/core/a.ts') } };
  const result = await runHook('post-edit-tests.mjs', input, { SHELL_POST_EDIT_TIMEOUT_MS: '2000' });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Related tests for src\/core\/a\.ts did not finish \(ETIMEDOUT\)/);
  assert.ok(await gone(Number(await readFile(pidFile, 'utf8'))));
});

test('[PROCESS-GROUP-07] without a timeout the real hooks behave as before: pass silently', { skip }, async t => {
  const { root } = await hangingProject(t);
  await writeFile(join(root, 'check.mjs'), 'process.exit(0);\n');
  const passed = await runHook('stop-check.mjs', { hook_event_name: 'Stop', cwd: root }, { CLAUDE_PROJECT_DIR: root });
  assert.deepEqual([passed.status, passed.stdout, passed.stderr], [0, '', '']);
});
