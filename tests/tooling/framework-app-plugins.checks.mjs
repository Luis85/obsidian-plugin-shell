import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enable, frameworkRoot, install, manifestFor, operation, run } from './app-plugins-fixture.mjs';
import { communityInventory } from '../../src/cli/adapters/community-plugins/inventory.ts';
import { bindPlugin, Plugin } from '../../src/cli/adapters/community-plugins/plugin.ts';
import { compareVersions, validateCommunityManifest, validateEnabledList, withEnabled } from '../../src/cli/domain/community-plugin.ts';

test('manifest, enabled list and version rules follow the Obsidian community-plugin shape', () => {
  assert.deepEqual(validateCommunityManifest(manifestFor('hello-world', { fundingUrl: 'x' }), 'hello-world', '0.4.0').issues, []);
  assert.equal(validateCommunityManifest(manifestFor('hello-world', { fundingUrl: 'x' }), 'hello-world', '0.4.0').manifest.fundingUrl, undefined);
  assert.equal(validateCommunityManifest(manifestFor('other'), 'hello-world', '0.4.0').issues[0].code, 'COMMUNITY_PLUGIN_ID_MISMATCH');
  assert.equal(validateCommunityManifest(manifestFor('hello-world', { minAppVersion: '9.0.0' }), 'hello-world', '0.4.0').issues[0].code, 'COMMUNITY_PLUGIN_APP_VERSION');
  assert.equal(validateCommunityManifest(manifestFor('hello-world', { authorUrl: 'http://x' }), 'hello-world', '0.4.0').issues[0].code, 'COMMUNITY_PLUGIN_MANIFEST_INVALID');
  assert.equal(validateCommunityManifest([], 'hello-world', '0.4.0').issues[0].code, 'COMMUNITY_PLUGIN_MANIFEST_INVALID');
  for (const extra of [{ category: 'misc' }, { tags: 'tool' }, { tags: ['A'] }, { tags: ['a', 'a'] }, { apiVersion: 0 }, { apiVersion: '1' }, { license: '' }])
    assert.equal(validateCommunityManifest(manifestFor('hello-world', extra), 'hello-world', '0.4.0').issues[0].code, 'COMMUNITY_PLUGIN_MANIFEST_INVALID', JSON.stringify(extra));
  assert.equal(validateCommunityManifest(manifestFor('hello-world', { apiVersion: 2 }), 'hello-world', '0.4.0').issues[0].code, 'COMMUNITY_PLUGIN_API_VERSION');
  assert.deepEqual(validateCommunityManifest(manifestFor('hello-world', { license: 'MIT' }), 'hello-world', '0.4.0').manifest.tags, ['greeting']);
  assert.deepEqual(validateEnabledList(['a', 'b']).ids, ['a', 'b']);
  for (const value of [{}, ['a', 'a'], ['Bad'], [1]]) assert.equal(validateEnabledList(value).issues[0].code, 'COMMUNITY_PLUGINS_LIST_INVALID');
  assert.deepEqual(withEnabled(['a'], 'b', true), ['a', 'b']);
  assert.deepEqual(withEnabled(['a', 'b'], 'b', true), ['a', 'b']);
  assert.deepEqual(withEnabled(['a', 'b'], 'a', false), ['b']);
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
});

