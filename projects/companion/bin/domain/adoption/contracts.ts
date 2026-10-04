/** Versioned adoption-report contract and the bounded inventory the analysis reads. Pure data, no I/O. */
export const reportSchemaId = 'workbench-adoption-report/v1';
export type Severity = 'info' | 'warn' | 'block';
export const severityOrder: readonly Severity[] = ['block', 'warn', 'info'];

export interface Finding { id: string; severity: Severity; message: string; evidence: string[] }
export interface GitFacts { present: boolean; dirty: boolean | null; remoteHost: string | null; dirtyNote: string | null }
export interface ScanFacts {
  files: number; bytesRead: number; truncated: boolean; maxFiles: number; maxFileBytes: number;
  skipped: { directories: string[]; symlinks: number; oversize: number; binary: number; unreadable: number };
}
/** What the adapter hands to the pure analysis: relative POSIX paths, bounded texts and git facts. */
export interface ProjectInventory {
  name: string;
  files: ReadonlyArray<{ path: string; bytes: number }>;
  texts: ReadonlyMap<string, string>;
  git: GitFacts;
  scan: ScanFacts;
}
export interface TargetVersion { version: string | null; major: number | null; source: string | null }
/** Versions the report is compared with, read from the repository rather than hard-coded in rules. */
export interface WorkbenchTargets { angular: TargetVersion; node: TargetVersion; typescript: TargetVersion }
export interface PackageManagerFacts { name: string | null; version: string | null; lockfiles: string[] }
export interface RuntimeFacts {
  packageManager: PackageManagerFacts;
  node: { engines: string | null; nvmrc: string | null; nodeVersionFile: string | null; toolVersions: string | null };
  typescript: { range: string | null; major: number | null; strict: boolean | null; configs: string[] };
  scripts: string[];
}
export interface FrameworkFact { id: string; version: string | null; detail: string | null; evidence: string[] }
export interface AngularProject { name: string; type: string; builder: string | null; builderClass: string; root: string }
export interface AngularSourceCounts {
  components: number; standaloneComponents: number; ngModules: number; services: number; pipes: number; directives: number;
  signalCalls: number; decoratorInputs: number; sourceFiles: number;
}
export interface AngularFacts {
  version: string | null; major: number | null; workspace: string;
  projects: AngularProject[]; builders: string[]; sourceCounts: AngularSourceCounts;
  routing: { files: string[]; routeCountEstimate: number; paths: string[] };
  libraries: string[]; stateManagement: string[]; ssr: boolean; i18n: string[]; zoneless: boolean; bootstrap: string;
}
export interface UiFacts { styling: string[]; tokenFiles: string[]; themeFiles: string[]; styleFiles: number }
export interface ToolingFacts {
  testing: string[]; specFiles: number; lint: string[]; format: string[]; ciProviders: string[]; workflows: string[];
  monorepo: string[]; workspaces: string[];
}
export interface AgentFacts { files: string[]; skills: string[]; claudeSettings: { present: boolean; hooks: boolean; permissions: boolean } }
export interface WorkbenchFacts { present: boolean; kitPath: string | null; evidence: string[] }
export interface AdoptionReport {
  schema: typeof reportSchemaId; recordedAt: string | null;
  target: { name: string; git: GitFacts };
  scan: ScanFacts; runtime: RuntimeFacts; frameworks: FrameworkFact[]; angular: AngularFacts | null;
  ui: UiFacts; tooling: ToolingFacts; agents: AgentFacts; workbench: WorkbenchFacts;
  targets: WorkbenchTargets; findings: Finding[];
}
/** Domain failures carry a stable code; adapters turn them into operation errors. */
export class AdoptionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.name = 'AdoptionError'; this.code = code; }
}
export function requireAdoption(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new AdoptionError(code, message);
}
