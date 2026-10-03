import { assert, realpath, mkdtemp, readFile, writeFile, mkdir, rm, tmpdir, join, PassThrough, Readable, studio, prototypeWizard, loadGuide, execute, parseArguments, checkSteps, runCheckSteps, checkOperation, outputTail, assertJsonData, parseJsonData, operationResult, ask, readInput, routeArguments, renderCliResult, interactiveRun, frameworkMain, processOperation, frameworkOperation, frameworkDescriptor, frameworkParameterKinds, parseFrameworkArguments, frameworkSuggestions, frameworkDidYouMean, prototypeCommands, operationSchemas, frameworkFailure, frameworkStringOption, FrameworkOperationError, frameworkRequireThat, CompilerError, CompilationFailure, compilerDiagnostic, relocatedHash, relocatedReadBounded, relocatedProjectRoot, relocatedExists, relocatedConfiguration, relocatedDefaults, relocatedIdentity, relocatedResolveImport, relocatedNpmEntry, relocatedRunNode, relocatedHandoutPlan, relocatedHandoutRead, applySharedFilePlan, relocatedProjectContractOperation, relocatedMeasureProject, relocatedSampleSummary, relocatedMeasureOperation, relocatedSupportSnapshot, relocatedSupportReport, relocatedUnavailableSupport, relocatedStatus, relocatedReleaseCheck, relocatedPortableFile, relocatedZip, relocatedPluginIdWordProblem, relocatedDerivedPluginId, relocatedPluginIdProblem, relocatedExportedIdProblem, relocatedExportedIdWarning, relocatedStorybookFlags, relocatedTerminalStyle, relocatedMarker, relocatedBold, relocatedRows, relocatedDuration, relocatedRunnable, relocatedNextLine, relocatedCommandHelp, relocatedHelpIndex, relocatedHelpText, relocatedSetupDocumentation, relocatedDocsParserFiles, relocatedExportedProject, relocatedStorybookOperation, relocatedAirshipPlan, relocatedAirshipEnvironment, relocatedAirshipOperation, relocatedBuildClickdummy, relocatedDocsRead, relocatedDocsPlan, relocatedFixtureOperation, relocatedGuidedSetup, relocatedContinueSetup, relocatedGuidedStarter, relocatedStarterText, relocatedRenderHuman, relocatedSetupSnapshot, relocatedStarterDerivedId, relocatedStarterDerivedName, relocatedInvocationDirectory, test, frameworkRoot, scripted, contents } from '../support/interactive-maker-parity-support.mjs';
import { resolve } from 'node:path';
import { starterDocumentText } from '../support/starter-documents.mjs';

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
    // The trailing 'n' declines the optional Claude Design folder; the prepared package stays byte-identical.
    const wizard = scripted([...answers, 'prepared', 'y', 'n']);
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

test('single bin router preserves canonical surface ownership without retired maker aliases', () => {
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
    [['make', 'project', '../app'], 'framework', ['make', 'project', '../app']],
    [['make', 'prototype', '--help'], 'framework', ['make', 'prototype', '--help']],
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
    await writeFile(join(root, 'project.json'), starterDocumentText('companion-plugin'));
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



test('relocated starter orchestration preserves compatibility helpers', () => {
  assert.equal(relocatedStarterDerivedId('/tmp/My Project', 'blank'), 'my-project');
  assert.equal(relocatedStarterDerivedName('my-project'), 'My Project');
  assert.equal(relocatedInvocationDirectory('child', { npm_lifecycle_event: 'new', INIT_CWD: '/workspace' }, '/ignored'), resolve('/workspace/child'));
});


test('relocated daily check gate preserves compatibility and execution semantics', async () => {
  assert.equal(outputTail('a\n\u001b[31mb\u001b[0m\nc', 2), 'b\nc');

  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-check-gate-'));
  try {
    await mkdir(join(root, 'bin'), { recursive: true });
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'bin/app.ts'), 'export {};');
    await mkdir(join(root, 'configs/types'), { recursive: true }); await writeFile(join(root, 'configs/types/tsconfig.maker.json'), '{}');
    await writeFile(join(root, 'src/a.ts'), 'export const a = 1;');

    const full = await checkSteps(root, false);
    assert.ok(full.steps.some(step => step.id === 'maker-types'));
    assert.ok(full.steps.some(step => step.id === 'maker-tests'));

    const changed = await checkSteps(root, true, async (_root, args) => args[0] === 'diff' ? 'M\0src/a.ts\0' : '');
    assert.deepEqual(changed.changes.files, ['src/a.ts']);
    assert.deepEqual(changed.steps.find(step => step.id === 'test').args.slice(0, 3), ['related', '--run', '--passWithNoTests']);

    const unavailable = await checkSteps(root, true, async () => null);
    assert.equal(unavailable.changes.source, 'unavailable');
    assert.deepEqual(unavailable.steps.find(step => step.id === 'test').args, ['run', '--config', 'configs/testing/vitest.config.mjs']);

    const progress = [];
    const fakeRun = async (_context, entry) => {
      if (entry === 'fail.mjs') {
        const error = new FrameworkOperationError('PROCESS_FAILED', 'failed');
        error.details = { execution: { exitCode: 7 } };
        throw error;
      }
      if (entry === 'missing.mjs') throw new FrameworkOperationError('TOOL_MISSING', 'missing');
      return { exitCode: 0, signal: null, truncated: false, stdout: '' };
    };
    const outcomes = await runCheckSteps([
      { id: 'pass', display: 'pass', entry: 'pass.mjs', args: [] },
      { id: 'fail', display: 'fail', entry: 'fail.mjs', args: [] },
      { id: 'skip', display: 'skip', entry: 'skip.mjs', args: [], skip: 'not needed' },
      { id: 'missing', display: 'missing', entry: 'missing.mjs', args: [] },
    ], { root, frameworkRoot, progress: text => progress.push(text) }, 1000, fakeRun);
    assert.deepEqual(outcomes.map(step => [step.id, step.status]), [['pass', 'passed'], ['fail', 'failed'], ['skip', 'skipped'], ['missing', 'failed']]);
    assert.equal(outcomes[1].exitCode, 7);
    assert.equal(outcomes[3].code, 'TOOL_MISSING');
    assert.ok(progress.every(text => text.startsWith('check: ')));

    const dry = await checkOperation(
      { command: 'check', args: [], options: { 'dry-run': true } },
      { root, frameworkRoot },
      fakeRun,
      async () => null,
    );
    assert.equal(dry.status, 'planned');
    assert.equal(dry.data.execution, 'not-run');

    const controller = new AbortController();
    controller.abort();
    const cancelled = await checkOperation(
      { command: 'check', args: [], options: {} },
      { root, frameworkRoot, signal: controller.signal },
      fakeRun,
      async () => null,
    );
    assert.equal(cancelled.status, 'cancelled');
    assert.ok(cancelled.data.steps.every(step => step.status === 'skipped'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
