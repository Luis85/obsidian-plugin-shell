import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { execute, parseArguments } from '../../../bin/adapters/commands.ts';
import { studioActions } from '../../../bin/presentation/studio.ts';
import { Workspace } from '../../../bin/application/workspace.ts';
import { newDocument, documentText } from '../../../bin/domain/document.ts';
import { runOperations } from '../../../bin/application/operations.ts';
import { compileProject, loadTemplateSnapshot } from '../../../scripts/compiler/index.ts';
import { packageFiles } from '../../../scripts/compiler/adapters/project/configuration.ts';
import { defineFrameworkAdapter } from '../../../scripts/compiler/adapters/project/framework-adapter.ts';
import { renderStarterProject } from '../../../scripts/compiler/adapters/project/emitter.ts';
import { projectSelection } from '../../../scripts/compiler/domain/project-starter.ts';
import { loadDefinitions } from '../../../scripts/starters/repository.ts';
import { definePluginEvent, type WorkbenchPluginObject } from '../../api.ts';
import { createPluginRuntime, pluginFrameworkAdapters, pluginStarterDefinitions } from '../../runtime.ts';
import { PluginObject, exampleNotice, reactAdapter, reactStarter } from '../src/index.ts';

const enabled = { ...PluginObject, config: { ...PluginObject.config, enabled: true } };

// Compile-time contract only; never invoked.
function dynamicEventNamesAreRejected(): void {
  const dynamicEventName: string = 'example-extension.dynamic';
  // @ts-expect-error plugin event names must remain literal so payload types stay correlated.
  definePluginEvent(dynamicEventName, (value): value is string => typeof value === 'string');
}
void dynamicEventNamesAreRejected;

void test('plugin owns manifest/config and can contribute a framework, starter, CLI and TUI', () => {
  assert.equal(PluginObject.manifest.id, 'example-extension');
  assert.equal(PluginObject.config.enabled, false);
  assert.deepEqual(pluginFrameworkAdapters([PluginObject]), []);
  assert.deepEqual(pluginStarterDefinitions([PluginObject]), []);
  assert.equal(pluginFrameworkAdapters([enabled])[0], reactAdapter);
  assert.equal(pluginStarterDefinitions([enabled])[0], reactStarter);
  assert.equal(reactStarter.generator.framework, 'react');
  assert.equal(reactAdapter.engine, 'vanilla');
  assert.match(reactAdapter.files()['src/ui/mount.ts'] ?? '', /react-dom\/client/);
});

void test('framework adapters reject ambiguous dependency ownership', () => {
  assert.throws(() => defineFrameworkAdapter({
    id: 'scope-conflict', label: 'Scope conflict', engine: 'vanilla',
    dependencies: { react: '19.3.0' }, devDependencies: { react: '19.3.0' },
  }), /DEPENDENCY_SCOPE_CONFLICT/);
  const selection = projectSelection({ id: reactStarter.id, version: reactStarter.version, sha256: 'c'.repeat(64) }, reactStarter.generator);
  const template = { text() {
    return JSON.stringify({ dependencies: {}, devDependencies: { typescript: '6.0.3', '@types/node': '26.6.3', vite: '8.3.1' } });
  } };
  const wrongScope = defineFrameworkAdapter({
    id: 'react', label: 'React scope conflict', engine: 'vanilla',
    dependencies: { vite: '8.3.1' },
  });
  assert.throws(() => packageFiles(template as never, selection, 'react-app', wrongScope), /dependency scope/);
  const wrongVersion = defineFrameworkAdapter({
    id: 'react', label: 'React version conflict', engine: 'vanilla',
    devDependencies: { vite: '9.0.0' },
  });
  assert.throws(() => packageFiles(template as never, selection, 'react-app', wrongVersion), /dependency conflicts/);
});

