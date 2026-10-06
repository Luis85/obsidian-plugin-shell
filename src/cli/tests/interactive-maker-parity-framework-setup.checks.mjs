import { assert, realpath, mkdtemp, readFile, writeFile, mkdir, rm, tmpdir, join, PassThrough, Readable, studio, prototypeWizard, loadGuide, execute, parseArguments, checkSteps, assertJsonData, parseJsonData, operationResult, ask, readInput, routeArguments, renderCliResult, interactiveRun, frameworkMain, processOperation, frameworkOperation, frameworkDescriptor, frameworkParameterKinds, parseFrameworkArguments, frameworkSuggestions, frameworkDidYouMean, prototypeCommands, operationSchemas, frameworkFailure, frameworkStringOption, FrameworkOperationError, frameworkRequireThat, CompilerError, CompilationFailure, compilerDiagnostic, relocatedHash, relocatedReadBounded, relocatedProjectRoot, relocatedExists, relocatedConfiguration, relocatedDefaults, relocatedIdentity, relocatedResolveImport, relocatedNpmEntry, relocatedRunNode, relocatedHandoutPlan, relocatedHandoutRead, applySharedFilePlan, relocatedProjectContractOperation, relocatedMeasureProject, relocatedSampleSummary, relocatedMeasureOperation, relocatedSupportSnapshot, relocatedSupportReport, relocatedUnavailableSupport, relocatedStatus, relocatedReleaseCheck, relocatedPortableFile, relocatedZip, relocatedPluginIdWordProblem, relocatedDerivedPluginId, relocatedPluginIdProblem, relocatedExportedIdProblem, relocatedExportedIdWarning, relocatedStorybookFlags, relocatedTerminalStyle, relocatedMarker, relocatedBold, relocatedRows, relocatedDuration, relocatedRunnable, relocatedNextLine, relocatedCommandHelp, relocatedHelpIndex, relocatedHelpText, relocatedSetupDocumentation, relocatedBundledNoticeFiles, relocatedExportedProject, relocatedStorybookOperation, relocatedAirshipPlan, relocatedAirshipEnvironment, relocatedAirshipOperation, relocatedBuildClickdummy, relocatedDocsRead, relocatedDocsPlan, relocatedFixtureOperation, relocatedGuidedSetup, relocatedContinueSetup, relocatedGuidedStarter, relocatedStarterText, relocatedRenderHuman, relocatedSetupSnapshot, test, frameworkRoot, scripted, contents } from './support/interactive-maker-parity-support.mjs';

