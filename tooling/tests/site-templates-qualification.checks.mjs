import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';
import { excludesProjects } from '../projects/workflows.mjs';
import { inspectWorkflow } from '../quality/check-repository.mjs';
import { BUILD_STEPS, collectionName, inspectBuild, parseOptions, PRIVATE, qualifySiteTemplates, RENDERED, USAGE } from '../testing/qualify-site-templates.mjs';

const repository = resolve(import.meta.dirname, '../..');
const script = join(repository, 'tooling/testing/qualify-site-templates.mjs');
async function scratch(t) {
  const folder = await mkdtemp(join(tmpdir(), 'site-qualification-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

test('[SITE-QUALIFY-01] a dry run renders every template with zero and one fixture collection through the shell commands, and plans npm ci and npm run build', async t => {
  const work = join(await scratch(t), 'work');
  const summary = await qualifySiteTemplates({ dryRun: true, keep: true, templates: [], workDir: work, out: null });
  assert.equal(summary.status, 'passed', JSON.stringify(summary.results, null, 2));
  assert.deepEqual(summary.results.map(result => [result.template, result.variant, result.collections]), [
    ['product-page', 'empty', []], ['product-page', 'collection', ['features']], ['project-page', 'empty', []], ['project-page', 'collection', ['roadmap']],
    ['documentation', 'empty', []], ['documentation', 'collection', ['features']]]);
  for (const result of summary.results) {
    assert.deepEqual(result.steps.map(step => [step.name, step.status]), [['render', 'passed'], ['npm ci', 'skipped'], ['npm run build', 'skipped']]);
    assert.deepEqual(result.steps.slice(1).map(step => step.command), ['npm ci --no-fund --no-audit', 'npm run build']);
    const folder = join(work, 'projects', result.site);
    assert.ok((await readdir(folder)).includes('package-lock.json'));
    const snapshots = (await readdir(join(folder, 'src/data/collections'))).filter(name => name.endsWith('.json'));
    assert.deepEqual(snapshots, result.collections.map(name => `${name}.collection.json`));
    for (const name of snapshots) {
      const text = await readFile(join(folder, 'src/data/collections', name), 'utf8'), snapshot = JSON.parse(text);
      assert.deepEqual(snapshot.records.map(record => record.path), ['Features/Search.md', 'Features/Sync.md', 'Features/Export.md']);
      assert.equal(snapshot.records[0].values['note.summary'], RENDERED);
      assert.ok(!text.includes(PRIVATE) && !text.includes('"properties"'), 'the snapshot holds only the view columns');
    }
  }
  const only = await qualifySiteTemplates({ dryRun: true, keep: false, templates: ['documentation'], workDir: null, out: null });
  assert.deepEqual([only.results.length, only.workDir], [2, undefined]);
  await assert.rejects(qualifySiteTemplates({ dryRun: true, keep: false, templates: ['blog'], workDir: null, out: null }), /Unknown template blog\. Templates: product-page, project-page, documentation/);
  await assert.rejects(qualifySiteTemplates({ dryRun: true, keep: false, templates: [], workDir: work, out: null }), /must be empty or absent/);
});

test('[SITE-QUALIFY-02] a build passes only with pages that render the fixture values and never its private frontmatter', async t => {
  const folder = await scratch(t);
  const page = async (path, text) => { await mkdir(dirname(join(folder, 'dist', path)), { recursive: true }); await writeFile(join(folder, 'dist', path), text); };
  assert.deepEqual(await inspectBuild(folder, 'empty'), { pages: 0, issues: ['dist/ holds no HTML page'] });
  await page('index.html', '<h1>Site</h1>');
  assert.deepEqual(await inspectBuild(folder, 'empty'), { pages: 1, issues: [] });
  assert.deepEqual((await inspectBuild(folder, 'collection')).issues, [`no page renders the fixture value "${RENDERED}"`]);
  await page('reference/features/index.html', `<td>${RENDERED}</td><td>${PRIVATE}</td>`);
  assert.deepEqual(await inspectBuild(folder, 'collection'), { pages: 2, issues: [`a page contains the fixture's private frontmatter "${PRIVATE}"`] });
  assert.deepEqual(BUILD_STEPS.map(([name]) => name), ['npm ci', 'npm run build']);
});

test('[SITE-QUALIFY-03] options, collection names and the command line fail closed', async t => {
  assert.deepEqual(parseOptions(['--dry-run', '--template', 'a', '--template', 'b', '--work-dir', 'w', '--keep', '--out', 'o.json']),
    { dryRun: true, keep: true, templates: ['a', 'b'], workDir: 'w', out: 'o.json', help: false });
  assert.match(parseOptions(['--template']).error, /--template needs a value/);
  assert.match(parseOptions(['--out', '--keep']).error, /--out needs a value/);
  assert.match(parseOptions(['--fast']).error, /Unknown option: --fast/);
  assert.deepEqual([collectionName({ collections: [{ name: 'faq' }] }), collectionName({ collections: [{ name: '<any>' }] }), collectionName({ collections: [] })], ['faq', 'features', 'features']);
  const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const help = run(['--help']);
  assert.deepEqual([help.status, help.stdout.trim()], [0, USAGE]);
  assert.equal(run(['--nope']).status, 2);
  const out = join(await scratch(t), 'reports/site-templates.json');
  const dry = run(['--dry-run', '--template', 'product-page', '--out', out]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), JSON.parse(dry.stdout));
  assert.equal(JSON.parse(dry.stdout).results.length, 2);
  const failed = run(['--template', 'blog']);
  assert.deepEqual([failed.status, failed.stderr.trim()], [1, 'Unknown template blog. Templates: product-page, project-page, documentation']);
});

test('[SITE-QUALIFY-04] the site-templates workflow meets the security floor, stays isolated from projects/ and runs the qualification', async () => {
  const text = await readFile(join(repository, '.github/workflows/site-templates.yml'), 'utf8'), data = parse(text);
  assert.equal(inspectWorkflow(text).jobs, 1);
  assert.equal(excludesProjects(text), true);
  for (const event of ['pull_request', 'push']) for (const path of ['templates/sites/**', 'src/cli/domain/site-template.ts', 'src/cli/domain/site-collections.ts', 'src/cli/adapters/site-templates.ts',
    'src/cli/adapters/framework/site-command.ts', 'tooling/testing/qualify-site-templates.mjs', 'tests/fixtures/sites/**', '.github/workflows/site-templates.yml'])
    assert.ok(data.on[event].paths.includes(path), `${event}: ${path}`);
  const job = Object.values(data.jobs)[0];
  assert.deepEqual([job['runs-on'], typeof job['timeout-minutes']], ['ubuntu-24.04', 'number']);
  assert.ok(job.steps.some(step => step.uses === './.github/actions/setup-qualified'));
  assert.ok(job.steps.some(step => /node tooling\/testing\/qualify-site-templates\.mjs/.test(step.run ?? '')));
});
