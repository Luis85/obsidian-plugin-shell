import type { Artifact, TemplateSnapshot } from '../domain/contracts.ts';
import { json, requireValue } from './model.ts';
export const storybookVersion = '10.6.0';
/** Isolated optional dependencies: the normal project's package.json and lockfile are never changed. */
export function storybookWorkspace(template: TemplateSnapshot, paths: string[]): Artifact[] {
  const pkg = JSON.parse(template.text('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  const pinned = { ...pkg.dependencies, ...pkg.devDependencies };
  const shared = ['vue', 'vite', '@vitejs/plugin-vue', '@types/node', 'typescript', 'vue-tsc'];
  for (const name of shared) requireValue(typeof pinned[name] === 'string', 'Storybook workspace requires the framework pin for ' + name);
  const dependencies = { storybook: storybookVersion, '@storybook/vue3-vite': storybookVersion, '@storybook/addon-docs': storybookVersion, '@storybook/builder-vite': storybookVersion,
    ...Object.fromEntries(shared.map(name => [name, pinned[name]])) };
  const add = (path: string, content: string, ownership: Artifact['ownership'] = 'managed'): Artifact => ({ path: 'storybook/' + path, content, ownership, producer: 'storybook' });
  return [
    add('package.json', json({ name: 'generated-storybook-workspace', private: true, type: 'module',
      description: 'Opt-in development workspace; not part of the Obsidian plugin bundle.',
      scripts: { storybook: 'node ../bin/app storybook dev --root ..', 'build-storybook': 'node ../bin/app storybook build --root ..',
        typecheck: 'node ../bin/app storybook check --root ..' }, devDependencies: dependencies })),
    add('.gitignore', 'node_modules/\nstorybook-static/\n*.log\n'),
    add('tsconfig.json', json({ extends: '../tsconfig.json', compilerOptions: { allowImportingTsExtensions: true },
      files: paths.map(path => path.slice('storybook/'.length)), include: ['custom/**/*.ts', '.storybook/**/*.ts'] })),
    add('.storybook/generated.json', json(paths.map(path => '../' + path.slice('storybook/'.length)))),
    add('.storybook/main.ts', `import type { StorybookConfig } from '@storybook/vue3-vite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const packageRoot = (name: string): string => dirname(require.resolve(name + '/package.json'));
const project = JSON.parse(readFileSync(new URL('../../design/project.json', import.meta.url), 'utf8'));
if (project.tooling?.storybook?.enabled !== true) throw new Error('STORYBOOK_DISABLED: enable tooling.storybook.enabled and regenerate first.');
const generated: string[] = JSON.parse(readFileSync(new URL('./generated.json', import.meta.url), 'utf8'));
const config: StorybookConfig = {
  framework: { name: packageRoot('@storybook/vue3-vite'), options: { docgen: false } },
  stories: [...(project.tooling?.storybook?.generateStories === true ? generated : []), '../custom/**/*.stories.@(js|ts)'],
  addons: [packageRoot('@storybook/addon-docs')],
  core: { disableTelemetry: true, enableCrashReports: false, builder: {
    name: '@storybook/builder-vite', options: { viteConfigPath: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)) },
  } },
};
export default config;
`, 'extension'),
    add('.storybook/preview.ts', `import type { Preview } from '@storybook/vue3-vite';
const preview: Preview = {
  parameters: { controls: { expanded: true } },
  globalTypes: { theme: { description: 'Simulated host theme', toolbar: { icon: 'circlehollow', items: ['light', 'dark'], dynamicTitle: true } } },
  initialGlobals: { theme: 'light' },
};
export default preview;
`, 'extension'),
    add('vite.config.mjs', `// Reuse the framework's hash-guarded Nuxt UI adaptation, local icons and scoped CSS.
// shell storybook commands run from the project root, never from this workspace.
import { sharedConfig } from '../scripts/bundling/vite-shared.mjs';
export default () => {
  const config = sharedConfig();
  return { ...config, resolve: { ...config.resolve, dedupe: ['vue', 'pinia'] }, server: { ...config.server, host: '127.0.0.1' } };
};
`, 'extension'),
    add('custom/Welcome.stories.ts', `import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { defineComponent, h } from 'vue';
const Welcome = defineComponent({ name: 'StorybookWelcome', setup: () => () => h('section', [
  h('h1', 'Optional Storybook workspace'),
  h('p', 'Add hand-written stories under storybook/custom. Enable tooling.storybook.generateStories separately to include generated pages and components.'),
  h('p', 'Generated stories are design previews, not completed business acceptance.'),
]) });
const meta = { title: 'Workspace/Welcome', component: Welcome } satisfies Meta<typeof Welcome>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Overview: Story = {};
`, 'extension'),
    add('DEPENDENCIES.md', `# Optional Storybook dependencies\n\nStorybook ${storybookVersion}, Vue/Vite and TypeScript versions are exact direct pins. Installation is not part of generation or normal setup. Run \`node bin/app storybook install --yes\` from the project root. The first explicit install resolves the optional lockfile; subsequent installs use npm ci. Commit and review storybook/package-lock.json. No fake lockfile or green verification claim is emitted.\n\nUse \`node bin/app storybook check\`, \`node bin/app storybook dev\` or \`node bin/app storybook build\` after the normal project dependencies are installed. The launcher disables Storybook telemetry before startup. No browser auto-open, cloud publication or native host operation is requested.\n\nNormal root dependencies, install and verify remain independent. Disabling the feature does not delete custom files or uninstall existing packages.\n`),
  ];
}
