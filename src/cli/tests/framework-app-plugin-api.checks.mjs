import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { enable, frameworkRoot, install, manifestFor, run } from './support/app-plugins-fixture.mjs';
import { definePluginEvent } from '../sdk/api.ts';
import { WorkbenchEventBus } from '../sdk/runtime.ts';

const publisher = `const { Plugin } = require('workbench');
module.exports = class Publisher extends Plugin {
  onload() {
    this.synced = this.app.events.define('synced', value => typeof value?.count === 'number');
    this.addCommand({ id: 'sync', name: 'Sync', options: { values: ['times'] }, execute: request => {
      this.app.events.dispatch(this.synced, { count: Number(request.flags.times ?? 1) });
      return { dispatched: true };
    } });
  }
  describe() { return 'publisher ' + this.manifest.version; }
};
`;
const listener = `const { Plugin } = require('workbench');
const seen = value => process.emit('app-plugin-api', value);
module.exports = class Listener extends Plugin {
  onload() {
    this.app.events.on('app.plugins-loaded', ({ plugins }) => {
      seen({ loaded: plugins });
      this.app.events.on('publisher.synced', payload => seen({ synced: payload.count, frozen: Object.isFrozen(payload) }));
    });
    this.app.events.on('app.command-finished', payload => seen({ finished: payload }));
    this.addCommand({ id: 'probe', name: 'Probe the app API', execute: async () => {
      const refused = [];
      for (const event of ['publisher.synced', 'app.command-started', 'nobody.never'])
        try { this.app.events.dispatch(event, { count: 1 }); } catch (error) { refused.push(error.code); }
      try { await this.app.commands.run('mcp'); } catch (error) { refused.push(error.code); }
      const version = await this.app.commands.run('version');
      const plan = await this.app.files.plan([{ path: 'notes/automation.md', content: '# Written by a plugin\\n' }]);
      const applied = await this.app.files.apply(plan);
      this.app.log('probe finished');
      return {
        refused, version: version.data.frameworkVersion, status: version.status, root: this.app.root, api: this.app.apiVersion,
        catalog: this.app.commands.list().some(command => command.id === 'plugins list' && command.effect === 'read'),
        events: this.app.events.list().filter(id => id.startsWith('app.') || id.startsWith('publisher.')),
        written: applied.written, plugins: this.app.plugins.list().map(manifest => manifest.id + ':' + manifest.category),
        peer: this.app.plugins.get('publisher')?.describe(), missing: this.app.plugins.get('absent') === undefined,
      };
    } });
  }
};
`;
async function setup(t) {
  const root = await frameworkRoot(t);
  await install(root, 'listener', { source: listener, manifest: manifestFor('listener', { category: 'automation' }) });
  await install(root, 'publisher', { source: publisher, manifest: manifestFor('publisher', { version: '2.1.0', category: 'integration' }) });
  await enable(root, ['listener', 'publisher']);
  const events = [], record = value => events.push(value);
  process.on('app-plugin-api', record); t.after(() => process.off('app-plugin-api', record));
  return { root, events };
}

test('plugins share the invocation event bus: own events, built-in app events and late subscription', async t => {
  const { root, events } = await setup(t);
  const result = await run(root, ['publisher', 'sync', '--times', '3', '--json']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(events, [
    { loaded: ['listener', 'publisher'] },
    { synced: 3, frozen: true },
    { finished: { command: 'publisher', action: 'sync', status: 'ok' } },
  ]);
});

test('this.app exposes the command toolset, file plans, peer plugins and logging under the plugin API contract', async t => {
  const { root } = await setup(t);
  const project = join(root, 'project');
  await mkdir(project);
  const result = await run(root, ['listener', 'probe', '--root', project, '--json']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const data = JSON.parse(result.stdout).data;
  assert.deepEqual(data.refused, ['COMMUNITY_PLUGIN_EVENT_OWNER', 'COMMUNITY_PLUGIN_EVENT_OWNER', 'COMMUNITY_PLUGIN_EVENT_UNKNOWN', 'COMMUNITY_PLUGIN_COMMAND_REFUSED']);
  assert.equal(data.version, '0.4.0');
  assert.equal(data.status, 'ok');
  assert.equal(data.root, project, 'this.app.root follows --root');
  assert.equal(data.api, 1);
  assert.equal(data.catalog, true);
  assert.deepEqual(data.events, ['app.command-finished', 'app.command-started', 'app.plugins-loaded', 'publisher.synced']);
  assert.deepEqual(data.written, ['notes/automation.md']);
  assert.equal(await readFile(join(project, 'notes/automation.md'), 'utf8'), '# Written by a plugin\n');
  assert.deepEqual(data.plugins, ['listener:automation', 'publisher:integration']);
  assert.equal(data.peer, 'publisher 2.1.0');
  assert.equal(data.missing, true);
  assert.match(result.stderr, /\[listener\] probe finished/);
});

test('an event used before it is defined fails that plugin load only', async t => {
  const root = await frameworkRoot(t);
  await install(root, 'early', { source: `const { Plugin } = require('workbench');
module.exports = class extends Plugin { onload() { this.app.events.on('late.ready', () => {}); } };` });
  await install(root, 'late', { source: `const { Plugin } = require('workbench');
module.exports = class extends Plugin { onload() { this.app.events.define('ready'); this.addCommand({ id: 'ok', name: 'Ok', execute: () => ({ ok: true }) }); } };` });
  await enable(root, ['early', 'late']);
  const result = await run(root, ['late', 'ok', '--json']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /COMMUNITY_PLUGIN_EVENT_UNKNOWN: bin\/plugins\/early failed to load/);
  assert.deepEqual(JSON.parse(result.stdout).data, { ok: true });
});

test('the shared bus accepts definitions until disposal and refuses a different definition for a used ID', () => {
  const reported = [];
  const ready = definePluginEvent('first.ready', value => typeof value === 'string');
  const bus = new WorkbenchEventBus([ready], code => reported.push(code));
  assert.equal(bus.define(ready), ready, 'redefining the identical definition is a no-op');
  assert.throws(() => bus.define(definePluginEvent('first.ready', value => typeof value === 'string')), /WORKBENCH_PLUGIN_EVENT_DUPLICATE/);
  const late = bus.define(definePluginEvent('second.done', value => typeof value === 'number'));
  assert.equal(bus.definition('second.done'), late);
  assert.equal(bus.definition('absent.event'), undefined);
  assert.deepEqual(bus.ids(), ['first.ready', 'second.done']);
  const seen = [];
  bus.on(late, value => seen.push(value));
  bus.dispatch(late, 2);
  bus.dispatch(late, 'not a number');
  assert.deepEqual(seen, [2]);
  assert.deepEqual(reported, ['WORKBENCH_PLUGIN_EVENT_PAYLOAD']);
  bus.dispose();
  assert.throws(() => bus.define(definePluginEvent('third.x', value => value === 1)), /WORKBENCH_PLUGIN_BUS_DISPOSED/);
});
