import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadComponentTemplates } from '../../bin/adapters/component-template-repository.ts';
import { componentTemplateCoverage, componentTemplateTree } from '../../bin/application/component-template-catalog.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { documentText, newDocument, openDocument } from '../../bin/domain/document.ts';
import { pluginComponentTemplates } from '../../plugins/template-contributions.ts';

const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));

test('baseline component-template catalog is valid, broad and compositional', async () => {
  const entries = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  assert.ok(entries.length >= 40);
  assert.equal(new Set(entries.map(entry => entry.template.id)).size, entries.length);
  const coverage = componentTemplateCoverage(entries);
  assert.equal(coverage.baselineComplete, true);
  const tree = componentTemplateTree(entries, 'organism.website-header');
  assert.equal(tree.id, 'organism.website-header');
  assert.ok(tree.children.length >= 2);
});

test('templates docs creates a reviewed Markdown plan from JSON', async () => {
  const root = await mkdtemp(join(tmpdir(), 'component-template-docs-'));
  const outcome = await executeOperation(
    { command: 'templates docs', args: [], options: {} },
    { root, frameworkRoot },
  );
  assert.equal(outcome.status, 'planned');
  assert.ok(outcome.data.changes.some(change => change.path.endsWith('component-library/README.md')));
  assert.ok(outcome.data.changes.length >= 40);
});

test('templates instantiate uses the canonical project model and file-plan boundary', async () => {
  const root = await mkdtemp(join(tmpdir(), 'component-template-instantiate-'));
  await writeFile(join(root, 'project.json'), documentText(newDocument('Template test')));
  const preview = await executeOperation(
    { command: 'templates instantiate', args: ['organism.data-table'], options: { project: 'project.json' } },
    { root, frameworkRoot },
  );
  assert.equal(preview.status, 'planned');
  const applied = await executeOperation(
    { command: 'templates instantiate', args: ['organism.data-table'], options: { project: 'project.json', apply: preview.data.planHash } },
    { root, frameworkRoot },
  );
  assert.equal(applied.status, 'applied');
  const document = openDocument(JSON.parse(await readFile(join(root, 'project.json'), 'utf8')));
  assert.ok(document.design.library.some(entry => entry.templateId === 'organism.data-table'));
});


test('plugins can contribute inert templates through the shared catalog', async () => {
  const contributed = pluginComponentTemplates([{
    manifest: { id: 'template-fixture', name: 'Template Fixture', version: '1.0.0' },
    config: { enabled: true },
    componentTemplates: [{
      schemaVersion: 1,
      id: 'atom.plugin-chip',
      name: 'Plugin Chip',
      version: '1.0.0',
      templateType: 'component',
      atomicLevel: 'atom',
      category: 'Data display',
      description: 'Fixture template contributed by a Workbench plugin.',
      tags: ['plugin', 'chip'],
      recommendedFor: ['webapp'],
      useWhen: ['A plugin needs a reusable compact label.'],
      avoidWhen: ['A plain text label is enough.'],
      capabilities: ['status'],
      states: ['default', 'disabled'],
      props: [],
      events: [],
      children: [],
      slots: [],
      design: { kind: 'catalog', entryId: 'u-badge' },
      accessibility: {
        notes: 'Expose readable text and sufficient contrast.',
        keyboard: ['No keyboard interaction is required for a passive chip.'],
        aria: ['Use visible text as the accessible name.'],
      },
    }],
  }]);
  const entries = await loadComponentTemplates(frameworkRoot, frameworkRoot, contributed);
  assert.equal(entries.find(entry => entry.template.id === 'atom.plugin-chip')?.origin, 'plugin');
});
