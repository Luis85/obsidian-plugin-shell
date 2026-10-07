import test from 'node:test';
import assert from 'node:assert/strict';
import { aliasPrefixes, normalizePath, projectForPath, renamedSpecifier, resolveSpecifier } from '../domain/source-imports.ts';
import { loadSpecifierParsers, moduleSpecifiers } from '../adapters/module-specifiers.ts';

const aliases = aliasPrefixes({ '#shared/*': './src/shared/*', '#util/*': './src/util/*', '#exact': './src/exact.ts', '#cond/*': { node: './x/*' } });

test('package.json imports become alias prefixes; exact and conditional entries are not prefixes', () => {
  assert.deepEqual(aliases, [['#shared/', 'src/shared/'], ['#util/', 'src/util/']]);
  assert.deepEqual(aliasPrefixes(null), []);
});
test('specifiers resolve to repository paths; packages and paths above the root do not', () => {
  assert.equal(resolveSpecifier('src/cli/a/b.ts', '#shared/platform/hash.ts', aliases), 'src/shared/platform/hash.ts');
  assert.equal(resolveSpecifier('src/cli/a/b.ts', '../../util/x.ts?raw', aliases), 'src/util/x.ts');
  assert.equal(resolveSpecifier('src/cli/a/b.ts', 'node:fs', aliases), null);
  assert.equal(resolveSpecifier('src/a.ts', '../../outside.ts', aliases), null);
  assert.equal(normalizePath('a/./b/../c'), 'a/c');
});
test('a path belongs to the longest declared project path', () => {
  const projects = [{ name: 'flat', path: 'src' }, { name: 'cli', path: 'src/cli' }];
  assert.equal(projectForPath(projects, 'src/cli/app.ts').name, 'cli');
  assert.equal(projectForPath(projects, 'src/main.ts').name, 'flat');
  assert.equal(projectForPath([{ name: 'cli', path: 'src/cli' }], 'src/client/x.ts'), null);
});
test('rename rewrites the alias, imports into the moved folder and keeps valid specifiers', () => {
  const rename = { fromPath: 'src/util', toPath: 'src/helpers', fromAlias: '#util/', toAlias: '#helpers/' };
  assert.equal(renamedSpecifier('src/cli/app.ts', '#util/index.ts', rename, aliases), '#helpers/index.ts');
  assert.equal(renamedSpecifier('src/cli/app.ts', '../util/index.ts', rename, aliases), '../helpers/index.ts');
  assert.equal(renamedSpecifier('tooling/x/run.mjs', '../../src/util/a/b.ts?raw', rename, aliases), '../../src/helpers/a/b.ts?raw');
  // Inside the moved folder, relative imports to itself and to other projects stay valid at the same depth.
  assert.equal(renamedSpecifier('src/util/a/b.ts', '../index.ts', rename, aliases), null);
  assert.equal(renamedSpecifier('src/util/index.ts', '../shared/hash.ts', rename, aliases), null);
  assert.equal(renamedSpecifier('src/cli/app.ts', '#shared/x.ts', rename, aliases), null);
  assert.equal(renamedSpecifier('src/cli/app.ts', 'vue', rename, aliases), null);
});
test('module specifiers come from the syntax tree with exact offsets, including Vue script blocks', async () => {
  const parsers = await loadSpecifierParsers();
  const text = "// import x from '../nope.ts'\nimport a from './a.ts';\nexport * from \"#util/b.ts\";\nconst c = await import('./c.ts');\nconst s = \"import('./d.ts')\";\nconst u = new URL('../e.json', import.meta.url);\ntype T = import('./f.ts').F;\n";
  const found = moduleSpecifiers('src/x/y.ts', text, parsers);
  assert.deepEqual(found.map(item => item.specifier), ['./a.ts', '#util/b.ts', './c.ts', '../e.json', './f.ts']);
  for (const item of found) assert.equal(text.slice(item.start, item.end), item.specifier);
  const vue = '<template><div /></template>\n<script setup lang="ts">\nimport { x } from "../util/x.ts";\n</script>\n';
  const [spec] = moduleSpecifiers('src/x/V.vue', vue, parsers);
  assert.equal(vue.slice(spec.start, spec.end), '../util/x.ts');
});
test('the bundled CLI reads SFC script blocks at the same offsets as the Vue compiler the boundary gate uses', async () => {
  const ts = (await import('typescript')).default, { parse } = await import('vue/compiler-sfc');
  const sfc = '<script lang="ts">\nexport default { name: "A" };\nimport a from "./a.ts";\n</script>\n<template><p>{{ x }}</p></template>\n<script setup lang="ts">\nimport { x } from "#util/x.ts";\nconst y = await import("../y.ts");\n</script>\n<style>.a{}</style>\n';
  const vue = moduleSpecifiers('src/x/A.vue', sfc, { ts, parseSfc: parse });
  assert.deepEqual(moduleSpecifiers('src/x/A.vue', sfc, await loadSpecifierParsers()), vue);
  assert.deepEqual(vue.map(item => item.specifier), ['./a.ts', '#util/x.ts', '../y.ts']);
});