test('discovery reads manifests without executing main.js and reports every unusable folder', async t => {
  const root = await frameworkRoot(t);
  await install(root, 'hello-world', { source: 'throw new Error("must not run during discovery");' });
  await install(root, 'no-settings', { settings: null });
  await install(root, 'bad-settings', { settings: [] });
  await install(root, 'too-new', { manifest: manifestFor('too-new', { minAppVersion: '99.0.0' }) });
  await install(root, 'sketch');
  await install(root, 'Bad_Name');
  await mkdir(join(root, 'bin/plugins/example-extension'), { recursive: true });
  await writeFile(join(root, 'bin/plugins/example-extension/config.json'), '{"enabled":false}');
  await symlink(join(root, 'bin/plugins/hello-world'), join(root, 'bin/plugins/linked'));
  await enable(root, ['hello-world', 'ghost']);
  const inventory = await communityInventory(root);
  const codes = Object.fromEntries(inventory.plugins.map(plugin => [plugin.id, plugin.issues.map(issue => issue.code)]));
  assert.deepEqual(codes, {
    'Bad_Name': ['COMMUNITY_PLUGIN_ID_INVALID'], 'bad-settings': ['COMMUNITY_PLUGIN_SETTINGS_INVALID'], 'hello-world': [],
    linked: ['COMMUNITY_PLUGIN_LINK'], 'no-settings': ['COMMUNITY_PLUGIN_FILE_MISSING'], sketch: ['COMMUNITY_PLUGIN_ID_RESERVED'],
    'too-new': ['COMMUNITY_PLUGIN_APP_VERSION'],
  }, 'a bundled plugin config folder is not an app plugin');
  assert.deepEqual(inventory.issues.map(issue => issue.code), ['COMMUNITY_PLUGIN_MISSING']);
  assert.equal(inventory.plugins.find(plugin => plugin.id === 'hello-world').enabled, true);
});

test('an enabled plugin runs as a bin/app command, persists settings.json and unloads in order', async t => {
  const root = await frameworkRoot(t);
  const folder = await install(root, 'hello-world');
  await enable(root, ['hello-world']);
  const events = [], record = value => events.push(value);
  process.on('app-plugin-test', record); t.after(() => process.off('app-plugin-test', record));
  let result = await run(root, ['hello-world', 'greet', '--who', 'Ada', '--loud', '--json']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(JSON.parse(result.stdout).data, { message: 'HELLO, ADA!', count: 1, app: '0.4.0' });
  assert.deepEqual(events, ['hello-world:cleanup', 'hello-world:onunload']);
  assert.deepEqual(JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8')), { greeting: 'Hello', count: 1 });
  result = await run(root, ['hello-world', 'greet', '--json']);
  assert.equal(JSON.parse(result.stdout).data.count, 2, 'saved settings are loaded by the next invocation');
  result = await run(root, ['hello-world', '--json']);
  assert.deepEqual(JSON.parse(result.stdout).data.commands, [{ id: 'greet', name: 'Greet' }]);
  result = await run(root, ['hello-world', 'missing', '--json']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'COMMUNITY_PLUGIN_COMMAND_UNKNOWN');
  result = await run(root, ['hello-world', 'greet', '--unknown', '--json']);
  assert.equal(result.status, 1, 'undeclared flags are refused like any plugin command');
});

test('a failing plugin is reported and skipped without stopping other plugins', async t => {
  const root = await frameworkRoot(t);
  await install(root, 'broken', { source: `const { Plugin } = require('workbench');
module.exports = class extends Plugin { onload() { this.register(() => process.emit('app-plugin-test', 'broken:cleanup')); throw new Error('boom'); } };` });
  await install(root, 'not-a-plugin', { source: 'module.exports = class {};' });
  await install(root, 'hello-world');
  await enable(root, ['broken', 'not-a-plugin', 'hello-world']);
  const events = [], record = value => events.push(value);
  process.on('app-plugin-test', record); t.after(() => process.off('app-plugin-test', record));
  const result = await run(root, ['hello-world', 'greet', '--json']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /bin\/plugins\/broken failed to load: boom/);
  assert.match(result.stderr, /COMMUNITY_PLUGIN_EXPORT_INVALID: bin\/plugins\/not-a-plugin failed to load/);
  assert.equal(events[0], 'broken:cleanup', 'cleanups registered before a failed onload still run');
  assert.ok(!events.includes('broken:onunload'));
});

test('disabled or invalid plugins never load and explain the next step', async t => {
  const root = await frameworkRoot(t);
  await install(root, 'hello-world', { source: 'process.emit("app-plugin-test", "executed");' });
  const events = [], record = value => events.push(value);
  process.on('app-plugin-test', record); t.after(() => process.off('app-plugin-test', record));
  let result = await run(root, ['hello-world', 'greet', '--json']);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).diagnostics[0].code, 'COMMUNITY_PLUGIN_INACTIVE');
  assert.match(JSON.parse(result.stdout).diagnostics[0].message, /plugins enable hello-world/);
  await writeFile(join(root, 'bin/plugins/hello-world/settings.json'), 'not json');
  await enable(root, ['hello-world']);
  result = await run(root, ['hello-world', 'greet', '--json']);
  assert.match(JSON.parse(result.stdout).diagnostics[0].message, /cannot load: settings\.json/);
  await enable(root, 'not a list');
  const listed = await operation(root, 'plugins list');
  assert.equal(listed.status, 'ok');
  assert.deepEqual(listed.data.issues.map(issue => issue.code), ['COMMUNITY_PLUGINS_LIST_INVALID']);
  await install(root, 'sketch', { source: 'process.emit("app-plugin-test", "executed");' });
  result = await run(root, ['sketch', '--help', '--json']);
  assert.equal(result.status, 0, 'a folder named after a built-in root never shadows it');
  assert.equal(JSON.parse(result.stdout).command, 'sketch');
  assert.deepEqual(events, [], 'main.js never ran');
});

