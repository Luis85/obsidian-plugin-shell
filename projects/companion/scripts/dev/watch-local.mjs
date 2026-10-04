import { stagedBuild } from '../bundling/staged-build.mjs';
import { installLocal } from './install-local.mjs';
import { createRebuildLoop, watchPluginSources } from './rebuild-loop.mjs';
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--no-local')) throw new Error('Unknown watch option');
const local = !args.includes('--no-local');
const loop = createRebuildLoop(async () => {
  try {
    await stagedBuild();
    if (local) { const result = await installLocal(); console.log(`Installed ${result.target}. Reload the plugin in Obsidian.`); }
    else console.log('Complete candidate ready in dist/.');
  } catch (error) { console.error('Build/install failed; the last good candidate and install are retained.', error.message); }
});
const close = watchPluginSources(() => loop.changed());
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void loop.close(); close(); });
await loop.now();
