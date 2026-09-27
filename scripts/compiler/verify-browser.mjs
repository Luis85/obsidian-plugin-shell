/** Independent observable assertions against a built self-contained file, with external requests denied. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
const path=process.argv[2];if(!path)throw new Error('Supply the built clickdummy.html path.');
const browser=await chromium.launch({headless:true});const errors=[],network=[];
try{
  const context=await browser.newContext();await context.route('**/*',route=>{
    const url=route.request().url();if(/^(?:file|data|blob):/.test(url))return route.continue();network.push(url);return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(pathToFileURL(resolve(path)).href);
  await page.waitForFunction(()=>document.documentElement.dataset.prototypeReady==='true');
  const nav=page.getByRole('navigation',{name:'Project navigation'});await nav.waitFor();
  const buttons=nav.getByRole('button');const count=await buttons.count();assert.ok(count>=2,'navigation and Back are visible');
  const first=await nav.locator('[aria-current="page"]').textContent();
  for(let index=0;index<count-1;index++){
    const button=buttons.nth(index);await button.click();await page.waitForFunction(()=>Boolean(document.querySelector('nav [aria-current="page"]')));
    assert.equal(await button.getAttribute('aria-current'),'page');assert.ok(await page.locator('main').innerText());
  }
  if(count>2){await nav.getByRole('button',{name:'Back',exact:true}).click();assert.notEqual(await nav.locator('[aria-current="page"]').textContent(),await buttons.nth(count-2).textContent());}
  assert.ok(first);assert.deepEqual(network,[],'no external asset/provider requests');assert.deepEqual(errors,[],'no runtime or console errors');
  console.log(JSON.stringify({status:'passed',scope:'offline mount and declared navigation; no business acceptance',navigationTargets:count-1}));
  await context.close();
}finally{await browser.close();}
