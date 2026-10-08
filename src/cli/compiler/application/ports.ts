import type { CompilerProjectSelection as ProjectSelection } from '../domain/project-starter.ts';
import type { Artifact, CompilerDiagnostic, OutputKind, StorybookOptions, TemplateSnapshot } from '../domain/contracts.ts';

/** Host mechanisms are supplied by composition. The compiler cannot discover files or run tools. */
export interface CompilerPorts<Model> {
  validate(document: unknown): Model;
  resolve(model: Model): void;
  lower(model: Model, template: TemplateSnapshot, kind: OutputKind): CompilerDiagnostic[];
  emit(model: Model, template: TemplateSnapshot, kind: OutputKind): Promise<Artifact[]>;
  dependencies(artifacts: readonly Artifact[]): { ready: boolean; diagnostics: CompilerDiagnostic[] };
  hash(value: string, encoding?: 'base64'): string;
}
export interface CompileRequest {
  source: string;
  sourceName?: string;
  outputKind?: OutputKind;
  template?: TemplateSnapshot;
  storybook?: StorybookOptions;
  projectSelection?: ProjectSelection;
}
