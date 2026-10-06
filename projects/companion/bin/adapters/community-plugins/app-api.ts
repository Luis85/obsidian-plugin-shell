import { resolve } from 'node:path';
import { definePluginEvent, type PluginEventDefinition } from '../../../plugins/api.ts';
import type { WorkbenchEventBus } from '../../../plugins/runtime.ts';
import { applyFilePlan, createFilePlan, type ApplyFilePlanReport, type FilePlan, type FilePlanEntry } from '../../../scripts/shared/file-plan.ts';
import { assertJsonData } from '../../../scripts/contracts/json-data.ts';
import { commands as frameworkCommands } from '../framework/catalog.ts';
import { OperationError, requireThat, type Context, type Request, type Result } from '../framework/contracts.ts';
import { appEventIds } from './app-events.ts';
import { communityPluginApiVersion, type CommunityPluginManifest } from '../../domain/community-plugin.ts';

/** An event addressed by its definition or by its full ID ("app.command-finished", "my-plugin.synced"). */
export type EventReference = PluginEventDefinition | string;
type Listener<P> = (payload: P) => void | Promise<void>;
export interface AppEvents {
  /** Defines `<plugin-id>.<name>`. Without a validator the payload must be JSON data. Payloads arrive cloned and frozen. */
  define<P = unknown>(name: string, validate?: (payload: unknown) => payload is P): PluginEventDefinition<string, P>;
  on<P = unknown>(event: EventReference, listener: Listener<P>): () => void;
  once<P = unknown>(event: EventReference, listener: Listener<P>): () => void;
  /** Publishes one of this plugin's own events. */
  dispatch(event: EventReference, payload: unknown): void;
  /** Every event ID currently defined on the bus. */
  list(): string[];
}
export interface AppCommandDescriptor { readonly id: string; readonly summary: string; readonly effect: string; readonly options: Readonly<Record<string, 'value' | 'flag'>> }
export interface AppCommandRequest { readonly args?: readonly string[]; readonly options?: Readonly<Record<string, string | boolean>>; readonly root?: string }
export interface AppCommands {
  /** The built-in command catalog (node bin/app help --all). */
  list(): AppCommandDescriptor[];
  /** Runs one built-in command in process with the CLI's own rules: plans preview unless `yes` or `apply` is passed. */
  run(command: string, request?: AppCommandRequest): Promise<Result>;
}
export interface AppFiles {
  /** A reviewable plan of whole-file writes (content null deletes), relative to the project root unless `root` is given. */
  plan(entries: readonly FilePlanEntry[], options?: { readonly root?: string }): Promise<FilePlan>;
  /** Applies a plan atomically, refusing files that changed since it was made. */
  apply(plan: FilePlan): Promise<ApplyFilePlanReport>;
}
export interface AppPlugins {
  /** Manifests of the app plugins loaded so far, in load order. */
  list(): CommunityPluginManifest[];
  /** Another loaded plugin's instance, for plugins that offer an API to each other. */
  get<T extends object = object>(id: string): T | undefined;
}
/** `this.app`: the well-defined surface every app plugin receives. */
export interface WorkbenchApp {
  readonly apiVersion: number;
  readonly version: string;
  readonly frameworkRoot: string;
  /** The project root of this invocation (`--root`, else the working directory). */
  readonly root: string;
  readonly events: AppEvents;
  readonly commands: AppCommands;
  readonly files: AppFiles;
  readonly plugins: AppPlugins;
  /** Writes one line to stderr, prefixed with the plugin ID; stdout stays the machine result channel. */
  log(message: string): void;
}
/** Per-invocation facts shared by every plugin's app. `root` is set once the arguments are parsed. */
export interface AppSession {
  readonly bus: WorkbenchEventBus;
  readonly report: (message: string) => void;
  readonly run: (request: Request, context: Context) => Promise<Result>;
  readonly signal?: AbortSignal;
  root: string;
}
export interface AppHost extends AppSession {
  readonly frameworkRoot: string;
  readonly version: string;
  readonly loaded: Map<string, { manifest: CommunityPluginManifest; instance: object }>;
}

