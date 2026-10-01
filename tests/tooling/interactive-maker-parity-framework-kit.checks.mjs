import {
  assert,
  realpath,
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  readdir,
  tmpdir,
  join,
  resolve,
  PassThrough,
  Readable,
  studio,
  prototypeWizard,
  loadGuide,
  execute,
  parseArguments,
  checkSteps,
  assertJsonData,
  parseJsonData,
  operationResult,
  ask,
  readInput,
  routeArguments,
  renderCliResult,
  interactiveRun,
  frameworkMain,
  processOperation,
  frameworkOperation,
  frameworkDescriptor,
  frameworkParameterKinds,
  parseFrameworkArguments,
  frameworkSuggestions,
  frameworkDidYouMean,
  prototypeCommands,
  operationSchemas,
  frameworkFailure,
  frameworkStringOption,
  FrameworkOperationError,
  frameworkRequireThat,
  CompilerError,
  CompilationFailure,
  compilerDiagnostic,
  relocatedHash,
  relocatedReadBounded,
  relocatedProjectRoot,
  relocatedExists,
  legacyFrameworkFiles,
  relocatedConfiguration,
  relocatedDefaults,
  relocatedIdentity,
  relocatedResolveImport,
  legacyFrameworkConfiguration,
  relocatedNpmEntry,
  relocatedRunNode,
  legacyFrameworkProcess,
  relocatedTerminateProcessTree,
  legacyProcessTree,
  relocatedHandoutPlan,
  relocatedHandoutRead,
  legacyHandoutAdapter,
  applySharedFilePlan,
  relocatedProjectContractOperation,
  legacyProjectContract,
  relocatedMeasureProject,
  legacyProjectMeasure,
  relocatedSampleSummary,
  relocatedMeasureOperation,
  legacyMeasurement,
  relocatedSupportSnapshot,
  relocatedSupportReport,
  relocatedUnavailableSupport,
  legacySupportReport,
  relocatedStatus,
  relocatedReleaseCheck,
  legacyInspection,
  relocatedPortableFile,
  legacyArchivePath,
  relocatedZip,
  legacyZip,
  relocatedPluginIdWordProblem,
  relocatedDerivedPluginId,
  relocatedPluginIdProblem,
  relocatedExportedIdProblem,
  relocatedExportedIdWarning,
  legacyPluginId,
  relocatedStorybookFlags,
  legacyStorybookOptions,
  relocatedTerminalStyle,
  relocatedMarker,
  relocatedBold,
  relocatedRows,
  relocatedDuration,
  relocatedRunnable,
  relocatedNextLine,
  legacyTerminalStyle,
  relocatedCommandHelp,
  relocatedHelpIndex,
  legacyHelpText,
  relocatedHelpText,
  legacyTerminalHelp,
  relocatedSetupDocumentation,
  legacyDocsSetup,
  relocatedDocsParserFiles,
  legacyDocsVendor,
  relocatedExportedProject,
  legacyProjectFrom,
  relocatedStorybookOperation,
  legacyStorybook,
  relocatedAirshipPlan,
  legacyAirshipPlan,
  relocatedAirshipEnvironment,
  relocatedAirshipOperation,
  legacyAirship,
  relocatedBuildClickdummy,
  legacyClickdummy,
  relocatedDocsRead,
  relocatedDocsPlan,
  legacyDocs,
  relocatedFixtureOperation,
  legacyFixtures,
  relocatedGuidedSetup,
  relocatedContinueSetup,
  legacySetupTerminal,
  relocatedGuidedStarter,
  relocatedStarterText,
  legacyStarterTerminal,
  relocatedRenderHuman,
  legacyTerminalRender,
  relocatedSetupSnapshot,
  legacySetupState,
  relocatedSetupProgress,
  legacySetupProgress,
  relocatedKitManifest,
  relocatedListKitFiles,
  relocatedVerifyKit,
  relocatedBootstrapFiles,
  legacyKitIntegrity,
  relocatedDistributedIncluded,
  relocatedStandaloneSource,
  relocatedUpdateOwnership,
  legacyDistribution,
  test,
  frameworkRoot,
  scripted,
  contents
} from '../support/interactive-maker-parity-support.mjs';

