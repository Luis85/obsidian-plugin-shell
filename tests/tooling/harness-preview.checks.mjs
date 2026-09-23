import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from '../../vite.harness.config.mjs';

test('harness preview serves emitted artifacts without invoking source-generation plugins', async () => {
  const preview = await config({ command: 'serve', mode: 'production', isPreview: true });
  assert.equal(preview.build.outDir, 'dist-harness');
  assert.deepEqual(preview.plugins ?? [], []);
  const build = await config({ command: 'build', mode: 'production', isPreview: false });
  const plugins = build.plugins.flat(Infinity);
  assert.ok(plugins.some(plugin => plugin.name === 'plugin-shell-static-ui'));
  assert.ok(plugins.some(plugin => plugin.name === 'nuxt:ui:templates'));
  assert.ok(plugins.some(plugin => plugin.name === 'fixture-host-styles' && typeof plugin.generateBundle === 'function'));
  assert.equal(build.build.outDir, 'dist-harness');
});
