import { validateStorybookOptions } from '../storybook-contract.mjs';
import { json, row, type Model } from './model.ts';
import type { Add } from './file-code.ts';
import { storybookStories } from './storybook-stories.ts';
import { storybookPreview } from './storybook-preview.ts';

/** Reviewed together: dev-only dependencies, never inserted into the framework's own manifest. */
const storybookVersions: Readonly<Record<string, string>> = Object.freeze({
  'storybook': '10.6.0', '@storybook/vue3-vite': '10.6.0', '@storybook/addon-docs': '10.6.0',
});
interface Package { scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
export function storybookPackage(m: Model, pkg: Package): void {
  if (!validateStorybookOptions(row(m.document.design).storybook).enabled) return;
  for (const [name, version] of Object.entries(storybookVersions)) {
    const existing = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
    if (existing !== undefined && existing !== version) throw new Error(`GENERATOR_INVALID: Storybook requires ${name}@${version}; the project declares ${existing}.`);
    if (pkg.dependencies?.[name]) throw new Error(`GENERATOR_INVALID: ${name} is development tooling; declare it through design.storybook, not a runtime component dependency.`);
  }
  pkg.devDependencies = Object.fromEntries(Object.entries({ ...pkg.devDependencies, ...storybookVersions }).sort(([a], [b]) => a < b ? -1 : 1));
  Object.assign(pkg.scripts, {
    storybook: 'storybook dev --host 127.0.0.1 --port 6006 --no-open --disable-telemetry',
    'build-storybook': 'storybook build --output-dir reports/storybook-static --disable-telemetry',
    'typecheck:storybook': 'node node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project tsconfig.storybook.json',
  });
}
/** Emission does not install dependencies, start servers, publish, or fake a resolved lockfile. */
export function storybookCode(m: Model, add: Add): void {
  const options = validateStorybookOptions(row(m.document.design).storybook);
  if (options.generateStories) {
    storybookStories(m, add);
    const preview = '.storybook/generated/project-preview.ts';
    add(preview, storybookPreview(m, preview), 'managed');
  }
  if (!options.enabled) return;
  add('.storybook/main.ts', `import type { StorybookConfig } from '@storybook/vue3-vite';
import { fileURLToPath } from 'node:url';
const config: StorybookConfig = {
  stories: ['./generated/**/*.stories.ts', '../stories/**/*.stories.@(ts|js|mjs)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/vue3-vite', options: { docgen: false } },
  core: { disableTelemetry: true, builder: { name: '@storybook/builder-vite', options: {
    viteConfigPath: fileURLToPath(new URL('./vite.config.mjs', import.meta.url)),
  } } },
};
export default config;
`);
  add('.storybook/vite.config.mjs', `// Deliberately bypass the native-plugin Vite entry and reuse only the scoped Vue/Nuxt UI pipeline.
import { sharedConfig } from '../scripts/bundling/vite-shared.mjs';
export default sharedConfig();
`);
  add('.storybook/preview.ts', `import type { Preview } from '@storybook/vue3-vite';
const preview: Preview = { parameters: { controls: { expanded: true } } };
export default preview;
`);
  add('tsconfig.storybook.json', json({ extends: './tsconfig.project.json',
    compilerOptions: { allowImportingTsExtensions: true }, include: ['.storybook/**/*.ts', 'stories/**/*.stories.ts'] }));
  add('.storybook/.gitignore', 'cache/\n');
  add('STORYBOOK.md', `# Optional Storybook workspace

Storybook tooling and generated stories are separate opt-ins in design.storybook.
The compiler only writes files. Run npm install explicitly to resolve the added exact
10.6.0 development dependencies and commit package-lock.json; use npm ci thereafter.
No server, publishing service, login, telemetry, native host or vault is started by generation.

- npm run storybook: local browser previews on 127.0.0.1:6006 (no browser auto-open).
- npm run typecheck:storybook: separate TypeScript 6 project for optional stories.
- npm run build-storybook: static output in reports/storybook-static; not part of plugin packaging.

With generateStories enabled, .storybook/generated contains managed CSF3 stories,
real generated Vue imports and a per-story isolated synthetic-data context. With only
tooling enabled, write stories under stories/ or separately enable generateStories.
An empty catalog is not a generated-story opt-in. Controls, source scenarios and
variants are design examples, not executable acceptance tests. Required props without
authored defaults and slot contents use labeled synthetic placeholders.

Authored scenarios retain their own state, data and responsive width. Source reads are
synthetic; write operations and unfinished external adapters remain implementation
stubs. Navigation/modal intents identify the target story instead of opening Obsidian.
User-supplied component implementations are trusted project code, not sandboxed code.

Rerun the reviewed project generation plan after changing the project JSON. Edited
managed stories cause a conflict rather than silent data loss. Put handcrafted stories
in stories/; .storybook config files are extension-owned. Disabling tooling stops
emission; it does not uninstall packages or delete consumer-owned config. Review and
remove these manually, then run npm install. Opting out of story generation stops future emission but retains existing stories
and their ownership records. Remove retired stories explicitly after review.
`);
}
