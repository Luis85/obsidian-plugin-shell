import { watch } from 'node:fs';
import { stagedBuild } from '../bundling/staged-build.mjs';
import { installLocal } from './install-local.mjs';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--no-local')) throw new Error('Unknown watch option');
const local = !args.includes('--no-local');
let running = false; let pending = false; let closed = false; let timer;
async function rebuild() {
  if (closed) return;
  pending = true; if (running) return;
  running = true;
  try {
    do {
      pending = false;
      try {
        await stagedBuild();
        if (local) { const result = await installLocal(); console.log(`Installed ${result.target}. Reload the plugin in Obsidian.`); }
        else console.log('Complete candidate ready in dist/.');
      } catch (error) { console.error('Build/install failed; the last good candidate and install are retained.', error.message); }
    } while (pending && !closed);
  } finally { running = false; }
}
function changed() { clearTimeout(timer); timer = setTimeout(() => { void rebuild(); }, 120); }
const watchers = ['src', 'scripts/bundling'].map(path => watch(path, { recursive: true }, changed));
const configuration = new Set(['vite.config.mjs', 'manifest.json', 'package.json', 'package-lock.json']);
watchers.push(watch('.', (_, name) => { if (configuration.has(name)) changed(); }));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { closed = true; clearTimeout(timer); for (const watcher of watchers) watcher.close(); });
await rebuild();
