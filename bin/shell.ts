#!/usr/bin/env node
import { firstRunWizard } from './presentation/first-run.ts';
import { configuredArguments } from './adapters/setup-command.ts';
import { loadSettings } from './adapters/user-settings.ts';
import { projectSetupWizard } from './presentation/project-setup-wizard.ts';
import { settingsWizard } from './presentation/settings.ts';
import { projectWizard } from './presentation/project-wizard.ts';
import { readSnapshot } from './adapters/storage.ts';
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
import { safe, Back, type Prompts } from './presentation/prompts.ts';
interface IO { env?: Record<string, string | undefined>; input: Readable & { isTTY?: boolean }; output: Writable; error: Writable & { isTTY?: boolean } }
function canInteract(args: Arguments, io: IO): boolean {
  const env = io.env ?? process.env;
  if (env.CI && env.CI !== 'false') return false;
  const blocked = ['json', 'no-interaction', 'help', 'input'].some(flag => Boolean(args.flags[flag]));
  return Boolean(io.input.isTTY && io.error.isTTY && !blocked && !args.action);
}
async function interactive(args: Arguments, context: CommandContext, io: IO, controller: AbortController): Promise<void> {
  const env = io.env ?? process.env;
  const loaded = await loadSettings(context.root);
  const configured = await configuredArguments(args, context.root);
  const mode = option(args, 'ui', env.SHELL_UI ?? loaded.settings.preferences.ui);
  const terminal = useTerminal(mode, io.input, io.error, env)
    ? new TerminalSession({ input: io.input, output: io.error, signal: controller.signal, cancel: () => controller.abort(), color: useColor(args.flags['no-color'] === true, env) }) : undefined;
  const ui = {
    rich: terminal,
    ask: (question: string) => ask(io.input, io.error, question, context.signal, false),
    write: (text: string) => { if (terminal) terminal.write(text); else io.error.write(safe(text)); },
  };
  const options = { ...context, project: option(configured, 'project', 'design/project.json'),
    guide: option(args, 'guide') || undefined, out: option(configured, 'out') || undefined, kind: option(args, 'kind') || undefined };
  let completion: string | undefined;
  try {
    terminal?.start();
    completion = await runInteractiveCommand(args, context, ui, options);
  } finally { terminal?.dispose(); }
  if (terminal && completion) io.error.write(safe(completion));
}

interface StudioOptions extends CommandContext { project: string; guide?: string; out?: string; kind?: string }
async function runInteractiveCommand(args: Arguments, context: CommandContext, ui: Prompts, options: StudioOptions): Promise<string | undefined> {
  if (args.command === 'first-run') return firstRunWizard(ui, context);
  if (args.command === 'project-setup') return projectSetupWizard(ui, context);
  if (args.command === 'settings') { await settingsWizard(ui, context); return; }
  if (await shouldCreate(args, context, options)) return createInteractive(args, context, ui, options);
  if (args.command === 'prototype') return await prototypeWizard(ui, options);
  else await studio(ui, options);
}
async function shouldCreate(args: Arguments, context: CommandContext, options: StudioOptions): Promise<boolean> {
  if (args.command === 'new') return true;
  return args.command === 'studio' && !(await readSnapshot(context.root, options.project)).document;
}
async function createInteractive(args: Arguments, context: CommandContext, ui: Prompts, options: StudioOptions): Promise<string | undefined> {
    if (['guide', 'project', 'kind'].some(key => args.flags[key])) throw new SketchError('PROJECT_OPTION', 'New project creation does not accept a baseline or legacy output kind.');
    return await projectWizard(ui, { ...context, out: options.out, preset: option(args, 'preset') || undefined,
    framework: option(args, 'framework') || undefined, targets: args.flags.targets ? option(args, 'targets').split(',') : undefined });

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
    const context = { root: resolve(option(args, 'root', process.cwd())), frameworkRoot, input: io.input, signal: controller.signal, progress: (message: string) => { io.error.write(safe(message)); } };
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
