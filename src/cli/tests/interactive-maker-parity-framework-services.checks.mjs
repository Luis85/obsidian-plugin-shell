import { assert, realpath, mkdtemp, writeFile, mkdir, rm, tmpdir, join, PassThrough, Readable, studio, prototypeWizard, loadGuide, execute, parseArguments, checkSteps, assertJsonData, parseJsonData, operationResult, ask, readInput, routeArguments, renderCliResult, interactiveRun, frameworkMain, processOperation, frameworkOperation, frameworkDescriptor, frameworkParameterKinds, parseFrameworkArguments, frameworkSuggestions, frameworkDidYouMean, prototypeCommands, operationSchemas, frameworkFailure, frameworkStringOption, FrameworkOperationError, frameworkRequireThat, CompilerError, CompilationFailure, compilerDiagnostic, relocatedHash, relocatedReadBounded, relocatedProjectRoot, relocatedExists, relocatedConfiguration, relocatedDefaults, relocatedIdentity, relocatedResolveImport, relocatedNpmEntry, relocatedRunNode, relocatedHandoutPlan, relocatedHandoutRead, applySharedFilePlan, relocatedProjectContractOperation, relocatedMeasureProject, relocatedSampleSummary, relocatedMeasureOperation, relocatedSupportSnapshot, relocatedSupportReport, relocatedUnavailableSupport, relocatedStatus, relocatedReleaseCheck, relocatedPortableFile, relocatedZip, relocatedPluginIdWordProblem, relocatedDerivedPluginId, relocatedPluginIdProblem, relocatedExportedIdProblem, relocatedExportedIdWarning, relocatedStorybookFlags, relocatedTerminalStyle, relocatedMarker, relocatedBold, relocatedRows, relocatedDuration, relocatedRunnable, relocatedNextLine, relocatedCommandHelp, relocatedHelpIndex, relocatedHelpText, relocatedSetupDocumentation, relocatedBundledNoticeFiles, relocatedExportedProject, relocatedStorybookOperation, relocatedAirshipPlan, relocatedAirshipEnvironment, relocatedAirshipOperation, relocatedBuildClickdummy, relocatedDocsRead, relocatedDocsPlan, relocatedFixtureOperation, relocatedGuidedSetup, relocatedContinueSetup, relocatedGuidedStarter, relocatedStarterText, relocatedRenderHuman, relocatedSetupSnapshot, test, frameworkRoot, scripted, contents } from './support/interactive-maker-parity-support.mjs';
import { starterDocumentText } from '../../../tests/support/starter-documents.mjs';

