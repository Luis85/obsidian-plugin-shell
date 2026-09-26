import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consoleEntry, belongsToPlugin, selectEntries, loadErrors, dedupeEntries, formatEntry, createConsoleRecorder } from '../../scripts/testing/obsidian-console.mjs';
import { inlineSourceMap, mapPluginStack, PLUGIN_WRAPPER_PREFIX } from '../../scripts/testing/obsidian-source-map.mjs';
import { displayPlan, parseDisplayNumber } from '../../scripts/testing/obsidian-display.mjs';
import { ProvisionRequired, assertHostPath, downloadAllowed, launcherInstallCommand, provisionHost, requestedAppVersion } from '../../scripts/testing/obsidian-host.mjs';
import { parseRunnerArguments } from '../../scripts/testing/run-obsidian-tests.mjs';

const now = () => '2026-01-01T00:00:00.000Z';
function page() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { message: (type, text, url = '') => emitter.emit('console', { type: () => type, text: () => text, location: () => ({ url, lineNumber: 0, columnNumber: 4 }) }) });
}
test('[OBSIDIAN-HARNESS-01] console entries are levelled, bounded and attributed to the plugin by its script URL', () => {
  const plugin = consoleEntry('console', { type: 'warning', text: 'careful', url: 'plugin:plugin-shell' }, now);
  const host = consoleEntry('console', { type: 'error', text: 'host failure' }, now);
  const uncaught = consoleEntry('pageerror', { text: 'Error: boom', stack: 'Error: boom\n    at x (plugin:plugin-shell:3:9)' }, now);
  const chatter = consoleEntry('console', { type: 'log', text: 'x'.repeat(5000) }, now);
  assert.equal(plugin.level, 'warn'); assert.equal(host.level, 'error'); assert.equal(uncaught.level, 'error'); assert.equal(chatter.text.length, 4000);
  assert.equal(belongsToPlugin(plugin, 'plugin-shell'), true); assert.equal(belongsToPlugin(uncaught, 'plugin-shell'), true);
  assert.equal(belongsToPlugin(host, 'plugin-shell'), false); assert.equal(belongsToPlugin(plugin, 'other'), false);
  assert.equal(belongsToPlugin(consoleEntry('console', { type: 'log', text: '[plugin-shell] ready' }, now), 'plugin-shell'), true);
  assert.deepEqual(selectEntries([plugin, host, chatter], { pluginId: 'plugin-shell' }), [plugin, host]);
  assert.deepEqual(selectEntries([plugin, host, chatter], { pluginId: 'plugin-shell', mode: 'all' }), [plugin, host, chatter]);
  assert.throws(() => selectEntries([], { mode: 'some' }), /CONSOLE_FILTER_INVALID/);
  assert.deepEqual(loadErrors([plugin, host, uncaught], 'plugin-shell'), [uncaught]);
  assert.match(formatEntry(uncaught, 'plugin-shell'), /ERROR \[plugin-shell\] uncaught Error: boom\n {4}Error: boom/);
  assert.deepEqual(dedupeEntries([uncaught, uncaught, host]).map(group => group.count), [2, 1]);
});
test('[OBSIDIAN-HARNESS-02] the recorder captures every page, maps text after attributing it and detaches on dispose', () => {
  const sink = []; const first = page(); const second = page(); const context = Object.assign(new EventEmitter(), { pages: () => [first] });
  const recorder = createConsoleRecorder({ pluginId: 'plugin-shell', onEntry: entry => { sink.push(entry); throw new Error('sink failure'); },
    transform: entry => ({ ...entry, text: entry.text.replace('plugin:plugin-shell:1:50', 'src/main.ts:4:2') }) });
  const stop = recorder.attachContext(context); context.emit('page', second);
  first.message('error', 'failed at plugin:plugin-shell:1:50');
  const mark = recorder.mark();
  second.emit('pageerror', Object.assign(new Error('rejected'), { stack: 'Error: rejected\n    at y (app.js:1:1)' }));
  first.message('log', 'hello', 'plugin:plugin-shell');
  assert.equal(sink.length, 3);
  assert.equal(recorder.entries[0].text, 'failed at src/main.ts:4:2'); assert.equal(recorder.entries[0].plugin, true);
  assert.equal(recorder.entries[2].stack, 'at plugin:plugin-shell:1:5');
  assert.deepEqual(recorder.since(mark).map(entry => entry.kind), ['pageerror', 'console']);
  assert.equal(recorder.errors().length, 2); assert.equal(recorder.pluginEntries().length, 2);
  assert.match(recorder.text('plugin'), /hello/);
  stop(); recorder.dispose(); recorder.dispose();
  first.message('error', 'after dispose');
  assert.equal(recorder.entries.length, 3);
  assert.equal(first.listenerCount('console') + second.listenerCount('pageerror') + context.listenerCount('page'), 0);
});
test('[OBSIDIAN-HARNESS-03] inline dev source maps translate plugin frames, including the host wrapper on line 1', () => {
  const map = { version: 3, sources: ['../../src/main.ts'], names: [], mappings: 'AAAA;AACA' };
  const code = `x;\ny;\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`;
  const consumer = inlineSourceMap(code);
  assert.ok(consumer);
  const prefix = PLUGIN_WRAPPER_PREFIX.length;
  assert.equal(mapPluginStack(`at a (plugin:plugin-shell:1:${prefix + 1})\nat b (app://obsidian.md/plugin:plugin-shell:2:1)`, consumer, 'plugin-shell'),
    'at a (src/main.ts:1:1)\nat b (src/main.ts:2:1)');
  assert.equal(mapPluginStack('at a (plugin:plugin-shell:1:3)', consumer, 'plugin-shell'), 'at a (plugin:plugin-shell:1:3)');
  assert.equal(mapPluginStack('at a (plugin:other:2:1)', consumer, 'plugin-shell'), 'at a (plugin:other:2:1)');
  assert.equal(mapPluginStack('unchanged', null, 'plugin-shell'), 'unchanged');
  assert.equal(inlineSourceMap('no map here'), null);
  assert.equal(inlineSourceMap('//# sourceMappingURL=data:application/json;base64,bm90LWpzb24='), null);
});
test('[OBSIDIAN-HARNESS-04] displays: existing displays are used, Linux without one uses Xvfb or fails clearly', () => {
  assert.equal(displayPlan({ platform: 'darwin', env: {} }), 'direct');
  assert.equal(displayPlan({ platform: 'linux', env: { DISPLAY: ':1' } }), 'direct');
  assert.equal(displayPlan({ platform: 'linux', env: { WAYLAND_DISPLAY: 'wayland-0' } }), 'direct');
  assert.equal(displayPlan({ platform: 'linux', env: {}, xvfbAvailable: true }), 'xvfb');
  assert.equal(displayPlan({ platform: 'linux', env: {}, xvfbAvailable: false }), 'missing');
  assert.equal(parseDisplayNumber('99\n'), 99); assert.equal(parseDisplayNumber('9'), null); assert.equal(parseDisplayNumber('x\n'), null);
});
test('[OBSIDIAN-HARNESS-05] provisioning never downloads without explicit opt-in and explains how to opt in', async t => {
  const root = await mkdtemp(join(tmpdir(), 'obsidian provision-')); t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(provisionHost({ root, allowDownload: false, log: () => assert.fail('nothing may be provisioned') }), error =>
    error instanceof ProvisionRequired && error.code === 'OBSIDIAN_PROVISION_REQUIRED' && /--allow-download/.test(error.message)
    && /OBSIDIAN_ALLOW_DOWNLOAD=1/.test(error.message) && /obsidian-launcher 3\.2\.1 in \.native-runner/.test(error.message));
  await mkdir(join(root, '.native-runner/node_modules/obsidian-launcher'), { recursive: true });
  await writeFile(join(root, '.native-runner/node_modules/obsidian-launcher/package.json'), JSON.stringify({ version: '3.3.0' }));
  await assert.rejects(provisionHost({ root }), /found 3\.3\.0/);
  await writeFile(join(root, '.native-runner/node_modules/obsidian-launcher/package.json'), JSON.stringify({ version: '3.2.1' }));
  await assert.rejects(provisionHost({ root }), /Obsidian version index in \.native-cache/);
  assert.equal(downloadAllowed(['--allow-download'], {}), true); assert.equal(downloadAllowed([], { OBSIDIAN_ALLOW_DOWNLOAD: '1' }), true);
  assert.equal(downloadAllowed([], { OBSIDIAN_ALLOW_DOWNLOAD: 'true' }), false);
  assert.equal(requestedAppVersion({}), '1.13.7'); assert.equal(requestedAppVersion({ OBSIDIAN_VERSION: 'latest' }), 'latest');
  assert.throws(() => requestedAppVersion({ OBSIDIAN_VERSION: '1.13.7; rm -rf /' }), /OBSIDIAN_VERSION_INVALID/);
  const viaNpm = launcherInstallCommand({ npm_execpath: '/opt/npm/bin/npm-cli.js' });
  assert.deepEqual(viaNpm.args.slice(0, 5), ['/opt/npm/bin/npm-cli.js', 'install', '--prefix', '.native-runner', '--save-exact']);
  assert.equal(viaNpm.args.at(-1), 'obsidian-launcher@3.2.1'); assert.ok(!viaNpm.args.includes('-g') && !viaNpm.args.includes('--global'));
  assert.equal(assertHostPath('/tmp/short', 'linux') <= 107, true);
  assert.throws(() => assertHostPath(`/tmp/${'x'.repeat(80)}`, 'linux'), /NATIVE_SOCKET_PATH_TOO_LONG/);
  assert.equal(assertHostPath(`/tmp/${'x'.repeat(80)}`, 'darwin'), undefined);
});
test('[OBSIDIAN-HARNESS-06] the test runner separates its own flags from Vitest filters', () => {
  assert.deepEqual(parseRunnerArguments(['--allow-download', 'plugin-load', '--no-build', '-t', 'loads']),
    { allowDownload: true, build: false, help: false, vitest: ['plugin-load', '-t', 'loads'] });
  assert.deepEqual(parseRunnerArguments([]), { allowDownload: false, build: true, help: false, vitest: [] });
});
