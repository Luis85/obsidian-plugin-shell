// Increment: [[docs/increments/nuxt-ui-4-12-0]]
// AC-2: The prototype bundle gate accepts a lazy import the bundler inlined into the entry chunk and still rejects any second file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { singleBundle } from '../../../.claude/skills/companion-prototype-design/scripts/lib/build-output.mjs';

const modules = Object.fromEntries(['@vue/runtime-dom/index.js', 'pinia/index.js', '@nuxt/ui/button.js']
  .map(name => ['/workspace/node_modules/' + name, { renderedLength: 10 }]));
const entry = (dynamicImports = []) => ({ type: 'chunk', fileName: 'prototype.js', isEntry: true, imports: [], dynamicImports, code: 'void 0;', modules });
const css = { type: 'asset', fileName: 'prototype.css', source: '.ps--test{color:red}' };
const bundle = (...output) => ({ output: [...output, css] });
const REJECTED = /PROTOTYPE_BUNDLE: all JavaScript must be in the single entry/;

test('[AC-2] the entry chunk listing itself as a dynamic import target is one file', () => {
  assert.equal(singleBundle(bundle(entry(['prototype.js']))).modules.length, 3);
});

test('[AC-2] any other dynamic import target, alone or beside the entry, is rejected', () => {
  for (const targets of [['lazy.js'], ['prototype.js', 'lazy.js'], ['chunks/toast.js']])
    assert.throws(() => singleBundle(bundle(entry(targets))), REJECTED, targets.join(', '));
});

test('[AC-2] a static import or a second chunk is still rejected', () => {
  const withStatic = entry(); withStatic.imports.push('vue');
  assert.throws(() => singleBundle(bundle(withStatic)), REJECTED);
  const second = { ...entry(), fileName: 'toast.js', isEntry: false };
  assert.throws(() => singleBundle(bundle(entry(['toast.js']), second)), /PROTOTYPE_BUNDLE/);
});
