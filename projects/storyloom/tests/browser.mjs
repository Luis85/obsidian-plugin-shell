/**
 * Browser verification of this project's built prototype (dist/). It opens the real self-contained HTML from disk in
 * Chromium with every external HTTP(S) request blocked, then exercises the shared shell against the real editor:
 * offline boot, import of a real family package from the other three tools, the shared import dialog, links,
 * independent reload persistence and the export download. Run `npm run build` first.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {APP} from '../app.config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executablePath=process.env.FAMILY_CHROMIUM_PATH||undefined;
const example=JSON.parse(await fs.readFile(path.join(root,'examples/product-family-example.json'),'utf8'));
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader']});
const context=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});
const errors=[],requests=[],checks=[];
const pass=(name,details={})=>{checks.push({name,...details});console.log('PASS',name,JSON.stringify(details));};
const boot=async page=>page.waitForFunction(()=>window.ProductFamily?.getSnapshot(),null,{timeout:12000});
await context.route(/^https?:/,async route=>{requests.push(route.request().url());await route.abort();});
const app=APP.appId,foreign=example.entities.filter(e=>e.source.appId!==app);
try{
  const p=await context.newPage();p.on('pageerror',e=>errors.push({app,message:e.message}));
  await p.goto(pathToFileURL(path.join(root,'dist',APP.file)).href);await boot(p);
  const native=await p.evaluate(()=>window.ProductFamily.rpc('exportNative'));
  const snap=await p.evaluate(()=>window.ProductFamily.getSnapshot());assert.equal(snap.appId,app);assert(snap.entities.length>0);
  const inspected=await p.evaluate(data=>window.ProductFamily.rpc('inspectNative',data),native);assert.equal(inspected.workspace.id,snap.workspace.id);
  pass(app+' boots offline with a genuine Nuxt UI shell',{entities:snap.entities.length,workspace:snap.workspace.id});

  // Context from the other three tools imports as source-owned snapshots without touching this editor's native data.
  const summary=await p.evaluate(text=>window.ProductFamily.review(text),JSON.stringify(example));assert(summary.added>0);
  const registry=await p.evaluate(pack=>window.ProductFamily.importPackage(pack),example);
  for(const source of new Set(foreign.map(e=>e.source.appId)))assert(registry.records.some(e=>e.source.appId===source),source+' records were not imported');
  assert.deepEqual(await p.evaluate(()=>window.ProductFamily.rpc('exportNative')),native);
  pass('Family package from the other tools imports without mutating the native owner',{added:summary.added,records:registry.records.length});

  if(['storyloom','dissect'].includes(app)){
    const atlasUI=example.entities.find(e=>e.id==='ui-project-card'&&e.source.appId==='component-atlas');assert(atlasUI);
    const atlasNative=example.natives.find(n=>n.source.appId==='component-atlas').data;
    const cap=await p.evaluate(e=>window.ProductFamily.rpc('canAdopt',e),atlasUI);assert(cap.allowed,cap.hint);
    const result=await p.evaluate(({entity,native})=>window.ProductFamily.rpc('adopt',{entity,native}),{entity:atlasUI,native:atlasNative});assert(result.entityId);
    assert((await p.evaluate(()=>window.ProductFamily.getSnapshot())).entities.some(e=>e.id===result.entityId));
    const pack=await p.evaluate(()=>window.ProductFamily.makePackage());assert(pack.entities.some(e=>e.id===result.entityId&&e.source.appId===app));
    pass(app+' adopts a real Component Atlas UI definition into a locally owned entity',{entityId:result.entityId});
  }

  // The shared import dialog rejects an unsupported schema, then reviews and applies a valid package.
  await p.getByRole('button',{name:'Import',exact:true}).click();
  await p.locator('#package-json').fill('{"format":"obsidian-product-family","schemaVersion":99}');
  await p.getByRole('button',{name:'Review package',exact:true}).click();
  assert.match(await p.getByRole('dialog').innerText(),/Unsupported Product Family schema/);
  await p.locator('#package-json').fill(JSON.stringify(example));
  await p.getByRole('button',{name:'Review package',exact:true}).click();
  await p.getByRole('button',{name:'Import context',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('[role=dialog]'));
  pass('Shared import dialog validates, reviews, and applies a real source package');

  if(app==='storyloom'){
    // A package whose native backup claims another workspace identity is rejected before any restore.
    const backup=await p.evaluate(()=>window.ProductFamily.makePackage());
    const mismatch=structuredClone(backup);const own=mismatch.natives.find(n=>n.source.appId===app&&n.source.workspaceId===mismatch.source.workspaceId);
    own.data.data.extraFrontmatter.product_family_workspace_id='mismatched-native-workspace';
    const baseline=await p.evaluate(()=>window.ProductFamily.rpc('exportNative'));
    await p.getByRole('button',{name:'Import',exact:true}).click();await p.locator('#package-json').fill(JSON.stringify(mismatch));await p.getByRole('button',{name:'Review package',exact:true}).click();
    await p.locator('#import-mode').click();await p.getByRole('option',{name:'Restore this editor’s native workspace backup',exact:true}).click();
    await p.getByRole('button',{name:'Restore workspace',exact:true}).click();
    await p.getByRole('dialog').getByText(/identity does not match/).waitFor();assert.deepEqual(await p.evaluate(()=>window.ProductFamily.rpc('exportNative')),baseline);
    await p.getByRole('button',{name:'Cancel',exact:true}).click();pass('Mismatched native identity is rejected before mutation');
  }

  // A link from a local record to imported context is exported and stays idempotent on repeated import.
  const local=(await p.evaluate(()=>window.ProductFamily.makePackage())).entities.find(e=>e.source.appId===app),target=foreign[0];
  await p.evaluate(({from,to})=>window.ProductFamily.link(from,to,'relates-to'),{from:local.ref,to:target.ref});
  const linked=await p.evaluate(()=>window.ProductFamily.makePackage());assert(linked.links.some(l=>l.to===target.ref));
  const links=(await p.evaluate(()=>window.ProductFamily.getRegistry())).links.length;
  await p.evaluate(pack=>window.ProductFamily.importPackage(pack),linked);
  assert.equal((await p.evaluate(()=>window.ProductFamily.getRegistry())).links.length,links);pass('Links export and survive repeated import without duplication');

  const reg=await p.evaluate(()=>window.ProductFamily.getRegistry()),nativeBefore=await p.evaluate(()=>window.ProductFamily.rpc('exportNative'));
  await p.reload();await boot(p);
  assert.deepEqual(await p.evaluate(()=>window.ProductFamily.getRegistry()),reg);assert.deepEqual(await p.evaluate(()=>window.ProductFamily.rpc('exportNative')),nativeBefore);
  pass(app+' native records and family context survive a browser reload');

  await p.getByRole('button',{name:'Export',exact:true}).click();await p.getByRole('button',{name:'Download package',exact:true}).waitFor({state:'visible'});
  const download=p.waitForEvent('download');await p.getByRole('button',{name:'Download package',exact:true}).click();
  assert.match((await download).suggestedFilename(),/family\.json$/);pass('Shared family export produces an actual downloadable JSON file');

  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(requests.length,0,JSON.stringify(requests));
  pass('No browser page errors or external network requests');
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});
  await fs.writeFile(path.join(root,'test-results/browser-result.json'),JSON.stringify({passed:true,app,checks,errors,requests},null,2));
}catch(error){
  console.error(error);console.error({errors,requests});process.exitCode=1;
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});
  await fs.writeFile(path.join(root,'test-results/browser-result.json'),JSON.stringify({passed:false,app,checks,error:error.message,errors,requests},null,2));
}finally{await browser.close();}
