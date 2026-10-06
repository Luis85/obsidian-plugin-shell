import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { chromium, type Locator, type Page } from '@playwright/test';
import { test as base } from 'vitest';
import {
  closeOnAbort, createConsoleRecorder, createObsidianSession, disablePlugin, enablePlugin, executeCommand, formatEntry,
  loadErrors, provisionHost, reloadPlugin, requestedAppVersion, withSession,
  type ConsoleEntry, type ObsidianHost, type PluginState,
} from '../../../scripts/testing/obsidian-harness.mjs';
import { capturePage, caseDirectory, sourceCommit, writeEvidence } from './evidence';
import type { HostContext } from './host';

export interface PluginIdentity { readonly id: string; readonly name: string; readonly version: string; readonly minAppVersion?: string }
export interface ObsidianHarness {
  /** The main Obsidian window, driven through Playwright over CDP. */
  readonly page: Page;
  readonly manifest: PluginIdentity;
  readonly pluginId: string;
  /** This case's copied vault (removed after the case unless OBSIDIAN_KEEP_SCRATCH=1). */
  readonly vaultPath: string;
  /** reports/obsidian/cases/<case>: environment, console, screenshots, DOM and teardown records. */
  readonly directory: string;
  /** View types this plugin registered while being enabled for this case. */
  readonly pluginViewTypes: readonly string[];
  /** Run `fn` inside Obsidian. It cannot close over test variables; pass JSON-serializable `args`. */
  eval<R>(fn: (context: HostContext) => R | Promise<R>): Promise<Awaited<R>>;
  eval<R, A>(fn: (context: HostContext, args: A) => R | Promise<R>, args: A): Promise<Awaited<R>>;
  /** Execute a command by full id (`app:open-settings`) or by this plugin's short id. */
  runCommand(id: string): Promise<void>;
  /** Open a view type in a new tab and wait until its container is visible. */
  openView(type: string): Promise<Locator>;
  /** Poll `fn` inside Obsidian until it returns a truthy value; returns that value. */
  waitFor<R>(fn: (context: HostContext) => R | Promise<R>, options?: { timeout?: number; message?: string }): Promise<Awaited<R>>;
  consoleEntries(): readonly ConsoleEntry[];
  /** Plugin-attributed console lines, formatted. */
  pluginLogs(): string[];
  /** Uncaught page errors plus plugin-attributed console errors. */
  errors(): ConsoleEntry[];
  reloadPlugin(): Promise<PluginState>;
  disablePlugin(): Promise<PluginState>;
  enablePlugin(): Promise<PluginState>;
  /** Save a screenshot into this case's evidence folder and return its path. */
  screenshot(name?: string): Promise<string>;
}