test('relocated fixture adapter preserves approval, target, reset and cancellation boundaries', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-fixtures-relocated-')));
  try {
    const context = { root, frameworkRoot };
    const config = {
      project: { id: 'demo' },
      paths: { testVaultFolder: '.test-vault' },
    };
    const manifest = { target: '.test-vault', sources: [] };
    const calls = [];
    const dependencies = {
      readConfiguration: async () => config,
      readJson: async path => String(path).endsWith('.framework-vault.json')
        ? { projectId: 'demo' }
        : manifest,
      planFixtures: async (planRoot, value, options) => {
        calls.push(['plan', planRoot, value, options]);
        return {
          mode: options.reset ? 'reset' : 'apply',
          approval: 'fixture-hash',
          target: '.test-vault',
          changes: [{ path: 'Notes/one.md' }],
          blockers: [],
          bytes: 12,
        };
      },
      applyFixtures: async (applyRoot, value, approval, options) => {
        calls.push(['apply', applyRoot, value, approval, options]);
        return { unchanged: false, written: ['Notes/one.md'] };
      },
    };

    await assert.rejects(
      relocatedFixtureOperation({ command: 'data plan', args: [], options: {} }, context, dependencies),
      error => error.code === 'INPUT_REQUIRED',
    );

    await assert.rejects(
      relocatedFixtureOperation(
        { command: 'data plan', args: [], options: { input: 'fixtures.json' } },
        context,
        { ...dependencies, readConfiguration: async () => null },
      ),
      error => error.code === 'CONFIG_REQUIRED',
    );

    await assert.rejects(
      relocatedFixtureOperation(
        { command: 'data plan', args: [], options: { input: 'fixtures.json' } },
        context,
        { ...dependencies, readConfiguration: async () => ({ ...config, paths: { testVaultFolder: 'vault' } }) },
      ),
      error => error.code === 'FIXTURE_TARGET_UNSUPPORTED',
    );

    await assert.rejects(
      relocatedFixtureOperation(
        { command: 'data plan', args: [], options: { input: 'fixtures.json' } },
        context,
        { ...dependencies, readJson: async () => ({ target: 'other' }) },
      ),
      error => error.code === 'FIXTURE_TARGET',
    );

    const planned = await relocatedFixtureOperation(
      { command: 'data plan', args: [], options: { input: 'fixtures.json' } },
      context,
      dependencies,
    );
    assert.equal(planned.status, 'planned');
    assert.equal(planned.data.approval, 'fixture-hash');

    const blocked = await relocatedFixtureOperation(
      { command: 'data reset-plan', args: [], options: { input: 'fixtures.json' } },
      context,
      {
        ...dependencies,
        planFixtures: async (planRoot, value, options) => {
          calls.push(['blocked-plan', planRoot, value, options]);
          return {
            mode: 'reset',
            approval: 'fixture-hash',
            target: '.test-vault',
            changes: [],
            blockers: ['owned file changed'],
            bytes: 0,
          };
        },
      },
    );
    assert.equal(blocked.status, 'blocked');
    assert.equal(calls.at(-1)[3].reset, true);

    await assert.rejects(
      relocatedFixtureOperation(
        { command: 'data apply', args: [], options: { input: 'fixtures.json', yes: true } },
        context,
        dependencies,
      ),
      error => error.code === 'FIXTURE_APPROVAL',
    );

    await assert.rejects(
      relocatedFixtureOperation(
        { command: 'data apply', args: [], options: { input: 'fixtures.json', apply: 'fixture-hash' } },
        context,
        { ...dependencies, readJson: async path => String(path).endsWith('.framework-vault.json')
          ? { projectId: 'other' }
          : manifest },
      ),
      error => error.code === 'VAULT_REQUIRED',
    );

    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      relocatedFixtureOperation(
        { command: 'data apply', args: [], options: { input: 'fixtures.json', apply: 'fixture-hash' } },
        { ...context, signal: controller.signal },
        dependencies,
      ),
      error => error.code === 'CANCELLED',
    );

    const applied = await relocatedFixtureOperation(
      { command: 'data apply', args: [], options: { input: 'fixtures.json', apply: 'fixture-hash' } },
      context,
      dependencies,
    );
    assert.equal(applied.status, 'applied');
    assert.deepEqual(calls.at(-1), ['apply', root, manifest, 'fixture-hash', { reset: false }]);

    const unchanged = await relocatedFixtureOperation(
      { command: 'data reset', args: [], options: { input: 'fixtures.json', apply: 'fixture-hash' } },
      context,
      { ...dependencies, applyFixtures: async () => ({ unchanged: true }) },
    );
    assert.equal(unchanged.status, 'unchanged');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated setup terminal preserves interview and separately approved continuation flow', async () => {

  const prompts = [];
  const answers = ['blank', '', '', 'Example Author', 'yes', 'yes', '', '', '', ''];
  const writes = [];
  const dependencies = {
    readConfiguration: async () => null,
    companionStarterSet: async () => ({ template: frameworkRoot, starters: [{ definition: { id: 'blank', name: 'Blank', level: 'basic' } }] }),
    derivedId: () => 'derived-id',
    derivedName: id => id === 'derived-id' ? 'Derived Id' : 'Unexpected',
    setupDocumentation: async (_mode, value) => value,
    setupObsidian: async () => [],
    // An Azure DevOps origin pre-selects that platform and its details; nothing is printed or contacted.
    readOriginUrl: async root => root === '/project' ? 'https://contoso@dev.azure.com/contoso/Demo/_git/demo-repo' : null,
  };
  const guided = await relocatedGuidedSetup(
    { command: 'setup', args: [], options: {} },
    { root: '/project', frameworkRoot },
    async query => { prompts.push(query); return answers.shift(); },
    value => writes.push(value),
    dependencies,
  );
  assert.equal(guided.options.starter, 'blank');
  assert.equal(guided.options.id, 'derived-id');
  assert.equal(guided.options.name, 'Derived Id');
  assert.equal(guided.options.author, 'Example Author');
  assert.equal(guided.options.airship, true);
  assert.equal(guided.options.mcp, true);
  assert.deepEqual([guided.options.hosting, guided.options['azure-organization'], guided.options['azure-project'], guided.options['azure-repository']],
    ['azure-devops', 'https://dev.azure.com/contoso', 'Demo', 'demo-repo']);
  assert.match(prompts[6], /\[azure-devops\]: $/);
  assert.ok(writes.some(value => value.startsWith('Azure DevOps hosting:') && value.includes('Setup stays local and preserves every existing remote')));
  assert.ok(writes.every(value => !value.includes('contoso@')));
  assert.equal(prompts.length, 10);

  const rendered = [];
  const calls = [];
  const continuationAnswers = ['yes', 'yes', 'yes', 'yes', 'yes'];
  const execute = async request => {
    calls.push(request);
    if (request.command === 'generate') {
      return { ...operationResult('generate', { planHash: 'b'.repeat(64) }, 'planned') };
    }
    if (request.command === 'setup status') {
      return operationResult('setup status', { resumeHash: 'a'.repeat(64) });
    }
    return operationResult(request.command, {}, 'applied');
  };
  const documentationModes = [];
  const completed = await relocatedContinueSetup(
    { root: '/project', frameworkRoot },
    execute,
    async () => continuationAnswers.shift(),
    value => rendered.push(value),
    operationResult('setup', {}, 'applied'),
    {
      ...dependencies,
      setupDocumentation: async (mode, value) => { documentationModes.push(mode); return value; },
    },
  );
  assert.equal(completed.status, 'applied');
  assert.deepEqual(documentationModes, ['import', 'export']);
  assert.deepEqual(calls.filter(call => call.command === 'setup resume').map(call => call.options.stage),
    ['generate', 'install', 'verify', 'preview']);
  assert.equal(calls.find(call => call.command === 'setup resume' && call.options.stage === 'generate').options.apply, 'b'.repeat(64));
  assert.ok(rendered.length >= 5);

  const declinedModes = [];
  const declined = await relocatedContinueSetup(
    { root: '/project', frameworkRoot },
    async () => { throw new Error('declined flow must not execute a stage'); },
    async () => 'no',
    () => {},
    operationResult('setup', {}, 'applied'),
    {
      ...dependencies,
      setupDocumentation: async (mode, value) => { declinedModes.push(mode); return value; },
    },
  );
  assert.equal(declined.status, 'applied');
  assert.deepEqual(declinedModes, ['import', 'export']);
});


