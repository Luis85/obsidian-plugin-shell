import { resolve } from 'node:path';
import { packStarterOperation, readStarterOperation } from '../starters/operations.ts';
import { starterProcessOperation } from '../starters/processes.ts';
import { adoptAnalyze } from './adopt-operation.ts';
import { airshipOperation } from './airship.ts';
import { buildClickdummy } from './clickdummy.ts';
import { checkOperation } from './check.ts';
import { checkPlanOperation } from './check-plan.ts';
import { ciOperation } from './ci.ts';
import { commandGroup, commands, descriptor, parameterKinds, validateRequest } from './catalog.ts';
import { compilerOperation } from '../../compiler/adapters/cli.ts';
import { docsRead } from './docs.ts';
import { obsidianRead } from './obsidian-cli.ts';
import { fixtureOperation } from './fixtures.ts';
import { baseOperation } from './base-command.ts';
import { siteTemplatesOperation } from './site-command.ts';
import { commandHelp, helpIndex } from './help-text.ts';
import { operationSchemas } from './schema.ts';
import { setupProgress } from './setup-progress.ts';
import { starterListing, completeStarterProject } from './starter-project.ts';
import { storybookOperation } from './storybook.ts';
import { submissionCheck } from './submission.ts';
import { suggestions, didYouMean } from './suggest.ts';
import { capabilityCatalog } from '../operations/catalog.ts';
import { result, failure, requireThat, stringOption, OperationError, type Context, type Request, type Result } from './contracts.ts';
import { runNode } from './process.ts';
import { fileOperation } from './file-operation.ts';
import { processOperation } from './process-operation.ts';
import { readOperation } from './read-operation.ts';
import { readComponentTemplateOperation } from './component-templates.ts';
import { isUiCommand, uiOperation } from './ui-operation.ts';
import { pluginsRead } from '../community-plugins/operations.ts';

