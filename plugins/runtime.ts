import { pluginRegistry } from './registry.ts';
import { defineFrameworkAdapter, type FrameworkAdapter } from '../scripts/compiler/adapters/project/framework-adapter.ts';
import type { StarterDefinition } from '../scripts/starters/types.ts';
import { loadComponentTemplates } from '../bin/adapters/component-template-repository.ts';
import { pluginComponentTemplates } from './template-contributions.ts';
import { commands as frameworkCommands } from '../scripts/framework/catalog.ts';
import type {
  ComponentTemplateCatalogApi,
  PluginCliCommand,
  PluginCommandContext,
  PluginEventBus,
  PluginEventDefinition,
  PluginTuiAction,
  WorkbenchPluginObject,
} from './api.ts';

interface Listener { active: boolean; invoke: (payload: unknown) => void | Promise<void> }
interface RuntimeOptions {
  readonly root: string;
  readonly frameworkRoot: string;
  readonly input: PluginCommandContext['input'];
  readonly signal?: AbortSignal;
  readonly progress?: (message: string) => void;
  readonly registry?: readonly WorkbenchPluginObject[];
  readonly onError?: (code: string, pluginId?: string) => void;
}
const identifier = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
const optionName = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 64 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
const reservedCliIds = new Set([
  'studio', 'sketch', 'prototype', 'new', 'settings', 'project-setup', 'first-run', 'brainstorm',
  ...frameworkCommands.map(command => command.id.split(' ')[0]!),
]);
const reservedCliOptions = new Set(['json', 'no-interaction', 'help', 'no-color', 'root', 'project', 'input', 'out', 'kind', 'guide', 'apply', 'ui', 'starter']);
function freeze(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
}
function enabledPlugins(registry: readonly WorkbenchPluginObject[] = pluginRegistry): readonly WorkbenchPluginObject[] {
  const ids = new Set<string>();
  return Object.freeze(registry.map(plugin => {
    if (!plugin || !identifier(plugin.manifest?.id) || !plugin.manifest.name || !/^\d+\.\d+\.\d+$/.test(plugin.manifest.version))
      throw new Error('WORKBENCH_PLUGIN_MANIFEST_INVALID');
    if (!plugin.config || typeof plugin.config !== 'object' || Array.isArray(plugin.config)) throw new Error('WORKBENCH_PLUGIN_CONFIG_INVALID:' + plugin.manifest.id);
    if (ids.has(plugin.manifest.id)) throw new Error('WORKBENCH_PLUGIN_DUPLICATE:' + plugin.manifest.id);
    ids.add(plugin.manifest.id);
    return plugin;
  }).filter(plugin => plugin.config.enabled !== false));
}
function validateCli(commands: readonly PluginCliCommand[]): readonly PluginCliCommand[] {
  const ids = new Set<string>();
  for (const command of commands) {
    if (!identifier(command.id) || !command.summary || typeof command.execute !== 'function') throw new Error('WORKBENCH_PLUGIN_CLI_INVALID');
    if (reservedCliIds.has(command.id)) throw new Error('WORKBENCH_PLUGIN_CLI_RESERVED:' + command.id);
    if (ids.has(command.id)) throw new Error('WORKBENCH_PLUGIN_CLI_DUPLICATE:' + command.id);
    ids.add(command.id);
    const booleans = command.options?.booleans ?? [], values = command.options?.values ?? [];
    if (![...booleans, ...values].every(optionName) || new Set([...booleans, ...values]).size !== booleans.length + values.length
      || [...booleans, ...values].some(option => reservedCliOptions.has(option)))
      throw new Error('WORKBENCH_PLUGIN_CLI_OPTIONS_INVALID:' + command.id);
  }
  return Object.freeze([...commands]);
}
function validateTui(actions: readonly PluginTuiAction[]): readonly PluginTuiAction[] {
  const ids = new Set<string>();
  for (const action of actions) {
    if (!identifier(action.id) || !action.label || typeof action.run !== 'function') throw new Error('WORKBENCH_PLUGIN_TUI_INVALID');
    if (ids.has(action.id)) throw new Error('WORKBENCH_PLUGIN_TUI_DUPLICATE:' + action.id);
    ids.add(action.id);
  }
  return Object.freeze([...actions]);
}
export function pluginCliCommands(registry: readonly WorkbenchPluginObject[] = pluginRegistry): readonly PluginCliCommand[] {
  return validateCli(enabledPlugins(registry).flatMap(plugin => plugin.cli ?? []));
}
export function pluginFrameworkAdapters(registry: readonly WorkbenchPluginObject[] = pluginRegistry): readonly FrameworkAdapter[] {
  const adapters = enabledPlugins(registry).flatMap(plugin => plugin.frameworks ?? []).map(defineFrameworkAdapter);
  const ids = new Set<string>();
  for (const adapter of adapters) {
    if (ids.has(adapter.id)) throw new Error('WORKBENCH_PLUGIN_FRAMEWORK_DUPLICATE:' + adapter.id);
    ids.add(adapter.id);
  }
  return Object.freeze(adapters);
}
export function pluginStarterDefinitions(registry: readonly WorkbenchPluginObject[] = pluginRegistry): readonly StarterDefinition[] {
  const starters = enabledPlugins(registry).flatMap(plugin => plugin.starters ?? []);
  const ids = new Set<string>();
  for (const starter of starters) {
    if (ids.has(starter.id)) throw new Error('WORKBENCH_PLUGIN_STARTER_DUPLICATE:' + starter.id);
    ids.add(starter.id);
  }
  return Object.freeze([...starters]);
}

