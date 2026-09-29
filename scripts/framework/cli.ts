import { unavailableSupport } from './support-report.ts';
import { guidedSetup, continueSetup } from './setup-terminal.ts';
import { formatDiagnostics } from '../compiler/adapters/reporting.ts';
import type { CompilerDiagnostic } from '../compiler/domain/contracts.ts';
import { ask, readInput } from './input.ts';
import { resolve, join } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import { parseCliArguments, descriptor } from './catalog.ts';
import { executeOperation } from './operations.ts';
import { projectRoot, exists } from './files.ts';
import { failure, type Context, type Request, type Result } from './contracts.ts';
import { invocationDirectory } from './starter-project.ts';
import { guidedStarter, starterText } from './starter-terminal.ts';
import { renderHuman } from './terminal-render.ts';
import { terminalStyle, runnable } from './terminal-style.ts';
function render(value: Result, machine: boolean): void {
  if (machine) { stdout.write(JSON.stringify(value) + '\n'); return; }
  const starter = value.command === 'new' ? starterText(value) : null;
  const human = starter === null ? renderHuman(value, terminalStyle(stdout)) : { text: starter, diagnosticsShown: false };
  stdout.write(human.text);
  if (human.diagnosticsShown) return;
  for (const diagnostic of value.diagnostics) {
    if (diagnostic.severity && diagnostic.phase && diagnostic.help) { stderr.write(formatDiagnostics([diagnostic as CompilerDiagnostic])); continue; }
    stderr.write(`${diagnostic.code}: ${diagnostic.message}${diagnostic.next ? '\nNext: ' + runnable(diagnostic.next) : ''}\n`);
  }
}
async function confirm(message: string, signal?: AbortSignal): Promise<boolean> {
  return /^y(?:es)?$/i.test((await ask(stdin, stderr, message + ' [y/N] ', signal)).trim());
}
async function interactiveRun(request: Request, context: Context): Promise<Result> {
  let outcome = await executeOperation(request, context);
  if (outcome.status === 'planned' && descriptor(request.command).effect === 'plan' && !request.options['dry-run']) {
    render(outcome, false);
    if (!await confirm('Apply this reviewed plan?', context.signal)) return { ...outcome, status: 'cancelled' };
    const planHash = (outcome.data as { planHash?: string }).planHash;
    outcome = await executeOperation({ ...request, options: { ...request.options, ...(planHash ? { apply: planHash } : {}), yes: true } }, context);
  }
  return outcome;
}
export async function main(argv: string[], frameworkRoot: string): Promise<number> {
  // Preserve the published workspace compiler's raw JSON protocol and --help entry.
  if (argv[0] === 'generate' && (argv.includes('--target') && !argv.includes('--scope') || (argv.length === 2 && argv[1] === '--help')) && !argv.includes('--json')) {
    try { const { generatorCli } = await import('../companion/compiler/cli.ts'); await generatorCli(argv.slice(1)); return Number(process.exitCode ?? 0); }
    catch (error) { stderr.write((error instanceof Error ? error.message : 'Generation failed.') + '\n'); return 1; }
  }
  const supportRequested = argv.some((value, index) => value === 'support' && argv[index + 1] === 'report');
  const machine = argv.includes('--json'); const controller = new AbortController();
  const stop = () => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let command = 'unknown';
  try {
    let request = parseCliArguments(argv); command = request.command;
    const discovery = request.options.help || ['help', 'capabilities', 'schema', 'version', 'compiler explain', 'project schema'].includes(command) || (command === 'make' && (!request.args.length || ['list', 'describe'].includes(request.args[0]!)));
    const selected = typeof request.options.root === 'string' ? request.options.root : process.cwd();
    // `new` creates a sibling project from this framework checkout; <dir> is relative to the invoking shell.
    if (command === 'new' && request.args[0]) request = { ...request, args: [invocationDirectory(request.args[0])] };
    if (command === 'new' && typeof request.options.from === 'string') request = { ...request, options: { ...request.options, from: invocationDirectory(request.options.from) } };
    const root = discovery || command === 'new' || command.startsWith('starters ') ? resolve(selected) : await projectRoot(selected, typeof request.options.root === 'string');
    const context: Context = { root, frameworkRoot, signal: controller.signal, progress: text => stderr.write(text) };
    if (request.options.input === '-') context.inputText = await readInput(stdin, controller.signal);
    const interactive = Boolean(stdin.isTTY && stderr.isTTY && !machine && !request.options['no-interaction'] && !request.options.yes && !request.options.help);
    if (interactive && command === 'setup' && !request.options['dry-run']) request = await guidedSetup(request, context, query => ask(stdin, stderr, query, controller.signal), text => stderr.write(text));
    if (interactive && command === 'new' && !request.options.list) request = await guidedStarter(request, context, query => ask(stdin, stderr, query, controller.signal), text => stderr.write(text));
    let outcome = interactive ? await interactiveRun(request, context) : await executeOperation(request, context);
    if (interactive && command === 'setup' && !request.options['dry-run'] && ['applied', 'unchanged'].includes(outcome.status)) {
      if (await exists(join(context.root, '.framework/kit.json')) && await exists(join(context.root, 'design/project.json'))) outcome = await continueSetup(context, executeOperation, query => ask(stdin, stderr, query, controller.signal), value => render(value, false), outcome);
    }
    render(outcome, machine);
    return outcome.status === 'failed' || outcome.status === 'blocked' ? 1 : outcome.status === 'cancelled' ? 130 : 0;
  } catch (error) { const outcome = supportRequested ? unavailableSupport(controller.signal.aborted) : failure(command, error); render(outcome, machine); return outcome.status === 'cancelled' ? 130 : 1; }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
