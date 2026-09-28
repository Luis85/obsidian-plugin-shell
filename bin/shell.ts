#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stdin, stdout, stderr } from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { ask } from '../scripts/framework/input.ts';
import { failure } from '../scripts/framework/contracts.ts';
import { SketchError } from './domain/errors.ts';
import { parseArguments, execute, option, makerHelp, type Arguments, type CommandContext } from './adapters/commands.ts';
import { studio, prototypeWizard } from './presentation/studio.ts';
import { TerminalSession } from './presentation/tui/session.ts';
import { useTerminal, useColor } from './presentation/tui/mode.ts';
import { safe, Back } from './presentation/prompts.ts';
interface IO { env?: Record<string, string | undefined>; input: Readable & { isTTY?: boolean }; output: Writable; error: Writable & { isTTY?: boolean } }
function canInteract(args: Arguments, io: IO): boolean {
  const env = io.env ?? process.env;
  if (env.CI && env.CI !== 'false') return false;
  const blocked = ['json', 'no-interaction', 'help', 'input'].some(flag => Boolean(args.flags[flag]));
  return Boolean(io.input.isTTY && io.error.isTTY && !blocked && !args.action);
}
async function interactive(args: Arguments, context: CommandContext, io: IO, controller: AbortController): Promise<void> {
  const env = io.env ?? process.env;
  const mode = option(args, 'ui', env.SHELL_UI ?? 'auto');
  const terminal = useTerminal(mode, io.input, io.error, env)
    ? new TerminalSession({ input: io.input, output: io.error, signal: controller.signal, cancel: () => controller.abort(), color: useColor(args.flags['no-color'] === true, env) }) : undefined;
  const ui = {
    rich: terminal,
    ask: (question: string) => ask(io.input, io.error, question, context.signal, false),
    write: (text: string) => { if (terminal) terminal.write(text); else io.error.write(safe(text)); },
  };
  const options = { ...context, project: option(args, 'project', 'design/project.json'),
    guide: option(args, 'guide') || undefined, out: option(args, 'out') || undefined, kind: option(args, 'kind') || undefined };
  let completion: string | undefined;
  try {
    terminal?.start();
    if (args.command === 'prototype') completion = await prototypeWizard(ui, options);
    else await studio(ui, options);
  } finally { terminal?.dispose(); }
  if (terminal && completion) io.error.write(safe(completion));
}
function errorResult(command: string, error: unknown) {
  const issue = error instanceof Back ? new SketchError('CANCELLED', 'Guide cancelled.') : error;
  if (!(issue instanceof SketchError)) return failure(command, issue);
  return { protocolVersion: 1, command, status: issue.code === 'CANCELLED' ? 'cancelled' : 'failed',
    data: null, diagnostics: [{ code: issue.code, message: issue.message }] };
}
/** Composition root. Machine responses are one JSON document on stdout; prompts/progress use stderr. */
export async function main(argv: string[], frameworkRoot: string, io: IO = { input: stdin, output: stdout, error: stderr }): Promise<number> {
  const controller = new AbortController(), stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const machine = argv.includes('--json'); let command = 'maker';
  try {
    const args = parseArguments(argv); command = args.command;
    const context = { root: resolve(option(args, 'root', process.cwd())), frameworkRoot, input: io.input, signal: controller.signal };
    if (canInteract(args, io)) { await interactive(args, context, io, controller); return 0; }
    const data = await execute(args, context);
    const result = { protocolVersion: 1, command, status: data.status ?? 'ok', data, diagnostics: [] };
    if (machine) io.output.write(JSON.stringify(result) + '\n');
    else if (data.help) io.output.write(makerHelp);
    else io.output.write(safe(JSON.stringify(result, null, 2)) + '\n');
    return 0;
  } catch (error) {
    const result = errorResult(command, error);
    if (machine) io.output.write(JSON.stringify(result) + '\n');
    else io.error.write(result.diagnostics.map(item => `${item.code}: ${safe(item.message)}`).join('\n') + '\n');
    return result.status === 'cancelled' ? 130 : 1;
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2), fileURLToPath(new URL('../', import.meta.url)));
}
