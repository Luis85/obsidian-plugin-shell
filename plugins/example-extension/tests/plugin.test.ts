import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { execute, parseArguments } from '../../../bin/adapters/commands.ts';
import { studioActions } from '../../../bin/presentation/studio.ts';
import { Workspace } from '../../../bin/application/workspace.ts';
import { newDocument } from '../../../bin/domain/document.ts';
import { packageFiles } from '../../../scripts/compiler/adapters/project/configuration.ts';
import { projectSelection } from '../../../scripts/compiler/domain/project-starter.ts';
import { loadDefinitions } from '../../../scripts/starters/repository.ts';
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

test('plugin starter discovery and framework package emission use the normal project contracts', async () => {
  const entries = await loadDefinitions(process.cwd(), [reactStarter]);
  const discovered = entries.find(entry => entry.definition.id === 'webapp-react');
  assert.equal(discovered?.file, 'plugin:webapp-react');
  assert.match(discovered?.sha256 ?? '', /^[a-f0-9]{64}$/);
  const selection = projectSelection({ id: reactStarter.id, version: reactStarter.version, sha256: 'a'.repeat(64) }, reactStarter.generator);
  const template = { text(path: string) {
    assert.equal(path, 'package.json');
    return JSON.stringify({ dependencies: {}, devDependencies: { typescript: '6.0.3', '@types/node': '26.6.3', vite: '8.3.1' } });
  } };
  const generated = packageFiles(template as never, selection, 'react-app', reactAdapter);
  const pkg = JSON.parse(generated['package.json']!);
  assert.equal(pkg.dependencies.react, '19.3.0');
  assert.equal(pkg.dependencies['react-dom'], '19.3.0');
  assert.equal(pkg.devDependencies['@types/react'], '19.3.0');
  assert.equal(pkg.scripts.typecheck, 'tsc --noEmit --project tsconfig.json');
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
  const ui = { ask: async () => '', write: (text: string) => writes.push(text) };
  const workspace = new Workspace(newDocument('Plugin Studio'), null);
  const actions = studioActions(ui, {
    root: '/workspace', frameworkRoot: '/framework', project: 'design/project.json', plugins: runtime,
  }, workspace);
  assert.equal(actions['plugin-example-notice']?.label, 'Example plugin: dispatch an event');
  await actions['plugin-example-notice']!.run();
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

test('plugin command parsing rejects reserved Workbench command roots', async () => {
  const makerCollision = [{ id: 'new', summary: 'bad', execute: () => ({}) }];
  assert.throws(() => parseArguments(['new'], makerCollision), /conflicts with a built-in/);
  const frameworkCollision = { ...enabled, cli: [{ id: 'build', summary: 'bad', execute: () => ({}) }] };
  await assert.rejects(() => createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input: Readable.from([]), registry: [frameworkCollision],
  }), /WORKBENCH_PLUGIN_CLI_RESERVED/);
});

test('plugin event bus bounds recursive dispatch without crashing the invocation', async () => {
  const recursive = definePluginEvent('recursive.tick',
    (value): value is { value: number } => Boolean(value && typeof value === 'object'
      && Number.isInteger((value as { value?: unknown }).value)));
  const errors: string[] = [];
  const recursivePlugin = {
    ...enabled,
    manifest: { ...enabled.manifest, id: 'recursive-plugin' },
    events: [recursive],
    cli: [],
    tui: [],
    frameworks: [],
    starters: [],
    activate({ eventBus }) {
      return eventBus.on(recursive, payload => eventBus.dispatch(recursive, { value: payload.value + 1 }));
    },
  };
  const runtime = await createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input: Readable.from([]), registry: [recursivePlugin],
    onError: code => errors.push(code),
  });
  runtime.eventBus.dispatch(recursive, { value: 0 });
  assert.ok(errors.includes('WORKBENCH_PLUGIN_EVENT_RECURSION'));
  runtime.dispose();
});
