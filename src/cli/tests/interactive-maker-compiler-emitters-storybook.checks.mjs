const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { storybookStories } from '../compiler/emitters/storybook-stories.ts';
import { storybookHost } from '../compiler/emitters/storybook-host.ts';
import { storybookWorkspace, storybookVersion } from '../compiler/emitters/storybook-workspace.ts';
import { storybookCode } from '../compiler/emitters/storybook-code.ts';
import { detailDocument, richComponentDocument, model, template } from './support/compiler-emitters-fixture.mjs';

// Optional Storybook emission (storybook-{stories,host,workspace,code}.ts): exact CSF files, inventory and opt-in gates.
const byEntity = (rendered, id) => {
  const index = rendered.inventory.findIndex(item => item.entityId === id);
  return { file: rendered.files[index], inventory: rendered.inventory[index] };
};

test('an authored component story carries synthetic props, actions, slots, variants and scenarios exactly', () => {
  const { file, inventory } = byEntity(storybookStories(model(richComponentDocument())), 'vc-1');
  assert.deepEqual(inventory, { path: 'storybook/generated/components/project-json-review.stories.ts',
    source: 'src/plugin/generated/presentation/components/library/project-json-review.vue', entityId: 'vc-1',
    stories: ['Default', 'Loading', 'Empty', 'Error', 'Disabled', 'Variant64656661756c74', 'Variant636f6d70616374', 'Scenario6e6172726f772d726576696577'],
    syntheticProps: ['count', 'open'] });
  assert.equal(file.path, inventory.path); assert.equal(file.ownership, 'managed'); assert.equal(file.producer, 'storybook');
  assert.deepEqual(file.origins, [{ file: 'project.json', jsonPointer: '/design/visualDesigns/components/0', entityId: 'vc-1', document: 'normalized' }]);
  const state = name => `export const ${name[0].toUpperCase() + name.slice(1)}: Story = {\n  args: {"designState":"${name}"}\n};\n`;
  const argTypes = '{"title":{"control":"text","description":"","table":{"type":{"summary":"string"}}},'
    + '"busy":{"control":"boolean","description":"","table":{"type":{"summary":"boolean"}}},'
    + '"count":{"control":"number","description":"","table":{"type":{"summary":"number"}}},'
    + '"label":{"control":"text","description":"Shown label","table":{"type":{"summary":"string"}}},'
    + '"open":{"control":"boolean","description":"","table":{"type":{"summary":"boolean"}}},'
    + '"designState":{"control":"select","options":["default","loading","empty","error","disabled"]},"designScenario":{"control":"select","options":["","narrow-review"]}}';
  assert.equal(file.content, `// Generated from project JSON. Put custom stories in storybook/custom, not this managed file.
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { h } from 'vue';
import { action } from 'storybook/actions';
import Subject from "../../../generated/presentation/components/library/project-json-review.vue";
import { withProject } from '../with-project.ts';
const meta = {
  title: "Components/ProjectJsonReview (project-json-review)",
  id: "generated-component-project-json-review",
  tags: ["autodocs"],
  argTypes: ${argTypes},
  parameters: {"shell":{"projectId":"plugin-companion","entityId":"vc-1","source":"src/plugin/generated/presentation/components/library/project-json-review.vue","jsonPointer":"/design/visualDesigns/components/0","implementation":"authored-visual-definition","syntheticProps":["count","open"],"businessAcceptance":"not-inferred"}},
  component: Subject,
  decorators: [withProject],
  args: { ...{"count":0,"label":"Hello","open":false}, "onSelect": action("select"), "onCancel": action("cancel") },
  render: args => ({ setup: () => () => h(Subject, args, {"content": () => "Example content slot" }) }),
} satisfies Meta<typeof Subject>;
export default meta;
type Story = StoryObj<typeof meta>;
${['default', 'loading', 'empty', 'error', 'disabled'].map(state).join('')}export const Variant64656661756c74: Story = {
  name: "default",
  args: {"designState":"default"}
};
export const Variant636f6d70616374: Story = {
  name: "compact",
  args: {"busy":true,"designState":"default"}
};
export const Scenario6e6172726f772d726576696577: Story = {
  name: "Narrow review",
  args: {"designScenario":"narrow-review"},
  parameters: {"shell":{"width":"narrow"}}
};
`);
});

