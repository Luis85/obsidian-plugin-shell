import type { Artifact, Diagnostic, OutputKind, TemplateSnapshot } from '../domain/contracts.ts';

/** Host mechanisms are supplied by composition. The compiler cannot discover files or run tools. */
export interface CompilerPorts<Model> {
  migrate(value: unknown): { document: unknown; report: unknown };
  validate(document: unknown): Model;
  resolve(model: Model): void;
  lower(model: Model, template: TemplateSnapshot, kind: OutputKind): Diagnostic[];
  emit(model: Model, template: TemplateSnapshot, kind: OutputKind): Promise<Artifact[]>;
  dependencies(artifacts: readonly Artifact[]): { ready: boolean; diagnostics: Diagnostic[] };
  hash(value: string, encoding?: 'base64'): string;
}
export interface CompileRequest {
  source: string;
  sourceName?: string;
  outputKind?: OutputKind;
  template?: TemplateSnapshot;
}
