import { assert, realpath, mkdtemp, readFile, writeFile, mkdir, rm, tmpdir, join, PassThrough, Readable, studio, prototypeWizard, loadGuide, execute, parseArguments, checkSteps, assertJsonData, parseJsonData, operationResult, ask, readInput, routeArguments, renderCliResult, interactiveRun, frameworkMain, processOperation, frameworkOperation, frameworkDescriptor, frameworkParameterKinds, parseFrameworkArguments, frameworkSuggestions, frameworkDidYouMean, prototypeCommands, operationSchemas, frameworkFailure, frameworkStringOption, FrameworkOperationError, frameworkRequireThat, CompilerError, CompilationFailure, compilerDiagnostic, relocatedHash, relocatedReadBounded, relocatedProjectRoot, relocatedExists, relocatedConfiguration, relocatedDefaults, relocatedIdentity, relocatedResolveImport, relocatedNpmEntry, relocatedRunNode, relocatedHandoutPlan, relocatedHandoutRead, applySharedFilePlan, relocatedProjectContractOperation, relocatedMeasureProject, relocatedSampleSummary, relocatedMeasureOperation, relocatedSupportSnapshot, relocatedSupportReport, relocatedUnavailableSupport, relocatedStatus, relocatedReleaseCheck, relocatedPortableFile, relocatedZip, relocatedPluginIdWordProblem, relocatedDerivedPluginId, relocatedPluginIdProblem, relocatedExportedIdProblem, relocatedExportedIdWarning, relocatedStorybookFlags, relocatedTerminalStyle, relocatedMarker, relocatedBold, relocatedRows, relocatedDuration, relocatedRunnable, relocatedNextLine, relocatedCommandHelp, relocatedHelpIndex, relocatedHelpText, relocatedSetupDocumentation, relocatedBundledNoticeFiles, relocatedExportedProject, relocatedStorybookOperation, relocatedAirshipPlan, relocatedAirshipEnvironment, relocatedAirshipOperation, relocatedBuildClickdummy, relocatedDocsRead, relocatedDocsPlan, relocatedFixtureOperation, relocatedGuidedSetup, relocatedContinueSetup, relocatedGuidedStarter, relocatedStarterText, relocatedRenderHuman, relocatedSetupSnapshot, test, frameworkRoot, scripted, contents } from './support/interactive-maker-parity-support.mjs';
import { starterDocumentText } from '../../../tests/support/starter-documents.mjs';

test('relocated project measurement preserves dry-run and bounded local measurement semantics', async () => {
  const inputText = starterDocumentText('companion-plugin');
  const context = { root: frameworkRoot, frameworkRoot, inputText };

  const dry = await relocatedMeasureProject(
    { command: 'project measure', args: [], options: { input: '-', samples: '3', 'dry-run': true } },
    context,
  );
  assert.equal(dry.status, 'planned');
  assert.equal(dry.data.execution, 'not-run');
  assert.deepEqual(dry.data.operations, ['import-validate', 'export-json', 'hierarchy-projection', 'arrange-proposal']);

  await assert.rejects(
    relocatedMeasureProject({ command: 'project measure', args: [], options: { input: '-', samples: '2' } }, context),
    error => error.code === 'MEASUREMENT_COUNT',
  );

  const measured = await relocatedMeasureProject(
    { command: 'project measure', args: [], options: { input: '-', samples: '3' } },
    context,
  );
  assert.equal(measured.status, 'ok');
  assert.equal(measured.data.schemaVersion, 1);
  assert.equal(measured.data.measured.length, 4);
  assert.equal(measured.data.contentIncluded, false);
  assert.equal(measured.data.network, false);
  assert.match(measured.data.inputSha256, /^[a-f0-9]{64}$/);
});


