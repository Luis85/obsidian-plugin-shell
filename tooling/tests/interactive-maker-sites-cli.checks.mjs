import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { executeOperation } from '../../src/cli/adapters/framework/operations.ts';
import { inspectWorkflow } from '../quality/check-repository.mjs';
import { fileSymlink } from '../../tests/support/file-symlink.mjs';

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
    const config = await read('src/content.config.ts'), library = await read('src/lib/collections.ts'), snapshot = await read('src/lib/snapshot.ts');
    assert.match(config, /import\.meta\.glob\('\.\/data\/collections\/\*\.collection\.json'\)/);
    assert.match(library, /import\.meta\.glob<unknown>\('\.\.\/data\/collections\/\*\.collection\.json'/);
    for (const text of [config, library]) { assert.doesNotMatch(text, /properties|\*\.json'/); assert.match(text, /checkSnapshot(?:<\w+>)?\(/); }
    assert.match(snapshot, /SNAPSHOT_SCHEMA = 2;/);
    assert.match(snapshot, /GENERATED_BY = 'node bin\/app site collections';/);
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

const snapshotFile = name => `projects/acme/src/data/collections/${name}.collection.json`;
test('[SITES-CLI-03] site collections writes deterministic snapshots of the view columns only, in view order, and replaces only its own files', () => withRoot(async ({ root, put, run }) => {
  assert.equal((await run('site new', ['projects/acme'], { template: 'product-page', yes: true })).status, 'applied');
  const empty = await run('site collections', ['projects/acme'], {});
  assert.deepEqual([empty.status, empty.data.changes, empty.data.summary.collections], ['planned', [], []]);
  await put('vault/Features/Search.md', '---\nsummary: Finds notes\nrank: 1\nowner: private@example.invalid\n---\nSecret body\n');
  await listCollections(root, [features]);
  const planned = await run('site collections', ['projects/acme'], {});
  assert.deepEqual(planned.data.changes.map(change => [change.path, change.status]), [[snapshotFile('features'), 'create']]);
  assert.equal((await run('site collections', ['projects/acme'], { apply: planned.data.planHash })).status, 'applied');
  const path = join(root, snapshotFile('features')), first = await readFile(path, 'utf8');
  const snapshot = JSON.parse(first);
  assert.deepEqual([snapshot.schemaVersion, snapshot.generatedBy, snapshot.collection.base.path, snapshot.collection.view], [2, 'node bin/app site collections', 'Site/Features.base', { name: 'Cards', type: 'cards' }]);
  assert.deepEqual(snapshot.collection.fields.map(field => [field.property, field.displayName, field.type]), [['file.name', 'name', 'text'], ['note.summary', 'Summary', 'text'], ['note.rank', 'rank', 'number']]);
  assert.deepEqual(snapshot.records, [
    { path: 'Features/Search.md', values: { 'file.name': 'Search.md', 'note.summary': 'Finds notes', 'note.rank': 1 } },
    { path: 'Features/Sync.md', values: { 'file.name': 'Sync.md', 'note.summary': 'Syncs offline', 'note.rank': 2 } }]);
  assert.ok(snapshot.records.every(record => !('properties' in record)), 'no frontmatter beyond the view columns');
  assert.doesNotMatch(first, /private@example|Secret body|"owner"/);
  assert.equal((await run('site collections', ['projects/acme'], { yes: true })).status, 'unchanged');
  assert.equal(await readFile(path, 'utf8'), first, 'the same notes give the same bytes');
  await put('projects/acme/src/data/collections/notes.json', '{"mine": true}\n');
  await listCollections(root, []);
  const pruned = await run('site collections', ['projects/acme'], { yes: true });
  assert.deepEqual([pruned.data.summary.removed, pruned.data.summary.kept], [[snapshotFile('features')], ['projects/acme/src/data/collections/notes.json']]);
  assert.deepEqual((await readdir(join(root, 'projects/acme/src/data/collections'))).sort(), ['README.md', 'notes.json']);
  await put(snapshotFile('notes'), '{"mine": true}\n');
  await listCollections(root, [{ ...features, name: 'notes' }]);
  const blocked = await run('site collections', ['projects/acme'], {});
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.data.conflicts[0], /notes\.collection\.json was not written by site collections/);
  assert.equal(failure(await run('site collections', ['projects/acme'], { yes: true })), 'failed:PLAN_CONFLICT');
  assert.equal(await readFile(join(root, snapshotFile('notes')), 'utf8'), '{"mine": true}\n');
  await listCollections(root, []);
  const foreign = await run('site collections', ['projects/acme'], {});
  assert.equal(foreign.status, 'blocked', 'a foreign *.collection.json the site would load is never kept silently');
  assert.match(foreign.data.conflicts[0], /notes\.collection\.json was not written by site collections/);
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

test('[SITES-CLI-05] the templates are read only from plain, bounded .tmpl files of the installed copy, and an overlay file replaces the base file', t => withRoot(async ({ root, put, run }) => {
  const fake = join(root, 'framework');
  assert.equal(failure(await run('site templates', [], {}, fake)), 'failed:SITE_TEMPLATES_MISSING');
  await put('framework/templates/sites/catalog.json', JSON.stringify({ schemaVersion: 1, astro: '7.3.5', templates: [{ id: 'mini', title: 'Mini', summary: 'a test site.', collections: [{ name: 'x', use: 'y' }] }] }));
  assert.equal(failure(await run('site new', ['projects/a'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATES_MISSING');
  await put('framework/templates/sites/base/README.md.tmpl', '# __SITE_TITLE__ (base)\n');
  await put('framework/templates/sites/base/dot-gitignore.tmpl', 'dist/\n');
  await put('framework/templates/sites/mini/README.md.tmpl', '# __SITE_TITLE__ (mini: __SITE_TEMPLATE_SUMMARY__)\n');
  const overlay = await run('site new', ['projects/a'], { template: 'mini', title: 'Tiny', yes: true }, fake);
  assert.equal(overlay.status, 'applied');
  assert.deepEqual(overlay.data.summary.files, ['projects/a/.gitignore', 'projects/a/README.md', 'projects/a/workbench.project.json']);
  assert.deepEqual(await files(join(root, 'projects/a')), ['.gitignore', 'README.md', 'workbench.project.json']);
  assert.equal(await readFile(join(root, 'projects/a/README.md'), 'utf8'), '# Tiny (mini: a test site.)\n', 'the overlay replaced the base README and was rendered');
  assert.equal(await readFile(join(root, 'projects/a/.gitignore'), 'utf8'), 'dist/\n', 'base files without an overlay are kept');
  assert.deepEqual(JSON.parse(await readFile(join(root, 'projects/a/workbench.project.json'), 'utf8')).site, { template: 'mini', collections: [] });
  await put('framework/templates/sites/mini/notes.txt', 'x');
  assert.equal(failure(await run('site new', ['projects/b'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_FILE');
  await rm(join(fake, 'templates/sites/mini/notes.txt'));
  if (await fileSymlink(t, join(fake, 'templates/sites/base/README.md.tmpl'), join(fake, 'templates/sites/mini/link.md.tmpl'))) {
    assert.equal(failure(await run('site new', ['projects/b'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_FILE');
    await rm(join(fake, 'templates/sites/mini/link.md.tmpl'));
  }
  await put('framework/templates/sites/mini/dot-.tmpl', 'x');
  assert.equal(failure(await run('site new', ['projects/b'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_FILE', 'a template file never renders to "."');
  await rm(join(fake, 'templates/sites/mini/dot-.tmpl'));
  for (let index = 0; index < 200; index++) await put(`framework/templates/sites/mini/many/f${index}.md.tmpl`, 'x');
  assert.equal(failure(await run('site new', ['projects/b'], { template: 'mini' }, fake)), 'failed:SITE_TEMPLATE_LIMIT');
}));

test('[SITES-CLI-06] site new names the projects tooling as next steps only in a checkout that has it', () => withRoot(async ({ put, run }) => {
  const next = async () => (await run('site new', ['projects/acme'], { template: 'documentation' })).data.summary.next.join('\n');
  const elsewhere = await next();
  assert.doesNotMatch(elsewhere, /projects:sync|check:projects/, 'a kit or generated project has no projects tooling');
  assert.match(elsewhere, /copy projects\/acme\/\.github\/workflows\/ci\.yml/);
  await put('scripts/projects/projects.mjs', '');
  const maintainer = await next();
  assert.match(maintainer, /npm run projects:sync\nnpm run check:projects/);
}));

test('[SITES-CLI-07] a reviewed plan is refused when a note, the base or a template changes before --apply', () => withRoot(async ({ root, put, run }) => {
  assert.equal((await run('site new', ['projects/acme'], { template: 'product-page', yes: true })).status, 'applied');
  await listCollections(root, [features]);
  for (const [path, text] of [['vault/Features/Sync.md', '---\nsummary: Syncs everywhere\nrank: 2\n---\n'], ['vault/Site/Features.base', `${FEATURES}# reviewed later\n`]]) {
    const reviewed = await run('site collections', ['projects/acme'], {});
    await put(path, text);
    assert.equal(failure(await run('site collections', ['projects/acme'], { apply: reviewed.data.planHash })), 'failed:PLAN_STALE', path);
    assert.equal(await readdir(join(root, 'projects/acme/src/data/collections')).then(names => names.includes('features.collection.json')), false, `${path}: nothing written`);
  }
  const fake = join(root, 'framework');
  await put('framework/templates/sites/catalog.json', JSON.stringify({ schemaVersion: 1, astro: '7.3.5', templates: [{ id: 'mini', title: 'Mini', summary: 'a test site.', collections: [{ name: 'x', use: 'y' }] }] }));
  await put('framework/templates/sites/base/README.md.tmpl', '# __SITE_TITLE__\n');
  await mkdir(join(fake, 'templates/sites/mini'));
  const reviewed = await run('site new', ['projects/mini'], { template: 'mini' }, fake);
  await put('framework/templates/sites/base/README.md.tmpl', '# __SITE_TITLE__, changed after review\n');
  assert.equal(failure(await run('site new', ['projects/mini'], { template: 'mini', apply: reviewed.data.planHash }, fake)), 'failed:PLAN_STALE');
  assert.deepEqual((await readdir(join(root, 'projects'))).sort(), ['acme'], 'site new wrote nothing');
}));

test('[SITES-CLI-08] edited snapshots are never replaced or removed, the old format is migrated, and views of one base share its scan', () => withRoot(async ({ root, put, run }) => {
  assert.equal((await run('site new', ['projects/acme'], { template: 'documentation', yes: true })).status, 'applied');
  const legacy = JSON.stringify({ schemaVersion: 1, generatedBy: 'node bin/app site collections', collection: {}, records: [{ path: 'a.md', values: {}, properties: { private: true } }] });
  await put('projects/acme/src/data/collections/features.json', legacy);
  await listCollections(root, [features, { ...features, name: 'cards-again' }]);
  const migrated = await run('site collections', ['projects/acme'], { yes: true });
  assert.equal(migrated.status, 'applied');
  assert.deepEqual(migrated.data.summary.removed, ['projects/acme/src/data/collections/features.json'], 'the old-format snapshot written by this command is removed');
  assert.deepEqual(migrated.data.summary.collections.map(item => [item.name, item.records]), [['features', 2], ['cards-again', 2]]);
  const ours = await readFile(join(root, snapshotFile('features')), 'utf8');
  assert.equal(JSON.parse(await readFile(join(root, snapshotFile('cards-again')), 'utf8')).recordsSha256, JSON.parse(ours).recordsSha256, 'one scan, the same records');
  const edited = ours.replace('Finds notes', 'Finds notes (edited)');
  await put(snapshotFile('features'), edited);
  await put('vault/Features/Sync.md', '---\nsummary: Syncs everywhere\nrank: 2\n---\n');
  const replace = await run('site collections', ['projects/acme'], {});
  assert.equal(replace.status, 'blocked');
  assert.match(replace.data.conflicts.join('\n'), /features\.collection\.json was edited by hand: its records no longer match its recordsSha256/);
  await listCollections(root, [{ ...features, name: 'cards-again' }]);
  const remove = await run('site collections', ['projects/acme'], {});
  assert.equal(remove.status, 'blocked', 'an edited snapshot is not removed either');
  assert.ok(!remove.data.summary.removed.includes(snapshotFile('features')));
  assert.equal(failure(await run('site collections', ['projects/acme'], { yes: true })), 'failed:PLAN_CONFLICT');
  assert.equal(await readFile(join(root, snapshotFile('features')), 'utf8'), edited);
  await put(snapshotFile('features'), ours);
  await mkdir(join(root, snapshotFile('folder')));
  const folder = await run('site collections', ['projects/acme'], {});
  assert.deepEqual(folder.data.conflicts, [`${snapshotFile('folder')} was not written by site collections; it is never replaced or removed. Rename the collection or move the file.`], 'a folder the site would glob is never kept silently');
  await rm(join(root, 'projects/acme/src/data/collections'), { recursive: true });
  const fresh = await run('site collections', ['projects/acme'], {});
  assert.deepEqual([fresh.status, fresh.data.changes.map(change => change.status), fresh.data.conflicts], ['planned', ['create'], []], 'a missing snapshot folder is created');
}));