test('relocated Airship planning preserves reviewed enable/disable and ownership safeguards', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-airship-plan-')));
  try {
    const source = JSON.parse(starterDocumentText('companion-plugin'));
    await mkdir(join(root, 'design'));
    await writeFile(join(root, 'design/project.json'), JSON.stringify(source));
    const context = { root, frameworkRoot };

    const enabled = await relocatedAirshipPlan({
      command: 'airship enable', args: [], options: { agent: 'codex', 'target-port': '6200', port: '6201' },
    }, context);
    assert.equal(enabled.conflicts.length, 0);
    assert.equal(enabled.summary.airship.enabled, true);
    assert.equal(enabled.summary.airship.agent, 'codex');
    assert.equal(enabled.summary.airship.targetPort, 6200);
    assert.equal(enabled.summary.airship.port, 6201);
    assert.ok(enabled.plan.changes.some(change => change.path === 'design/project.json'));
    assert.ok(enabled.plan.changes.some(change => change.path === 'airship.config.json'));
    assert.match(enabled.summary.next, /airship install --yes/);

    const disabled = await relocatedAirshipPlan({ command: 'airship disable', args: [], options: {} }, context);
    assert.equal(disabled.summary.airship.enabled, false);
    assert.equal(disabled.plan.changes.some(change => change.path === 'airship.config.json'), false);
    assert.match(disabled.summary.next, /Stop existing sessions/);

    await writeFile(join(root, 'airship.config.json'), JSON.stringify({ custom: true }));
    await assert.rejects(
      relocatedAirshipPlan({ command: 'airship enable', args: [], options: {} }, context),
      error => error.code === 'AIRSHIP_CONFIG_CONFLICT',
    );
    await rm(join(root, 'airship.config.json'));

    await mkdir(join(root, '.companion'));
    await writeFile(join(root, '.companion/generation.json'), JSON.stringify({
      version: 1, projectId: source.project.id, files: [],
    }));
    await assert.rejects(
      relocatedAirshipPlan({ command: 'airship enable', args: [], options: {} }, context),
      error => error.code === 'AIRSHIP_OWNERSHIP',
    );
    await rm(join(root, '.companion/generation.json'));

    await mkdir(join(root, '.framework'));
    await writeFile(join(root, '.framework/intake.json'), JSON.stringify({ schemaVersion: 1, files: {} }));
    await assert.rejects(
      relocatedAirshipPlan({ command: 'airship enable', args: [], options: {} }, context),
      error => error.code === 'AIRSHIP_OWNERSHIP',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated Airship execution preserves opt-in, pinned install and safe launch policy', async () => {
  assert.deepEqual(relocatedAirshipEnvironment({ AIRSHIP_TOKEN: 'secret', airship_extra: 'x', OTHER: 'keep' }), {
    AIRSHIP_TOKEN: undefined, airship_extra: undefined,
  });

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-airship-operation-')));
  try {
    const source = JSON.parse(starterDocumentText('companion-plugin'));
    await mkdir(join(root, 'design'));
    await writeFile(join(root, 'design/project.json'), JSON.stringify(source));
    const context = { root, frameworkRoot };

    const status = await relocatedAirshipOperation({ command: 'airship status', args: [], options: {} }, context);
    assert.equal(status.status, 'ok');
    assert.equal(status.data.enabled, false);
    assert.equal(status.data.installedVersion, null);

    await assert.rejects(
      relocatedAirshipOperation({ command: 'airship install', args: [], options: { yes: true } }, context),
      error => error.code === 'AIRSHIP_DISABLED',
    );

    source.tooling = { ...(source.tooling ?? {}), airship: {
      enabled: true, agent: 'codex', targetPort: 6200, port: 6201,
    } };
    await writeFile(join(root, 'design/project.json'), JSON.stringify(source));

    const planned = await relocatedAirshipOperation({ command: 'airship install', args: [], options: {} }, context);
    assert.equal(planned.status, 'planned');
    assert.equal(planned.data.requires, '--yes');
    assert.equal(planned.data.execution, 'not-run');

    const calls = [];
    const executor = {
      npm: async () => '/virtual/npm-cli.js',
      run: async (ctx, entry, args, timeout, env) => {
        calls.push({ ctx, entry, args, timeout, env });
        if (args[0] === 'install') {
          const pkg = join(root, '.airship-tooling/node_modules/@airshiplabs/cli/package.json');
          await mkdir(join(root, '.airship-tooling/node_modules/@airshiplabs/cli'), { recursive: true });
          await writeFile(pkg, JSON.stringify({ name: '@airshiplabs/cli', version: '0.3.0' }));
        }
        return { exitCode: 0, signal: null, truncated: false, stdout: '' };
      },
    };
    const installed = await relocatedAirshipOperation(
      { command: 'airship install', args: [], options: { yes: true, timeout: '12345' } }, context, executor,
    );
    assert.equal(installed.status, 'applied');
    assert.equal(installed.data.installedVersion, '0.3.0');
    assert.equal(calls[0].entry, '/virtual/npm-cli.js');
    assert.equal(calls[0].timeout, 12345);
    assert.deepEqual(calls[0].args.slice(0, 3), ['install', '--prefix', '.airship-tooling']);
    assert.equal(calls[0].env.AIRSHIP_TOKEN, undefined);

    const airshipConfig = {
      target: 6200, port: 6201, host: '127.0.0.1', agent: 'codex',
      mode: 'canvas', safe: true, commit: false, open: false,
    };
    await writeFile(join(root, 'airship.config.json'), JSON.stringify(airshipConfig));
    const binary = join(root, '.airship-tooling/node_modules/@airshiplabs/cli/dist/index.js');
    await mkdir(join(root, '.airship-tooling/node_modules/@airshiplabs/cli/dist'), { recursive: true });
    await writeFile(binary, 'export {};\n');

    const doctor = await relocatedAirshipOperation(
      { command: 'airship doctor', args: [], options: { yes: true } }, context, executor,
    );
    assert.equal(doctor.status, 'ok');
    assert.equal(calls.at(-1).entry, '.airship-tooling/node_modules/@airshiplabs/cli/dist/index.js');
    assert.deepEqual(calls.at(-1).args, ['doctor', '--cwd', root, '--target', '6200', '--agent', 'codex']);

    const start = await relocatedAirshipOperation(
      { command: 'airship start', args: [], options: { yes: true, timeout: '2222' } }, context, executor,
    );
    assert.equal(start.status, 'ok');
    assert.equal(calls.at(-1).timeout, 2222);
    assert.deepEqual(calls.at(-1).args, [
      '--cwd', root, '--target', '6200', '--port', '6201', '--host', '127.0.0.1',
      '--agent', 'codex', '--safe', '--no-commit',
    ]);

    await writeFile(join(root, 'airship.config.json'), JSON.stringify({ ...airshipConfig, port: 9999 }));
    await assert.rejects(
      relocatedAirshipOperation({ command: 'airship doctor', args: [], options: { yes: true } }, context, executor),
      error => error.code === 'AIRSHIP_CONFIG_CONFLICT',
    );

    await writeFile(join(root, '.airship-tooling/node_modules/@airshiplabs/cli/package.json'),
      JSON.stringify({ name: '@airshiplabs/cli', version: '0.2.0' }));
    await assert.rejects(
      relocatedAirshipOperation({ command: 'airship doctor', args: [], options: { yes: true } }, context, executor),
      error => error.code === 'AIRSHIP_NOT_INSTALLED',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated clickdummy build preserves fixed paths, reviewed execution and receipt checks', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-clickdummy-relocated-')));
  try {
    const context = { root, frameworkRoot };
    const calls = [];
    const dependencies = {
      exists: async path => { calls.push(['exists', path]); return true; },
      inspectDesign: async (ctx, input) => {
        calls.push(['inspect', ctx.root, input]);
        return { model: { project: { name: 'Workbench demo' } } };
      },
      runNode: async (ctx, entry, args, timeout) => {
        calls.push(['run', ctx.root, entry, args, timeout]);
        return {
          exitCode: 0,
          signal: null,
          truncated: false,
          stdout: JSON.stringify({ status: 'built-not-browser-verified', output: 'clickdummy.html' }),
        };
      },
    };

    const planned = await relocatedBuildClickdummy(
      { command: 'clickdummy build', args: [], options: { 'dry-run': true } },
      context,
      dependencies,
    );
    assert.equal(planned.status, 'planned');
    assert.equal(planned.data.execution, 'not-run');
    assert.deepEqual(calls, []);

    const built = await relocatedBuildClickdummy(
      { command: 'clickdummy build', args: [], options: { replace: true, timeout: '1234' } },
      context,
      dependencies,
    );
    assert.equal(built.status, 'ok');
    assert.equal(built.data.acceptance, 'not-inferred');
    assert.equal(built.data.receipt.status, 'built-not-browser-verified');
    const run = calls.find(call => call[0] === 'run');
    assert.equal(run[2], '.claude/skills/companion-prototype-design/scripts/lib/build-worker.mjs');
    assert.equal(run[4], 1234);
    assert.ok(run[3].includes('--replace'));
    assert.ok(run[3].includes('Workbench demo'));

    await assert.rejects(
      relocatedBuildClickdummy(
        { command: 'clickdummy build', args: [], options: {} },
        context,
        { ...dependencies, exists: async () => false },
      ),
      error => error.code === 'CLICKDUMMY_PROJECT_REQUIRED',
    );

    await assert.rejects(
      relocatedBuildClickdummy(
        { command: 'clickdummy build', args: [], options: {} },
        context,
        { ...dependencies, runNode: async () => ({ exitCode: 0, signal: null, truncated: true, stdout: '' }) },
      ),
      error => error.code === 'CLICKDUMMY_OUTPUT_LIMIT',
    );

    await assert.rejects(
      relocatedBuildClickdummy(
        { command: 'clickdummy build', args: [], options: {} },
        context,
        { ...dependencies, runNode: async () => ({ exitCode: 0, signal: null, truncated: false, stdout: '{"status":"unexpected"}' }) },
      ),
      error => error.code === 'CLICKDUMMY_RECEIPT',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated documentation adapter preserves schema, read and plan command semantics', async () => {
  const context = { root: frameworkRoot, frameworkRoot };

  const schema = await relocatedDocsRead(
    { command: 'docs schema', args: [], options: {} },
    context,
    {
      documentationStatus: async () => { throw new Error('schema must not load documentation status'); },
      recoverDocuments: async () => { throw new Error('schema must not load recovery'); },
    },
  );
  assert.equal(schema.status, 'ok');
  assert.equal(schema.data.doc_schema, 1);
  assert.ok(schema.data.types.includes('page'));
  assert.ok(schema.data.required.includes('title'));

  const calls = [];
  const recovered = await relocatedDocsRead(
    { command: 'docs recover', args: [], options: { yes: true, apply: 'abc' } },
    context,
    {
      recoverDocuments: async (root, apply, hash) => {
        calls.push(['recover', root, apply, hash]);
        return { data: { recovery: 'ready' }, status: 'planned' };
      },
    },
  );
  assert.equal(recovered.status, 'planned');
  assert.deepEqual(calls[0], ['recover', frameworkRoot, true, 'abc']);

  const dryRecovery = await relocatedDocsRead(
    { command: 'docs recover', args: [], options: { yes: true, 'dry-run': true } },
    context,
    {
      recoverDocuments: async (root, apply, hash) => {
        calls.push(['recover-dry', root, apply, hash]);
        return { data: {}, status: 'planned' };
      },
    },
  );
  assert.equal(dryRecovery.status, 'planned');
  assert.equal(calls.at(-1)[2], false);

  const blocked = await relocatedDocsRead(
    { command: 'docs validate', args: ['docs/application'], options: {} },
    context,
    {
      documentationStatus: async (root, args, validate) => {
        calls.push(['status', root, args, validate]);
        return { conflicts: [], missing: ['page:one'] };
      },
    },
  );
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(calls.at(-1), ['status', frameworkRoot, ['docs/application'], true]);

  const status = await relocatedDocsRead(
    { command: 'docs status', args: [], options: {} },
    context,
    { documentationStatus: async () => ({ conflicts: [], missing: [] }) },
  );
  assert.equal(status.status, 'ok');

  const planned = { plan: 'docs' };
  const exportPlan = await relocatedDocsPlan(
    { command: 'docs export', args: ['page-one'], options: { out: 'specs', resolutions: 'choices.json' } },
    context,
    {
      documentationPlan: async (root, args, mode, options) => {
        calls.push(['plan', root, args, mode, options]);
        return planned;
      },
    },
  );
  assert.equal(exportPlan, planned);
  assert.deepEqual(calls.at(-1), [
    'plan',
    frameworkRoot,
    ['page-one'],
    'export',
    { out: 'specs', resolutions: 'choices.json' },
  ]);

  await relocatedDocsPlan(
    { command: 'docs import', args: [], options: {} },
    context,
    {
      documentationPlan: async (root, args, mode, options) => {
        calls.push(['import-plan', root, args, mode, options]);
        return planned;
      },
    },
  );
  assert.equal(calls.at(-1)[3], 'import');
});

