/** Versioned compiler data contracts. No host, filesystem, process or UI dependencies. */
export type OutputKind = 'obsidian-plugin' | 'clickdummy';
export type Phase = 'parse' | 'migrate' | 'validate' | 'resolve' | 'lower' | 'emit';
export type Severity = 'error' | 'warning' | 'info';
export interface SourceLocation {
  file: string;
  jsonPointer: string;
  entityId?: string;
  /** Migration-derived locations name the normalized document rather than guessing old offsets. */
  document?: 'input' | 'normalized';
}
export interface Diagnostic {
  code: string;
  severity: Severity;
  phase: Phase;
  message: string;
  help: string;
  retryable: boolean;
  source?: SourceLocation;
  related?: SourceLocation[];
}
export interface Artifact {
  path: string;
  content: string;
  encoding?: 'base64';
  ownership: 'managed' | 'extension' | 'framework';
  producer?: string;
  origins?: SourceLocation[];
}
export interface TemplateSnapshot {
  readonly fingerprint: string;
  readonly frameworkFiles: readonly Artifact[];
  readonly skillFiles: readonly Artifact[];
  text(path: string): string;
}
export interface CompilerEvent {
  phase: Phase;
  event: 'started' | 'completed' | 'failed';
}
export interface Control {
  signal?: AbortSignal;
  onEvent?: (event: CompilerEvent) => void;
  /** Opt-in debugging channel; never included in ordinary JSON results. */
  onFailure?: (error: unknown, phase: Phase) => void;
}
export interface Readiness {
  generation: 'not-run' | 'completed' | 'failed';
  dependencies: 'not-checked' | 'locked' | 'resolution-required';
  bundle: 'not-run';
  typecheck: 'not-run';
  tests: 'not-run';
  productAcceptance: 'not-inferred';
}
export interface Compilation<Model> {
  protocolVersion: 1;
  compilerVersion: string;
  status: 'ok' | 'failed' | 'cancelled';
  outputKind: OutputKind;
  model?: Model;
  migration: unknown;
  diagnostics: Diagnostic[];
  artifacts: Artifact[];
  fingerprint: string | null;
  readiness: Readiness;
}
