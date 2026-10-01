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
import { renderCliResult } from '../../bin/presentation/terminal/cli-output.ts';
import { interactiveRun } from '../../bin/presentation/terminal/cli-interactive.ts';
import { main as frameworkMain } from '../../bin/adapters/framework-cli.ts';
import { processOperation } from '../../bin/adapters/framework/process-operation.ts';
import { executeOperation as frameworkOperation } from '../../bin/adapters/framework/operations.ts';
import { descriptor as frameworkDescriptor, parameterKinds as frameworkParameterKinds, parseCliArguments as parseFrameworkArguments } from '../../bin/adapters/framework/catalog.ts';
import { suggestions as frameworkSuggestions, didYouMean as frameworkDidYouMean } from '../../bin/adapters/framework/suggest.ts';
import { prototypeCommands } from '../../bin/adapters/framework/prototype-catalog.ts';
import { operationSchemas } from '../../bin/adapters/framework/schema.ts';
import { failure as frameworkFailure, stringOption as frameworkStringOption, OperationError as FrameworkOperationError, requireThat as frameworkRequireThat } from '../../bin/adapters/framework/contracts.ts';
import { CompilerError, CompilationFailure, diagnostic as compilerDiagnostic } from '../../scripts/compiler/domain/diagnostics.ts';
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
    await writeFile(join(root, 'tsconfig.maker.json'), '{}');
    const full = await checkSteps(root, false), fast = await checkSteps(root, true, async () => null);
    for (const plan of [full, fast]) {
      assert.ok(plan.steps.some(step => step.id === 'maker-types'));
      assert.ok(plan.steps.some(step => step.id === 'maker-tests'));
    }
    assert.deepEqual(full.steps.find(step => step.id === 'eslint').args, ['src', 'bin', '--max-warnings', '0']);
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
    [['new', 'starters'], 'maker', ['new', 'starters']],
    [['new', 'guide'], 'maker', ['new', 'guide']],
    [['new', 'validate'], 'maker', ['new', 'validate']],
    [['new', '--starter', 'cli'], 'maker', ['new', '--starter', 'cli']],
    [['new', '../app', '--starter', 'blank'], 'framework', ['new', '../app', '--starter', 'blank']],
    [['new', '--values', 'values.json'], 'framework', ['new', '--values', 'values.json']],
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
  // Plugin CLI commands route to the maker; a framework command keeps precedence over a plugin with the same root.
  const extensions = { pluginCommands: new Set(['example', 'status']), frameworkRoots: new Set(['status', 'help']) };
  for (const [argv, surface, args] of [
    [['example', '--json'], 'maker', ['example', '--json']],
    [['help', 'example'], 'maker', ['example', '--help']],
    [['status'], 'framework', ['status']],
    [['unknown'], 'framework', ['unknown']],
  ]) assert.deepEqual(routeArguments(argv, extensions), { surface, args }, 'plugin ' + argv.join(' '));
});


test('relocated framework CLI output preserves machine and human result channels', () => {
  const capture = () => {
    let text = '';
    return {
      stream: { isTTY: false, write(value) { text += String(value); return true; } },
      read: () => text,
    };
  };
  const machineOut = capture(), machineErr = capture();
  const machine = operationResult('status', { ready: true });
  renderCliResult(machine, true, { output: machineOut.stream, error: machineErr.stream, env: {} });
  assert.equal(machineOut.read(), JSON.stringify(machine) + '\n');
  assert.equal(machineErr.read(), '');

  const humanOut = capture(), humanErr = capture();
  const failed = {
    ...operationResult('inspect', { reason: 'example' }, 'failed'),
    diagnostics: [{ code: 'EXAMPLE_FAILURE', message: 'Example failed.', next: 'status' }],
  };
  renderCliResult(failed, false, { output: humanOut.stream, error: humanErr.stream, env: {} });
  assert.match(humanOut.read(), /^inspect: failed/m);
  assert.match(humanErr.read(), /EXAMPLE_FAILURE: Example failed\./);
  assert.match(humanErr.read(), /Next: node bin\/app status/);

  const newOut = capture(), newErr = capture();
  renderCliResult(operationResult('new', null, 'cancelled'), false, { output: newOut.stream, error: newErr.stream, env: {} });
  assert.equal(newOut.read(), 'new: cancelled; nothing was written.\n');
  assert.equal(newErr.read(), '');
});


