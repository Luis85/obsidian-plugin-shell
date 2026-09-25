import { parseJsonData, parseDesignData } from '../../scripts/contracts/json-data.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdtemp, realpath, readFile, writeFile, readdir, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { readInput, ask } from '../../scripts/framework/input.ts';
import { parseCliArguments, validateRequest, descriptor } from '../../scripts/framework/catalog.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { exportDesignSystem } from '../../scripts/framework/style-export.ts';
import { compileDesignSystem } from '../../scripts/companion/design-system-css.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const seed = JSON.parse(await readFile(join(root, 'docs/concepts/companion/companion-project.json'), 'utf8'));
async function fixture(t) {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'framework-input-style-')));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await writeFile(join(folder, 'input.json'), JSON.stringify(seed));
  return { root: folder, frameworkRoot: root };
}
const run = (context, args) => executeOperation(parseCliArguments(args), context);
test('typed requests cannot reinterpret command or argument fields as approval flags', () => {
  for (const request of [
    {command: 'setup --yes', args: [], options: {}},
    {command: 'plan inspect', args: ['--yes'], options: {}},
    {command: 'status', args: [], options: {json: 'true'}},
    {command: 'build', args: [], options: {timeout: 'NaN'}},
  ]) assert.throws(() => validateRequest(request));
  assert.equal(validateRequest({command: 'project inspect', args: [], options: {input: '--yes'}}).options.input, '--yes');
  assert.equal(parseCliArguments(['--version', '--json']).command, 'version');
  assert.equal(parseCliArguments(['help', 'styles', 'export', '-h']).options.help, true);
});
test('command help is scoped and discovery cannot mutate command policy', async t => {
  const ctx = await fixture(t);
  const help = await run(ctx, ['help', 'styles', 'export']);
  assert.equal(help.status, 'ok'); assert.equal(help.data.commands.length, 1);
  assert.equal(help.data.commands[0].options.format, 'value');
  help.data.commands[0].options.format = 'flag'; help.data.commands[0].effect = 'read';
  assert.equal(descriptor('styles export').effect, 'plan');
  assert.equal(descriptor('styles export').options.format, 'value');
  assert.equal((await run(ctx, ['make', 'describe', 'missing'])).diagnostics[0].code, 'MAKER_UNKNOWN');
});
test('bounded stdin preserves UTF-8 and cancels without requiring EOF', async () => {
  const input = new PassThrough(), controller = new AbortController();
  const pending = readInput(input, controller.signal); input.write('{'); controller.abort();
  await assert.rejects(pending, error => error.code === 'CANCELLED');
  assert.equal(input.listenerCount('data'), 0); assert.equal(input.listenerCount('end'), 0);
  const valid = new PassThrough(), answer = readInput(valid);
  const bytes = Buffer.from('Grüße'); valid.write(bytes.subarray(0, 3)); valid.end(bytes.subarray(3));
  assert.equal(await answer, 'Grüße');
  const invalid = new PassThrough(), rejected = readInput(invalid); invalid.end(Buffer.from([255]));
  await assert.rejects(rejected, error => error.code === 'INPUT_ENCODING');
  const large = new PassThrough(), bounded = readInput(large, undefined, 2); large.write('abc');
  await assert.rejects(bounded, error => error.code === 'INPUT_LIMIT');
});
test('prompt answers, EOF and abort always settle and release their listeners', async () => {
  const answerInput = new PassThrough(), output = new PassThrough(); output.resume();
  const answer = ask(answerInput, output, 'Name: '); answerInput.write('Field Notes\n');
  assert.equal(await answer, 'Field Notes');
  const eof = new PassThrough(), ended = ask(eof, output, 'Continue: '); eof.end();
  await assert.rejects(ended, error => error.code === 'CANCELLED');
  const input = new PassThrough(), controller = new AbortController();
  const pending = ask(input, output, 'Approve: ', controller.signal); controller.abort();
  await assert.rejects(pending, error => error.code === 'CANCELLED');
  assert.equal(input.listenerCount('data'), 0);
});
test('CLI token CSS is byte-identical to the project compiler and documentation is escaped', () => {
  const system = structuredClone(seed.design.designSystem), id = seed.project.id;
  const compiled = exportDesignSystem(system, id, 'css');
  assert.equal(compiled.content, compileDesignSystem(system, id).css);
  system.description = '</p><script>fetch("private")</script>';
  const html = exportDesignSystem(system, id, 'html').content;
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>'));
  assert.equal(exportDesignSystem(system, id, 'markdown').extension, 'md');
  assert.deepEqual(JSON.parse(exportDesignSystem(system, id, 'json').content).designSystem, system);
  let invoked = 0; assert.throws(() => exportDesignSystem({get schema() { invoked++; return 1; }}, id, 'html'));
  assert.equal(invoked, 0); assert.throws(() => exportDesignSystem(system, id, 'svg'), /Choose/);
});
test('style exports preview without writes, share stale-plan protection and preserve existing exports', async t => {
  const ctx = await fixture(t);
  const planned = await run(ctx, ['styles', 'export', '--input', 'input.json']);
  assert.equal(planned.status, 'planned'); assert.deepEqual(await readdir(ctx.root), ['input.json']);
  const done = await run(ctx, ['styles', 'export', '--input', 'input.json', '--apply', planned.data.planHash]);
  assert.equal(done.status, 'applied', JSON.stringify(done));
  assert.equal((await run(ctx, ['styles', 'export', '--input', 'input.json', '--yes'])).status, 'unchanged');
  const before = await readFile(join(ctx.root, 'exports/design-system.css'));
  const document = structuredClone(seed); document.design.designSystem.colors[0].dark = '#123456';
  await writeFile(join(ctx.root, 'input.json'), JSON.stringify(document));
  const conflict = await run(ctx, ['styles', 'export', '--input', 'input.json', '--yes']);
  assert.equal(conflict.diagnostics[0].code, 'PLAN_CONFLICT');
  assert.deepEqual(await readFile(join(ctx.root, 'exports/design-system.css')), before);
  assert.equal((await run(ctx, ['styles', 'export', '--input', 'input.json', '--out', '../outside.css', '--yes'])).diagnostics[0].code, 'STYLE_OUTPUT_PATH');
});
test('plan outputs cannot occupy a future output path or an alternate test vault', async t => {
  const ctx = await fixture(t);
  const args = ['setup', '--id', 'field-notes', '--name', 'Field Notes', '--author', 'Fixture'];
  assert.equal((await run(ctx, [...args, '--plan-out', 'shell.config.json'])).diagnostics[0].code, 'PLAN_OUTPUT_COLLISION');
  assert.deepEqual(await readdir(ctx.root), ['input.json']);
  assert.equal((await run(ctx, [...args, '--test-vault', '.qa', '--yes'])).status, 'applied');
  assert.equal((await run(ctx, ['vault', 'prepare', '--plan-out', '.qa/plan.json'])).diagnostics[0].code, 'PLAN_OUTPUT_PROTECTED');
  for (const path of ['.QA/output.css', '.Obsidian/output.css']) assert.equal((await run(ctx, ['styles', 'export', '--input', 'input.json', '--out', path, '--yes'])).diagnostics[0].code, 'STYLE_OUTPUT_PATH');
});
test('status derives regeneration freshness from actual design bytes', async t => {
  const ctx = await fixture(t);
  await run(ctx, ['setup', '--input', 'input.json', '--yes']);
  await mkdir(join(ctx.root, '.companion'));
  await writeFile(join(ctx.root, '.companion/generation.json'), JSON.stringify({inputHash: '0'.repeat(64)}));
  const response = await run(ctx, ['status']);
  assert.equal(response.data.designStale, true); assert.equal(response.data.next, 'generate');
  assert.ok(response.diagnostics.some(item => item.code === 'DESIGN_GENERATION_STALE'));
});

test('large v4 design traceability remains inspectable without broadening operation input limits', async t => {
  const ctx = await fixture(t);
  await run(ctx, ['setup', '--input', 'input.json', '--yes']);
  const trace = JSON.stringify({requirements: [{verification: 'todo'}], detailDesigns: seed.design.detailDesigns}, null, 2);
  assert.ok(Buffer.byteLength(trace) > 1_048_576, 'exercise the real large-project metadata boundary');
  await writeFile(join(ctx.root, 'design/traceability.json'), trace);
  const response = await run(ctx, ['status']);
  assert.equal(response.status, 'ok', JSON.stringify(response));
  assert.equal(response.data.acceptanceObligations, 1);
});

test('larger design-data profile does not relax small operation input or hostile-key checks', () => {
  const large = JSON.stringify({description: 'x'.repeat(1_100_000)});
  assert.throws(() => parseJsonData(large), /JSON_DATA_INVALID/);
  assert.equal(parseDesignData(large).description.length, 1_100_000);
  assert.throws(() => parseDesignData(JSON.stringify({description: 'x'.repeat(4_000_000)})), /JSON_DATA_INVALID/);
  assert.throws(() => parseDesignData('{"constructor":{}}'), /JSON_DATA_INVALID/);
});
