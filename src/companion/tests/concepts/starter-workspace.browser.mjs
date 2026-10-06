/** Current starter lifecycle through real controls. Inline mode explicitly substitutes storage/hash host boundaries. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2), inline = args.includes('--inline-adapters');
assert.ok(args.every(arg => arg === '--inline-adapters'), 'Only --inline-adapters is supported');
const root = resolve(import.meta.dirname, '../../../..'), output = resolve(root, 'reports/companion-mvp/starter-lifecycle');
const htmlPath = resolve(root, 'reports/companion-mvp/index.html'), html = await readFile(htmlPath, 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const rawGolden = await readFile(resolve(root, 'configs/starters/companion-plugin.json'), 'utf8');
const rawShowcase = await readFile(resolve(root, 'configs/starters/feature-showcase.json'), 'utf8');
const checks = [], errors = [], requests = [];
let activePage;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.SHELL_CHROMIUM ? { executablePath: process.env.SHELL_CHROMIUM } : {}), args: ['--no-sandbox'] });
async function check(name, action) { await action(); checks.push({ name, result: 'passed' }); }
async function load(context, storage = {}) {
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(String(error)));
  await page.route(/^(?:https?|wss?):/, route => { requests.push(route.request().url()); return route.abort(); });
  if (inline) {
    await page.exposeFunction('testDigest', text => [...createHash('sha256').update(Buffer.from(text, 'utf8')).digest()]);
    const adapter = `<script>window.__testStorage=${JSON.stringify(storage).replaceAll('<','\\u003c')};Object.defineProperty(window,'localStorage',{value:{getItem:k=>window.__testStorage[k]??null,setItem:(k,v)=>{window.__testStorage[k]=v},removeItem:k=>delete window.__testStorage[k],clear:()=>{window.__testStorage={}}}});Object.defineProperty(window.crypto,'subtle',{value:{digest:async(name,bytes)=>new Uint8Array(await window.testDigest(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes))).buffer}});</script>`;
    await page.setContent(adapter + html);
  } else await page.goto(pathToFileURL(htmlPath).href);
  return page;
}
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
try {
  const page = await load(context); activePage=page;
  await check('empty startup has no hidden starter or self-project', async () => {
    assert.deepEqual(await page.evaluate(() => [project(), starterCatalog.starters.length, typeof companionExampleProject]), [null, 0, 'undefined']);
    assert.equal(await page.getByRole('button', { name: 'Choose a starter', exact: true }).count(), 1);
    await page.screenshot({ path: resolve(output, 'empty.png') });
  });
  await page.getByRole('button', { name: 'Choose a starter', exact: true }).click();
  await check('invalid and duplicate selected JSON batches leave project and registry unchanged', async () => {
    await page.locator('#starter-definition-files').setInputFiles([{ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{bad') }]);
    await page.waitForFunction(() => !starterWorkspaceUi.loading, null, { polling: 100 });
    assert.deepEqual(await page.evaluate(() => [project(), starterCatalog.starters.length, Boolean(starterWorkspaceUi.error)]), [null,0,true]);
    await page.locator('#starter-definition-files').setInputFiles([{ name:'one.json', mimeType:'application/json', buffer:Buffer.from(rawShowcase) },{ name:'two.json', mimeType:'application/json', buffer:Buffer.from(rawShowcase) }]);
    await page.waitForFunction(() => !starterWorkspaceUi.loading, null, { polling: 100 });
    assert.match(await page.locator('#starter-load-error').innerText(), /Duplicate/);
    assert.equal(await page.evaluate(() => starterCatalog.starters.length), 0);
  });
  await check('external golden JSON is discovered without creating a project', async () => {
    await page.locator('#starter-definition-files').setInputFiles(resolve(root, 'configs/starters/companion-plugin.json'));
    await page.waitForFunction(() => !starterWorkspaceUi.loading, null, { polling: 100 });
    assert.deepEqual(await page.evaluate(() => [project(), starterCatalog.starters.map(s => s.id)]), [null,['companion-plugin']]);
  });
  await check('configuration and cancellation do not create a project', async () => {
    await page.locator('[data-action="starter-open"][data-value="companion-plugin"]').click();
    await page.locator('#starter-name').fill('Golden Review');
    await page.getByRole('button', { name:'Cancel', exact:true }).click();
    await page.locator('#discard-dialog[open] #discard-confirm').click();
    assert.equal(await page.evaluate(() => project()), null);
  });
  await page.locator('[data-action="starter-open"][data-value="companion-plugin"]').click();
  await page.getByRole('button', { name:'Review project', exact:true }).click();
  await check('starter source changes invalidate a held replacement review', async () => {
    // Simulate completion of a competing asynchronous file read while a review is held.
    const changed=JSON.parse(rawGolden); changed.summary += ' Revised.';
    await page.evaluate(async text => { await readStarterDefinitions([new File([text], 'companion-plugin.json', {type:'application/json'})]); }, JSON.stringify(changed));
    await page.locator('#project-import-confirm').check();
    await page.locator('[data-action="project-import-apply"]').click();
    assert.equal(await page.evaluate(() => project()), null);
    assert.match(await page.evaluate(() => projectTransferUi.error), /changed after review/);
    await page.locator('#modal [data-action="close"]').first().click();
  });
  await page.locator('[data-action="starter-open"][data-value="companion-plugin"]').click();
  await page.locator('#starter-name').fill('Golden Review');
  await page.getByRole('button', { name:'Review project', exact:true }).click();
  await page.locator('#project-import-confirm').check();
  await page.locator('[data-action="project-import-apply"]').click();
  await check('confirmation creates the full golden model and starts untrusted setup', async () => {
    assert.deepEqual(await page.evaluate(() => [project().name, project().design.nodes.length, project().design.visualDesigns.components.length, modalType, state.wizard.trusted]), ['Golden Review',28,54,'wizard',false]);
    await page.screenshot({ path: resolve(output,'setup.png') });
  });
  await check('starter export retains the edited project and complete unapproved recipe', async () => {
    await page.getByRole('button', {name:'Review shell handoff', exact:true}).click();
    await page.getByRole('button', {name:'Export starter JSON', exact:true}).click();
    const exported=await page.evaluate(() => JSON.parse(modalData.text));
    assert.equal(exported.generator.document.project.name,'Golden Review');
    assert.deepEqual(exported.processes,JSON.parse(rawGolden).processes);
    assert.deepEqual(exported.files,JSON.parse(rawGolden).files);
    assert.equal(exported.inputs.find(input=>input.id==='name').default,'Golden Review');
    assert.equal(exported.generator.document.executable,false);
    await page.locator('#modal [data-action="close"]').first().click();
  });
  const stored = inline ? await page.evaluate(() => ({...window.__testStorage})) : {};
  await check('reopening preserves the project; reviewed recipe reattachment restores complete export without replacing it', async () => {
    const reopened=await load(context,stored);
    assert.deepEqual(await reopened.evaluate(() => [project().name,project().design.nodes.length,starterCatalog.starters.length]),['Golden Review',28,0]);
    const before=await reopened.evaluate(()=>JSON.stringify(companionProjectDocument()));
    await reopened.locator('[data-action="nav"][data-value="starters"]').first().click();
    await reopened.locator('#starter-definition-files').setInputFiles(resolve(root,'configs/starters/companion-plugin.json'));
    await reopened.waitForFunction(()=>!starterWorkspaceUi.loading);
    await reopened.locator('[data-action="starter-recipe"][data-value="companion-plugin"]').click();
    await reopened.getByRole('button',{name:'Attach recipe',exact:true}).click();
    assert.equal(await reopened.evaluate(()=>starterProjectSources.has(project())),false);
    await reopened.locator('#starter-recipe-confirm').check();
    await reopened.getByRole('button',{name:'Attach recipe',exact:true}).click();
    assert.equal(await reopened.evaluate(()=>JSON.stringify(companionProjectDocument())),before);
    await reopened.getByRole('button',{name:'Export starter JSON',exact:true}).click();
    const exported=await reopened.evaluate(()=>JSON.parse(modalData.text));
    assert.equal(exported.generator.document.project.name,'Golden Review');
    assert.deepEqual(exported.processes,JSON.parse(rawGolden).processes);
    await reopened.close();
  });
  const blankContext=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  const blank=await load(blankContext);
  await check('blank path validates identity before creating anything', async () => {
    await blank.getByRole('button',{name:'Blank project',exact:true}).click();
    await blank.locator('[data-field="vault-id"]').fill('not a valid id');
    await blank.getByRole('button',{name:'Start this project',exact:true}).click();
    assert.equal(await blank.evaluate(()=>project()),null);
    assert.ok((await blank.locator('#vault-form-error').innerText()).length>0);
  });
  await check('valid blank project starts the same untrusted setup with no example data', async () => {
    await blank.locator('[data-field="vault-name"]').fill('Blank Review');await blank.locator('[data-field="vault-id"]').fill('blank-review');
    await blank.getByRole('button',{name:'Start this project',exact:true}).click();
    assert.deepEqual(await blank.evaluate(()=>[project().name,project().design.nodes.length,modalType,state.wizard.trusted]),['Blank Review',0,'wizard',false]);
  });
  await blankContext.close();
  await check('all lifecycle flows complete without page errors or network requests',()=>{assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);});
} catch(error) { const state=activePage?await activePage.evaluate(()=>({loading:starterWorkspaceUi.loading,error:starterWorkspaceUi.error,serial:starterWorkspaceUi.serial,count:starterWorkspaceUi.definitions.size,modal:modalType})).catch(()=>null):null; checks.push({name:'fatal',result:'failed',error:String(error),state});process.exitCode=1; }
finally {
  await browser.close();
  const report={schema:1,scope:inline?'inline browser with explicit in-memory storage and Node SHA-256 adapters; not file-origin/native acceptance':'file-origin browser lifecycle; not native Obsidian acceptance',htmlSha256:hash(html),goldenSha256:hash(rawGolden),checks,errors,requests};
  await writeFile(resolve(output,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}