test('relocated interactive plan adapter preserves review, apply and cancellation semantics', async () => {
  const request = { command: 'example', args: [], options: {} };
  const context = { root: frameworkRoot, frameworkRoot };
  const planned = operationResult('example', { planHash: 'abc123' }, 'planned');
  const applied = operationResult('example', { written: ['one'] }, 'applied');
  const calls = [], rendered = [];
  const accepted = await interactiveRun(request, context, {
    execute: async value => { calls.push(value); return calls.length === 1 ? planned : applied; },
    commandEffect: () => 'plan',
    confirm: async message => { assert.equal(message, 'Apply this reviewed plan?'); return true; },
    render: value => rendered.push(value),
  });
  assert.equal(accepted, applied);
  assert.deepEqual(rendered, [planned]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].options, { apply: 'abc123', yes: true });

  let cancelledCalls = 0;
  const cancelled = await interactiveRun(request, context, {
    execute: async () => { cancelledCalls++; return planned; },
    commandEffect: () => 'plan',
    confirm: async () => false,
    render: () => {},
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelledCalls, 1);

  let dryRunConfirmed = false;
  const dryRun = await interactiveRun({ ...request, options: { 'dry-run': true } }, context, {
    execute: async () => planned,
    commandEffect: () => 'plan',
    confirm: async () => { dryRunConfirmed = true; return true; },
    render: () => { throw new Error('dry-run must not render an apply prompt'); },
  });
  assert.equal(dryRun, planned);
  assert.equal(dryRunConfirmed, false);
});


test('relocated framework CLI composition root preserves machine success and parser failure channels', async () => {
  const capture = () => {
    let text = '';
    return {
      stream: { isTTY: false, write(value) { text += String(value); return true; } },
      read: () => text,
    };
  };
  const run = async argv => {
    const output = capture(), error = capture();
    const code = await frameworkMain(argv, frameworkRoot, {
      input: Readable.from([]),
      output: output.stream,
      error: error.stream,
      env: { CI: 'true' },
    });
    return { code, stdout: output.read(), stderr: error.read() };
  };

  const schema = await run(['schema', '--json']);
  assert.equal(schema.code, 0);
  assert.equal(schema.stderr, '');
  const schemaResult = JSON.parse(schema.stdout);
  assert.equal(schemaResult.command, 'schema');
  assert.equal(schemaResult.status, 'ok');
  assert.equal(schema.stdout.trim().split('\n').length, 1);

  const failure = await run(['unknown', '--json', '--no-interaction']);
  assert.equal(failure.code, 1);
  assert.equal(failure.stderr, '');
  const failed = JSON.parse(failure.stdout);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.diagnostics[0].code, 'UNKNOWN_COMMAND');
});


