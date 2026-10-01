import { resolve, join } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import type { Readable } from 'node:stream';
import { unavailableSupport } from '../../scripts/framework/support-report.ts';
import { guidedSetup, continueSetup } from '../../scripts/framework/setup-terminal.ts';
import { ask, readInput } from '../../scripts/shared/input.ts';
import { parseConfirmation } from '../../scripts/shared/confirmation.ts';
import { parseCliArguments } from './framework/catalog.ts';
import { executeOperation } from './framework/operations.ts';
import { projectRoot, exists } from '../../scripts/framework/files.ts';
import { failure, type Context } from '../../scripts/framework/contracts.ts';
import { invocationDirectory } from '../../scripts/framework/starter-project.ts';
import { guidedStarter } from '../../scripts/framework/starter-terminal.ts';
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

/** Framework command composition root. Prompts/progress are isolated from the machine stdout result channel. */
export async function main(argv: string[], frameworkRoot: string, io: FrameworkCliIO = processIO): Promise<number> {
  // Preserve the published workspace compiler's raw JSON protocol and --help entry.
  if (argv[0] === 'generate' && (argv.includes('--target') && argv.includes('--input') && !argv.includes('--scope')
      || (argv.length === 2 && argv[1] === '--help')) && !argv.includes('--json')) {
    try {
      const { generatorCli } = await import('../../scripts/companion/compiler/cli.ts');
      await generatorCli(argv.slice(1));
      return Number(process.exitCode ?? 0);
    } catch (error) {
      io.error.write((error instanceof Error ? error.message : 'Generation failed.') + '\n');
      return 1;
    }
  }

  const supportRequested = argv.some((value, index) => value === 'support' && argv[index + 1] === 'report');
  const machine = argv.includes('--json');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  let command = 'unknown';
  try {
    let request = parseCliArguments(argv);
    command = request.command;
    const discovery = request.options.help
      || ['help', 'capabilities', 'schema', 'version', 'compiler explain', 'project schema', 'docs schema'].includes(command)
      || (command === 'make' && (!request.args.length || ['list', 'describe'].includes(request.args[0]!)));
    const selected = typeof request.options.root === 'string' ? request.options.root : process.cwd();
    if (command === 'new' && request.args[0]) request = { ...request, args: [invocationDirectory(request.args[0])] };
    if (command === 'new' && typeof request.options.from === 'string') {
      request = { ...request, options: { ...request.options, from: invocationDirectory(request.options.from) } };
    }
    const root = discovery
      ? resolve(selected)
      : command === 'new' && typeof request.options.root !== 'string'
        ? frameworkRoot
        : await projectRoot(selected, typeof request.options.root === 'string');
    const context: Context = {
      root,
      frameworkRoot,
      signal: controller.signal,
      progress: text => { io.error.write(text); },
    };
    if (request.options.input === '-') context.inputText = await readInput(io.input, controller.signal);
    const interactive = Boolean(io.input.isTTY && io.error.isTTY && !machine
      && !request.options['no-interaction'] && !request.options.yes && !request.options.help);
    if (interactive && command === 'setup' && !request.options['dry-run']) {
      request = await guidedSetup(request, context,
        query => ask(io.input, io.error as never, query, controller.signal),
        text => { io.error.write(text); });
    }
    if (interactive && command === 'new' && !request.options.list) {
      request = await guidedStarter(request, context,
        query => ask(io.input, io.error as never, query, controller.signal),
        text => { io.error.write(text); });
    }
    let outcome = interactive
      ? await interactiveRun(request, context, {
          confirm: (message, signal) => interactivePlanConfirm(io, message, signal),
          render: value => renderCliResult(value, false, io),
        })
      : await executeOperation(request, context);
    if (interactive && command === 'setup' && !request.options['dry-run']
        && ['applied', 'unchanged'].includes(outcome.status)) {
      if (await exists(join(context.root, '.framework/kit.json')) && await exists(join(context.root, 'design/project.json'))) {
        outcome = await continueSetup(context, executeOperation,
          query => ask(io.input, io.error as never, query, controller.signal),
          value => renderCliResult(value, false, io), outcome);
      }
    }
    renderCliResult(outcome, machine, io);
    return outcome.status === 'failed' || outcome.status === 'blocked' ? 1 : outcome.status === 'cancelled' ? 130 : 0;
  } catch (error) {
    const outcome = supportRequested ? unavailableSupport(controller.signal.aborted) : failure(command, error);
    renderCliResult(outcome, machine, io);
    return outcome.status === 'cancelled' ? 130 : 1;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}
