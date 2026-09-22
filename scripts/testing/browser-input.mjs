/** Explicit inline DIAGNOSTIC mode for sandbox environments; never an HTTP/native substitute. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function inlineSpecimen(root) {
  const read = (path) => readFile(resolve(root,path), 'utf8');
  const names = ['tokens','base','controls','overlays','accessibility'];
  const css = (await Promise.all(names.map((n) => read(`harness/styles/obsidian/${n}.css`)))).join('\n');
  const html = await read('harness/style-fixture/index.html');
  return html.replace('<link rel="stylesheet" href="../styles/obsidian.css">', `<style data-host-fixture>${css}</style>`)
    .replace('<link rel="stylesheet" href="fixture.css">', `<style>${await read('harness/style-fixture/fixture.css')}</style>`)
    .replace('<script src="fixture.js" defer></script>', '')
    .replace('</body>', `<script>${await read('harness/style-fixture/fixture.js')}</script></body>`);
}
