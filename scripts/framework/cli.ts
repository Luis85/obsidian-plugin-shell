import { ask, readInput } from './input.ts';
import { resolve, join } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import { parseCliArguments, descriptor } from './catalog.ts';
import { executeOperation } from './operations.ts';
import { projectRoot, exists } from './files.ts';
import { failure, type Context, type Request, type Result } from './contracts.ts';
function render(value: Result, machine: boolean): void {
  if (machine) { stdout.write(JSON.stringify(value) + '\n'); return; }
  stdout.write(`${value.command}: ${value.status}\n`);
  if (value.data && (value.command === 'help' || value.command === 'capabilities' || (value.data as { commands?: unknown }).commands)) {
    const data = value.data as { commands: Array<{id: string; summary: string; options: Record<string, string>; effect: string}> };
    for (const command of data.commands) stdout.write(`  ${command.id.padEnd(21)} ${command.summary}\n`);
    if (data.commands.length === 1) {
      const entry = data.commands[0]!; stdout.write(`\nEffect: ${entry.effect}\nOptions:\n`);
      for (const [name, kind] of Object.entries(entry.options)) stdout.write(`  --${name}${kind === 'value' ? ' <value>' : ''}\n`);
    }
    stdout.write('\nUse --json for structured output; mutations preview by default.\n');
  } else if (value.data !== null) stdout.write(JSON.stringify(value.data, null, 2) + '\n');
  for (const diagnostic of value.diagnostics) stderr.write(`${diagnostic.code}: ${diagnostic.message}${diagnostic.next ? '\nNext: ' + diagnostic.next : ''}\n`);
}
async function guidedIdentity(request: Request, signal?: AbortSignal): Promise<Request> {
  const options = { ...request.options };
  if (!options.id && !options.input) {
    const path = (await ask(stdin, stderr, 'Project JSON path (leave empty for a new project): ', signal)).trim();
    if (path) options.input = path; else options.blank = true;
  }
  if (!options.input) for (const key of ['id', 'name', 'author']) {
    if (!options[key]) options[key] = (await ask(stdin, stderr, `Plugin ${key}: `, signal)).trim();
  }
  return { ...request, options };
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
async function setupNextSteps(configured: Result, context: Context): Promise<Result> {
  if (!await exists(join(context.root, '.framework/kit.json')) || !await exists(join(context.root, 'design/project.json'))) return configured;
  render(configured, false);
  if (!await confirm('Review boilerplate generation for this accepted design?', context.signal)) return configured;
  const generated = await interactiveRun({ command: 'generate', args: [], options: {} }, context);
  if (!['applied', 'unchanged'].includes(generated.status)) return generated;
  render(generated, false);
  if (!await confirm('Install exact locked dependencies now? This accesses the package registry and may run approved lifecycle scripts.', context.signal)) return generated;
  return executeOperation({ command: 'install', args: [], options: { yes: true } }, context);
}
export async function main(argv: string[], frameworkRoot: string): Promise<number> {
  // Preserve the published workspace compiler's raw JSON protocol and --help entry.
  if (argv[0] === 'generate' && (argv.includes('--target') || (argv.length === 2 && argv[1] === '--help')) && !argv.includes('--json')) {
    try { const { generatorCli } = await import('../companion/compiler/cli.ts'); await generatorCli(argv.slice(1)); return Number(process.exitCode ?? 0); }
    catch (error) { stderr.write((error instanceof Error ? error.message : 'Generation failed.') + '\n'); return 1; }
  }
  const machine = argv.includes('--json'); const controller = new AbortController();
  const stop = () => controller.abort(); process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let command = 'unknown';
  try {
    let request = parseCliArguments(argv); command = request.command;
    const discovery = request.options.help || ['help', 'capabilities', 'schema', 'version'].includes(command) || (command === 'make' && (!request.args.length || ['list', 'describe'].includes(request.args[0]!)));
    const selected = typeof request.options.root === 'string' ? request.options.root : process.cwd();
    const root = discovery ? resolve(selected) : await projectRoot(selected, typeof request.options.root === 'string');
    const context: Context = { root, frameworkRoot, signal: controller.signal, progress: text => stderr.write(text) };
    if (request.options.input === '-') context.inputText = await readInput(stdin, controller.signal);
    const interactive = Boolean(stdin.isTTY && stderr.isTTY && !machine && !request.options['no-interaction'] && !request.options.yes && !request.options.help);
    if (interactive && command === 'setup' && !request.options['dry-run']) request = await guidedIdentity(request, controller.signal);
    let outcome = interactive ? await interactiveRun(request, context) : await executeOperation(request, context);
    if (interactive && command === 'setup' && !request.options['dry-run'] && ['applied', 'unchanged'].includes(outcome.status)) outcome = await setupNextSteps(outcome, context);
    render(outcome, machine);
    return outcome.status === 'failed' || outcome.status === 'blocked' ? 1 : outcome.status === 'cancelled' ? 130 : 0;
  } catch (error) { const outcome = failure(command, error); render(outcome, machine); return outcome.status === 'cancelled' ? 130 : 1; }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
