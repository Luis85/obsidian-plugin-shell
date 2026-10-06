import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { mountPrototypes } from '../../src/companion/editor/prototype-manager.ts';
import { prototypeView } from '../../src/companion/editor/prototype-view.ts';
import { api, document, workspace, main, alternate, activate, fork } from '../../tests/support/prototype-fixture.mjs';

// Minimal render port, not a browser substitute. Exercise the actual manager's initial
// selection and pure view; browser-origin/style behavior remains in the browser suite.
function render(w, opened) {
  const root = { innerHTML:'', classList:{add(){}}, addEventListener(){}, removeEventListener(){},
    querySelectorAll(){return [];}, replaceChildren(){this.innerHTML='';} };
  let writes = 0;
  const host = { read:()=>({workspace:w,working:document(),opened,writable:true}),
    save(){writes++;}, open(){writes++;}, confirm(){return true;} };
  const view = mountPrototypes(root,host), html = root.innerHTML;
  view.unmount(); assert.equal(writes,0); return html;
}
const selected = (html,key)=>assert.ok(html.includes(`data-key="${key}" data-index="${key.endsWith('sitemap-b')?'0,0,1':'0,0,0'}" aria-current="true"`));

test('merged manager restores a valid opened variant without replacing the active generator source',()=>{
  const w=fork(activate(workspace())),before=structuredClone(w);
  selected(render(w,alternate),api.selectionKey(alternate));assert.deepEqual(w,before);assert.deepEqual(w.active,main);
});
test('stale opened context falls back to the valid active snapshot instead of breaking the panel',()=>{
  selected(render(fork(activate(workspace())),{...alternate,variantId:'missing'}),api.selectionKey(main));
});
test('stale opened context without activation safely falls back to the first saved variant',()=>{
  selected(render(workspace(),{...main,prototypeId:'missing'}),api.selectionKey(main));
});
test('an empty workspace with stale editor context still renders the create action without writes',()=>{
  const html=render(api.empty('design-lab'),main);assert.match(html,/Explore more than one solution/);assert.match(html,/Create first prototype/);
});
test('empty-path placeholder remains text while comparison and recovery controls stay available',()=>{
  const html=prototypeView({workspace:api.empty('design-lab'),working:document(),opened:null,writable:true},null,'','',false,false);
  assert.match(html,/docs\/concepts\/&lt;prototype-name&gt;\//);assert.ok(!html.includes('<prototype-name>'));
  const w=api.change(fork(activate(workspace())),{type:'save',selection:alternate,document:document('Sitemap B')});
  const compared=prototypeView({workspace:w,working:document(),opened:alternate,writable:true},alternate,'','',false,false,{query:'',status:'all'},api.selectionKey(main));
  assert.match(compared,/data-pm="restore-snapshot">/);assert.match(compared,/data-pm-query/);
});
test('scoped style ancestor and theme border fix coexist with upstream persisted-plan invalidation',()=>{
  const bridge=readFileSync(new URL('../concepts/prototype-bridge.js',import.meta.url),'utf8');
  assert.match(bridge,/<section class="ps--plugin-shell" data-plugin-ui="plugin-shell"><div id="pm-root"><\/div><\/section>/);
  assert.ok(bridge.indexOf('state.generator.plan=null;designUi.plan=null;')<bridge.indexOf('try{pmPreflight();if(!saveConceptState())'));
  const css=readFileSync(new URL('../../src/companion/editor/prototypes.css',import.meta.url),'utf8');
  assert.ok(!css.includes('var(--border,'));assert.match(css,/\.pm-comparison/);assert.match(css,/\.pm-filters/);
});
