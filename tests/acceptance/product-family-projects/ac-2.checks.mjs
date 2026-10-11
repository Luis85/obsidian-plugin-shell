// Increment: [[docs/increments/product-family-projects]]
// AC-2: A project file that uses a Nuxt UI component with the shell's detected `U` prefix is reported, and no code file in the four projects contains one, so the shell's Nuxt UI component detection never picks up the projects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const FAMILY = ['component-atlas', 'storyloom', 'sitemap-atlas', 'dissect-canvas'];
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
  assert.ok(components.has('Button') && components.has('DashboardGroup'), 'the Nuxt UI component list is readable');
  assert.deepEqual(detected('<UButton label="Save" />'), ['Button']);
  assert.deepEqual(detected('<template>\n  <u-dashboard-group>\n</template>'), ['DashboardGroup']);
  assert.deepEqual(detected('import { UModal } from "@nuxt/ui/components"'), ['Modal']);
  assert.deepEqual(detected('<PfButton label="Save" /><PfDashboardGroup />'), []);
  assert.deepEqual(detected('new URL(location.href); const URI = "opf://";'), []);
});

test('[AC-2] no code file in the four projects uses a U-prefixed Nuxt UI component', async () => {
  const offenders = [];
  for (const name of FAMILY) {
    for await (const file of codeFiles(resolve(root, 'projects', name))) {
      const found = detected(await readFile(file, 'utf8'));
      if (found.length) offenders.push(`${relative(root, file)}: ${found.join(', ')}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('[AC-2] each project registers its Nuxt UI components under the Pf prefix', async () => {
  for (const name of FAMILY) {
    const { COMPONENT_PREFIX } = await import(resolve(root, 'projects', name, 'app.config.mjs'));
    assert.equal(COMPONENT_PREFIX, 'Pf', name);
    const vite = await readFile(resolve(root, 'projects', name, 'vite.config.mjs'), 'utf8');
    assert.match(vite, /ui\(\{prefix:COMPONENT_PREFIX,/, `${name} passes the prefix to Nuxt UI`);
    assert.match(vite, /outDir:'dist\/shell'/, `${name} keeps its intermediate build under dist/`);
  }
});
