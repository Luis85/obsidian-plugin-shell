import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { studio, prototypeWizard } from '../../bin/presentation/studio.ts';
import { loadGuide } from '../../bin/adapters/prototype.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { checkSteps } from '../../scripts/framework/check.ts';
import { assertJsonData, parseJsonData } from '../../scripts/contracts/json-data.ts';
import { result as operationResult } from '../../scripts/contracts/result.ts';
import { ask, readInput } from '../../scripts/shared/input.ts';
import { routeArguments } from '../../bin/adapters/router.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
function scripted(answers) {
  let cursor = 0;
  return { ask: async prompt => { assert.ok(cursor < answers.length, `Missing answer: ${prompt}`); return answers[cursor++]; },
    write: () => {}, done: () => assert.equal(cursor, answers.length) };
}
async function contents(root, path = '') {
  const found = [];
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const name = path ? path + '/' + entry.name : entry.name;
    if (entry.isDirectory()) found.push(...await contents(root, name));
    else found.push([name, (await readFile(join(root, name))).toString('base64')]);
  }
  return found.sort(([a], [b]) => a.localeCompare(b));
}
// Two complete sessions plus package compilation exceed the 60 s default under v8 coverage on Windows runners.
test('complete interactive and agent sessions produce byte-identical sketch and prototype packages', { timeout: 180000 }, async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-parity-'));
  try {
    const human = join(root, 'human'), agent = join(root, 'agent');
    await mkdir(human); await mkdir(agent);
    const ui = scripted(['Issue desk', 'new', 'Issues', 'bulk', 'Card; Filters', 'back', 'new', 'Details', 'back', 'save', 'y', 'exit']);
    await studio(ui, { root: human, frameworkRoot, project: 'design/project.json' }); ui.done();
    const request = { schemaVersion: 1, title: 'Issue desk', operations: [
      { op: 'page.add', title: 'Issues', as: 'issues' },
      { op: 'page.attach', page: '@issues', components: [{ title: 'Card' }, { title: 'Filters' }] },
      { op: 'page.add', title: 'Details' },
    ] };
    const context = { root: agent, frameworkRoot, input: Readable.from([JSON.stringify(request)]) };
    const args = parseArguments(['sketch', '--input', '-', '--json']);
    const preview = await execute(args, context);
    await execute({ ...args, flags: { ...args.flags, apply: preview.planHash } }, { ...context, input: Readable.from([JSON.stringify(request)]) });
    assert.equal(await readFile(join(human, 'design/project.json'), 'utf8'), await readFile(join(agent, 'design/project.json'), 'utf8'));
    const guide = await loadGuide();
    const answers = guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => field.kind === 'confirm' ? 'y' : '');
    const wizard = scripted([...answers, 'prepared', 'y']);
    await prototypeWizard(wizard, { root: human, frameworkRoot, project: 'design/project.json' }); wizard.done();
    const answerText = await readFile(join(human, 'prepared/prototype-answers.json'), 'utf8');
    const proto = parseArguments(['prototype', '--input', '-', '--out', 'prepared', '--json']);
    const planned = await execute(proto, { ...context, input: Readable.from([answerText]) });
    await execute({ ...proto, flags: { ...proto.flags, apply: planned.planHash } }, { ...context, input: Readable.from([answerText]) });
    assert.deepEqual(await contents(join(human, 'prepared')), await contents(join(agent, 'prepared')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('full and fast daily gates include maker types and tests when the CLI is present', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-gates-'));
  try {
    await mkdir(join(root, 'bin'));
    await writeFile(join(root, 'bin/app.ts'), 'export {};');
    await mkdir(join(root, 'configs/types'), { recursive: true }); await writeFile(join(root, 'configs/types/tsconfig.maker.json'), '{}');
    const full = await checkSteps(root, false), fast = await checkSteps(root, true, async () => null);
    for (const plan of [full, fast]) {
      assert.ok(plan.steps.some(step => step.id === 'maker-types'));
      assert.ok(plan.steps.some(step => step.id === 'maker-tests'));
    }
    assert.deepEqual(full.steps.find(step => step.id === 'eslint').args, ['-c', 'configs/lint/eslint.config.mjs', 'src', 'bin', '--max-warnings', '0']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('maker production coverage includes shared typed CLI contracts', () => {
  const parsed = parseJsonData('{"ok":[1,true,null,"café"]}');
  assert.equal(assertJsonData(parsed), true);
  assert.deepEqual(operationResult('sketch', parsed), {
    protocolVersion: 1, command: 'sketch', status: 'ok', data: parsed, diagnostics: [],
  });
  assert.equal(operationResult('sketch', null, 'planned').status, 'planned');

  assert.throws(() => parseJsonData('{'), /SyntaxError/);
  assert.throws(() => parseJsonData(undefined), /JSON_DATA_INVALID/);
  assert.throws(() => assertJsonData(Number.NaN), /JSON_DATA_INVALID/);

  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => assertJsonData(cycle), /JSON_DATA_INVALID/);

  const accessor = {};
  Object.defineProperty(accessor, 'value', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.throws(() => assertJsonData(accessor), /JSON_DATA_INVALID/);

  const sparse = [];
  sparse[1] = 'gap';
  assert.throws(() => assertJsonData(sparse), /JSON_DATA_INVALID/);
});

test('maker shared input transport preserves bounded and prompt semantics', async () => {
  const valid = new PassThrough();
  const pending = readInput(valid);
  const bytes = Buffer.from('Grüße');
  valid.write(bytes.subarray(0, 3));
  valid.end(bytes.subarray(3));
  assert.equal(await pending, 'Grüße');

  const bounded = new PassThrough();
  const tooLarge = readInput(bounded, undefined, 2);
  bounded.write('abc');
  await assert.rejects(tooLarge, error => error.code === 'INPUT_LIMIT');

  const promptInput = new PassThrough();
  const promptOutput = new PassThrough();
  promptOutput.resume();
  const answer = ask(promptInput, promptOutput, 'Name: ', undefined, false);
  promptInput.end('Workbench\n');
  assert.equal(await answer, 'Workbench');
});

test('single bin router preserves launcher surface ownership and aliases', () => {
  const cases = [
    [[], 'maker', []],
    [['studio'], 'maker', ['studio']],
    [['--ui', 'tui'], 'maker', ['--ui', 'tui']],
    [['new', 'presets'], 'maker', ['new', 'presets']],
    [['new', 'guide'], 'maker', ['new', 'guide']],
    [['new', 'validate'], 'maker', ['new', 'validate']],
    [['new', '--preset', 'cli'], 'maker', ['new', '--preset', 'cli']],
    [['new', '--help'], 'maker', ['new', '--help']],
    [['new', '../legacy'], 'framework', ['new', '../legacy']],
    [['new', '--list'], 'framework', ['new', '--list']],
    [['status'], 'framework', ['status']],
    [['help', 'new'], 'framework', ['help', 'new']],
    [['make', 'project', '../legacy'], 'framework', ['new', '../legacy']],
    [['make', 'prototype', '--help'], 'maker', ['prototype', '--help']],
    [['help', 'sketch', '--json'], 'maker', ['sketch', '--help', '--json']],
    [['memory', 'status', '--json'], 'memory', ['status', '--json']],
    [['help', 'memory', '--json'], 'memory', ['--help', '--json']],
  ];
  for (const [argv, surface, args] of cases) assert.deepEqual(routeArguments(argv), { surface, args }, argv.join(' '));
});
