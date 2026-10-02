import { storybookFlags } from '../../../bin/adapters/framework/storybook-options.ts';
import { basename, join, resolve } from 'node:path';
import { readBounded, exists } from '../../../bin/adapters/framework/files.ts';
import { requireThat, result, stringOption, type Context, type Request, type Result } from '../../../bin/adapters/framework/contracts.ts';
import { compileProject, loadTemplateSnapshot, diagnosticCatalog, compilerVersion } from '../index.ts';
import { CompilerError, diagnostic } from '../../../bin/compiler/domain/diagnostics.ts';
import type { OutputKind } from '../../../bin/compiler/domain/contracts.ts';
import { createRecorder, writeReports } from './reporting.ts';

/** Shared shell command adapter. Ordinary checking is read-only; report writes require an explicit path. */
export async function compilerOperation(request: Request, context: Context): Promise<Result> {
  if (request.command === 'compiler explain') {
    const code = request.args[0];
    requireThat(code && Object.hasOwn(diagnosticCatalog, code), 'COMPILER_CODE_UNKNOWN', 'Supply a compiler diagnostic code; compiler check reports applicable codes.');
    return result(request.command, { code, help: diagnosticCatalog[code as keyof typeof diagnosticCatalog], compilerVersion });
  }
  const input = stringOption(request.options, 'input');
  requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json> or --input - for stdin.');
  const stage = stringOption(request.options, 'stage') ?? 'ir';
  requireThat(['ir', 'artifacts'].includes(stage), 'COMPILER_STAGE_UNKNOWN', 'Inspection stage must be ir or artifacts.');
  const outputKind = stringOption(request.options, 'output-kind') ?? 'obsidian-plugin';
  requireThat(['obsidian-plugin', 'clickdummy'].includes(outputKind), 'COMPILER_OUTPUT_UNKNOWN', 'Output kind must be obsidian-plugin or clickdummy.');
  const reportDirectory = stringOption(request.options, 'report-dir'), debug = request.options.debug === true;
  requireThat(!debug || reportDirectory, 'COMPILER_DEBUG_REQUIRES_REPORT', 'Supply --report-dir reports/compiler to retain opt-in debug stacks. Review them before sharing.');
  const sourceName = input === '-' ? 'stdin.json' : basename(input);
  let source: string;
  if (input === '-') { requireThat(context.inputText !== undefined, 'STDIN_REQUIRED', 'No stdin document supplied.'); source = context.inputText; }
  else {
    const bytes = await readBounded(resolve(context.root, input), 4_000_000);
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (cause) { throw new CompilerError(diagnostic('COMPILER_JSON_INVALID', 'parse', 'Input is not valid UTF-8.', { file: sourceName, jsonPointer: '' }), { cause }); }
  }
  const recorder = createRecorder(debug);
  const inspectArtifacts = request.command === 'compiler inspect' && stage === 'artifacts';
  let template;
  if (inspectArtifacts) {
    const templateRoot = await exists(join(context.frameworkRoot, '.framework/kit.json')) ? join(context.frameworkRoot, '.framework/template') : context.frameworkRoot;
    template = await loadTemplateSnapshot(templateRoot, context.signal);
  }
  const compiled = await compileProject({ source, sourceName, outputKind: outputKind as OutputKind, template, storybook: storybookFlags(request.options) }, {
    signal: context.signal, onEvent: recorder.onEvent, onFailure: recorder.onFailure,
  });
  const summary = { compilerVersion, status: compiled.status, outputKind: compiled.outputKind, fingerprint: compiled.fingerprint,
    artifacts: compiled.artifacts.length, diagnostics: compiled.diagnostics, readiness: compiled.readiness };
  const report = reportDirectory ? await writeReports(context.root, reportDirectory, recorder, summary, debug) : null;
  const data = { ...summary, diagnostics: undefined, ...(report ? { report } : {}),
    ...(request.command === 'compiler inspect' && stage === 'ir' && compiled.model ? { ir: compiled.model, migration: compiled.migration } : {}),
    ...(inspectArtifacts ? { inventory: compiled.artifacts.map(({ path, ownership, producer }) => ({ path, ownership, producer })) } : {}),
    ...(compiled.model ? { project: compiled.model.project.id, screens: compiled.model.screens.length, components: compiled.model.components.length } : {}) };
  return { ...result(request.command, data, compiled.status), diagnostics: compiled.diagnostics };
}
