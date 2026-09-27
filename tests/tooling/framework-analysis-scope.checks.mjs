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
