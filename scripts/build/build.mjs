import { build } from 'vite';
import { copyFile } from 'node:fs/promises';
await build({ configFile: 'vite.config.mjs' });
await copyFile('manifest.json', 'dist/manifest.json');
console.log('Built dist/main.js, dist/styles.css and dist/manifest.json.');
