import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { filled, outputPath, readSiteCatalog, record, renderTemplate, selectTemplate, siteManifest, siteProjectName, siteTitle } from '../../bin/domain/site-template.ts';
import { generatedSnapshot, readSiteSection, repositoryPath, siteIssues, snapshotPath, snapshotText, GENERATED_BY } from '../../bin/domain/site-collections.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { descriptor } from '../../bin/adapters/framework/catalog.ts';
import { commandHelp } from '../../bin/adapters/framework/help-text.ts';

const repository = resolve(import.meta.dirname, '../..');
const code = run => { try { run(); return 'ok'; } catch (error) { return error.code; } };
const shipped = JSON.parse(await readFile(resolve(repository, 'templates/sites/catalog.json'), 'utf8'));
const catalog = readSiteCatalog(shipped);
const ids = catalog.templates.map(item => item.id);
const site = { name: 'acme-docs', title: 'Acme Docs', template: selectTemplate(catalog, 'documentation') };

test('[SITES-01] the shipped catalog lists the three templates, and malformed catalogs are refused', () => {
  assert.deepEqual(ids, ['product-page', 'project-page', 'documentation']);
  assert.equal(catalog.astro, '7.3.5');
  assert.ok(catalog.templates.every(item => item.collections.length > 0));
  const template = { id: 'one', title: 'One', summary: 'a site.', collections: [{ name: 'x', use: 'y' }] };
  const broken = [null, [], { schemaVersion: 2, astro: '7', templates: [] }, { schemaVersion: 1, templates: [] }, { schemaVersion: 1, astro: '7', templates: {} },
    { schemaVersion: 1, astro: '7', templates: [template, template] }, { schemaVersion: 1, astro: '7', templates: [{ ...template, id: 'base' }] },
    { schemaVersion: 1, astro: '7', templates: [{ ...template, id: 'Bad' }] }, { schemaVersion: 1, astro: '7', templates: [{ ...template, id: 3 }] },
    { schemaVersion: 1, astro: '7', templates: [{ ...template, title: ' ' }] }, { schemaVersion: 1, astro: '7', templates: [{ ...template, collections: 'x' }] },
    { schemaVersion: 1, astro: '7', templates: [{ ...template, collections: [{ name: 'x' }] }] }, { schemaVersion: 1, astro: '7', templates: [{ ...template, collections: [7] }] }, { schemaVersion: 1, astro: '7', templates: [7] }];
  for (const value of broken) assert.equal(code(() => readSiteCatalog(value)), 'SITE_CATALOG', JSON.stringify(value));
  assert.equal(readSiteCatalog({ schemaVersion: 1, astro: '7', templates: [template] }).templates[0].collections[0].use, 'y');
  assert.equal(code(() => selectTemplate(catalog, undefined)), 'SITE_TEMPLATE_REQUIRED');
  assert.equal(code(() => selectTemplate(catalog, 'blog')), 'SITE_TEMPLATE_UNKNOWN');
  assert.deepEqual([record([]), record(null), record('x'), filled(' '), filled('a')], [null, null, null, false, true]);
});

test('[SITES-02] targets are only projects/<kebab-name>, and titles default to the name in title case', () => {
  assert.equal(siteProjectName('projects/acme-docs'), 'acme-docs');
  assert.equal(siteProjectName('projects/a1/'), 'a1');
  for (const target of [undefined, '', 'projects', 'projects/', 'projects/A', 'projects/a--b', 'projects/a/b', '../projects/a', 'src/a', '/projects/a', 'projects\\a', './projects/a'])
    assert.equal(code(() => siteProjectName(target)), 'SITE_TARGET', String(target));
  assert.equal(siteTitle(undefined, 'acme-product-site'), 'Acme Product Site');
  assert.equal(siteTitle('  Acme — Docs ', 'x'), 'Acme — Docs');
  for (const title of ['', '   ', 'x'.repeat(81), 'a\nb', '<script>', 'a `b`', 'a __SITE_NAME__']) assert.equal(code(() => siteTitle(title, 'x')), 'SITE_TITLE', title);
});

test('[SITES-03] template paths drop .tmpl and map dot-<name>, and rendering replaces every token or fails', () => {
  assert.equal(outputPath('dot-github/workflows/ci.yml.tmpl'), '.github/workflows/ci.yml');
  assert.equal(outputPath('dot-gitignore.tmpl'), '.gitignore');
  assert.equal(outputPath('src/pages/reference/[collection].astro.tmpl'), 'src/pages/reference/[collection].astro');
  for (const path of ['src/index.astro', '.github/ci.yml.tmpl', 'src/.hidden.tmpl']) assert.equal(code(() => outputPath(path)), 'SITE_TEMPLATE_FILE', path);
  const rendered = renderTemplate('README.md.tmpl', '# __SITE_TITLE__ (__SITE_NAME__, __SITE_TEMPLATE__: __SITE_TEMPLATE_TITLE__)\n__SITE_TEMPLATE_SUMMARY__\n__SITE_TEMPLATE_COLLECTIONS__\n', site);
  assert.equal(rendered, `# Acme Docs (acme-docs, documentation: Documentation)\n${site.template.summary}\n- \`<any>\`: ${site.template.collections[0].use}\n`);
  assert.equal(code(() => renderTemplate('x.tmpl', '__SITE_UNKNOWN__', site)), 'SITE_TEMPLATE_TOKEN');
  assert.throws(() => renderTemplate('x.tmpl', 'a __SITE_UNKNOWN__', site), /x\.tmpl: unknown template token __SITE_UNKNOWN__/);
  const manifest = JSON.parse(siteManifest(site));
  assert.deepEqual(manifest, { schemaVersion: 1, name: 'acme-docs', title: 'Acme Docs', summary: 'Documentation website built with Astro from Obsidian Bases collections.', prototypes: [], site: { template: 'documentation', collections: [] } });
});