test('relocated measurement helper preserves deterministic statistics and synchronous-only timing', async () => {

  assert.deepEqual(relocatedSampleSummary([4, 1, 3, 2]), {
    count: 4, minMs: 1, maxMs: 4, medianMs: 2, p95Ms: 4, meanMs: 2.5,
  });
  assert.throws(() => relocatedSampleSummary([]), error => error.code === 'MEASUREMENT_INVALID');
  assert.throws(() => relocatedSampleSummary([1, Number.NaN]), error => error.code === 'MEASUREMENT_INVALID');

  let operationCalls = 0;
  let clock = 0;
  const measured = await relocatedMeasureOperation(
    () => { operationCalls++; return operationCalls; },
    3,
    undefined,
    () => clock++,
  );
  assert.equal(operationCalls, 7);
  assert.equal(measured.coldMs, 1);
  assert.deepEqual(measured.warmupMs, [1, 1, 1]);
  assert.deepEqual(measured.samplesMs, [1, 1, 1]);
  assert.equal(measured.meanMs, 1);

  await assert.rejects(
    relocatedMeasureOperation(() => Promise.resolve('async'), 3, undefined, () => clock++),
    error => error.code === 'MEASUREMENT_ASYNC',
  );
});


test('relocated support report preserves allowlist privacy and unavailable outcomes', async () => {

  const observation = {
    ...operationResult('doctor', {
      generated: false,
      imported: true,
      dependencies: true,
      designStale: null,
      acceptanceObligations: 2,
    }),
    diagnostics: [
      { code: 'CONFIG_MISSING', message: 'secret authored message' },
      { code: 'UNLISTED_PRIVATE_CODE', message: '/private/path/should-not-leak' },
    ],
  };
  const snapshot = relocatedSupportSnapshot(observation);
  assert.deepEqual(snapshot.diagnosticCodes, ['CONFIG_MISSING', 'OTHER']);
  assert.deepEqual(snapshot.observations, {
    generated: false, imported: true, dependenciesPresent: true, designStale: null, acceptanceObligations: 2,
  });
  assert.deepEqual(snapshot.privacy, {
    authoredContent: false, identities: false, paths: false, hashes: false, rawErrors: false, network: false,
  });
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('secret authored message'), false);
  assert.equal(serialized.includes('/private/path'), false);

  assert.equal(relocatedUnavailableSupport(false).status, 'blocked');
  assert.equal(relocatedUnavailableSupport(false).diagnostics[0].code, 'SUPPORT_UNAVAILABLE');
  assert.equal(relocatedUnavailableSupport(true).status, 'cancelled');
  assert.equal(relocatedUnavailableSupport(true).diagnostics[0].code, 'CANCELLED');

  const controller = new AbortController();
  controller.abort();
  const cancelled = await relocatedSupportReport({ root: frameworkRoot, frameworkRoot, signal: controller.signal });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.diagnostics[0].code, 'CANCELLED');
});


