import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { journeyFlow } from '../../scripts/bundling/journey-flow.mjs';
import { licenseNotices } from '../../scripts/bundling/license-notices.mjs';
const root = new URL('../../', import.meta.url);
const source = path => readFileSync(new URL(path,root),'utf8');

test('the reviewed Flow runtime links the same Vue module without creating a window global', () => {
  const plugin=journeyFlow(),javascript=plugin.load(plugin.resolveId('virtual:journey-flow'));
  assert.ok(javascript.startsWith("import * as Vue from 'vue';\n"));
  assert.ok(javascript.endsWith('\nexport default VueFlowCore;\n'));
  const Vue=vm.runInThisContext(source('docs/concepts/companion/vendor/vue.runtime.global.prod.js')+';Vue;');
  // Execute the hash-checked, retained vendor fixture, not imported project code.
  const context=vm.createContext({Vue,console,setTimeout,clearTimeout,setInterval,clearInterval});
  const body=javascript.replace("import * as Vue from 'vue';\n",'').replace('\nexport default VueFlowCore;\n','\nVueFlowCore;');
  const Flow=vm.runInContext(body,context);
  assert.equal(typeof Flow.useVueFlow,'function');assert.ok(Flow.VueFlow);assert.ok(Flow.Handle);
  assert.equal(context.window,undefined);assert.equal(context.Vue,Vue);
  assert.equal(plugin.resolveId('unrelated-import'),undefined);assert.equal(plugin.load('unrelated-module'),undefined);
});
test('reviewed Flow stylesheet is scoped to every owned editor, not a singleton DOM id', () => {
  const plugin=journeyFlow(),css=plugin.load(plugin.resolveId('virtual:journey-flow.css'));
  assert.ok(css.includes('.journey-lens-root .vue-flow__container'));assert.ok(!css.includes('#vf-root'));
});
test('runtime and stylesheet tampering fail before the retained bundle is exposed',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'journey-vendor-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const vendor=join(dir,'docs/concepts/companion/vendor');await mkdir(vendor,{recursive:true});
  const plugin=journeyFlow(dir);
  await writeFile(join(vendor,'vue-flow-core.iife.js'),source('docs/concepts/companion/vendor/vue-flow-core.iife.js')+'\n// altered');
  await writeFile(join(vendor,'vue-flow.scoped.css'),source('docs/concepts/companion/vendor/vue-flow.scoped.css')+'\n/* altered */');
  assert.throws(()=>plugin.load('\0virtual:journey-flow'),/JOURNEY_FLOW_RUNTIME_DRIFT/);
  assert.throws(()=>plugin.load('\0virtual:journey-flow.css'),/JOURNEY_FLOW_STYLES/);
});
test('a bundled Flow entry retains its own reviewed notices in the actual JS artifact',()=>{
  const bundle={entry:{type:'chunk',isEntry:true,modules:{'\0virtual:journey-flow':{}},code:'const entry = true;'}};
  licenseNotices().generateBundle({},bundle);
  assert.ok(bundle.entry.code.includes('(retained reviewed bundle)'));
  for(const file of ['vue-flow-core-LICENSE.txt','d3-NOTICE.txt','vueuse-NOTICE.txt']){
    const text=source('docs/concepts/companion/vendor/'+file).trim();assert.ok(bundle.entry.code.includes(text.replaceAll('*/','* /')));
  }
  assert.ok(bundle.entry.code.endsWith('const entry = true;'));
});