test('relocated reviewed file-operation adapter plans and applies setup through the framework CLI', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-file-operation-')));
  try {
    await writeFile(join(root, 'project.json'), await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8'));
    const capture = () => {
      let text = '';
      return {
        stream: { isTTY: false, write(value) { text += String(value); return true; } },
        read: () => text,
      };
    };
    const run = async argv => {
      const output = capture(), error = capture();
      const code = await frameworkMain(argv, frameworkRoot, {
        input: Readable.from([]),
        output: output.stream,
        error: error.stream,
        env: { CI: 'true' },
      });
      return { code, result: JSON.parse(output.read()), stderr: error.read() };
    };
    const base = ['setup', '--id', 'field-notes', '--name', 'Field Notes', '--author', 'Example', '--root', root, '--json', '--no-interaction'];
    const preview = await run(base);
    assert.equal(preview.code, 0, preview.stderr);
    assert.equal(preview.result.status, 'planned');
    assert.match(preview.result.data.planHash, /^[a-f0-9]{64}$/);

    const applied = await run([...base, '--apply', preview.result.data.planHash]);
    assert.equal(applied.code, 0, applied.stderr);
    assert.ok(['applied', 'unchanged'].includes(applied.result.status), JSON.stringify(applied.result));
    assert.equal(typeof await readFile(join(root, 'shell.config.json'), 'utf8'), 'string');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated read-operation adapter preserves version, concept schema and configuration reads', async () => {
  const capture = () => {
    let text = '';
    return {
      stream: { isTTY: false, write(value) { text += String(value); return true; } },
      read: () => text,
    };
  };
  const run = async argv => {
    const output = capture(), error = capture();
    const code = await frameworkMain(argv, frameworkRoot, {
      input: Readable.from([]),
      output: output.stream,
      error: error.stream,
      env: { CI: 'true' },
    });
    return { code, result: JSON.parse(output.read()), stderr: error.read() };
  };

  const version = await run(['version', '--json']);
  assert.equal(version.code, 0, version.stderr);
  assert.equal(version.result.status, 'ok');
  assert.equal(version.result.data.distribution, 'source');
  assert.equal(version.result.data.protocolVersion, 1);

  const concept = await run(['concept', 'schema', '--json']);
  assert.equal(concept.code, 0, concept.stderr);
  assert.equal(concept.result.command, 'concept schema');
  assert.equal(concept.result.status, 'ok');
  assert.equal(typeof concept.result.data, 'object');

  const config = await run(['config', 'get', '--root', frameworkRoot, '--json', '--no-interaction']);
  assert.equal(config.code, 0, config.stderr);
  assert.equal(config.result.command, 'config get');
  assert.equal(config.result.status, 'ok');
  assert.equal(config.result.data.source, 'shell.config.json');
});


test('relocated process-operation adapter selects trusted commands without launching real tools', async () => {
  const context = { root: frameworkRoot, frameworkRoot };
  const calls = [];
  const execution = { exitCode: 0, signal: null, truncated: false, stdout: '{}' };
  const dependencies = {
    runNode: async (_context, entry, args, timeout, environment) => {
      calls.push({ entry, args, timeout, environment });
      return execution;
    },
    npmEntry: async () => '/qualified/npm-cli.js',
    exists: async () => false,
    readBounded: async () => Buffer.from('{}'),
    dependencyReadiness: () => ({ ready: true, diagnostics: [] }),
    packKit: async (_context, output) => ({ archive: output, publication: 'not-authorized' }),
  };
  const request = (command, options = {}) => ({ command, args: [], options });

  const dry = await processOperation(request('build', { 'dry-run': true }), context, dependencies);
  assert.equal(dry.status, 'planned');
  assert.equal(calls.length, 0);

  const build = await processOperation(request('build'), context, dependencies);
  assert.equal(build.status, 'ok');
  assert.equal(calls.at(-1).entry, 'scripts/bundling/build.mjs');

  await processOperation(request('test', { profile: 'browser' }), context, dependencies);
  assert.deepEqual(calls.at(-1).args, ['test']);
  assert.equal(calls.at(-1).entry, 'node_modules/@playwright/test/cli.js');

  await processOperation(request('verify', { profile: 'project' }), context, dependencies);
  assert.deepEqual(calls.at(-1).args, ['run', 'verify:project']);
  assert.equal(calls.at(-1).entry, '/qualified/npm-cli.js');

  const preview = await processOperation(request('dev', { profile: 'preview' }), context, dependencies);
  assert.equal(preview.status, 'ok');
  assert.deepEqual(calls.at(-1).args, ['--config', 'vite.preview.config.mjs']);

  await processOperation(request('release rehearse', { commit: 'abc123', version: '1.2.3' }), context, dependencies);
  assert.equal(calls.at(-1).entry, 'scripts/release/rehearse.mjs');
  assert.equal(calls.at(-1).environment.npm_execpath, '/qualified/npm-cli.js');

  const install = await processOperation(request('install', { yes: true }), context, dependencies);
  assert.equal(install.status, 'ok');
  assert.equal(calls.at(-1).entry, '/qualified/npm-cli.js');
  assert.deepEqual(calls.at(-1).args, ['ci', '--no-fund']);

  const pack = await processOperation(request('framework pack', { out: 'kit.zip' }), context, dependencies);
  assert.equal(pack.status, 'planned');
  const packed = await processOperation(request('framework pack', { out: 'kit.zip', yes: true }), context, dependencies);
  assert.equal(packed.status, 'applied');
  assert.equal(packed.data.archive, 'kit.zip');
});


test('relocated framework dispatcher preserves discovery and nonexecuting effect routing', async () => {
  const context = { root: frameworkRoot, frameworkRoot };
  const capabilities = await frameworkOperation({ command: 'capabilities', args: [], options: {} }, context);
  assert.equal(capabilities.status, 'ok');
  assert.ok(capabilities.data.commands.length > 20);
  assert.ok(capabilities.data.makers.length > 10);

  const makers = await frameworkOperation({ command: 'make', args: ['list'], options: {} }, context);
  assert.equal(makers.status, 'ok');
  assert.ok(makers.data.makers.length > 10);

  const build = await frameworkOperation({ command: 'build', args: [], options: { 'dry-run': true } }, context);
  assert.equal(build.status, 'planned');
  assert.equal(build.data.execution, 'not-run');

  const release = await frameworkOperation({
    command: 'release operate',
    args: [],
    options: { input: 'release-operation.json', 'dry-run': true },
  }, context);
  assert.equal(release.status, 'planned');
  assert.equal(release.data.publication, 'not-authorized');

  const schema = await frameworkOperation({ command: 'schema', args: [], options: {} }, context);
  assert.equal(schema.status, 'ok');
  assert.equal(schema.data.protocolVersion, 1);
});


test('relocated framework catalog preserves parsing, validation and suggestions', () => {
  assert.equal(parseFrameworkArguments([]).command, 'help');
  assert.equal(parseFrameworkArguments(['-V']).command, 'version');
  assert.deepEqual(parseFrameworkArguments(['config', 'get', '--json']), {
    command: 'config get',
    args: [],
    options: { json: true },
  });
  assert.equal(frameworkDescriptor('test').effect, 'process');
  const kinds = frameworkParameterKinds(frameworkDescriptor('build'));
  assert.equal(kinds.json, 'flag');
  assert.equal(kinds.timeout, 'value');

  assert.throws(() => parseFrameworkArguments(['unknown']), error => error.code === 'UNKNOWN_COMMAND');
  assert.throws(() => parseFrameworkArguments(['status', '--json', '--json']), error => error.code === 'INVALID_OPTION');
  assert.throws(() => parseFrameworkArguments(['status', '--apply', 'not-a-hash']), error => error.code === 'INVALID_PLAN_HASH');
  assert.throws(() => parseFrameworkArguments(['status', '--timeout', '3600001']), error => error.code === 'INVALID_TIMEOUT');
  assert.throws(() => parseFrameworkArguments(['status', '--jsoon']), error => {
    assert.equal(error.code, 'INVALID_OPTION');
    assert.ok(error.details.suggestions.includes('--json'));
    return true;
  });
});


test('relocated parser support preserves prototype catalog and typo suggestions', () => {
  assert.ok(prototypeCommands.some(command => command.id === 'prototypes list' && command.effect === 'read'));
  assert.ok(prototypeCommands.some(command => command.id === 'prototypes generate' && command.effect === 'plan'));
  assert.deepEqual(frameworkSuggestions('statsu', ['status', 'doctor', 'config get']), ['status']);
  assert.deepEqual(frameworkSuggestions('plan', ['plan inspect', 'plan apply', 'status']), ['plan apply', 'plan inspect']);
  assert.equal(frameworkDidYouMean(['status']), ' Did you mean status?');
  assert.equal(frameworkDidYouMean([], value => `"${value}"`), '');
});


test('relocated operation schema covers every framework command and canonical result envelope', () => {
  const schema = operationSchemas();
  assert.equal(schema.protocolVersion, 1);
  assert.equal(schema.request.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.ok(schema.request.oneOf.length > 50);
  const commands = new Set(schema.request.oneOf.map(entry => entry.properties.command.const));
  for (const command of ['help', 'setup', 'prototypes generate', 'build', 'release operate']) assert.ok(commands.has(command), command);
  const setup = schema.request.oneOf.find(entry => entry.properties.command.const === 'setup');
  assert.equal(setup.properties.options.properties.json.const, true);
  assert.equal(setup.properties.options.properties.timeout.pattern, '^[0-9]+$');
  assert.deepEqual(schema.result.properties.status.enum, ['ok', 'planned', 'applied', 'unchanged', 'blocked', 'cancelled', 'failed']);
  assert.deepEqual(schema.result.properties.diagnostics.items.required, ['code', 'message']);
});


test('relocated framework contracts preserve option, failure and compiler diagnostic semantics', () => {
  assert.equal(frameworkStringOption({}, 'profile'), undefined);
  assert.equal(frameworkStringOption({ profile: 'browser' }, 'profile'), 'browser');
  assert.throws(() => frameworkStringOption({ profile: true }, 'profile'), error => error.code === 'INVALID_OPTION');
  frameworkRequireThat(true, 'IGNORED', 'ignored');
  assert.throws(() => frameworkRequireThat(false, 'REQUIRED', 'Required.'), error => error.code === 'REQUIRED');

  const operation = new FrameworkOperationError('EXAMPLE', 'Example failed.', 'status');
  operation.details = { safe: true };
  const failed = frameworkFailure('example', operation);
  assert.equal(failed.status, 'failed');
  assert.deepEqual(failed.data, { safe: true });
  assert.deepEqual(failed.diagnostics, [{ code: 'EXAMPLE', message: 'Example failed.', next: 'status' }]);

  assert.equal(frameworkFailure('example', new FrameworkOperationError('CANCELLED', 'Cancelled.')).status, 'cancelled');
  assert.equal(frameworkFailure('example', new Error('PLAN_STALE: changed')).diagnostics[0].code, 'PLAN_STALE');
  assert.equal(frameworkFailure('example', 'not an error').diagnostics[0].code, 'OPERATION_FAILED');

  const reportError = new Error('PLAN_FAILED');
  Object.defineProperty(reportError, 'report', { value: {
    status: 'failed',
    written: ['a', 42, 'b'],
    preserved: ['c'],
    recoveryPath: '.codex-authoring.lock',
    get cause() { throw new Error('must not execute'); },
  } });
  assert.deepEqual(frameworkFailure('example', reportError).data, {
    recovery: { status: 'failed', written: ['a', 'b'], preserved: ['c'], recoveryPath: '.codex-authoring.lock' },
    automaticRetry: false,
  });

  const cancelledDiagnostic = compilerDiagnostic('COMPILER_CANCELLED', 'emit', 'Cancelled compiler.');
  assert.equal(frameworkFailure('compiler check', new CompilerError(cancelledDiagnostic)).status, 'cancelled');
  const diagnostics = [
    compilerDiagnostic('COMPILER_SCHEMA_INVALID', 'validate', 'Invalid one.'),
    compilerDiagnostic('COMPILER_REFERENCE_MISSING', 'resolve', 'Missing two.'),
  ];
  assert.deepEqual(frameworkFailure('compiler check', new CompilationFailure(diagnostics)).diagnostics, diagnostics);
});
