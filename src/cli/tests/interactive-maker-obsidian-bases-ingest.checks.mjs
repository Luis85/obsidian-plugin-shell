import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadBase, noteTags, plainYaml, resolveVault, scanVault } from '../adapters/obsidian-base.ts';
import { executeOperation } from '../adapters/framework/operations.ts';
import { descriptor } from '../adapters/framework/catalog.ts';
import { commandHelp } from '../adapters/framework/help-text.ts';
import { newDocument } from '../domain/document.ts';
import { runOperations } from '../application/operations.ts';
import { projectModel } from '../compiler/emitters/model.ts';
import { readBase } from '../domain/obsidian-base.ts';

const repository = resolve(import.meta.dirname, '../../..');
const code = async pending => { try { await pending; return 'ok'; } catch (error) { return error.code; } };
const BASE = `filters:
  and:
    - file.inFolder("Library")
    - '!file.hasTag("archived")'
formulas:
  stars: 'if(note.rating >= 4, "★★", "★")'
properties:
  note.title:
    displayName: Title
views:
  - type: table
    name: Shelf
    order: [file.name, title, formula.stars, file.tags]
    sort:
      - property: note.rating
        direction: DESC
  - type: cards
    name: Recent
    filters: file.mtime > 0
`;
/** Runs `check` against a fresh vault fixture and always removes it (works under node:test and Vitest). */
async function withVault(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'bases vault-')));
  try { await check(await fixture(root)); } finally { await rm(root, { recursive: true, force: true }); }
}
async function fixture(root) {
  const put = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  await put('Collections/Books.base', BASE);
  await put('Library/Dune.md', '---\ntitle: Dune\nrating: 5\ntags: [sci-fi]\npublished: 1965-08-01\n---\nA desert planet. #classic\n```\n#not-a-tag\n```\n');
  await put('Library/Emma.md', '---\ntitle: Emma\nrating: 3\n---\nInline `#code` is not a tag.\n');
  await put('Library/Old.md', '---\ntitle: Old\ntags: archived\n---\n');
  await put('Library/Broken.md', '---\ntitle: [unclosed\n---\nBody #broken\n');
  await put('Library/Plain.md', 'No frontmatter, just #plain text.');
  await put('Library/Nested/Deep.md', '---\ntitle: Deep\nrating: 4\n---\n');
  await put('Library/.trash/Gone.md', '---\ntitle: Gone\nrating: 5\n---\n');
  await put('Library/node_modules/pkg/README.md', '---\ntitle: Dependency\n---\n');
  await put('Library/cover.png', 'binary');
  await put('Elsewhere/Outside.md', '---\ntitle: Outside\nrating: 5\n---\n');
  // A junction needs no Windows symlink privilege and is still reported as a link.
  await symlink(join(root, 'Elsewhere'), join(root, 'Library/Linked'), 'junction');
  return { root, put };
}

test('[BASES-INGEST-01] plain YAML rejects aliases, tags, directives and non-JSON values; tags come from frontmatter and prose only', () => {
  assert.deepEqual(plainYaml('a: 1\nb: [x, "y"]\nwhen: 2026-01-02\n', 'ok.base'), { a: 1, b: ['x', 'y'], when: '2026-01-02' });
  assert.equal(plainYaml('', 'empty.base'), null);
  for (const source of ['a: &x 1\nb: *x\n', 'a: !!str 1\n', '%YAML 1.2\n---\na: 1\n', 'a: 1\na: 2\n', 'a: [\n', '? [a]\n: 1\n'])
    assert.throws(() => plainYaml(source, 'bad.base'), error => error.code === 'BASE_YAML', source);
  assert.deepEqual(noteTags({ tags: ['#one', 'two'], tag: 'three, four' }, 'Text #five and #2026 and (#six) `#code` and mid#word\n```\n#fenced\n```'), ['five', 'four', 'one', 'six', 'three', 'two']);
});

test('[BASES-INGEST-02] the vault scan reads only the required folder, skips hidden, dependency and linked folders and keeps invalid frontmatter visible', () => withVault(async ({ root }) => {
  const loaded = await loadBase(root, root, 'Collections/Books.base');
  assert.equal(loaded.source.path, 'Collections/Books.base');
  assert.match(loaded.source.sha256, /^[a-f0-9]{64}$/);
  const scan = await scanVault(root, loaded.definition);
  assert.deepEqual(scan.notes.map(note => note.path), ['Library/Broken.md', 'Library/Dune.md', 'Library/Emma.md', 'Library/Nested/Deep.md', 'Library/Old.md', 'Library/Plain.md']);
  assert.deepEqual(scan.skipped, { links: ['Library/Linked'], invalidFrontmatter: ['Library/Broken.md'] });
  assert.deepEqual(scan.notes[1].tags, ['classic', 'sci-fi']);
  assert.deepEqual(scan.notes[0].properties, {});
  assert.equal(scan.scanned.folder, 'Library');
  assert.equal(scan.scanned.notes, 6);
  const inFolder = folder => ({ ...loaded.definition, filters: readBase({ filters: `file.inFolder("${folder}")`, views: [{ name: 'V' }] }).filters });
  assert.deepEqual((await scanVault(root, inFolder('Nowhere'))).notes, []);
  assert.equal(await code(scanVault(root, inFolder('.obsidian'))), 'BASE_PATH');
  assert.equal(await code(scanVault(root, inFolder('Library/../Elsewhere'))), 'BASE_PATH');
}));

