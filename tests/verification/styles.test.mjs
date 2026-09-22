import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { physicalLines } from '../../scripts/testing/source-inputs.mjs';
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
test('[CSS-01] exact entry imports reference the five actual modules', async () => {
  const entry = await read('harness/styles/obsidian.css');
  const paths = [...entry.matchAll(/@import\s+'([^']+)';/g)].map((m) => m[1]);
  assert.equal(new Set(paths).size, 5); assert.equal(paths.length, 5);
  for (const path of paths) {
    assert.match(path, /^\.\/obsidian\/[a-z]+\.css$/);
    const css = await read(`harness/styles/${path.slice(2)}`); assert.ok(css.trim());
    assert.ok(physicalLines(css) <= 400);
  }
});
test('[CSS-02] source fixture remains labeled and does not claim native comparison', async () => {
  const html = await read('harness/style-fixture/index.html');
  assert.match(html, /Original CSS simulation/); assert.match(html, /Production plugin CSS is intentionally absent/);
  const css = await read('harness/styles/obsidian.css'); assert.match(css, /Not copied/);
});
test('[CSS-03] host tokens require explicit harness scope and both themes', async () => {
  const css = await read('harness/styles/obsidian/tokens.css');
  assert.match(css, /:where\(\.obsidian-harness\)/);
  assert.match(css, /theme-dark/);
  assert.match(await read('harness/style-fixture/fixture.js'), /theme-light/);
  assert.match(css, /--background-primary:/); assert.match(css, /--text-normal:/);
});
test('[CSS-04] source-level tripwire rejects remote imports and unsafe behavior', async () => {
  const js = await read('harness/style-fixture/fixture.js');
  assert.doesNotMatch(js, /\b(?:fetch|eval)\s*\(|innerHTML|localStorage/);
  const names = ['tokens', 'base', 'controls', 'overlays', 'accessibility'];
  for (const name of names) assert.doesNotMatch(await read(`harness/styles/obsidian/${name}.css`), /@import\s+(?:url\()?['"]?https?:/);
});
