/** Actual pinned Vue/Pinia/Nuxt UI compilation; explicit prerequisites, never a substitute bundle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPrototype } from '../../.claude/skills/companion-prototype-design/scripts/build-prototype.mjs';
import { checkHtml } from '../../.claude/skills/companion-prototype-design/scripts/lib/offline.mjs';
import { starterDocument } from '../support/starter-documents.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const available = ['vite', 'typescript', 'vue', 'pinia', '@nuxt/ui'].every(name => fs.existsSync(path.join(root, 'node_modules', name, 'package.json')));
test('real shared pipeline compiles a Nuxt UI button backed by Pinia into one offline HTML', {
  skip: !available && 'Install the repository lockfile to exercise actual Vite/Nuxt UI compilation', timeout: 120000,
}, async t => {
  const scratch = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'prototype-real-build-'));
  const suffix = path.basename(scratch).replace(/[^a-z0-9]/gi, '');
  const harness = path.join(root, 'harness/prototype', suffix);
  const component = path.join(root, `src/presentation/components/PrototypeFixture${suffix}.vue`);
  fs.mkdirSync(harness, { recursive: true });
  t.after(() => { fs.rmSync(scratch, { recursive: true, force: true }); fs.rmSync(harness, { recursive: true, force: true }); fs.rmSync(component, { force: true }); });
  fs.writeFileSync(component, `<script setup lang="ts">\nimport UButton from '@nuxt/ui/components/Button.vue';\nimport { defineStore } from 'pinia';\nconst useCounter = defineStore('prototype-check', { state: () => ({ count: 0 }), actions: { increment() { this.count++; } } });\nconst counter = useCounter();\n</script>\n<template><section><h1>Prototype pipeline fixture</h1><UButton @click="counter.increment">Increment</UButton><output>{{ counter.count }}</output></section></template>\n`, { flag: 'wx' });
  const componentImport = path.relative(harness, component).split(path.sep).join('/');
  const entry = path.join(harness, 'main.ts');
  fs.writeFileSync(entry, `import { createApp, nextTick } from 'vue';\nimport { createPinia } from 'pinia';\nimport ui from '@nuxt/ui/vue-plugin';\nimport Root from ${JSON.stringify(componentImport)};\nimport '../../../src/styles/app.css';\nconst app = createApp(Root); app.use(createPinia()); app.use(ui); app.mount('#prototype-app');\nvoid nextTick(() => { document.documentElement.dataset.prototypeReady = 'true'; });\n`);
  const design = starterDocument('blank');
  design.project.id = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).id;
  const input = path.join(scratch, 'project.json'), output = path.join(scratch, 'prototype.html');
  fs.writeFileSync(input, JSON.stringify(design));
  const result = await buildPrototype({ repo: root, entry, project: input, out: output, title: 'Pipeline fixture' });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  assert.equal(result.data.status, 'built-not-browser-verified');
  assert.ok(result.data.bundledModules.some(name => name.startsWith('pinia/')));
  const html = fs.readFileSync(output, 'utf8'); assert.deepEqual(checkHtml(html), []);
  assert.match(html, /Plugin Shell — bundled dependency notices/);
  const embedded = JSON.parse(html.match(/id="prototype-project-data" type="application\/json">([^<]+)</)[1]);
  assert.equal(Buffer.from(embedded.content, 'base64').toString(), fs.readFileSync(input, 'utf8'));
  // An invalid next build cannot destroy the last good artifact.
  fs.writeFileSync(entry, "import { readFileSync } from 'node:fs'; console.log(readFileSync);\n");
  const failed = await buildPrototype({ repo: root, entry, project: input, out: output, title: 'Invalid', replace: true });
  assert.equal(failed.status, 'failed'); assert.equal(fs.readFileSync(output, 'utf8'), html);
});
