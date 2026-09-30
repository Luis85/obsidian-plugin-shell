import type { Readable } from 'node:stream';
import type { Workspace } from '../bin/application/workspace.ts';
import type { Prompts } from '../bin/presentation/prompts.ts';

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
}
export interface PluginConfig {
  readonly enabled?: boolean;
  readonly [key: string]: unknown;
}
export interface PluginEventDefinition<N extends string = string, P = unknown> {
  readonly id: N;
  readonly valid: (payload: unknown) => payload is P;
}
export function definePluginEvent<const N extends string, P>(
  id: N,
  valid: (payload: unknown) => payload is P,
): PluginEventDefinition<N, P> {
  if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(id) || typeof valid !== 'function') throw new Error('PLUGIN_EVENT_INVALID');
  return Object.freeze({ id, valid });
}
export interface PluginEventBus {
  on<N extends string, P>(definition: PluginEventDefinition<N, P>, listener: (payload: P) => void | Promise<void>): () => void;
  once<N extends string, P>(definition: PluginEventDefinition<N, P>, listener: (payload: P) => void | Promise<void>): () => void;
  dispatch<N extends string, P>(definition: PluginEventDefinition<N, P>, payload: P): void;
}
export interface PluginCommandContext {
  readonly root: string;
  readonly frameworkRoot: string;
  readonly input: Readable;
  readonly signal?: AbortSignal;
  readonly progress?: (message: string) => void;
  readonly eventBus: PluginEventBus;
}
export interface PluginCliRequest {
  readonly action: string;
  readonly flags: Readonly<Record<string, string | boolean>>;
}
export interface PluginCliCommand {
  readonly id: string;
  readonly summary: string;
  readonly options?: {
    readonly booleans?: readonly string[];
    readonly values?: readonly string[];
  };
  execute(request: PluginCliRequest, context: PluginCommandContext): Record<string, unknown> | Promise<Record<string, unknown>>;
}
export interface PluginTuiContext extends PluginCommandContext {
  readonly project: string;
  readonly ui: Prompts;
  readonly workspace: Workspace;
}
export interface PluginTuiAction {
  readonly id: string;
  readonly label: string;
  run(context: PluginTuiContext): void | Promise<void>;
}
export interface WorkbenchPluginContext extends PluginCommandContext {}
export interface WorkbenchPluginObject {
  readonly manifest: PluginManifest;
  readonly config: PluginConfig;
  readonly events?: readonly PluginEventDefinition[];
  readonly cli?: readonly PluginCliCommand[];
  readonly tui?: readonly PluginTuiAction[];
  activate?(context: WorkbenchPluginContext): void | (() => void) | Promise<void | (() => void)>;
}
