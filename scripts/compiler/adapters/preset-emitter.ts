import { literal, json, text, type Model } from '../../companion/compiler/model.ts';
import { validateArtifacts } from '../domain/artifacts.ts';
import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
export interface PresetOutput { id: string; name: string; preset: string; frontend: string; framework: string; ui: string; targets: string[]; catalogVersion: number }
type Templates = Record<string, string>;
const entry = (path: string, content: string): Artifact => ({ path, content, ownership: 'managed', producer: 'project-preset' });
const html = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function pins(template: TemplateSnapshot, selected: PresetOutput): Record<string, unknown> {
  const root = JSON.parse(template.text('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const dependencies: Record<string, string> = {}, devDependencies: Record<string, string> = {};
  const copy = (name: string, runtime = false) => {
    const value = root.dependencies[name] ?? root.devDependencies[name];
    if (!value || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value)) throw new Error('PRESET_DEPENDENCY_PIN: ' + name);
    (runtime ? dependencies : devDependencies)[name] = value;
  };
  for (const name of ['typescript', '@types/node', 'vite']) copy(name);
  if (selected.targets.includes('plugin')) copy('obsidian');
  if (selected.frontend !== 'none') for (const name of ['postcss', 'postcss-selector-parser']) copy(name);
  if (selected.frontend === 'nuxt-ui') {
    for (const name of ['vue', '@nuxt/ui']) copy(name, true);
    for (const name of ['@vitejs/plugin-vue', 'vue-tsc', 'tailwindcss', '@iconify-json/lucide']) copy(name);
  }
  if (selected.frontend === 'angular') {
    for (const name of ['core', 'common', 'compiler', 'platform-browser']) dependencies['@angular/' + name] = '22.0.0';
    dependencies.rxjs = '7.8.2'; dependencies.tslib = '2.8.1'; devDependencies['@angular/compiler-cli'] = '22.0.0';
  }
  const checker = selected.frontend === 'nuxt-ui' ? 'node node_modules/vue-tsc/bin/vue-tsc.js' : selected.frontend === 'angular'
    ? 'node node_modules/@angular/compiler-cli/bundles/src/bin/ngc.js' : 'node node_modules/typescript/bin/tsc';
  return { name: selected.id, version: '0.1.0', private: true, type: 'module', engines: { node: '>=24.21.0 <25' }, packageManager: 'npm@11.19.1',
    ...(selected.targets.includes('cli') ? { bin: { [selected.id]: 'dist/cli/main.mjs' } } : {}),
    scripts: { typecheck: `${checker} --noEmit -p tsconfig.json`, test: 'node --test tests/core.test.mjs', build: 'node scripts/build.mjs',
      ...Object.fromEntries(selected.targets.map(target => ['build:' + target, 'node scripts/build.mjs ' + target])) }, dependencies, devDependencies };
}
function configuration(selected: PresetOutput, template: TemplateSnapshot): string {
  const source = JSON.parse(template.text('tsconfig.json')) as { compilerOptions: { skipLibCheck?: boolean } };
  // Retain the template's vendor declaration boundary, not a weaker source check.
  const vendorDeclarations = selected.frontend === 'nuxt-ui' || selected.targets.includes('plugin');
  return json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', lib: selected.frontend === 'none' ? ['ES2022'] : ['ES2022', 'DOM', 'DOM.Iterable'],
    types: ['node'], strict: true, noUncheckedIndexedAccess: true, skipLibCheck: vendorDeclarations && source.compilerOptions.skipLibCheck === true,
    ...(selected.frontend === 'angular' ? { rewriteRelativeImportExtensions: true } : { allowImportingTsExtensions: true, noEmit: true }),
    ...(selected.frontend === 'nuxt-ui' ? { paths: { '#build/*': ['./node_modules/.nuxt-ui/*'] } } : {}),
    resolveJsonModule: true, isolatedModules: true, esModuleInterop: true,
    experimentalDecorators: selected.frontend === 'angular', rootDir: '.', outDir: '.angular' },
    ...(selected.frontend === 'angular' ? { angularCompilerOptions: { strictTemplates: true, strictInjectionParameters: true, compilationMode: 'full' } } : {}),
    include: ['src/**/*.ts', ...(selected.frontend === 'nuxt-ui' ? ['src/**/*.vue'] : [])] });
}
function pageHtml(model: Model, selected: PresetOutput, index: number, enhanced: boolean): string {
  const page = model.screens[index]!, prefix = index === 0 ? './' : '../../';
  const nav = model.screens.map((screen, i) => `<a href="${prefix}${i === 0 ? 'index.html' : 'pages/' + html(screen.slug) + '/index.html'}"${i === index ? ' aria-current="page"' : ''}>${html(screen.label)}</a>`).join('\n');
  const content = `<nav aria-label="Site pages">${nav}</nav><main><h1>${html(page.label)}</h1><p>Prototype scaffold — implement the agreed content.</p></main>`;
  return `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(page.label)} — ${html(selected.name)}</title><link rel="stylesheet" href="${prefix}../../styles/app.css"><link rel="stylesheet" href="${prefix}../../styles/browser.css"></head>\n<body><section class="${selected.id} ps--${selected.id} project-root" data-plugin-ui="${selected.id}">${content}${enhanced ? `<div id="app"></div><script type="module" src="${prefix}main.ts"></script>` : ''}</section></body></html>\n`;
}
function targetFiles(model: Model, selected: PresetOutput, templates: Templates): Artifact[] {
  const files: Artifact[] = [];
  for (const target of selected.targets) {
    const base = 'src/targets/' + target;
    if (target === 'website') {
      model.screens.forEach((screen, index) => files.push(entry(`${base}/${index ? 'pages/' + screen.slug + '/index.html' : 'index.html'}`, pageHtml(model, selected, index, selected.frontend !== 'vanilla'))));
      if (selected.frontend !== 'vanilla') files.push(entry(base + '/main.ts', templates['website.ts']!));
    } else {
      files.push(entry(base + '/main.ts', templates[target === 'plugin' ? 'plugin.ts' : target === 'cli' ? 'cli.ts' : 'browser.ts']!));
      if (target === 'webapp') files.push(entry(base + '/index.html', `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(selected.name)}</title></head><body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>\n`));
    }
  }
  return files;
}
function uiFiles(selected: PresetOutput, template: TemplateSnapshot, templates: Templates): Artifact[] {
  if (selected.frontend === 'none') return [];
  const files = [entry('src/presentation/mount.ts', templates[selected.frontend === 'nuxt-ui' ? 'vue.ts' : selected.frontend + '.ts']!),
    entry('src/styles/project.css', templates['styles.css']!.replaceAll('__PROJECT_ID__', selected.id)),
    entry('src/presentation/theme.ts', templates['theme.ts']!)];
  for (const path of ['scripts/bundling/css-ownership.mjs', 'scripts/bundling/css-identity.mjs']) files.push(entry(path, template.text(path)));
  if (selected.targets.some(target => target === 'webapp' || target === 'website')) files.push(entry('src/styles/browser.css', templates['browser.css']!.replaceAll('__PROJECT_ID__', selected.id)));
  let styles = '@import "./project.css";\n';
  if (selected.frontend === 'nuxt-ui') {
    files.push(entry('src/presentation/App.vue', templates['App.vue']!), entry('src/presentation/use-project.ts', templates['use-project.ts']!));
    if (selected.targets.includes('website')) files.push(entry('src/presentation/Website.vue', templates['Website.vue']!), entry('src/presentation/use-demonstration.ts', templates['use-demonstration.ts']!));
    for (const path of ['scripts/bundling/vite-shared.mjs', 'scripts/bundling/journey-flow.mjs',
      'scripts/bundling/ui-adaptation.json', 'src/infrastructure/ui/static-plugin.ts', 'src/styles/tokens.css', 'src/styles/nuxt-bridge.css']) {
      const content = template.text(path).replace("resolve(root, 'manifest.json')", "resolve(root, 'shell.project.json')");
      files.push(entry(path, path.endsWith('.css') ? content.replaceAll('plugin-shell', selected.id) : content));
    }
    styles = '@import "tailwindcss/theme.css" prefix(ps);\n@import "tailwindcss/utilities.css" prefix(ps) source(none);\n@import "@nuxt/ui";\n@import "./tokens.css";\n@import "./nuxt-bridge.css";\n' + styles + '@source "../presentation";\n@source "../../node_modules/.nuxt-ui";\n';
  }
  if (selected.frontend === 'angular') files.push(entry('src/presentation/project.component.ts', templates['project.component.ts']!));
  files.push(entry('src/styles/app.css', styles), entry('src/env.d.ts', '/// <reference types="vite/client" />\n'));
  return files;
}
/** Target-specific emission consumes the existing compiler's validated model and immutable template. */
export function emitPresetProject(model: Model, template: TemplateSnapshot, selected: PresetOutput): Artifact[] {
  const templates = JSON.parse(template.text('scripts/compiler/presets/templates.json')) as Templates;
  const pages = model.screens.filter(page => !['group', 'action', 'modal'].includes(page.kind));
  if (!pages.length) throw new Error('PRESET_EMPTY');
  const websiteEntries = pages.map((page, index) => index ? `pages/${page.slug}/index.html` : 'index.html');
  const scopedModel = { ...model, screens: pages };
  const seed = { id: selected.id, name: selected.name, pages: pages.map(page => ({ id: page.id, slug: page.slug, label: page.label,
    components: page.components.map(id => text(model.components.find(item => item.id === id)?.name)) })) };
  const files = [entry('package.json', json(pins(template, selected))), entry('tsconfig.json', configuration(selected, template)),
    entry('.nvmrc', template.text('.nvmrc')), entry('.gitignore', 'node_modules/\ndist/\n.angular/\n.build-stage-*/\n.build-backup-*/\n.project-build-lock/\n'), entry('LICENSE', template.text('LICENSE')),
    entry('shell.project.json', json({ schemaVersion: 1, ...selected, websiteEntries })), entry('design/project.json', json(model.document)),
    entry('src/core/project.ts', templates['core.ts']!), entry('src/core/project-data.json', literal(seed) + '\n'),
    entry('tests/core.test.mjs', templates['core.test.mjs']!), entry('scripts/build.mjs', templates['build.mjs']!), entry('scripts/build-worker.mjs', templates['build-worker.mjs']!),
    ...uiFiles(selected, template, templates), ...targetFiles(scopedModel, selected, templates)];
  if (selected.targets.includes('plugin')) {
    const manifest = JSON.parse(template.text('manifest.json')) as Record<string, unknown>;
    files.push(entry('manifest.json', json({ ...manifest, id: selected.id, name: selected.name, version: '0.1.0', description: 'Generated prototype scaffold.', author: 'Your name' })));
  }
  files.push(entry('README.md', `# ${selected.name}\n\nPreset: ${selected.preset}; frontend: ${selected.frontend}; runtimes: ${selected.targets.join(', ')}.\n\nThis is prototype boilerplate, not a completed product. Direct dependency versions are pinned; transitive resolution and qualification remain pending. After explicitly authorizing installation, run npm install and retain/review package-lock.json. Later clean installs use npm ci. Use the Node version in .nvmrc and npm 11.19.1.\n\nPlugin and Nuxt UI consumers inherit the template's vendor-declaration skipLibCheck policy; generated source remains strict with indexed-access checking. This is not independent validation of vendor declarations.\n\nRun npm run typecheck, npm test, then npm run build (or build:<target>). Built browser targets are under dist/webapp or dist/website; serve those directories with a local static server. Plugin artifacts are dist/plugin/main.js, styles.css and manifest.json; activation in a disposable vault requires separate permission. CLI: node dist/cli/main.mjs help --json; list, show <id>, and <id> expose the generated commands. Unknown commands exit 1; interactive cancellation exits 130. No frontend dependencies are included for CLI-only projects.\n\nAngular uses standalone zoneless components and ngc AOT before bundling. Nuxt UI uses Vue/Vite, scoped CSS, local icons and the existing hash-guarded host-style adaptations, not a Nuxt server. Website pages are statically addressable before optional enhancement. Hybrid targets import one src/core; this does not create cross-process persistence or synchronization.\n\nDesign JSON remains in design/project.json. The preset sidecar is shell.project.json. Preserve stable IDs; source-owned behavior cannot automatically round-trip. Use the framework CLI with --root pointing here to edit design JSON. The bundled skill's project-preset profile governs prototype implementation; legacy fixed-Vue build helpers do not build these runtimes.\n`));
  files.push(entry('AGENTS.md', `# Project prototype instructions\n\nRead shell.project.json and ../design-brief.md. Honor the selected project-preset profile; do not impose the legacy fixed-Vue clickdummy stack. src/core is host- and framework-free. src/presentation owns framework behavior. src/targets owns runtime lifecycle and IO. Shared source does not imply shared storage.\n\nUse repository-local pinned TypeScript 6.0.3 and the exact .nvmrc/npm versions. No global tooling substitution. Run typecheck, tests and each selected build; record not-run limitations honestly. No install hook runs setup. Keep source under 400 code lines and tests under 450, excluding comments and blank lines. Do not weaken checks or relabel placeholder actions as acceptance. No personal-vault activation or publication without explicit permission.\n`));
  files.push(...template.skillFiles.map(file => ({ ...file, ownership: 'framework' as const })));
  validateArtifacts(files);
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
