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

test('relocated CLI help metadata and tiered rendering preserve command guidance', () => {
  assert.equal(legacyHelpText.commandHelp, relocatedCommandHelp);
  assert.equal(legacyHelpText.helpIndex, relocatedHelpIndex);
  assert.equal(legacyTerminalHelp.helpText, relocatedHelpText);

  const statusDescriptor = frameworkDescriptor('status');
  const statusHelp = relocatedCommandHelp(statusDescriptor);
  assert.equal(statusHelp.group, 'inspect');
  assert.match(statusHelp.usage, /status/);
  assert.ok(statusHelp.examples.length > 0);
  statusHelp.examples.push('mutated');
  assert.equal(relocatedCommandHelp(statusDescriptor).examples.includes('mutated'), false);

  const devHelp = relocatedCommandHelp(frameworkDescriptor('dev'));
  assert.deepEqual(devHelp.optionHelp.profile.values, ['obsidian', 'ui']);
  assert.equal(devHelp.optionHelp.timeout.default, '3600000');

  const resumeHelp = relocatedCommandHelp(frameworkDescriptor('setup resume'));
  assert.deepEqual(resumeHelp.optionHelp.stage.values, ['generate', 'install', 'verify', 'preview']);
  const schemaHelp = relocatedCommandHelp(frameworkDescriptor('project schema'));
  assert.deepEqual(schemaHelp.optionHelp.version.values, ['6']);
  assert.equal(schemaHelp.optionHelp.version.default, '6');

  const index = relocatedHelpIndex();
  assert.ok(index.commandCount > 20);
  assert.ok(index.groups.some(group => group.id === 'inspect'));
  const page = { ...statusHelp, id: statusDescriptor.id, summary: statusDescriptor.summary,
    effect: statusDescriptor.effect, options: statusDescriptor.options };
  const plain = { color: false, unicode: false };

  const command = relocatedHelpText(plain, { scope: 'command', commands: [page],
    goldenPath: index.goldenPath, groups: index.groups });
  assert.match(command, /Usage/);
  assert.match(command, /Common options/);
  assert.match(command, /Effect: read/);

  const golden = relocatedHelpText(plain, { scope: 'golden-path', commands: [page],
    goldenPath: index.goldenPath, groups: index.groups });
  assert.match(golden, /Golden path/);
  assert.match(golden, /More commands/);

  const all = relocatedHelpText(plain, { scope: 'all', commands: [page],
    goldenPath: index.goldenPath, groups: [{ id: 'inspect', title: 'Inspect', commands: ['status'] }] });
  assert.match(all, /Inspect/);
  assert.match(all, /status/);
});


test('relocated documentation setup preserves decline, cancel and hash-bound apply flow', async () => {
  assert.equal(legacyDocsSetup.setupDocumentation, relocatedSetupDocumentation);
  const context = { root: frameworkRoot, frameworkRoot };
  const current = operationResult('setup', { ready: true }, 'ok');

  let executeCalls = 0;
  const declined = await relocatedSetupDocumentation('import', current, context, async () => {
    executeCalls++; return operationResult('docs import', null, 'planned');
  }, async () => 'no', () => {});
  assert.equal(declined, current);
  assert.equal(executeCalls, 0);

  const noPlan = operationResult('docs export', { reason: 'blocked' }, 'blocked');
  const renderedNoPlan = [];
  const stopped = await relocatedSetupDocumentation('export', current, context, async request => {
    assert.equal(request.command, 'docs export');
    return noPlan;
  }, async () => 'yes', value => renderedNoPlan.push(value));
  assert.equal(stopped, noPlan);
  assert.deepEqual(renderedNoPlan, [noPlan]);

  const planned = operationResult('docs import', { planHash: 'abc123' }, 'planned');
  const renderedCancelled = [];
  const answers = ['yes', 'docs/application', 'no'];
  const cancelled = await relocatedSetupDocumentation('import', current, context, async request => {
    assert.deepEqual(request.args, ['docs/application']);
    return planned;
  }, async () => answers.shift(), value => renderedCancelled.push(value));
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(renderedCancelled, [planned]);

  const calls = [];
  const applied = operationResult('docs export', { written: ['docs/application/index.md'] }, 'applied');
  const yes = ['yes', 'yes'];
  const outcome = await relocatedSetupDocumentation('export', current, context, async request => {
    calls.push(request);
    return calls.length === 1 ? planned : applied;
  }, async () => yes.shift(), () => {});
  assert.equal(outcome, applied);
  assert.deepEqual(calls[1].options, { apply: 'abc123', yes: true });
});