const eventName = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;
function jsonPayload(payload: unknown): boolean {
  try { return assertJsonData(payload); } catch { return false; }
}
function appEvents(host: AppHost, owner: string, track: (cleanup: () => void) => void): AppEvents {
  const resolveEvent = (event: EventReference): PluginEventDefinition => {
    if (typeof event !== 'string') return event;
    const found = host.bus.definition(event);
    if (!found) throw new OperationError('COMMUNITY_PLUGIN_EVENT_UNKNOWN', `No event ${event} is defined.`, 'List the defined events with this.app.events.list().');
    return found;
  };
  const subscribe = (method: 'on' | 'once') => <P>(event: EventReference, listener: Listener<P>) => {
    const off = host.bus[method](resolveEvent(event) as PluginEventDefinition<string, P>, listener);
    track(off);
    return off;
  };
  return Object.freeze({
    define<P>(name: string, validate?: (payload: unknown) => payload is P) {
      requireThat(typeof name === 'string' && name.length <= 64 && eventName.test(name), 'COMMUNITY_PLUGIN_EVENT_INVALID', 'Event names are lowercase kebab-case segments joined by dots.');
      const valid = validate ?? ((payload: unknown): payload is P => jsonPayload(payload));
      return host.bus.define(definePluginEvent<string, P>(`${owner}.${name}` as never, valid));
    },
    on: subscribe('on'),
    once: subscribe('once'),
    dispatch(event: EventReference, payload: unknown) {
      const definition = resolveEvent(event);
      requireThat(definition.id.startsWith(owner + '.') && !appEventIds.includes(definition.id), 'COMMUNITY_PLUGIN_EVENT_OWNER',
        `${owner} may dispatch only its own events; ${definition.id} belongs to another publisher.`);
      host.bus.dispatch(definition, payload);
    },
    list: () => host.bus.ids(),
  });
}
function appCommands(host: AppHost): AppCommands {
  return Object.freeze({
    list: () => frameworkCommands.map(command => ({ id: command.id, summary: command.summary, effect: command.effect, options: { ...command.options } })),
    async run(command: string, request: AppCommandRequest = {}) {
      requireThat(command !== 'mcp', 'COMMUNITY_PLUGIN_COMMAND_REFUSED', 'The MCP server owns stdin/stdout and cannot run inside another command.');
      const root = resolve(host.root, request.root ?? '.');
      return host.run({ command, args: [...request.args ?? []], options: { ...request.options } },
        { root, frameworkRoot: host.frameworkRoot, progress: host.report, ...(host.signal ? { signal: host.signal } : {}) });
    },
  });
}
/** Builds one plugin's `this.app`. Subscriptions are tracked so they end when the plugin unloads. */
export function createApp(host: AppHost, manifest: CommunityPluginManifest, track: (cleanup: () => void) => void): WorkbenchApp {
  return Object.freeze({
    apiVersion: communityPluginApiVersion,
    version: host.version,
    frameworkRoot: host.frameworkRoot,
    get root() { return host.root; },
    events: appEvents(host, manifest.id, track),
    commands: appCommands(host),
    files: Object.freeze({
      plan: (entries: readonly FilePlanEntry[], options: { readonly root?: string } = {}) => createFilePlan(resolve(host.root, options.root ?? '.'), entries),
      apply: (plan: FilePlan) => applyFilePlan(plan),
    }),
    plugins: Object.freeze({
      list: () => [...host.loaded.values()].map(entry => entry.manifest),
      get: <T extends object>(id: string) => host.loaded.get(id)?.instance as T | undefined,
    }),
    log(message: string) { host.report(`[${manifest.id}] ${String(message)}\n`); },
  });
}