test('relocated starter terminal preserves compatibility, from-short-circuit and human rendering', async () => {

  const from = await relocatedGuidedStarter(
    { command: 'new', args: [], options: { from: 'source.json' } },
    { root: frameworkRoot, frameworkRoot },
    async query => {
      assert.match(query, /New project directory/);
      return 'consumer';
    },
    () => {},
  );
  assert.equal(from.options.from, 'source.json');
  assert.ok(from.args[0].endsWith('consumer'));

  assert.equal(relocatedStarterText(operationResult('new', null, 'failed')), null);
  assert.equal(relocatedStarterText(operationResult('new', null, 'cancelled')), 'new: cancelled; nothing was written.\n');

  const listing = relocatedStarterText(operationResult('new', {
    starters: [{ id: 'cli', title: 'CLI', category: 'utility', difficulty: 'basic', description: 'Command utility.' }],
  }));
  assert.match(listing, /Installed JSON starters/);
  assert.match(listing, /cli/);

  const review = relocatedStarterText(operationResult('new', {
    planHash: 'a'.repeat(64),
    summary: {
      starter: { id: 'cli', title: 'CLI', version: '1.0.0', sha256: 'b'.repeat(64) },
      identity: { id: 'demo', name: 'Demo', author: 'Example' },
      directory: '/tmp/demo', vault: '/tmp', files: 4, acceptanceTodos: 2, warnings: ['boundary'],
    },
    conflicts: [], next: 'Review.', nextSteps: ['Install'],
    guide: { readme: 'README.md', implementation: 'IMPLEMENTATION.md' },
    install: { npm: { exitCode: 0 } },
  }, 'planned'));
  assert.match(review, /new: planned/);
  assert.match(review, /Plan hash/);
  assert.match(review, /npm: exit 0/);
  assert.match(review, /Next steps:/);
});


test('relocated terminal renderer preserves compatibility and generic/check views', () => {
  const style = { color: false, unicode: false };
  const generic = relocatedRenderHuman(operationResult('inspect', { one: 1, nested: { two: 'value' } }), style);
  assert.match(generic.text, /inspect: ok/);
  assert.match(generic.text, /nested\.two/);
  assert.equal(generic.diagnosticsShown, false);

  const check = relocatedRenderHuman(operationResult('check', {
    scope: 'shell-repository', mode: 'full',
    steps: [{ id: 'types', command: 'tsc', status: 'passed', durationMs: 12, exitCode: 0 }],
    summary: { passed: 1, failed: 0, skipped: 0, durationMs: 12 },
  }), style);
  assert.match(check.text, /types/);
  assert.match(check.text, /All check steps passed/);
  assert.equal(check.diagnosticsShown, true);
});


test('relocated setup-state fingerprinting preserves identity, source and generation bindings', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-setup-state-relocated-')));
  try {
    const context = { root, frameworkRoot };
    const setup = await frameworkOperation({
      command: 'setup',
      args: [],
      options: { id: 'snapshot-demo', name: 'Snapshot Demo', author: 'Example', blank: true, yes: true },
    }, context);
    assert.equal(setup.status, 'applied', JSON.stringify(setup));

    const first = await relocatedSetupSnapshot(context);
    assert.ok(first.files >= 2);
    assert.ok(first.bytes > 0);
    assert.equal(first.kitVerified, false);
    assert.equal(first.generated, false);
    assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
    assert.match(first.binding, /^[a-f0-9]{64}$/);

    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, 'src/extra.ts'), 'export const extra = 1;\n');
    const changed = await relocatedSetupSnapshot(context);
    assert.notEqual(changed.fingerprint, first.fingerprint);
    assert.equal(changed.binding, first.binding);

    await mkdir(join(root, '.companion'), { recursive: true });
    await writeFile(join(root, '.companion/generation.json'), JSON.stringify({
      version: 1,
      projectId: 'snapshot-demo',
      files: [{ path: 'design/project.json' }],
    }));
    const generated = await relocatedSetupSnapshot(context);
    assert.equal(generated.generated, true);
    assert.notEqual(generated.fingerprint, changed.fingerprint);

    await writeFile(join(root, '.companion/generation.json'), '{}');
    await assert.rejects(relocatedSetupSnapshot(context), error => error.code === 'SETUP_GENERATION_INVALID');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