test('relocated inspection preserves status and blocked release-readiness diagnostics', async () => {

  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-inspection-')));
  try {
    const context = { root, frameworkRoot };
    const status = await relocatedStatus(context);
    assert.equal(status.status, 'ok');
    assert.equal(status.data.generated, false);
    assert.equal(status.data.imported, false);
    assert.equal(status.data.dependencies, false);
    assert.equal(status.data.next, 'setup');
    assert.ok(status.diagnostics.some(item => item.code === 'CONFIG_MISSING'));
    assert.ok(status.diagnostics.some(item => item.code === 'DEPENDENCIES_MISSING'));

    const release = await relocatedReleaseCheck(context);
    assert.equal(release.status, 'blocked');
    assert.ok(release.diagnostics.some(item => item.code === 'BUILD_IDENTITY'));
    assert.ok(release.diagnostics.some(item => item.code === 'ASSET_MISSING'));
    assert.ok(release.diagnostics.some(item => item.code === 'RELEASE_EVIDENCE_REQUIRED'));
    assert.equal(release.data.publication, 'not-authorized');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated inspection covers generated identity, traceability, doctor drift and stale design branches', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'framework-inspection-generated-')));
  try {
    const project = { id: 'field-notes', name: 'Field Notes', author: 'Example', version: '1.2.3', description: 'Demo' };
    const config = relocatedDefaults(project);
    await writeFile(join(root, 'shell.config.json'), JSON.stringify(config));
    await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: project.id, version: project.version }));
    await mkdir(join(root, '.companion'));
    await mkdir(join(root, 'node_modules/typescript'), { recursive: true });
    await writeFile(join(root, 'node_modules/typescript/package.json'), '{}');
    await mkdir(join(root, 'design'));
    const designPath = join(root, 'design/project.json');
    await writeFile(designPath, '{"schemaVersion":6}\n');
    await writeFile(join(root, '.companion/generation.json'), JSON.stringify({ inputHash: relocatedHash(await readFile(designPath)) }));
    await writeFile(join(root, 'design/traceability.json'), JSON.stringify({
      requirements: [{ id: 'R1', verification: 'pending' }, { id: 'R2', verification: 'verified' }],
    }));
    await writeFile(join(root, '.nvmrc'), '0.0.1\n');

    const context = { root, frameworkRoot: root };
    const doctor = await relocatedStatus(context, 'doctor');
    assert.equal(doctor.data.generated, true);
    assert.equal(doctor.data.imported, true);
    assert.equal(doctor.data.dependencies, true);
    assert.equal(doctor.data.designStale, false);
    assert.equal(doctor.data.acceptanceObligations, 1);
    assert.equal(doctor.data.next, 'npm run check');
    assert.ok(doctor.diagnostics.some(item => item.code === 'ACCEPTANCE_PENDING'));
    assert.ok(doctor.diagnostics.some(item => item.code === 'NODE_UNQUALIFIED'));
    assert.equal(doctor.diagnostics.some(item => item.code === 'DEPENDENCIES_MISSING'), false);

    await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: 'other-id', version: project.version }));
    await writeFile(designPath, '{"schemaVersion":6,"changed":true}\n');
    const stale = await relocatedStatus(context);
    assert.equal(stale.data.designStale, true);
    assert.equal(stale.data.next, 'generate');
    assert.ok(stale.diagnostics.some(item => item.code === 'IDENTITY_DRIFT'));
    assert.ok(stale.diagnostics.some(item => item.code === 'DESIGN_GENERATION_STALE'));

    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'other-id', version: project.version }));
    await writeFile(join(root, 'dist/main.js'), 'export {};\n');
    const release = await relocatedReleaseCheck(context);
    assert.equal(release.status, 'blocked');
    assert.equal(release.diagnostics.some(item => item.code === 'BUILD_IDENTITY'), false);
    assert.equal(release.diagnostics.some(item => item.code === 'ASSET_MISSING'), false);
    assert.ok(release.diagnostics.some(item => item.code === 'RELEASE_EVIDENCE_REQUIRED'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test('relocated archive helpers preserve portable paths and deterministic ZIP bytes', () => {

  for (const path of ['README.md', 'docs/guide.md', 'assets/icon-2.svg']) assert.equal(relocatedPortableFile(path), true, path);
  for (const path of ['', '../escape', 'a/../b', 'a//b', 'a\\b', 'CON', 'folder/trailing.', 'folder/trailing ']) {
    assert.equal(relocatedPortableFile(path), false, path);
  }

  const first = relocatedZip([
    { path: 'b.txt', bytes: Buffer.from('B') },
    { path: 'a.txt', bytes: Buffer.from('A') },
  ]);
  const second = relocatedZip([
    { path: 'a.txt', bytes: Buffer.from('A') },
    { path: 'b.txt', bytes: Buffer.from('B') },
  ]);
  assert.deepEqual(first, second);
  assert.equal(first.readUInt32LE(0), 0x04034b50);
  assert.equal(first.readUInt32LE(first.length - 22), 0x06054b50);

  assert.throws(() => relocatedZip([]), error => error.code === 'ARCHIVE_LIMIT');
  assert.throws(() => relocatedZip([{ path: '../unsafe.txt', bytes: Buffer.from('x') }]), error => error.code === 'ARCHIVE_PATH');
  assert.throws(() => relocatedZip([
    { path: 'A.txt', bytes: Buffer.from('one') },
    { path: 'a.txt', bytes: Buffer.from('two') },
  ]), error => error.code === 'ARCHIVE_PATH');
});


test('relocated plugin ID policy preserves creation, derivation and export review rules', () => {

  assert.match(relocatedPluginIdWordProblem('obsidian-notes'), /obsidian/);
  assert.match(relocatedPluginIdWordProblem('notes-plugin'), /end with/);
  assert.match(relocatedPluginIdWordProblem('plugin-notes'), /contain/);
  assert.equal(relocatedPluginIdWordProblem('field-notes'), null);

  assert.equal(relocatedDerivedPluginId('Field Notes', 'blank'), 'field-notes');
  assert.equal(relocatedDerivedPluginId('my-plugin', 'quick-capture'), 'my-quick-capture');
  assert.equal(relocatedDerivedPluginId('plugin', 'quick-capture'), 'quick-capture');
  assert.equal(relocatedDerivedPluginId('plugin', 'x'), 'my-project');

  assert.match(relocatedPluginIdProblem('Invalid ID'), /lowercase letters/);
  assert.match(relocatedPluginIdProblem('obsidian-notes'), /community review/);
  assert.equal(relocatedPluginIdProblem('field-notes'), null);

  assert.match(relocatedExportedIdProblem('Invalid ID'), /lowercase letters/);
  assert.match(relocatedExportedIdProblem('obsidian-notes'), /community review/);
  assert.equal(relocatedExportedIdProblem('notes-plugin'), null);
  assert.match(relocatedExportedIdWarning('notes-plugin'), /fail check submission/);
  assert.equal(relocatedExportedIdWarning('field-notes'), null);
  assert.equal(relocatedExportedIdWarning('Invalid ID'), null);
});


test('relocated Storybook option policy preserves explicit on/off semantics', () => {
  assert.equal(relocatedStorybookFlags({}), undefined);
  assert.deepEqual(relocatedStorybookFlags({ storybook: 'on' }), { enabled: true });
  assert.deepEqual(relocatedStorybookFlags({ storybook: 'off' }), { enabled: false });
  assert.deepEqual(relocatedStorybookFlags({ 'storybook-stories': 'on' }), { generateStories: true });
  assert.deepEqual(relocatedStorybookFlags({ storybook: 'on', 'storybook-stories': 'off' }), {
    enabled: true, generateStories: false,
  });
  assert.throws(() => relocatedStorybookFlags({ storybook: 'yes' }), error => error.code === 'STORYBOOK_OPTION_INVALID');
  assert.throws(() => relocatedStorybookFlags({ 'storybook-stories': true }), error => error.code === 'INVALID_OPTION');
});


test('relocated terminal style preserves plain/rich formatting and runnable hints', () => {

  assert.deepEqual(relocatedTerminalStyle({ isTTY: false }, {}), { color: false, unicode: false });
  assert.deepEqual(relocatedTerminalStyle({ isTTY: true }, { TERM: 'xterm' }), { color: true, unicode: true });
  assert.deepEqual(relocatedTerminalStyle({ isTTY: true }, { TERM: 'dumb' }), { color: false, unicode: false });
  assert.deepEqual(relocatedTerminalStyle({ isTTY: true }, { TERM: 'xterm', NO_COLOR: '1' }), { color: false, unicode: false });

  const plain = { color: false, unicode: false };
  const rich = { color: true, unicode: true };
  assert.equal(relocatedMarker(plain, 'pass'), '[ok]  ');
  assert.match(relocatedMarker(rich, 'fail'), /^\u001b\[31m✗/);
  assert.equal(relocatedBold(plain, 'Title'), 'Title');
  assert.match(relocatedBold(rich, 'Title'), /\u001b\[1mTitle/);
  assert.equal(relocatedRows([['A', 1], ['Long', 'value'], ['Skip', null]]), '  A     1\n  Long  value\n');
  assert.equal(relocatedDuration(999), '999ms');
  assert.equal(relocatedDuration(1500), '1.5s');
  assert.equal(relocatedRunnable('status'), 'node bin/app status');
  assert.equal(relocatedRunnable('npm ci'), 'npm ci');
  assert.equal(relocatedNextLine(plain, 'status'), 'Next: node bin/app status\n');
  assert.equal(relocatedNextLine(plain, null), '');
});