test('[BASES-INGEST-03] base paths stay inside the vault and only .base files are read', () => withVault(async ({ root, put }) => {
  assert.equal(await code(loadBase(root, root, undefined)), 'BASE_PATH');
  assert.equal(await code(loadBase(root, root, 'Library/Dune.md')), 'BASE_PATH');
  assert.equal(await code(loadBase(root, join(root, 'Library'), 'Collections/Books.base')), 'BASE_PATH');
  assert.equal(await code(resolveVault(root, 'missing-folder')), 'BASE_VAULT');
  assert.equal(await resolveVault(root, undefined), root);
  await put('Collections/Alias.base', 'views: &v\n  - name: A\nother: *v\n');
  assert.equal(await code(loadBase(root, root, 'Collections/Alias.base')), 'BASE_YAML');
}));

test('[BASES-INGEST-04] base views and base ingest return a file-collection config with records through the CLI envelope', () => withVault(async ({ root, put }) => {
  const context = { root, frameworkRoot: repository };
  const views = await executeOperation({ command: 'base views', args: ['Collections/Books.base'], options: {} }, context);
  assert.equal(views.status, 'ok');
  assert.deepEqual(views.data.views.map(view => [view.name, view.supported]), [['Shelf', true], ['Recent', false]]);
  assert.match(views.data.views[1].issues[0], /timestamps/);
  assert.deepEqual(views.data.formulas, ['stars']);
  const ingest = await executeOperation({ command: 'base ingest', args: ['Collections/Books.base'], options: { view: 'Shelf' } }, context);
  assert.equal(ingest.status, 'ok');
  assert.deepEqual(ingest.data.records.map(record => record.values), [
    { 'file.name': 'Dune.md', 'note.title': 'Dune', 'formula.stars': '★★', 'file.tags': ['classic', 'sci-fi'] },
    { 'file.name': 'Deep.md', 'note.title': 'Deep', 'formula.stars': '★★', 'file.tags': [] },
    { 'file.name': 'Emma.md', 'note.title': 'Emma', 'formula.stars': '★', 'file.tags': [] },
    { 'file.name': 'Broken.md', 'note.title': null, 'formula.stars': '★', 'file.tags': ['broken'] },
    { 'file.name': 'Plain.md', 'note.title': null, 'formula.stars': '★', 'file.tags': ['plain'] }]);
  assert.deepEqual(ingest.data.records[0].properties, { title: 'Dune', rating: 5, tags: ['sci-fi'], published: '1965-08-01' });
  assert.deepEqual(ingest.data.collection.fields.map(field => [field.property, field.displayName, field.type]),
    [['file.name', 'name', 'text'], ['note.title', 'Title', 'text'], ['formula.stars', 'stars', 'text'], ['file.tags', 'tags', 'list']]);
  assert.deepEqual([ingest.data.summary.matched, ingest.data.summary.returned, ingest.data.summary.folder], [5, 5, 'Library']);
  const refused = await executeOperation({ command: 'base ingest', args: ['Collections/Books.base'], options: { view: 'Recent' } }, context);
  assert.deepEqual([refused.status, refused.diagnostics[0].code], ['failed', 'BASE_VIEW_UNSUPPORTED']);
  const unknown = await executeOperation({ command: 'base ingest', args: ['Collections/Books.base'], options: { view: 'Nope', vault: '.' } }, context);
  assert.deepEqual([unknown.diagnostics[0].code, unknown.diagnostics[0].message], ['BASE_VIEW_UNKNOWN', 'No view "Nope". Views: Shelf, Recent.']);
  const outside = await executeOperation({ command: 'base views', args: ['../x.base'], options: {} }, context);
  assert.equal(outside.diagnostics[0].code, 'BASE_PATH');
  await put('Huge.base', `views:\n  - name: V\n# ${'x'.repeat(300_000)}\n`);
  const huge = await executeOperation({ command: 'base views', args: ['Huge.base'], options: {} }, context);
  assert.equal(huge.diagnostics[0].code, 'INPUT_LIMIT', 'file-system limits keep their own code');
}));

