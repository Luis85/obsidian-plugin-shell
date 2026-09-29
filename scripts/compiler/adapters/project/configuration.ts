import type { TemplateSnapshot } from '../../domain/contracts.ts';
import type { ProjectCatalog, ProjectSelection } from '../../domain/project-presets.ts';
import { CompilerError, diagnostic } from '../../domain/diagnostics.ts';
import { json } from '../../../companion/compiler/model.ts';
/** Minimal direct dependencies, all exact pins. A root-only lock honestly requires registry resolution. */
export function packageFiles(template: TemplateSnapshot, catalog: ProjectCatalog, selected: ProjectSelection, id: string) {
  const original = JSON.parse(template.text('package.json'));
  const dependencies: Record<string, string> = {}, devDependencies: Record<string, string> = {};
  function copy(names: string[], group: Record<string, string>) {
    for (const name of names) {
      const pin = original.dependencies?.[name] ?? original.devDependencies?.[name];
      if (typeof pin !== 'string' || !/^\d+\.\d+\.\d+$/.test(pin)) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'Missing exact template pin for ' + name));
      group[name] = pin;
    }
  }
  copy(['typescript', '@types/node'], devDependencies);
  if (selected.targets.includes('plugin')) copy(['obsidian'], devDependencies);
  const visual = selected.targets.some(target => target !== 'cli');
  if (visual) copy(['vite'], devDependencies);
  if (selected.framework === 'nuxtui') {
    copy(['vue', 'pinia', '@nuxt/ui'], dependencies);
    copy(['@vitejs/plugin-vue', '@iconify-json/lucide', 'postcss', 'postcss-selector-parser', 'tailwindcss', 'vue-tsc'], devDependencies);
  }
  if (selected.framework === 'angular') for (const [name, pin] of Object.entries(catalog.angularPins)) (name === '@angular/compiler-cli' ? devDependencies : dependencies)[name] = pin;
  const scripts: Record<string, string> = {
    build: 'node scripts/build.mjs',
    typecheck: selected.framework === 'nuxtui' ? 'vue-tsc --noEmit --project tsconfig.json' : selected.framework === 'angular' ? 'ngc --noEmit --project tsconfig.angular.json' : 'tsc --noEmit --project tsconfig.json',
    test: 'node --experimental-strip-types --test tests/*.test.mjs',
  };
  if (visual) scripts['build:prototype'] = 'node scripts/build.mjs --prototype';
  if (selected.targets.includes('cli')) scripts['start:cli'] = 'node dist/cli/targets/cli/main.js';
  const pkg = { name: id, version: '0.1.0', private: true, type: 'module', engines: { node: '>=24.21.0 <25', npm: '>=11.19.1 <12' },
    packageManager: 'npm@11.19.1', scripts, dependencies, devDependencies };
  return {
    'package.json': json(pkg),
    'package-lock.json': json({ name: id, version: '0.1.0', lockfileVersion: 3, requires: true,
      packages: { '': { name: id, version: '0.1.0', dependencies, devDependencies } } }),
    '.nvmrc': '24.21.0\n',
    '.gitignore': 'node_modules/\ndist/\n.compiled/\n.prototype-build/\n',
  };
}
export function typecheckFiles(selected: ProjectSelection) {
  const files: Record<string, string> = {
    'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      noUncheckedIndexedAccess: true, noEmit: true, skipLibCheck: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      allowImportingTsExtensions: true, rewriteRelativeImportExtensions: true, types: ['node'] }, include: ['src/**/*.ts', 'src/**/*.vue'] }),
    'src/environment.d.ts': 'declare module "*.css";\n',
  };
  if (selected.framework === 'angular') files['tsconfig.angular.json'] = json({ extends: './tsconfig.json',
    compilerOptions: { noEmit: false, rootDir: '.', outDir: '.compiled', experimentalDecorators: true },
    angularCompilerOptions: { compilationMode: 'full', strictTemplates: true, strictInjectionParameters: true }, include: ['src/**/*.ts'] });
  if (selected.targets.includes('cli')) files['tsconfig.cli.json'] = json({ extends: './tsconfig.json', compilerOptions: {
    noEmit: false, rootDir: 'src', outDir: 'dist/cli', module: 'NodeNext', moduleResolution: 'NodeNext' }, include: ['src/core/**/*.ts', 'src/targets/cli/**/*.ts'] });
  return files;
}
export function starterReadme(selected: ProjectSelection): string {
  return `# Project starter\n\nPreset: ${selected.preset}. Framework: ${selected.framework}. Targets: ${selected.targets.join(', ')}.\n\nThis is a prototype starting scaffold, not a completed product. Shared source is src/core; host entrypoints live under src/targets; UI belongs to src/ui. Full Companion data is preserved in design/project.json; the starter projects a navigable page list, not every visual/business interaction. project.config.json stays outside the closed Companion v6 envelope.\n\n## Explicit dependency resolution\n\nUse Node 24.21.0 and npm 11.19.1. The generated package-lock.json has only the root manifest: it is NOT a resolved dependency graph. Review package.json, explicitly run npm install, inspect and commit the resolved lock, then use npm ci on clean extractions. Generation never installs or accesses the network.\n\nRun npm run typecheck, npm test and npm run build. Outputs are in dist/<target>. ${selected.targets.includes('cli') ? 'Run npm run start:cli -- pages --json. CLI failures use exit code 2; JSON mode never prompts.' : ''}\n\n${selected.framework === 'none' ? 'The CLI transcript is the prototype. No HTML or frontend is fabricated.' : 'npm run build:prototype produces one offline dist/prototype.html, including the complete Companion JSON and bundled dependency notices. Existing output is refused; after review use npm run build:prototype -- --replace. The browser preview does not activate Obsidian.'}\n\nFor a plugin, manually review dist/plugin/main.js, styles.css and manifest.json before copying to a disposable test vault. No install/activation is authorized by generation. Nuxt UI uses the repository scoped CSS and version-hash guards, not global preflight or a Nuxt server. Angular uses AOT and a per-view zoneless application; no zone.js and no document-global bootstrap.\n\nThe website target is a static-hostable client-rendered site, not server rendering or guaranteed SEO. Hybrid means multiple build targets sharing local code/data; it does not imply cloud sync or a desktop wrapper.\n\n## Further authoring\n\nUse the originating shell CLI with --root pointing here and --project design/project.json. sketch generate detects project.config.json and preserves its target selection. Regenerate into a new output directory after source-owned changes: never overwrite edited source to conceal a conflict. Prototype business actions, tests and native/browser qualification remain explicit work.\n`;
}
