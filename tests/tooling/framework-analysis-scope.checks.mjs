import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, access, readdir } from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const config=JSON.parse(await readFile(new URL('configs/quality/fallow.json',root),'utf8'));
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
  for (const source of ['test', 'tooling', 'maker-host', 'companion-authoring-contract', 'compiler-host']) {
    assert.ok(config.boundaries.rules.find(item => item.from === source)?.allow.includes('cli-data-contract'), source);
  }
  assert.equal(config.boundaries.rules.find(item => item.from === 'maker-domain')?.allow.includes('cli-data-contract'), false);
});

test('companion code emitters own a zone that may read the project templates; compiler-host may not', () => {
  const rule = name => config.boundaries.rules.find(item => item.from === name)?.allow;
  assert.deepEqual(config.boundaries.zones.find(item => item.name === 'compiler-emitters')?.patterns, ['bin/compiler/emitters/**']);
  assert.deepEqual(rule('compiler-emitters'), ['compiler-emitters', 'compiler-domain', 'companion-authoring-contract', 'project-templates', 'cli-serialization-contract']);
  for (const source of ['compiler-host', 'maker-host', 'test', 'tooling']) assert.ok(rule(source)?.includes('compiler-emitters'), source);
  assert.equal(rule('compiler-host')?.includes('project-templates'), false);
  for (const core of ['compiler-domain', 'compiler-application', 'maker-domain', 'maker-application']) assert.equal(rule(core)?.includes('compiler-emitters'), false, core);
});

test('the compiler reaches tooling only through named narrow contracts, never the whole tooling zone', () => {
  const rule = name => config.boundaries.rules.find(item => item.from === name)?.allow;
  for (const source of ['compiler-host', 'compiler-emitters']) assert.equal(rule(source)?.includes('tooling'), false, source);
  assert.deepEqual(config.boundaries.zones.find(item => item.name === 'cli-serialization-contract')?.patterns, ['scripts/contracts/serialization.ts']);
  assert.deepEqual(rule('cli-serialization-contract'), ['cli-serialization-contract']);
  // A zone listed after tooling would never match: scripts/** claims the file first.
  const order = config.boundaries.zones.map(item => item.name);
  assert.ok(order.indexOf('cli-serialization-contract') < order.indexOf('tooling'));
  for (const source of ['compiler-emitters', 'maker-host', 'test', 'tooling']) assert.ok(rule(source)?.includes('cli-serialization-contract'), source);
  assert.ok(rule('maker-host')?.includes('companion-test-kit'), 'maker fixtures read the companion test kit');
});

test('canonical CLI result envelope is isolated from implementation layers', () => {
  const zone = config.boundaries.zones.find(item => item.name === 'cli-result-contract');
  assert.deepEqual(zone?.patterns, ['scripts/contracts/result-runtime.mjs', 'scripts/contracts/result.ts', 'scripts/contracts/errors.ts']);
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

test('retired compatibility modules are absent and canonical implementations exist', async () => {
  const owners = JSON.parse(await readFile(new URL('tests/fixtures/tooling/retired-module-owners.json', root), 'utf8'));
  for (const [retired, owner] of Object.entries(owners)) {
    await assert.rejects(access(new URL(retired, root)), { code: 'ENOENT' }, retired);
    await access(new URL(owner, root));
  }
});

test('framework typechecking includes the production CLI rather than removed wrappers', async () => {
  const types = JSON.parse(await readFile(new URL('configs/types/tsconfig.framework.json', root), 'utf8'));
  assert.ok(types.include.includes('../../bin/**/*.ts'));
  assert.ok(!types.include.includes('../../scripts/framework/**/*.ts'));
  // The release bundler was the folder's last module; scripts/framework no longer exists.
  await assert.rejects(readdir(new URL('scripts/framework/', root)), { code: 'ENOENT' });
});

test('scripts/companion holds only the companion contract library; its tooling entries and bin-only readers left it', async () => {
  const config = JSON.parse(await readFile(new URL('configs/quality/fallow.json', root), 'utf8'));
  const patterns = config.boundaries.zones.find(zone => zone.name === 'companion-authoring-contract').patterns;
  const inZone = path => patterns.some(pattern => pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : pattern === path);
  const sources = (await readdir(new URL('scripts/companion/', root), { recursive: true }))
    .map(name => 'scripts/companion/' + name.replaceAll('\\', '/')).filter(path => /\.(?:mjs|ts)$/.test(path) && !path.endsWith('.d.mts'));
  assert.deepEqual(sources.filter(path => !inZone(path)), []);
  for (const path of sources) assert.doesNotMatch(await readFile(new URL(path, root), 'utf8'), /from\s*['"](?:\.\.\/)+bin\//, path);
});
