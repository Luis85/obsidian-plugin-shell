import type { Artifact, TemplateSnapshot } from '../../../bin/compiler/domain/contracts.ts';
import { storybookOptions, validateProjectTooling } from '../tooling-contract.ts';
import { storybookStories } from './storybook-stories.ts';
import { storybookHost } from './storybook-host.ts';
import { storybookWorkspace, storybookVersion } from './storybook-workspace.ts';
import { json, requireValue, type Model } from './model.ts';
/** Pure optional artifact emission. No filesystem, registry, installation or implicit feature activation. */
export function storybookCode(template: TemplateSnapshot, model: Model): Artifact[] {
  const tooling = model.document.tooling;
  validateProjectTooling(tooling);
  const options = storybookOptions({ tooling });
  if (!options.enabled && !options.generateStories) return [];
  requireValue(![model.sourceRoot, model.testRoot].some(root => root.toLowerCase().startsWith('storybook/')),
    'Generated roots overlap the optional storybook workspace. Choose different code/test folders.');
  const generated = options.generateStories ? storybookStories(model) : { files: [], inventory: [] };
  const files: Artifact[] = [...generated.files];
  if (options.generateStories) files.push({ path: 'storybook/generated/with-project.ts', content: storybookHost(model), ownership: 'managed', producer: 'storybook' });
  if (options.enabled) files.push(...storybookWorkspace(template, generated.files.map(file => file.path)));
  files.push({ path: 'design/storybook.json', ownership: 'managed', producer: 'storybook', content: json({ schemaVersion: 1, ...options,
    framework: '@storybook/vue3-vite', format: 'csf3', storybookVersion, workspace: options.enabled ? 'storybook' : null,
    dependencies: options.enabled ? 'explicit-install-required' : 'not-added', typecheck: 'not-run', build: 'not-run',
    businessAcceptance: 'not-inferred', stories: generated.inventory }) });
  files.push({ path: 'STORYBOOK.md', ownership: 'managed', producer: 'storybook', content: `# Optional Storybook\n\nTwo independent opt-ins in project JSON:\n\n\`\`\`json\n${json({ tooling: { storybook: options } }).trim()}\n\`\`\`\n\nCLI overrides: --storybook-stories on|off and --storybook on|off. Overrides are recorded in the generated design/project.json, including reviewed in-place regeneration. External input/from files are never overwritten. Both default to false. Generating CSF files never installs or enables Storybook. Enabling Storybook creates an isolated development workspace and does not turn on generated stories.\n\n## Generated stories\n\nManaged CSF3 TypeScript files in storybook/generated import actual generated Vue components and page definitions. Authored states, variants and scenarios are separate stories. Required prop examples without defaults are labelled synthetic in design/storybook.json. Undesigned components/pages remain explicitly labelled implementation placeholders. No play functions or passed acceptance tests are invented.\n\nGenerated stories use a per-story Vue app and Pinia, synthetic read services and a simulated host theme. Native adapters are not loaded. Navigation requests are preview information, not a complete clickdummy journey. External adapter implementation points may still report an error.\n\n## Optional workspace\n\nWith tooling.storybook.enabled, install normal project dependencies first, then explicitly run:\n\n\`\`\`sh\nnode bin/app storybook status\nnode bin/app storybook install --yes\nnode bin/app storybook build\nnode bin/app storybook check\nnode bin/app storybook dev\n\`\`\`\n\nThe workspace includes the Docs and Accessibility (a11y) addons at the Storybook version, and a toolbar Theme global whose decorator toggles the Obsidian theme-light/theme-dark classes on the document body. Check stories in both themes in the a11y panel. Storybook dependencies and its lockfile live under storybook/, outside the root installation. Launchers disable telemetry, bind the dev server to localhost and do not auto-open a browser. Root build/test/verify do not start or require Storybook. A static Storybook build is not the self-contained offline clickdummy or permission to publish.\n\nFiles-only users can register these CSF files in an existing Vue 3/Vite Storybook; keep the relative imports and project decorator. Use the framework's shared Vite configuration for Nuxt UI support.\n\n## Regeneration and disabling\n\nGenerated files use the existing ownership-aware, reviewed planner. Put custom stories under storybook/custom. Retired files are retained, never silently deleted. The workspace loads an exact generated inventory, so retired stories are not indexed. Turning either option off requires regeneration; the launcher and configuration also check the current generated project definition, preventing stale workspace files from re-enabling a disabled feature. Existing optional packages, lockfiles and custom stories are not automatically removed.\n` });
  return files;
}
