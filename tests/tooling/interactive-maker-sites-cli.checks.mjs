import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { inspectWorkflow } from '../../scripts/quality/check-repository.mjs';

const repository = resolve(import.meta.dirname, '../..');
const FEATURES = `filters: file.inFolder("Features")
properties:
  note.summary:
    displayName: Summary
views:
  - type: cards
    name: Cards
    order: [file.name, summary, rank]
    sort:
      - property: note.rank
        direction: ASC
  - type: table
    name: Recent
    filters: file.mtime > 0
`;
/** A temporary shell root with a small vault; always removed (works under node:test and Vitest). */
async function withRoot(check) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'site cli-')));
  const put = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  try {
    await put('vault/Site/Features.base', FEATURES);
    await put('vault/Features/Sync.md', '---\nsummary: Syncs offline\nrank: 2\n---\n');
    await put('vault/Features/Search.md', '---\nsummary: Finds notes\nrank: 1\n---\n');
    await put('vault/Elsewhere.md', '---\nsummary: Not a feature\nrank: 0\n---\n');
    await check({ root, put, run: (command, args, options = {}, frameworkRoot = repository) => executeOperation({ command, args, options }, { root, frameworkRoot }) });
  } finally { await rm(root, { recursive: true, force: true }); }
}
const failure = outcome => `${outcome.status}:${outcome.diagnostics?.[0]?.code}`;
async function files(folder, prefix = '') {
  const found = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...await files(join(folder, entry.name), path)); else found.push(path);
  }
  return found.sort();
}

test('[SITES-CLI-01] site new previews a plan, writes exactly it on --apply and refuses a non-empty or out-of-scope target', () => withRoot(async ({ root, put, run }) => {
  const planned = await run('site new', ['projects/acme'], { template: 'product-page', title: 'Acme Widgets' });
  assert.equal(planned.status, 'planned');
  assert.ok(planned.data.changes.every(change => change.status === 'create'));
  assert.deepEqual(await readdir(root), ['vault'], 'a preview writes nothing');
  const applied = await run('site new', ['projects/acme'], { template: 'product-page', title: 'Acme Widgets', apply: planned.data.planHash });
  assert.equal(applied.status, 'applied');
  assert.equal(applied.data.applied.written.length, planned.data.changes.length);
  assert.equal(failure(await run('site new', ['projects/acme'], { template: 'product-page' })), 'failed:TARGET_NOT_EMPTY');
  for (const target of ['../acme', 'projects/Acme', 'projects/a/b', 'src/acme']) assert.equal(failure(await run('site new', [target], { template: 'product-page' })), 'failed:SITE_TARGET', target);
  assert.equal(failure(await run('site new', [], { template: 'product-page' })), 'failed:SITE_TARGET');
  assert.equal(failure(await run('site new', ['projects/x'], {})), 'failed:SITE_TEMPLATE_REQUIRED');
  assert.equal(failure(await run('site new', ['projects/x'], { template: 'blog' })), 'failed:SITE_TEMPLATE_UNKNOWN');
  assert.equal(failure(await run('site new', ['projects/x'], { template: 'documentation', title: 'a\nb' })), 'failed:SITE_TITLE');
  await put('projects/plain', 'a file');
  assert.equal(failure(await run('site new', ['projects/plain'], { template: 'documentation' })), 'failed:TARGET_NOT_DIRECTORY');
  await mkdir(join(root, 'projects/empty'));
  assert.equal((await run('site new', ['projects/empty'], { template: 'documentation' })).status, 'planned', 'an empty folder is a valid target');
  const stale = await run('site new', ['projects/other'], { template: 'documentation', apply: planned.data.planHash });
  assert.equal(failure(stale), 'failed:PLAN_STALE');
}));

