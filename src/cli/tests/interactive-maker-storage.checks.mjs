import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { newDocument } from '../domain/document.ts';
import { readSnapshot, savePlan, applyPrepared, readData } from '../adapters/storage.ts';
import { packagePlan, outputBoundary } from '../adapters/package-plan.ts';
import { execute, parseArguments } from '../adapters/commands.ts';
import { main } from '../app.ts';
import { fileSymlink } from '../../../tests/support/file-symlink.mjs';
const frameworkRoot = resolve(import.meta.dirname, '../../..');
async function scratch(work) { const root = await mkdtemp(join(await realpath(tmpdir()), 'shell-maker-')); try { await work(root); } finally { await rm(root, { recursive: true, force: true }); } }
const context = root => ({ root, frameworkRoot, input: Readable.from([]) });
test('read-only plans, explicit approval, stale writes and idempotent saves', async () => scratch(async root => {
  const snapshot = await readSnapshot(root, 'design/project.json'); assert.equal(snapshot.document, null);
  const plan = await savePlan(root, 'design/project.json', newDocument('P'), null);
  assert.equal((await applyPrepared(plan)).status, 'planned'); await assert.rejects(() => readFile(join(root, 'design/project.json')));
  await assert.rejects(() => applyPrepared(plan, 'wrong'));
  assert.equal((await applyPrepared(plan, plan.planHash)).status, 'applied');
  const saved = await readSnapshot(root, 'design/project.json');
  const repeat = await savePlan(root, 'design/project.json', saved.document, saved.beforeHash);
  assert.equal((await applyPrepared(repeat, repeat.planHash)).status, 'unchanged');
  await writeFile(join(root, 'design/project.json'), JSON.stringify(newDocument('Other')));
  await assert.rejects(() => applyPrepared(repeat, repeat.planHash), /PLAN_STALE/);
  await assert.rejects(() => savePlan(root, 'design/project.json', saved.document, saved.beforeHash), /Project changed/);
  await assert.rejects(() => readSnapshot(root, '../escape.json'));
  await assert.rejects(() => applyPrepared(plan, undefined, AbortSignal.abort()));
}));
test('package ownership protects edits, removed files, unsafe paths and foreign outputs', async () => scratch(async root => {
  const entries = [{ path: 'README.md', content: 'first\n' }];
  const plan = await packagePlan(root, 'prototype', entries, {}); await applyPrepared(plan, plan.planHash);
  const next = await packagePlan(root, 'prototype', [{ path: 'README.md', content: 'next\n' }], {}); await applyPrepared(next, next.planHash);
  await writeFile(join(root, 'prototype/README.md'), 'User content');
  await assert.rejects(() => packagePlan(root, 'prototype', entries, {}), /Preserve edited/);
  await rm(join(root, 'prototype/README.md'));
  await assert.rejects(() => packagePlan(root, 'prototype', entries, {}), /removed/);
  await mkdir(join(root, 'foreign')); await writeFile(join(root, 'foreign/README.md'), 'User');
  await assert.rejects(() => packagePlan(root, 'foreign', entries, {}), /unowned/);
  await assert.rejects(() => packagePlan(root, '../escape', entries, {}));
  await assert.rejects(() => packagePlan(root, 'prototype', [], {}));
  assert.throws(() => outputBoundary(frameworkRoot, frameworkRoot, 'docs/concepts/nested'));
  outputBoundary(frameworkRoot, frameworkRoot, 'prototypes/new'); outputBoundary(root, frameworkRoot, 'source');
}));
test('every template snapshot root and .framework is a reserved output folder, in any letter case', () => {
  // configs/ and plugins/ are snapshot roots too; Docs/ names docs/ on a case-insensitive file system.
  for (const out of ['configs/nested', 'plugins/new', 'Docs/concepts', 'SRC', '.Framework/x', '.github/out'])
    assert.throws(() => outputBoundary(frameworkRoot, frameworkRoot, out), error => error.code === 'MAKER_OUTPUT', out);
  for (const out of ['generated/configs', 'prototypes/plugins', 'documents']) outputBoundary(frameworkRoot, frameworkRoot, out);
});
test('symlink inputs and malformed receipts are refused', async t => scratch(async root => {
  const path = join(root, 'real.json'); await writeFile(path, JSON.stringify(newDocument('P')));
  if (await fileSymlink(t, path, join(root, 'linked.json'))) await assert.rejects(() => readSnapshot(root, 'linked.json'), /PLAN_SYMLINK: linked.json/);
  await mkdir(join(root, 'out/.maker'), { recursive: true });
  await writeFile(join(root, 'out/.maker/receipt.json'), '{"schemaVersion":99,"files":[]}');
  await assert.rejects(() => packagePlan(root, 'out', [{ path: 'x', content: 'x' }], {}));
  await writeFile(path, '{"__proto__":{}}'); await assert.rejects(() => readData(path));
}));
test('agent transaction can be previewed, applied and inspected with the same command', async () => scratch(async root => {
  const input = { schemaVersion: 1, title: 'Agent sketch', operations: [{ op: 'page.add', title: 'Home', as: 'home' }, { op: 'page.attach', page: '@home', components: [{ title: 'Card' }] }] };
  await writeFile(join(root, 'request.json'), JSON.stringify(input));
  const args = parseArguments(['sketch', '--input', 'request.json', '--json']);
  const planned = await execute(args, context(root)); assert.equal(planned.status, 'planned');
  await execute({ ...args, flags: { ...args.flags, apply: planned.planHash } }, context(root));
  const result = await execute(parseArguments(['sketch', 'show']), context(root)); assert.equal(result.pages[0].title, 'Home');
  const exported = await execute(parseArguments(['sketch', 'export']), context(root)); assert.equal(exported.document.project.name, 'Agent sketch');
  await assert.rejects(() => execute(parseArguments(['sketch']), context(root)), /--input/);
  await assert.rejects(() => execute(parseArguments(['sketch', 'missing']), context(root)));
  assert.ok((await execute(parseArguments(['studio']), context(root))).help);
  assert.ok((await execute(parseArguments(['sketch', 'schema']), context(root))).schema);
}));
test('machine stdin is one JSON envelope, never prompts, and failures are nonzero', async () => scratch(async root => {
  const collect = () => { const chunks = []; return { chunks, stream: new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done(); } }) }; };
  const output = collect(), error = collect();
  const data = { schemaVersion: 1, title: 'P', operations: [{ op: 'page.add', title: 'Home' }] };
  const status = await main(['sketch', '--input', '-', '--root', root, '--json', '--no-interaction'], frameworkRoot, { input: Readable.from([JSON.stringify(data)]), output: output.stream, error: error.stream });
  assert.equal(status, 0); assert.equal(error.chunks.length, 0); assert.equal(JSON.parse(output.chunks.join('')).status, 'planned');
  output.chunks.length = 0;
  assert.equal(await main(['sketch', '--unknown', '--json'], frameworkRoot, { input: Readable.from([]), output: output.stream, error: error.stream }), 1);
  assert.equal(JSON.parse(output.chunks.join('')).diagnostics[0].code, 'MAKER_ARGUMENT');
  for (const argv of [['unknown'], ['sketch', '--root'], ['sketch', '--json', '--json'], ['sketch', 'x', 'y'], ['sketch', '--yes']]) assert.throws(() => parseArguments(argv));
}));
