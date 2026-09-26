/** One-command project creation from a reviewed built-in starter. It composes the
 * existing catalog loader, identity-only customization and project compiler/plan
 * engine; it never has its own template, hashing or file-writing rules. */
import { mkdtemp, writeFile, rm, lstat, readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadStarterCatalog } from '../companion/starter-files.mjs';
import { customizeStarter } from '../companion/starter-contract.mjs';
import { companionRelativeFolder } from '../companion/project-contract.mjs';
import { planProject } from '../companion/compiler/plan.ts';
import { exists } from './files.ts';
import { verifyKit } from './kit-integrity.ts';
import { npmEntry, runNode } from './process.ts';
import { OperationError, requireThat, result, stringOption, type Context, type Request, type Result } from './contracts.ts';
interface StarterEntry { id: string; name: string; category: string; level: string; summary: string; version: string; sha256: string; document: { project: { id: string } } }
interface StarterCatalog { starters: StarterEntry[] }
interface StarterSummary { directory: string; starter: { id: string }; nextSteps?: string[] }
const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** A kit or configured consumer carries its verified template under .framework/template. */
async function templateRoot(context: Context): Promise<string> {
  if (!await exists(join(context.frameworkRoot, '.framework/kit.json'))) return context.frameworkRoot;
  await verifyKit(context.frameworkRoot); return join(context.frameworkRoot, '.framework/template');
}
export async function starterCatalog(context: Context): Promise<{ template: string; catalog: StarterCatalog }> {
  const template = await templateRoot(context);
  const catalog: StarterCatalog = await loadStarterCatalog(template);
  return { template, catalog };
}
export async function starterListing(context: Context): Promise<Result> {
  const { catalog } = await starterCatalog(context);
  return result('new', { integrity: 'catalog-sha256-verified', starters: catalog.starters.map(entry => ({ id: entry.id, title: entry.name,
    category: entry.category, difficulty: entry.level, description: entry.summary, version: entry.version, sha256: entry.sha256 })) });
}
/** Obsidian community IDs are lowercase and must not contain "obsidian"; the project contract validates the rest. */
export function pluginIdProblem(id: string): string | null {
  if (id.length > 60 || !idPattern.test(id)) return 'Use lowercase letters, digits and single hyphens, starting with a letter (at most 60 characters).';
  if (id.includes('obsidian')) return 'Obsidian plugin IDs must not contain "obsidian".';
  return null;
}
export function derivedId(directory: string, fallback: string): string {
  const slug = basename(directory).toLowerCase().replaceAll('obsidian', '-').replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 60).replace(/-+$/, '');
  return slug && pluginIdProblem(slug) === null ? slug : fallback;
}
export function derivedName(id: string): string {
  return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
/** Terminal paths are relative to the invoking shell, including `npm run new` (INIT_CWD). */
export function invocationDirectory(path: string, environment: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
  const base = environment.npm_lifecycle_event === 'new' && environment.INIT_CWD ? environment.INIT_CWD : cwd;
  return resolve(base, path);
}
interface Placement { directory: string; vault: string; target: string }
/** Map <dir> onto the generator's vault/target contract without creating anything:
 * the nearest existing ancestor is the vault and the file planner creates the rest. */
async function placement(context: Context, dir: string | undefined): Promise<Placement> {
  requireThat(dir, 'TARGET_REQUIRED', 'Supply the new project directory: new <dir> --starter <id> (see new --list).');
  const requested = resolve(context.root, dir), missing = [basename(requested)];
  let ancestor = dirname(requested);
  while (!await exists(ancestor)) { missing.unshift(basename(ancestor)); requireThat(dirname(ancestor) !== ancestor, 'TARGET_INVALID', 'No existing ancestor folder.'); ancestor = dirname(ancestor); }
  const vault = await realpath(ancestor), directory = join(vault, ...missing), framework = await realpath(context.frameworkRoot);
  const within = relative(framework, directory);
  requireThat(within === '..' || within.startsWith('..' + sep) || isAbsolute(within), 'TARGET_INSIDE_FRAMEWORK', `Create the project outside the framework checkout ${framework}, for example ../${missing.at(-1)}.`);
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
  const place = await placement(context, request.args[0]);
  const { template, catalog } = await starterCatalog(context);
  const starterId = stringOption(request.options, 'starter');
  requireThat(starterId, 'STARTER_REQUIRED', 'Supply --starter <id>; list the reviewed starters with new --list.');
  const entry = catalog.starters.find(item => item.id === starterId);
  requireThat(entry, 'STARTER_UNKNOWN', `Unknown starter ${starterId}; list the reviewed starters with new --list.`);
  const id = stringOption(request.options, 'id') ?? derivedId(place.directory, entry.document.project.id);
  const problem = pluginIdProblem(id); if (problem) throw new OperationError('INVALID_PLUGIN_ID', `Invalid plugin ID "${id}". ${problem}`, 'Pass --id <plugin-id>.');
  const author = stringOption(request.options, 'author');
  // Identity only, exactly like the concept's starter configuration: never global label rewrites.
  const document = customizeStarter(catalog, entry.id, { id, name: stringOption(request.options, 'name') ?? derivedName(id), ...(author === undefined ? {} : { author }) });
  const scratch = await mkdtemp(join(tmpdir(), 'shell-new-'));
  try {
    const input = join(scratch, 'project.json');
    await writeFile(input, JSON.stringify(document, null, 2) + '\n', { flag: 'wx' });
    const planned = await planProject({ input, vault: place.vault, target: place.target, templateRoot: template });
    const summary = { starter: { id: entry.id, title: entry.name, version: entry.version, sha256: entry.sha256 }, identity: document.project,
      directory: place.directory, vault: place.vault, target: place.target, files: planned.summary.files,
      acceptanceTodos: planned.summary.acceptanceTodos, warnings: planned.summary.warnings };
    return { ...planned, summary };
  } finally { await rm(scratch, { recursive: true, force: true }); }
}
function nextSteps(directory: string): string[] {
  return [`cd ${JSON.stringify(directory)}`, 'npm ci', 'npm run verify:project', 'npm run test:watch', 'npm run dev:ui'];
}
/** Adds guidance, and only after a written project runs the explicitly requested install/verify. */
export async function completeStarterProject(outcome: Result, request: Request, context: Context): Promise<Result> {
  if (!['planned', 'applied', 'blocked'].includes(outcome.status)) return outcome;
  const data = outcome.data as { summary: StarterSummary };
  const directory = data.summary.directory, steps = nextSteps(directory);
  const guide = { readme: join(directory, 'README.md'), implementation: join(directory, 'PROJECT-IMPLEMENTATION.md') };
  if (outcome.status !== 'applied') return { ...outcome, data: { ...data, written: false, next: 'Nothing has been written. To create the project, confirm when asked or re-run with --yes (or --apply <planHash>).' } };
  if (!request.options.install) return { ...outcome, data: { ...data, written: true, nextSteps: steps, guide } };
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
  return { ...outcome, data: { ...data, written: true, install: executions, nextSteps: steps.filter(step => !['npm ci', 'npm run verify:project'].includes(step)), guide } };
}