let provisioned: Promise<ObsidianHost> | undefined;
/** The runner provisions explicitly; the fixture never downloads. */
function host(): Promise<ObsidianHost> {
  provisioned ??= provisionHost({ allowDownload: false, appVersion: requestedAppVersion() });
  return provisioned;
}
/** The function crosses a process boundary as source text; its result returns as serialized data. */
function evaluate<R, A>(page: Page, pluginId: string, fn: (context: HostContext, args: A) => R | Promise<R>, args: A | undefined): Promise<Awaited<R>> {
  return page.evaluate<Awaited<R>, [string, unknown, string]>(([source, input, id]) => {
    const run: (context: HostContext, args: unknown) => Awaited<R> | Promise<Awaited<R>> = new Function(`return (${source});`)();
    return run({ app: window.app, pluginId: id, plugin: window.app.plugins.plugins[id] }, input);
  }, [fn.toString(), args, pluginId]);
}
function harness(page: Page, manifest: PluginIdentity, vaultPath: string, directory: string, pluginViewTypes: string[], recorder: ReturnType<typeof createConsoleRecorder>): ObsidianHarness {
  const pluginId = manifest.id;
  const self: ObsidianHarness = {
    page, manifest, pluginId, vaultPath, directory, pluginViewTypes,
    eval: <R, A>(fn: (context: HostContext, args: A) => R | Promise<R>, args?: A) => evaluate(page, pluginId, fn, args),
    runCommand: id => executeCommand(page, id.includes(':') ? id : `${pluginId}:${id}`),
    async openView(type) {
      await self.eval(async ({ app }, viewType) => { await app.workspace.getLeaf('tab').setViewState({ type: viewType, active: true }); }, type);
      const view = page.locator(`.workspace-leaf-content[data-type="${type}"]`).last();
      await view.waitFor({ state: 'visible' });
      return view;
    },
    async waitFor(fn, { timeout = 15000, message = 'Condition was not met inside Obsidian' } = {}) {
      const deadline = Date.now() + timeout;
      for (;;) {
        const value = await self.eval(fn);
        if (value) return value;
        if (Date.now() > deadline) throw new Error(`${message} within ${timeout}ms`);
        await new Promise(ok => setTimeout(ok, 100));
      }
    },
    consoleEntries: () => recorder.entries,
    pluginLogs: () => recorder.pluginEntries().map(entry => formatEntry(entry, pluginId)),
    errors: () => loadErrors(recorder.entries, pluginId),
    reloadPlugin: () => reloadPlugin(page, pluginId),
    disablePlugin: () => disablePlugin(page, pluginId),
    enablePlugin: () => enablePlugin(page, pluginId),
    async screenshot(name = 'screenshot') {
      const path = join(directory, `${name}.png`);
      await page.screenshot({ path });
      return path;
    },
  };
  return self;
}

/** Each case owns a fresh Obsidian process, profile and copied vault with the built plugin enabled. */
export const test = base.extend<{ obsidian: ObsidianHarness }>({
  obsidian: async ({ task, signal }, use) => {
    const directory = await caseDirectory(task.file.name, task.name);
    const started = Date.now();
    const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8')) as PluginIdentity;
    const recorder = createConsoleRecorder({ pluginId: manifest.id });
    const provisionedHost = await host();
    let pluginViewTypes: string[] = [];
    const session = createObsidianSession({ host: provisionedHost, chromium, vaultSource: 'tests/obsidian/vault',
      async onReady(client) {
        const context = client.browser.contexts()[0];
        if (!context) throw new Error('OBSIDIAN_CONTEXT_MISSING');
        recorder.attachContext(context);
        pluginViewTypes = (await enablePlugin(client.page, manifest.id)).viewTypes;
      } });
    const abort = closeOnAbort(session, signal);
    try {
      await withSession(session, async client => {
        await writeEvidence(directory, 'environment', {
          runner: 'vitest real-obsidian', requestedVersion: provisionedHost.requestedVersion, appVersion: provisionedHost.appVersion,
          installerVersion: provisionedHost.installerVersion, launcherVersion: provisionedHost.launcherVersion,
          userAgent: await client.page.evaluate(() => navigator.userAgent), platform: process.platform, arch: process.arch,
          node: process.version, commit: sourceCommit(), plugin: manifest, pluginViewTypes, vault: relative(process.cwd(), client.vault),
        });
        try { await use(harness(client.page, manifest, client.vault, directory, pluginViewTypes, recorder)); }
        finally { if (!signal.aborted) await capturePage(client.page, directory); }
      });
      await abort.settled();
      await writeEvidence(directory, 'teardown', { completed: true, testState: task.result?.state ?? 'unknown', durationMs: Date.now() - started });
    } catch (error) {
      await writeEvidence(directory, 'teardown', { completed: false, testState: task.result?.state ?? 'unknown', durationMs: Date.now() - started, error });
      throw error;
    } finally {
      abort.dispose(); recorder.dispose();
      await writeFile(join(directory, 'console.log'), `${recorder.text('all')}\n`);
    }
  },
});
