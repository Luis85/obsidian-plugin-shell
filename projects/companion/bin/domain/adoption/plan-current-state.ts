import type { AdoptionReport, AngularFacts } from './contracts.ts';
import { bullets, code, list, plain, table } from './plan-markdown.ts';

const none = '_none detected_';
function repository(report: AdoptionReport): string[] {
  const { git } = report.target;
  const state = !git.present ? 'not a Git repository' : `Git repository, working tree ${git.dirty === null ? 'state not determined' : git.dirty ? 'has uncommitted changes' : 'clean'}${git.remoteHost ? `, origin on ${plain(git.remoteHost)}` : ''}`;
  const monorepo = report.tooling.monorepo.length ? list(report.tooling.monorepo) : none;
  return ['### Identity and repository', ...bullets([`Name: ${code(report.target.name)}`, `Repository: ${state}`, `Monorepo tooling: ${monorepo}`, `Workspaces: ${list(report.tooling.workspaces, none)}`])];
}
function toolchain(report: AdoptionReport): string[] {
  const { runtime } = report, manager = runtime.packageManager;
  const node = [['.nvmrc', runtime.node.nvmrc], ['.node-version', runtime.node.nodeVersionFile], ['.tool-versions', runtime.node.toolVersions], ['engines.node', runtime.node.engines]]
    .filter((entry): entry is [string, string] => entry[1] !== null).map(([file, value]) => `${file} ${code(value)}`);
  return ['### Toolchain', ...bullets([
    `Package manager: ${manager.name ? code(manager.name + (manager.version ? '@' + manager.version : '')) : none}; lockfiles: ${list(manager.lockfiles, none)}`,
    `Node: ${node.length ? node.join(', ') : none}; Workbench is qualified on ${code(report.targets.node.version ?? 'unknown')}`,
    `TypeScript: ${runtime.typescript.range ? code(runtime.typescript.range) : none}; strict: ${runtime.typescript.strict === null ? 'not stated' : String(runtime.typescript.strict)}; repository pin ${code(report.targets.typescript.version ?? 'unknown')}`,
    `Package scripts: ${list(runtime.scripts.slice(0, 20), none)}`])];
}
function frameworks(report: AdoptionReport): string[] {
  const rows = report.frameworks.map(item => [code(item.id), code(item.version ?? '-'), plain(item.detail ?? ''), item.evidence.map(code).join(', ') || '-']);
  return ['### Frameworks', ...(rows.length ? table(['Framework', 'Version', 'Detail', 'Evidence'], rows) : [none])];
}
function counts(angular: AngularFacts): string {
  const c = angular.sourceCounts;
  return `${c.components} components (${c.standaloneComponents} standalone, estimate), ${c.ngModules} NgModules, ${c.services} services, ${c.pipes} pipes, ${c.directives} directives, ${c.signalCalls} signal-API calls, ${c.decoratorInputs} decorator inputs, from ${c.sourceFiles} source files`;
}
function angularSection(report: AdoptionReport): string[] {
  const angular = report.angular;
  if (!angular) return [];
  const projects = angular.projects.slice(0, 12).map(project => `${code(project.name)} (${plain(project.type)}, builder ${project.builder ? code(project.builder) : 'none'}, class ${code(project.builderClass)}, root ${code(project.root || '.')})`);
  return ['### Angular', ...bullets([
    `Version: ${code(angular.version ?? 'unknown')}; Workbench target ${code(report.targets.angular.version ?? 'unknown')} (${plain(report.targets.angular.source ?? 'not found')})`,
    `Workspace configuration: ${code(angular.workspace)}; bootstrap: ${code(angular.bootstrap)}; zoneless: ${angular.zoneless ? 'yes' : 'no'}`,
    `Projects: ${projects.length ? projects.join('; ') : none}`, `Source: ${counts(angular)}`,
    `Routing: ${angular.routing.routeCountEstimate} route entries (estimate) in ${list(angular.routing.files.slice(0, 8), none)}`,
    `Libraries: ${list(angular.libraries, none)}; state management: ${list(angular.stateManagement, none)}`,
    `SSR: ${angular.ssr ? 'yes' : 'no'}; i18n: ${list(angular.i18n, none)}`])];
}
function quality(report: AdoptionReport): string[] {
  const { ui, tooling } = report;
  return ['### UI, testing, quality and CI', ...bullets([
    `Styling: ${list(ui.styling, none)}; ${ui.styleFiles} style files; token files ${list(ui.tokenFiles.slice(0, 6), none)}; theme files ${list(ui.themeFiles.slice(0, 6), none)}`,
    `Testing: ${list(tooling.testing, none)} (${tooling.specFiles} spec files)`, `Lint and hooks: ${list(tooling.lint, none)}; formatting: ${list(tooling.format, none)}`,
    `CI: ${list(tooling.ciProviders, none)}${tooling.workflows.length ? `; workflows ${list(tooling.workflows.slice(0, 8))}` : ''}`])];
}
function agentsAndWorkbench(report: AdoptionReport): string[] {
  const { agents, workbench } = report;
  const settings = agents.claudeSettings.present ? `present (hooks: ${agents.claudeSettings.hooks ? 'yes' : 'no'}, permissions: ${agents.claudeSettings.permissions ? 'yes' : 'no'})` : 'absent';
  return ['### Agent setup and existing Workbench presence', ...bullets([
    `Agent files: ${list(agents.files.slice(0, 12), none)}`, `Skills: ${list(agents.skills, none)}; .claude/settings.json ${settings}`,
    `Workbench present: ${workbench.present ? 'yes - ' + workbench.evidence.map(plain).join('; ') : workbench.kitPath === null ? 'no' : `no prior adoption; the CLI kit is extracted at ${code(workbench.kitPath)}`}`])];
}
function scope(report: AdoptionReport): string[] {
  const { scan } = report;
  return ['### Scan scope', ...bullets([`${scan.files} files counted${scan.truncated ? ' (stopped at the limit)' : ''}; ${scan.bytesRead} bytes read; read-only, no target code or package script was executed`,
    `Skipped: ${scan.skipped.symlinks} symbolic links, ${scan.skipped.oversize} oversize files, ${scan.skipped.binary} binary files, ${scan.skipped.unreadable} unreadable; directories ${list(scan.skipped.directories, none)}`])];
}
function findings(report: AdoptionReport): string[] {
  const rows = report.findings.map(item => [item.severity, code(item.id), plain(item.message), item.evidence.map(code).join(', ') || '-']);
  return ['### Compatibility findings', ...(rows.length ? table(['Severity', 'Id', 'Finding', 'Evidence'], rows) : [none])];
}
export function currentState(report: AdoptionReport): string[][] {
  return [['## 2. Current state', '', 'Facts come from the adoption report; evidence paths are relative to the project root. Counts marked estimate are regular-expression based and are meant for sizing, not for decisions.'],
    repository(report), toolchain(report), frameworks(report), angularSection(report), quality(report), agentsAndWorkbench(report), scope(report), findings(report)];
}