test('placeholder components and pages keep one default story and record their implementation status', () => {
  const rendered = storybookStories(model(detailDocument()));
  const { file, inventory } = byEntity(rendered, 'component-record-card');
  assert.deepEqual(inventory, { path: 'storybook/generated/components/record-card.stories.ts', source: 'src/plugin/generated/presentation/components/library/record-card.vue',
    entityId: 'component-record-card', stories: ['Default'], syntheticProps: [] });
  assert.equal(file.content, `// Generated from project JSON. Put custom stories in storybook/custom, not this managed file.
import type { Meta, StoryObj } from '@storybook/vue3-vite';
import Subject from "../../../generated/presentation/components/library/record-card.vue";
import { withProject } from '../with-project.ts';
const meta = {
  title: "Components/RecordCard (record-card)",
  id: "generated-component-record-card",
  tags: ["autodocs"],
  argTypes: {},
  parameters: {"shell":{"projectId":"plugin-companion","entityId":"component-record-card","source":"src/plugin/generated/presentation/components/library/record-card.vue","jsonPointer":"/design/library/0","implementation":"implementation-placeholder","syntheticProps":[],"businessAcceptance":"not-inferred"}},
  component: Subject,
  decorators: [withProject],
  args: { ...{} },
} satisfies Meta<typeof Subject>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
${'  '}
};
`);
  const page = byEntity(rendered, 'vp-8');
  assert.deepEqual(page.inventory.stories, ['Default', 'Loading', 'Empty', 'Error', 'Disabled']);
  assert.equal(page.inventory.source, 'src/plugin/generated/presentation/components/details/vp-8.vue');
  assert.ok(page.file.content.includes('  argTypes: {"designState":{"control":"select","options":["default","loading","empty","error","disabled"]},"designScenario":{"control":"select","options":[""]}},\n'));
  assert.ok(page.file.content.includes('"jsonPointer":"/design/visualDesigns/pages/0","surface":"node-48","implementation":"authored-visual-definition"'));
  const screen = byEntity(rendered, 'page-overview');
  assert.deepEqual(screen.inventory, { path: 'storybook/generated/pages/overview-screen.stories.ts', source: 'src/plugin/generated/presentation/components/screens/overview-screen.vue',
    entityId: 'page-overview', stories: ['Default'], syntheticProps: [] });
  assert.ok(screen.file.content.includes('"jsonPointer":"/design/nodes/1","surface":"node-3","implementation":"implementation-placeholder"'));
  // Group and action surfaces host no page; modal/settings surfaces do.
  assert.equal(rendered.files.length, 54 + 27);
  assert.ok(rendered.inventory.some(item => item.entityId === 'page-preferences'));
});

test('an authored definition without template nodes is an implementation placeholder', () => {
  const document = detailDocument(); document.design.visualDesigns.pages[0].root = [];
  const { file } = byEntity(storybookStories(model(document)), 'vp-8');
  assert.ok(file.content.includes('"implementation":"implementation-placeholder"'));
});

test('the story host imports every generated context module relative to its own path', () => {
  const custom = detailDocument(); custom.settings = { codebaseFolder: 'app/code', testsFolder: 'checks' };
  const text = storybookHost(model(custom));
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(5, 14), [
    "import { panels } from \"../../app/code/generated/bootstrap/panels.ts\";",
    "import { projectKey } from \"../../app/code/generated/presentation/context/project.ts\";",
    "import { createClickdummySources } from \"../../app/code/generated/bootstrap/clickdummy-sources.ts\";",
    "import { bindFlows } from \"../../app/code/generated/bootstrap/flows.ts\";",
    "import { createVisualContext } from \"../../app/code/generated/bootstrap/visual-context.ts\";",
    "import { provideVisualContext } from \"../../app/code/generated/presentation/composables/use-visual.ts\";",
    "import { useNavigation } from \"../../app/code/generated/presentation/stores/navigation.ts\";",
    "import { screens } from \"../../app/code/generated/domain/screens.ts\";",
    "import '../../harness/styles/simulated.css';"]);
  assert.equal(lines[16], 'import "../../app/code/generated/presentation/detail-layout.css";');
  assert.equal(lines[17], 'const owner = "plugin-companion";');
  assert.equal(lines.at(-1), ''); assert.equal(lines.at(-2), '};');
});

