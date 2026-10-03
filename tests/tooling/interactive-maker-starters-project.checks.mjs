const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { definitionProjectPlan, receiptFile } from '../../scripts/starters/project.ts';
import { validateDefinition } from '../../scripts/starters/validation.ts';
import { code, fileStarter, request, shipped, workspace } from './starters-fixture.mjs';

// Definition-driven project plans (project.ts): starter selection, input values, process selection and the receipt.
// Companion plans read the live template snapshot, so their checks assert only starter-owned values, never template bytes.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const place = root => ({ directory: join(root, 'field-notes'), vault: root, target: 'field-notes' });
const plan = (context, options) => definitionProjectPlan(request('new', ['field-notes'], options), context, place(context.root), context.frameworkRoot);
const content = (planned, path) => planned.plan.changes.find(change => change.path === 'field-notes/' + path).content;

test('a file starter plans its rendered files plus a receipt bound to the definition hash', async () => workspace(async context => {
  const planned = await plan(context, { starter: 'note-pack', name: 'Field & Notes' });
  const bytes = await readFile(join(context.root, 'configs/starters/note-pack.json'));
  const values = { id: 'field-notes', name: 'Field & Notes', count: 2, flag: true };
  assert.deepEqual(planned.plan.changes.map(change => [change.path, change.status]), [['field-notes/field-notes/README.md', 'create'], ['field-notes/package.json', 'create'],
    ['field-notes/tools/hello.mjs', 'create'], ['field-notes/' + receiptFile, 'create']]);
  assert.equal(content(planned, 'field-notes/README.md'), '# Field &amp; Notes\ncount=2 flag=true\n');
  const receipt = JSON.parse(content(planned, receiptFile)), definition = validateDefinition(fileStarter());
  assert.deepEqual(receipt, { schemaVersion: 1, starter: { id: 'note-pack', name: 'Note pack', version: '1.2.3', sha256: sha(bytes) }, values,
    processes: definition.processes.map(process => ({ ...process, steps: process.steps.map(step => ({ ...step, args: step.args.map(arg => arg.replace('{{id}}', 'field-notes')) })) })),
    firstRun: ['again'], nextSteps: ['Open Field & Notes'], files: planned.plan.changes.slice(0, 3).map(change => ({ path: change.path.slice('field-notes/'.length), sha256: change.afterHash })) });
  assert.equal(planned.hash, sha(JSON.stringify({ source: sha(bytes), values, compilerHash: '' })));
  assert.deepEqual(planned.conflicts, []);
  assert.deepEqual(planned.summary, { starter: { id: 'note-pack', name: 'Note pack', version: '1.2.3', sha256: sha(bytes), title: 'Note pack' },
    identity: { id: 'field-notes', name: 'Field & Notes', author: '' }, directory: join(context.root, 'field-notes'), vault: context.root, target: 'field-notes',
    files: 4, acceptanceTodos: 0, warnings: [], recipe: { source: 'configs/starters/note-pack.json', sha256: sha(bytes), receiptSha256: sha(content(planned, receiptFile)),
      generator: 'files', processes: receipt.processes, run: [], nextSteps: ['Open Field & Notes'] } });
}));

test('values come from a file, inline answers or identity options, and a derived ID and name fill the gaps', async () => workspace(async context => {
  const values = async options => JSON.parse(content(await plan(context, { starter: 'note-pack', ...options }), receiptFile)).values;
  assert.deepEqual(await values({}), { id: 'field-notes', name: 'Field Notes', count: 2, flag: true });
  await writeFile(join(context.root, 'values.json'), JSON.stringify({ id: 'from-file', count: 3 }));
  assert.deepEqual(await values({ values: 'values.json' }), { id: 'from-file', name: 'From File', count: 3, flag: true });
  assert.deepEqual(await values({ answers: '{"flag":false,"name":"Inline"}', author: 'Ada', id: 'opt-id' }), { id: 'opt-id', name: 'Inline', count: 2, flag: false, author: 'Ada' });
  assert.equal(await code(plan(context, { starter: 'note-pack', values: 'values.json', answers: '{}' })), 'STARTER_INPUT');
  assert.equal(await code(plan(context, { starter: 'note-pack', answers: '[]' })), 'STARTER_INVALID');
  assert.equal(await code(plan(context, { starter: 'note-pack', answers: '{"unknown":1}' })), 'STARTER_INPUT');
}));

