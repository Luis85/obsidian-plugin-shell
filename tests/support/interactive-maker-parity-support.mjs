import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { studio, prototypeWizard } from '../../bin/presentation/studio.ts';
import { loadGuide } from '../../bin/adapters/prototype.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { checkSteps, runCheckSteps, checkOperation, outputTail } from '../../bin/adapters/framework/check.ts';
import * as legacyFrameworkCheck from '../../scripts/framework/check.ts';
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
import { CompilerError, CompilationFailure, diagnostic as compilerDiagnostic } from '../../bin/compiler/domain/diagnostics.ts';
import { hash as relocatedHash, readBounded as relocatedReadBounded, projectRoot as relocatedProjectRoot, exists as relocatedExists } from '../../bin/adapters/framework/files.ts';
import * as legacyFrameworkFiles from '../../scripts/framework/files.ts';
import { configuration as relocatedConfiguration, defaults as relocatedDefaults, identity as relocatedIdentity, resolveImport as relocatedResolveImport } from '../../bin/adapters/framework/configuration.ts';
import * as legacyFrameworkConfiguration from '../../scripts/framework/configuration.ts';
import { npmEntry as relocatedNpmEntry, runNode as relocatedRunNode } from '../../bin/adapters/framework/process.ts';
import * as legacyFrameworkProcess from '../../scripts/framework/process.ts';
import { terminateProcessTree as relocatedTerminateProcessTree } from '../../bin/adapters/framework/process-tree.ts';
import * as legacyProcessTree from '../../scripts/framework/process-tree.ts';
import { handoutPlan as relocatedHandoutPlan, handoutRead as relocatedHandoutRead } from '../../bin/adapters/framework/handout-adapter.ts';
import * as legacyHandoutAdapter from '../../scripts/framework/handout-adapter.ts';
import { applyFilePlan as applySharedFilePlan } from '../../scripts/shared/file-plan.ts';
import { projectContractOperation as relocatedProjectContractOperation } from '../../bin/adapters/framework/project-contract.ts';
import * as legacyProjectContract from '../../scripts/framework/project-contract.ts';
import { measureProject as relocatedMeasureProject } from '../../bin/adapters/framework/project-measure.ts';
import * as legacyProjectMeasure from '../../scripts/framework/project-measure.ts';
import { sampleSummary as relocatedSampleSummary, measureOperation as relocatedMeasureOperation } from '../../bin/adapters/framework/measurement.ts';
import * as legacyMeasurement from '../../scripts/framework/measurement.ts';
import { supportSnapshot as relocatedSupportSnapshot, supportReport as relocatedSupportReport, unavailableSupport as relocatedUnavailableSupport } from '../../bin/adapters/framework/support-report.ts';
import * as legacySupportReport from '../../scripts/framework/support-report.ts';
import { status as relocatedStatus, releaseCheck as relocatedReleaseCheck } from '../../bin/adapters/framework/inspection.ts';
import * as legacyInspection from '../../scripts/framework/inspection.ts';
import { portableFile as relocatedPortableFile } from '../../bin/adapters/framework/archive-path.ts';
import * as legacyArchivePath from '../../scripts/framework/archive-path.ts';
import { zip as relocatedZip } from '../../bin/adapters/framework/zip.ts';
import * as legacyZip from '../../scripts/framework/zip.ts';
import { pluginIdWordProblem as relocatedPluginIdWordProblem, derivedPluginId as relocatedDerivedPluginId, pluginIdProblem as relocatedPluginIdProblem, exportedIdProblem as relocatedExportedIdProblem, exportedIdWarning as relocatedExportedIdWarning } from '../../bin/adapters/framework/plugin-id.ts';
import * as legacyPluginId from '../../scripts/framework/plugin-id.ts';
import { storybookFlags as relocatedStorybookFlags } from '../../bin/adapters/framework/storybook-options.ts';
import { terminalStyle as relocatedTerminalStyle, marker as relocatedMarker, bold as relocatedBold, rows as relocatedRows, duration as relocatedDuration, runnable as relocatedRunnable, nextLine as relocatedNextLine } from '../../bin/presentation/terminal/terminal-style.ts';
import * as legacyTerminalStyle from '../../scripts/framework/terminal-style.ts';
import { commandHelp as relocatedCommandHelp, helpIndex as relocatedHelpIndex } from '../../bin/adapters/framework/help-text.ts';
import * as legacyHelpText from '../../scripts/framework/help-text.ts';
import { helpText as relocatedHelpText } from '../../bin/presentation/terminal/terminal-help.ts';
import * as legacyTerminalHelp from '../../scripts/framework/terminal-help.ts';
import { setupDocumentation as relocatedSetupDocumentation } from '../../bin/presentation/terminal/docs-setup.ts';
import * as legacyDocsSetup from '../../scripts/framework/docs-setup.ts';
import { docsParserFiles as relocatedDocsParserFiles } from '../../bin/adapters/framework/docs-vendor.ts';
import * as legacyDocsVendor from '../../scripts/framework/docs-vendor.ts';
import { exportedProject as relocatedExportedProject } from '../../bin/adapters/framework/project-from.ts';
import * as legacyProjectFrom from '../../scripts/framework/project-from.ts';
import { storybookOperation as relocatedStorybookOperation } from '../../bin/adapters/framework/storybook.ts';
import * as legacyStorybook from '../../scripts/framework/storybook.ts';
import { airshipPlan as relocatedAirshipPlan } from '../../bin/adapters/framework/airship-plan.ts';
import * as legacyAirshipPlan from '../../scripts/framework/airship-plan.ts';
import { airshipEnvironment as relocatedAirshipEnvironment, airshipOperation as relocatedAirshipOperation } from '../../bin/adapters/framework/airship.ts';
import * as legacyAirship from '../../scripts/framework/airship.ts';
import { buildClickdummy as relocatedBuildClickdummy } from '../../bin/adapters/framework/clickdummy.ts';
import * as legacyClickdummy from '../../scripts/framework/clickdummy.ts';
import { docsRead as relocatedDocsRead, docsPlan as relocatedDocsPlan } from '../../bin/adapters/framework/docs.ts';
import * as legacyDocs from '../../scripts/framework/docs.ts';
import { fixtureOperation as relocatedFixtureOperation } from '../../bin/adapters/framework/fixtures.ts';
import * as legacyFixtures from '../../scripts/framework/fixtures.ts';
import { guidedSetup as relocatedGuidedSetup, continueSetup as relocatedContinueSetup } from '../../bin/presentation/terminal/setup-terminal.ts';
import * as legacySetupTerminal from '../../scripts/framework/setup-terminal.ts';
import { guidedStarter as relocatedGuidedStarter, starterText as relocatedStarterText } from '../../bin/presentation/terminal/starter-terminal.ts';
import * as legacyStarterTerminal from '../../scripts/framework/starter-terminal.ts';
import { renderHuman as relocatedRenderHuman } from '../../bin/presentation/terminal/terminal-render.ts';
import * as legacyTerminalRender from '../../scripts/framework/terminal-render.ts';
import { setupSnapshot as relocatedSetupSnapshot } from '../../bin/adapters/framework/setup-state.ts';
import * as legacySetupState from '../../scripts/framework/setup-state.ts';
import { setupProgress as relocatedSetupProgress } from '../../bin/adapters/framework/setup-progress.ts';
import * as legacySetupProgress from '../../scripts/framework/setup-progress.ts';
import { kitManifest as relocatedKitManifest, listFiles as relocatedListKitFiles, verifyKit as relocatedVerifyKit, bootstrapFiles as relocatedBootstrapFiles } from '../../bin/adapters/framework/kit-integrity.ts';
import * as legacyKitIntegrity from '../../scripts/framework/kit-integrity.ts';
import { included as relocatedDistributedIncluded, standaloneSource as relocatedStandaloneSource, updateOwnership as relocatedUpdateOwnership } from '../../bin/adapters/framework/distribution.ts';
import * as legacyDistribution from '../../scripts/framework/distribution.ts';
import { derivedId as relocatedStarterDerivedId, derivedName as relocatedStarterDerivedName, invocationDirectory as relocatedInvocationDirectory } from '../../bin/adapters/framework/starter-project.ts';
import * as legacyStarterProject from '../../scripts/framework/starter-project.ts';
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
export {
  assert,
  realpath,
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  tmpdir,
  join,
  PassThrough,
  Readable,
  studio,
  prototypeWizard,
  loadGuide,
  execute,
  parseArguments,
  checkSteps,
  runCheckSteps,
  checkOperation,
  outputTail,
  legacyFrameworkCheck,
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
  relocatedStarterDerivedId,
  relocatedStarterDerivedName,
  relocatedInvocationDirectory,
  legacyStarterProject,
  test,
  frameworkRoot,
  scripted,
  contents
};
