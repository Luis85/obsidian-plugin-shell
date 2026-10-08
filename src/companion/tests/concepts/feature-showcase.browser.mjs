/** Exercises independently compiled showcase output, not the authoring HTML. No network fallback is allowed. */
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const args=process.argv.slice(2), inline=args.includes('--inline');
const position=args.indexOf('--html');
assert.ok(position>=0 && args[position+1] && args.every((arg,index)=>arg==='--html'||arg==='--inline'||index===position+1),'Use --html <compiled clickdummy.html> [--inline]');
const input=resolve(args[position+1]),html=await readFile(input,'utf8');
const output=resolve(dirname(input),'browser-evidence');await mkdir(output,{recursive:true});
const checks=[],errors=[],requests=[], hash=value=>createHash('sha256').update(value).digest('hex');
const browser=await chromium.launch({headless:true,...(process.env.SHELL_CHROMIUM?{executablePath:process.env.SHELL_CHROMIUM}:{}),args:['--no-sandbox']});
// Axe needs a real browser context, not a bare page.
const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',error=>errors.push(String(error)));
await page.route(/^(?:https?|wss?):/,route=>{requests.push(route.request().url());return route.abort();});
async function check(name,action){await action();checks.push({name,result:'passed'});}
/** Host theme classes, as the generated UI themes itself. A theme must restyle the page: dark needs a dark background. */
async function useTheme(theme){
  await page.evaluate(next=>{document.body.classList.toggle('theme-dark',next==='dark');document.body.classList.toggle('theme-light',next==='light');},theme);
  await expect.poll(()=>page.evaluate(()=>{const [r=0,g=0,b=0]=(getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)??[]).map(Number);return (r*299+g*587+b*114)/1000<128?'dark':'light';}),{message:`the ${theme} theme restyles the page`}).toBe(theme);
}
/** Nuxt UI's CommandPalette names neither its listbox nor offers a prop to do so; this one upstream finding is recorded, not hidden. */
const upstream={rule:'aria-input-field-name',html:/data-slot="content"[^>]*role="listbox"|role="listbox"[^>]*data-slot="content"/},knownUpstream=[];
async function axeFindings(label){
  const {violations}=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  return violations.flatMap(v=>{const nodes=v.nodes.filter(n=>!(v.id===upstream.rule&&upstream.html.test(n.html)));if(nodes.length<v.nodes.length)knownUpstream.push(`${label}: ${v.id}`);
    return nodes.length?[`${label}: ${v.impact} ${v.id} ${nodes.slice(0,3).map(n=>n.target.join(' ')).join(' | ')}`]:[];});
}
try{
  if(inline)await page.setContent(html);else await page.goto(pathToFileURL(input).href);
  await page.waitForFunction(()=>document.documentElement.dataset.prototypeReady==='true');
  const data=await page.evaluate(()=>{const p=JSON.parse(document.getElementById('prototype-project-data').textContent);return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(p.content),c=>c.charCodeAt(0))));});
  const picker=page.getByLabel('Browse surfaces',{exact:true}), state=page.getByLabel('Preview state',{exact:true});
  await check('standalone generated Vue source renders every non-modal surface',async()=>{
    assert.equal(await page.locator('script[src],link[href]').count(),0);
    for(const surface of data.design.nodes.filter(n=>!['group','action','modal'].includes(n.kind))){
      await picker.selectOption(surface.id);await expect(page.locator('.generated-screen > h2').first()).toHaveText(surface.label);
    }
  });
  await check('ten input controls accept edits and remain local to the preview',async()=>{
    await picker.selectOption('node-2');
    for(const [id,value] of [['vn-36','Edited example'],['vn-39','Multiline\nexample'],['vn-42','8'],['vn-48','2026-02-01'],['vn-51','2026-02-01T10:30'],['vn-60','{"title":"Edited"}'],['vn-63','# Edited']]){
      const field=page.locator(`[data-design-node="${id}"]`).locator('input,textarea').or(page.locator(`input[data-design-node="${id}"],textarea[data-design-node="${id}"]`)).first();
      await field.fill(value);await expect(field).toHaveValue(value);
    }
    await page.locator('[data-design-node="vn-45"]').getByRole('checkbox').or(page.locator('[data-design-node="vn-45"][role="checkbox"]')).first().click();
    const select=page.locator('[data-design-node="vn-54"]');await select.click();await page.getByRole('option',{name:'Beta',exact:true}).click();await expect(select).toContainText('Beta');
    const file=page.locator('[data-design-node="vn-57"] input[type=file],input[type=file][data-design-node="vn-57"]');
    await file.setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from('{"title":"Selected fixture"}')});
    await expect(page.locator('.clickdummy-error')).toHaveCount(0);
  });
  await check('set-value, focus, toggle and navigation dispatch real local UI effects',async()=>{
    await picker.selectOption('node-3');const field=page.getByPlaceholder('Editable draft',{exact:true});
    await page.getByRole('button',{name:'Set example value',exact:true}).click();await expect(field).toHaveValue('Changed by action');
    await page.getByRole('button',{name:'Focus draft',exact:true}).click();await expect(field).toBeFocused();
    const panel=page.locator('[data-design-node="vn-72"]');await expect(panel).toBeVisible();await page.getByRole('button',{name:'Toggle panel',exact:true}).click();await expect(panel).toHaveCount(0);
    await page.getByRole('button',{name:'Toggle panel',exact:true}).click();await expect(panel).toBeVisible();
    await page.getByRole('button',{name:'Open form controls',exact:true}).click();await expect(picker).toHaveValue('node-2');
  });
  await check('fixture read and refresh render rows without contacting a backend',async()=>{
    await picker.selectOption('node-4');const table=page.locator('[data-design-node="vn-87"]');
    await expect(table).toContainText('No records for this fixture.');
    await page.getByRole('button',{name:'Refresh fixture records',exact:true}).click();await expect(table).toContainText('fixture');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Authored scenario',{exact:true}).selectOption('scenario-16');
    await expect(table).toContainText('Review the prototype');await expect(table).toContainText('Try the controls');await expect(table.locator('tbody tr')).toHaveCount(2);
    await page.getByLabel('Authored scenario',{exact:true}).selectOption('scenario-18');await expect(table).toContainText('No records for this fixture.');
    await page.getByLabel('Authored scenario',{exact:true}).selectOption('');
  });
  await check('tabs, command selection and menu item actions use the shared event contract',async()=>{
    await picker.selectOption('node-5');
    await page.getByRole('tab',{name:'Details',exact:true}).click();
    await expect(page.locator('input[data-design-node="vn-97"],[data-design-node="vn-97"] input').first()).toHaveValue('A different tab was selected');
    await page.locator('button[role=option]').filter({hasText:/^Form controls$/}).click();
    await expect(page.locator('input[data-design-node="vn-97"],[data-design-node="vn-97"] input').first()).toHaveValue('A command was selected');
    await page.getByRole('button',{name:'Inspect menu contract',exact:true}).click();
    await expect(page.getByRole('menuitem',{name:'Unavailable example',exact:true})).toBeDisabled();
    await page.getByRole('menuitem',{name:'Open forms',exact:true}).click();await expect(picker).toHaveValue('node-2');
  });
  await check('modal and drawer can open, edit, close and reopen using explicit state bindings',async()=>{
    await picker.selectOption('node-6');
    for(const name of ['Example dialog','Example drawer']){
      await page.getByRole('button',{name:'Open '+name,exact:true}).click();
      const dialog=page.getByRole('dialog',{name,exact:true});await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox').fill('Edited '+name);await expect(dialog.getByRole('textbox')).toHaveValue('Edited '+name);
      await dialog.getByRole('button',{name:'Close '+name,exact:true}).click();await expect(dialog).toBeHidden();
      await page.getByRole('button',{name:'Open '+name,exact:true}).click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
    }
  });
  await check('preview states and authored scenarios remain explicit and local',async()=>{
    await picker.selectOption('node-7');
    for(const name of ['loading','empty','error','disabled','default']){
      await state.selectOption(name);await expect(page.locator('.generated-detail').first()).toHaveAttribute('data-design-state',name);
      await expect(page.getByText('State: '+name,{exact:true})).toBeVisible();
    }
    await page.getByLabel('Authored scenario',{exact:true}).selectOption('scenario-32');await expect(state).toHaveValue('loading');
    await page.getByLabel('Authored scenario',{exact:true}).selectOption('');await expect(state).toHaveValue('default');
  });
  await check('pinned reusable component emits a contract event into its parent',async()=>{
    await picker.selectOption('node-8');await page.getByRole('button',{name:'Select card',exact:true}).click();
    await expect(page.locator('input[data-design-node="vn-174"],[data-design-node="vn-174"] input').first()).toHaveValue('Card selected through its emitted event');
  });
  await check('Journey Lens edits, cancels and undoes its complete in-memory project',async()=>{
    await picker.selectOption('node-9');const workspace=page.locator('.jl-workspace');await expect(workspace).toHaveAttribute('data-journey-mode','preview');
    await expect(workspace.locator('.vue-flow__node').first()).toBeVisible();await expect(page.getByLabel('Authored scenario',{exact:true})).toBeDisabled();
    const inspector=workspace.getByRole('complementary',{name:'Selected surface',exact:true}),name=inspector.getByLabel('Name',{exact:true}),original=await name.inputValue();
    await name.fill('Unsubmitted example');await picker.selectOption('node-1');await expect(picker).toHaveValue('node-9');
    await inspector.getByRole('button',{name:'Cancel',exact:true}).click();await expect(name).toHaveValue(original);
    await name.fill('Edited example surface');await inspector.getByRole('button',{name:'Save name',exact:true}).click();
    await workspace.getByRole('button',{name:'Undo',exact:true}).click();await expect(name).toHaveValue(original);
    await workspace.getByRole('button',{name:'Redo',exact:true}).click();await expect(name).toHaveValue('Edited example surface');
  });
  const pages=data.design.nodes.filter(n=>!['group','action','modal'].includes(n.kind));
  await check('every surface passes axe WCAG 2.1 A/AA in the light and the dark theme',async()=>{
    const findings=[];
    for(const theme of ['light','dark']){await useTheme(theme);
      for(const surface of pages){await picker.selectOption(surface.id);await expect(page.locator('.generated-screen > h2').first()).toHaveText(surface.label);findings.push(...await axeFindings(`${surface.id}/${theme}`));}
    }
    await useTheme('dark');assert.deepEqual(findings,[]);
  });
  await check('every surface reflows at 360px without horizontal scrolling',async()=>{
    await page.setViewportSize({width:360,height:800});const wide=[];
    for(const surface of pages){await picker.selectOption(surface.id);await expect(page.locator('.generated-screen > h2').first()).toHaveText(surface.label);
      const fit=await page.evaluate(()=>{const e=document.scrollingElement??document.documentElement;return {scroll:e.scrollWidth,client:e.clientWidth};});
      if(fit.scroll>fit.client)wide.push(`${surface.id}: ${fit.scroll} > ${fit.client}`);}
    await page.setViewportSize({width:1440,height:1100});assert.deepEqual(wide,[]);
  });
  await check('no page exceptions, unsupported-capability alerts or network requests',async()=>{
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);await expect(page.locator('.clickdummy-error')).toHaveCount(0);
    await picker.selectOption('node-1');await page.screenshot({path:resolve(output,'showcase.png'),fullPage:true});
  });
}catch(error){checks.push({name:'fatal',result:'failed',error:String(error)});await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();const report={schema:1,knownUpstreamFindings:[...new Set(knownUpstream)],scope:inline?'inline compiled browser replay; not file-origin/native acceptance':'file-origin compiled browser replay; not native Obsidian acceptance',htmlSha256:hash(html),checks,errors,requests};await writeFile(resolve(output,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
