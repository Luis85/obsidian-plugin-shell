import { watch, lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Coalesce change bursts into one serialized rebuild; a change during a build queues one more. */
export function createRebuildLoop(run, { delay = 120, onError = () => undefined } = {}) {
  let running = false; let pending = false; let closed = false; let timer; let current = Promise.resolve();
  async function drain() {
    running = true;
    try {
      do {
        pending = false;
        try { await run(); } catch (error) { onError(error); }
      } while (pending && !closed);
    } finally { running = false; }
  }
  function now() {
    if (closed) return current;
    pending = true;
    if (!running) current = drain();
    return current;
  }
  return {
    now,
    changed() { clearTimeout(timer); timer = setTimeout(() => { void now(); }, delay); },
    idle: () => current,
    close() { closed = true; clearTimeout(timer); return current; },
  };
}
/** Node's recursive watcher on Linux stops reporting a file after an editor replaces it by
 * rename (write-temp-then-rename saves). Directory watchers keep observing replaced files. */
export function watchTree(root, changed, platform = process.platform) {
  if (platform !== 'linux') { const watcher = watch(root, { recursive: true }, changed); return () => watcher.close(); }
  const watchers = new Map();
  const add = directory => {
    if (watchers.has(directory)) return;
    let stat;
    try { stat = lstatSync(directory); } catch { return; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;
    const watcher = watch(directory, (event, name) => { changed(event, name); if (event === 'rename' && name) add(join(directory, String(name))); });
    watcher.on('error', () => { watcher.close(); watchers.delete(directory); });
    watchers.set(directory, watcher);
    for (const entry of readdirSync(directory, { withFileTypes: true })) if (entry.isDirectory()) add(join(directory, entry.name));
  };
  add(root);
  return () => { for (const watcher of watchers.values()) watcher.close(); watchers.clear(); };
}
/** Source and build-configuration watchers shared by the local and real-Obsidian dev loops. */
export function watchPluginSources(changed, { sources = ['src', 'scripts/bundling'], configuration = ['vite.config.mjs', 'manifest.json', 'package.json', 'package-lock.json'] } = {}) {
  const names = new Set(configuration);
  const closers = sources.map(path => watchTree(path, changed));
  const root = watch('.', (_, name) => { if (names.has(name)) changed(); });
  return () => { for (const close of closers) close(); root.close(); };
}
