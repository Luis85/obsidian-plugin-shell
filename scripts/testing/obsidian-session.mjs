import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { nativeScratch, nativeScratchDirectory, nativeConfigDirectory, withNativeTemporaryDirectory, assertNativeVault } from './native-isolation.mjs';
import { SessionLifecycle } from './obsidian-session-lifecycle.mjs';
import { captureOutput, connectHost, freePort, stopHost, workspacePage } from './obsidian-host.mjs';
import { copyVaultTree } from '../dev/obsidian-sandbox.mjs';

export { withSession, closeOnAbort } from './obsidian-session-lifecycle.mjs';

/** One real Obsidian process on a fresh copy of a synthetic vault under .nq/.
 * The plugin is installed disabled so callers can observe its whole load after attaching. */
export function createObsidianSession({ root = process.cwd(), host, chromium, vaultSource, pluginDirectory = 'dist', pluginEnabled = false,
  args = [], keepScratch = process.env.OBSIDIAN_KEEP_SCRATCH === '1', onReady = async () => undefined }) {
  root = resolve(root);
  const state = { scratch: undefined, vault: undefined, launched: undefined, configDir: undefined, output: () => '', port: 0 };
  return new SessionLifecycle({
    async prepare() {
      state.scratch = await nativeScratch(root);
      state.vault = join(state.scratch, 'vault');
      await copyVaultTree(resolve(root, vaultSource), state.vault);
      state.port = await freePort();
    },
    async connect() {
      await withNativeTemporaryDirectory(state.scratch, async () => {
        state.launched = await host.launcher.launch({ appVersion: host.appVersion, installerVersion: host.installerVersion,
          vault: state.vault, copy: false, plugins: [{ path: resolve(root, pluginDirectory), enabled: pluginEnabled }],
          localStorage: { language: 'en' }, args: [`--remote-debugging-port=${state.port}`, ...args],
          spawnOptions: { detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] } });
      }, root);
      state.output = captureOutput(state.launched.proc);
      await assertNativeVault(state.launched.vault, state.vault);
      state.configDir = await nativeConfigDirectory(state.launched.configDir, state.scratch, root);
      const browser = await connectHost({ chromium, port: state.port, proc: state.launched.proc, output: state.output });
      return { browser, page: undefined, vault: state.vault, port: state.port, proc: state.launched.proc, output: () => state.output() };
    },
    async initialize(client) {
      client.page = await workspacePage(client.browser);
      await onReady(client);
    },
    disconnect: client => client.browser.close(),
    async cleanup() {
      const failures = [];
      try { await stopHost(state.launched?.proc); } catch (error) { failures.push(error); }
      if (state.scratch && !keepScratch) {
        try { await rm(await nativeScratchDirectory(state.scratch, root), { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
        catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, 'OBSIDIAN_SESSION_CLEANUP_FAILED');
    },
  });
}
