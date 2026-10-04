import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadComponentTemplates } from '../../bin/adapters/component-template-repository.ts';
import { componentTemplateCoverage, componentTemplateTree } from '../../bin/application/component-template-catalog.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { documentText, newDocument, openDocument } from '../../bin/domain/document.ts';
import { pluginComponentTemplates } from '../../plugins/template-contributions.ts';
import { defaults, identity } from '../../bin/adapters/framework/configuration.ts';
import { extractKit } from './framework-archive-fixture.mjs';

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
  const root = await realpath(await mkdtemp(join(tmpdir(), 'component-template-docs-')));
  const outcome = await executeOperation(
    { command: 'templates docs', args: [], options: {} },
    { root, frameworkRoot },
  );
  assert.equal(outcome.status, 'planned');
  assert.ok(outcome.data.changes.some(change => change.path.endsWith('component-library/README.md')));
  assert.ok(outcome.data.changes.length >= 40);
});

test('templates docs owns only its receipted output and turns edits to other files into conflicts', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'component-template-docs-owned-')));
  const docs = options => executeOperation({ command: 'templates docs', args: [], options }, { root, frameworkRoot });
  const first = await docs({ out: 'docs/library' });
  assert.deepEqual(first.data.conflicts, []);
  assert.ok(first.data.changes.some(change => change.path === 'docs/library/component-library.receipt.json'));
  assert.equal((await docs({ out: 'docs/library', apply: first.data.planHash })).status, 'applied');
  const receipt = JSON.parse(await readFile(join(root, 'docs/library/component-library.receipt.json'), 'utf8'));
  assert.equal(receipt.files['docs/library/README.md'].length, 64);
  assert.equal((await docs({ out: 'docs/library', yes: true })).status, 'unchanged');
  // A generated file edited after generation is preserved as a conflict, never silently regenerated.
  await writeFile(join(root, 'docs/library/README.md'), '# Hand-edited index\n');
  const edited = await docs({ out: 'docs/library' });
  assert.deepEqual(edited.data.conflicts, ['docs/library/README.md']);
  const refused = await docs({ out: 'docs/library', apply: edited.data.planHash });
  assert.equal(refused.diagnostics[0].code, 'PLAN_CONFLICT');
  assert.equal(await readFile(join(root, 'docs/library/README.md'), 'utf8'), '# Hand-edited index\n');
  // A non-generated file at a generated path (no receipt) is a conflict too.
  await mkdir(join(root, 'docs/notes'), { recursive: true });
  await writeFile(join(root, 'docs/notes/README.md'), '# Team notes\n');
  assert.deepEqual((await docs({ out: 'docs/notes' })).data.conflicts, ['docs/notes/README.md']);
  await writeFile(join(root, 'docs/notes/component-library.receipt.json'), '{"schemaVersion":1,"files":{"bin/README.md":"' + 'a'.repeat(64) + '"}}');
  assert.equal((await docs({ out: 'docs/notes' })).diagnostics[0].code, 'TEMPLATE_DOCS_RECEIPT');
  await writeFile(join(root, 'docs/notes/component-library.receipt.json'), 'not json');
  assert.equal((await docs({ out: 'docs/notes' })).diagnostics[0].code, 'TEMPLATE_DOCS_RECEIPT');
});

test('templates docs rejects framework, source and configured project roots as output', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'component-template-docs-roots-')));
  const code = async out => (await executeOperation({ command: 'templates docs', args: [], options: { out } }, { root, frameworkRoot })).diagnostics[0]?.code;
  for (const out of ['bin', 'BIN/docs', 'src/docs', 'scripts', 'configs/templates', 'templates', 'plugins/x', 'tests', 'harness', 'design', 'dist'])
    assert.equal(await code(out), 'TEMPLATE_DOCS_PROTECTED', out);
  for (const out of ['.framework/docs', '../outside', 'node_modules/x']) assert.equal(await code(out), 'TEMPLATE_PATH', out);
  await writeFile(join(root, 'shell.config.json'), JSON.stringify(defaults(identity({ id: 'field-notes', name: 'Field Notes', author: 'Example', version: '0.1.0', description: '' }))));
  const configured = JSON.parse(await readFile(join(root, 'shell.config.json'), 'utf8'));
  configured.paths = { ...configured.paths, codebaseFolder: 'app/source', testsFolder: 'spec' };
  await writeFile(join(root, 'shell.config.json'), JSON.stringify(configured));
  for (const out of ['app/docs', 'spec']) assert.equal(await code(out), 'TEMPLATE_DOCS_PROTECTED', out);
  assert.equal(await code('docs/library'), undefined);
});

test('templates instantiate uses the canonical project model and file-plan boundary', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'component-template-instantiate-')));
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

test('an extracted kit keeps its packaged baseline beside one project template', { timeout: 300000 }, async t => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'component-template-kit-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await extractKit(frameworkRoot, dir);
  const baseline = await loadComponentTemplates(frameworkRoot, frameworkRoot);
  const source = JSON.parse(await readFile(join(frameworkRoot, 'configs/templates/atoms/button.json'), 'utf8'));
  await mkdir(join(dir, 'configs/templates/atoms'), { recursive: true });
  await writeFile(join(dir, 'configs/templates/atoms/kit-probe.json'), JSON.stringify({ ...source, id: 'atom.kit-probe', name: 'Kit Probe' }));
  const entries = await loadComponentTemplates(dir, dir);
  assert.equal(entries.length, baseline.length + 1);
  assert.deepEqual(entries.filter(entry => entry.origin === 'project').map(entry => entry.template.id), ['atom.kit-probe']);
  assert.equal(entries.filter(entry => entry.origin === 'baseline').length, baseline.length);
  // A packaged baseline that no longer matches its kit fingerprint is refused, never silently replaced.
  await writeFile(join(dir, 'bin/template/configs/templates/atoms/button.json'), JSON.stringify({ ...source, name: 'Tampered' }));
  await assert.rejects(loadComponentTemplates(dir, dir), /Kit fingerprint mismatch/);
});
