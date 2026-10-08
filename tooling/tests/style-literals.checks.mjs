import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { scanStyleSource } from '../styles/style-literals.mjs';
import { suggestTokens } from '../styles/style-literal-suggestions.mjs';
import { checkStyleLiterals, validateAllowlist } from '../styles/check-style-literals.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const catalog = JSON.parse(await readFile(new URL('../../docs/design/obsidian-tokens.json', import.meta.url), 'utf8'));
const literals = (path, text) => scanStyleSource(path, text).map((hit) => hit.literal);
const sfc = (style, template = '<div />') => `<script setup lang="ts">\nconst a = 1;\n</script>\n<template>${template}</template>\n<style scoped>\n${style}\n</style>\n`;
const negative = {
  'short hex': ['.a { color: #fff; }', '#fff'],
  'long hex': ['.a { background: #1a2B3c; }', '#1a2B3c'],
  'alpha hex': ['.a { border-color: #11223344; }', '#11223344'],
  'rgb': ['.a { color: rgb(255, 0, 0); }', 'rgb(255, 0, 0)'],
  'rgba': ['.a { color: rgba(0,0,0,.5); }', 'rgba(0,0,0,.5)'],
  'modern rgb': ['.a { color: rgb(0 0 0 / 50%); }', 'rgb(0 0 0 / 50%)'],
  'hsl': ['.a { color: hsl(10, 50%, 50%); }', 'hsl(10, 50%, 50%)'],
  'hsla': ['.a { color: hsla(10, 50%, 50%, .2); }', 'hsla(10, 50%, 50%, .2)'],
  'oklch': ['.a { color: oklch(0.7 0.1 200); }', 'oklch(0.7 0.1 200)'],
  'named colour': ['.a { color: red; }', 'red'],
  'named in shorthand': ['.a { border: 1px solid rebeccapurple; }', 'rebeccapurple'],
  'named in gradient': ['.a { background: linear-gradient(to right, white, var(--background-primary)); }', 'white'],
  'literal inside color-mix': ['.a { color: color-mix(in srgb, #ff0000 40%, var(--text-normal)); }', '#ff0000'],
  'fallback literal in var': ['.a { color: var(--text-normal, #333); }', '#333'],
  'shadow colour': ['.a { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); }', 'rgba(0, 0, 0, 0.3)'],
  'custom property definition': [':root { --brand: #7b6cd9; }', '#7b6cd9'],
  'uppercase named': ['.a { color: DarkSlateGray; }', 'DarkSlateGray'],
  'last declaration without semicolon': ['.a { color: blue }', 'blue'],
};
for (const [name, [css, literal]] of Object.entries(negative)) {
  test(`[STYLE-01] raw ${name} is rejected in CSS and in a Vue style block`, () => {
    assert.deepEqual(literals('src/x.css', css), [literal]);
    assert.deepEqual(literals('src/X.vue', sfc(css)), [literal]);
  });
}
test('[STYLE-02] findings report 1-based file, line and column plus the literal kind and property', () => {
  const hit = scanStyleSource('src/x.css', '.a {\n  color: red;\n  background: #fff;\n}\n');
  assert.deepEqual(hit.map(({ file, line, column, literal, kind, property }) => ({ file, line, column, literal, kind, property })), [
    { file: 'src/x.css', line: 2, column: 10, literal: 'red', kind: 'named', property: 'color' },
    { file: 'src/x.css', line: 3, column: 15, literal: '#fff', kind: 'hex', property: 'background' },
  ]);
  const vue = scanStyleSource('src/X.vue', sfc('.a {\n  color: #abc;\n}')).at(0);
  assert.equal(vue.line, 7); assert.equal(vue.column, 10);
});
test('[STYLE-03] token usage, color-mix over tokens, keywords, comments, strings, urls and selectors are accepted', () => {
  const clean = [
    '.a { color: var(--text-normal); background: var(--background-primary); }',
    '.a { color: color-mix(in srgb, var(--text-accent) 40%, transparent); }',
    '.a { border: 1px solid var(--background-modifier-border); box-shadow: 0 0 0 1px currentColor; }',
    '.a { background: transparent; color: inherit; outline-color: currentcolor; fill: currentColor; }',
    '.a { color: rgba(var(--mono-rgb-100), 0.1); background: hsl(var(--accent-h), var(--accent-s), var(--accent-l)); }',
    '.a { color: var(--plugin-shell-text, var(--text-normal)); }',
    '/* color: red; background: #fff; */ .a { margin: 0; }',
    '.a::after { content: "red #fff rgb(0,0,0)"; }',
    '.a { background: url(data:image/svg+xml;utf8,<svg fill="#fff"/>) no-repeat; mask: url(#red); }',
    '#fade:hover, .a:not(#abc123) { opacity: 0.5; transition: opacity .2s; }',
    '.a { --plugin-shell-red-gap: 4px; margin-inline: var(--color-red-gap, 2px); font-family: var(--font-interface); }',
    '.a { background: var(--color-red); }',
    '@media (min-width: 600px) { .a { color: var(--text-muted); } }',
  ];
  for (const css of clean) {
    assert.deepEqual(literals('src/x.css', css), [], css);
    assert.deepEqual(literals('src/X.vue', sfc(css)), [], css);
  }
});
test('[STYLE-04] only style blocks and inline styles are inspected in Vue files; scripts, templates text and comments are not', () => {
  const text = '<script setup lang="ts">\nconst color = "#fff"; const red = "red";\n</script>\n<template><!-- style="color: red" -->\n<p>red #fff</p></template>\n';
  assert.deepEqual(literals('src/X.vue', text), []);
  assert.deepEqual(literals('src/x.ts', '.a { color: red; }'), []);
});
test('[STYLE-05] simple inline template styles are checked, static and bound', () => {
  assert.deepEqual(literals('src/X.vue', '<template><div style="color: #f00; margin: 0" /></template>'), ['#f00']);
  assert.deepEqual(literals('src/X.vue', '<template><div style="background:var(--background-primary)" /></template>'), []);
  assert.deepEqual(literals('src/X.vue', `<template><div :style="{ color: 'red', background: 'var(--background-primary)' }" /></template>`), ['red']);
  assert.deepEqual(literals('src/X.vue', `<template><div :style="{ border: '1px solid rgb(0, 0, 0)' }" /></template>`), ['rgb(0, 0, 0)']);
  assert.deepEqual(literals('src/X.vue', `<template><div v-bind:style='{ outline: "2px solid #123456" }' /></template>`), ['#123456']);
  const bound = scanStyleSource('src/X.vue', `<template>\n  <div :style="{ color: 'red' }" />\n</template>`)[0];
  assert.deepEqual([bound.line, bound.column], [2, 26]);
});
test('[STYLE-06] suggestions are reviewed catalog tokens chosen from the property and named colour', () => {
  const [red] = scanStyleSource('src/x.css', '.a { color: red; }'), [bg] = scanStyleSource('src/x.css', '.a { background: #fff; }');
  const [border] = scanStyleSource('src/x.css', '.a { border: 1px solid #ccc; }');
  assert.equal(suggestTokens(red, catalog)[0], 'var(--color-red)'); assert.ok(suggestTokens(bg, catalog).includes('var(--background-primary)'));
  assert.ok(suggestTokens(border, catalog).includes('var(--background-modifier-border)'));
  const known = new Set(catalog.groups.flatMap((group) => group.names));
  for (const finding of [red, bg, border, { kind: 'hex', literal: '#000', property: 'box-shadow' }, { kind: 'hex', literal: '#000', property: 'zzz' }]) {
    assert.ok(suggestTokens(finding, catalog).every((value) => known.has(value.slice(4, -1))));
  }
});
async function fakeRoot(files, allowlist) {
  const folder = await mkdtemp(join(tmpdir(), 'style-literals-'));
  for (const [path, content] of Object.entries(files)) { await mkdir(join(folder, path, '..'), { recursive: true }); await writeFile(join(folder, path), content); }
  await mkdir(join(folder, 'docs/design'), { recursive: true }); await mkdir(join(folder, 'tooling/styles'), { recursive: true });
  await copyFile(join(root, 'docs/design/obsidian-tokens.json'), join(folder, 'docs/design/obsidian-tokens.json'));
  await writeFile(join(folder, 'tooling/styles/style-literal-allowlist.json'), JSON.stringify({ schemaVersion: 1, entries: allowlist }));
  return folder;
}
test('[STYLE-07] the checker fails with every offending file and passes once the literals become tokens', async () => {
  const folder = await fakeRoot({ 'src/a.css': '.a { color: #fff; }', 'src/b/B.vue': sfc('.b { background: red; }'), 'src/ok.css': '.c { color: var(--text-normal); }' }, []);
  try {
    const failed = await checkStyleLiterals(folder);
    assert.equal(failed.status, 'failed'); assert.equal(failed.files, 3);
    assert.deepEqual(failed.findings.map((f) => [f.file, f.literal]), [['src/a.css', '#fff'], ['src/b/B.vue', 'red']]);
    assert.ok(failed.findings.every((f) => f.suggestions.length > 0));
    await writeFile(join(folder, 'src/a.css'), '.a { color: var(--text-normal); }');
    await writeFile(join(folder, 'src/b/B.vue'), sfc('.b { background: var(--background-primary); }'));
    assert.equal((await checkStyleLiterals(folder)).status, 'passed');
  } finally { await rm(folder, { recursive: true, force: true }); }
});
test('[STYLE-08] the allowlist is exact-file and reasoned; it cannot hide other files and it cannot go stale', async () => {
  const reason = 'Token definitions generated from the pinned host snapshot.';
  const folder = await fakeRoot({ 'src/tokens/defs.css': ':root { --x: #fff; }', 'src/other.css': '.a { color: red; }' }, [{ path: 'src/tokens/defs.css', reason }]);
  try {
    const partial = await checkStyleLiterals(folder);
    assert.deepEqual(partial.findings.map((f) => f.file), ['src/other.css']); assert.deepEqual(partial.allowlisted, ['src/tokens/defs.css']);
    await writeFile(join(folder, 'src/other.css'), '.a { color: currentColor; }');
    assert.equal((await checkStyleLiterals(folder)).status, 'passed');
    await writeFile(join(folder, 'src/tokens/defs.css'), ':root { --x: var(--text-normal); }');
    const stale = await checkStyleLiterals(folder); assert.equal(stale.status, 'failed'); assert.deepEqual(stale.staleAllowlist, ['src/tokens/defs.css']);
  } finally { await rm(folder, { recursive: true, force: true }); }
  for (const bad of [{ path: 'src', reason }, { path: 'src/**/*.css', reason }, { path: 'src/a.css', reason: '' }, { path: '../x.css', reason },
    { path: '/etc/x.css', reason }, { path: 'src/a.css' }, { path: 'src/a.css', reason: 'short' }]) assert.throws(() => validateAllowlist({ schemaVersion: 1, entries: [bad] }), /STYLE_ALLOWLIST/);
  assert.throws(() => validateAllowlist({ schemaVersion: 1, entries: [{ path: 'src/a.css', reason }, { path: 'src/a.css', reason }] }), /STYLE_ALLOWLIST_PATH/);
  assert.throws(() => validateAllowlist({ schemaVersion: 2, entries: [] }), /STYLE_ALLOWLIST_SHAPE/);
});
test('[STYLE-09] the repository CLI passes on the real sources and exits non-zero on a violation', async () => {
  const run = spawnSync(process.execPath, ['tooling/styles/check-style-literals.mjs', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr); const result = JSON.parse(run.stdout);
  // Counted independently, so a consumer that removed the example features (fewer SFCs) is still checked exactly.
  // The checker's scope: src without the companion concept and the plugin harness (both outside src before the project split).
  const sources = (await readdir(join(root, 'src'), { recursive: true })).map(path => path.replaceAll('\\', '/'))
    .filter(path => /\.(?:vue|css)$/.test(path) && !path.startsWith('companion/') && !path.startsWith('plugin/harness/'));
  assert.equal(result.status, 'passed'); assert.ok(sources.length > 0); assert.equal(result.files, sources.length); assert.deepEqual(result.findings, []);
  assert.equal(spawnSync(process.execPath, ['tooling/styles/check-style-literals.mjs', '--bogus'], { cwd: root, encoding: 'utf8' }).status, 1);
});
