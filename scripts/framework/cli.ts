import { createInterface } from 'node:readline/promises';
import { resolve, join } from 'node:path';
import { stdin, stdout, stderr } from 'node:process';
import { parseArguments, descriptor } from './catalog.ts';
import { executeOperation } from './operations.ts';
import { projectRoot, exists } from './files.ts';
import { failure, requireThat, type Context, type Request, type Result } from './contracts.ts';
function render(value: Result, machine: boolean): void {
  if (machine) { stdout.write(JSON.stringify(value) + '\n'); return; }
  stdout.write(`${value.command}: ${value.status}\n`);
  if (value.command === 'help' || value.command === 'capabilities') {
    const data = value.data as { commands: Array<{id: string; summary: string}> };
    for (const command of data.commands) stdout.write(`  ${command.id.padEnd(21)} ${command.summary}\n`);
    stdout.write('\nUse --json for structured output; mutations preview by default.\n');
  } else if (value.data !== null) stdout.write(JSON.stringify(value.data, null, 2) + '\n');
  for (const diagnostic of value.diagnostics) stderr.write(`${diagnostic.code}: ${diagnostic.message}${diagnostic.next ? '\nNext: ' + diagnostic.next : ''}\n`);
}
async function inputText(): Promise<string> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of stdin) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += buffer.length; requireThat(size <= 4_000_000, 'INPUT_LIMIT', 'Input exceeds 4 MB.'); chunks.push(buffer); }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
async function guidedIdentity(request: Request): Promise<Request> {
  const prompt = createInterface({ input: stdin, output: stderr });
  try {
    const options = { ...request.options };
    if (!options.id && !options.input) { const path = (await prompt.question('Project JSON path (leave empty for a new project): ')).trim(); if (path) options.input = path; else options.blank = true; }
    if (!options.input) for (const key of ['id', 'name', 'author']) if (!options[key]) options[key] = (await prompt.question(`Plugin ${key}: `)).trim();
    return { ...request, options };
  } finally { prompt.close(); }
}
async function confirm(message: string): Promise<boolean> {
  const prompt = createInterface({ input: stdin, output: stderr });
  try { return /^y(?:es)?$/i.test((await prompt.question(message + ' [y/N] ')).trim()); }
  finally { prompt.close(); }
}
async function interactiveRun(request: Request, context: Context): Promise<Result> {
  let outcome = await executeOperation(request, context);
  if (outcome.status === 'planned' && descriptor(request.command).effect === 'plan' && !request.options['dry-run']) {
    render(outcome, false);
    if (!await confirm('Apply this reviewed plan?')) return { ...outcome, status: 'cancelled' };
    const planHash = (outcome.data as { planHash?: string }).planHash;
    outcome = await executeOperation({ ...request, options: { ...request.options, ...(planHash ? { apply: planHash } : {}), yes: true } }, context);
  }
  return outcome;
}
async function setupNextSteps(configured: Result, context: Context): Promise<Result> {
  if (!await exists(join(context.root, '.framework/kit.json')) || !await exists(join(context.root, 'design/project.json'))) return configured;
  render(configured, false);
  if (!await confirm('Review boilerplate generation for this accepted design?')) return configured;
  const generated = await interactiveRun({ command: 'generate', args: [], options: {} }, context);
  if (!['applied', 'unchanged'].includes(generated.status)) return generated;
  render(generated, false);
  if (!await confirm('Install exact locked dependencies now? This accesses the package registry and may run approved lifecycle scripts.')) return generated;
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
    let request = parseArguments(argv); command = request.command;
    const discovery = request.options.help || ['help', 'capabilities', 'schema'].includes(command) || (command === 'make' && (!request.args.length || request.args[0] === 'list'));
    const selected = typeof request.options.root === 'string' ? request.options.root : process.cwd();
    const root = discovery ? resolve(selected) : await projectRoot(selected, typeof request.options.root === 'string');
    const context: Context = { root, frameworkRoot, signal: controller.signal, progress: text => stderr.write(text) };
    if (request.options.input === '-') context.inputText = await inputText();
    const interactive = Boolean(stdin.isTTY && stderr.isTTY && !machine && !request.options['no-interaction'] && !request.options.yes && !request.options.help);
    if (interactive && command === 'setup' && !request.options['dry-run']) request = await guidedIdentity(request);
    let outcome = interactive ? await interactiveRun(request, context) : await executeOperation(request, context);
    if (interactive && command === 'setup' && !request.options['dry-run'] && ['applied', 'unchanged'].includes(outcome.status)) outcome = await setupNextSteps(outcome, context);
    render(outcome, machine);
    return outcome.status === 'failed' || outcome.status === 'blocked' ? 1 : outcome.status === 'cancelled' ? 130 : 0;
  } catch (error) { const outcome = failure(command, error); render(outcome, machine); return outcome.status === 'cancelled' ? 130 : 1; }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
