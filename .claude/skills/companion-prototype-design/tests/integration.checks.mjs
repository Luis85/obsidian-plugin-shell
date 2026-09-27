/** Dependency-free adapter/build boundary tests; actual repository checks live in tests/tooling. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPrototypeAuthority } from '../scripts/lib/framework.mjs';
import { prototypeBuildConfig } from '../scripts/lib/build-worker.mjs';
import { singleBundle } from '../scripts/lib/build-output.mjs';
import { assemble } from '../scripts/build-single-file.mjs';
import { main } from '../scripts/prototype.mjs';

const request = (command, options = {}, args = []) => ({ command, args, options });
test('prototype adapter keeps read/plan requests but defaults processes to dry-run', () => {
  for (const effect of ['process', 'plan']) {
    const value = request(effect === 'plan' ? 'new' : 'build');
    const checked = checkPrototypeAuthority(value, { effect }, false);
    assert.equal(Boolean(checked.options['dry-run']), effect === 'process');
  }
  const value = request('project inspect', { input: 'project.json' });
  assert.deepEqual(checkPrototypeAuthority(value, { effect: 'read' }, false), value);
  assert.deepEqual(checkPrototypeAuthority(request('make', {}, ['list']), { effect: 'plan' }, false), request('make', {}, ['list']));
});
test('prototype adapter requires exact hash and explicit execution for writes', () => {
  for (const value of [request('generate', { yes: true }), request('generate', { apply: 'a'.repeat(64) }),
    request('generate', { 'plan-out': 'file.json' }), request('plan apply', {}, ['plan.json']), request('data reset')]) {
    assert.throws(() => checkPrototypeAuthority(value, { effect: 'plan' }, false), /PROTOTYPE_APPROVAL/);
  }
  const value = request('generate', { apply: 'a'.repeat(64) });
  assert.deepEqual(checkPrototypeAuthority(value, { effect: 'plan' }, true), value);
  assert.throws(() => checkPrototypeAuthority(request('generate', { yes: true }), { effect: 'plan' }, true), /exact --apply/);
  assert.deepEqual(checkPrototypeAuthority(request('install', { yes: true }), { effect: 'process' }, true), request('install', { yes: true }));
});
test('prototype adapter never widens authority to native hosts, releases or executable custom makers', () => {
  for (const value of [request('release operate'), request('plugin install'), request('dev'), request('framework upgrade'),
    request('test', { profile: 'obsidian' }), request('test', { profile: 'native' }), request('make', { 'trust-custom': true }),
    request('new', { install: true }), request('build', { root: '../other' }), request('project import', { input: '-' })]) {
    assert.throws(() => checkPrototypeAuthority(value, { effect: 'plan' }, true), /PROTOTYPE_/);
  }
});
test('prototype entrypoint rejects unrelated flags instead of silently ignoring them', async () => {
  for (const argv of [['discover', '--repo', '.', '--execute'], ['new', '--repo', '.', '--replace'], ['save', '--repo', '.', '--entry', 'x'],
    ['build', '--repo', '.', '--', 'extra'], ['pack', '--root', '.', '--script', 'x'], ['unsupported']]) {
    await assert.rejects(main(argv));
  }
});
test('prototype build retains shared plugins/styles and rejects all native imports', () => {
  const sharedPlugin = { name: 'shared' }, css = { postcss: { plugins: ['scope'] } }, license = { name: 'licenses' };
  const config = prototypeBuildConfig({ shared: { plugins: [sharedPlugin], css, build: { target: 'es2022' } }, entry: '/source/main.ts', licenses: license });
  assert.equal(config.css, css); assert.equal(config.plugins[1], sharedPlugin); assert.equal(config.plugins.at(-1), license);
  assert.equal(config.configFile, false); assert.equal(config.build.write, false); assert.equal(config.build.target, 'es2022');
  assert.deepEqual(config.build.lib.formats, ['iife']); assert.equal(config.build.rolldownOptions.output.inlineDynamicImports, true);
  for (const name of ['obsidian', 'node:fs', 'fs', 'child_process']) assert.throws(() => config.plugins[0].resolveId(name), /HOST_IMPORT/);
  assert.equal(config.plugins[0].resolveId('vue'), undefined);
});
const bundle = () => ({ output: [{ type: 'chunk', fileName: 'prototype.js', isEntry: true, imports: [], dynamicImports: [], code: 'void 0;',
  modules: Object.fromEntries(['@vue/runtime-dom/index.js', 'pinia/index.js', '@nuxt/ui/button.js'].map(name => ['/workspace/node_modules/' + name, { renderedLength: 10 }])) },
  { type: 'asset', fileName: 'prototype.css', source: '.ps--test{color:red}' }] });
test('bundle gate requires actually rendered Vue, Pinia, Nuxt UI and one embedded stylesheet', () => {
  assert.equal(singleBundle(bundle()).modules.length, 3);
  for (const adjust of [b => { b.output[0].imports.push('vue'); }, b => { b.output[0].dynamicImports.push('lazy.js'); },
    b => { b.output.push({ type: 'asset', fileName: 'image.svg' }); }, b => { b.output[1].fileName = 'font.woff'; },
    b => { b.output[0].modules['/workspace/node_modules/pinia/index.js'].renderedLength = 0; }]) {
    const value = bundle(); adjust(value); assert.throws(() => singleBundle(value), /PROTOTYPE_/);
  }
});
test('assembled artifact has the exact shell CSS owner and rejects malformed identities', () => {
  const project = { kind: 'obsidian-companion-project', executable: false, project: { id: 'notes-lab' } };
  const options = { javascript: 'void 0;', css: '.ps--notes-lab{color:red}', title: 'Notes', projectBytes: Buffer.from(JSON.stringify(project)) };
  assert.match(assemble(options), /class="prototype-root ps--notes-lab" data-plugin-ui="notes-lab"/);
  project.project.id = 'x" onclick="bad';
  assert.throws(() => assemble({ ...options, projectBytes: Buffer.from(JSON.stringify(project)) }), /CSS identity/);
});
