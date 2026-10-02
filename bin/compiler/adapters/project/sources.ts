import { literal, type Model } from '../../../../scripts/companion/compiler/model.ts';
import type { ProjectSelection } from '../../domain/project-starter.ts';
/** All user-authored content is data, never interpolated into identifiers or markup. */
export function coreSource(model: Model): string {
  const pages = model.screens.filter(page => !['group', 'action'].includes(page.kind)).map(page => ({
    id: page.id, title: page.label, goal: page.goal, components: page.components,
  }));
  return `export interface Page { id: string; title: string; goal: string; components: readonly string[] }
export const project = ${literal({ id: model.project.id, title: model.project.name, pages })} as const;
export function findPage(id: string): Page | undefined { return project.pages.find(page => page.id === id); }
export const scaffoldNotice = 'Starting scaffold: navigation works; domain actions and acceptance remain to be implemented.';
`;
}
export function browserSource(selection: ProjectSelection, id: string, host: 'webapp' | 'website' | 'preview'): string {
  return `import { mount } from '../../ui/mount.ts';
import '../../ui/styles.css';
const candidate = document.querySelector<HTMLElement>('[data-project-root]');
if (!candidate) throw new Error('PROJECT_ROOT_MISSING');
const root: HTMLElement = candidate;
root.dataset.appHost = ${literal(host)};
root.dataset.pluginUi = ${literal(id)};
root.classList.add(${literal(id)}, ${literal('ps--' + id)});
let stopped = false;
let release: (() => void) | undefined;
const stop = () => { stopped = true; const cleanup = release; release = undefined; delete document.documentElement.dataset.prototypeReady; cleanup?.(); };
window.addEventListener('pagehide', stop, { once: true });
async function start(): Promise<void> {
try {
  const cleanup = await mount(root);
  if (stopped) cleanup();
  else { release = cleanup; document.documentElement.dataset.prototypeReady = 'true'; }
} catch (error) {
  window.removeEventListener('pagehide', stop);
  if (!stopped) { document.documentElement.dataset.prototypeReady = 'failed'; root.textContent = 'Unable to open the ${selection.framework} scaffold. See the developer console; reload to retry.'; }
  console.error(error);
}
}
void start();
`;
}
export function pluginSource(id: string, name: string): string {
  return `import { Plugin, ItemView, Notice, type WorkspaceLeaf } from 'obsidian';
import { mount } from '../../ui/mount.ts';
import '../../ui/styles.css';
const viewType = ${literal(id + '-view')};
class ProjectView extends ItemView {
  private release: (() => void) | undefined;
  private generation = 0;
  private closeSurface(): void { const cleanup = this.release; this.release = undefined; cleanup?.(); }
  getViewType(): string { return viewType; }
  getDisplayText(): string { return ${literal(name)}; }
  async onOpen(): Promise<void> {
    const generation = ++this.generation;
    this.closeSurface();
    const surface = this.contentEl.createDiv();
    surface.dataset.appHost = 'obsidian-plugin';
    surface.dataset.pluginUi = ${literal(id)};
    surface.classList.add(${literal(id)}, ${literal('ps--' + id)});
    try {
      const cleanup = await mount(surface);
      if (generation !== this.generation) { cleanup(); surface.remove(); }
      else this.release = () => { try { cleanup(); } finally { surface.remove(); } };
    } catch (error) {
      surface.remove();
      if (generation === this.generation) new Notice('Unable to open this project view. Close and reopen to retry.');
      throw error;
    }
  }
  async onClose(): Promise<void> { this.generation++; this.closeSurface(); }
}
export default class ProjectPlugin extends Plugin {
  onload(): void {
    this.registerView(viewType, (leaf: WorkspaceLeaf) => new ProjectView(leaf));
    this.addCommand({ id: 'open-project', name: 'Open project', callback: async () => {
      const leaf = this.app.workspace.getLeavesOfType(viewType)[0] ?? this.app.workspace.getLeaf('tab');
      await leaf.setViewState({ type: viewType, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } });
  }
  onunload(): void { this.app.workspace.detachLeavesOfType(viewType); }
}
`;
}
export function cliSource(): string {
  return `#!/usr/bin/env node
import { project, findPage, scaffoldNotice } from '../../core/project.ts';
export function run(args: readonly string[]): { exitCode: number; value: unknown; text: string } {
  const tokens = args.filter(arg => arg !== '--json');
  const command = tokens[0] ?? 'help';
  if (args.filter(arg => arg === '--json').length > 1) return invalid('Duplicate --json option.');
  if (['help', '--help'].includes(command) && tokens.length === 1 || !tokens.length) {
    return { exitCode: 0, value: { protocolVersion: 1, commands: ['pages', 'show <page-id>', 'help'], stage: 'scaffold' }, text: 'Usage: pages | show <page-id> | help [--json]\\n' + scaffoldNotice };
  }
  if (command === 'pages' && tokens.length === 1) return { exitCode: 0,
    value: { protocolVersion: 1, status: 'ok', pages: project.pages }, text: project.pages.map(page => page.id + ': ' + page.title).join('\\n') };
  if (command === 'show' && tokens.length === 2) {
    const page = findPage(tokens[1]!);
    if (page) return { exitCode: 0, value: { protocolVersion: 1, status: 'ok', page }, text: page.title + '\\n' + page.goal + '\\n' + scaffoldNotice };
  }
  return invalid('Unknown command, page ID or unexpected arguments. Use help.');
}
function invalid(message: string) { return { exitCode: 2, value: { protocolVersion: 1, status: 'failed', error: { code: 'INVALID_ARGUMENT', message } }, text: message }; }
`;
}
export const cliEntry = `import { run } from './commands.ts';
import { activatePlugins } from '../../core/plugin-runtime.ts';
const deactivate = activatePlugins('terminal-app');
try {
  const result = run(process.argv.slice(2));
  const machine = process.argv.includes('--json');
  const stream = machine || result.exitCode === 0 ? process.stdout : process.stderr;
  stream.write((machine ? JSON.stringify(result.value) : result.text) + '\\n');
  process.exitCode = result.exitCode;
} finally {
  deactivate();
}
`;
export const vanillaMount = `import { project, scaffoldNotice, type Page } from '../core/project.ts';
import { activatePlugins, visualHost } from '../core/plugin-runtime.ts';
export async function mount(root: HTMLElement): Promise<() => void> {
  const doc = root.ownerDocument;
  const heading = doc.createElement('h1'); heading.textContent = project.title;
  const note = doc.createElement('p'); note.textContent = scaffoldNotice; note.setAttribute('role', 'status');
  const nav = doc.createElement('nav'); nav.setAttribute('aria-label', 'Project pages');
  const main = doc.createElement('main'); main.tabIndex = -1;
  const listeners: (() => void)[] = [];
  function show(page: Page, focus = true) {
    const title = doc.createElement('h2'); title.textContent = page.title;
    const goal = doc.createElement('p'); goal.textContent = page.goal || 'Describe the purpose of this page during prototyping.';
    const components = doc.createElement('ul');
    for (const id of page.components) { const row = doc.createElement('li'); row.textContent = id + ' — component implementation pending'; components.append(row); }
    main.replaceChildren(title, goal, components);
    for (const button of nav.querySelectorAll('button')) button.setAttribute('aria-current', button.dataset.pageId === page.id ? 'page' : 'false');
    if (focus) main.focus();
  }
  for (const page of project.pages) {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = page.title; button.dataset.pageId = page.id;
    const click = () => show(page); button.addEventListener('click', click); listeners.push(() => button.removeEventListener('click', click)); nav.append(button);
  }
  root.replaceChildren(heading, note, nav, main);
  if (project.pages[0]) show(project.pages[0], false); else main.textContent = 'No pages yet.';
  let deactivate: () => void;
  try { deactivate = activatePlugins(visualHost(root), root); }
  catch (error) { for (const remove of listeners) remove(); root.replaceChildren(); throw error; }
  let closed = false;
  return () => { if (closed) return; closed = true; try { deactivate(); } finally { for (const remove of listeners) remove(); root.replaceChildren(); } };
}
`;
export const vueMount = `import { createApp } from 'vue';
import { createPinia, disposePinia } from 'pinia';
import ui from '@nuxt/ui/vue-plugin';
import Starter from './Starter.vue';
import { activatePlugins, visualHost } from '../core/plugin-runtime.ts';
export async function mount(root: HTMLElement): Promise<() => void> {
  const pinia = createPinia(); const app = createApp(Starter); let closed = false; let deactivate = () => {};
  const cleanup = () => { if (closed) return; closed = true; try { deactivate(); } finally { try { app.unmount(); } finally { disposePinia(pinia); } } };
  try { app.use(pinia); app.use(ui); app.mount(root); deactivate = activatePlugins(visualHost(root), root); return cleanup; }
  catch (error) { cleanup(); throw error; }
}
`;
export const vueComponent = `<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import UButton from '@nuxt/ui/components/Button.vue';
import { project, scaffoldNotice, type Page } from '../core/project.ts';
const current = ref<string>(project.pages[0]?.id ?? '');
const page = computed<Page | undefined>(() => project.pages.find(item => item.id === current.value));
const main = ref<HTMLElement>();
async function select(id: string) { current.value = id; await nextTick(); main.value?.focus(); }
</script>
<template>
  <div>
    <h1>{{ project.title }}</h1><p role="status">{{ scaffoldNotice }}</p>
    <nav aria-label="Project pages"><UButton v-for="item in project.pages" :key="item.id" :aria-current="item.id === current ? 'page' : undefined" @click="select(item.id)">{{ item.title }}</UButton></nav>
    <main ref="main" tabindex="-1"><template v-if="page"><h2>{{ page.title }}</h2><p>{{ page.goal || 'Describe this page during prototyping.' }}</p><ul><li v-for="id in page.components" :key="id">{{ id }} — component implementation pending</li></ul></template><p v-else>No pages yet.</p></main>
  </div>
</template>
`;
export const angularMount = `import { createApplication } from '@angular/platform-browser';
import { createComponent } from '@angular/core';
import { Starter } from './Starter.ts';
import { activatePlugins, visualHost } from '../core/plugin-runtime.ts';
export async function mount(root: HTMLElement): Promise<() => void> {
  const app = await createApplication();
  let release: (() => void) | undefined; let deactivate = () => {};
  try {
    const component = createComponent(Starter, { hostElement: root, environmentInjector: app.injector });
    release = () => { app.detachView(component.hostView); component.destroy(); };
    app.attachView(component.hostView); component.changeDetectorRef.detectChanges();
    deactivate = activatePlugins(visualHost(root), root);
    let closed = false;
    return () => { if (closed) return; closed = true; try { deactivate(); } finally { try { release?.(); } finally { app.destroy(); } } };
  } catch (error) { try { deactivate(); } finally { try { release?.(); } finally { app.destroy(); } } throw error; }
}
`;
