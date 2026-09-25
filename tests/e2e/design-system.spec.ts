import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import '../../harness/app/test-api';
const identity = JSON.parse(readFileSync('manifest.json','utf8')) as {id:string};
const scope = `[data-plugin-ui="${identity.id}"].ps--${identity.id}`;
// Invoke the actual shared compiler, not a hand-maintained CSS facsimile.
function stylesheet(policy: 'host' | 'declared'): string {
  const source = `import {readFileSync} from 'node:fs';import {compileDesignSystem} from './scripts/companion/design-system-css.mjs';
const d=JSON.parse(readFileSync('docs/concepts/companion/companion-project.json','utf8'));const id=JSON.parse(readFileSync('manifest.json','utf8')).id;
d.design.designSystem.frontend={schema:1,target:'nuxt-ui',colorPolicy:process.argv[1],bindings:{}};
process.stdout.write(compileDesignSystem(d.design.designSystem,id).css);`;
  const run = spawnSync(process.execPath,['--input-type=module','-e',source,policy],{encoding:'utf8',timeout:10000});
  if (run.status !== 0 || run.error) throw new Error('STYLE_COMPILATION_FAILED: '+run.stderr);
  return run.stdout;
}
async function open(page: Page) {
  await page.goto('/harness/app/');await expect(page.locator('html')).toHaveAttribute('data-ready','true');
  await page.locator('#theme-light').click();
  await expect(page.locator(scope).first()).toHaveClass(/light/);
}
test('[DS-NUXT] compiled saved tokens style real Nuxt buttons and inputs without changing the host',async({page})=>{
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);
  const host=page.locator('#non-plugin-leaf button');
  const original=await host.evaluate(e=>({font:getComputedStyle(e).font,radius:getComputedStyle(e).borderRadius,color:getComputedStyle(e).color}));
  await page.addStyleTag({content:stylesheet('declared')});
  const root=page.locator(scope).first();
  expect(await root.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 255)');
  const primary=page.getByRole('button',{name:'Create your first Task note'});
  expect(await primary.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(101, 80, 185)');
  expect(await primary.evaluate(e=>getComputedStyle(e).borderRadius)).toBe('6px');
  expect(await primary.evaluate(e=>getComputedStyle(e).fontSize)).toBe('14px');
  expect(await page.getByRole('heading',{name:'Your plugin starts here.'}).evaluate(e=>getComputedStyle(e).fontSize)).toBe('24px');
  await page.getByRole('button',{name:'Documents',exact:true}).click();
  const input=page.locator('.shell-document-grid').getByRole('textbox',{name:'Title',exact:true});
  expect(await input.evaluate(e=>getComputedStyle(e).borderRadius)).toBe('6px');
  await input.focus();expect(await input.evaluate(e=>getComputedStyle(e).outlineColor)).toBe('rgb(101, 80, 185)');
  expect(await host.evaluate(e=>({font:getComputedStyle(e).font,radius:getComputedStyle(e).borderRadius,color:getComputedStyle(e).color}))).toEqual(original);
  expect(errors).toEqual([]);
});
test('[DS-MODE] host mode changes update a live Nuxt control and independent owned roots',async({page})=>{
  await open(page);await page.addStyleTag({content:stylesheet('declared')});
  await page.evaluate(()=>window.__SHELL_TEST__.mountSecond());
  const primary=page.getByRole('button',{name:'Create your first Task note'}).first();
  expect(await primary.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(101, 80, 185)');
  await page.locator('#theme-dark').click();
  await expect.poll(()=>primary.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(183, 163, 255)');
  for(const root of await page.locator(scope).all())expect(await root.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(30, 30, 36)');
  await page.locator('#theme-light').click();
  await expect.poll(()=>primary.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(101, 80, 185)');
  await page.emulateMedia({forcedColors:'active'});
  expect(await primary.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe('rgb(101, 80, 185)');
});
test('[DS-HOST] host palette follows host preferences while typography remains declared',async({page})=>{
  await open(page);await page.addStyleTag({content:stylesheet('host')});
  await page.evaluate(()=>document.body.style.setProperty('--interactive-accent','#123456'));
  const primary=page.getByRole('button',{name:'Create your first Task note'});
  expect(await primary.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe('rgb(18, 52, 86)');
  expect(await primary.evaluate(e=>getComputedStyle(e).fontSize)).toBe('14px');
  // Confirm importing the actual generator output is active during independent qualification.
  if(process.env.GENERATED_STYLES==='1') {
    const bundled=readFileSync('dist/styles.css','utf8');
    expect(bundled).toContain(`--${identity.id}-ds-colors-accent`);
    expect(bundled).toContain(`--${identity.id}-ds-typography-body`);
  }
});
