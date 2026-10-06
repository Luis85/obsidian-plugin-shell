#!/usr/bin/env node
import { brainstormWizard } from './presentation/brainstorm.ts';
import { firstRunWizard } from './presentation/first-run.ts';
import { configuredArguments } from './adapters/setup-command.ts';
import { loadSettings } from './adapters/user-settings.ts';
import { projectSetupWizard } from './presentation/project-setup-wizard.ts';
import { settingsWizard } from './presentation/settings.ts';
import { projectWizard } from './presentation/project-wizard.ts';
import { launchDefinition } from './presentation/wizards/launch.ts';
import { startWizard } from './presentation/wizards/registry.ts';
import { launchLearning } from './presentation/learning-runner.ts';
import { launchProcess } from './presentation/wizards/process-launch.ts';
import { interactiveProcess } from './adapters/process-command.ts';
import { interactiveTestWorkflow } from './adapters/test-workflow-command.ts';
import { launchTestWorkflow } from './presentation/wizards/test-workflow-launch.ts';
import { collectionWizard } from './presentation/collection.ts';
import { collectionCommandRoots } from './domain/command-options.ts';
import { collectionInteractiveActions } from './adapters/collection-command.ts';
import { candidateInteractiveActions } from './adapters/release-candidate-command.ts';
import { readSnapshot } from './adapters/storage.ts';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { stdin, stdout, stderr } from 'node:process';
import type { Readable, Writable } from 'node:stream';
import { ask } from '#shared/platform/input.ts';
import { failure } from './adapters/framework/contracts.ts';
import { result as operationResult, type ResultStatus } from '#shared/contracts/result.ts';
import { SketchError } from '#shared/contracts/sketch-errors.ts';
import { parseArguments, execute, option, type Arguments, type CommandContext } from './adapters/commands.ts';
import { studio, prototypeWizard } from './presentation/studio.ts';
import { TerminalSession } from '#tui/engine/session.ts';
import { useTerminal, useColor } from '#tui/engine/mode.ts';
import { safe, Back, type Prompts } from '#tui/prompts.ts';
import { routeArguments } from './adapters/router.ts';
import { commands as frameworkCommands } from './adapters/framework/catalog.ts';
import { createPluginRuntime, pluginCliCommands, type WorkbenchPluginRuntime } from './sdk/runtime.ts';
import { pluginRegistry } from './sdk/registry.ts';
import { communityInventory, communityRoutes, openCommunityPlugins } from './adapters/community-plugins/inventory.ts';
import type { CommunityPluginHost } from './adapters/community-plugins/loader.ts';
import { defineDeclaredEvents, invocationEventBus, observeCommand } from './adapters/community-plugins/app-events.ts';
import type { Context, Request } from './adapters/framework/contracts.ts';
interface IO { env?: Record<string, string | undefined>; input: Readable & { isTTY?: boolean }; output: Writable; error: Writable & { isTTY?: boolean } }
/** Whether the command and action name a terminal flow at all; TTY, CI and flags are checked by canInteract. */
function interactiveCommand(args: Arguments): boolean {
  if (Object.hasOwn(collectionCommandRoots, args.command)) return collectionInteractiveActions.includes(args.action);
  if (args.command === 'candidate') return candidateInteractiveActions.includes(args.action);
  if (!studioCommands.includes(args.command) && !Object.hasOwn(launchers, args.command)) return false;
  return !args.action || interactiveProcess(args) || interactiveTestWorkflow(args);
}
function canInteract(args: Arguments, io: IO): boolean {
  const env = io.env ?? process.env;
  if (env.CI && env.CI !== 'false') return false;
  const blocked = ['json', 'no-interaction', 'help', 'input'].some(flag => Boolean(args.flags[flag]));
  return Boolean(io.input.isTTY && io.error.isTTY && !blocked && interactiveCommand(args));
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
    completion = Object.hasOwn(collectionCommandRoots, args.command)
      ? await collectionWizard(ui, collectionCommandRoots[args.command]!, args.action, { ...options, flags: args.flags })
      : await runInteractiveCommand(args, context, ui, options);
  } finally { terminal?.dispose(); }
  if (terminal && completion) io.error.write(safe(completion));
}

