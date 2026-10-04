import { resolve, join } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import type { Readable } from 'node:stream';
import { unavailableSupport } from './framework/support-report.ts';
import { guidedSetup, continueSetup } from '../presentation/terminal/setup-terminal.ts';
import { ask, readInput } from '../../scripts/shared/input.ts';
import { parseConfirmation } from '../../scripts/shared/confirmation.ts';
import { parseCliArguments } from './framework/catalog.ts';
import { executeOperation } from './framework/operations.ts';
import { adoptInvocation, isAdoptCommand } from './framework/adopt-invocation.ts';
import { projectRoot, exists } from './framework/files.ts';
import { failure, type Context, type Request, type Result } from './framework/contracts.ts';
import { invocationDirectory, starterInvocation } from './framework/starter-project.ts';
import { guidedStarter } from '../presentation/terminal/starter-terminal.ts';
import { guidedIncrement } from '../presentation/terminal/increment-terminal.ts';
import { renderCliResult, type CliOutputStream } from '../presentation/terminal/cli-output.ts';
import { interactiveRun } from '../presentation/terminal/cli-interactive.ts';

export interface FrameworkCliIO {
  input: Readable & { isTTY?: boolean };
  output: CliOutputStream;
  error: CliOutputStream;
  env?: Record<string, string | undefined>;
}

const processIO: FrameworkCliIO = { input: stdin, output: stdout, error: stderr, env: process.env };

async function interactivePlanConfirm(io: FrameworkCliIO, message: string, signal?: AbortSignal): Promise<boolean> {
  return parseConfirmation(await ask(io.input, io.error as never, message + ' [y/N] ', signal)) === true;
}

const discoveryCommands = ['help', 'capabilities', 'schema', 'version', 'compiler explain', 'project schema', 'docs schema'];
/** Discovery commands describe the CLI itself and never need a project root. */
function isDiscovery(request: Request): boolean {
  if (request.options.help || discoveryCommands.includes(request.command)) return true;
  return request.command === 'make' && (!request.args.length || ['list', 'describe'].includes(request.args[0]!));
}
/** `new` resolves its target and --from source relative to the invoking shell, not the npm script directory. */
function normalizeNew(request: Request): Request {
  if (request.command !== 'new') return request;
  const args = request.args[0] ? [invocationDirectory(request.args[0])] : request.args;
  const options = typeof request.options.from === 'string' ? { ...request.options, from: invocationDirectory(request.options.from) } : request.options;
  return { ...request, args, options };
}
async function resolveInvocation(argv: string[], frameworkRoot: string): Promise<{ request: Request; root: string }> {
  const parsed = normalizeNew(parseCliArguments(argv));
  const selected = typeof parsed.options.root === 'string' ? parsed.options.root : process.cwd();
  const starters = parsed.command === 'new' || parsed.command.startsWith('starters ') ? starterInvocation(parsed, frameworkRoot) : null;
  const request = starters?.request ?? parsed;
  // Discovery is decided on the parsed request, as before starter resolution.
  if (isDiscovery(parsed)) return { request, root: resolve(selected) };
  if (isAdoptCommand(parsed.command)) return adoptInvocation(parsed);
  // App plugins belong to this app installation (bin/plugins beside bin/app), not to a selected project.
  if (parsed.command.startsWith('plugins ')) return { request, root: await projectRoot(frameworkRoot, true) };
  if (starters) return { request, root: starters.root };
  return { request, root: await projectRoot(selected, typeof request.options.root === 'string') };
}
function isInteractive(io: FrameworkCliIO, machine: boolean, request: Request): boolean {
  const flags = request.options;
  return Boolean(io.input.isTTY && io.error.isTTY && !machine && !flags['no-interaction'] && !flags.yes && !flags.help);
}
const guidedSetupRun = (request: Request) => request.command === 'setup' && !request.options['dry-run'];
/** Terminal interviews fill only missing setup/new answers before the reviewed operation runs. */
async function guidedRequest(request: Request, context: Context, io: FrameworkCliIO, signal: AbortSignal): Promise<Request> {
  const prompt = (query: string) => ask(io.input, io.error as never, query, signal);
  const write = (text: string) => { io.error.write(text); };
  if (guidedSetupRun(request)) return guidedSetup(request, context, prompt, write);
  if (request.command === 'new' && !request.options.list) return guidedStarter(request, context, prompt, write);
  return guidedIncrement(request, prompt);
}
/** After an interactive setup in a kit project, each further stage is offered with its own approval. */
async function continueInteractiveSetup(request: Request, outcome: Result, context: Context, io: FrameworkCliIO, signal: AbortSignal): Promise<Result> {
  if (!guidedSetupRun(request) || !['applied', 'unchanged'].includes(outcome.status)) return outcome;
  if (!await exists(join(context.root, 'bin/kit.json')) || !await exists(join(context.root, 'design/project.json'))) return outcome;
  return continueSetup(context, executeOperation, query => ask(io.input, io.error as never, query, signal), value => renderCliResult(value, false, io), outcome);
}
const uncertain = (data: unknown): boolean => typeof data === 'object' && data !== null && 'uncertain' in data && data.uncertain === true;
/** 0 success, 1 failed or blocked, 2 a write whose outcome is unknown (`data.uncertain`), 130 cancelled. */
export function exitCode(outcome: Result): number {
  if (outcome.status === 'failed' && uncertain(outcome.data)) return 2;
  if (outcome.status === 'failed' || outcome.status === 'blocked') return 1;
  return outcome.status === 'cancelled' ? 130 : 0;
}
async function runOperation(argv: string[], frameworkRoot: string, io: FrameworkCliIO, machine: boolean, controller: AbortController, named: (command: string) => void): Promise<Result> {
  const invocation = await resolveInvocation(argv, frameworkRoot);
  let request = invocation.request;
  named(request.command);
  const context: Context = { root: invocation.root, frameworkRoot, signal: controller.signal, progress: text => { io.error.write(text); } };
  if (request.options.input === '-') context.inputText = await readInput(io.input, controller.signal);
  if (!isInteractive(io, machine, request)) return executeOperation(request, context);
  request = await guidedRequest(request, context, io, controller.signal);
  const outcome = await interactiveRun(request, context, {
    confirm: (message, signal) => interactivePlanConfirm(io, message, signal),
    render: value => renderCliResult(value, false, io),
  });
  return continueInteractiveSetup(request, outcome, context, io, controller.signal);
}

/** Framework command composition root. Prompts/progress are isolated from the machine stdout result channel. */
export async function main(argv: string[], frameworkRoot: string, io: FrameworkCliIO = processIO): Promise<number> {
  const supportRequested = argv.some((value, index) => value === 'support' && argv[index + 1] === 'report');
  const machine = argv.includes('--json');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let command = 'unknown';
  try {
    const outcome = await runOperation(argv, frameworkRoot, io, machine, controller, name => { command = name; });
    renderCliResult(outcome, machine, io);
    return exitCode(outcome);
  } catch (error) {
    const outcome = supportRequested ? unavailableSupport(controller.signal.aborted) : failure(command, error);
    renderCliResult(outcome, machine, io);
    return outcome.status === 'cancelled' ? 130 : 1;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
