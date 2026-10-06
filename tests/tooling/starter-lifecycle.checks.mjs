import { guidedStarter } from '../../bin/presentation/terminal/starter-terminal.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { executeOperation } from '../../bin/adapters/framework/operations.ts';
import { planOperation, applyOperation } from '../../bin/adapters/framework/planning.ts';
import { processPlan } from '../../bin/adapters/starters/processes.ts';
import { commandHelp } from '../../bin/adapters/framework/help-text.ts';
import { commands } from '../../bin/adapters/framework/catalog.ts';
const frameworkRoot = fileURLToPath(new URL('../../', import.meta.url));
const original = JSON.parse(await readFile(join(frameworkRoot, 'configs/starters/webapp.json'), 'utf8'));
async function workspace(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'starter-lifecycle-'))); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'configs/starters'), { recursive: true });
  const definition = structuredClone(original); definition.id = 'custom-starter'; definition.name = 'Custom starter';
  const step = (id, code, dependsOn = []) => {
    definition.files.push({ path: `tools/${id}.mjs`, content: code });
    return { id, label: id, description: id + ' fixture', dependsOn, steps: [{ runner: 'node', script: `tools/${id}.mjs`, args: [], cwd: '.', timeout: 10000 }] };
  };
  definition.processes = [step('first', "import { appendFile } from 'node:fs/promises'; await appendFile('order.txt', 'first\\n');"),
    step('second', "import { appendFile } from 'node:fs/promises'; await appendFile('order.txt', 'second\\n');", ['first']),
    step('fail', 'process.exitCode = 7;'), step('after', "import { writeFile } from 'node:fs/promises'; await writeFile('after.txt', 'bad');", ['fail'])];
  definition.firstRun = ['second'];
  const path = join(root, 'configs/starters/custom-starter.json'); await writeFile(path, JSON.stringify(definition, null, 2));
  return { root, frameworkRoot, definition, path };
}
const run = (context, command, args = [], options = {}) => executeOperation({ command, args, options }, context);
const newRequest = options => ({ command: 'new', args: ['product'], options: { starter: 'custom-starter', ...options } });
const read = async path => JSON.parse(await readFile(path, 'utf8'));
test('empty consumer never borrows definitions from frameworkRoot', async t => {
  const context = await workspace(t); await rm(join(context.root, 'configs'), { recursive: true });
  const listed = await run(context, 'new', [], { list: true }); assert.equal(listed.status, 'ok'); assert.deepEqual(listed.data.starters, []);
  assert.match(listed.data.next, /separate/); const failed = await run(context, 'new', ['product'], { starter: 'blank', yes: true });
  assert.equal(failed.diagnostics[0].code, 'STARTER_UNKNOWN'); assert.deepEqual(await readdir(context.root), []);
});
test('custom JSON alone supports list, show, generation preview and applied boilerplate', async t => {
  const context = await workspace(t), before = await readdir(context.root);
  const listed = await run(context, 'starters list'); assert.equal(listed.data.starters[0].id, 'custom-starter');
  const shown = await run(context, 'starters show', ['custom-starter']); assert.deepEqual(shown.data.starters[0].definition, context.definition);
  const planned = await executeOperation(newRequest({}), context); assert.equal(planned.status, 'planned'); assert.deepEqual(await readdir(context.root), before);
  const applied = await executeOperation(newRequest({ apply: planned.data.planHash }), context); assert.equal(applied.status, 'applied', JSON.stringify(applied));
  assert.equal((await read(join(context.root, 'product/package.json'))).name, 'product');
  assert.equal((await read(join(context.root, 'product/.workbench/starter.json'))).starter.id, 'custom-starter');
  assert.ok(!(await readdir(join(context.root, 'product'))).includes('order.txt'));
});
test('metadata-only JSON edits invalidate both held and CLI apply plans', async t => {
  const context = await workspace(t), request = newRequest({}), held = await planOperation(request, context);
  await writeFile(context.path, JSON.stringify({ ...context.definition, summary: 'Changed metadata' }));
  await assert.rejects(applyOperation(held, context, held.planHash), /changed after review/);
  const stale = await executeOperation(newRequest({ apply: held.planHash }), context); assert.equal(stale.diagnostics[0].code, 'PLAN_STALE');
  assert.deepEqual(await readdir(context.root), ['configs']);
});
test('input file changes invalidate the reviewed generation plan', async t => {
  const context = await workspace(t), path = join(context.root, 'values.json');
  await writeFile(path, JSON.stringify({ name: 'Before' })); const planned = await executeOperation(newRequest({ values: 'values.json' }), context);
  await writeFile(path, JSON.stringify({ name: 'After' })); const applied = await executeOperation(newRequest({ values: 'values.json', apply: planned.data.planHash }), context);
  assert.equal(applied.diagnostics[0].code, 'PLAN_STALE');
});
test('add/edit validate data, preserve existing files and require explicit apply', async t => {
  const context = await workspace(t), input = join(context.root, 'import.json'), d = { ...context.definition, id: 'added', name: 'Added' };
  await writeFile(input, JSON.stringify(d));
  const preview = await run(context, 'starters add', [], { input: 'import.json' }); assert.equal(preview.status, 'planned');
  assert.equal((await run(context, 'starters list')).data.starters.length, 1);
  assert.equal((await run(context, 'starters add', [], { input: 'import.json', apply: preview.data.planHash })).status, 'applied');
  assert.equal((await run(context, 'starters add', [], { input: 'import.json', yes: true })).diagnostics[0].code, 'STARTER_EXISTS');
  d.name = 'Edited'; await writeFile(input, JSON.stringify(d));
  const edit = await run(context, 'starters edit', ['added'], { input: 'import.json' }); assert.equal(edit.status, 'planned');
  assert.equal((await run(context, 'starters edit', ['added'], { input: 'import.json', apply: edit.data.planHash })).status, 'applied');
  assert.equal((await read(join(context.root, 'configs/starters/added.json'))).name, 'Edited');
  assert.equal((await run(context, 'starters edit', ['wrong'], { input: 'import.json', yes: true })).diagnostics[0].code, 'STARTER_ID');
});
test('starter process selection never executes during preview and trust is required before writes', async t => {
  const context = await workspace(t);
  const preview = await executeOperation(newRequest({ install: true }), context); assert.equal(preview.status, 'planned');
  const denied = await executeOperation(newRequest({ install: true, yes: true }), context); assert.equal(denied.diagnostics[0].code, 'STARTER_TRUST');
  assert.deepEqual(await readdir(context.root), ['configs']);
  const applied = await executeOperation(newRequest({ install: true, yes: true, 'trust-processes': true }), context);
  assert.equal(applied.status, 'applied', JSON.stringify(applied)); assert.equal(await readFile(join(context.root, 'product/order.txt'), 'utf8'), 'first\nsecond\n');
});
test('process review is read-only, dependencies are ordered once, and explicit execution uses real Node scripts', async t => {
  const context = await workspace(t); await executeOperation(newRequest({ yes: true }), context);
  const options = { project: 'product', process: 'second,first' };
  const preview = await run(context, 'starters run', [], options); assert.equal(preview.status, 'planned');
  assert.deepEqual(preview.data.processes.map(item => item.id), ['first', 'second']);
  const denied = await run(context, 'starters run', [], { ...options, yes: true }); assert.equal(denied.diagnostics[0].code, 'STARTER_TRUST');
  const applied = await run(context, 'starters run', [], { ...options, yes: true, 'trust-processes': true, apply: preview.data.planHash });
  assert.equal(applied.status, 'applied'); assert.equal(await readFile(join(context.root, 'product/order.txt'), 'utf8'), 'first\nsecond\n');
  assert.match(preview.data.requires, /--apply <planHash>; without --apply.*cannot detect changes/); assert.match(applied.data.review, /^bound to the --apply plan hash/);
});
test('changed script bytes make a reviewed process plan stale', async t => {
  const context = await workspace(t); await executeOperation(newRequest({ yes: true }), context);
  const plan = await processPlan(join(context.root, 'product'), ['first']);
  await writeFile(join(context.root, 'product/tools/first.mjs'), 'process.exitCode = 0;');
  const result = await run(context, 'starters run', [], { project: 'product', process: 'first', yes: true, 'trust-processes': true, apply: plan.planHash });
  assert.equal(result.diagnostics[0].code, 'PLAN_STALE'); assert.ok(!(await readdir(join(context.root, 'product'))).includes('order.txt'));
});
test('failure stops dependent processes and preserves honest partial execution details', async t => {
  const context = await workspace(t); await executeOperation(newRequest({ yes: true }), context);
  const result = await run(context, 'starters run', [], { project: 'product', process: 'first,after', yes: true, 'trust-processes': true });
  assert.equal(result.status, 'failed'); assert.equal(result.diagnostics[0].code, 'PROCESS_FAILED'); assert.equal(result.data.automaticRetry, false);
  assert.equal(result.data.completed.length, 1); assert.equal(await readFile(join(context.root, 'product/order.txt'), 'utf8'), 'first\n');
  assert.ok(!(await readdir(join(context.root, 'product'))).includes('after.txt'));
});
test('existing target files and aborted requests are not overwritten', async t => {
  const context = await workspace(t); await mkdir(join(context.root, 'product')); await writeFile(join(context.root, 'product/user.txt'), 'keep');
  const refused = await executeOperation(newRequest({ yes: true }), context); assert.equal(refused.diagnostics[0].code, 'TARGET_NOT_EMPTY');
  const aborted = await executeOperation(newRequest({ yes: true }), { ...context, signal: AbortSignal.abort() }); assert.equal(aborted.status, 'cancelled');
  assert.equal(await readFile(join(context.root, 'product/user.txt'), 'utf8'), 'keep');
});
test('saved generation plans do not serialize process trust and applying one does not execute processes', async t => {
  const context = await workspace(t);
  const preview = await executeOperation(newRequest({ run: 'first', 'trust-processes': true, 'plan-out': 'create.plan.json' }), context);
  assert.equal(preview.status, 'planned');
  const saved = await read(join(context.root, 'create.plan.json')); assert.equal(saved.request.options['trust-processes'], undefined);
  const applied = await run(context, 'plan apply', ['create.plan.json'], { yes: true }); assert.equal(applied.status, 'applied', JSON.stringify(applied));
  assert.ok(!(await readdir(join(context.root, 'product'))).includes('order.txt'));
});

