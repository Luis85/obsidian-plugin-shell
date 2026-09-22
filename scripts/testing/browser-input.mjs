/** Inline diagnostics use exact selected inputs, never silently substitute the simulator. */
import { readVendor, vendorPath, runtimeVendorCss } from '../styles/vendor-policy.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hostFiles, pluginStyleFiles, profilePage } from '../harness/style-profile.mjs';
export async function inlineSpecimen(root, profile = 'extracted') {
  let html = await readFile(resolve(root, profilePage(profile)), 'utf8');
  const css = (await Promise.all(hostFiles[profile].map(async (p) => p === vendorPath ? runtimeVendorCss(await readVendor(root)) : readFile(resolve(root,p),'utf8')))).join('\n');
  const plugin = (await Promise.all(pluginStyleFiles.map((p) => readFile(resolve(root,p),'utf8')))).join('\n');
  const gallery = await readFile(resolve(root,'harness/style-fixture/fixture.css'),'utf8');
  const js = await readFile(resolve(root,'harness/style-fixture/fixture.js'),'utf8');
  const entry = profile === 'extracted' ? 'obsidian' : 'simulated';
  html = html.replace(`<link rel="stylesheet" href="../styles/${entry}.css">`, `<style data-host-fixture>${css}</style>`)
    .replace('<link rel="stylesheet" href="../../src/styles/index.css">', `<style data-plugin-tokens>${plugin}</style>`)
    .replace('<link rel="stylesheet" href="fixture.css">', `<style>${gallery}</style>`)
    .replace('<script src="fixture.js" defer></script>', '')
    .replace('</body>', `<script>${js}</script></body>`);
  return html;
}