test('plugins list/show/enable/disable manage community-plugins.json through reviewed plans', async t => {
  const root = await frameworkRoot(t);
  await install(root, 'hello-world', { source: 'throw new Error("management never executes plugins");' });
  await install(root, 'too-new', { manifest: manifestFor('too-new', { minAppVersion: '99.0.0' }) });
  let outcome = await operation(root, 'plugins list');
  assert.equal(outcome.status, 'ok');
  assert.deepEqual(outcome.data.plugins.map(plugin => [plugin.id, plugin.status]), [['hello-world', 'disabled'], ['too-new', 'invalid']]);
  assert.ok(outcome.data.bundled.some(plugin => plugin.id === 'example-extension'));
  outcome = await operation(root, 'plugins show', ['hello-world']);
  assert.deepEqual(outcome.data.settings, { greeting: 'Hello' });
  assert.equal((await operation(root, 'plugins show', ['hello-wrld'])).diagnostics[0].code, 'COMMUNITY_PLUGIN_UNKNOWN');
  outcome = await operation(root, 'plugins enable', ['hello-world']);
  assert.equal(outcome.status, 'planned');
  assert.match(outcome.data.summary.trust, /not sandboxed/);
  await assert.rejects(readFile(join(root, 'bin/plugins/community-plugins.json')), 'a preview writes nothing');
  outcome = await operation(root, 'plugins enable', ['hello-world'], { apply: outcome.data.planHash });
  assert.equal(outcome.status, 'applied');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'bin/plugins/community-plugins.json'), 'utf8')), ['hello-world']);
  assert.equal((await operation(root, 'plugins enable', ['hello-world'], { yes: true })).status, 'unchanged');
  assert.equal((await operation(root, 'plugins enable', ['too-new'], { yes: true })).diagnostics[0].code, 'COMMUNITY_PLUGIN_APP_VERSION');
  assert.equal((await operation(root, 'plugins enable', ['ghost'], { yes: true })).diagnostics[0].code, 'COMMUNITY_PLUGIN_UNKNOWN');
  outcome = await operation(root, 'plugins disable', ['hello-world'], { yes: true });
  assert.equal(outcome.status, 'applied');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'bin/plugins/community-plugins.json'), 'utf8')), []);
  assert.ok(JSON.parse(await readFile(join(root, 'bin/plugins/hello-world/settings.json'), 'utf8')), 'disabling keeps settings');
  await enable(root, ['ghost']);
  assert.equal((await operation(root, 'plugins disable', ['ghost'], { yes: true })).status, 'applied', 'a missing enabled plugin can be disabled');
  await writeFile(join(root, 'bin/plugins/community-plugins.json'), '{"corrupt":true}');
  outcome = await operation(root, 'plugins enable', ['hello-world'], { yes: true });
  assert.equal(outcome.diagnostics[0].code, 'COMMUNITY_PLUGINS_LIST_INVALID');
  assert.equal(await readFile(join(root, 'bin/plugins/community-plugins.json'), 'utf8'), '{"corrupt":true}', 'a corrupt list is preserved');
});

