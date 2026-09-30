import manifest from '../manifest.json' with { type: 'json' };
import config from '../config.json' with { type: 'json' };
import { definePluginEvent, type WorkbenchPluginObject } from '../../api.ts';
import { defineFrameworkAdapter } from '../../../scripts/compiler/adapters/project/framework-adapter.ts';
import type { StarterDefinition } from '../../../scripts/starters/types.ts';

export const exampleNotice = definePluginEvent('example-extension.notice',
  (value): value is { message: string } => Boolean(value && typeof value === 'object'
    && typeof (value as { message?: unknown }).message === 'string'));

export const reactAdapter = defineFrameworkAdapter({
  id: 'react',
  label: 'React 19 — client-rendered React using the qualified Vite project engine.',
  engine: 'vanilla',
  dependencies: { react: '19.3.0', 'react-dom': '19.3.0' },
  devDependencies: { '@types/react': '19.3.0', '@types/react-dom': '19.3.0' },
  files() {
    return {
      'src/ui/mount.ts': [
        "import { createElement } from 'react';",
        "import { createRoot } from 'react-dom/client';",
        "import { project } from '../core/project.ts';",
        "import { activatePlugins, visualHost } from '../core/plugin-runtime.ts';",
        "export async function mount(root: HTMLElement): Promise<() => void> {",
        "  const reactRoot = createRoot(root);",
        "  reactRoot.render(createElement('main', null, createElement('h1', null, project.title),",
        "    createElement('p', null, 'React starter ready. Implement the agreed product surfaces next.')));",
        "  const deactivate = activatePlugins(visualHost(root), root);",
        "  let closed = false;",
        "  return () => { if (closed) return; closed = true; try { deactivate(); } finally { reactRoot.unmount(); } };",
        "}",
        "",
      ].join('\n'),
    };
  },
});

export const reactStarter = {
  schemaVersion: 1,
  id: 'webapp-react',
  name: 'Webapp with React',
  version: '1.0.0',
  category: 'Projects',
  level: 'Foundation',
  summary: 'A browser application using a plugin-provided React framework adapter.',
  outcome: 'A reviewed React web application scaffold produced through the same project-starter workflow.',
  includes: ['Shared project core', 'React UI mount', 'Typed plugin system', 'Vite build and offline prototype'],
  implementation: ['Agree the prototype brief', 'Resolve exact dependencies explicitly', 'Typecheck, test and build the generated project'],
  tags: ['webapp', 'react', 'plugin-framework'],
  inputs: [],
  generator: { kind: 'project', projectType: 'webapp', framework: 'react', targets: ['webapp'] },
  files: [],
  processes: [],
  firstRun: [],
  nextSteps: ['Review the generated package, resolve dependencies, then implement the agreed React surfaces.'],
} satisfies StarterDefinition;

export const PluginObject = {
  manifest,
  config,
  events: [exampleNotice],
  frameworks: [reactAdapter],
  starters: [reactStarter],
  cli: [{
    id: 'example',
    summary: 'Dispatch the example plugin event.',
    options: { values: ['message'] },
    execute(request, context) {
      const message = typeof request.flags.message === 'string' ? request.flags.message : config.defaultMessage;
      context.eventBus.dispatch(exampleNotice, { message });
      return { plugin: manifest.id, message };
    },
  }],
  tui: [{
    id: 'example-notice',
    label: 'Example plugin: dispatch an event',
    run({ eventBus, ui }) {
      eventBus.dispatch(exampleNotice, { message: config.defaultMessage });
      ui.write('Example plugin event dispatched.\n');
    },
  }],
  activate({ eventBus, progress }) {
    return eventBus.on(exampleNotice, payload => progress?.('[' + manifest.id + '] ' + payload.message + '\n'));
  },
} satisfies WorkbenchPluginObject;

export default PluginObject;
