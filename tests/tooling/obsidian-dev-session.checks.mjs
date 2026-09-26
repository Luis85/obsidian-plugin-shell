import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDevSession, listenForInterrupts } from '../../scripts/dev/dev-session.mjs';
import { develop } from '../../scripts/dev/obsidian-dev.mjs';
import { treeKillCommand, signalHostTree } from '../../scripts/testing/obsidian-host.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
/** A fake Obsidian process: exits when told to (or when stopped through its tracked release). */
function fakeProcess() {
  const proc = Object.assign(new EventEmitter(), { pid: 4242, exitCode: null, signalCode: null });
  proc.exit = (code, signal = null) => { if (proc.exitCode !== null || proc.signalCode !== null) return; proc.exitCode = code; proc.signalCode = signal; proc.emit('exit', code, signal); };
  return proc;
}
/** develop() with every host/file-system step replaced; the lifecycle and exit-code logic are real. */
async function harness(t, { once = true, plan = {} } = {}) {
  const logs = await mkdtemp(join(tmpdir(), 'dev session-')); t.after(() => rm(logs, { recursive: true, force: true }));
  await mkdir(join(logs, 'vault'));
  const proc = fakeProcess(); const printed = []; const said = []; const reported = []; const events = [];
  const session = createDevSession({ once, say: message => said.push(message), report: message => reported.push(message) });
  const page = { id: 'page' };
  const browser = { contexts: () => [{ pages: () => [], on() {}, off() {} }], close: async () => { events.push('browser closed'); } };
  const overrides = {
    seedSandbox: async () => ({ vault: join(logs, 'vault'), logs, seeded: false, files: 0 }),
    buildAndInstall: async (_, state) => { state.manifest = { id: 'quick-capture', version: '0.1.0' }; await plan.build?.(); return { buildMs: 1, totalMs: 1 }; },
    enableVaultPlugin: async () => ({ changed: false }),
    launch: async (_host, _options, _sandbox, owner) => {
      events.push('launched');
      await plan.launched?.(proc);
      owner.track('Obsidian', async () => { events.push('Obsidian stopped'); proc.exit(null, 'SIGTERM'); }, () => events.push('Obsidian killed'));
      return { proc, output: () => '' };
    },
    connectHost: async () => { await plan.connect?.(proc); return browser; },
    workspacePage: async () => page,
    reloadPlugin: async () => ({ loaded: true, enabled: true, version: '0.1.0', durationMs: 1, error: null, viewTypes: plan.views ?? ['quick-capture-view-inbox', 'quick-capture-view-settings'] }),
    enableDebugLogging: async () => true,
    openPluginView: async (_page, types) => { events.push(`open ${types[0]}`); return types.length ? { type: types[0], opened: true, registered: types } : null; },
    captureDebugReport: async () => { await plan.settled?.(proc); return null; },
    onceSummary: async ({ view }) => ({ status: 'passed', view }),
    watchPluginSources: () => () => events.push('watchers closed'),
  };
  const options = { once, port: 9222, logs: 'plugin', settleMs: 0, sandbox: '.obsidian-sandbox', debugLogging: true };
  const io = { say: message => said.push(message), out: () => undefined, printSummary: summary => printed.push(summary) };
  const host = { appVersion: '1.13.7', installerVersion: '1.13.7', requestedVersion: '1.13.7', launcherVersion: '3.2.1' };
  const run = async () => { const code = await develop(options, host, io, session, overrides); await session.release(); return code; };
  return { run, session, proc, printed, said, reported, events };
}