test('the Plugin API refuses use before loading and validates every registration', async t => {
  const root = await frameworkRoot(t);
  const folder = await install(root, 'hello-world');
  const plugin = new Plugin({ version: '0.4.0', frameworkRoot: root }, manifestFor('hello-world'));
  for (const call of [() => plugin.loadData(), () => plugin.saveData({}), async () => plugin.addCommand({}), async () => plugin.addStudioAction({}), async () => plugin.register(() => {})])
    await assert.rejects(call(), { code: 'COMMUNITY_PLUGIN_NOT_LOADED' });
  const binding = bindPlugin(plugin, folder);
  assert.equal(await plugin.onload(), undefined);
  assert.deepEqual(await plugin.loadData(), { greeting: 'Hello' });
  await assert.rejects(plugin.saveData([]), { code: 'COMMUNITY_PLUGIN_SETTINGS_INVALID' });
  await assert.rejects(plugin.saveData({ value: Number.NaN }));
  await Promise.all([plugin.saveData({ step: 1 }), plugin.saveData({ step: 2 })]);
  assert.deepEqual(JSON.parse(await readFile(join(folder, 'settings.json'), 'utf8')), { step: 2 }, 'saves run in call order');
  const command = { id: 'greet', name: 'Greet', execute: () => ({}) };
  assert.equal(plugin.addCommand(command), command);
  assert.throws(() => plugin.addCommand(command), { code: 'COMMUNITY_PLUGIN_COMMAND_DUPLICATE' });
  assert.throws(() => plugin.addCommand({ id: 'Bad', name: 'x', execute: () => ({}) }), { code: 'COMMUNITY_PLUGIN_COMMAND_INVALID' });
  plugin.addStudioAction({ id: 'wave', label: 'Wave', run: () => {} });
  assert.throws(() => plugin.addStudioAction({ id: 'wave', label: 'Wave', run: () => {} }), { code: 'COMMUNITY_PLUGIN_ACTION_DUPLICATE' });
  assert.throws(() => plugin.addStudioAction({ id: 'x', label: '', run: () => {} }), { code: 'COMMUNITY_PLUGIN_ACTION_INVALID' });
  assert.throws(() => plugin.register('not a function'), { code: 'COMMUNITY_PLUGIN_CLEANUP_INVALID' });
  assert.deepEqual([...binding.commands.keys(), ...binding.actions.keys()], ['greet', 'wave']);
});

test('an app plugin command cannot declare the built-in --config project-configuration option', async t => {
  const root = await frameworkRoot(t);
  const declare = values => `const { Plugin } = require('workbench');
module.exports = class Configured extends Plugin { async onload() { this.addCommand({ id: 'go', name: 'Go', options: { values: ${JSON.stringify(values)} }, execute: async () => ({ ran: true }) }); } };`;
  await install(root, 'configured', { source: declare(['config']) });
  await enable(root, ['configured']);
  const shadowed = await run(root, ['configured', 'go', '--config', 'configs/desk-config.json', '--json']);
  assert.equal(shadowed.status, 1);
  assert.equal(JSON.parse(shadowed.stdout).diagnostics[0].code, 'WORKBENCH_PLUGIN_CLI_OPTIONS_INVALID', 'config stays a built-in maker option');
  await install(root, 'configured', { source: declare(['region']) });
  const own = await run(root, ['configured', 'go', '--region', 'x', '--json']);
  assert.equal(own.status, 0, own.stdout + own.stderr);
  assert.deepEqual(JSON.parse(own.stdout).data, { ran: true });
});
