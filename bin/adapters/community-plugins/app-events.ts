import { definePluginEvent, type WorkbenchPluginObject } from '../../../plugins/api.ts';
import { WorkbenchEventBus } from '../../../plugins/runtime.ts';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: Record<string, unknown>, ...keys: string[]) => keys.every(key => typeof value[key] === 'string');

/** Built-in app events, published by bin/app itself. Plugins listen to them; only the app dispatches them. */
const commandStarted = definePluginEvent('app.command-started',
  (value): value is { command: string; action: string } => record(value) && strings(value, 'command', 'action'));
const commandFinished = definePluginEvent('app.command-finished',
  (value): value is { command: string; action: string; status: string } => record(value) && strings(value, 'command', 'action', 'status'));
export const pluginsLoaded = definePluginEvent('app.plugins-loaded',
  (value): value is { plugins: string[] } => record(value) && Array.isArray(value.plugins) && value.plugins.every(item => typeof item === 'string'));
export const appEventIds: readonly string[] = Object.freeze([commandStarted.id, commandFinished.id, pluginsLoaded.id]);

/** The one event bus of a maker invocation, created before app plugins load; the runtime adopts it. */
export function invocationEventBus(report: (code: string) => void): WorkbenchEventBus {
  return new WorkbenchEventBus([commandStarted, commandFinished, pluginsLoaded], report);
}
/** Defines the events of enabled Workbench plugins up front, so app plugins can subscribe to them while loading. */
export function defineDeclaredEvents(bus: WorkbenchEventBus, registry: readonly WorkbenchPluginObject[]): void {
  for (const plugin of registry.filter(entry => entry.config?.enabled !== false)) for (const event of plugin.events ?? []) bus.define(event);
}

/** Publishes app.command-started and app.command-finished around one non-interactive maker or plugin command. */
export async function observeCommand<T extends { status?: unknown }>(bus: WorkbenchEventBus, command: string, action: string, run: () => Promise<T>): Promise<T> {
  bus.dispatch(commandStarted, { command, action });
  try {
    const data = await run();
    bus.dispatch(commandFinished, { command, action, status: typeof data.status === 'string' ? data.status : 'ok' });
    return data;
  } catch (error) {
    bus.dispatch(commandFinished, { command, action, status: 'failed' });
    throw error;
  }
}