test('relocated setup-progress preserves status, approval and persisted attempt semantics', async () => {
  assert.equal(legacySetupProgress.setupProgress, relocatedSetupProgress);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-setup-progress-relocated-')));
  try {
    const context = { root, frameworkRoot };
    const setup = await frameworkOperation({
      command: 'setup', args: [],
      options: { id: 'progress-demo', name: 'Progress Demo', author: 'Example', blank: true, yes: true },
    }, context);
    assert.equal(setup.status, 'applied', JSON.stringify(setup));

    const status = await relocatedSetupProgress(
      { command: 'setup status', args: [], options: {} },
      context,
      async () => { throw new Error('status must not execute a stage'); },
    );
    assert.equal(status.status, 'ok');
    assert.match(status.data.resumeHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(status.data.attempts, []);

    const planned = await relocatedSetupProgress(
      { command: 'setup resume', args: [], options: { stage: 'generate' } },
      context,
      async () => { throw new Error('unapproved resume must not execute a stage'); },
    );
    assert.equal(planned.status, 'planned');
    assert.equal(planned.data.execution, 'not-run');

    await assert.rejects(
      relocatedSetupProgress(
        { command: 'setup resume', args: [], options: { stage: 'unknown' } },
        context,
        async () => operationResult('generate', {}),
      ),
      error => error.code === 'SETUP_STAGE_REQUIRED',
    );

    await assert.rejects(
      relocatedSetupProgress(
        { command: 'setup resume', args: [], options: { stage: 'generate', yes: true, 'resume-hash': '0'.repeat(64) } },
        context,
        async () => operationResult('generate', {}),
      ),
      error => error.code === 'SETUP_INPUT_CHANGED',
    );

    let calls = 0;
    const applied = await relocatedSetupProgress(
      { command: 'setup resume', args: [], options: { stage: 'generate', yes: true, 'resume-hash': status.data.resumeHash } },
      context,
      async request => {
        calls++;
        assert.equal(request.command, 'generate');
        return operationResult('generate', { synthetic: true }, 'applied');
      },
    );
    assert.equal(applied.status, 'applied');
    assert.equal(calls, 1);
    assert.equal(applied.data.selectedStage, 'generate');
    assert.equal(applied.data.attempt.status, 'applied');

    const after = await relocatedSetupProgress(
      { command: 'setup status', args: [], options: {} },
      context,
      async () => { throw new Error('status must not execute'); },
    );
    assert.equal(after.data.attempts.length, 1);
    assert.equal(after.data.attempts[0].stage, 'generate');

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      relocatedSetupProgress(
        { command: 'setup resume', args: [], options: { stage: 'generate', yes: true, 'resume-hash': after.data.resumeHash } },
        { ...context, signal: controller.signal },
        async () => operationResult('generate', {}),
      ),
      error => error.code === 'CANCELLED',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated kit integrity preserves manifest, inventory and tamper checks', async () => {
  assert.equal(legacyKitIntegrity.kitManifest, relocatedKitManifest);
  assert.equal(legacyKitIntegrity.verifyKit, relocatedVerifyKit);
  assert.deepEqual(relocatedBootstrapFiles, ['app.mjs', 'bin/app', 'shell.mjs', 'package.json', 'README.md', 'LICENSE']);

  const digest = value => relocatedHash(typeof value === 'string' ? value : Buffer.from(value));
  const modern = {
    schemaVersion: 1, version: '1.0.0', compilerVersion: '6.0.3', sourceHash: 'a'.repeat(64),
    files: [{ path: '.framework/template/a.txt', hash: 'b'.repeat(64), bytes: 1 }],
    bootstrap: relocatedBootstrapFiles.map(path => ({ path, hash: 'c'.repeat(64) })),
  };
  assert.equal(relocatedKitManifest(modern).version, '1.0.0');
  assert.equal(relocatedKitManifest({
    ...modern,
    bootstrap: ['shell.mjs', 'package.json', 'README.md', 'LICENSE'].map(path => ({ path, hash: 'c'.repeat(64) })),
  }).bootstrap.length, 4);
  assert.throws(() => relocatedKitManifest({ ...modern, sourceHash: 'bad' }), error => error.code === 'KIT_HASH');

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-kit-integrity-relocated-')));
  try {
    await mkdir(join(root, '.framework/template'), { recursive: true });
    await mkdir(join(root, '.framework/compiled'), { recursive: true });
    await mkdir(join(root, 'bin'), { recursive: true });
    const contents = {
      '.framework/template/a.txt': 'template',
      '.framework/compiled/b.js': 'compiled',
      'app.mjs': 'app',
      'bin/app': 'bin',
      'shell.mjs': 'shell',
      'package.json': '{}',
      'README.md': 'readme',
      'LICENSE': 'license',
    };
    for (const [path, content] of Object.entries(contents)) {
      await mkdir(join(root, path.slice(0, Math.max(0, path.lastIndexOf('/')))), { recursive: true }).catch(() => {});
      await writeFile(join(root, path), content);
    }
    assert.deepEqual(await relocatedListKitFiles(root, '.framework/template'), ['.framework/template/a.txt']);

    const files = ['.framework/template/a.txt', '.framework/compiled/b.js'].map(path => ({
      path, hash: digest(contents[path]), bytes: Buffer.byteLength(contents[path]),
    }));
    const bootstrap = relocatedBootstrapFiles.map(path => ({ path, hash: digest(contents[path]) }));
    await writeFile(join(root, '.framework/kit.json'), JSON.stringify({
      schemaVersion: 1, version: '1.0.0', compilerVersion: '6.0.3',
      sourceHash: 'd'.repeat(64), files, bootstrap,
    }));
    const verified = await relocatedVerifyKit(root);
    assert.equal(verified.files.length, 2);

    await writeFile(join(root, '.framework/template/a.txt'), 'tampered');
    await assert.rejects(relocatedVerifyKit(root), error => error.code === 'KIT_MODIFIED');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated distribution policy preserves filtering, adaptation and ownership refresh', () => {
  assert.equal(legacyDistribution.included, relocatedDistributedIncluded);
  assert.equal(legacyDistribution.standaloneSource, relocatedStandaloneSource);
  assert.equal(legacyDistribution.updateOwnership, relocatedUpdateOwnership);

  assert.equal(relocatedDistributedIncluded('src/main.ts'), true);
  assert.equal(relocatedDistributedIncluded('configs/starters/blank.json'), false);
  assert.equal(relocatedDistributedIncluded('docs/concepts/companion/vendor/vue-flow-core.iife.js'), true);

  const readme = Buffer.from('# Reviewed\r\n\r\nSee [prototype](docs/concepts/companion/index.html).\r\n');
  const adapted = relocatedStandaloneSource('README.md', readme);
  const textValue = adapted.toString('utf8');
  assert.match(textValue, /^# Framework developer kit/);
  assert.doesNotMatch(textValue, /\r/);
  assert.match(textValue, /prototype \(prototype asset not included in this kit\)/);

  const analyzer = Buffer.from(JSON.stringify({
    entry: ['src/main.ts', 'configs/starters/blank.json', 'docs/concepts/companion/index.html'],
    rules: {},
  }));
  const analyzerResult = JSON.parse(relocatedStandaloneSource('.fallowrc.json', analyzer).toString('utf8'));
  assert.deepEqual(analyzerResult.entry, ['src/main.ts']);

  const reviewed = Buffer.from('# Reviewed framework README\n');
  const shipped = relocatedStandaloneSource('README.md', reviewed);
  const metadata = Buffer.from(JSON.stringify({
    files: [{ path: 'README.md', sha256: relocatedHash(reviewed) }],
  }));
  const updated = JSON.parse(relocatedUpdateOwnership(
    new Map([['README.md', reviewed]]),
    new Map([['README.md', shipped]]),
    metadata,
  ).toString('utf8'));
  assert.equal(updated.files[0].sha256, relocatedHash(shipped));

  assert.throws(() => relocatedUpdateOwnership(
    new Map([['README.md', Buffer.from('# Edited\n')]]),
    new Map([['README.md', shipped]]),
    metadata,
  ), error => error.code === 'KIT_OWNERSHIP');
});
