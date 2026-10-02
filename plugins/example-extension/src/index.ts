import manifest from '../manifest.json' with { type: 'json' };
import config from '../config.json' with { type: 'json' };
import { definePluginEvent, type WorkbenchPluginObject } from '../../api.ts';
import { defineFrameworkAdapter } from '../../../bin/compiler/adapters/project/framework-adapter.ts';
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
        "import { createElement, useEffect, useRef, useState } from 'react';",
        "import { createRoot } from 'react-dom/client';",
        "import { project, scaffoldNotice } from '../core/project.ts';",
        "import { activatePlugins, visualHost } from '../core/plugin-runtime.ts';",
        "function Starter() {",
        "  const [current, setCurrent] = useState<string>(project.pages[0]?.id ?? '');",
        "  const main = useRef<HTMLElement | null>(null);",
        "  const focus = useRef(false);",
        "  const page = project.pages.find(item => item.id === current);",
        "  useEffect(() => { if (focus.current) { main.current?.focus(); focus.current = false; } }, [current]);",
        "  const select = (id: string) => { focus.current = true; setCurrent(id); };",
        "  return createElement('div', null,",
        "    createElement('h1', null, project.title),",
        "    createElement('p', { role: 'status' }, scaffoldNotice),",
        "    createElement('nav', { 'aria-label': 'Project pages' }, ...project.pages.map(item =>",
        "      createElement('button', { key: item.id, type: 'button', 'aria-current': item.id === current ? 'page' : undefined, onClick: () => select(item.id) }, item.title))),",
        "    createElement('main', { ref: main, tabIndex: -1 }, page",
        "      ? createElement('div', null, createElement('h2', null, page.title), createElement('p', null, page.goal || 'Describe this page during prototyping.'),",
        "        createElement('ul', null, ...page.components.map(id => createElement('li', { key: id }, id + ' — component implementation pending'))))",
        "      : createElement('p', null, 'No pages yet.')));",
        "}",
        "export async function mount(root: HTMLElement): Promise<() => void> {",
        "  const reactRoot = createRoot(root);",
        "  reactRoot.render(createElement(Starter));",
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