test('the isolated workspace pins the framework versions and refuses a missing pin', () => {
  const files = storybookWorkspace(template, ['storybook/generated/pages/a.stories.ts', 'storybook/generated/components/b.stories.ts']);
  assert.deepEqual(files.map(file => [file.path, file.ownership]), [
    ['storybook/package.json', 'managed'], ['storybook/.gitignore', 'managed'], ['storybook/tsconfig.json', 'managed'],
    ['storybook/.storybook/generated.json', 'managed'], ['storybook/.storybook/main.ts', 'extension'], ['storybook/.storybook/preview.ts', 'extension'],
    ['storybook/vite.config.mjs', 'extension'], ['storybook/custom/Welcome.stories.ts', 'extension'], ['storybook/DEPENDENCIES.md', 'managed']]);
  assert.ok(files.every(file => file.producer === 'storybook'));
  const text = path => files.find(file => file.path === path).content;
  const pkg = JSON.parse(text('storybook/package.json')), root = JSON.parse(template.text('package.json'));
  const pins = { ...root.dependencies, ...root.devDependencies };
  assert.deepEqual(pkg.devDependencies, { storybook: storybookVersion, '@storybook/vue3-vite': storybookVersion, '@storybook/addon-docs': storybookVersion,
    '@storybook/addon-a11y': storybookVersion, '@storybook/builder-vite': storybookVersion, ...Object.fromEntries(['vue', 'vite', '@vitejs/plugin-vue', '@types/node', 'typescript', 'vue-tsc'].map(name => [name, pins[name]])) });
  assert.deepEqual(pkg.scripts, { storybook: 'node ../bin/app storybook dev --root ..', 'build-storybook': 'node ../bin/app storybook build --root ..', typecheck: 'node ../bin/app storybook check --root ..' });
  assert.equal(text('storybook/.gitignore'), 'node_modules/\nstorybook-static/\n*.log\n');
  assert.deepEqual(JSON.parse(text('storybook/tsconfig.json')), { extends: '../tsconfig.json', compilerOptions: { allowImportingTsExtensions: true },
    files: ['generated/pages/a.stories.ts', 'generated/components/b.stories.ts'], include: ['custom/**/*.ts', '.storybook/**/*.ts'] });
  assert.deepEqual(JSON.parse(text('storybook/.storybook/generated.json')), ['../generated/pages/a.stories.ts', '../generated/components/b.stories.ts']);
  assert.match(text('storybook/DEPENDENCIES.md'), new RegExp(`^# Optional Storybook dependencies\n\nStorybook ${storybookVersion.replaceAll('.', '\\.')}, its Docs and Accessibility \\(a11y\\) addons, Vue/Vite`));
  const unpinned = { text: () => JSON.stringify({ dependencies: { vue: '3.0.0' }, devDependencies: {} }) };
  assert.throws(() => storybookWorkspace(unpinned, []), { message: 'GENERATOR_INVALID: Storybook workspace requires the framework pin for vite' });
});

test('storybook emission follows the two independent opt-ins and refuses overlapping roots', () => {
  const emit = (storybook, settings) => {
    const document = detailDocument(); if (settings) document.settings = settings;
    const m = model(document); if (storybook) m.document.tooling = { storybook };
    return storybookCode(template, m);
  };
  assert.deepEqual(emit(undefined), []);
  assert.deepEqual(emit({ enabled: false, generateStories: false }), []);
  const stories = emit({ enabled: false, generateStories: true });
  assert.deepEqual(stories.slice(-3).map(file => file.path), ['storybook/generated/with-project.ts', 'design/storybook.json', 'STORYBOOK.md']);
  assert.equal(stories.length, 81 + 3);
  const manifest = JSON.parse(stories.find(file => file.path === 'design/storybook.json').content);
  assert.deepEqual({ ...manifest, stories: manifest.stories.length }, { schemaVersion: 1, enabled: false, generateStories: true, framework: '@storybook/vue3-vite', format: 'csf3',
    storybookVersion, workspace: null, dependencies: 'not-added', typecheck: 'not-run', build: 'not-run', businessAcceptance: 'not-inferred', stories: 81 });
  const workspace = emit({ enabled: true });
  assert.deepEqual(workspace.map(file => file.path).filter(path => path.startsWith('storybook/generated')), []);
  assert.deepEqual(JSON.parse(workspace.find(file => file.path === 'storybook/.storybook/generated.json').content), []);
  const enabled = JSON.parse(workspace.find(file => file.path === 'design/storybook.json').content);
  assert.deepEqual([enabled.workspace, enabled.dependencies, enabled.stories], ['storybook', 'explicit-install-required', []]);
  const guide = workspace.find(file => file.path === 'STORYBOOK.md').content;
  assert.ok(guide.startsWith('# Optional Storybook\n\nTwo independent opt-ins in project JSON:\n\n```json\n{\n  "tooling": {\n    "storybook": {\n      "enabled": true,\n      "generateStories": false\n    }\n  }\n}\n```\n'));
  const both = emit({ enabled: true, generateStories: true });
  assert.equal(JSON.parse(both.find(file => file.path === 'storybook/.storybook/generated.json').content).length, 81);
  assert.equal(JSON.parse(both.find(file => file.path === 'design/storybook.json').content).workspace, 'storybook');
  assert.throws(() => emit({ enabled: true }, { codebaseFolder: 'storybook/app', testsFolder: 'tests' }),
    { message: 'GENERATOR_INVALID: Generated roots overlap the optional storybook workspace. Choose different code/test folders.' });
  assert.throws(() => emit({ enabled: 'yes' }));
});
