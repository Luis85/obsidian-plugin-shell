const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, copyFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectFixture } from '../fixtures/application-docs/fixture.mjs';
import { parseCliArguments } from '../../bin/adapters/framework/catalog.ts';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { createFilePlan, applyFilePlan } from '../../scripts/shared/file-plan.ts';
import { parseMarkdown, renderMarkdown } from '../../bin/documentation/adapters/markdown.ts';
import { projectEntities } from '../../bin/documentation/adapters/model.ts';
import { documentationPlan, documentationStatus } from '../../bin/documentation/adapters/plan.ts';
import { journalHook, recoverDocuments } from '../../bin/documentation/adapters/recovery.ts';
import { documentationDigest as digest } from '../../bin/documentation/adapters/filesystem.ts';

// Drives documentation planning, workspace reading and recovery (bin/documentation/adapters) through the public docs commands.
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
async function directory(t) { const dir = await realpath(await mkdtemp(join(tmpdir(), 'maker-docs-'))); after(t, () => rm(dir, { recursive: true, force: true })); return dir; }
async function write(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
const run = (ctx, args) => executeOperation(parseCliArguments(args), ctx);
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
async function fixture(t, project = projectFixture().project) {
  const root = await directory(t), ctx = { root, frameworkRoot, inputText: JSON.stringify(project) };
  const response = await run(ctx, ['setup', '--input', '-', '--yes']);
  assert.equal(response.status, 'applied', JSON.stringify(response)); delete ctx.inputText;
  return ctx;
}
async function exported(t) {
  const ctx = await fixture(t), result = await run(ctx, ['docs', 'export', '--yes']);
  assert.equal(result.status, 'applied', JSON.stringify(result));
  const index = await readJson(join(ctx.root, 'design/docs-index.json'));
  const [key, entry] = Object.entries(index.entries).find(([, item]) => item.baseline.type === 'page');
  return { ctx, index, key, entry };
}
async function blocked(ctx, args, pattern) {
  const result = await run(ctx, args);
  assert.equal(result.status, 'blocked', JSON.stringify(result)); assert.match(JSON.stringify(result.data), pattern);
}

test('export, status and import agree on an unchanged workspace and wikilink navigation', async t => {
  const { ctx } = await exported(t);
  assert.equal((await run(ctx, ['docs', 'import', '--yes'])).status, 'unchanged');
  const status = await documentationStatus(ctx.root, [], true);
  assert.deepEqual([status.conflicts, status.missing, status.coverage.complete], [[], [], true]);
  const settings = await readJson(join(ctx.root, 'configs/user-settings.json')); settings.documentation.linkFormat = 'wikilink';
  await writeFile(join(ctx.root, 'configs/user-settings.json'), JSON.stringify(settings));
  await rm(join(ctx.root, 'docs/application/generated/index.md'));
  const nav = await documentationPlan(ctx.root, [], 'export');
  const index = nav.plan.changes.find(change => change.path === 'docs/application/generated/index.md');
  assert.match(index.content, /- \[\[docs\/application\/pages\/.+\|Overview\]\]/);
  assert.equal(nav.summary.documentation.implicitDeletion, false);
});

test('a markdown edit imports through the reviewed project intake', async t => {
  const { ctx, key, entry } = await exported(t);
  const parsed = parseMarkdown(await readFile(join(ctx.root, entry.path), 'utf8'));
  await writeFile(join(ctx.root, entry.path), renderMarkdown({ ...parsed.entity, title: 'Imported title' }, parsed));
  const preview = await documentationPlan(ctx.root, [entry.path], 'import');
  assert.equal(preview.summary.documentation.projectChanged, true);
  assert.ok(preview.plan.changes.some(change => change.path === 'design/project.json'));
  assert.equal((await run(ctx, ['docs', 'import', entry.path, '--yes'])).status, 'applied');
  assert.equal((await readJson(join(ctx.root, 'design/docs-index.json'))).entries[key].baseline.title, 'Imported title');
});

test('destination, binding and generated-region conflicts block every write', async t => {
  const { ctx, entry } = await exported(t), source = await readFile(join(ctx.root, entry.path), 'utf8');
  await copyFile(join(ctx.root, entry.path), join(ctx.root, 'moved.md'));
  await blocked(ctx, ['docs', 'import', 'moved.md', '--yes'], /previous bound document still exists/);
  await rm(join(ctx.root, 'moved.md'));
  await writeFile(join(ctx.root, entry.path), source + '<!-- shell:generated:start -->\nEdited\n<!-- shell:generated:end -->\n');
  await blocked(ctx, ['docs', 'export', '--yes'], /generated region was edited/);
  await writeFile(join(ctx.root, entry.path), source.replace(/^id: .+$/m, 'id: node-unrelated'));
  await rm(join(ctx.root, 'design/docs-index.json'));
  await blocked(ctx, ['docs', 'export', '--yes'], /Destination is an unrelated file/);
});

test('external documents and assets never overwrite differing project files', async t => {
  const { ctx, entry } = await exported(t), external = await directory(t);
  await write(join(external, 'page.md'), (await readFile(join(ctx.root, entry.path), 'utf8')) + '\nExternal prose.\n');
  await blocked(ctx, ['docs', 'import', external, '--yes'], /External input collides/);
  const assets = await directory(t);
  const page = projectEntities(projectFixture().project).find(entity => entity.type === 'page');
  await write(join(assets, 'page.md'), renderMarkdown(page));
  await write(join(assets, 'diagram.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await write(join(ctx.root, 'docs/application/diagram.svg'), '<svg>different</svg>');
  await blocked(ctx, ['docs', 'import', assets, '--yes'], /External note\/asset collides/);
  const notes = await directory(t); await write(join(notes, 'plain.md'), '# Plain note\n');
  assert.equal((await run(ctx, ['docs', 'import', notes, '--yes'])).status, 'failed');
});

test('workspace reading validates the index, resolutions and selected inputs', async t => {
  const { ctx, index, key } = await exported(t), indexPath = join(ctx.root, 'design/docs-index.json');
  const variants = [
    { ...index, project: 'foreign' },
    { ...index, navigation: { 'docs/application/generated/index.md': 'not-a-digest' } },
    { ...index, entries: { [key]: { ...index.entries[key], path: '.hidden/page.md' } } },
    { ...index, entries: { [key]: { ...index.entries[key], generatedHash: 'bad' } } },
    { ...index, entries: { [key]: index.entries[key], 'page:other': { ...index.entries[key] } } },
  ];
  for (const variant of variants) {
    await writeFile(indexPath, JSON.stringify(variant));
    await assert.rejects(documentationStatus(ctx.root, [], false), { code: /DOCS_INDEX|DOCS_PATH/ });
  }
  const twins = Object.entries(index.entries).slice(0, 2);
  await writeFile(indexPath, JSON.stringify({ ...index, entries: Object.fromEntries(twins.map(([name, item]) => [name, { ...item, path: twins[0][1].path }])) }));
  await assert.rejects(documentationStatus(ctx.root, [], false), { code: 'DOCS_INDEX', message: /same documentation path/ });
  await writeFile(indexPath, JSON.stringify(index));
  await assert.rejects(documentationPlan(ctx.root, [], 'import', { resolutions: 'missing.json' }), { code: 'DOCS_RESOLUTIONS' });
  await write(join(ctx.root, 'resolutions.json'), JSON.stringify({ [key + '#/title']: 'both' }));
  await assert.rejects(documentationPlan(ctx.root, [], 'import', { resolutions: 'resolutions.json' }), { code: 'DOCS_RESOLUTIONS' });
  await assert.rejects(documentationStatus(ctx.root, ['missing-folder'], false), { code: 'DOCS_INPUT_MISSING' });
  await rm(join(ctx.root, 'design/project.json'));
  await assert.rejects(documentationStatus(ctx.root, [], false), { code: 'DOCS_PROJECT_REQUIRED' });
});

test('recovery restores preimages, deletes created files and refuses stale or foreign journals', async t => {
  const root = await directory(t), lock = join(root, '.codex-authoring.lock');
  await write(join(root, 'docs/page.md'), 'Before');
  const plan = await createFilePlan(root, [{ path: 'docs/page.md', content: 'After' }, { path: 'docs/new.md', content: 'Created' }]);
  const record = journalHook(plan);
  let journal;
  await assert.rejects(applyFilePlan(plan, { async beforeWrite(change, index) {
    await record(); await record();
    if (index === 1) { journal = await readJson(join(lock, 'docs-journal.json')); throw new Error('Injected stop'); }
  } }), /Injected stop/);
  assert.equal(await readFile(join(root, 'docs/page.md'), 'utf8'), 'Before');
  assert.equal(journal.kind, 'application-docs-recovery'); assert.equal(journal.changes.length, 2);
  await mkdir(lock, { recursive: true });
  await write(join(lock, 'docs-journal.json'), JSON.stringify({ ...journal, pid: 2147483647 }));
  await write(join(root, 'docs/page.md'), 'After'); await write(join(root, 'docs/new.md'), 'Created'); await write(join(lock, 'before-0'), 'Before');
  const preview = await recoverDocuments(root, false);
  assert.equal(preview.status, 'planned'); assert.deepEqual(preview.data.restore.sort(), ['docs/new.md', 'docs/page.md']);
  await assert.rejects(recoverDocuments(root, true, 'f'.repeat(64)), { code: 'DOCS_RECOVERY_STALE' });
  assert.equal((await recoverDocuments(root, true, preview.data.recoveryHash)).status, 'applied');
  assert.equal(await readFile(join(root, 'docs/page.md'), 'utf8'), 'Before');
  assert.ok(!(await readdir(join(root, 'docs'))).includes('new.md')); assert.ok(!(await readdir(root)).includes('.codex-authoring.lock'));
  const broken = async value => { await write(join(lock, 'docs-journal.json'), JSON.stringify(value)); };
  const base = { schemaVersion: 1, kind: 'application-docs-recovery', pid: 2147483647 };
  for (const [value, code] of [[{ ...base, kind: 'other', changes: [] }, 'DOCS_RECOVERY_JOURNAL'],
    [{ ...base, changes: [{ path: 'docs/page.md', index: -1, beforeHash: null, afterHash: null }] }, 'DOCS_RECOVERY_JOURNAL'],
    [{ ...base, changes: [{ path: 'docs/page.md', index: 0, beforeHash: 'bad', afterHash: null }] }, 'DOCS_RECOVERY_JOURNAL'],
    [{ ...base, changes: [{ path: 'docs/page.md', index: 0, beforeHash: digest('x'), afterHash: digest('Before!') }] }, 'DOCS_RECOVERY_CONFLICT'],
    [{ ...base, changes: [{ path: 'docs/page.md', index: 0, beforeHash: digest('x'), afterHash: digest('Before') }] }, 'DOCS_RECOVERY_PREIMAGE'],
    [{ ...base, pid: process.pid, changes: [] }, 'DOCS_RECOVERY_ACTIVE']]) {
    await broken(value); await assert.rejects(recoverDocuments(root, false), { code });
  }
  await rm(lock, { recursive: true }); await assert.rejects(recoverDocuments(root, false), { code: 'DOCS_RECOVERY_MISSING' });
});
