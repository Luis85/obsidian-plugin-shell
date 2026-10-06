import type { AgentFacts, Finding, FrameworkFact, GitFacts, ScanFacts, ToolingFacts, WorkbenchFacts } from './contracts.ts';
import { defaultVaultConfigDirectory } from '../host-paths.ts';
import { finding } from './findings.ts';
import { addedPaths } from './paths.ts';
import type { InventoryView } from './source.ts';

function gitFindings(git: GitFacts): Finding[] {
  if (!git.present) return [finding('GIT_ABSENT', 'warn', 'The folder is not a Git repository: there is no rollback or review trail for the integration, and project-setup requires a Git root.')];
  const found: Finding[] = [];
  if (git.dirty === true) found.push(finding('GIT_DIRTY', 'warn', 'The working tree has uncommitted changes; commit or stash them so the integration is a separate, reviewable change.', ['.git']));
  if (git.dirty === null) found.push(finding('GIT_STATE_UNKNOWN', 'info', git.dirtyNote ?? 'Whether the working tree is clean was not determined; run git status before starting.', ['.git']));
  if (git.remoteHost) found.push(finding('GIT_REMOTE', 'info', `The origin remote is hosted on ${git.remoteHost} (credentials are never recorded).`, ['.git/config']));
  return found;
}
function scanFindings(scan: ScanFacts, malformed: readonly string[]): Finding[] {
  const found: Finding[] = [];
  if (scan.truncated) found.push(finding('SCAN_TRUNCATED', 'warn', `The scan reached a limit (${scan.maxFiles} files, the source-file or the byte budget); counts are partial. Analyse a sub-folder with --target.`));
  const note = (count: number, id: string, message: string) => { if (count > 0) found.push(finding(id, 'info', `${count} ${message}`)); };
  note(scan.skipped.symlinks, 'SYMLINKS_SKIPPED', 'symbolic links were not followed or read.');
  note(scan.skipped.oversize, 'OVERSIZE_FILES_SKIPPED', `files over ${scan.maxFileBytes} bytes were counted but not read.`);
  note(scan.skipped.binary, 'BINARY_FILES_SKIPPED', 'binary files were not read.');
  note(scan.skipped.unreadable, 'UNREADABLE_FILES_SKIPPED', 'files could not be read and were skipped.');
  for (const path of malformed) found.push(finding('MALFORMED_CONFIG', 'warn', `${path} is not valid JSON; facts that depend on it are missing from this report.`, [path]));
  return found;
}
function agentFindings(agents: AgentFacts): Finding[] {
  const found: Finding[] = [];
  const instructions = agents.files.filter(path => /^(?:AGENTS|CLAUDE|GEMINI)\.md$|copilot-instructions|^\.cursor|^\.windsurf/.test(path));
  if (instructions.length) found.push(finding('AGENT_INSTRUCTIONS_PRESENT', 'info', 'Agent instruction files already exist; the plan merges a short Workbench section and never overwrites them.', instructions));
  if (agents.claudeSettings.present) found.push(finding('CLAUDE_SETTINGS_PRESENT', 'info', `.claude/settings.json exists (${agents.claudeSettings.hooks ? 'with' : 'without'} hooks, ${agents.claudeSettings.permissions ? 'with' : 'without'} permissions); additions are merged by hand, never replaced.`, ['.claude/settings.json']));
  return found;
}
function workbenchFindings(workbench: WorkbenchFacts): Finding[] {
  const found: Finding[] = [];
  const paths = (items: string[]) => items.map(item => item.replace(/ \(.*\)$/, ''));
  if (workbench.kitPath !== null) found.push(finding('WORKBENCH_KIT_PRESENT', 'info', `The CLI kit is already extracted at ${workbench.kitPath}; phase 1 only verifies it.`, paths(workbench.evidence.filter(item => item.endsWith('(CLI kit)')))));
  if (workbench.present) found.push(finding('WORKBENCH_PRESENT', 'warn', 'Workbench files beyond the CLI kit already exist; reconcile with them (upgrade, not install) instead of repeating the first-time steps.', paths(workbench.evidence.filter(item => !item.endsWith('(CLI kit)')))));
  return found;
}
function frameworkFindings(frameworks: FrameworkFact[], view: InventoryView, tooling: ToolingFacts): Finding[] {
  const found: Finding[] = [];
  const obsidian = frameworks.find(item => item.id === 'obsidian-plugin');
  if (obsidian) found.push(finding('OBSIDIAN_PLUGIN_DETECTED', 'info', `Obsidian plugin manifest found (${obsidian.detail ?? 'minAppVersion unknown'}).`, obsidian.evidence));
  const others = frameworks.filter(item => ['react', 'next', 'vue', 'nuxt', 'svelte', 'sveltekit', 'solid', 'preact', 'astro', 'lit'].includes(item.id));
  if (others.length) found.push(finding('NON_ANGULAR_FRONTEND', 'info', `Frontend framework(s) detected: ${others.map(item => item.id + (item.version ? ' ' + item.version : '')).join(', ')}; a generated Angular app would be a second stack.`, others.flatMap(item => item.evidence)));
  if (!view.hasDirectory(defaultVaultConfigDirectory)) found.push(finding('NOT_AN_OBSIDIAN_VAULT', 'info', `No ${defaultVaultConfigDirectory} folder: project-setup needs a Git root that is also an Obsidian vault, so the plan uses sketch and new instead.`));
  if (tooling.monorepo.includes('nx')) found.push(finding('NX_WORKSPACE', 'info', 'Nx workspace: a generated app under apps/ is outside the Nx project graph until it is added deliberately.', ['nx.json']));
  if (!tooling.ciProviders.length) found.push(finding('NO_CI_DETECTED', 'info', 'No CI provider configuration was found.'));
  return found;
}
function collisionFindings(view: InventoryView): Finding[] {
  const found: Finding[] = [];
  for (const path of addedPaths) {
    if (view.has(path)) found.push(finding('PATH_COLLISION_FILE', 'block', `${path} exists as a file where the integration needs a directory.`, [path]));
    else if (view.hasDirectory(path)) found.push(finding('PATH_COLLISION', 'warn', `${path}/ already exists; the integration would add files beside existing content.`, [path]));
  }
  return found;
}
export function repositoryFindings(parts: { git: GitFacts; scan: ScanFacts; agents: AgentFacts; workbench: WorkbenchFacts; frameworks: FrameworkFact[]; tooling: ToolingFacts; view: InventoryView }): Finding[] {
  const { git, scan, agents, workbench, frameworks, tooling, view } = parts;
  const collisions = collisionFindings(view);
  const kitIsWorkbench = workbench.kitPath !== null;
  return [...gitFindings(git), ...scanFindings(scan, view.malformed), ...agentFindings(agents), ...workbenchFindings(workbench), ...frameworkFindings(frameworks, view, tooling),
    ...(kitIsWorkbench ? collisions.filter(item => !item.evidence.includes(workbench.kitPath!)) : collisions)];
}
