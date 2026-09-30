import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { projectFixture } from '../fixtures/application-docs/fixture.mjs';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { parseMarkdown, renderMarkdown } from '../../scripts/application-docs/adapters/markdown.ts';
import { documentationDigest as digest } from '../../scripts/application-docs/adapters/filesystem.ts';
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
const run = (context, args) => executeOperation(parseCliArguments(args), context);
async function directory(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'docs-safety-')));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
async function write(path, value) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); }
async function fixture(t) {
  const root = await directory(t), context = { root, frameworkRoot, inputText: JSON.stringify(projectFixture().project) };
  const outcome = await run(context, ['setup', '--input', '-', '--yes']);
  assert.equal(outcome.status, 'applied', JSON.stringify(outcome)); delete context.inputText; return context;
}
async function snapshot(root) {
  const files = {};
  async function visit(folder = '') {
    for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
      const path = folder ? folder + '/' + entry.name : entry.name;
      if (entry.isDirectory()) await visit(path); else files[path] = digest(await readFile(join(root, path)));
    }
  }
  await visit(); return files;
}
async function exportDocs(context) {
  const outcome = await run(context, ['docs', 'export', '--yes']);
  assert.equal(outcome.status, 'applied', JSON.stringify(outcome));
  return JSON.parse(await readFile(join(context.root, 'design/docs-index.json'), 'utf8'));
}
const pageEntry = index => Object.entries(index.entries).find(([, value]) => value.baseline.type === 'page');
async function editDoc(context, path, edit) {
  const document = parseMarkdown(await readFile(join(context.root, path), 'utf8'));
  const entity = structuredClone(document.entity); edit(entity);
  await writeFile(join(context.root, path), renderMarkdown(entity, document));
}

test('hidden documentation roots and per-type paths fail before writing unreadable bindings', async t => {
  const ctx = await fixture(t), before = await snapshot(ctx.root);
  assert.equal((await run(ctx, ['docs', 'export', '--out', 'docs/.hidden', '--yes'])).status, 'failed');
  assert.deepEqual(await snapshot(ctx.root), before);
  await write(join(ctx.root, 'configs/user-settings.json'), JSON.stringify({ schemaVersion: 1, documentation: { paths: { pages: 'docs/.private/pages' } } }));
  const configured = await snapshot(ctx.root);
  assert.equal((await run(ctx, ['docs', 'export', '--yes'])).status, 'failed');
  assert.deepEqual(await snapshot(ctx.root), configured);
});

test('single-file import cannot rebind a copied identity while the original document still exists', async t => {
  const ctx = await fixture(t), index = await exportDocs(ctx), [, entry] = pageEntry(index);
  const copy = 'docs/application/copied-page.md';
  await write(join(ctx.root, copy), await readFile(join(ctx.root, entry.path)));
  const before = await snapshot(ctx.root);
  const outcome = await run(ctx, ['docs', 'import', copy, '--yes']);
  assert.equal(outcome.status, 'blocked', JSON.stringify(outcome));
  assert.deepEqual(await snapshot(ctx.root), before);
});

for (const kind of ['changed', 'foreign', 'matching']) test(`excluded existing ${kind} document still receives ownership and conflict review`, async t => {
  const ctx = await fixture(t), index = await exportDocs(ctx), [, entry] = pageEntry(index);
  if (kind !== 'matching') await editDoc(ctx, entry.path, entity => {
    if (kind === 'changed') entity.title = 'A human decision not yet imported';
    else entity.project = 'another-project';
  });
  // No trusted baseline remains; include rules must not authorize overwrites.
  await rm(join(ctx.root, 'design/docs-index.json'));
  await rm(join(ctx.root, 'docs/application/generated/index.md'));
  await writeFile(join(ctx.root, 'configs/user-settings.json'), JSON.stringify({ schemaVersion: 1, documentation: { include: [] } }));
  const before = await snapshot(ctx.root), original = await readFile(join(ctx.root, entry.path));
  const outcome = await run(ctx, ['docs', 'export', '--yes']);
  assert.equal(outcome.status, kind === 'matching' ? 'applied' : 'blocked', JSON.stringify(outcome));
  assert.deepEqual(await readFile(join(ctx.root, entry.path)), original);
  if (kind !== 'matching') assert.deepEqual(await snapshot(ctx.root), before);
});

test('the persisted index cannot bind two identities to one path', async t => {
  const ctx = await fixture(t), index = await exportDocs(ctx), entries = Object.values(index.entries);
  entries[1].path = entries[0].path;
  await writeFile(join(ctx.root, 'design/docs-index.json'), JSON.stringify(index));
  const before = await snapshot(ctx.root);
  for (const command of ['status', 'validate', 'export']) {
    const outcome = await run(ctx, ['docs', command, '--yes']);
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.diagnostics[0].code, 'DOCS_INDEX');
  }
  assert.deepEqual(await snapshot(ctx.root), before);
});

test('preservation and deletion preferences reject incorrectly typed safety switches', async t => {
  const ctx = await fixture(t);
  for (const preferences of [{ preserveAuthoredContent: 'yes' }, { deleteMissing: 'false' }, { preserveAuthoredContent: 1 }, { deleteMissing: null }]) {
    await write(join(ctx.root, 'configs/user-settings.json'), JSON.stringify({ schemaVersion: 1, documentation: preferences }));
    const before = await snapshot(ctx.root), outcome = await run(ctx, ['docs', 'export', '--yes']);
    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.diagnostics[0].code, 'DOCS_SETTINGS');
    assert.deepEqual(await snapshot(ctx.root), before);
  }
});

test('non-regular documentation inputs are rejected before a blocking file open', async t => {
  const root = await directory(t), input = join(root, 'non-regular.md');
  if (process.platform === 'win32') await mkdir(input);
  else {
    const fifo = spawnSync('mkfifo', [input], { encoding: 'utf8', timeout: 3000 });
    assert.ifError(fifo.error); assert.equal(fifo.status, 0, fifo.stderr);
  }
  const reader = new URL('../../scripts/application-docs/adapters/filesystem.ts', import.meta.url).href;
  const code = `import {readBytes} from ${JSON.stringify(reader)};
    try { await readBytes(${JSON.stringify(input)}); process.exitCode = 2; }
    catch (error) { if (error.code !== 'DOCS_LIMIT') throw error; console.log(error.code); }`;
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', code], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), 'DOCS_LIMIT');
});

test('documentation digest matches the shared sha256 implementation for exact bytes', async () => {
  const { sha256 } = await import('../../scripts/shared/hash.mjs');
  const { documentationDigest } = await import('../../scripts/application-docs/adapters/filesystem.ts');
  for (const value of ['literal text with UTF-8 café', Buffer.from([0, 255, 16, 32])]) {
    assert.equal(documentationDigest(value), sha256(value));
  }
});
