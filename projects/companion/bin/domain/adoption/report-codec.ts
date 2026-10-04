import { AdoptionError, requireAdoption, reportSchemaId, severityOrder, type AdoptionReport, type AngularFacts, type Finding, type GitFacts, type ScanFacts, type TargetVersion } from './contracts.ts';
import { hasControls } from '../errors.ts';
import { isRecord, type JsonRecord } from './source.ts';

const fail = (path: string, expected: string): never => { throw new AdoptionError('ADOPT_REPORT_INVALID', `Report field ${path} must be ${expected}.`); };
function record(value: unknown, path: string): JsonRecord { return isRecord(value) ? value : fail(path, 'an object'); }
function str(value: unknown, path: string, max = 400): string {
  if (typeof value !== 'string' || value.length > max || hasControls(value)) fail(path, `a string of at most ${max} characters without control characters`);
  return value as string;
}
const strOrNull = (value: unknown, path: string, max = 400): string | null => value === null ? null : str(value, path, max);
function int(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(path, 'a non-negative integer');
  return value as number;
}
const intOrNull = (value: unknown, path: string): number | null => value === null ? null : int(value, path);
function bool(value: unknown, path: string): boolean { return typeof value === 'boolean' ? value : fail(path, 'a boolean'); }
const boolOrNull = (value: unknown, path: string): boolean | null => value === null ? null : bool(value, path);
function list<T>(value: unknown, path: string, read: (item: unknown, path: string) => T, max = 200): T[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `an array of at most ${max} items`);
  return (value as unknown[]).map((item, index) => read(item, `${path}[${index}]`));
}
const strings = (value: unknown, path: string, max = 200): string[] => list(value, path, (item, at) => str(item, at), max);
const at = (source: JsonRecord, key: string): unknown => Object.hasOwn(source, key) ? source[key] : undefined;

