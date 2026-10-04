import { angularBabelVersion } from './angular-linker.ts';
import type { TemplateSnapshot } from '../../domain/contracts.ts';
import type { ProjectSelection } from '../../domain/project-starter.ts';
import { CompilerError, diagnostic } from '../../domain/diagnostics.ts';
import { json } from '../../emitters/model.ts';
import type { FrameworkAdapter } from './framework-adapter.ts';
type Pins = Record<string, string>;
interface TemplatePackage { dependencies?: Pins; devDependencies?: Pins }
const visualTarget = (selected: ProjectSelection) => selected.targets.some(target => target !== 'cli');
const browserTarget = (selected: ProjectSelection) => selected.targets.some(target => target === 'webapp' || target === 'website');
/** Copy exact template pins for the selected engine's direct dependencies. */
function enginePins(original: TemplatePackage, selected: ProjectSelection, engine: FrameworkAdapter['engine']) {
  const dependencies: Pins = {}, devDependencies: Pins = {};
  function copy(names: string[], group: Pins) {
    for (const name of names) {
      const pin = original.dependencies?.[name] ?? original.devDependencies?.[name];
      if (typeof pin !== 'string' || !/^\d+\.\d+\.\d+$/.test(pin)) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'Missing exact template pin for ' + name));
      group[name] = pin;
    }
  }
  copy(['typescript', '@types/node'], devDependencies);
  if (selected.targets.includes('plugin')) copy(['obsidian'], devDependencies);
  if (visualTarget(selected)) copy(['vite'], devDependencies);
  if (engine === 'nuxtui') {
    copy(['vue', 'pinia', '@nuxt/ui'], dependencies);
    copy(['@vitejs/plugin-vue', '@iconify-json/lucide', 'postcss', 'postcss-selector-parser', 'tailwindcss', 'vue-tsc'], devDependencies);
  }
  if (engine === 'angular') {
    for (const [name, pin] of Object.entries(selected.angularPins ?? {})) (name === '@angular/compiler-cli' ? devDependencies : dependencies)[name] = pin;
    devDependencies['@babel/core'] = angularBabelVersion;
  }
  return { dependencies, devDependencies };
}
/** Adapter pins may add to the engine's scope but never move or change a pin the engine owns. */
function mergeAdapterPins(source: Readonly<Pins> | undefined, target: Pins, other: Pins): void {
  for (const [name, pin] of Object.entries(source ?? {})) {
    if (other[name] !== undefined) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'Framework adapter changes dependency scope already owned by the selected engine: ' + name));
    if (target[name] !== undefined && target[name] !== pin) throw new CompilerError(diagnostic('COMPILER_TEMPLATE_INVALID', 'emit', 'Framework adapter dependency conflicts with the selected engine: ' + name));
    target[name] = pin;
  }
}
const typecheckCommands: Record<FrameworkAdapter['engine'], string> = {
  none: 'tsc --noEmit --project tsconfig.json', vanilla: 'tsc --noEmit --project tsconfig.json',
  nuxtui: 'vue-tsc --noEmit --project tsconfig.json', angular: 'ngc --noEmit --project configs/types/tsconfig.angular.json',
};
function packageScripts(selected: ProjectSelection, engine: FrameworkAdapter['engine']): Pins {
  const scripts: Pins = {
    build: 'node scripts/build.mjs',
    typecheck: typecheckCommands[engine],
    test: 'node --experimental-strip-types --test tests/*.test.mjs plugins/*/tests/*.test.ts',
  };
  if (browserTarget(selected)) scripts.start = 'npm run build && node scripts/serve.mjs';
  if (visualTarget(selected)) scripts['build:prototype'] = 'node scripts/build.mjs --prototype';
  if (selected.targets.includes('cli')) scripts['start:cli'] = 'node dist/cli/src/targets/cli/main.js';
  return scripts;
}
/** Minimal direct dependencies, all exact pins. A root-only lock honestly requires registry resolution. */
export function packageFiles(template: TemplateSnapshot, selected: ProjectSelection, id: string, adapter: FrameworkAdapter) {
  const original: TemplatePackage = JSON.parse(template.text('package.json'));
  const { dependencies, devDependencies } = enginePins(original, selected, adapter.engine);
  mergeAdapterPins(adapter.dependencies, dependencies, devDependencies);
  mergeAdapterPins(adapter.devDependencies, devDependencies, dependencies);
  const pkg = { name: id, version: '0.1.0', private: true, type: 'module', engines: { node: '>=24.21.0 <25', npm: '>=11.19.1 <12' },
    packageManager: 'npm@11.19.1', scripts: packageScripts(selected, adapter.engine), dependencies, devDependencies };
  return {
    'package.json': json(pkg),
    'package-lock.json': json({ name: id, version: '0.1.0', lockfileVersion: 3, requires: true,
      packages: { '': { name: id, version: '0.1.0', dependencies, devDependencies } } }),
    '.nvmrc': '24.21.0\n',
    '.gitignore': 'node_modules/\ndist/\n.compiled/\n.prototype-build/\n',
  };
}
export function typecheckFiles(selected: ProjectSelection, adapter: FrameworkAdapter) {
  const engine = adapter.engine;
  const files: Record<string, string> = {
    'tsconfig.json': json({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      noUncheckedIndexedAccess: true, noEmit: true, skipLibCheck: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      allowImportingTsExtensions: true, resolveJsonModule: true, types: ['node'] }, include: ['src/**/*.ts', 'src/**/*.vue', 'plugins/**/*.ts'] }),
    'src/environment.d.ts': 'declare module "*.css";\n',
  };
  // Derived compiler configs live in configs/types/; their paths are relative to that folder.
  if (engine === 'angular') files['configs/types/tsconfig.angular.json'] = json({ extends: '../../tsconfig.json',
    compilerOptions: { noEmit: false, rewriteRelativeImportExtensions: true, rootDir: '../..', outDir: '../../.compiled', experimentalDecorators: true },
    angularCompilerOptions: { compilationMode: 'full', strictTemplates: true, strictInjectionParameters: true }, include: ['../../src/**/*.ts', '../../plugins/registry.ts', '../../plugins/*/src/**/*.ts'] });
  if (selected.targets.includes('cli')) files['configs/types/tsconfig.cli.json'] = json({ extends: '../../tsconfig.json', compilerOptions: {
    noEmit: false, rewriteRelativeImportExtensions: true, rootDir: '../..', outDir: '../../dist/cli', module: 'NodeNext', moduleResolution: 'NodeNext' }, include: ['../../src/core/**/*.ts', '../../src/targets/cli/**/*.ts', '../../plugins/registry.ts', '../../plugins/*/src/**/*.ts'] });
  return files;
}
export function starterReadme(selected: ProjectSelection): string {
  return `# Project starter\n\nStarter: ${selected.starter.id} ${selected.starter.version}. Framework: ${selected.framework}. Targets: ${selected.targets.join(', ')}.\n\nThis is a prototype starting scaffold, not a completed product. Shared source is src/core; host entrypoints live under src/targets; UI belongs to src/ui. Full Companion data is preserved in design/project.json; Angular projects compile supported canonical visual bricks into AOT components and browser hash routes; design/angular-capabilities.json identifies required adapters. Other frameworks retain their page projection. No target implies complete business behavior. project.config.json stays outside the closed Companion v6 envelope.\n\n## Explicit dependency resolution\n\nUse Node 24.21.0 and npm 11.19.1. The generated package-lock.json has only the root manifest: it is NOT a resolved dependency graph. Review package.json, explicitly run npm install, inspect and commit the resolved lock, then use npm ci on clean extractions. Generation never installs or accesses the network.\n\nRun npm run typecheck, npm test and npm run build. Outputs are in dist/<target>. Browser targets provide npm start (build, then local preview on 127.0.0.1:4173; PORT overrides the port). Restart to rebuild after editing source; this is not a hot-reload server. ${selected.targets.includes('cli') ? 'Run npm run start:cli -- pages --json. CLI failures use exit code 2; JSON mode never prompts.' : ''}\n\n${selected.framework === 'none' ? 'The CLI transcript is the prototype. No HTML or frontend is fabricated.' : 'npm run build:prototype produces one offline dist/prototype.html, including the complete Companion JSON and bundled dependency notices. Existing output is refused; after review use npm run build:prototype -- --replace. The browser preview does not activate Obsidian.'}\n\nFor a plugin, manually review dist/plugin/main.js, styles.css and manifest.json before copying to a disposable test vault. No install/activation is authorized by generation. Nuxt UI uses the repository scoped CSS and version-hash guards, not global preflight or a Nuxt server. Angular uses AOT and a per-view zoneless application; no zone.js and no document-global bootstrap.\n\nThe website target is a static-hostable client-rendered site, not server rendering or guaranteed SEO. Hybrid means multiple build targets sharing local code/data; it does not imply cloud sync or a desktop wrapper.\n\n## Project plugins\n\nAll generated targets share a typed local extension contract under plugins/<plugin-name>/. Each plugin owns manifest.json, config.json, src/ and tests/, exports a named PluginObject, and is explicitly registered in plugins/registry.ts. Config can disable a plugin without deleting it. Registration is static so the same source bundles deterministically for Obsidian, browsers and terminal apps. npm test includes plugins/*/tests/*.test.ts. See plugins/README.md. Plugin code is trusted project code, not a sandbox.\n\n## Further authoring\n\nUse the originating shell CLI with --root pointing here and --project design/project.json. sketch generate detects project.config.json and preserves its target selection. Regenerate into a new output directory after source-owned changes: never overwrite edited source to conceal a conflict. Prototype business actions, tests and native/browser qualification remain explicit work.\n`;
}
