import { assert, realpath, mkdtemp, readFile, writeFile, mkdir, rm, tmpdir, join, PassThrough, Readable, studio, prototypeWizard, loadGuide, execute, parseArguments, checkSteps, assertJsonData, parseJsonData, operationResult, ask, readInput, routeArguments, renderCliResult, interactiveRun, frameworkMain, processOperation, frameworkOperation, frameworkDescriptor, frameworkParameterKinds, parseFrameworkArguments, frameworkSuggestions, frameworkDidYouMean, prototypeCommands, operationSchemas, frameworkFailure, frameworkStringOption, FrameworkOperationError, frameworkRequireThat, CompilerError, CompilationFailure, compilerDiagnostic, relocatedHash, relocatedReadBounded, relocatedProjectRoot, relocatedExists, legacyFrameworkFiles, relocatedConfiguration, relocatedDefaults, relocatedIdentity, relocatedResolveImport, legacyFrameworkConfiguration, relocatedNpmEntry, relocatedRunNode, legacyFrameworkProcess, relocatedTerminateProcessTree, legacyProcessTree, relocatedHandoutPlan, relocatedHandoutRead, legacyHandoutAdapter, applySharedFilePlan, relocatedProjectContractOperation, legacyProjectContract, relocatedMeasureProject, legacyProjectMeasure, relocatedSampleSummary, relocatedMeasureOperation, legacyMeasurement, relocatedSupportSnapshot, relocatedSupportReport, relocatedUnavailableSupport, legacySupportReport, relocatedStatus, relocatedReleaseCheck, legacyInspection, relocatedPortableFile, legacyArchivePath, relocatedZip, legacyZip, relocatedPluginIdWordProblem, relocatedDerivedPluginId, relocatedPluginIdProblem, relocatedExportedIdProblem, relocatedExportedIdWarning, legacyPluginId, relocatedStorybookFlags, relocatedTerminalStyle, relocatedMarker, relocatedBold, relocatedRows, relocatedDuration, relocatedRunnable, relocatedNextLine, legacyTerminalStyle, relocatedCommandHelp, relocatedHelpIndex, legacyHelpText, relocatedHelpText, legacyTerminalHelp, relocatedSetupDocumentation, legacyDocsSetup, relocatedDocsParserFiles, legacyDocsVendor, relocatedExportedProject, legacyProjectFrom, relocatedStorybookOperation, legacyStorybook, relocatedAirshipPlan, legacyAirshipPlan, relocatedAirshipEnvironment, relocatedAirshipOperation, legacyAirship, relocatedBuildClickdummy, legacyClickdummy, relocatedDocsRead, relocatedDocsPlan, legacyDocs, relocatedFixtureOperation, legacyFixtures, relocatedGuidedSetup, relocatedContinueSetup, legacySetupTerminal, relocatedGuidedStarter, relocatedStarterText, legacyStarterTerminal, relocatedRenderHuman, legacyTerminalRender, relocatedSetupSnapshot, legacySetupState, test, frameworkRoot, scripted, contents } from '../support/interactive-maker-parity-support.mjs';

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
  assert.deepEqual(calls.at(-1).args, ['test', '--config', 'configs/testing/playwright.config.ts']);
  assert.equal(calls.at(-1).entry, 'node_modules/@playwright/test/cli.js');

  await processOperation(request('verify', { profile: 'project' }), context, dependencies);
  assert.deepEqual(calls.at(-1).args, ['run', 'verify:project']);
  assert.equal(calls.at(-1).entry, '/qualified/npm-cli.js');

  const preview = await processOperation(request('dev', { profile: 'preview' }), context, dependencies);
  assert.equal(preview.status, 'ok');
  assert.deepEqual(calls.at(-1).args, ['--config', 'configs/bundling/vite.preview.config.mjs']);

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


