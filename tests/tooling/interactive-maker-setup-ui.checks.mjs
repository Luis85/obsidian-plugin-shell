import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { projectSetupWizard } from '../../bin/presentation/project-setup-wizard.ts';
import { settingsWizard } from '../../bin/presentation/settings.ts';
import { editBricks } from '../../bin/presentation/brick-editor.ts';
import { projectSetupPlan } from '../../bin/adapters/project-setup.ts';
import { configuredArguments } from '../../bin/adapters/setup-command.ts';
import { parseArguments } from '../../bin/adapters/commands.ts';
import { defaultSettings } from '../../bin/domain/user-settings.ts';
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { Workspace } from '../../bin/application/workspace.ts';
import { Back } from '../../bin/presentation/prompts.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const markdown = '---\ntype: prd\nid: PRD-1\ntitle: Test\n---\nOriginal\n';
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'setup-ui-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function vault(root) {
  assert.equal(spawnSync('git', ['init', root]).status, 0); await mkdir(join(root, '.obsidian'));
  await mkdir(join(root, 'docs/prds'), { recursive: true }); await writeFile(join(root, 'docs/prds/test.md'), markdown);
}
function human(options = {}) {
  const events = [], previews = [];
  return { events, previews, ui: {
    ask: async () => { throw new Error('Unexpected plain prompt'); }, write: value => events.push(['write', value]),
    rich: {
      context: value => events.push(['context', value]), busy: value => events.push(['busy', value]),
      review: async (label, sections) => previews.push({ label, sections }),
      text: async value => {
        events.push(['text', value.title]);
        const values = { 'Project name': 'Human product', 'Describe your project': 'Build the first iteration.', 'Describe the product and desired outcome': 'Manage work.', 'Author': 'Alice',
          'Prototype title': 'Human product', 'Vault-relative Markdown paths, separated by semicolons': 'docs/prds/test.md' };
        return values[value.title] ?? value.initial;
      },
      select: async (label, items, initial) => {
        events.push(['select', label]);
        if (label === 'Prepare a prototype?') return options.prototype ? 'yes' : 'no';
        if (label === 'Add application bricks?') return options.bricks ? 'yes' : 'no';
        if (label === 'Create the Angular application boilerplate?') return options.boilerplate ? 'yes' : 'no';
        if (label === 'Apply this reviewed plan?') return options.apply === false ? 'no' : 'yes';
        if (label === 'Scan PRD subfolders recursively?' || label.startsWith('Do you agree')) return 'yes';
        if (label === 'PRD intake') return options.add ? 'add' : 'scan';
        if (label === 'Application bricks') return 'done';
        return initial || items[0].id;
      },
      multi: async (_label, _items, selected) => selected,
    },
  } };
}
test('interactive setup persists the same canonical files as its agent request and follows the use-case order', async () => scratch(async root => {
  await vault(root); const f = human({ bricks: true });
  const completed = await projectSetupWizard(f.ui, { root, frameworkRoot });
  assert.match(completed, /specifications saved/);
  const indices = ['Typed PRD folder', 'Project name', 'PRD intake', 'Prepare a prototype?', 'Add application bricks?', 'Create the Angular application boilerplate?', 'Apply this reviewed plan?'].map(label => f.events.findIndex(event => event[1] === label));
  assert.ok(indices.every((value, index) => value >= 0 && (!index || value > indices[index - 1])));
  const settings = JSON.parse(await readFile(join(root, 'configs/user-settings.json'), 'utf8'));
  const agent = await projectSetupPlan({ root, frameworkRoot }, { schemaVersion: 1, settings,
    project: { name: 'Human product', description: 'Build the first iteration.', product: 'Manage work.' },
    prds: { mode: 'scan' }, prototypeInterview: null, operations: [], boilerplate: false });
  assert.ok(agent.plan.changes.every(change => change.status === 'unchanged'));
  assert.equal(f.previews.at(-1).label, 'Review before writing');
}));
test('prototype and boilerplate branch is an approved guide plus a final no-write review', async () => scratch(async root => {
  await vault(root); const f = human({ prototype: true, boilerplate: true, apply: false, add: true });
  assert.equal(await projectSetupWizard(f.ui, { root, frameworkRoot }), undefined);
  assert.ok(f.previews.some(item => item.label === 'Review your prototype brief'));
  assert.match(f.previews.at(-1).sections[0].body, /apps\/product\/scripts\/serve.mjs/);
  await assert.rejects(() => readFile(join(root, 'configs/user-settings.json')));
  assert.equal(await readFile(join(root, 'docs/prds/test.md'), 'utf8'), markdown);
}));
test('cancelling the settings step exits without a saved draft or modifying the vault', async () => scratch(async root => {
  await vault(root); const f = human(); f.ui.rich.text = async () => { throw new Back(); };
  const before = await readdir(root);
  await assert.rejects(() => projectSetupWizard(f.ui, { root, frameworkRoot }), Back);
  assert.deepEqual(await readdir(root), before);
}));
test('settings wizard and configured defaults honor explicit overrides and preserve legacy paths when absent', async () => scratch(async root => {
  const args = parseArguments(['sketch', 'generate']); assert.deepEqual(await configuredArguments(args, root), args);
  const f = human(); await settingsWizard(f.ui, { root });
  const generate = await configuredArguments(args, root); assert.equal(generate.flags.out, 'apps/product');
  assert.equal((await configuredArguments(parseArguments(['prototype']), root)).flags.out, defaultSettings.paths.prototypes);
  assert.equal((await configuredArguments(parseArguments(['studio']), root)).flags.project, defaultSettings.paths.project);
  const override = await configuredArguments(parseArguments(['sketch','generate','--out','other','--project','other.json']), root);
  assert.equal(override.flags.out, 'other'); assert.equal(override.flags.project, 'other.json');
  for (const values of [['settings','schema'], ['new'], ['sketch','schema'], ['prototype','guide'], ['sketch','--help']]) {
    const original = parseArguments(values); assert.deepEqual(await configuredArguments(original, root), original);
  }
}));
test('brick editor uses real operations and preserves a replayable transaction for all categories', async () => {
  const workspace = new Workspace(newDocument('Bricks'), null), f = human();
  const actions = ['entity.properties', 'page.add', 'page.add', 'page.rename', 'component.add', 'component.rename', 'page.layout', 'page.attach', 'page.attach',
    'sitemap.group', 'sitemap.parent', 'sitemap.route', 'sitemap.link', 'entity.add', 'entity.properties', 'data-source.add', 'brick.rename', 'brick.rename', 'journey.add', 'done'];
  let title = 0, attaches = 0, renames = 0, steps = 0;
  f.ui.rich.select = async (label, items, initial) => {
    if (label === 'Application bricks') return actions.shift();
    if (label === 'Component to attach') return ++attaches === 1 ? 'new' : items[1].id;
    if (label === 'Brick kind') return ++renames === 1 ? 'entity' : 'data-source';
    if (label === 'Add the next journey step?') return ++steps === 1 ? 'yes' : 'no';
    if (label === 'Add another property?' || label === 'Required property?') return 'no';
    if (label === 'Parent') return 'root';
    return initial || items[0].id;
  };
  f.ui.rich.text = async value => value.title === 'Property key' ? 'name' : value.title.startsWith('Route path') ? '/' : 'Brick ' + (++title);
  const initial = newDocument('Bricks'); const operations = await editBricks(f.ui, workspace);
  const replay = new Workspace(initial, null); replay.edit(operations);
  assert.equal(documentText(replay.document), documentText(workspace.document));
  assert.equal(workspace.document.design.semantic.entities[0].properties.length, 1);
  assert.equal(workspace.document.design.dataSources.sources.length, 1);
  assert.equal(workspace.document.design.sitemap.journeys[0].steps.length, 2);
  assert.ok(f.events.some(event => String(event[1]).includes('Create this kind of brick first')));
  assert.equal(actions.length, 0);
});
test('plain setup supports a fully skipped optional flow and default-No review', async () => scratch(async root => {
  await vault(root); const answers = ['', '', '', '', '', 'Alice', 'plain', 'no', 'Plain product', 'Project description', 'Product outcome', 'scan', 'n', 'n', 'n', ''];
  const ui = { write: () => {}, ask: async label => { assert.ok(answers.length, label); return answers.shift(); } };
  assert.equal(await projectSetupWizard(ui, { root, frameworkRoot }), undefined);
  assert.equal(answers.length, 0); await assert.rejects(() => readFile(join(root, 'configs/user-settings.json')));
}));