test('[OBSIDIAN-DEV-10] --json: Obsidian exiting before the debugger attaches is a failure with a JSON summary', async t => {
  const fake = await harness(t, { plan: { connect: async proc => { proc.exit(0); throw new Error('OBSIDIAN_EXITED_BEFORE_DEBUGGER (0)'); } } });
  assert.equal(await fake.run(), 1);
  assert.equal(fake.printed.length, 1, 'exactly one JSON summary on stdout');
  assert.equal(fake.printed[0].status, 'failed'); assert.match(fake.printed[0].error, /OBSIDIAN_EXITED_UNEXPECTEDLY \(exit code 0\)/);
  assert.deepEqual(fake.printed[0].plugin, { id: 'quick-capture', version: '0.1.0' });
  assert.ok(fake.reported.some(line => /Obsidian exited unexpectedly/.test(line)), fake.reported.join('\n'));
});
test('[OBSIDIAN-DEV-11] --json: an Obsidian crash after the reload never reports passed', async t => {
  const fake = await harness(t, { plan: { settled: async proc => { proc.exit(null, 'SIGSEGV'); await delay(5); } } });
  assert.equal(await fake.run(), 1);
  assert.deepEqual(fake.printed.map(summary => summary.status), ['failed']);
  assert.match(fake.printed[0].error, /signal SIGSEGV/);
});
test('[OBSIDIAN-DEV-12] --json: the first registered plugin view is opened and recorded; no view is not a failure', async t => {
  const fake = await harness(t);
  assert.equal(await fake.run(), 0);
  assert.deepEqual(fake.printed[0].view, { type: 'quick-capture-view-inbox', opened: true, registered: ['quick-capture-view-inbox', 'quick-capture-view-settings'] });
  assert.ok(fake.events.includes('open quick-capture-view-inbox'));
  assert.deepEqual(fake.events.slice(-2), ['browser closed', 'Obsidian stopped'], 'released newest first after the summary');
  const plain = await harness(t, { plan: { views: [] } });
  assert.equal(await plain.run(), 0); assert.equal(plain.printed[0].view, null); assert.equal(plain.printed[0].status, 'passed');
});
test('[OBSIDIAN-DEV-13] watch mode: a window the developer closes ends cleanly and is logged; a crash exits 1', async t => {
  const closed = await harness(t, { once: false });
  const running = closed.run(); await delay(20);
  closed.proc.exit(0);
  assert.equal(await running, 0);
  assert.ok(closed.said.some(line => /Obsidian was closed \(exit code 0\); stopping the watcher/.test(line)));
  assert.ok(closed.events.includes('watchers closed'));
  const crashed = await harness(t, { once: false });
  const failing = crashed.run(); await delay(20);
  crashed.proc.exit(1);
  assert.equal(await failing, 1);
  assert.ok(crashed.reported.some(line => /Obsidian exited unexpectedly \(exit code 1\)/.test(line)));
});
test('[OBSIDIAN-DEV-14] an interrupt during the build stops before launching and keeps a cancelled summary', async t => {
  let fake;
  fake = await harness(t, { plan: { build: async () => { fake.session.interrupt('SIGINT'); await delay(10); } } });
  assert.equal(await fake.run(), 130);
  assert.ok(!fake.events.includes('launched'), 'Obsidian was never launched');
  assert.equal(fake.printed[0].status, 'cancelled'); assert.match(fake.printed[0].error, /INTERRUPTED \(SIGINT\)/);
});
test('[OBSIDIAN-DEV-15] an interrupt during launch still stops the Obsidian that appears afterwards', async t => {
  let fake;
  fake = await harness(t, { once: false, plan: { launched: async () => { fake.session.interrupt('SIGTERM'); await delay(10); } } });
  const code = await fake.run(); await delay(30);
  assert.equal(code, 0, 'Ctrl-C in watch mode is a normal stop');
  assert.ok(fake.events.includes('Obsidian stopped'), fake.events.join(', '));
});
test('[OBSIDIAN-DEV-16] the session releases resources once in reverse order and the worst exit code wins', async () => {
  const released = []; const reported = [];
  const session = createDevSession({ once: true, report: message => reported.push(message) });
  session.track('display', () => released.push('display'));
  session.track('host', () => { released.push('host'); throw new Error('stuck'); });
  session.fail(new Error('build failed'));
  session.fail(new Error('page closed'));
  assert.equal(session.code, 1); assert.equal(session.failure.message, 'build failed');
  assert.ok(reported.some(line => /while stopping: build failed\) page closed/.test(line)));
  await Promise.all([session.release(), session.release()]);
  assert.deepEqual(released, ['host', 'display']); assert.ok(reported.some(line => /Cleanup of host failed: stuck/.test(line)));
  session.track('late', () => released.push('late')); await delay(1);
  assert.deepEqual(released, ['host', 'display', 'late'], 'a resource created after release is released at once');
  await assert.rejects(session.guard(new Promise(() => undefined)), /build failed/);
});
test('[OBSIDIAN-DEV-17] a second interrupt kills tracked processes and exits; listeners are removable', () => {
  const target = new EventEmitter(); const killed = []; const exits = [];
  const session = createDevSession({ once: false });
  session.track('host', () => undefined, () => killed.push('host'));
  const stop = listenForInterrupts(session, target, code => exits.push(code));
  target.emit('SIGINT');
  assert.equal(session.interrupted, 'SIGINT'); assert.deepEqual(exits, []);
  target.emit('SIGTERM');
  assert.deepEqual(killed, ['host']); assert.deepEqual(exits, [130]);
  stop(); assert.equal(target.listenerCount('SIGINT'), 0); assert.equal(target.listenerCount('SIGTERM'), 0);
});
test('[OBSIDIAN-DEV-18] stopping the host ends the whole tree: POSIX process group, Windows taskkill /T /F', () => {
  assert.deepEqual(treeKillCommand(321), { command: 'taskkill', args: ['/T', '/F', '/PID', '321'] });
  const runs = [];
  signalHostTree({ pid: 321 }, 'SIGTERM', { platform: 'win32', run: (command, args, options) => { runs.push({ command, args, shell: options.shell }); return { status: 0 }; } });
  assert.deepEqual(runs, [{ command: 'taskkill', args: ['/T', '/F', '/PID', '321'], shell: false }]);
  const kills = [];
  signalHostTree({ pid: 321 }, 'SIGKILL', { platform: 'linux', kill: (pid, signal) => kills.push([pid, signal]) });
  assert.deepEqual(kills, [[-321, 'SIGKILL']]);
  assert.doesNotThrow(() => signalHostTree({ pid: 321 }, 'SIGTERM', { platform: 'darwin', kill: () => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); } }));
  assert.throws(() => signalHostTree({ pid: 321 }, 'SIGTERM', { platform: 'linux', kill: () => { throw Object.assign(new Error('denied'), { code: 'EPERM' }); } }), /denied/);
});
