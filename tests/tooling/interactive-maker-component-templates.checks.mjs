import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

import {
  componentTemplateSchema,
  validateComponentTemplate,
  validateComponentTemplateCatalog,
} from '../../bin/domain/component-template.ts';
import { instantiateComponentTemplate } from '../../bin/domain/template-instantiation.ts';
import { loadComponentTemplates } from '../../bin/adapters/component-template-repository.ts';
import {
  componentTemplateCoverage,
  componentTemplateSummary,
  componentTemplateTree,
  filterComponentTemplates,
} from '../../bin/application/component-template-catalog.ts';
import { componentTemplateDocumentation } from '../../bin/application/component-template-docs.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { newDocument, documentText, openDocument } from '../../bin/domain/document.ts';
import { Workspace } from '../../bin/application/workspace.ts';
import { browseComponentTemplates } from '../../bin/presentation/template-browser.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');

function baseTemplate(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'atom.fixture',
    name: 'Fixture',
    version: '1.0.0',
    templateType: 'component',
    atomicLevel: 'atom',
    category: 'Actions',
    description: 'A complete test component template.',
    tags: ['fixture'],
    recommendedFor: ['webapp'],
    useWhen: ['A test needs a reusable fixture.'],
    avoidWhen: ['The fixture is unnecessary.'],
    capabilities: ['action'],
    states: ['default', 'disabled'],
    props: [],
    events: [],
    children: [],
    slots: [],
    design: { kind: 'catalog', entryId: 'u-button' },
    accessibility: {
      notes: 'Give the control a visible and accessible name.',
      keyboard: ['Reach the control with Tab.'],
      aria: ['Prefer native button semantics.'],
    },
    ...overrides,
  };
}

function composite(id, childId, overrides = {}) {
  return baseTemplate({
    id,
    name: id,
    templateType: 'component-with-children',
    atomicLevel: 'molecule',
    children: [{ template: childId }],
    design: { kind: 'composition', tag: 'div', layout: 'row' },
    ...overrides,
  });
}

