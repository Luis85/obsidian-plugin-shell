import type { Compilation, Control, Phase, CompilerEvent } from '../domain/contracts.ts';
import { CompilerError, diagnostic, orderedDiagnostics } from '../domain/diagnostics.ts';
import { referenceDiagnostics } from '../domain/references.ts';
import { canonicalJson, validateArtifacts } from '../domain/artifacts.ts';
import type { CompileRequest, CompilerPorts } from './ports.ts';

export const compilerVersion = '1.0.0';
const phases: readonly Phase[] = ['parse', 'migrate', 'validate', 'resolve', 'lower', 'emit'];
/** One pipeline for CLI, editor and agent callers. No filesystem, network, clock or process access. */
export async function runCompiler<Model>(request: CompileRequest, ports: CompilerPorts<Model>, control: Control = {}): Promise<Compilation<Model>> {
  const output: Compilation<Model> = { protocolVersion: 1, compilerVersion, status: 'ok', outputKind: request.outputKind ?? 'obsidian-plugin',
    migration: null, diagnostics: [], artifacts: [], fingerprint: null,
    readiness: { generation: 'not-run', dependencies: 'not-checked', bundle: 'not-run', typecheck: 'not-run', tests: 'not-run', productAcceptance: 'not-inferred' } };
  let current: Phase = 'parse';
  function checkpoint(): void {
    if (control.signal?.aborted) throw new CompilerError(diagnostic('COMPILER_CANCELLED', current, 'Compilation cancelled; no files were written.'));
  }
  function event(value: CompilerEvent): void { control.onEvent?.(value); }
  async function phase<T>(name: Phase, work: () => T | Promise<T>): Promise<T> {
    current = name; checkpoint(); event({ phase: name, event: 'started' });
    try { const result = await work(); checkpoint(); event({ phase: name, event: 'completed' }); return result; }
    catch (error) { event({ phase: name, event: 'failed' }); throw error; }
  }
  try {
    const raw = await phase('parse', () => {
      if (!['obsidian-plugin', 'clickdummy', 'project'].includes(output.outputKind)) throw new CompilerError(diagnostic('COMPILER_SCHEMA_INVALID', 'parse', 'Unknown compiler output kind.'));
      if (new TextEncoder().encode(request.source).length > 4_000_000) throw new CompilerError(diagnostic('COMPILER_INPUT_LIMIT', 'parse', 'Project input exceeds 4 MB.'));
      try { return JSON.parse(request.source) as unknown; }
      catch (error) { throw new CompilerError(diagnostic('COMPILER_JSON_INVALID', 'parse', 'Invalid project JSON.', { file: request.sourceName ?? 'project.json', jsonPointer: '' }), { cause: error }); }
    });
    // Diagnose independent references against the original input before a legacy validator stops at the first failure.
    output.diagnostics = referenceDiagnostics(raw, request.sourceName ?? 'project.json');
    if (output.diagnostics.some(d => d.severity === 'error')) {
      output.status = 'failed'; output.readiness.generation = 'failed';
      event({ phase: 'resolve', event: 'failed' });
      return output;
    }
    const migrated = await phase('migrate', () => ports.migrate(raw)); output.migration = migrated.report;
    const model = await phase('validate', () => ports.validate(migrated.document));
    await phase('resolve', () => ports.resolve(model)); output.model = model;
    if (!request.template) return output;
    const template = request.template;
    output.diagnostics.push(...await phase('lower', () => ports.lower(model, template, output.outputKind)));
    const artifacts = await phase('emit', () => ports.emit(model, template, output.outputKind));
    validateArtifacts(artifacts); checkpoint();
    artifacts.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const dependencies = ports.dependencies(artifacts);
    output.diagnostics.push(...dependencies.diagnostics);
    output.artifacts = artifacts;
    output.fingerprint = ports.hash(canonicalJson({ compilerVersion, outputKind: output.outputKind,
      template: template.fingerprint, input: ports.hash(request.source),
      artifacts: artifacts.map(a => ({ path: a.path, ownership: a.ownership, hash: ports.hash(a.content, a.encoding) })) }));
    output.readiness.generation = 'completed';
    output.readiness.dependencies = dependencies.ready ? 'locked' : 'resolution-required';
  } catch (error) {
    control.onFailure?.(error, current);
    const value = error instanceof CompilerError ? error.diagnostic : diagnostic('COMPILER_INTERNAL', current, 'Unexpected compiler failure.');
    output.diagnostics.push(value); output.status = value.code === 'COMPILER_CANCELLED' ? 'cancelled' : 'failed';
    output.artifacts = []; output.fingerprint = null; output.readiness.generation = 'failed';
    // Caller-owned debug evidence may inspect causes through its adapter; ordinary reports never serialize Error objects.
  }
  output.diagnostics = orderedDiagnostics(output.diagnostics);
  return output;
}
export const compilerPhases = phases;
