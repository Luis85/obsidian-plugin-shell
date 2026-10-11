// Increment: [[docs/increments/resource-atlas-project]]
// AC-2: A project file that uses a Nuxt UI component with the shell's detected `U` prefix is reported, no code file in `projects/resource-atlas` contains one, and the project registers the `Pf` prefix and builds under `dist/`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const project = resolve(root, 'projects/resource-atlas');
// The shell builds with Nuxt UI's experimental component detection, which globs the whole checkout. These mirror its
// file selection and its pattern for the default `U` prefix (createComponentPattern in @nuxt/ui's shared module).
const CODE = /\.(?:vue|ts|mts|js|mjs|cjs|tsx|jsx)$/;
const SKIPPED = new Set(['node_modules', '.nuxt', 'dist']);
const PATTERN = /<(?:Lazy)?U([A-Z][a-zA-Z]+)|(?:<|#\[|^[ \t]*|:[ \t]+)(?:lazy-)?u-([a-z][a-z0-9-]*)|\b(?:Lazy)?U([A-Z][a-zA-Z]+)\b/gm;
const pascal = name => name.replace(/(?:^|-)([a-z0-9])/g, (_, c) => c.toUpperCase());
const components = new Set((await readdir(resolve(root, 'node_modules/@nuxt/ui/dist/runtime/components')))
  .filter(file => file.endsWith('.vue')).map(file => file.slice(0, -4)));

/** Nuxt UI components the shell's detection would add for this source text. */
function detected(text) {
  const found = new Set();
  for (const match of text.matchAll(PATTERN)) {
    const name = match[2] ? pascal(match[2]) : match[1] || match[3];
    if (components.has(name)) found.add(name);
  }
  return [...found];
}

async function* codeFiles(folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) { if (!SKIPPED.has(entry.name)) yield* codeFiles(path); }
    else if (CODE.test(entry.name) && !entry.name.endsWith('.d.ts')) yield path;
  }
}

test('[AC-2] a U-prefixed Nuxt UI component is reported, the Pf prefix and plain identifiers are not', () => {
  // Assembled at run time: this file is in the checkout the shell scans, so it must not spell such a name itself.
  const U = 'U';
  assert.deepEqual(detected(`<${U}DashboardSidebar collapsible />`), ['DashboardSidebar']);
  assert.deepEqual(detected('<PfDashboardSidebar collapsible /><PfInput />'), []);
  assert.deepEqual(detected('new Date(Date.UTC(2026, 9, 5)); new URL(href)'), []);
});

test('[AC-2] no code file in resource-atlas uses a U-prefixed Nuxt UI component', async () => {
  const offenders = [];
  for await (const file of codeFiles(project)) {
    const found = detected(await readFile(file, 'utf8'));
    if (found.length) offenders.push(`${relative(root, file)}: ${found.join(', ')}`);
  }
  assert.deepEqual(offenders, []);
});

test('[AC-2] resource-atlas registers the Pf prefix and keeps its build under dist/', async () => {
  const vite = await readFile(resolve(project, 'vite.config.mjs'), 'utf8');
  assert.match(vite, /ui\(\{prefix:'Pf',/);
  assert.match(vite, /outDir:'dist\/shell'/);
  assert.doesNotMatch(await readFile(resolve(project, 'scripts/package.mjs'), 'utf8'), /'build\//);
});