test('starter selection refuses missing, unknown and project starters', async () => workspace(async context => {
  assert.equal(await code(plan(context, {})), 'STARTER_REQUIRED');
  assert.equal(await code(plan(context, { starter: 'absent' })), 'STARTER_UNKNOWN');
  await assert.rejects(plan(context, { starter: 'plugin-vanilla' }), { code: 'STARTER_KIND',
    message: 'plugin-vanilla is a project starter; it is prepared with a prototype interview, not a target directory. Run node bin/app new --starter plugin-vanilla, or new guide --starter plugin-vanilla --json for agents.' });
}, [fileStarter(), await shipped('plugin-vanilla')]));

test('process selection follows --run or --install and requires explicit trust before running', async () => workspace(async context => {
  const run = async options => (await plan(context, { starter: 'note-pack', ...options })).summary.recipe.run;
  assert.deepEqual(await run({ run: 'hello' }), ['hello']);
  assert.deepEqual(await run({ install: true }), ['again']);
  assert.deepEqual(await run({ run: 'hello,again', yes: true, 'trust-processes': true }), ['hello', 'again']);
  assert.deepEqual(await run({ run: 'hello', apply: 'hash', 'dry-run': true }), ['hello']);
  for (const options of [{ run: 'hello', install: true }, { run: 'absent' }, { run: 'hello,hello' }]) assert.equal(await code(plan(context, { starter: 'note-pack', ...options })), 'STARTER_PROCESS');
  assert.equal(await code(plan(context, { starter: 'note-pack', run: 'hello', yes: true })), 'STARTER_TRUST');
  assert.equal(await code(plan(context, { starter: 'note-pack', install: true, apply: 'hash' })), 'STARTER_TRUST');
  assert.equal(await code(plan(context, { starter: 'idle', install: true })), 'STARTER_PROCESS');
  for (const key of ['extension', 'extensions', 'airship', 'no-airship', 'storybook', 'storybook-stories']) {
    assert.equal(await code(plan(context, { starter: 'note-pack', [key]: key === 'extension' ? 'md' : true })), 'STARTER_OPTION');
  }
}, [fileStarter(), fileStarter({ id: 'idle', firstRun: [] })]));

test('a Companion starter compiles the customized document and binds the compiler hash', async () => workspace(async context => {
  const planned = await plan(context, { starter: 'blank', author: 'Ada', id: 'field-notes' });
  const receipt = JSON.parse(content(planned, receiptFile));
  assert.deepEqual(receipt.values, { id: 'field-notes', name: 'Field Notes', author: 'Ada', description: 'A minimal runnable plugin shell with no example domain or product requirements.',
    version: '0.1.0', codebaseFolder: 'src', testsFolder: 'tests' });
  assert.equal(JSON.parse(content(planned, 'manifest.json')).id, 'field-notes');
  assert.equal(JSON.parse(content(planned, 'manifest.json')).author, 'Ada');
  assert.deepEqual(receipt.files.map(file => file.path), planned.plan.changes.slice(0, -1).map(change => change.path.slice('field-notes/'.length)));
  assert.equal(planned.summary.recipe.generator, 'companion');
  assert.notEqual(planned.hash, sha(JSON.stringify({ source: planned.summary.starter.sha256, values: receipt.values, compilerHash: '' })));
  assert.equal(await code(plan(context, { starter: 'blank', id: 'obsidian-notes' })), 'INVALID_PLUGIN_ID');
  const files = await plan(context, { starter: 'custom-file-view', extension: 'board' });
  assert.equal(JSON.parse(content(files, receiptFile)).values.extension, 'folio');
  assert.deepEqual(JSON.parse(content(files, 'design/project.json')).design.nativeIntegrations.fileTypes.map(type => type.extension), ['board']);
}, [await shipped('blank'), await shipped('custom-file-view')]));

test('a Companion starter without an explicit ID derives one from its target directory', async () => workspace(async context => {
  const derived = await definitionProjectPlan(request('new', ['x'], { starter: 'blank' }), context, { directory: join(context.root, 'x'), vault: context.root, target: 'x' }, context.frameworkRoot);
  // The Companion fallback is the document's own ID (my-plugin); neither x-my-plugin nor my-plugin passes the ID rule.
  assert.deepEqual(derived.summary.identity, { id: 'x-project', name: 'X Project', author: '' });
}, [await shipped('blank')]));
