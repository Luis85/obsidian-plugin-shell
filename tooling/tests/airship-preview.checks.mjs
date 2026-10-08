import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { inspectorPlugin } from '../airship/inspector.mjs';
const root = process.cwd(), file = resolve(root, 'product source/generated/Page.vue');
const plugin = inspectorPlugin(root, 'product source/generated');
test('Vue SFC source metadata uses original file/line/column; interpolations, directives and nested components remain source', () => {
  const source = '<script setup lang="ts">\nconst label = "<not a tag>";\n</script>\n<template>\n  <section v-if="label"><UButton>\n    <span>{{ label }}</span>\n  </UButton></section>\n</template>\n<style scoped>.x::before { content: "<span>"; }</style>';
  const changed = plugin.transform(source, file);
  assert.ok(changed);
  assert.match(changed.code, /data-v-inspector="product source\/generated\/Page.vue:5:3"/);
  assert.match(changed.code, /data-v-inspector="product source\/generated\/Page.vue:6:5"/);
  assert.ok(changed.code.includes('const label = "<not a tag>"'));
  assert.ok(changed.code.includes('content: "<span>"'));
  assert.equal(plugin.apply, 'serve');
});
test('vendor, external, queried and non-SFC inputs are not instrumented', () => {
  for (const id of [resolve(root, 'node_modules/@nuxt/ui/Button.vue'), resolve(root, '../Other.vue'), file + '?vue&type=template', file + '.ts']) {
    assert.equal(plugin.transform('<template><div>Example</div></template>', id), null);
  }
});
test('explicit source-location attributes and template/slot directives are not duplicated', () => {
  const source = '<template><div data-v-inspector="authored:1:1"><template #default><slot /></template></div></template>';
  assert.equal(plugin.transform(source, file), null);
});
