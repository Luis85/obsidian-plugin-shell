import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, access } from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const config=JSON.parse(await readFile(new URL('.fallowrc.json',root),'utf8'));
// Configuration consistency only. The unchanged full analyzer gate separately executes the pinned Fallow binary.
test('build and prototype helpers have activating detection and support/test roles, not invented runtime roots', async ()=> {
  for(const [name,role] of [['prototype-build-tools','support'],['prototype-build-tests','test']]) {
    const plugin=config.framework.find(item=>item.name===name);
    assert.ok(plugin);assert.equal(plugin.entryPointRole,role);
    assert.equal(plugin.detection.type,'fileExists');await access(new URL(plugin.detection.pattern,root));
    for(const path of plugin.entryPoints){await access(new URL(path,root));assert.equal(config.entry.includes(path),false,path);}
  }
  assert.ok(config.framework.find(item=>item.name==='prototype-build-tools').entryPoints.includes('scripts/concepts/build-mvp.mjs'));
});
test('runtime and dependency gates remain enabled without ignoring the CSS compiler dependency',()=> {
  assert.ok(config.entry.includes('src/main.ts'));
  assert.equal(config.ignoreDependencies.includes('postcss-selector-parser'),false);
  assert.notEqual(config.rules['dev-dependencies-in-production'],'off');
  assert.notEqual(config.rules['unused-file'],'off');
  assert.equal(config.boundaries.coverage.requireAllFiles,true);
});

test('typed JSON data contract is an explicit narrow architecture boundary', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-data-contract');
  assert.deepEqual(zone?.patterns, ['scripts/contracts/json-data.ts']);
  const own = config.boundaries.rules.find(item => item.from === 'cli-data-contract');
  assert.deepEqual(own?.allow, ['cli-data-contract']);
  for (const source of ['test', 'tooling', 'maker-host', 'companion-authoring-contract', 'fixture-compiler']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-data-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-data-contract'), false);
});

test('canonical CLI result envelope is isolated from implementation layers', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-result-contract');
  assert.deepEqual(zone?.patterns, ['scripts/contracts/result.ts', 'scripts/contracts/errors.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-result-contract')?.allow, ['cli-result-contract']);
  for (const source of ['test', 'tooling', 'maker-host']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-result-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-result-contract'), false);
});

test('shared Node process primitive is isolated behind the tooling adapter', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-process-contract');
  assert.deepEqual(zone?.patterns, ['scripts/shared/process.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-process-contract')?.allow, ['cli-process-contract']);
  for (const source of ['test', 'tooling']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-process-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-process-contract'), false);
});

test('typed file-plan runtime is isolated behind bounded concurrency and filesystem contracts', () => {
  const concurrency = config.boundaries.zones.find(item => item.name === 'cli-bounded-map-contract');
  assert.deepEqual(concurrency?.patterns, ['scripts/shared/bounded-map.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-bounded-map-contract')?.allow, ['cli-bounded-map-contract']);
  const zone = config.boundaries.zones.find(item => item.name === 'cli-file-plan-contract');
  assert.deepEqual(zone?.patterns, ['scripts/shared/file-plan-types.ts', 'scripts/shared/file-plan.ts', 'scripts/shared/file-plan-runtime.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-file-plan-contract')?.allow,
    ['cli-file-plan-contract', 'cli-bounded-map-contract', 'cli-files-contract']);
  for (const source of ['test', 'tooling', 'maker-host']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-file-plan-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-file-plan-contract'), false);
});

test('shared input transport is isolated and depends only on CLI error contracts', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-input-contract');
  assert.deepEqual(zone?.patterns, ['scripts/shared/input.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-input-contract')?.allow, ['cli-input-contract', 'cli-result-contract']);
  for (const source of ['test', 'tooling', 'maker-host']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-input-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-input-contract'), false);
});

test('typed filesystem primitives are isolated from application layers', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-files-contract');
  assert.deepEqual(zone?.patterns, ['scripts/shared/hash.ts', 'scripts/shared/fs-presence.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-files-contract')?.allow, ['cli-files-contract']);
  for (const source of ['test', 'tooling']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-files-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-files-contract'), false);
});


test('typed project-path policy is isolated from implementation layers', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'project-path-contract');
  assert.deepEqual(zone?.patterns, ['scripts/shared/project-path.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'project-path-contract')?.allow, ['project-path-contract']);
  for (const source of ['test', 'tooling', 'maker-domain', 'maker-host']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('project-path-contract'), source);
  }
});


test('typed bounded concurrency helper is isolated from implementation layers', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-bounded-map-contract');
  assert.deepEqual(zone?.patterns, ['scripts/shared/bounded-map.ts']);
  assert.deepEqual(config.boundaries.rules.find(item => item.from === 'cli-bounded-map-contract')?.allow, ['cli-bounded-map-contract']);
  for (const source of ['test', 'tooling']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-bounded-map-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-bounded-map-contract'), false);
});

test('legacy core entries remain compatibility-only shims over typed owners', async () => {
  const wrappers = new Map([
    ['scripts/contracts/json-data.mjs', './json-data.ts'],
    ['scripts/shared/process.mjs', './process.ts'],
    ['scripts/shared/confirmation.mjs', './confirmation.ts'],
    ['scripts/shared/hash.mjs', './hash.ts'],
    ['scripts/shared/fs-presence.mjs', './fs-presence.ts'],
    ['scripts/shared/project-path.mjs', './project-path.ts'],
    ['scripts/shared/bounded-map.mjs', './bounded-map.ts'],
    ['scripts/shared/file-plan.mjs', './file-plan.ts'],
  ]);
  for (const [path, target] of wrappers) {
    const source = await readFile(new URL(path, root), 'utf8');
    const executable = source.split('\n').map(line => line.trim())
      .filter(line => line && !line.startsWith('//'));
    assert.deepEqual(executable, [`export * from '${target}';`], path);
  }
});
