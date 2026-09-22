import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
import { installLocal } from './install-local.mjs';
const watcher = await build({ configFile: 'vite.config.mjs', build: { watch: {} } });
let installing = Promise.resolve();
watcher.on('event', event => {
  if (event.code === 'ERROR') console.error('Build failed; the last good install remains in place.', event.error.message);
  if (event.code === 'END') installing = installing.then(async () => {
    await copyFile('manifest.json', 'dist/manifest.json');
    const installed = await installLocal(); console.log(`Installed ${installed.target}. Reload the plugin in Obsidian.`);
  }).catch(error => console.error('Install failed:', error.message));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void watcher.close(); });
