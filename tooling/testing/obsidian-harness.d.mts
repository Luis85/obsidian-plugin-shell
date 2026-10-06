import type { Browser, BrowserType, Page } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';

export interface ObsidianHost {
  readonly launcher: unknown;
  readonly appVersion: string;
  readonly installerVersion: string;
  readonly launcherVersion: string;
  readonly requestedVersion: string;
}
export function provisionHost(options?: { root?: string; allowDownload?: boolean; appVersion?: string; log?: (message: string) => void }): Promise<ObsidianHost>;
export function requestedAppVersion(env?: Record<string, string | undefined>): string;

export interface ObsidianClient {
  readonly browser: Browser;
  page: Page;
  readonly vault: string;
  readonly port: number;
  readonly proc: ChildProcess;
  output(): string;
}
export interface ObsidianSession {
  readonly closed: boolean;
  start(): Promise<ObsidianClient>;
  close(): Promise<void>;
}
export function createObsidianSession(options: {
  root?: string; host: ObsidianHost; chromium: BrowserType; vaultSource: string; pluginDirectory?: string;
  pluginEnabled?: boolean; args?: string[]; keepScratch?: boolean; onReady?: (client: ObsidianClient) => Promise<void>;
}): ObsidianSession;
export function withSession<R>(session: ObsidianSession, use: (client: ObsidianClient) => Promise<R>): Promise<R>;
export function closeOnAbort(session: ObsidianSession, signal: AbortSignal | undefined): { settled(): Promise<void>; dispose(): void };

export interface ConsoleEntry {
  readonly at: string; readonly kind: 'console' | 'pageerror'; readonly level: 'error' | 'warn' | 'info' | 'log' | 'debug';
  readonly text: string; readonly url: string; readonly stack: string; readonly page: number; readonly sequence: number;
}
export interface ConsoleRecorder {
  readonly entries: readonly ConsoleEntry[];
  attach(page: Page): void;
  attachContext(context: ReturnType<Browser['contexts']>[number]): () => void;
  errors(): ConsoleEntry[];
  pluginEntries(): ConsoleEntry[];
  text(mode?: 'plugin' | 'all'): string;
  mark(): number;
  since(mark: number): ConsoleEntry[];
  dispose(): void;
}
export function createConsoleRecorder(options?: { pluginId?: string; onEntry?: (entry: ConsoleEntry) => void; transform?: (entry: ConsoleEntry) => ConsoleEntry; limit?: number }): ConsoleRecorder;
export function formatEntry(entry: ConsoleEntry, pluginId?: string): string;
export function loadErrors(entries: readonly ConsoleEntry[], pluginId: string): ConsoleEntry[];

export interface PluginState { readonly installed: boolean; readonly enabled: boolean; readonly loaded: boolean; readonly version: string | null }
export interface WaitOptions { readonly timeout?: number; readonly required?: boolean }
export function enablePlugin(page: Page, id: string, options?: WaitOptions): Promise<PluginState & { durationMs: number; viewTypes: string[] }>;
export function disablePlugin(page: Page, id: string, options?: WaitOptions): Promise<PluginState>;
export function reloadPlugin(page: Page, id: string, options?: WaitOptions): Promise<PluginState & { durationMs: number; error: string | null }>;
export function executeCommand(page: Page, id: string): Promise<void>;