/** One command page, a group of subcommands sharing a root word, every command, or the golden path. */
function helpSelection(request: Request) {
  const command = request.command;
  const selected = command === 'help' ? request.args.join(' ') : request.options.help ? command : '';
  const group = selected && !commands.some(item => item.id === selected) ? commandGroup(selected) : [];
  if (group.length) return { selected, group, entries: group.map(descriptor), scope: 'group' };
  if (selected) return { selected, group, entries: [descriptor(selected)], scope: 'command' };
  return { selected, group, entries: commands, scope: command === 'capabilities' || request.options.all ? 'all' : 'golden-path' };
}
function helpOperation(request: Request): Result {
  const command = request.command;
  const { selected, group, entries, scope } = helpSelection(request);
  return result(command, {
    protocolVersion: 1,
    scope,
    ...(group.length ? { group: selected } : {}),
    ...helpIndex(),
    commands: entries.map(entry => ({
      ...entry,
      options: parameterKinds(entry),
      availability: 'implemented',
      execution: entry.effect === 'process' ? 'trusted-project-code' : entry.effect,
      ...commandHelp(entry),
    })),
    makers: capabilityCatalog().makers,
    examples: [
      'node bin/app new ../my-plugin --starter blank --yes',
      'node bin/app setup --input project.json --dry-run',
      'node bin/app generate --plan-out generation.plan.json',
      'node bin/app plan apply generation.plan.json --yes',
    ],
    transport: 'terminal-or-shared-TypeScript-API',
    approvals: 'never portable',
  });
}
const isMakerDiscovery = (request: Request) => request.command === 'make' && (request.args.length === 0 || ['list', 'describe'].includes(request.args[0]!) || Boolean(request.options.list));
function makerDiscovery(request: Request): Result {
  const catalog: Array<{ id: string }> = capabilityCatalog().makers;
  const makers = catalog.filter(item => request.args[0] !== 'describe' || item.id === request.args[1]);
  requireThat(makers.length > 0, 'MAKER_UNKNOWN',
    `Supply an existing recipe ID; use make list.${didYouMean(suggestions(request.args[1] ?? '', catalog.map(item => item.id)), value => `"${value}"`)}`);
  return result(request.command, { makers });
}
const isMakerCheck = (request: Request) => request.command === 'make' && request.options.check === true;
const checkOptions = ['check', 'json', 'root', 'no-interaction', 'dry-run'];
/** make locale <name> --check compares the pending draft with the current base keys; it plans and writes nothing. */
async function makerCheck(request: Request, context: Context): Promise<Result> {
  const [recipe, name] = request.args;
  requireThat(recipe === 'locale' && name, 'MAKER_CHECK_UNSUPPORTED', 'Only make locale <name> --check has a read-only check.');
  requireThat(Object.keys(request.options).every(key => checkOptions.includes(key)), 'MAKER_CHECK_OPTIONS', '--check is read-only; it accepts only --json, --root, --no-interaction and --dry-run.');
  const { slug } = await import('../makers/arguments.ts');
  const { createMakerContext } = await import('../makers/engine.ts');
  const { checkPendingLocale } = await import('../makers/pending-locale.ts');
  const check = await checkPendingLocale(createMakerContext(context.root).read, slug(name, 'locale name'));
  if (!check.missing.length && !check.extra.length && check.selectable === false) return result(request.command, check);
  const drift = new OperationError('LOCALE_DRAFT_DRIFT', `Pending locale ${check.locale} differs from the base keys or is selectable.`, `Review make locale ${check.locale} --refresh --dry-run, which restores missing keys and removes extra keys, and keep the draft unselectable until its translation review.`);
  drift.details = check;
  throw drift;
}
/** The registered entity catalog, bundled from checked-in definitions; the same handler serves source checkouts and kits. */
async function entityCatalog(request: Request, context: Context): Promise<Result> {
  const { loadCatalog } = await import('../makers/load-catalog.ts');
  return result(request.command, await loadCatalog(context.root));
}
async function newProject(request: Request, context: Context): Promise<Result> {
  if (request.options.list) return starterListing(context);
  return completeStarterProject(await fileOperation(request, context), request, context);
}
/** Release execution needs a separate --authorize digest; --yes never authorizes publication. */
function releaseArgs(request: Request, context: Context, path: string): string[] {
  const args = ['--input', resolve(context.root, path)];
  if (!request.options.execute) {
    requireThat(request.options.authorize === undefined, 'RELEASE_AUTHORIZATION', '--authorize requires --execute.');
    return args;
  }
  const authorization = stringOption(request.options, 'authorize');
  requireThat(authorization, 'RELEASE_AUTHORIZATION', 'Public execution requires a separate --authorize digest. --yes is not authorization.');
  return [...args, '--execute', '--authorize', authorization];
}
async function releaseOperate(request: Request, context: Context): Promise<Result> {
  const path = stringOption(request.options, 'input');
  requireThat(path, 'INPUT_REQUIRED', 'Supply --input <release-operation.json>.');
  if (request.options['dry-run']) {
    return result(request.command, {
      execution: 'not-run',
      input: path,
      requestedMode: request.options.execute ? 'candidate-write' : 'remote-discovery',
      candidateEligibility: 'not-checked',
      publication: 'not-authorized',
    }, 'planned');
  }
  const exit = await runNode(context, 'scripts/release/cli.mjs', releaseArgs(request, context, path));
  requireThat(!exit.truncated, 'RELEASE_OUTPUT_LIMIT', 'Release output exceeded its bound; do not infer success or retry writes automatically.');
  return result(request.command, { execution: exit, receipt: JSON.parse(exit.stdout) });
}
type Route = [(request: Request, effect: string) => boolean, (request: Request, context: Context) => Promise<Result> | Result];
const prefixed = (prefix: string) => (request: Request) => request.command.startsWith(prefix);
const named = (...names: string[]) => (request: Request) => names.includes(request.command);
/** Routes in priority order; read-only commands fall through to the read dispatcher. */
const routes: Route[] = [
  [named('schema'), request => result(request.command, operationSchemas())],
  [request => Boolean(request.options.help) || ['help', 'capabilities'].includes(request.command), helpOperation],
  [(request, effect) => request.command.startsWith('templates ') && effect === 'read', readComponentTemplateOperation],
  [isUiCommand, uiOperation],
  [named('starters pack'), packStarterOperation],
  [named('starters run'), starterProcessOperation],
  [(request, effect) => request.command.startsWith('starters ') && effect === 'read', readStarterOperation],
  [prefixed('obsidian '), (request, context) => obsidianRead(request, context)],
  [(request, effect) => request.command.startsWith('docs ') && effect !== 'plan', docsRead],
  [(_request, effect) => effect === 'fixtures', (request, context) => fixtureOperation(request, context)],
  [prefixed('base '), baseOperation],
  [named('site templates'), siteTemplatesOperation],
  [isMakerDiscovery, makerDiscovery],
  [isMakerCheck, makerCheck],
  [prefixed('entities '), entityCatalog],
  [named('adopt analyze'), adoptAnalyze],
  [named('setup status', 'setup resume'), (request, context) => setupProgress(request, context, executeOperation)],
  [named('new'), newProject],
  [prefixed('storybook '), (request, context) => storybookOperation(request, context)],
  [prefixed('compiler '), compilerOperation],
  [named('clickdummy build'), (request, context) => buildClickdummy(request, context)],
  [named('check'), (request, context) => request.options.plan === true ? checkPlanOperation(request, context) : checkOperation(request, context)],
  [named('ci'), (request, context) => ciOperation(request, context)],
  [named('check submission'), (request, context) => submissionCheck(context, request.options['dry-run'] === true)],
  [(request, effect) => request.command.startsWith('plugins ') && effect === 'read', pluginsRead],
  [(request, effect) => request.command.startsWith('airship ') && effect !== 'plan', (request, context) => airshipOperation(request, context)],
  [(request, effect) => request.command === 'plan inspect' || effect === 'plan', fileOperation],
  [(_request, effect) => effect === 'process', (request, context) => processOperation(request, context)],
  [named('release operate'), releaseOperate],
];
/** Programmatic adapter shared by the terminal and future companion. No prompt or process-global cwd change. */
export async function executeOperation(input: Request, context: Context): Promise<Result> {
  let command = 'unknown';
  try {
    const request = validateRequest(input);
    command = request.command;
    requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
    const effect = descriptor(command).effect;
    const route = routes.find(([matches]) => matches(request, effect));
    return await (route ? route[1](request, context) : readOperation(request, context));
  } catch (error) {
    return failure(command, error);
  }
}
