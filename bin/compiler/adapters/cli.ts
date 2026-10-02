import { storybookFlags } from '../../adapters/framework/storybook-options.ts';
import { basename, join, resolve } from 'node:path';
import { readBounded, exists } from '../../adapters/framework/files.ts';
import { requireThat, result, stringOption, type Context, type Request, type Result } from '../../adapters/framework/contracts.ts';
import { compileProject, loadTemplateSnapshot, diagnosticCatalog, compilerVersion } from '../../../scripts/compiler/index.ts';
import { CompilerError, diagnostic } from '../domain/diagnostics.ts';
import type { OutputKind } from '../domain/contracts.ts';
import { createRecorder, writeReports } from './reporting.ts';

interface CompilerOptions { input: string; stage: string; outputKind: OutputKind; reportDirectory?: string; debug: boolean }
function explainCode(request: Request): Result {
  const code = request.args[0];
  requireThat(code && Object.hasOwn(diagnosticCatalog, code), 'COMPILER_CODE_UNKNOWN', 'Supply a compiler diagnostic code; compiler check reports applicable codes.');
  return result(request.command, { code, help: diagnosticCatalog[code as keyof typeof diagnosticCatalog], compilerVersion });
}
function compilerOptions(request: Request): CompilerOptions {
  const input = stringOption(request.options, 'input');
  requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json> or --input - for stdin.');
  const stage = stringOption(request.options, 'stage') ?? 'ir';
  requireThat(['ir', 'artifacts'].includes(stage), 'COMPILER_STAGE_UNKNOWN', 'Inspection stage must be ir or artifacts.');
  const outputKind = stringOption(request.options, 'output-kind') ?? 'obsidian-plugin';
  requireThat(outputKind === 'obsidian-plugin' || outputKind === 'clickdummy', 'COMPILER_OUTPUT_UNKNOWN', 'Output kind must be obsidian-plugin or clickdummy.');
  const reportDirectory = stringOption(request.options, 'report-dir'), debug = request.options.debug === true;
  requireThat(!debug || reportDirectory, 'COMPILER_DEBUG_REQUIRES_REPORT', 'Supply --report-dir reports/compiler to retain opt-in debug stacks. Review them before sharing.');
  return { input, stage, outputKind, reportDirectory, debug };
}
async function readSource(input: string, sourceName: string, context: Context): Promise<string> {
  if (input === '-') { requireThat(context.inputText !== undefined, 'STDIN_REQUIRED', 'No stdin document supplied.'); return context.inputText; }
  const bytes = await readBounded(resolve(context.root, input), 4_000_000);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch (cause) { throw new CompilerError(diagnostic('COMPILER_JSON_INVALID', 'parse', 'Input is not valid UTF-8.', { file: sourceName, jsonPointer: '' }), { cause }); }
}
async function artifactTemplate(context: Context) {
  const templateRoot = await exists(join(context.frameworkRoot, '.framework/kit.json')) ? join(context.frameworkRoot, '.framework/template') : context.frameworkRoot;
  return loadTemplateSnapshot(templateRoot, context.signal);
}
type Compiled = Awaited<ReturnType<typeof compileProject>>;
function inspection(request: Request, stage: string, compiled: Compiled) {
  if (request.command !== 'compiler inspect') return {};
  if (stage === 'artifacts') return { inventory: compiled.artifacts.map(({ path, ownership, producer }) => ({ path, ownership, producer })) };
  return compiled.model ? { ir: compiled.model, migration: compiled.migration } : {};
}
/** Shared shell command adapter. Ordinary checking is read-only; report writes require an explicit path. */
export async function compilerOperation(request: Request, context: Context): Promise<Result> {
  if (request.command === 'compiler explain') return explainCode(request);
  const options = compilerOptions(request);
  const sourceName = options.input === '-' ? 'stdin.json' : basename(options.input);
  const source = await readSource(options.input, sourceName, context);
  const recorder = createRecorder(options.debug);
  const inspectArtifacts = request.command === 'compiler inspect' && options.stage === 'artifacts';
  const template = inspectArtifacts ? await artifactTemplate(context) : undefined;
  const compiled = await compileProject({ source, sourceName, outputKind: options.outputKind, template, storybook: storybookFlags(request.options) }, {
    signal: context.signal, onEvent: recorder.onEvent, onFailure: recorder.onFailure,
  });
  const summary = { compilerVersion, status: compiled.status, outputKind: compiled.outputKind, fingerprint: compiled.fingerprint,
    artifacts: compiled.artifacts.length, diagnostics: compiled.diagnostics, readiness: compiled.readiness };
  const report = options.reportDirectory ? await writeReports(context.root, options.reportDirectory, recorder, summary, options.debug) : null;
  const data = { ...summary, diagnostics: undefined, ...(report ? { report } : {}), ...inspection(request, options.stage, compiled),
    ...(compiled.model ? { project: compiled.model.project.id, screens: compiled.model.screens.length, components: compiled.model.components.length } : {}) };
  return { ...result(request.command, data, compiled.status), diagnostics: compiled.diagnostics };
}