class EventBus implements PluginEventBus {
  private readonly definitions = new Map<string, PluginEventDefinition>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private disposed = false;
  private depth = 0;
  private readonly report: (code: string) => void;
  constructor(definitions: readonly PluginEventDefinition[], report: (code: string) => void) {
    this.report = report;
    for (const definition of definitions) {
      if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(definition.id) || typeof definition.valid !== 'function')
        throw new Error('WORKBENCH_PLUGIN_EVENT_INVALID');
      if (this.definitions.has(definition.id)) throw new Error('WORKBENCH_PLUGIN_EVENT_DUPLICATE:' + definition.id);
      this.definitions.set(definition.id, definition);
    }
  }
  private registered<N extends string, P>(definition: PluginEventDefinition<N, P>): void {
    if (this.definitions.get(definition.id) !== definition) throw new Error('WORKBENCH_PLUGIN_EVENT_UNREGISTERED:' + definition.id);
  }
  on<N extends string, P>(definition: PluginEventDefinition<N, P>, listener: (payload: P) => void | Promise<void>): () => void {
    this.registered(definition);
    if (this.disposed) throw new Error('WORKBENCH_PLUGIN_BUS_DISPOSED');
    const set = this.listeners.get(definition.id) ?? new Set<Listener>();
    const entry: Listener = { active: true, invoke: payload => listener(payload as P) };
    set.add(entry); this.listeners.set(definition.id, set);
    return () => { entry.active = false; set.delete(entry); if (!set.size) this.listeners.delete(definition.id); };
  }
  once<N extends string, P>(definition: PluginEventDefinition<N, P>, listener: (payload: P) => void | Promise<void>): () => void {
    let off = () => {};
    off = this.on(definition, payload => { off(); return listener(payload); });
    return off;
  }
  dispatch<N extends string, P>(definition: PluginEventDefinition<N, P>, input: P): void {
    this.registered(definition);
    if (this.disposed) return;
    if (this.depth >= 32) { this.report('WORKBENCH_PLUGIN_EVENT_RECURSION'); return; }
    let payload: unknown;
    try {
      payload = structuredClone(input);
      if (!definition.valid(payload)) throw new Error('invalid');
      freeze(payload);
    } catch { this.report('WORKBENCH_PLUGIN_EVENT_PAYLOAD'); return; }
    this.depth += 1;
    try {
      for (const entry of Array.from(this.listeners.get(definition.id) ?? [])) {
        if (!entry.active) continue;
        try {
          const result = entry.invoke(payload);
          if (result) void Promise.resolve(result).catch(() => this.report('WORKBENCH_PLUGIN_EVENT_LISTENER'));
        } catch { this.report('WORKBENCH_PLUGIN_EVENT_LISTENER'); }
      }
    } finally { this.depth -= 1; }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const set of this.listeners.values()) for (const entry of set) entry.active = false;
    this.listeners.clear();
  }
}

function templateCatalog(options: RuntimeOptions, plugins: readonly WorkbenchPluginObject[]): ComponentTemplateCatalogApi {
  const contributed = pluginComponentTemplates(plugins);
  return Object.freeze({
    async list() {
      const entries = await loadComponentTemplates(options.root, options.frameworkRoot, contributed);
      return entries.map(entry => structuredClone(entry.template));
    },
    async get(id: string) {
      const entries = await loadComponentTemplates(options.root, options.frameworkRoot, contributed);
      return entries.find(entry => entry.template.id === id)?.template;
    },
    async instantiate(workspace, id: string, name?: string) {
      const entries = await loadComponentTemplates(options.root, options.frameworkRoot, contributed);
      return workspace.instantiateTemplate(entries.map(entry => entry.template), id, name);
    },
  });
}

export interface WorkbenchPluginRuntime {
  readonly eventBus: PluginEventBus;
  readonly cliCommands: readonly PluginCliCommand[];
  readonly tuiActions: readonly PluginTuiAction[];
  readonly commandContext: PluginCommandContext;
  dispose(): void;
}
export async function createPluginRuntime(options: RuntimeOptions): Promise<WorkbenchPluginRuntime> {
  const plugins = enabledPlugins(options.registry);
  const cliCommands = validateCli(plugins.flatMap(plugin => plugin.cli ?? []));
  const tuiActions = validateTui(plugins.flatMap(plugin => plugin.tui ?? []));
  const events = plugins.flatMap(plugin => (plugin.events ?? []).map(event => {
    if (!event.id.startsWith(plugin.manifest.id + '.')) throw new Error('WORKBENCH_PLUGIN_EVENT_OWNER:' + event.id);
    return event;
  }));
  const bus = new EventBus(events, code => options.onError?.(code));
  const templates = templateCatalog(options, plugins);
  const commandContext: PluginCommandContext = Object.freeze({
    root: options.root, frameworkRoot: options.frameworkRoot, input: options.input,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.progress ? { progress: options.progress } : {}),
    eventBus: bus,
    templates,
  });
  const cleanups: Array<() => void> = [];
  try {
    for (const plugin of plugins) {
      const cleanup = await plugin.activate?.(commandContext);
      if (cleanup !== undefined && typeof cleanup !== 'function') throw new Error('WORKBENCH_PLUGIN_CLEANUP_INVALID:' + plugin.manifest.id);
      if (cleanup) cleanups.unshift(cleanup);
    }
  } catch (error) {
    for (const cleanup of cleanups) try { cleanup(); } catch { /* preserve activation error */ }
    bus.dispose(); throw error;
  }
  let disposed = false;
  return Object.freeze({
    eventBus: bus, cliCommands, tuiActions, commandContext,
    dispose() {
      if (disposed) return;
      disposed = true;
      let failure: unknown;
      for (const cleanup of cleanups) try { cleanup(); } catch (error) { failure ??= error; }
      bus.dispose();
      if (failure) throw failure;
    },
  });
}