interface StudioOptions extends CommandContext { project: string; guide?: string; out?: string; kind?: string }
interface Launch { args: Arguments; context: CommandContext; ui: Prompts; options: StudioOptions }
const definitionLauncher = ({ ui, args, options }: Launch) => launchDefinition(ui, args, { ...options });
/** Each interactive maker command and its terminal launcher; studio, new, sketch and prototype share the studio flow below. */
const launchers: Readonly<Record<string, (launch: Launch) => Promise<string | undefined>>> = {
  'first-run': ({ ui, context }) => firstRunWizard(ui, context),
  brainstorm: ({ ui, options }) => brainstormWizard(ui, { ...options, offerImport: true }),
  'project-setup': ({ ui, context }) => projectSetupWizard(ui, context),
  settings: async ({ ui, context }) => { await settingsWizard(ui, context); return undefined; },
  wizard: definitionLauncher,
  form: definitionLauncher,
  'fake-data': ({ ui, args, options }) => startWizard(ui, 'fake-data', { ...options, flags: args.flags }),
  learn: ({ ui, args, options }) => launchLearning(ui, args, { ...options }),
  process: ({ ui, args, options }) => launchProcess(ui, args, { ...options }),
  candidate: ({ ui, args, options }) => startWizard(ui, 'candidate-new', { ...options, flags: args.flags }),
  workflow: ({ ui, args, options }) => launchTestWorkflow(ui, args, { ...options }),
};
const studioCommands = ['studio', 'new', 'sketch', 'prototype'];
async function runInteractiveCommand(args: Arguments, context: CommandContext, ui: Prompts, options: StudioOptions): Promise<string | undefined> {
  if (Object.hasOwn(launchers, args.command)) return launchers[args.command]!({ args, context, ui, options });
  if (await shouldCreate(args, context, options)) return createInteractive(args, context, ui, options);
  if (args.command === 'prototype') return await prototypeWizard(ui, options);
  await studio(ui, options);
  return undefined;
}
async function shouldCreate(args: Arguments, context: CommandContext, options: StudioOptions): Promise<boolean> {
  if (args.command === 'new') return true;
  return args.command === 'studio' && !(await readSnapshot(context.root, options.project)).document;
}
async function createInteractive(args: Arguments, context: CommandContext, ui: Prompts, options: StudioOptions): Promise<string | undefined> {
    if (['guide', 'project', 'kind'].some(key => args.flags[key])) throw new SketchError('PROJECT_OPTION', 'New project creation does not accept a baseline or legacy output kind.');
    return await projectWizard(ui, { ...context, out: options.out, starter: option(args, 'starter') || undefined });

}
function errorResult(command: string, error: unknown) {
  const issue = error instanceof Back ? new SketchError('CANCELLED', 'Guide cancelled.') : error;
  if (!(issue instanceof SketchError)) return failure(command, issue);
  return { ...operationResult(command, null, issue.code === 'CANCELLED' ? 'cancelled' : 'failed'),
    diagnostics: [{ code: issue.code, message: issue.message }] };
}
function failed(command: string, error: unknown, machine: boolean, io: IO): number {
  const result = errorResult(command, error);
  if (machine) io.output.write(JSON.stringify(result) + '\n');
  else io.error.write(result.diagnostics.map(item => `${item.code}: ${safe(item.message)}`).join('\n') + '\n');
  return result.status === 'cancelled' ? 130 : 1;
}
/** Composition root. Machine responses are one JSON document on stdout; prompts/progress use stderr. */
export async function main(argv: string[], frameworkRoot: string, io: IO = { input: stdin, output: stdout, error: stderr }): Promise<number> {
  if (argv[0] === 'mcp') {
    if (argv.length !== 1) { io.error.write('MCP_USAGE: use node bin/app mcp with no additional arguments.\n'); return 1; }
    const { runMcpServer } = await import('./adapters/mcp-server.ts');
    return runMcpServer(frameworkRoot, { input: io.input, output: io.output });
  }
  // App plugins in bin/plugins are routed by their manifests alone; their code loads only on the maker surface.
  const community = await communityInventory(frameworkRoot).then(communityRoutes, () => ({ enabled: [], inactive: new Map<string, string>() }));
  const frameworkRoots = new Set(frameworkCommands.map(entry => entry.id.split(' ')[0]!));
  const inactive = community.inactive.get(argv[0] ?? '');
  if (inactive && !frameworkRoots.has(argv[0]!)) return failed(argv[0]!, new SketchError('COMMUNITY_PLUGIN_INACTIVE', inactive), argv.includes('--json'), io);
  const routed = routeArguments(argv, { pluginCommands: new Set([...pluginCliCommands().map(entry => entry.id), ...community.enabled]), frameworkRoots });
  if (routed.surface === 'framework') {
    const { main: frameworkMain } = await import('./adapters/framework-cli.ts');
    return frameworkMain(routed.args, frameworkRoot);
  }
  if (routed.surface === 'memory') {
    const { main: memoryMain } = await import('./tooling/hindsight/cli.ts');
    return memoryMain(routed.args);
  }
  return makerMain(routed.args, frameworkRoot, io);
}
/** The maker surface itself, without routing; its help and failures stay on the supplied streams. */
export async function makerMain(argv: string[], frameworkRoot: string, io: IO = { input: stdin, output: stdout, error: stderr }): Promise<number> {
  const controller = new AbortController(), stop = () => controller.abort();
  let plugins: WorkbenchPluginRuntime | undefined, community: CommunityPluginHost | undefined;
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const machine = argv.includes('--json'); let command = 'maker';
  const progress = (message: string) => { io.error.write(safe(message)); };
  // One bus per invocation, created first so app plugins can subscribe while they load; the runtime adopts it.
  const bus = invocationEventBus(code => progress(code + '\n'));
  const session = { bus, report: progress, signal: controller.signal, root: process.cwd(),
    run: async (request: Request, context: Context) => (await import('./adapters/framework/operations.ts')).executeOperation(request, context) };
  try {
    defineDeclaredEvents(bus, pluginRegistry);
    community = await openCommunityPlugins(frameworkRoot, session);
    const registry = [...pluginRegistry, ...community.plugins];
    const args = parseArguments(argv, pluginCliCommands(registry)); command = args.command;
    const root = resolve(option(args, 'root', process.cwd()));
    session.root = root;
    plugins = await createPluginRuntime({ root, frameworkRoot, input: io.input, signal: controller.signal, progress, registry, eventBus: bus,
      onError: code => progress(code + '\n') });
    const context = { root, frameworkRoot, input: io.input, signal: controller.signal, progress, plugins, config: option(args, 'config') || undefined };
    if (canInteract(args, io)) { await interactive(args, context, io, controller); return 0; }
    const data = await observeCommand(bus, args.command, args.action, () => execute(args, context));
    const result = operationResult(command, data, (data.status ?? 'ok') as ResultStatus);
    if (machine) io.output.write(JSON.stringify(result) + '\n');
    else if (data.help) io.output.write(safe(String(data.help)));
    else io.output.write(safe(JSON.stringify(result, null, 2)) + '\n');
    return 0;
  } catch (error) {
    return failed(command, error, machine, io);
  } finally {
    // App plugins unload first, while the bus still delivers; then the runtime and the bus itself end.
    try { await community?.unload(); } catch (error) { progress(`COMMUNITY_PLUGIN_UNLOAD_FAILED: ${error instanceof Error ? error.message : 'unload failed'}\n`); }
    try { plugins?.dispose(); } finally {
      bus.dispose();
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    }
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2), fileURLToPath(new URL('../../', import.meta.url)));
}
