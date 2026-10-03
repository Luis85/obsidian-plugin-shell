import { defaultVaultConfigDirectory } from '../../domain/host-paths.ts';
import { storybookFlags } from './storybook-options.ts';
/** One-command project creation from a reviewed local JSON starter. It composes the
 * definition loader, identity-only customization and project compiler/plan
 * engine; it never has its own template, hashing or file-writing rules. */

import { mkdtemp, writeFile, rm, lstat, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { companionStarters, loadDefinitions } from '../starters/repository.ts';
import type { CompanionStarter } from '../starters/types.ts';
import { listStarters } from '../starters/operations.ts';
import { definitionProjectPlan } from '../starters/project.ts';
import { completeDefinition } from '../starters/processes.ts';
import { companionRelativeFolder } from '../../../scripts/companion/authoring-contract.ts';
import { planProject } from '../../compiler/adapters/project-plan.ts';
import { exists } from './files.ts';
import { statIfPresent } from '../../../scripts/shared/fs-presence.ts';
import { verifyKit } from './kit-integrity.ts';
import { npmEntry, runNode } from './process.ts';
import { OperationError, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { withAirshipOption } from '../../../scripts/companion/tooling-options.ts';
import { exportedProject } from './project-from.ts';
import { restoreExecutableBits } from './executable-bits.ts';
import { initializeRepository, type GitReport } from './git-init.ts';
import { derivedPluginId, exportedIdProblem, exportedIdWarning, pluginIdProblem } from './plugin-id.ts';
interface StarterSummary { directory: string; nextSteps?: string[] }
/** A kit or configured consumer carries its verified template under bin/template. */
async function templateRoot(context: Context): Promise<string> {
  if (!await exists(join(context.frameworkRoot, 'bin/kit.json'))) return context.frameworkRoot;
  await verifyKit(context.frameworkRoot); return join(context.frameworkRoot, 'bin/template');
}
/** Companion starters from the invocation project's starter folder, with the template that generates them. */
export async function companionStarterSet(context: Context): Promise<{ template: string; starters: CompanionStarter[] }> {
  const template = await templateRoot(context);
  return { template, starters: companionStarters(await loadDefinitions(context.root)) };
}
export async function starterListing(context: Context): Promise<Result> {
  return listStarters(context, 'new');
}
/** The shared ID rule (plugin-id.ts) that `check submission` also applies; the project contract validates the rest. */
export { pluginIdProblem };
export function derivedId(directory: string, starterId: string): string {
  return derivedPluginId(basename(directory), starterId);
}
export function derivedName(id: string): string {
  return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
/** Terminal paths are relative to the invoking shell, including `npm run new` (INIT_CWD). */
export function invocationDirectory(path: string, environment: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
  const base = environment.npm_lifecycle_event === 'new' && environment.INIT_CWD ? environment.INIT_CWD : cwd;
  return resolve(base, path);
}
const invocationPaths: Readonly<Record<string, readonly string[]>> = { new: ['values'], 'starters add': ['input'], 'starters edit': ['input'], 'starters pack': ['out'], 'starters run': ['project'] };
/** Starter commands read configs/starters from the package root unless --root names another starter workspace.
 * Without --root their path options still resolve from the invoking shell, as they did when that was the root. */
export function starterInvocation(request: Request, frameworkRoot: string): { request: Request; root: string } {
  const selected = request.options.root;
  if (typeof selected === 'string') return { request, root: resolve(selected) };
  const options = { ...request.options };
  if (request.command === 'starters run' && options.project === undefined) options.project = '.';
  for (const key of invocationPaths[request.command] ?? []) {
    const value = options[key];
    if (typeof value === 'string' && value !== '-') options[key] = invocationDirectory(value);
  }
  return { request: { ...request, options }, root: frameworkRoot };
}
interface Placement { directory: string; vault: string; target: string }
/** Map <dir> onto the generator's vault/target contract without creating anything:
 * the nearest existing ancestor is the vault and the file planner creates the rest. */
/** The nearest existing folder (the start or an ancestor) that holds a `.obsidian` directory. */
export async function enclosingVault(start: string): Promise<string | null> {
  for (let current = resolve(start); ; current = dirname(current)) {
    // Only an existing directory can hold the marker; probing below a file would fail with ENOTDIR.
    const marker = join(current, defaultVaultConfigDirectory);
    if ((await statIfPresent(current))?.isDirectory() && (await statIfPresent(marker))?.isDirectory()) return current;
    if (dirname(current) === current) return null;
  }
}
async function placement(context: Context, dir: string | undefined, insideVault = false): Promise<Placement> {
  requireThat(dir, 'TARGET_REQUIRED', 'Supply the new project directory: new <dir> --starter <id> (see new --list).');
  const requested = resolve(context.root, dir), missing = [basename(requested)];
  let ancestor = dirname(requested);
  while (!await exists(ancestor)) { missing.unshift(basename(ancestor)); requireThat(dirname(ancestor) !== ancestor, 'TARGET_INVALID', 'No existing ancestor folder.'); ancestor = dirname(ancestor); }
  const vault = await realpath(ancestor), directory = join(vault, ...missing), framework = await realpath(context.frameworkRoot);
  const within = relative(framework, directory);
  requireThat(within === '..' || within.startsWith('..' + sep) || isAbsolute(within), 'TARGET_INSIDE_FRAMEWORK', `Create the project outside the framework checkout ${framework}, for example ../${missing.at(-1)}.`);
  const vaultRoot = await enclosingVault(directory);
  if (vaultRoot && !insideVault) throw new OperationError('TARGET_INSIDE_VAULT', `${directory} is inside the Obsidian vault ${vaultRoot} (it has a .obsidian folder). A plugin project must not live in a personal vault: create it elsewhere, for example next to this checkout.`, 'Choose a directory outside any vault, or pass --inside-vault if this vault is a disposable test vault you own.');
  const target = missing.join('/');
  requireThat(companionRelativeFolder(target), 'TARGET_INVALID', 'Use folder names of letters, digits, spaces, dots, hyphens or underscores, starting with a letter or digit.');
  if (await exists(directory)) {
    const stat = await lstat(directory);
    requireThat(stat.isDirectory() && !stat.isSymbolicLink(), 'TARGET_NOT_DIRECTORY', `${directory} exists and is not a plain directory.`);
    requireThat((await readdir(directory)).length === 0, 'TARGET_NOT_EMPTY', `${directory} is not empty; choose a new or empty directory. Existing files are never overwritten.`);
  }
  return { directory, vault, target };
}
/** Returns the compiler's own plan; planning.ts binds it to the request and rebuilds it before apply. */
export async function starterProjectPlan(request: Request, context: Context) {
  const from = request.options.from !== undefined;
  requireThat(!from || (request.options.extension === undefined && request.options.extensions === undefined), 'NATIVE_OPTIONS_REQUIRE_STARTER', 'Use native options with --starter, or edit design.nativeIntegrations in the exported JSON.');
  requireThat(!from || request.options.starter === undefined, 'SOURCE_CONFLICT', 'Use either --starter <id> or --from <project.json>, not both.');
  requireThat(!from || ['values', 'answers', 'run', 'trust-processes'].every(key => request.options[key] === undefined), 'STARTER_OPTION', 'Definition inputs/processes require --starter, not --from.');
  const place = await placement(context, request.args[0], request.options['inside-vault'] === true);
  if (!from) return definitionProjectPlan(request, context, place, await templateRoot(context));
  const created = await fromExport(request, context);
  const scratch = await mkdtemp(join(tmpdir(), 'shell-new-'));
  try {
    const input = join(scratch, 'project.json');
    await writeFile(input, JSON.stringify(withAirshipOption(created.document, request.options), null, 2) + '\n', { flag: 'wx' });
    const planned = await planProject({ input, vault: place.vault, target: place.target, templateRoot: created.template, storybook: storybookFlags(request.options) });
    const summary = { ...created.origin, identity: created.document.project,
      directory: place.directory, vault: place.vault, target: place.target, files: planned.summary.files,
      acceptanceTodos: planned.summary.acceptanceTodos, warnings: [...(created.warnings ?? []), ...planned.summary.warnings] };
    return { ...planned, summary };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
/** Any exported companion project; its own identity unless --id/--name/--author override it. */
async function fromExport(request: Request, context: Context) {
  // An explicit --id follows the creation rule; the export's own ID only has to be a valid manifest ID.
  const explicit = stringOption(request.options, 'id') !== undefined;
  const exported = await exportedProject(request, context, explicit ? pluginIdProblem : exportedIdProblem);
  const warning = explicit ? null : exportedIdWarning(exported.document.project.id);
  return { template: await templateRoot(context), document: exported.document, origin: { source: exported.source }, warnings: warning ? [warning] : [] };
}
function nextSteps(directory: string): string[] {
  return [`cd ${JSON.stringify(directory)}`, 'npm ci', 'npm run check', 'npm run dev:obsidian', 'npm run test:watch'];
}
/** Runs npm ci then project verification; a failure keeps the written project and names the step to rerun. */
async function installAndVerify(request: Request, context: Context, directory: string): Promise<Record<string, unknown>> {
  const project: Context = { ...context, root: directory }, npm = await npmEntry();
  const timeout = Number(stringOption(request.options, 'timeout') ?? '600000');
  const executions: Record<string, unknown> = {};
  for (const [label, args] of [['npm ci', ['ci', '--no-fund']], ['npm run verify:project', ['run', 'verify:project']]] as const) {
    context.progress?.(`\n> ${label} (in ${directory})\n`);
    try { const { exitCode, signal, truncated } = await runNode(project, npm, args, timeout); executions[label] = { exitCode, signal, truncated }; }
    catch (error) {
      if (!(error instanceof OperationError)) throw error;
      const failed = new OperationError(error.code, `The project was created at ${directory}, but ${label} failed: ${error.message}`, `cd ${JSON.stringify(directory)} && ${label}`);
      failed.details = { written: true, directory, completed: executions, failure: error.details ?? null, automaticRetry: false }; throw failed;
    }
  }
  return executions;
}
/** The initial git commit of a newly written project, unless --no-git; the project itself is already written either way. */
async function versionControl(request: Request, context: Context, directory: string): Promise<GitReport> {
  await restoreExecutableBits(directory);
  if (request.options['no-git'] === true) return { status: 'skipped', reason: '--no-git was passed' };
  const report = await initializeRepository(directory, stringOption(request.options, 'starter') ?? 'an exported project');
  context.progress?.(`git: ${report.status}${report.reason ? ` (${report.reason})` : ''}\n`);
  return report;
}
/** Adds guidance, and only after a written project runs the explicitly requested install/verify. */
export async function completeStarterProject(outcome: Result, request: Request, context: Context): Promise<Result> {
  if (!['planned', 'applied', 'blocked'].includes(outcome.status)) return outcome;
  const planned = outcome.data as { summary: StarterSummary & { recipe?: unknown } };
  const written = outcome.status === 'applied';
  const git = written ? await versionControl(request, context, planned.summary.directory) : undefined;
  const data = git ? { ...planned, git } : planned;
  if (data.summary.recipe) return completeDefinition({ ...outcome, data }, request, context);
  const directory = data.summary.directory, steps = nextSteps(directory);
  const guide = { readme: join(directory, 'README.md'), implementation: join(directory, 'PROJECT-IMPLEMENTATION.md') };
  if (!written) return { ...outcome, data: { ...data, written: false, next: 'Nothing has been written. To create the project, confirm when asked or re-run with --yes (or --apply <planHash>).' } };
  if (!request.options.install) return { ...outcome, data: { ...data, written: true, nextSteps: steps, guide } };
  const executions = await installAndVerify(request, context, directory);
  return { ...outcome, data: { ...data, written: true, install: executions, nextSteps: steps.filter(step => step !== 'npm ci'), guide } };
}