test('[SITES-04] the site section is validated with every reason, and a valid one is normalized', () => {
  const entry = { name: 'features', base: 'vault/Site/Features.base', view: 'Cards', vault: 'vault' };
  assert.deepEqual(siteIssues({ template: 'product-page', collections: [entry, { ...entry, name: 'faq', vault: undefined }] }, ids), []);
  assert.deepEqual(readSiteSection({ template: 'product-page', collections: [entry, { name: 'faq', base: 'FAQ.base', view: 'All' }] }, ids).collections,
    [entry, { name: 'faq', base: 'FAQ.base', view: 'All', vault: '.' }]);
  assert.deepEqual(siteIssues(null, ids), ['SITE_MANIFEST: site must be an object with template and collections']);
  assert.deepEqual(siteIssues({ template: 'blog' }, ids), ['SITE_TEMPLATE: site.template must be one of product-page, project-page, documentation', 'SITE_COLLECTIONS: site.collections must be a list (it may be empty)']);
  const issues = siteIssues({ template: 'documentation', collections: [7, { name: 'Bad', base: '../x.base', view: ' ', vault: '/abs' }, { ...entry, base: 'other/Features.base' },
    { ...entry, base: 'vault/x.md' }, entry, { ...entry, base: 'vault\\x.base' }, { ...entry, vault: 'vault/../x' }] }, ids).join('\n');
  for (const expected of ['site.collections[0] must be an object', 'site.collections[1].name', 'site.collections[1].base must be a normalized', 'site.collections[1].view', 'site.collections[1].vault must be a normalized',
    'site.collections[2].base must be inside its vault vault', 'site.collections[3].base', 'SITE_COLLECTION_DUPLICATE: site.collections[3].name "features"', 'site.collections[5].base', 'site.collections[6].vault'])
    assert.ok(issues.includes(expected), `${expected} in\n${issues}`);
  assert.equal(code(() => readSiteSection({ template: 'documentation', collections: [7] }, ids)), 'SITE_MANIFEST');
  assert.deepEqual(['.', 'a/b/', 'a//b', './a', '', 7, '/a'].map(repositoryPath), ['.', 'a/b', null, null, null, null, null]);
});

test('[SITES-05] snapshots are deterministic JSON without timestamps, and only generated ones are recognized', () => {
  const collected = { collection: { kind: 'file-collection', fields: [] }, records: [{ path: 'a.md', values: {}, properties: {} }] };
  const text = snapshotText(collected);
  assert.equal(text, snapshotText(structuredClone(collected)));
  assert.deepEqual(Object.keys(JSON.parse(text)), ['schemaVersion', 'generatedBy', 'collection', 'records']);
  assert.ok(text.endsWith('}\n') && !/\d{4}-\d{2}-\d{2}T/.test(text));
  assert.equal(snapshotPath('faq'), 'src/data/collections/faq.json');
  assert.deepEqual([generatedSnapshot(text), generatedSnapshot('{"schemaVersion":1}'), generatedSnapshot('not json'), generatedSnapshot(JSON.stringify({ schemaVersion: 2, generatedBy: GENERATED_BY })), generatedSnapshot('[]')], [true, false, false, false, false]);
});

test('[SITES-06] site templates lists the catalog, and help documents every site command with the catalog template ids', async () => {
  const listed = await executeOperation({ command: 'site templates', args: [], options: {} }, { root: repository, frameworkRoot: repository });
  assert.equal(listed.status, 'ok');
  assert.deepEqual(listed.data.templates.map(item => item.id), ids);
  assert.equal(listed.data.astro, '7.3.5');
  for (const id of ['site templates', 'site new', 'site collections']) {
    const help = commandHelp(descriptor(id));
    assert.equal(help.group, 'sites');
    assert.match(help.usage, new RegExp(`^node bin/app ${id}`));
    assert.ok(help.examples.length >= 1);
  }
  const help = commandHelp(descriptor('site new'));
  assert.deepEqual(help.optionHelp.template.values, ids);
  assert.ok(help.optionHelp.title.description && help.optionHelp.yes && help.optionHelp.apply);
  assert.equal(descriptor('site new').effect, 'plan');
  assert.equal(descriptor('site collections').effect, 'plan');
  const page = await executeOperation({ command: 'help', args: ['site'], options: {} }, { root: repository, frameworkRoot: repository });
  assert.deepEqual(page.data.commands.map(item => item.id), ['site templates', 'site new', 'site collections']);
});