void test('plugin starter discovery and framework package emission use the normal project contracts', async () => {
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


void test('plugin framework adapter compiles a real React project through the pure compiler extension port', async () => {
  const document = runOperations(newDocument('React extension'), [{ op: 'page.add', title: 'Overview' }]).document;
  const selection = projectSelection({ id: reactStarter.id, version: reactStarter.version, sha256: 'b'.repeat(64) }, reactStarter.generator);
  const result = await compileProject({
    source: documentText(document),
    sourceName: 'react-extension.project.json',
    outputKind: 'project',
    projectSelection: selection,
    template: await loadTemplateSnapshot(process.cwd()),
  }, {}, { frameworkAdapters: [reactAdapter] });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  const files = new Map(result.artifacts.map(artifact => [artifact.path, artifact.content]));
  assert.match(files.get('src/ui/mount.ts') ?? '', /react-dom\/client/);
  const pkg = JSON.parse(files.get('package.json') ?? '{}');
  assert.equal(pkg.dependencies.react, '19.3.0');
  assert.equal(pkg.dependencies['react-dom'], '19.3.0');
  assert.equal(JSON.parse(files.get('project.config.json') ?? '{}').framework, 'react');
});

void test('plugin framework adapter drives the real project emitter', () => {
  const selection = projectSelection({ id: reactStarter.id, version: reactStarter.version, sha256: 'b'.repeat(64) }, reactStarter.generator);
  const model = {
    project: { id: 'react-app', name: 'React App', version: '0.1.0', description: 'React proof', author: 'Workbench' },
    screens: [{ id: 'overview', kind: 'page', label: 'Overview', goal: 'Show the React shell', components: [] }],
    document: { schemaVersion: 6, project: { id: 'react-app', name: 'React App' }, settings: {}, design: {} },
  };
  const template = {
    skillFiles: [],
    text(path: string) {
      if (path !== 'package.json') throw new Error('Unexpected template read: ' + path);
      return JSON.stringify({ dependencies: {}, devDependencies: { typescript: '6.0.3', '@types/node': '26.6.3', vite: '8.3.1' } });
    },
  };
  const artifacts = renderStarterProject(model as never, template as never, selection, reactAdapter);
  const files = new Map(artifacts.map(item => [item.path, item.content]));
  const pkg = JSON.parse(files.get('package.json')!);
  assert.equal(JSON.parse(files.get('project.config.json')!).framework, 'react');
  assert.equal(pkg.dependencies.react, '19.3.0');
  assert.equal(pkg.dependencies['react-dom'], '19.3.0');
  assert.match(files.get('src/ui/mount.ts')!, /react-dom\/client/);
  assert.ok(files.has('src/targets/webapp/main.ts'));
  assert.ok(!files.has('src/ui/Starter.vue'));
  assert.throws(() => renderStarterProject(model as never, template as never, selection, { ...reactAdapter, id: 'other' }), /SELECTION_MISMATCH/);
});

void test('one invocation shares the event bus across activation, CLI and TUI contributions', async () => {
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
  const helpArgs = parseArguments(['--help'], runtime.cliCommands);
  const help = await execute(helpArgs, { root: '/workspace', frameworkRoot: '/framework', input, plugins: runtime });
  assert.ok(Array.isArray(help.commands) && help.commands.includes('example'));
  assert.match(String(help.help), /node bin\/app example/);
  assert.deepEqual(help.pluginCommands, [{ id: 'example', summary: 'Dispatch the example plugin event.', options: { values: ['message'] } }]);

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

void test('plugin command parsing rejects reserved Workbench command roots', async () => {
  const makerCollision = [{ id: 'new', summary: 'bad', execute: () => ({}) }];
  assert.throws(() => parseArguments(['new'], makerCollision), /conflicts with a built-in/);
  const frameworkCollision = { ...enabled, cli: [{ id: 'build', summary: 'bad', execute: () => ({}) }] };
  await assert.rejects(() => createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input: Readable.from([]), registry: [frameworkCollision],
  }), /WORKBENCH_PLUGIN_CLI_RESERVED/);
  const optionCollision = { ...enabled, cli: [{ id: 'safe-command', summary: 'bad option', options: { values: ['root'] }, execute: () => ({}) }] };
  await assert.rejects(() => createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input: Readable.from([]), registry: [optionCollision],
  }), /WORKBENCH_PLUGIN_CLI_OPTIONS_INVALID/);
});

void test('plugin events must stay in the owning manifest namespace', async () => {
  const foreign = definePluginEvent('other-plugin.changed', (value): value is string => typeof value === 'string');
  const plugin = { ...enabled, events: [foreign], cli: [], tui: [], frameworks: [], starters: [] };
  await assert.rejects(() => createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input: Readable.from([]), registry: [plugin],
  }), /WORKBENCH_PLUGIN_EVENT_OWNER/);
});

void test('plugin event bus bounds recursive dispatch without crashing the invocation', async () => {
  const recursive = definePluginEvent('recursive-plugin.tick',
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
  } satisfies WorkbenchPluginObject;
  const runtime = await createPluginRuntime({
    root: '/workspace', frameworkRoot: '/framework', input: Readable.from([]), registry: [recursivePlugin],
    onError: code => errors.push(code),
  });
  runtime.eventBus.dispatch(recursive, { value: 0 });
  assert.ok(errors.includes('WORKBENCH_PLUGIN_EVENT_RECURSION'));
  runtime.dispose();
});