test('relocated framework filesystem adapter preserves root discovery, bounded reads and compatibility identity', async () => {
  assert.equal(legacyFrameworkFiles.readBounded, relocatedReadBounded);
  assert.equal(legacyFrameworkFiles.projectRoot, relocatedProjectRoot);
  assert.equal(legacyFrameworkFiles.exists, relocatedExists);
  assert.equal(legacyFrameworkFiles.hash, relocatedHash);

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-files-')));
  try {
    await mkdir(join(root, 'nested'));
    await mkdir(join(root, 'bin'));
    await writeFile(join(root, 'bin/app'), 'export {};\n');
    await writeFile(join(root, 'payload.txt'), 'bounded payload\n');
    assert.equal(await relocatedProjectRoot(join(root, 'nested')), root);
    assert.equal(await relocatedProjectRoot(root, true), root);
    assert.equal((await relocatedReadBounded(join(root, 'payload.txt'))).toString('utf8'), 'bounded payload\n');
    assert.equal(relocatedHash('bounded payload\n').length, 64);
    assert.equal(await relocatedExists(join(root, 'payload.txt')), true);
    assert.equal(await relocatedExists(join(root, 'missing.txt')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated framework configuration preserves defaults, validation and compatibility identity', () => {
  assert.equal(legacyFrameworkConfiguration.configuration, relocatedConfiguration);
  assert.equal(legacyFrameworkConfiguration.defaults, relocatedDefaults);
  assert.equal(legacyFrameworkConfiguration.identity, relocatedIdentity);
  assert.equal(legacyFrameworkConfiguration.resolveImport, relocatedResolveImport);

  const project = { id: 'field-notes', name: 'Field Notes', author: 'Example', version: '1.2.3', description: 'Demo' };
  const config = relocatedDefaults(project);
  assert.equal(config.schemaVersion, 1);
  assert.deepEqual(config.paths, {
    codebaseFolder: 'src', testsFolder: 'tests', testVaultFolder: '.test-vault', configDirectory: '.obsidian',
  });
  assert.throws(() => relocatedIdentity({ ...project, id: 'Invalid ID' }), error => error.code === 'INVALID_IDENTITY');
  assert.throws(() => relocatedConfiguration({
    ...config, paths: { ...config.paths, testsFolder: 'src/tests' },
  }), error => error.code === 'CONFIG_OVERLAP');

  const imported = { project: { ...project, name: 'Imported' }, settings: { codebaseFolder: 'app', testsFolder: 'spec' } };
  assert.throws(() => relocatedResolveImport(config, imported), error => error.code === 'IMPORT_CONFLICT');
  const resolved = relocatedResolveImport(config, imported, 'project');
  assert.equal(resolved.config, config);
  assert.equal(resolved.document.project.name, 'Field Notes');
});


test('relocated framework process policy preserves npm selection and child execution diagnostics', async () => {
  assert.equal(legacyFrameworkProcess.npmEntry, relocatedNpmEntry);
  assert.equal(legacyFrameworkProcess.runNode, relocatedRunNode);
  assert.equal(legacyProcessTree.terminateProcessTree, relocatedTerminateProcessTree);

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-process-policy-')));
  const previousQualified = process.env.QUALIFIED_NPM;
  try {
    const npm = join(root, 'npm-cli.js');
    await writeFile(npm, 'export {};\n');
    process.env.QUALIFIED_NPM = npm;
    assert.equal(await relocatedNpmEntry(), npm);

    await writeFile(join(root, 'ok.mjs'), "process.stdout.write('ok');\n");
    const output = await relocatedRunNode({ root, frameworkRoot }, 'ok.mjs', [], 10_000);
    assert.equal(output.exitCode, 0);
    assert.equal(output.stdout, 'ok');

    await writeFile(join(root, 'fail.mjs'), "process.exitCode = 3;\n");
    await assert.rejects(relocatedRunNode({ root, frameworkRoot }, 'fail.mjs', [], 10_000), error => {
      assert.equal(error.code, 'PROCESS_FAILED');
      assert.equal(error.details.execution.exitCode, 3);
      assert.equal(error.details.automaticRetry, false);
      return true;
    });

    await assert.rejects(relocatedRunNode({ root, frameworkRoot }, 'ok.mjs', [], 0), error => error.code === 'INVALID_TIMEOUT');
    await assert.rejects(relocatedRunNode({ root, frameworkRoot }, 'missing.mjs', [], 10_000), error => error.code === 'TOOL_MISSING');
    await writeFile(join(root, 'hang.mjs'), "setInterval(() => {}, 1000);\n");
    await assert.rejects(relocatedRunNode({ root, frameworkRoot }, 'hang.mjs', [], 100), error => error.code === 'TIMEOUT');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(relocatedRunNode({ root, frameworkRoot, signal: controller.signal }, 'ok.mjs', [], 10_000), error => error.code === 'CANCELLED');
  } finally {
    if (previousQualified === undefined) delete process.env.QUALIFIED_NPM;
    else process.env.QUALIFIED_NPM = previousQualified;
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated handout adapter preserves reviewed plan and blocked readiness semantics', async () => {
  assert.equal(legacyHandoutAdapter.handoutPlan, relocatedHandoutPlan);
  assert.equal(legacyHandoutAdapter.handoutRead, relocatedHandoutRead);

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-handout-adapter-')));
  try {
    await mkdir(join(root, 'docs/prds'), { recursive: true });
    await writeFile(join(root, 'docs/prds/example.md'), '# Example PRD\n');
    const context = { root, frameworkRoot };
    const request = { command: 'handout generate', args: [], options: {} };
    const planned = await relocatedHandoutPlan(request, context);
    assert.equal(planned.conflicts.length, 0);
    assert.ok(planned.plan.changes.some(change => change.path === 'PROJECT-SETUP-HANDOUT.md' && change.status === 'create'));

    const applied = await applySharedFilePlan(planned.plan);
    assert.deepEqual(applied.written, ['PROJECT-SETUP-HANDOUT.md']);

    const validated = await relocatedHandoutRead({ command: 'handout validate', args: [], options: {} }, context);
    assert.equal(validated.status, 'blocked');
    assert.ok(validated.diagnostics.some(item => item.code === 'HANDOUT_REQUIRED_OPEN'));

    const inspected = await relocatedHandoutRead({ command: 'handout inspect', args: [], options: {} }, context);
    assert.equal(inspected.status, 'blocked');
    assert.ok(Array.isArray(inspected.data.answers));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated project contract preserves schema publication and stdin validation', async () => {
  assert.equal(legacyProjectContract.projectContractOperation, relocatedProjectContractOperation);
  const context = { root: frameworkRoot, frameworkRoot };

  const schema = await relocatedProjectContractOperation({ command: 'project schema', args: [], options: {} }, context);
  assert.equal(schema.status, 'ok');
  assert.equal(schema.command, 'project schema');
  assert.equal(typeof schema.data, 'object');
  await assert.rejects(
    relocatedProjectContractOperation({ command: 'project schema', args: [], options: { version: '5' } }, context),
    error => error.code === 'SCHEMA_VERSION',
  );

  const inputText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');
  const validated = await relocatedProjectContractOperation(
    { command: 'project validate', args: [], options: { input: '-' } },
    { ...context, inputText },
  );
  assert.equal(validated.status, 'ok');
  assert.equal(validated.data.valid, true);
  assert.equal(validated.data.normalizedVersion, 6);
  assert.equal(validated.data.contentIncluded, false);
  assert.match(validated.data.inputSha256, /^[a-f0-9]{64}$/);
});

