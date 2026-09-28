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
import { safe, Back } from './presentation/prompts.ts';
interface IO { input: Readable & { isTTY?: boolean }; output: Writable; error: Writable & { isTTY?: boolean } }
function canInteract(args: Arguments, io: IO): boolean {
  return Boolean(io.input.isTTY && io.error.isTTY && !args.flags.json && !args.flags['no-interaction']
    && !args.flags.help && !args.action && !args.flags.input);
}
async function interactive(args: Arguments, context: CommandContext, io: IO): Promise<void> {
  const ui = {
    ask: (question: string) => ask(io.input, io.error, question, context.signal),
    write: (text: string) => { io.error.write(safe(text)); },
  };
  const options = { ...context, project: option(args, 'project', 'design/project.json'),
    guide: option(args, 'guide') || undefined, out: option(args, 'out') || undefined, kind: option(args, 'kind') || undefined };
  if (args.command === 'prototype') await prototypeWizard(ui, options);
  else await studio(ui, options);
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
    if (canInteract(args, io)) { await interactive(args, context, io); return 0; }
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