test('[SITES-CLI-02] every template renders a standalone site: no .tmpl, no tokens, exact Astro, fixed lock names and a manifest', () => withRoot(async ({ root, run }) => {
  for (const template of ['product-page', 'project-page', 'documentation']) {
    assert.equal((await run('site new', [`projects/${template}-site`], { template, yes: true })).status, 'applied', template);
    const folder = join(root, 'projects', `${template}-site`), list = await files(folder);
    const read = path => readFile(join(folder, path), 'utf8');
    for (const path of ['package.json', 'package-lock.json', '.nvmrc', '.gitignore', 'README.md', 'AGENTS.md', 'astro.config.mjs', 'tsconfig.json', 'src/content.config.ts',
      'src/layouts/SiteLayout.astro', 'src/components/CollectionTable.astro', 'src/components/CollectionCards.astro', 'src/pages/index.astro', '.github/workflows/ci.yml', 'workbench.project.json'])
      assert.ok(list.includes(path), `${template}: ${path}`);
    assert.ok(list.every(path => !path.endsWith('.tmpl') && !path.split('/').some(part => part.startsWith('dot-'))), list.join(', '));
    for (const path of list) assert.doesNotMatch(await read(path), /__SITE_[A-Z_]+__/, path);
    const pkg = JSON.parse(await read('package.json')), lock = JSON.parse(await read('package-lock.json'));
    assert.deepEqual([pkg.name, pkg.dependencies, Object.keys(pkg.scripts)], [`${template}-site`, { astro: '7.3.5' }, ['dev', 'build', 'preview', 'check']]);
    assert.deepEqual([lock.name, lock.packages[''].name, lock.packages['node_modules/astro'].version], [`${template}-site`, `${template}-site`, '7.3.5']);
    assert.equal(await read('.nvmrc'), '24.21.0\n');
    assert.equal(JSON.parse(await read('tsconfig.json')).extends, 'astro/tsconfigs/strict');
    assert.match(await read('src/content.config.ts'), /file\(`src\/data\/collections\/\$\{name\}\.json`, \{ parser: parseSnapshot \}\)/);
    const manifest = JSON.parse(await read('workbench.project.json'));
    assert.deepEqual([manifest.name, manifest.title, manifest.prototypes, manifest.site], [`${template}-site`, template.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ') + ' Site', [], { template, collections: [] }]);
    assert.ok(inspectWorkflow(await read('.github/workflows/ci.yml')).jobs >= 1);
  }
  assert.ok((await files(join(root, 'projects/documentation-site'))).includes('src/pages/reference/[collection].astro'));
}));

const listCollections = async (root, collections) => {
  const path = join(root, 'projects/acme/workbench.project.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...manifest, site: { ...manifest.site, collections } }, null, 2));
};
const features = { name: 'features', base: 'vault/Site/Features.base', view: 'Cards', vault: 'vault' };

test('[SITES-CLI-03] site collections writes deterministic snapshots of each listed view, in view order, and replaces only its own files', () => withRoot(async ({ root, put, run }) => {
  assert.equal((await run('site new', ['projects/acme'], { template: 'product-page', yes: true })).status, 'applied');
  const empty = await run('site collections', ['projects/acme'], {});
  assert.deepEqual([empty.status, empty.data.changes, empty.data.summary.collections], ['planned', [], []]);
  await listCollections(root, [features]);
  const planned = await run('site collections', ['projects/acme'], {});
  assert.deepEqual(planned.data.changes.map(change => [change.path, change.status]), [['projects/acme/src/data/collections/features.json', 'create']]);
  assert.equal((await run('site collections', ['projects/acme'], { apply: planned.data.planHash })).status, 'applied');
  const path = join(root, 'projects/acme/src/data/collections/features.json'), first = await readFile(path, 'utf8');
  const snapshot = JSON.parse(first);
  assert.deepEqual([snapshot.schemaVersion, snapshot.generatedBy, snapshot.collection.base.path, snapshot.collection.view], [1, 'node bin/app site collections', 'Site/Features.base', { name: 'Cards', type: 'cards' }]);
  assert.deepEqual(snapshot.collection.fields.map(field => [field.property, field.displayName, field.type]), [['file.name', 'name', 'text'], ['note.summary', 'Summary', 'text'], ['note.rank', 'rank', 'number']]);
  assert.deepEqual(snapshot.records.map(record => record.path), ['Features/Search.md', 'Features/Sync.md']);
  assert.equal((await run('site collections', ['projects/acme'], { yes: true })).status, 'unchanged');
  assert.equal(await readFile(path, 'utf8'), first, 'the same notes give the same bytes');
  await put('projects/acme/src/data/collections/notes.json', '{"mine": true}\n');
  await listCollections(root, []);
  const pruned = await run('site collections', ['projects/acme'], { yes: true });
  assert.deepEqual([pruned.data.summary.removed, pruned.data.summary.kept], [['projects/acme/src/data/collections/features.json'], ['projects/acme/src/data/collections/notes.json']]);
  assert.deepEqual((await readdir(join(root, 'projects/acme/src/data/collections'))).sort(), ['README.md', 'notes.json']);
  await listCollections(root, [{ ...features, name: 'notes' }]);
  const blocked = await run('site collections', ['projects/acme'], {});
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.data.conflicts[0], /notes\.json exists and was not written by site collections/);
  assert.equal(failure(await run('site collections', ['projects/acme'], { yes: true })), 'failed:PLAN_CONFLICT');
  assert.equal(await readFile(join(root, 'projects/acme/src/data/collections/notes.json'), 'utf8'), '{"mine": true}\n');
}));

test('[SITES-CLI-04] site collections refuses unknown and unsupported views, a missing .base and invalid or missing site manifests', () => withRoot(async ({ root, put, run }) => {
  assert.equal(failure(await run('site collections', ['projects/acme'], {})), 'failed:SITE_PROJECT_MISSING');
  assert.equal((await run('site new', ['projects/acme'], { template: 'documentation', yes: true })).status, 'applied');
  for (const [entry, expected] of [[{ ...features, view: 'Nope' }, 'BASE_VIEW_UNKNOWN'], [{ ...features, view: 'Recent' }, 'BASE_VIEW_UNSUPPORTED'],
    [{ ...features, base: 'vault/Site/Missing.base' }, 'SITE_COLLECTION_BASE_MISSING'], [{ ...features, vault: 'nowhere', base: 'nowhere/a.base' }, 'BASE_VAULT'], [{ ...features, view: '' }, 'SITE_MANIFEST']]) {
    await listCollections(root, [entry]);
    assert.equal(failure(await run('site collections', ['projects/acme'], {})), `failed:${expected}`, expected);
  }
  await put('projects/plain/workbench.project.json', JSON.stringify({ schemaVersion: 1, name: 'plain', title: 'Plain', prototypes: [{ path: 'docs/concepts/x' }] }));
  assert.equal(failure(await run('site collections', ['projects/plain'], {})), 'failed:SITE_NOT_A_SITE');
  assert.equal(failure(await run('site collections', ['elsewhere/acme'], {})), 'failed:SITE_TARGET');
  assert.deepEqual(await files(join(root, 'projects/acme/src/data/collections')), ['README.md'], 'a refused plan writes nothing');
}));

test('[SITES-CLI-05] the templates are read only from plain, bounded .tmpl files of the installed copy', () => withRoot(async ({ root, put, run }) => {
  const fake = join(root, 'framework');
  assert.equal(failure(await run('site templates', [], {}, fake)), 'failed:SITE_TEMPLATES_MISSING');
  await put('framework/templates/sites/catalog.json', JSON.stringify({ schemaVersion: 1, astro: '7.3.5', templates: [{ id: 'mini', title: 'Mini', summary: 'a test site.', collections: [{ name: 'x', use: 'y' }] }] }));
  assert.equal(failure(await run('site new', ['projects/a'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATES_MISSING');
  await put('framework/templates/sites/base/README.md.tmpl', '# __SITE_TITLE__\n');
  await put('framework/templates/sites/mini/README.md.tmpl', '# __SITE_TITLE__ (mini)\n');
  const overlay = await run('site new', ['projects/a'], { template: 'mini', title: 'Tiny' }, fake);
  assert.deepEqual(overlay.data.changes.map(change => change.path), ['projects/a/README.md', 'projects/a/workbench.project.json']);
  assert.equal(overlay.data.summary.files.length, 2);
  await put('framework/templates/sites/mini/notes.txt', 'x');
  assert.equal(failure(await run('site new', ['projects/a'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_FILE');
  await rm(join(fake, 'templates/sites/mini/notes.txt'));
  await symlink(join(fake, 'templates/sites/base/README.md.tmpl'), join(fake, 'templates/sites/mini/link.md.tmpl'));
  assert.equal(failure(await run('site new', ['projects/a'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_FILE');
  await rm(join(fake, 'templates/sites/mini/link.md.tmpl'));
  for (let index = 0; index < 200; index++) await put(`framework/templates/sites/mini/many/f${index}.md.tmpl`, 'x');
  assert.equal(failure(await run('site new', ['projects/a'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_LIMIT');
}));
