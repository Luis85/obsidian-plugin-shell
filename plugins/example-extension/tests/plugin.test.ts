import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { execute, parseArguments } from '../../../bin/adapters/commands.ts';
import { definePluginEvent } from '../../api.ts';
import { createPluginRuntime, pluginFrameworkAdapters, pluginStarterDefinitions } from '../../runtime.ts';
import { PluginObject, exampleNotice, reactAdapter, reactStarter } from '../src/index.ts';

const enabled = { ...PluginObject, config: { ...PluginObject.config, enabled: true } };

test('plugin owns manifest/config and can contribute a framework, starter, CLI and TUI', () => {
  assert.equal(PluginObject.manifest.id, 'example-extension');
  assert.equal(PluginObject.config.enabled, false);
  assert.deepEqual(pluginFrameworkAdapters([PluginObject]), []);
  assert.deepEqual(pluginStarterDefinitions([PluginObject]), []);
  assert.equal(pluginFrameworkAdapters([enabled])[0], reactAdapter);
  assert.equal(pluginStarterDefinitions([enabled])[0], reactStarter);
  assert.equal(reactStarter.generator.framework, 'react');
  assert.equal(reactAdapter.engine, 'vanilla');
  assert.match(reactAdapter.files?.({} as never)['src/ui/mount.ts'] ?? '', /react-dom\/client/);
});

test('one invocation shares the event bus across activation, CLI and TUI contributions', async () => {
  const errors: string[] = [], progress: string[] = [], received: Array<{ message: string }> = [];
  const input = Readable.from([]);
  const runtime = await createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input, registry: [enabled],
    progress: message => progress.push(message), onError: code => errors.push(code),
  });
  const off = runtime.eventBus.on(exampleNotice, payload => {
    assert.ok(Object.isFrozen(payload));
    received.push(payload);
  });
  let once = 0;
  runtime.eventBus.once(exampleNotice, () => { once += 1; });
  const args = parseArguments(['example', 'send', '--message', 'Hello'], runtime.cliCommands);
  const result = await execute(args, { root: '/workspace', frameworkRoot: '/framework', input, plugins: runtime });
  assert.deepEqual(result, { plugin: 'example-extension', message: 'Hello' });
  assert.deepEqual(received, [{ message: 'Hello' }]);
  assert.equal(once, 1);
  assert.match(progress.join(''), /Hello/);

  const writes: string[] = [];
  await runtime.tuiActions[0]!.run({
    ...runtime.commandContext, project: 'design/project.json',
    ui: { ask: async () => '', write: text => writes.push(text) },
    workspace: {} as never,
  });
  assert.equal(received.length, 2);
  assert.match(writes.join(''), /dispatched/);

  runtime.eventBus.dispatch(exampleNotice, { message: 4 } as never);
  assert.ok(errors.includes('WORKBENCH_PLUGIN_EVENT_PAYLOAD'));
  const foreign = definePluginEvent('foreign.event', (value): value is string => typeof value === 'string');
  assert.throws(() => runtime.eventBus.dispatch(foreign, 'no'), /UNREGISTERED/);
  off();
  runtime.dispose();
  runtime.dispose();
});

test('plugin command parsing rejects a collision with a built-in maker command', () => {
  const collision = [{ id: 'new', summary: 'bad', execute: () => ({}) }];
  assert.throws(() => parseArguments(['new'], collision), /conflicts with a built-in/);
});
