import { angularBrickFiles } from './angular-bricks.ts';
import { serveSource } from './serve-source.ts';
import { angularLinkerSource } from './angular-linker.ts';
import { json, type Model } from '../../../companion/compiler/model.ts';
import type { Artifact, TemplateSnapshot } from '../../domain/contracts.ts';
import { validateProjectSelection, type ProjectSelection } from '../../domain/project-starter.ts';
import { coreSource, browserSource, pluginSource, cliSource, cliEntry, vanillaMount, vueMount, vueComponent, angularMount } from './sources.ts';
import { buildSource, licenseSource } from './build-source.ts';
import { packageFiles, typecheckFiles, starterReadme } from './configuration.ts';
import { pluginExtensionFiles } from './plugin-extension.ts';
import { requireFrameworkAdapter } from './framework-registry.ts';
function styles(id: string): string {
  const root = `[data-plugin-ui="${id}"]`;
  return `${root} { display: block; padding: 1rem; color: var(--text-normal, #20242a); background: var(--background-primary, #fff); font: 1rem/1.5 var(--font-interface, system-ui); }
${root} .wb-slot { display: contents; }
${root} [hidden] { display: none !important; }
${root} nav { display: flex; flex-wrap: wrap; gap: .5rem; margin-block: 1rem; }
${root} button { cursor: pointer; font: inherit; padding: .4rem .8rem; color: inherit; border: 1px solid var(--background-modifier-border, #aab1bc); border-radius: .4rem; }
${root} button[aria-current="page"] { font-weight: bold; text-decoration: underline; }
${root} :focus-visible { outline: 2px solid var(--interactive-accent, #3858bd); outline-offset: 3px; }
${root} [role="status"] { border-inline-start: .2rem solid var(--interactive-accent, #3858bd); padding-inline-start: .75rem; }
${root}.browser-project { --background-primary: #fff; --background-primary-alt: #f5f6f8; --background-secondary: #f1f2f4; --text-normal: #20242a; --text-muted: #535d6a; --interactive-accent: #3858bd; --text-on-accent: #fff; --background-modifier-border: #aab1bc; --font-interface: system-ui; }
@media (prefers-color-scheme: dark) { ${root}.browser-project { --background-primary: #191d24; --background-primary-alt: #232934; --background-secondary: #232934; --text-normal: #edf0f5; --text-muted: #b8c1cf; --interactive-accent: #a5bbff; --text-on-accent: #191d24; --background-modifier-border: #7c8797; } }
`;
}
function vueFiles(template: TemplateSnapshot): Record<string, string> {
  const copied = ['scripts/bundling/vite-shared.mjs', 'scripts/bundling/local-icons.mjs', 'scripts/bundling/journey-flow.mjs', 'scripts/bundling/css-ownership.mjs', 'scripts/bundling/css-identity.mjs',
    'scripts/bundling/ui-adaptation.json', 'src/infrastructure/ui/static-plugin.ts', 'src/styles/tokens.css', 'src/styles/nuxt-bridge.css', 'docs/licenses/lucide.txt'];
  return { ...Object.fromEntries(copied.map(path => [path, template.text(path)])), 'src/ui/mount.ts': vueMount, 'src/ui/Starter.vue': vueComponent,
    'src/ui/nuxt.css': '@import "tailwindcss/theme.css" prefix(ps);\n@import "tailwindcss/utilities.css" prefix(ps) source(none);\n@import "@nuxt/ui";\n@import "../styles/tokens.css";\n@import "../styles/nuxt-bridge.css";\n@source ".";\n@source "../../node_modules/.nuxt-ui";\n' };
}
function tests(cli: boolean): string {
  return `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { project, findPage } from '../src/core/project.ts';
import { activatePlugins } from '../src/core/plugin-runtime.ts';
test('shared project contains unique stable pages and deterministic lookup', () => {
  assert.ok(project.id); assert.ok(project.pages.length);
  assert.equal(new Set(project.pages.map(page => page.id)).size, project.pages.length);
  for (const page of project.pages) assert.equal(findPage(page.id), page);
  assert.equal(findPage('missing'), undefined);
});
test('registered project plugins activate and dispose deterministically', () => {
  const close = activatePlugins('terminal-app');
  assert.equal(typeof close, 'function');
  close(); close();
});
${cli ? `import { run } from '../src/targets/cli/commands.ts';
test('CLI has headless JSON parity and rejects unsupported commands', () => {
  assert.equal(run(['pages', '--json']).exitCode, 0);
  assert.deepEqual(run(['pages', '--json']).value, run(['pages']).value);
  assert.equal(run(['delete-everything']).exitCode, 2);
  assert.equal(run(['pages', '--json', '--json']).exitCode, 2);
  assert.equal(run(['help']).exitCode, 0);
});\n` : ''}`;
}
/** Pure target adapter downstream of the shared parser, migration, model and reference validation. */
export function renderStarterProject(model: Model, template: TemplateSnapshot, input: ProjectSelection): Artifact[] {
  const selected = validateProjectSelection(input);
  const adapter = requireFrameworkAdapter(selected.framework), engine = adapter.engine;
  if (adapter.id !== adapter.engine && !['vanilla', 'none'].includes(engine)) throw new Error('FRAMEWORK_ADAPTER_ENGINE_UNSUPPORTED:' + adapter.id);
  const id = String(model.project.id), name = String(model.project.name);
  const visual = selected.targets.some(target => target !== 'cli');
  const files: Record<string, string> = {
    ...packageFiles(template, selected, id), ...typecheckFiles(selected),
    'project.config.json': json(selected), 'design/project.json': json(model.document),
    'src/core/project.ts': coreSource(model), ...pluginExtensionFiles(), 'scripts/build.mjs': buildSource,
    'manifest.json': json({ id, name, version: String(model.project.version ?? '0.1.0'), minAppVersion: '1.13.0', description: String(model.project.description ?? 'Project prototype'), author: String(model.project.author ?? 'Your name'), isDesktopOnly: false }),
    'README.md': starterReadme(selected), 'tests/scaffold.test.mjs': tests(selected.targets.includes('cli')),
    'AGENTS.md': '# Generated project source\n\nRead project.config.json and the agreed parent design-brief.md. Keep src/core independent of Obsidian, DOM, process and frameworks. Each host owns its entrypoint and lifecycle. Project extensions live under plugins/<name>, export PluginObject, own manifest.json/config.json/source/tests, and register explicitly in plugins/registry.ts. Keep the Companion v6 envelope intact. This is a starting scaffold; acceptance is not inferred from compilation. Do not install, activate, publish or modify external data without authorization. Use the exact .nvmrc/packageManager. Run typecheck, tests, build and target-specific runtime acceptance before claiming completion. Keep source under 400 and tests under 450 code lines, excluding blanks/comments.\n',
    'prototype.acceptance.json': json({ stage: 'not-implemented', targets: selected.targets.map(target => ({ target, build: 'not-run', runtime: 'not-run', businessAcceptance: 'not-run' })),
      remaining: ['Implement agreed domain actions and visual components.', 'Test enabled/disabled project-plugin activation and cleanup in each selected host.', 'Test actual keyboard/focus, empty, failure and cancel journeys.', 'Measure built artifact and source hashes.', 'Qualify a disposable Obsidian host for plugin targets; do not infer from the browser preview.'] }),
  };
  if (selected.targets.some(target => target === 'webapp' || target === 'website')) files['scripts/serve.mjs'] = serveSource;
  if (visual) {
    files['scripts/licenses.mjs'] = licenseSource;
    files['src/targets/preview/main.ts'] = browserSource(selected, id, 'preview');
    files['src/ui/styles.css'] = styles(id);
    if (engine === 'vanilla') files['src/ui/mount.ts'] = vanillaMount;
    if (engine === 'angular') { files['scripts/angular-linker.mjs'] = angularLinkerSource; files['src/ui/mount.ts'] = angularMount; Object.assign(files, angularBrickFiles(model)); }
    if (engine === 'nuxtui') {
      Object.assign(files, vueFiles(template)); files['src/ui/styles.css'] = '@import "./nuxt.css";\n' + styles(id);
    }
    const contributed = adapter.files?.({ model, template, selection: selected, projectId: id, projectName: name }) ?? {};
    for (const [path, content] of Object.entries(contributed)) {
      if (!/^src\/ui\/[a-zA-Z0-9_.\/-]+$/.test(path) || path.includes('..') || typeof content !== 'string') throw new Error('FRAMEWORK_ADAPTER_FILE_INVALID:' + adapter.id);
      files[path] = content;
    }
  }
  for (const target of selected.targets) {
    if (target === 'plugin') files['src/targets/plugin/main.ts'] = pluginSource(id, name);
    else if (target === 'cli') { files['src/targets/cli/commands.ts'] = cliSource(); files['src/targets/cli/main.ts'] = '#!/usr/bin/env node\n' + cliEntry; }
    else files[`src/targets/${target}/main.ts`] = browserSource(selected, id, target);
  }
  const artifacts: Artifact[] = Object.entries(files).map(([path, content]) => ({ path, content, ownership: 'managed', producer: 'project-starter',
    ...(path === 'src/core/project.ts' ? { origins: model.screens.map(page => ({ file: 'companion.project.json', entityId: page.id,
      jsonPointer: '/design/nodes', document: 'normalized' as const })) } : {}) }));
  return [...artifacts, ...template.skillFiles];
}
