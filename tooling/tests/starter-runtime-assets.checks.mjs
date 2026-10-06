import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { localIcons } from '../bundling/local-icons.mjs';
import { licenseNotices } from '../bundling/license-notices.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));

test('reviewed local icons cover the pinned Nuxt UI defaults and all names have local SVG bodies', async () => {
  const directory = join(root, 'node_modules/@nuxt/ui/dist/shared');
  const modules = await Promise.all((await readdir(directory)).filter(name => name.endsWith('.mjs')).map(name => readFile(join(directory, name), 'utf8')));
  const blocks = modules.flatMap(source => [...source.matchAll(/const defaultIcons = \{([\s\S]*?)\n\};/g)].map(match => match[1]));
  assert.equal(blocks.length, 1, 'Review a changed upstream default icon contract rather than silently skipping it');
  const defaults = [...blocks[0].matchAll(/"i-lucide-([a-z0-9-]+)"/g)].map(match => 'lucide:' + match[1]);
  assert.ok(defaults.length > 30); assert.equal(new Set(localIcons).size, localIcons.length);
  for (const icon of defaults) assert.ok(localIcons.includes(icon), 'Missing offline default ' + icon);
  const pack = JSON.parse(await readFile(join(root, 'node_modules/@iconify-json/lucide/icons.json'), 'utf8'));
  for (const icon of localIcons) assert.ok(pack.icons[icon.slice('lucide:'.length)]?.body, icon);
});

async function fixture(t, version = '0.4.1') {
  const dir = await mkdtemp(join(tmpdir(), 'starter-license-')), before = process.cwd();
  t.after(async () => { process.chdir(before); await rm(dir, { recursive: true, force: true }); });
  const put = async (path, content) => { await mkdir(join(dir, path, '..'), { recursive: true }); await writeFile(join(dir, path), content); };
  for (const [name, v] of [['vaul-vue', version], ['tailwindcss', '4.3.3'], ['@iconify-json/lucide', '1.2.136']]) {
    await put('node_modules/' + name + '/package.json', JSON.stringify({ name, version: v, license: 'MIT' }));
  }
  await put('node_modules/tailwindcss/LICENSE', 'Reviewed test license for a synthetic package.');
  for (const name of ['vaul-vue-0.4.1.txt', 'lucide.txt']) await put('docs/licenses/' + name, await readFile(join(root, 'docs/licenses', name)));
  process.chdir(dir);
  const bundle = { 'main.js': { type: 'chunk', isEntry: true, modules: { [join(dir, 'node_modules/vaul-vue/dist/index.mjs')]: {} }, code: 'export const value = 1;\n' } };
  return { dir, put, bundle, render: () => licenseNotices().generateBundle({}, bundle) };
}

test('exact reviewed missing-license fallback retains the upstream text and code', async t => {
  const f = await fixture(t); f.render();
  const upstream = await readFile(join(root, 'docs/licenses/vaul-vue-0.4.1.txt'), 'utf8');
  assert.equal(createHash('sha256').update(upstream).digest('hex'), 'ba02930e278b4ed6b564150a261b50319b5cef2a965b7470ae13498ece835944');
  assert.ok(f.bundle['main.js'].code.includes(upstream)); assert.match(f.bundle['main.js'].code, /export const value = 1;/);
});
test('a different version cannot inherit the reviewed fallback', async t => {
  const f = await fixture(t, '0.4.2'); assert.throws(f.render, /Missing bundled dependency license: vaul-vue/);
  assert.equal(f.bundle['main.js'].code, 'export const value = 1;\n');
});
test('tampering with the retained license fails before emitting any banner', async t => {
  const f = await fixture(t); await f.put('docs/licenses/vaul-vue-0.4.1.txt', 'edited');
  assert.throws(f.render, /license integrity mismatch/); assert.equal(f.bundle['main.js'].code, 'export const value = 1;\n');
});
