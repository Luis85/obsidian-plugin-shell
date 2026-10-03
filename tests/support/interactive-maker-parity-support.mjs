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

import { configuration as relocatedConfiguration, defaults as relocatedDefaults, identity as relocatedIdentity, resolveImport as relocatedResolveImport } from '../../bin/adapters/framework/configuration.ts';

import { npmEntry as relocatedNpmEntry, runNode as relocatedRunNode } from '../../bin/adapters/framework/process.ts';

import { handoutPlan as relocatedHandoutPlan, handoutRead as relocatedHandoutRead } from '../../bin/adapters/framework/handout-adapter.ts';

import { applyFilePlan as applySharedFilePlan } from '../../scripts/shared/file-plan.ts';
import { projectContractOperation as relocatedProjectContractOperation } from '../../bin/adapters/framework/project-contract.ts';

import { measureProject as relocatedMeasureProject } from '../../bin/adapters/framework/project-measure.ts';

import { sampleSummary as relocatedSampleSummary, measureOperation as relocatedMeasureOperation } from '../../bin/adapters/framework/measurement.ts';

import { supportSnapshot as relocatedSupportSnapshot, supportReport as relocatedSupportReport, unavailableSupport as relocatedUnavailableSupport } from '../../bin/adapters/framework/support-report.ts';

import { status as relocatedStatus, releaseCheck as relocatedReleaseCheck } from '../../bin/adapters/framework/inspection.ts';

import { portableFile as relocatedPortableFile } from '../../bin/adapters/framework/archive-path.ts';

import { zip as relocatedZip } from '../../bin/adapters/framework/zip.ts';

import { pluginIdWordProblem as relocatedPluginIdWordProblem, derivedPluginId as relocatedDerivedPluginId, pluginIdProblem as relocatedPluginIdProblem, exportedIdProblem as relocatedExportedIdProblem, exportedIdWarning as relocatedExportedIdWarning } from '../../bin/adapters/framework/plugin-id.ts';

import { storybookFlags as relocatedStorybookFlags } from '../../bin/adapters/framework/storybook-options.ts';

import { terminalStyle as relocatedTerminalStyle, marker as relocatedMarker, bold as relocatedBold, rows as relocatedRows, duration as relocatedDuration, runnable as relocatedRunnable, nextLine as relocatedNextLine } from '../../bin/presentation/terminal/terminal-style.ts';

import { commandHelp as relocatedCommandHelp, helpIndex as relocatedHelpIndex } from '../../bin/adapters/framework/help-text.ts';

import { helpText as relocatedHelpText } from '../../bin/presentation/terminal/terminal-help.ts';

import { setupDocumentation as relocatedSetupDocumentation } from '../../bin/presentation/terminal/docs-setup.ts';

import { docsParserFiles as relocatedDocsParserFiles } from '../../bin/adapters/framework/docs-vendor.ts';

import { exportedProject as relocatedExportedProject } from '../../bin/adapters/framework/project-from.ts';

import { storybookOperation as relocatedStorybookOperation } from '../../bin/adapters/framework/storybook.ts';

import { airshipPlan as relocatedAirshipPlan } from '../../bin/adapters/framework/airship-plan.ts';

import { airshipEnvironment as relocatedAirshipEnvironment, airshipOperation as relocatedAirshipOperation } from '../../bin/adapters/framework/airship.ts';

import { buildClickdummy as relocatedBuildClickdummy } from '../../bin/adapters/framework/clickdummy.ts';

import { docsRead as relocatedDocsRead, docsPlan as relocatedDocsPlan } from '../../bin/adapters/framework/docs.ts';

import { fixtureOperation as relocatedFixtureOperation } from '../../bin/adapters/framework/fixtures.ts';

import { guidedSetup as relocatedGuidedSetup, continueSetup as relocatedContinueSetup } from '../../bin/presentation/terminal/setup-terminal.ts';

import { guidedStarter as relocatedGuidedStarter, starterText as relocatedStarterText } from '../../bin/presentation/terminal/starter-terminal.ts';

import { renderHuman as relocatedRenderHuman } from '../../bin/presentation/terminal/terminal-render.ts';

import { setupSnapshot as relocatedSetupSnapshot } from '../../bin/adapters/framework/setup-state.ts';

import { derivedId as relocatedStarterDerivedId, derivedName as relocatedStarterDerivedName, invocationDirectory as relocatedInvocationDirectory } from '../../bin/adapters/framework/starter-project.ts';

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
  relocatedConfiguration,
  relocatedDefaults,
  relocatedIdentity,
  relocatedResolveImport,
  relocatedNpmEntry,
  relocatedRunNode,
  relocatedHandoutPlan,
  relocatedHandoutRead,
  applySharedFilePlan,
  relocatedProjectContractOperation,
  relocatedMeasureProject,
  relocatedSampleSummary,
  relocatedMeasureOperation,
  relocatedSupportSnapshot,
  relocatedSupportReport,
  relocatedUnavailableSupport,
  relocatedStatus,
  relocatedReleaseCheck,
  relocatedPortableFile,
  relocatedZip,
  relocatedPluginIdWordProblem,
  relocatedDerivedPluginId,
  relocatedPluginIdProblem,
  relocatedExportedIdProblem,
  relocatedExportedIdWarning,
  relocatedStorybookFlags,
  relocatedTerminalStyle,
  relocatedMarker,
  relocatedBold,
  relocatedRows,
  relocatedDuration,
  relocatedRunnable,
  relocatedNextLine,
  relocatedCommandHelp,
  relocatedHelpIndex,
  relocatedHelpText,
  relocatedSetupDocumentation,
  relocatedDocsParserFiles,
  relocatedExportedProject,
  relocatedStorybookOperation,
  relocatedAirshipPlan,
  relocatedAirshipEnvironment,
  relocatedAirshipOperation,
  relocatedBuildClickdummy,
  relocatedDocsRead,
  relocatedDocsPlan,
  relocatedFixtureOperation,
  relocatedGuidedSetup,
  relocatedContinueSetup,
  relocatedGuidedStarter,
  relocatedStarterText,
  relocatedRenderHuman,
  relocatedSetupSnapshot,
  relocatedStarterDerivedId,
  relocatedStarterDerivedName,
  relocatedInvocationDirectory,
  test,
  frameworkRoot,
  scripted,
  contents,
};
