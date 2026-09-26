import { watch, lstatSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { outermostRoots, sourceRoots } from '../shared/project-roots.mjs';

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
  if (platform !== 'linux') {
    try { const watcher = watch(root, { recursive: true }, changed); watcher.on('error', () => watcher.close()); return () => watcher.close(); }
    catch { return () => undefined; }
  }
  // Each watched folder remembers its inode: a folder deleted (or deleted and recreated) under the same
  // path leaves a dead inotify watch, which is closed together with every watch below it.
  const watchers = new Map();
  const drop = directory => {
    for (const [path, entry] of watchers) if (path === directory || path.startsWith(`${directory}${sep}`)) { entry.watcher.close(); watchers.delete(path); }
  };
  const add = directory => {
    let stat;
    try { stat = lstatSync(directory); } catch { drop(directory); return; }
    if (!stat.isDirectory() || stat.isSymbolicLink()) { drop(directory); return; }
    const existing = watchers.get(directory);
    if (existing?.ino === stat.ino) return;
    if (existing) drop(directory);
    let watcher;
    try { watcher = watch(directory, (event, name) => { changed(event, name); if (event === 'rename' && name) add(join(directory, String(name))); }); }
    catch { return; }
    watcher.on('error', () => { if (watchers.get(directory)?.watcher === watcher) drop(directory); else watcher.close(); });
    watchers.set(directory, { watcher, ino: stat.ino });
    let entries = [];
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { /* removed meanwhile; its parent reports it */ }
    for (const entry of entries) if (entry.isDirectory()) add(join(directory, entry.name));
  };
  add(root);
  return Object.assign(() => { for (const entry of watchers.values()) entry.watcher.close(); watchers.clear(); },
    { watched: () => [...watchers.keys()].sort() });
}
/** Source and build-configuration watchers shared by the local and real-Obsidian dev loops.
 * A generated project adds its configured product roots (tsconfig.project.json), for example
 * `<codebaseFolder>/generated`; a source root that is removed and recreated is watched again. */
export function watchPluginSources(changed, { sources = ['src', 'scripts/bundling', ...sourceRoots('.')], configuration = ['vite.config.mjs', 'manifest.json', 'package.json', 'package-lock.json'] } = {}) {
  const names = new Set(configuration);
  const trees = new Map(outermostRoots(sources).map(path => [path, watchTree(path, changed)]));
  const top = new Map([...trees.keys()].map(path => [path.split('/')[0], path]));
  const root = watch('.', (event, name) => {
    if (names.has(name)) changed();
    const path = event === 'rename' ? top.get(String(name)) : undefined;
    if (path) { trees.get(path)?.(); trees.set(path, watchTree(path, changed)); changed(); }
  });
  return () => { for (const close of trees.values()) close(); root.close(); };
}