const BACKLOG = `filters:
  and:
    - 'file.inFolder("requirements")'
    - 'note.type == "PBI"'
formulas:
  accepted: 'note.status == "done" || note.status == "shipped"'
  blocked: '!!note.blocked_reason'
properties:
  note.title:
    displayName: Use case
views:
  - type: table
    name: Backlog
    order: [file.name, note.title, note.rank, formula.accepted, formula.blocked]
    sort:
      - property: note.rank
        direction: ASC
    summaries:
      note.rank: Sum
`;
test('[BASES-INGEST-05] the commands are read-only and documented, and a backlog-style base (like docs/requirements/MVP.base) ingests in rank order', () => withVault(async ({ root, put }) => {
  for (const id of ['base views', 'base ingest']) {
    assert.equal(descriptor(id).effect, 'read');
    const help = commandHelp(descriptor(id));
    assert.equal(help.group, 'vault');
    assert.ok(help.examples.length >= 2 && help.usage.includes('<file.base>'));
    assert.match(help.optionHelp.vault.description, /Vault folder/);
  }
  assert.match(commandHelp(descriptor('base ingest')).optionHelp.view.description, /\.base view/);
  await put('requirements/MVP.base', BACKLOG);
  await put('requirements/PBI-2.md', '---\ntype: PBI\ntitle: Second\nrank: 2\nstatus: shipped\n---\n');
  await put('requirements/PBI-1.md', '---\ntype: PBI\ntitle: First\nrank: 1\nstatus: new\nblocked_reason: waits on review\n---\n');
  await put('requirements/README.md', '---\ntype: guide\ntitle: Not a PBI\n---\n');
  const backlog = await executeOperation({ command: 'base ingest', args: ['requirements/MVP.base'], options: { view: 'Backlog' } }, { root, frameworkRoot: repository });
  assert.equal(backlog.status, 'ok');
  assert.deepEqual(backlog.data.records.map(record => record.values), [
    { 'file.name': 'PBI-1.md', 'note.title': 'First', 'note.rank': 1, 'formula.accepted': false, 'formula.blocked': true },
    { 'file.name': 'PBI-2.md', 'note.title': 'Second', 'note.rank': 2, 'formula.accepted': true, 'formula.blocked': false }]);
  assert.equal(backlog.data.collection.fields.find(field => field.property === 'note.title').displayName, 'Use case');
  const views = await executeOperation({ command: 'base views', args: ['requirements/MVP.base'], options: {} }, { root, frameworkRoot: repository });
  assert.deepEqual(views.data.views[0].ignored, ['summaries']);
}));

function collectionDocument(base) {
  const { document } = runOperations(newDocument('Library'), [
    { op: 'page.add', title: 'Home' },
    { op: 'entity.add', title: 'Book', as: 'book' },
    { op: 'entity.properties', id: '@book', properties: [{ key: 'title', type: 'text', required: true }] },
    { op: 'collection.add', title: 'Books', path: 'Library', entity: '@book', as: 'books' },
  ]);
  if (base !== undefined) document.design.dataSources.sources[0].base = base;
  return document;
}
async function conceptValidator() {
  const files = ['vault-project.js', 'data-source-model.js'].map(name => readFile(join(repository, 'src/companion/app', name), 'utf8'));
  const [vaultProject, model] = await Promise.all(files);
  const helper = vaultProject.split('\n').find(line => line.startsWith('function validVaultRelativePath('));
  const context = vm.createContext({});
  vm.runInContext(`${helper}\nfunction tdValidSettings() { return true; }\n${model}\nthis.dataSourcesShape = dataSourcesShape;`, context);
  return value => context.dataSourcesShape(JSON.parse(JSON.stringify(value)));
}

test('[BASES-INGEST-06] a Collection may name its .base file and view; the concept and the compiler accept and refuse the same shapes', async () => {
  const shape = await conceptValidator();
  const accepted = collectionDocument({ path: 'Collections/Books.base', view: 'Shelf' });
  assert.equal(shape(accepted.design.dataSources), true);
  assert.equal(projectModel(accepted).sources[0].contract.base.view, 'Shelf');
  assert.equal(shape(collectionDocument().design.dataSources), true);
  for (const base of [{ path: 'Books.md', view: 'Shelf' }, { path: '.hidden/Books.base', view: 'Shelf' }, { path: '../Books.base', view: 'Shelf' }, { path: 'Books.base', view: ' Shelf' },
    { path: 'Books.base', view: '' }, { path: 'Books.base', view: 'Shelf', extra: true }, { path: 'Books.base' }]) {
    const document = collectionDocument(base);
    assert.equal(shape(document.design.dataSources), false, JSON.stringify(base));
    assert.throws(() => projectModel(document), /GENERATOR_INVALID: (?:Collection base|Expected bounded text)/, JSON.stringify(base));
  }
  const api = collectionDocument();
  api.design.dataSources.sources.push({ ...api.design.dataSources.sources[0], id: 'ds-source-99', slug: 'remote', kind: 'api', locator: '', collectionPath: undefined, entity: undefined, operations: [], base: { path: 'Books.base', view: 'Shelf' } });
  delete api.design.dataSources.sources[1].collectionPath; delete api.design.dataSources.sources[1].entity;
  assert.equal(shape(api.design.dataSources), false);
  assert.throws(() => projectModel(api), /Only a Collection can be configured by an Obsidian \.base file/);
});