function git(value: unknown, path: string): GitFacts {
  const data = record(value, path);
  return { present: bool(at(data, 'present'), `${path}.present`), dirty: boolOrNull(at(data, 'dirty'), `${path}.dirty`),
    remoteHost: strOrNull(at(data, 'remoteHost'), `${path}.remoteHost`, 255), dirtyNote: strOrNull(at(data, 'dirtyNote'), `${path}.dirtyNote`) };
}
function scan(value: unknown, path: string): ScanFacts {
  const data = record(value, path), skipped = record(at(data, 'skipped'), `${path}.skipped`);
  return { files: int(at(data, 'files'), `${path}.files`), bytesRead: int(at(data, 'bytesRead'), `${path}.bytesRead`), truncated: bool(at(data, 'truncated'), `${path}.truncated`),
    maxFiles: int(at(data, 'maxFiles'), `${path}.maxFiles`), maxFileBytes: int(at(data, 'maxFileBytes'), `${path}.maxFileBytes`),
    skipped: { directories: strings(at(skipped, 'directories'), `${path}.skipped.directories`), symlinks: int(at(skipped, 'symlinks'), `${path}.skipped.symlinks`),
      oversize: int(at(skipped, 'oversize'), `${path}.skipped.oversize`), binary: int(at(skipped, 'binary'), `${path}.skipped.binary`), unreadable: int(at(skipped, 'unreadable'), `${path}.skipped.unreadable`) } };
}
function targetVersion(value: unknown, path: string): TargetVersion {
  const data = record(value, path);
  return { version: strOrNull(at(data, 'version'), `${path}.version`), major: intOrNull(at(data, 'major'), `${path}.major`), source: strOrNull(at(data, 'source'), `${path}.source`) };
}
function finding(value: unknown, path: string): Finding {
  const data = record(value, path), severity = str(at(data, 'severity'), `${path}.severity`, 5);
  if (!(severityOrder as readonly string[]).includes(severity)) fail(`${path}.severity`, 'info, warn or block');
  return { id: str(at(data, 'id'), `${path}.id`, 80), severity: severity as Finding['severity'], message: str(at(data, 'message'), `${path}.message`, 800), evidence: strings(at(data, 'evidence'), `${path}.evidence`, 40) };
}
function angular(value: unknown, path: string): AngularFacts | null {
  if (value === null) return null;
  const data = record(value, path), counts = record(at(data, 'sourceCounts'), `${path}.sourceCounts`), routing = record(at(data, 'routing'), `${path}.routing`);
  const count = (key: string) => int(at(counts, key), `${path}.sourceCounts.${key}`);
  return {
    version: strOrNull(at(data, 'version'), `${path}.version`), major: intOrNull(at(data, 'major'), `${path}.major`), workspace: str(at(data, 'workspace'), `${path}.workspace`),
    projects: list(at(data, 'projects'), `${path}.projects`, (item, itemPath) => { const project = record(item, itemPath); return { name: str(at(project, 'name'), `${itemPath}.name`), type: str(at(project, 'type'), `${itemPath}.type`, 40),
      builder: strOrNull(at(project, 'builder'), `${itemPath}.builder`), builderClass: str(at(project, 'builderClass'), `${itemPath}.builderClass`, 40), root: str(at(project, 'root'), `${itemPath}.root`) }; }, 300),
    builders: strings(at(data, 'builders'), `${path}.builders`),
    sourceCounts: { components: count('components'), standaloneComponents: count('standaloneComponents'), ngModules: count('ngModules'), services: count('services'), pipes: count('pipes'),
      directives: count('directives'), signalCalls: count('signalCalls'), decoratorInputs: count('decoratorInputs'), sourceFiles: count('sourceFiles') },
    routing: { files: strings(at(routing, 'files'), `${path}.routing.files`, 40), routeCountEstimate: int(at(routing, 'routeCountEstimate'), `${path}.routing.routeCountEstimate`), paths: strings(at(routing, 'paths'), `${path}.routing.paths`, 60) },
    libraries: strings(at(data, 'libraries'), `${path}.libraries`), stateManagement: strings(at(data, 'stateManagement'), `${path}.stateManagement`), ssr: bool(at(data, 'ssr'), `${path}.ssr`),
    i18n: strings(at(data, 'i18n'), `${path}.i18n`), zoneless: bool(at(data, 'zoneless'), `${path}.zoneless`), bootstrap: str(at(data, 'bootstrap'), `${path}.bootstrap`, 40),
  };
}
function sections(data: JsonRecord): Pick<AdoptionReport, 'runtime' | 'frameworks' | 'ui' | 'tooling' | 'agents' | 'workbench'> {
  const runtime = record(at(data, 'runtime'), 'runtime'), manager = record(at(runtime, 'packageManager'), 'runtime.packageManager');
  const node = record(at(runtime, 'node'), 'runtime.node'), typescript = record(at(runtime, 'typescript'), 'runtime.typescript');
  const ui = record(at(data, 'ui'), 'ui'), tooling = record(at(data, 'tooling'), 'tooling'), agents = record(at(data, 'agents'), 'agents');
  const settings = record(at(agents, 'claudeSettings'), 'agents.claudeSettings'), workbench = record(at(data, 'workbench'), 'workbench');
  const names = (source: JsonRecord, key: string, base: string) => strings(at(source, key), `${base}.${key}`, 100);
  return {
    runtime: { packageManager: { name: strOrNull(at(manager, 'name'), 'runtime.packageManager.name', 40), version: strOrNull(at(manager, 'version'), 'runtime.packageManager.version', 80), lockfiles: names(manager, 'lockfiles', 'runtime.packageManager') },
      node: { engines: strOrNull(at(node, 'engines'), 'runtime.node.engines'), nvmrc: strOrNull(at(node, 'nvmrc'), 'runtime.node.nvmrc'), nodeVersionFile: strOrNull(at(node, 'nodeVersionFile'), 'runtime.node.nodeVersionFile'), toolVersions: strOrNull(at(node, 'toolVersions'), 'runtime.node.toolVersions') },
      typescript: { range: strOrNull(at(typescript, 'range'), 'runtime.typescript.range'), major: intOrNull(at(typescript, 'major'), 'runtime.typescript.major'), strict: boolOrNull(at(typescript, 'strict'), 'runtime.typescript.strict'), configs: names(typescript, 'configs', 'runtime.typescript') },
      scripts: names(runtime, 'scripts', 'runtime') },
    frameworks: list(at(data, 'frameworks'), 'frameworks', (item, path) => { const fact = record(item, path); return { id: str(at(fact, 'id'), `${path}.id`, 60), version: strOrNull(at(fact, 'version'), `${path}.version`, 80), detail: strOrNull(at(fact, 'detail'), `${path}.detail`), evidence: strings(at(fact, 'evidence'), `${path}.evidence`, 40) }; }, 40),
    ui: { styling: names(ui, 'styling', 'ui'), tokenFiles: names(ui, 'tokenFiles', 'ui'), themeFiles: names(ui, 'themeFiles', 'ui'), styleFiles: int(at(ui, 'styleFiles'), 'ui.styleFiles') },
    tooling: { testing: names(tooling, 'testing', 'tooling'), specFiles: int(at(tooling, 'specFiles'), 'tooling.specFiles'), lint: names(tooling, 'lint', 'tooling'), format: names(tooling, 'format', 'tooling'),
      ciProviders: names(tooling, 'ciProviders', 'tooling'), workflows: names(tooling, 'workflows', 'tooling'), monorepo: names(tooling, 'monorepo', 'tooling'), workspaces: names(tooling, 'workspaces', 'tooling') },
    agents: { files: names(agents, 'files', 'agents'), skills: names(agents, 'skills', 'agents'), claudeSettings: { present: bool(at(settings, 'present'), 'agents.claudeSettings.present'), hooks: bool(at(settings, 'hooks'), 'agents.claudeSettings.hooks'), permissions: bool(at(settings, 'permissions'), 'agents.claudeSettings.permissions') } },
    workbench: { present: bool(at(workbench, 'present'), 'workbench.present'), kitPath: strOrNull(at(workbench, 'kitPath'), 'workbench.kitPath'), evidence: names(workbench, 'evidence', 'workbench') },
  };
}
/** Validates untrusted report JSON into a fresh object; unknown schema ids and malformed fields are refused. */
export function parseReport(value: unknown): AdoptionReport {
  const data = record(value, 'report');
  requireAdoption(at(data, 'schema') === reportSchemaId, 'ADOPT_REPORT_SCHEMA', `Unsupported report schema; expected ${reportSchemaId}.`);
  const target = record(at(data, 'target'), 'target'), targets = record(at(data, 'targets'), 'targets');
  return {
    schema: reportSchemaId, recordedAt: strOrNull(at(data, 'recordedAt'), 'recordedAt', 40),
    target: { name: str(at(target, 'name'), 'target.name', 200), git: git(at(target, 'git'), 'target.git') }, scan: scan(at(data, 'scan'), 'scan'),
    ...sections(data), angular: angular(at(data, 'angular'), 'angular'),
    targets: { angular: targetVersion(at(targets, 'angular'), 'targets.angular'), node: targetVersion(at(targets, 'node'), 'targets.node'), typescript: targetVersion(at(targets, 'typescript'), 'targets.typescript') },
    findings: list(at(data, 'findings'), 'findings', finding, 400),
  };
}