test('relocated documentation parser packaging preserves exact pin and allowlist semantics', async () => {
  assert.equal(legacyDocsVendor.docsParserFiles, relocatedDocsParserFiles);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-docs-vendor-')));
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { yaml: '2.9.1' } }));
    await mkdir(join(root, 'node_modules/yaml/dist'), { recursive: true });
    await writeFile(join(root, 'node_modules/yaml/package.json'), JSON.stringify({ version: '2.9.1' }));
    await writeFile(join(root, 'node_modules/yaml/LICENSE'), 'license');
    await writeFile(join(root, 'node_modules/yaml/dist/index.js'), 'export const yaml = true;\n');
    await writeFile(join(root, 'node_modules/yaml/dist/schema.json'), '{}');
    await writeFile(join(root, 'node_modules/yaml/dist/readme.md'), 'not packaged');

    const files = await relocatedDocsParserFiles(root);
    const paths = files.map(file => file.path).sort();
    assert.deepEqual(paths, [
      '.framework/compiled/node_modules/yaml/LICENSE',
      '.framework/compiled/node_modules/yaml/dist/index.js',
      '.framework/compiled/node_modules/yaml/dist/schema.json',
      '.framework/compiled/node_modules/yaml/package.json',
    ]);
    assert.equal(files.find(file => file.path.endsWith('/LICENSE')).bytes.toString('utf8'), 'license');

    await writeFile(join(root, 'node_modules/yaml/package.json'), JSON.stringify({ version: '2.9.0' }));
    await assert.rejects(relocatedDocsParserFiles(root), error => error.code === 'DOCS_PARSER_VERSION');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated exported-project intake preserves bounded data and identity semantics', async () => {
  assert.equal(legacyProjectFrom.exportedProject, relocatedExportedProject);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-project-from-')));
  try {
    const source = JSON.parse(await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8'));
    await writeFile(join(root, 'project.json'), JSON.stringify(source));
    const context = { root, frameworkRoot };
    const baseRequest = { command: 'new', args: [], options: { from: 'project.json' } };

    const loaded = await relocatedExportedProject(baseRequest, context, () => null);
    assert.equal(loaded.document.schemaVersion, source.schemaVersion);
    assert.equal(loaded.source.file, 'project.json');
    assert.match(loaded.source.sha256, /^[a-f0-9]{64}$/);

    const overridden = await relocatedExportedProject({
      ...baseRequest, options: { ...baseRequest.options, id: 'field-notes', name: 'Field Notes', author: 'Example' },
    }, context, () => null);
    assert.equal(overridden.document.project.id, 'field-notes');
    assert.equal(overridden.document.project.name, 'Field Notes');
    assert.equal(overridden.document.project.author, 'Example');

    await assert.rejects(relocatedExportedProject({ command: 'new', args: [], options: {} }, context, () => null),
      error => error.code === 'PROJECT_FILE_REQUIRED');
    await assert.rejects(relocatedExportedProject({ ...baseRequest, options: { from: 'missing.json' } }, context, () => null),
      error => error.code === 'PROJECT_FILE_NOT_FOUND');

    await writeFile(join(root, 'bad.json'), '{');
    await assert.rejects(relocatedExportedProject({ ...baseRequest, options: { from: 'bad.json' } }, context, () => null),
      error => error.code === 'PROJECT_JSON_MALFORMED');

    await writeFile(join(root, 'future.json'), JSON.stringify({ ...source, schemaVersion: Number(source.schemaVersion) + 100 }));
    await assert.rejects(relocatedExportedProject({ ...baseRequest, options: { from: 'future.json' } }, context, () => null),
      error => error.code === 'PROJECT_VERSION_UNSUPPORTED');

    await assert.rejects(relocatedExportedProject(baseRequest, context, () => 'reserved ID'),
      error => error.code === 'INVALID_PLUGIN_ID');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated Storybook lifecycle preserves planning, install and execution boundaries', async () => {
  assert.equal(legacyStorybook.storybookOperation, relocatedStorybookOperation);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-storybook-')));
  try {
    const context = { root, frameworkRoot };
    const status = await relocatedStorybookOperation({ command: 'storybook status', args: [], options: {} }, context);
    assert.equal(status.status, 'ok');
    assert.equal(status.data.enabled, false);
    assert.equal(status.data.configuration, false);
    assert.equal(status.data.lock, 'absent');

    await assert.rejects(
      relocatedStorybookOperation({ command: 'storybook unknown', args: [], options: {} }, context),
      error => error.code === 'STORYBOOK_COMMAND_UNKNOWN',
    );
    await assert.rejects(
      relocatedStorybookOperation({ command: 'storybook install', args: [], options: {} }, context),
      error => error.code === 'STORYBOOK_DISABLED',
    );

    const source = JSON.parse(await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8'));
    source.tooling = { ...(source.tooling ?? {}), storybook: { enabled: true, generateStories: true } };
    await mkdir(join(root, 'design'));
    await writeFile(join(root, 'design/project.json'), JSON.stringify(source));
    await mkdir(join(root, 'storybook'));
    await writeFile(join(root, 'storybook/package.json'), JSON.stringify({ devDependencies: { storybook: '1.0.0' } }));

    const installPlan = await relocatedStorybookOperation({ command: 'storybook install', args: [], options: {} }, context);
    assert.equal(installPlan.status, 'planned');
    assert.deepEqual(installPlan.data.args, ['install', '--no-fund']);
    assert.equal(installPlan.data.firstInstall, true);

    const calls = [];
    const executor = {
      npm: async () => '/virtual/npm-cli.js',
      run: async (ctx, entry, args, timeout, env) => {
        calls.push({ ctx, entry, args, timeout, env });
        return { exitCode: 0, signal: null, truncated: false, stdout: '' };
      },
    };
    const installed = await relocatedStorybookOperation(
      { command: 'storybook install', args: [], options: { yes: true } }, context, executor,
    );
    assert.equal(installed.status, 'applied');
    assert.equal(calls[0].ctx.root, join(root, 'storybook'));
    assert.equal(calls[0].entry, '/virtual/npm-cli.js');
    assert.deepEqual(calls[0].args, ['install', '--no-fund']);

    await assert.rejects(
      relocatedStorybookOperation({ command: 'storybook check', args: [], options: {} }, context, executor),
      error => error.code === 'STORYBOOK_INSTALL_REQUIRED',
    );

    const lock = {
      packages: {
        '': { devDependencies: { storybook: '1.0.0' } },
        'node_modules/storybook': { version: '1.0.0' },
      },
    };
    await writeFile(join(root, 'storybook/package-lock.json'), JSON.stringify(lock));
    await mkdir(join(root, 'storybook/node_modules/storybook/dist/bin'), { recursive: true });
    await writeFile(join(root, 'storybook/node_modules/storybook/dist/bin/dispatcher.js'), 'export {};\n');

    const checked = await relocatedStorybookOperation({ command: 'storybook check', args: [], options: {} }, context, executor);
    assert.equal(checked.status, 'ok');
    assert.equal(calls.at(-1).entry, 'storybook/node_modules/vue-tsc/bin/vue-tsc.js');
    assert.deepEqual(calls.at(-1).args, ['--noEmit', '--project', 'storybook/tsconfig.json']);

    const dev = await relocatedStorybookOperation(
      { command: 'storybook dev', args: [], options: { 'dry-run': true } }, context, executor,
    );
    assert.equal(dev.status, 'planned');
    assert.ok(dev.data.args.includes('--no-open'));
    assert.equal(dev.data.execution, 'not-run');

    lock.packages[''].devDependencies.storybook = '2.0.0';
    await writeFile(join(root, 'storybook/package-lock.json'), JSON.stringify(lock));
    await assert.rejects(
      relocatedStorybookOperation({ command: 'storybook build', args: [], options: {} }, context, executor),
      error => error.code === 'STORYBOOK_LOCK_MISMATCH',
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