test('wizard reads custom typed fields from JSON and rejects invalid answers rather than coercing silently', async t => {
  const context = await workspace(t);
  context.definition.inputs = [
    { id: 'id', label: 'ID', type: 'string', required: true },
    { id: 'name', label: 'Name', type: 'string', required: true },
    { id: 'enabled', label: 'Enabled', type: 'boolean', required: true },
    { id: 'count', label: 'Count', type: 'integer', required: true },
    // The copied webapp files render {{description}}; validation requires a default for an optional referenced input.
    { id: 'description', label: 'Description', type: 'string', required: false, default: 'Typed fixture' }
  ];
  await writeFile(context.path, JSON.stringify(context.definition));
  const request = newRequest({ id: 'product', name: 'Product' });
  // Each invalid answer is reported and asked again; only the corrected answer becomes a value.
  for (const [answers, reported] of [[['maybe', 'no', '3', ''], /Choose one of the displayed options/], [['yes', '', '3', ''], /Count: enter a number/], [['yes', '1.3', '3', ''], /whole number/]]) {
    let i = 0; const written = [];
    const corrected = await guidedStarter(request, context, async () => answers[i++], text => { written.push(text); });
    assert.match(written.join(''), reported); assert.equal(i, answers.length);
    assert.deepEqual(JSON.parse(corrected.options.answers), { id: 'product', name: 'Product', enabled: answers[0] === 'yes', count: 3, description: 'Typed fixture' });
  }
  const answers = ['no', '3', '']; let i = 0;
  const guided = await guidedStarter(request, context, async () => answers[i++], () => {});
  assert.deepEqual(JSON.parse(guided.options.answers), { id: 'product', name: 'Product', enabled: false, count: 3, description: 'Typed fixture' });
});
test('generation refuses simultaneous values-file and inline answers', async t => {
  const context = await workspace(t); await writeFile(join(context.root, 'values.json'), '{}');
  const result = await executeOperation(newRequest({ values: 'values.json', answers: '{}', yes: true }), context);
  assert.equal(result.diagnostics[0].code, 'STARTER_INPUT'); assert.ok(!(await readdir(context.root)).includes('product'));
});
test('--yes without --apply runs as one explicit step and reports that no earlier review was bound', async t => {
  const context = await workspace(t); await executeOperation(newRequest({ yes: true }), context);
  const result = await run(context, 'starters run', [], { project: 'product', process: 'first', yes: true, 'trust-processes': true });
  assert.equal(result.status, 'applied'); assert.match(result.data.review, /^unbound: .*not compared with an earlier review/);
  const help = commandHelp(commands.find(entry => entry.id === 'starters run'));
  assert.ok(help.examples.every(example => !example.includes('--yes') || example.includes('--apply <planHash>')));
  assert.match(help.optionHelp.apply.description, /Without it, --yes --trust-processes plans and runs in one step and cannot detect changes/);
});
test('edit repairs a broken target definition through a reviewed plan while other definitions stay validated', async t => {
  const context = await workspace(t), input = join(context.root, 'fixed.json');
  await writeFile(context.path, '{broken'); await writeFile(input, JSON.stringify({ ...context.definition, name: 'Repaired' }));
  assert.equal((await run(context, 'starters list')).status, 'failed');
  const preview = await run(context, 'starters edit', ['custom-starter'], { input: 'fixed.json' });
  assert.equal(preview.status, 'planned', JSON.stringify(preview)); assert.equal(await readFile(context.path, 'utf8'), '{broken');
  await writeFile(context.path, '{still broken'); const stale = await run(context, 'starters edit', ['custom-starter'], { input: 'fixed.json', apply: preview.data.planHash });
  assert.equal(stale.diagnostics[0].code, 'PLAN_STALE'); assert.equal(await readFile(context.path, 'utf8'), '{still broken');
  const reviewed = await run(context, 'starters edit', ['custom-starter'], { input: 'fixed.json' });
  const applied = await run(context, 'starters edit', ['custom-starter'], { input: 'fixed.json', apply: reviewed.data.planHash });
  assert.equal(applied.status, 'applied', JSON.stringify(applied)); assert.equal((await run(context, 'starters list')).data.starters[0].title, 'Repaired');
  await writeFile(join(context.root, 'configs/starters/other.json'), '{broken');
  const blocked = await run(context, 'starters edit', ['custom-starter'], { input: 'fixed.json' }); assert.equal(blocked.status, 'failed');
  await writeFile(join(context.root, 'configs/starters/other.json'), JSON.stringify({ ...context.definition, id: 'custom-starter' }));
  assert.equal((await run(context, 'starters edit', ['custom-starter'], { input: 'fixed.json' })).diagnostics[0].code, 'STARTER_ID');
});