async function temporary(prefix, check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  try { return await check(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('component-template validation accepts the complete contract and rejects malformed boundaries', () => {
  const valid = validateComponentTemplate({
    ...baseTemplate(),
    $schema: 'urn:workbench:component-template:1',
    props: [{ name: 'label', type: 'string', required: false, default: 'Go', description: 'Visible label.' }],
    events: [{ name: 'activate', payloadType: 'void', description: 'Action requested.' }],
  });
  assert.equal(valid.id, 'atom.fixture');
  const schema = componentTemplateSchema();
  assert.equal(schema.title, 'Workbench component template');
  assert.equal(schema.$id, 'urn:workbench:component-template:1');
  assert.equal(schema.properties.props.items.additionalProperties, false);
  assert.equal(schema.properties.design.oneOf.length, 4);
  assert.ok(schema.properties.design.oneOf[0].properties.entryId.enum.includes('u-table'));
  assert.ok(schema.properties.design.oneOf[1].properties.recipeId.enum.includes('recipe-bar-chart'));
  assert.equal(schema.properties.accessibility.additionalProperties, false);

  const failures = [
    { ...baseTemplate(), unknown: true },
    { ...baseTemplate(), schemaVersion: 2 },
    { ...baseTemplate(), version: 'latest' },
    { ...baseTemplate(), id: 'Fixture' },
    { ...baseTemplate(), templateType: 'widget' },
    { ...baseTemplate(), atomicLevel: 'particle' },
    { ...baseTemplate(), id: 'molecule.fixture' },
    { ...baseTemplate(), id: 'page.fixture', atomicLevel: 'page' },
    { ...baseTemplate(), templateType: 'component-with-children', children: [], slots: [{ id: 'main', role: 'content', accepts: ['atom'] }] },
    { ...baseTemplate(), states: ['hover'] },
    { ...baseTemplate(), tags: ['fixture', 'fixture'] },
    { ...baseTemplate(), props: [{ name: 'Bad-name', type: 'string', required: false }] },
    { ...baseTemplate(), props: [{ name: 'count', type: 'number', required: false, default: 'one' }] },
    { ...baseTemplate(), props: [{ name: 'x', type: 'string', required: false }, { name: 'x', type: 'string', required: false }] },
    { ...baseTemplate(), events: [{ name: 'bad-event', payloadType: 'void' }] },
    { ...baseTemplate(), events: [{ name: 'done', payloadType: 'object' }] },
    { ...baseTemplate(), children: [{ template: 'atom.fixture', optional: 'yes' }] },
    { ...baseTemplate(), slots: [{ id: 'Bad Slot', role: 'content', accepts: ['atom'] }] },
    { ...baseTemplate(), design: { kind: 'catalog', entryId: 'u-not-real' } },
    { ...baseTemplate(), design: { kind: 'recipe', recipeId: 'recipe-not-real' } },
    { ...baseTemplate(), design: { kind: 'composition', tag: 'script', layout: 'row' } },
    { ...baseTemplate(), design: { kind: 'composition', tag: 'div', layout: 'float' } },
    { ...baseTemplate(), design: { kind: 'page', layout: 'stack' } },
    { ...baseTemplate(), templateType: 'page', atomicLevel: 'atom', design: { kind: 'recipe', recipeId: 'recipe-empty-state' } },
    { ...baseTemplate(), templateType: 'page-with-bricks', atomicLevel: 'page', design: { kind: 'page', layout: 'stack' } },
    { ...baseTemplate(), templateType: 'component-with-children', atomicLevel: 'molecule', design: { kind: 'composition', tag: 'div', layout: 'row' } },
    { ...baseTemplate(), children: [{ template: 'atom.other' }] },
    { ...baseTemplate(), templateType: 'page', atomicLevel: 'page', slots: [{ id: 'main', role: 'content', accepts: ['organism'] }], design: { kind: 'page', layout: 'stack' } },
  ];
  for (const value of failures) assert.throws(() => validateComponentTemplate(value));
});

test('catalog validation rejects duplicate, dangling, page, slot and cyclic dependencies', () => {
  const atom = validateComponentTemplate(baseTemplate());
  assert.doesNotThrow(() => validateComponentTemplateCatalog([atom]));
  assert.throws(() => validateComponentTemplateCatalog([atom, atom]), /Duplicate component template/);

  const missing = validateComponentTemplate(composite('molecule.missing', 'atom.missing'));
  assert.throws(() => validateComponentTemplateCatalog([missing]), /missing template/);

  const page = validateComponentTemplate(baseTemplate({
    id: 'page.child',
    name: 'Child Page',
    templateType: 'page',
    atomicLevel: 'page',
    design: { kind: 'recipe', recipeId: 'recipe-empty-state' },
  }));
  const pageParent = validateComponentTemplate(composite('molecule.page-parent', 'page.child'));
  assert.throws(() => validateComponentTemplateCatalog([page, pageParent]), /Pages cannot be nested/);

  const badSlot = validateComponentTemplate(composite('molecule.slot-parent', 'atom.fixture', {
    children: [{ template: 'atom.fixture', slot: 'missing' }],
  }));
  assert.throws(() => validateComponentTemplateCatalog([atom, badSlot]), /unknown slot/);

  const rejectingSlot = validateComponentTemplate(composite('molecule.rejecting-slot', 'atom.fixture', {
    children: [{ template: 'atom.fixture', slot: 'main' }],
    slots: [{ id: 'main', role: 'content', accepts: ['organism'] }],
  }));
  assert.throws(() => validateComponentTemplateCatalog([atom, rejectingSlot]), /does not accept/);

  const organism = validateComponentTemplate(baseTemplate({ id: 'organism.fixture', name: 'Organism', atomicLevel: 'organism' }));
  const inverted = validateComponentTemplate(composite('molecule.inverted', 'organism.fixture'));
  assert.throws(() => validateComponentTemplateCatalog([organism, inverted]), /lower Atomic Design levels/);

});

test('repository merges the framework baseline, allows project overrides and refuses plugin collisions', async () => {
  const baseline = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  assert.ok(baseline.length >= 40);
  const button = baseline.find(entry => entry.template.id === 'atom.button');
  assert.equal(button?.origin, 'baseline');

  await temporary('template-project-', async root => {
    const folder = join(root, 'configs/templates/atoms');
    await mkdir(folder, { recursive: true });
    const source = JSON.parse(await readFile(join(frameworkRoot, 'configs/templates/atoms/button.json'), 'utf8'));
    source.name = 'Project Button';
    await writeFile(join(folder, 'button.json'), JSON.stringify(source));
    const merged = await loadComponentTemplates(root, frameworkRoot);
    const overridden = merged.find(entry => entry.template.id === 'atom.button');
    assert.equal(overridden?.template.name, 'Project Button');
    assert.equal(overridden?.origin, 'project');

    await mkdir(join(root, 'configs/templates/pages'), { recursive: true });
    await writeFile(join(root, 'configs/templates/pages/misplaced.json'), JSON.stringify(source));
    await assert.rejects(loadComponentTemplates(root, frameworkRoot), /must live at/);
    await rm(join(root, 'configs/templates/pages/misplaced.json'));

    await assert.rejects(
      loadComponentTemplates(root, frameworkRoot, [source]),
      /Plugin template collides/,
    );
  });
});

test('catalog search, summaries, trees and coverage expose the shared discovery model', async () => {
  const entries = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  assert.ok(filterComponentTemplates(entries, { query: 'table' }).some(entry => entry.template.id === 'organism.data-table'));
  assert.ok(filterComponentTemplates(entries, { templateType: 'page-with-bricks' }).every(entry => entry.template.templateType === 'page-with-bricks'));
  assert.ok(filterComponentTemplates(entries, { atomicLevel: 'organism' }).every(entry => entry.template.atomicLevel === 'organism'));
  assert.ok(filterComponentTemplates(entries, { category: 'Navigation' }).length > 0);
  assert.ok(filterComponentTemplates(entries, { tag: 'editor' }).length > 0);
  assert.ok(filterComponentTemplates(entries, { recommendedFor: 'editor' }).length > 0);
  assert.equal(filterComponentTemplates(entries, { query: 'definitely-absent' }).length, 0);

  const entry = entries.find(item => item.template.id === 'organism.website-header');
  const summary = componentTemplateSummary(entry);
  assert.equal(summary.atomicLevel, 'organism');
  assert.equal(summary.origin, 'baseline');
  const tree = componentTemplateTree(entries, 'organism.website-header');
  assert.equal(tree.id, 'organism.website-header');
  assert.ok(tree.children.length >= 2);
  assert.throws(() => componentTemplateTree(entries, 'organism.unknown'), /not found/);

  const coverage = componentTemplateCoverage(entries);
  assert.equal(coverage.baselineComplete, true);
  assert.equal(coverage.documentation.complete, true);
  assert.deepEqual(coverage.missingCategories, []);
  for (const id of ['atom.textarea', 'molecule.date-range', 'organism.form', 'organism.command-palette', 'organism.list',
    'organism.kpi-grid', 'template.content-sidebar', 'page.overview', 'page.error', 'page.command-center']) {
    assert.ok(entries.some(entry => entry.template.id === id), 'baseline contains ' + id);
  }
});

test('documentation is deterministic and keeps JSON authoritative', async () => {
  const entries = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  const first = componentTemplateDocumentation(entries, 'docs/generated/component-library/');
  const second = componentTemplateDocumentation(entries, 'docs/generated/component-library');
  assert.deepEqual(first, second);
  assert.equal(first.length, entries.length + 1);
  assert.match(first[0].content, /JSON is the source of truth/);
  const dataTable = first.find(file => file.path.endsWith('organism-data-table.md'));
  assert.match(dataTable.content, /# Data Table/);
  assert.match(dataTable.content, /## Accessibility/);
});

test('instantiation covers catalog, recipe, composition and both page shapes on the canonical IR', async () => {
  const entries = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  const templates = entries.map(entry => entry.template);
  const document = newDocument('Template Instantiation');

  const atom = instantiateComponentTemplate(document, templates, 'atom.button', 'Run');
  assert.equal(atom.kind, 'component');
  const catalogComposite = instantiateComponentTemplate(document, templates, 'molecule.form-field');
  assert.equal(catalogComposite.kind, 'component');
  const composition = instantiateComponentTemplate(document, templates, 'organism.website-header');
  assert.equal(composition.kind, 'component');
  const recipe = instantiateComponentTemplate(document, templates, 'molecule.empty-state');
  assert.equal(recipe.kind, 'component');
  const barChart = instantiateComponentTemplate(document, templates, 'organism.bar-chart');
  assert.equal(barChart.kind, 'component');
  const barDefinition = document.design.visualDesigns.components.find(item => item.id === barChart.id);
  assert.ok(JSON.stringify(barDefinition?.template).includes('"entryId":"u-progress"'));
  const pageWithSlots = instantiateComponentTemplate(document, templates, 'page.dashboard', 'Overview');
  assert.equal(pageWithSlots.kind, 'page');
  const recipePage = instantiateComponentTemplate(document, templates, 'page.welcome');
  assert.equal(recipePage.kind, 'page');

  assert.ok(document.design.library.some(item => item.templateId === 'organism.website-header'));
  assert.ok(document.design.visualDesigns.components.some(item => item.id === composition.id && item.template.length > 0));
  assert.ok(document.design.visualDesigns.pages.some(item => item.id === pageWithSlots.id && item.root.length === 1));
  assert.throws(() => instantiateComponentTemplate(document, templates, 'page.unknown'), /not found/);
});

test('Workspace template instantiation participates in undo and redo history', async () => {
  const entries = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  const workspace = new Workspace(newDocument('History'), null);
  const before = workspace.document.design.library.length;
  const created = workspace.instantiateTemplate(entries.map(entry => entry.template), 'organism.data-table', 'Records');
  assert.equal(created.kind, 'component');
  assert.ok(workspace.document.design.library.length > before);
  assert.equal(workspace.dirty, true);
  assert.equal(workspace.undo(), true);
  assert.equal(workspace.document.design.library.length, before);
  assert.equal(workspace.redo(), true);
  assert.ok(workspace.document.design.library.length > before);
  assert.equal(workspace.undo(), true);
  assert.equal(workspace.undo(), false);
  workspace.saved('saved-hash');
  assert.equal(workspace.beforeHash, 'saved-hash');
});

test('framework template commands share discovery and reviewed file-plan boundaries', async () => {
  await temporary('template-cli-', async root => {
    const context = { root, frameworkRoot };
    const reads = [
      ['templates list', [], { 'atomic-level': 'atom' }],
      ['templates search', ['table'], {}],
      ['templates show', ['organism.data-table'], {}],
      ['templates tree', ['page.dashboard'], {}],
      ['templates validate', [], {}],
      ['templates validate', ['organism.data-table'], {}],
      ['templates schema', [], {}],
      ['templates coverage', [], {}],
    ];
    for (const [command, args, options] of reads) {
      const outcome = await executeOperation({ command, args, options }, context);
      assert.equal(outcome.status, 'ok', command + ': ' + JSON.stringify(outcome.diagnostics));
    }

    const docs = await executeOperation({ command: 'templates docs', args: [], options: {} }, context);
    assert.equal(docs.status, 'planned');
    assert.ok(docs.data.changes.length > 40);

    await writeFile(join(root, 'project.json'), documentText(newDocument('CLI')));
    const preview = await executeOperation({
      command: 'templates instantiate',
      args: ['page.dashboard'],
      options: { project: 'project.json', name: 'Overview' },
    }, context);
    assert.equal(preview.status, 'planned');
    const applied = await executeOperation({
      command: 'templates instantiate',
      args: ['page.dashboard'],
      options: { project: 'project.json', name: 'Overview', apply: preview.data.planHash },
    }, context);
    assert.equal(applied.status, 'applied');
    const document = openDocument(JSON.parse(await readFile(join(root, 'project.json'), 'utf8')));
    assert.ok(document.design.nodes.some(surface => surface.label === 'Overview'));

    const missing = await executeOperation({ command: 'templates show', args: ['atom.nope'], options: {} }, context);
    assert.equal(missing.status, 'failed');
  });
});

test('TUI browser discovers and instantiates from the same catalog', async () => {
  const workspace = new Workspace(newDocument('TUI'), null);
  const decisions = ['organism', 'organism.data-table', 'yes', 'back'];
  const output = [];
  const ui = {
    write(value) { output.push(value); },
    ask: async () => '',
    rich: {
      async select(_title, choices) {
        const next = decisions.shift();
        assert.ok(choices.some(choice => choice.id === next), 'choice ' + next + ' is available');
        return next;
      },
      async text({ initial }) { return initial; },
    },
  };
  await browseComponentTemplates(ui, workspace, { root: frameworkRoot, frameworkRoot });
  assert.ok(workspace.document.design.library.some(item => item.templateId === 'organism.data-table'));
  assert.match(output.join(''), /Data Table/);
});


test('TUI browser uses the active plugin runtime template catalog', async () => {
  const pluginTemplate = validateComponentTemplate({
    ...baseTemplate(),
    id: 'atom.runtime-chip',
    name: 'Runtime Chip',
    design: { kind: 'catalog', entryId: 'u-badge' },
  });
  const workspace = new Workspace(newDocument('Plugin TUI'), null);
  const decisions = ['atom', 'atom.runtime-chip', 'yes', 'back'];
  const ui = {
    write() {},
    ask: async () => '',
    rich: {
      async select(_title, choices) {
        const next = decisions.shift();
        assert.ok(choices.some(choice => choice.id === next), 'runtime choice ' + next + ' is available');
        return next;
      },
      async text({ initial }) { return initial; },
    },
  };
  const plugins = {
    commandContext: {
      templates: {
        async list() { return [pluginTemplate]; },
      },
    },
  };
  await browseComponentTemplates(ui, workspace, { root: frameworkRoot, frameworkRoot, plugins });
  assert.ok(workspace.document.design.library.some(item => item.templateId === 'atom.runtime-chip'));
});


test('TUI browser exposes the four user-facing template categories', async () => {
  const workspace = new Workspace(newDocument('Category TUI'), null);
  const decisions = ['pages-with-bricks', 'page.dashboard', 'no', 'back'];
  const seen = [];
  const ui = {
    write() {},
    ask: async () => '',
    rich: {
      async select(title, choices) {
        seen.push({ title, ids: choices.map(choice => choice.id) });
        const next = decisions.shift();
        assert.ok(choices.some(choice => choice.id === next), 'category choice ' + next + ' is available');
        return next;
      },
      async text({ initial }) { return initial; },
    },
  };
  await browseComponentTemplates(ui, workspace, { root: frameworkRoot, frameworkRoot });
  assert.ok(seen[0].ids.includes('components'));
  assert.ok(seen[0].ids.includes('components-with-children'));
  assert.ok(seen[0].ids.includes('pages'));
  assert.ok(seen[0].ids.includes('pages-with-bricks'));
});
