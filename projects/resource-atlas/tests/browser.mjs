/**
 * Integrated acceptance tests against the shipped, self-contained HTML.
 * Run: RESOURCE_CHROMIUM_PATH=/path/to/chromium FAMILY_DIST_PATH=/path/to/family/dist node tests/browser.mjs
 * Both overrides are optional. Without the browser override, Playwright uses its installed Chromium.
 * Add --final to run only the focused regressions for the final correction batch.
 * --match=<regular-expression> reruns matching groups and merges their results into the previous report.
 * FAMILY_DIST_PATH defaults to the sibling family/dist directory; absent peers are reported as skipped.
 * Screenshots and the machine-readable report are written to .qa/ (never to product source).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const qa = path.join(root, '.qa');
const html = path.join(root, 'dist', 'resource-atlas.html');
const peersRoot = process.env.FAMILY_DIST_PATH || path.join(root, '..', 'family', 'dist');
const peerFiles = {
  'component-atlas': 'component-atlas.html',
  storyloom: 'storyloom-prototype.html',
  'sitemap-atlas': 'sitemap-atlas.html',
  dissect: 'dissect-canvas.html'
};
let playwright;
try { playwright = await import('playwright'); }
catch {
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtime) throw new Error('Install the development dependencies and Playwright Chromium first.');
  playwright = await import(pathToFileURL(path.join(runtime, 'playwright/index.mjs')).href);
}
await fs.mkdir(qa, { recursive: true });
await fs.access(html);
const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.RESOURCE_CHROMIUM_PATH ? { executablePath: process.env.RESOURCE_CHROMIUM_PATH } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader']
});
const checks = [], errors = [], requests = [], screenshots = [], contexts = [];
const finalOnly = process.argv.includes('--final');
const matchArgument = process.argv.find(argument => argument.startsWith('--match='));
const onlyMatches = matchArgument ? new RegExp(matchArgument.slice('--match='.length)) : null;
const precise = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `Expected ${expected}, received ${actual}`);
let currentCheck = '';
async function check(name, fn) {
  if (finalOnly !== name.startsWith('Final:')) return;
  if (onlyMatches && !onlyMatches.test(name)) return;
  currentCheck = name;
  try { const details = await fn(); checks.push({ name, passed: true, ...(details || {}) }); console.log('PASS', name); }
  catch (error) { checks.push({ name, passed: false, error: error.message }); console.error('FAIL', name, error.stack); }
}
async function context(options = {}) {
  const c = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 960 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', ...options });
  contexts.push(c);
  await c.route(/^https?:/, async route => { requests.push({ check: currentCheck, url: route.request().url() }); await route.abort(); });
  return c;
}
async function open(c, file = html, app = 'resource-atlas') {
  const p = await c.newPage();
  p.setDefaultTimeout(10000);
  p.on('pageerror', error => errors.push({ app, check: currentCheck, message: error.message }));
  await p.goto(pathToFileURL(file).href);
  await p.waitForFunction(() => window.ProductFamily?.getSnapshot(), null, { timeout: 15000 });
  if (app === 'resource-atlas') await p.waitForFunction(() => window.ResourceAtlas?.getPlan());
  return p;
}
const plan = p => p.evaluate(() => window.ResourceAtlas.getPlan());
const calc = p => p.evaluate(() => window.ResourceAtlas.getCalculation());
const inspector = p => p.locator('.resource-inspector');
async function saveInspector(p) { await inspector(p).locator('button[type=submit]').click(); await inspector(p).waitFor({ state: 'hidden' }); }
async function choose(p, selector, label) { await p.locator(selector).click(); await p.getByRole('option', { name: label, exact: true }).click(); }
async function settled(p) { await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); await p.waitForTimeout(250); }
async function shot(p, name) { await settled(p); const file = path.join(qa, name + '.png'); await p.screenshot({ path: file, fullPage: true }); screenshots.push(path.relative(root, file)); }
async function nativeDownload(p, label) {
  await p.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = p.getByRole('dialog');
  if (label) await choose(p, '#export-format', label);
  const pending = p.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Datei herunterladen', exact: true }).click();
  const download = await pending;
  const text = await fs.readFile(await download.path(), 'utf8');
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  return { name: download.suggestedFilename(), text };
}
async function stageFile(p, filename, text) {
  await p.getByRole('button', { name: 'Import', exact: true }).click();
  await p.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: filename, mimeType: filename.endsWith('.md') ? 'text/markdown' : 'application/json', buffer: Buffer.from(text) });
}
async function addBlock(p, { name, scope = 'Alle Rollen', percent, start = '2026-10-19', end = start }) {
  await p.getByRole('button', { name: 'Arbeitskalender', exact: true }).click();
  await p.getByRole('button', { name: 'Sperrzeit hinzufügen', exact: true }).click();
  await p.locator('#block-name').fill(name);
  if (scope !== 'Alle Rollen') await choose(p, '#block-role', scope);
  await p.locator('#block-start').fill(start);
  await p.locator('#block-end').fill(end);
  await p.locator('#block-percent').fill(String(percent));
  await saveInspector(p);
}

try {
  await check('Reference plan shows 35 + 35 + 80 + 14 = 164 PT and 14 PT budget excess', async () => {
    const c = await context(), p = await open(c), result = await calc(p);
    precise(result.totals.netPt, 164); precise(result.totals.budgetExceededPt, 14);
    precise(result.totals.workingDays, 100); precise(result.totals.availableDays, 90); precise(result.totals.hours, 1312);
    assert.match(await p.getByTestId('total-pt').innerText(), /164,0\s*PT/);
    for (const [id, expected] of [['role-ux', 35], ['role-re', 35], ['role-dev', 80], ['role-dm', 14]]) {
      precise(result.roles.find(role => role.id === id).netPt, expected);
      assert.match(await p.getByTestId('role-total-' + id).innerText(), new RegExp(String(expected)));
    }
    assert.match(await p.locator('.budget-over').innerText(), /14,0 PT/);
    await shot(p, 'resource-desktop-dark');
    await p.getByRole('button', { name: 'Design wechseln', exact: true }).click();
    await p.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await shot(p, 'resource-desktop-light');
    await c.close();
    return { totalPt: 164, rolesPt: [35, 35, 80, 14], budgetExcessPt: 14 };
  });

  await check('Create a one-day plan, role with decimal comma, and explicit dated assignment through the UI', async () => {
    const c = await context(), p = await open(c);
    await p.getByRole('button', { name: 'Neuer Plan', exact: true }).click();
    await p.locator('#plan-name').fill('Prüfplan · ein Arbeitstag');
    await p.locator('#plan-start').fill('2026-10-19');
    await p.locator('#plan-end').fill('2026-10-19');
    await p.locator('#plan-budget').fill('1');
    await saveInspector(p);
    assert.equal((await plan(p)).roles.length, 0); precise((await calc(p)).totals.netPt, 0);
    await p.getByRole('button', { name: 'Rolle anlegen', exact: true }).click();
    await p.locator('#role-name').fill('Qualitätssicherung');
    await p.locator('#role-fte').fill('0,5');
    await saveInspector(p);
    assert.equal((await plan(p)).roles[0].fte, 0.5); precise((await calc(p)).totals.netPt, 0);
    await p.getByRole('button', { name: 'Einsatz hinzufügen', exact: true }).click();
    await p.locator('#allocation-name').fill('Abnahme vorbereiten');
    assert.equal(Number((await p.locator('#allocation-fte').inputValue()).replace(',', '.')), 0.5);
    await p.locator('#allocation-end').fill('2026-10-18');
    await inspector(p).locator('button[type=submit]').click();
    await p.locator('#resource-inspector-error').waitFor();
    assert.equal((await plan(p)).allocations.length, 0);
    await p.locator('#allocation-end').fill('2026-10-19');
    await saveInspector(p);
    precise((await calc(p)).totals.netPt, 0.5);
    const before = await plan(p);
    await p.reload(); await p.waitForFunction(() => window.ResourceAtlas?.getPlan());
    assert.deepEqual(await plan(p), before);
    precise((await calc(p)).totals.netPt, 0.5);
    await c.close();
  });

  await check('Unsaved inspector edits require explicit discard and cancel preserves the draft', async () => {
    const c = await context(), p = await open(c), before = await plan(p);
    await p.getByRole('button', { name: 'Plan bearbeiten', exact: true }).click();
    await p.locator('#plan-name').fill('Noch nicht übernehmen');
    await p.getByRole('button', { name: 'Inspector schließen', exact: true }).click();
    const dialog = p.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await p.locator('#plan-name').inputValue(), 'Noch nicht übernehmen');
    assert.deepEqual(await plan(p), before);
    await p.getByRole('button', { name: 'Inspector schließen', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await inspector(p).waitFor({ state: 'hidden' });
    assert.deepEqual(await plan(p), before);
    await p.getByRole('button', { name: 'Einsatz hinzufügen', exact: true }).click();
    await inspector(p).getByRole('button', { name: 'Gesamte Planlaufzeit', exact: true }).click();
    assert.equal(await p.locator('#allocation-start').inputValue(), before.start);
    assert.equal(await p.locator('#allocation-end').inputValue(), before.end);
    assert.deepEqual(await plan(p), before, 'Whole-duration shortcut changes only the draft before confirmation');
    await p.getByRole('button', { name: 'Inspector schließen', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await inspector(p).waitFor({ state: 'hidden' });
    await c.close();
  });

  await check('Drawing, dragging, resizing, keyboard movement and undo change actual assignment dates', async () => {
    const c = await context(), p = await open(c);
    const beforeIds = (await plan(p)).allocations.map(a => a.id);
    await p.getByRole('button', { name: 'Einsatz zeichnen', exact: true }).click();
    const track = p.getByTestId('role-track-role-ux');
    await track.scrollIntoViewIfNeeded();
    let rect = await track.boundingBox();
    const dayWidth = rect.width / 138;
    await p.mouse.move(rect.x + dayWidth * 0.5, rect.y + 28);
    await p.mouse.down();
    await p.mouse.move(rect.x + dayWidth * 4.5, rect.y + 28, { steps: 5 });
    assert.equal((await plan(p)).allocations.length, beforeIds.length, 'Drawing preview must not mutate native data');
    await p.mouse.up();
    await p.locator('#allocation-name').waitFor();
    assert.equal(await p.locator('#allocation-start').inputValue(), '2026-10-05');
    assert.equal(await p.locator('#allocation-end').inputValue(), '2026-10-09');
    await p.locator('#allocation-name').fill('Zusätzliche Vorbereitung');
    await saveInspector(p);
    const created = (await plan(p)).allocations.find(a => !beforeIds.includes(a.id));
    assert(created); precise((await calc(p)).totals.netPt, 169);
    await p.getByRole('button', { name: 'Auswählen', exact: true }).click();
    const shell = p.locator(`.rt-allocation-shell[data-allocation-id="${created.id}"]`);
    const bar = shell.locator('.rt-allocation');
    rect = await track.boundingBox();
    let box = await bar.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + rect.width / 138 * 7, box.y + box.height / 2, { steps: 6 }); await p.mouse.up();
    await p.waitForFunction(id => window.ResourceAtlas.getPlan().allocations.find(a => a.id === id)?.start === '2026-10-12', created.id);
    let changed = (await plan(p)).allocations.find(a => a.id === created.id);
    assert.equal(changed.end, '2026-10-16');
    box = await shell.locator('.rt-resize-end').boundingBox(); rect = await track.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + rect.width / 138 * 3, box.y + box.height / 2, { steps: 4 }); await p.mouse.up();
    await p.waitForFunction(id => window.ResourceAtlas.getPlan().allocations.find(a => a.id === id)?.end === '2026-10-19', created.id);
    precise((await calc(p)).totals.netPt, 170);
    await bar.press('ArrowRight');
    changed = (await plan(p)).allocations.find(a => a.id === created.id);
    assert.equal(changed.start, '2026-10-13'); assert.equal(changed.end, '2026-10-20');
    await bar.press('Shift+ArrowRight');
    assert.equal((await plan(p)).allocations.find(a => a.id === created.id).start, '2026-10-20');
    await p.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    assert.equal((await plan(p)).allocations.find(a => a.id === created.id).start, '2026-10-13');
    assert((await calc(p)).totals.requestedOverloadDays > 0, 'Additional overlapping assignment should expose nominal-capacity conflict');
    await c.close();
  });

  await check('Partial role and company blocks use the strongest overlap, with effective undo and redo', async () => {
    const c = await context(), p = await open(c);
    await addBlock(p, { name: 'Entwicklung halb verfügbar', scope: 'Entwicklung', percent: 50 });
    precise((await calc(p)).totals.netPt, 163.5);
    precise((await calc(p)).roles.find(r => r.id === 'role-dev').netPt, 79.5);
    await addBlock(p, { name: 'Gemeinsamer halber Tag', percent: 50 });
    precise((await calc(p)).totals.netPt, 162.4);
    precise((await calc(p)).roles.find(r => r.id === 'role-dev').netPt, 79.5);
    await addBlock(p, { name: 'Vollständig gesperrt', percent: 100 });
    precise((await calc(p)).totals.netPt, 160.8);
    await p.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    precise((await calc(p)).totals.netPt, 162.4);
    await p.getByRole('button', { name: 'Wiederholen', exact: true }).click();
    precise((await calc(p)).totals.netPt, 160.8);
    await c.close();
  });

  await check('Native JSON and Obsidian Markdown download and reviewed reimport preserve the complete plan', async () => {
    const c = await context(), p = await open(c), before = await plan(p);
    const json = await nativeDownload(p);
    assert.match(json.name, /\.json$/); assert.deepEqual(JSON.parse(json.text).plan, before);
    const markdown = await nativeDownload(p, 'Obsidian-Notiz · Markdown');
    assert.match(markdown.name, /\.md$/); assert.match(markdown.text, /^---\n/); assert.match(markdown.text, /164/);
    await p.getByRole('button', { name: 'Plan bearbeiten', exact: true }).click();
    await p.locator('#plan-name').fill('Geänderter Arbeitsstand'); await saveInspector(p);
    await stageFile(p, json.name, json.text);
    const dialog = p.getByRole('dialog');
    await dialog.locator('.native-preview-plans').waitFor();
    assert.equal((await plan(p)).name, 'Geänderter Arbeitsstand', 'Import preview must not apply data');
    assert(await dialog.getByRole('button', { name: 'Pläne importieren', exact: true }).isDisabled());
    await dialog.getByRole('checkbox', { name: /vorhandene Pläne mit gleicher ID ersetzen/ }).check();
    await dialog.getByRole('button', { name: 'Pläne importieren', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' }); assert.deepEqual(await plan(p), before);
    await stageFile(p, markdown.name, markdown.text);
    await p.getByRole('dialog').locator('.native-preview-plans').waitFor();
    await choose(p, '#native-import-mode', 'Als unabhängige Kopien importieren');
    await p.getByRole('dialog').getByRole('button', { name: 'Pläne importieren', exact: true }).click();
    await p.getByRole('dialog').waitFor({ state: 'hidden' });
    const copy = await plan(p); assert.notEqual(copy.id, before.id);
    assert.deepEqual({ ...copy, id: before.id, name: before.name }, before);
    const saved = await p.evaluate(() => window.ResourceAtlas.getState());
    await p.reload(); await p.waitForFunction(() => window.ResourceAtlas?.getState());
    assert.deepEqual(await p.evaluate(() => window.ResourceAtlas.getState()), saved);
    await c.close();
  });

  await check('Changing hours per PT preserves effort and date scale changes conserve totals', async () => {
    const c = await context(), p = await open(c);
    await p.getByRole('button', { name: 'Arbeitskalender', exact: true }).click();
    await p.getByRole('button', { name: 'Kalender bearbeiten', exact: true }).click();
    await p.locator('#calendar-hours').fill('7,5'); await saveInspector(p);
    precise((await calc(p)).totals.netPt, 164); precise((await calc(p)).totals.hours, 1230);
    await p.getByRole('button', { name: 'Einsatzplan anzeigen', exact: true }).click();
    for (const label of ['Tage', 'Monate', 'Wochen']) {
      await choose(p, '#timeline-scale', label);
      precise((await calc(p)).totals.netPt, 164);
      assert.match(await p.getByTestId('timeline-total').innerText(), /164/);
    }
    await p.getByRole('button', { name: 'Auswertung', exact: true }).click();
    await shot(p, 'resource-analysis-dark');
    await p.getByRole('button', { name: 'Design wechseln', exact: true }).click();
    await p.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await shot(p, 'resource-analysis-light');
    await p.getByRole('button', { name: 'Design wechseln', exact: true }).click();
    await p.getByRole('button', { name: 'Einsatzplan anzeigen', exact: true }).click();
    await p.keyboard.press('Control+k');
    await p.getByRole('dialog').getByRole('textbox', { name: 'Suchbegriff', exact: true }).fill('Design-Vertiefung');
    await p.getByRole('dialog').getByRole('button', { name: /Design-Vertiefung/ }).click();
    assert.equal(await p.locator('#allocation-name').inputValue(), 'Design-Vertiefung');
    await shot(p, 'resource-desktop-inspector');
    await c.close();
  });

  await check('Resource Atlas exchanges actual records with every existing prototype in all eight directions', async () => {
    const missing = [];
    for (const file of Object.values(peerFiles)) try { await fs.access(path.join(peersRoot, file)); } catch { missing.push(file); }
    if (missing.length) { console.log('SKIP family compatibility: point FAMILY_DIST_PATH at the four built prototypes.'); return { skipped: true, missing }; }
    const c = await context(), resource = await open(c), resourceBefore = await resource.evaluate(() => window.ProductFamily.rpc('exportNative'));
    const resourcePack = await resource.evaluate(() => window.ProductFamily.makePackage());
    const peerPages = {}, directionChecks = [];
    for (const [app, file] of Object.entries(peerFiles)) {
      const p = await open(c, path.join(peersRoot, file), app); peerPages[app] = p;
      const peerBefore = await p.evaluate(() => window.ProductFamily.rpc('exportNative'));
      const pack = await p.evaluate(() => window.ProductFamily.makePackage());
      const resourceSummary = await resource.evaluate(pack => window.ProductFamily.review(pack), pack);
      assert(resourceSummary.added > 0);
      const resourceRegistry = await resource.evaluate(pack => window.ProductFamily.importPackage(pack), pack);
      assert(resourceRegistry.records.some(e => e.source.appId === app));
      assert.deepEqual(await resource.evaluate(() => window.ProductFamily.rpc('exportNative')), resourceBefore);
      directionChecks.push(app + ' → resource-atlas');
      const peerSummary = await p.evaluate(pack => window.ProductFamily.review(pack), resourcePack);
      assert(peerSummary.added > 0);
      const peerRegistry = await p.evaluate(pack => window.ProductFamily.importPackage(pack), resourcePack);
      assert(peerRegistry.records.some(e => e.source.appId === 'resource-atlas' && e.kind === 'resource.allocation'));
      assert.deepEqual(await p.evaluate(() => window.ProductFamily.rpc('exportNative')), peerBefore);
      directionChecks.push('resource-atlas → ' + app);
    }
    await resource.getByRole('button', { name: 'Verknüpfungen anzeigen', exact: true }).click();
    await resource.getByRole('button', { name: 'Verknüpfung anlegen', exact: true }).click();
    const registry = await resource.evaluate(() => window.ProductFamily.getRegistry());
    assert.equal(registry.links.length, 1);
    const linked = await resource.evaluate(() => window.ProductFamily.makePackage());
    const target = peerPages.storyloom;
    await target.evaluate(pack => window.ProductFamily.importPackage(pack), linked);
    const links = await target.evaluate(() => window.ProductFamily.getRegistry().links);
    assert(links.some(l => l.from === registry.links[0].from && l.to === registry.links[0].to));
    await target.evaluate(pack => window.ProductFamily.importPackage(pack), linked);
    assert.equal((await target.evaluate(() => window.ProductFamily.getRegistry().links)).length, links.length);
    await resource.reload(); await resource.waitForFunction(() => window.ResourceAtlas?.getPlan());
    assert.deepEqual(await resource.evaluate(() => window.ProductFamily.getRegistry()), registry);
    assert.deepEqual(await resource.evaluate(() => window.ProductFamily.rpc('exportNative')), resourceBefore);
    await c.close();
    return { directions: directionChecks, sourceOwnershipPreserved: true, forwardedLinksIdempotent: true };
  });

  await check('Tablet and phone layouts retain local timeline scrolling, navigation, themes and usable inspector', async () => {
    for (const width of [1024, 390]) {
      const c = await context({ viewport: { width, height: 900 }, ...(width === 390 ? { isMobile: true, hasTouch: true } : {}) });
      const p = await open(c);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'Application should not create page-level horizontal overflow');
      precise((await calc(p)).totals.netPt, 164);
      await shot(p, 'resource-' + width + '-dark');
      await p.getByRole('button', { name: 'Design wechseln', exact: true }).click();
      await p.waitForFunction(() => document.documentElement.dataset.theme === 'light');
      await shot(p, 'resource-' + width + '-light');
      if (width === 390) {
        await p.getByRole('button', { name: 'Menü öffnen', exact: true }).click();
        await p.getByRole('button', { name: /Rollen & Aufwand/ }).click();
        await p.getByRole('heading', { name: 'Rollen & Aufwand', exact: true }).first().waitFor();
        await p.getByRole('button', { name: 'Einsatzplan anzeigen', exact: true }).click();
      }
      await p.getByRole('button', { name: 'Einsatz hinzufügen', exact: true }).click();
      await p.locator('#allocation-name').waitFor();
      const bounds = await inspector(p).boundingBox();
      assert(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Inspector should remain in the viewport');
      const submit = await inspector(p).locator('button[type=submit]').boundingBox();
      assert(submit.y + submit.height <= 901, 'Inspector save action should remain reachable');
      await shot(p, 'resource-' + width + '-inspector');
      await c.close();
    }
  });

  await check('No page errors or external HTTP requests in the exercised standalone flows', async () => {
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(requests.length, 0, JSON.stringify(requests));
  });

  await check('Final: Whole-duration shortcut changes only the draft and native APIs preserve unsaved edits', async () => {
    const c = await context(), p = await open(c), before = await plan(p);
    await p.getByRole('button', { name: 'Einsatz hinzufügen', exact: true }).click();
    await inspector(p).getByRole('button', { name: 'Gesamte Planlaufzeit', exact: true }).click();
    assert.equal(await p.locator('#allocation-start').inputValue(), before.start);
    assert.equal(await p.locator('#allocation-end').inputValue(), before.end);
    assert.deepEqual(await plan(p), before);
    const rejected = await p.evaluate(async () => {
      const api = window.ResourceAtlas, original = api.getPlan(), results = [];
      const candidate = { ...original, name: 'Must not replace unsaved inputs' };
      for (const fn of [() => api.replacePlan(candidate), () => api.importNative(JSON.stringify({ format: 'resource-atlas', schemaVersion: 1, plan: candidate }), { replaceExisting: true }), () => window.ProductFamily.makePackage()]) {
        try { await fn(); results.push(null); } catch (error) { results.push(error.message); }
      }
      return results;
    });
    assert(rejected.every(message => /Übernimm|verwirf/.test(message)), JSON.stringify(rejected));
    assert.deepEqual(await plan(p), before);
    await shot(p, 'resource-final-desktop-inspector');
    await p.getByRole('button', { name: 'Inspector schließen', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await inspector(p).waitFor({ state: 'hidden' });
    assert.deepEqual(await plan(p), before);
    await c.close();
  });

  await check('Final: A whitespace-only block title still produces a valid actual family download', async () => {
    const c = await context(), p = await open(c);
    await addBlock(p, { name: '   ', percent: 50 });
    const block = (await plan(p)).blocks.find(b => b.name === '   ');
    assert(block);
    const download = await nativeDownload(p, 'Product Family · JSON');
    const pack = JSON.parse(download.text);
    assert.equal(pack.entities.find(e => e.kind === 'resource.block' && e.id === block.id).title, 'Sperrzeit');
    assert.equal(pack.natives.find(n => n.source.appId === 'resource-atlas').data.plan.blocks.find(b => b.id === block.id).name, '   ');
    await c.close();
  });

  await check('Final: Null and non-object saved preferences fall back to usable defaults', async () => {
    for (const raw of ['null', '[]', 'false', '"dark"']) {
      const c = await context();
      await c.addInitScript(raw => localStorage.setItem('opf.preferences.v1.resource-atlas', raw), raw);
      const p = await open(c);
      assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'dark');
      precise((await calc(p)).totals.netPt, 164);
      await c.close();
    }
    return { malformedPreferenceFixtures: 4 };
  });

  await check('Final: Changing plans resets connection targets and removed local targets cannot create links', async () => {
    const c = await context(), p = await open(c);
    const before = await plan(p);
    const source = { appId: 'component-atlas', workspaceId: 'qa-library', workspaceTitle: 'QA definition library' };
    const record = { id: 'qa-component', kind: 'ui.component', title: 'QA component', source, ref: 'opf://component-atlas/qa-library/ui.component/qa-component', data: {} };
    const pack = { format: 'obsidian-product-family', schemaVersion: 1, packageId: 'qa-family-package', exportedAt: '2026-10-11T00:00:00.000Z', source, completeSources: ['component-atlas/qa-library'], entities: [record], links: [], natives: [{ source, data: { id: 'qa-library' } }] };
    await p.evaluate(pack => window.ProductFamily.importPackage(pack), pack);
    await p.getByRole('button', { name: 'Verknüpfungen anzeigen', exact: true }).click();
    await choose(p, '#connection-local', 'UX / UI Design · role');
    await p.evaluate(candidate => window.ResourceAtlas.replacePlan(candidate), { ...before, id: 'qa-second-plan', name: 'Zweiter Ressourcenplan' });
    await p.evaluate(pack => window.ProductFamily.importPackage(pack), pack);
    assert.match(await p.locator('#connection-local').innerText(), /Aktueller Ressourcenplan/);
    await p.getByRole('button', { name: 'Verknüpfung anlegen', exact: true }).click();
    let registry = await p.evaluate(() => window.ProductFamily.getRegistry());
    assert.equal(registry.links.length, 1);
    assert.equal(registry.links[0].from, 'opf://resource-atlas/qa-second-plan/resource.plan/qa-second-plan');
    await choose(p, '#connection-local', 'UX / UI Design · role');
    await p.evaluate(() => {
      const candidate = window.ResourceAtlas.getPlan();
      candidate.roles = candidate.roles.filter(r => r.id !== 'role-ux');
      candidate.allocations = candidate.allocations.filter(a => a.roleId !== 'role-ux');
      candidate.blocks = candidate.blocks.filter(b => b.roleId !== 'role-ux');
      window.ResourceAtlas.replacePlan(candidate);
    });
    await p.getByRole('button', { name: 'Verknüpfung anlegen', exact: true }).click();
    registry = await p.evaluate(() => window.ProductFamily.getRegistry());
    assert.equal(registry.links.length, 1, 'Deleted local target must not become an unresolved new link');
    assert.match(await p.locator('.resource-notice.error').innerText(), /aktuellen Plan/);
    await c.close();
  });

  await check('Final: Failed persistence followed by another-tab change preserves the current memory-only data for recovery', async () => {
    const c = await context(), p = await open(c);
    const originalRaw = await p.evaluate(() => localStorage.getItem(window.ResourceAtlas.storageKey));
    await p.evaluate(() => {
      const native = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === window.ResourceAtlas.storageKey) throw new DOMException('Simulated quota exhaustion', 'QuotaExceededError'); return native.call(this, key, value); };
    });
    await p.getByRole('button', { name: 'Plan bearbeiten', exact: true }).click();
    await p.locator('#plan-name').fill('Nur im Arbeitsspeicher');
    await saveInspector(p);
    assert.equal((await plan(p)).name, 'Nur im Arbeitsspeicher');
    assert.equal(await p.evaluate(() => localStorage.getItem(window.ResourceAtlas.storageKey)), originalRaw);
    const warnBeforeLeaving = await p.evaluate(() => {
      const raw = JSON.stringify({ format: 'resource-atlas-local', schemaVersion: 1, state: { ...window.ResourceAtlas.getState(), activePlanId: 'different-tab' } });
      window.dispatchEvent(new StorageEvent('storage', { key: window.ResourceAtlas.storageKey, newValue: raw, storageArea: localStorage }));
      const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
    });
    assert(warnBeforeLeaving, 'Memory-only changes must still warn after the storage conflict locks editing');
    const browserDialogs = [];
    p.on('dialog', async dialog => { browserDialogs.push(dialog.type()); if (dialog.type() === 'beforeunload') await dialog.accept(); else await dialog.dismiss(); });
    const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Sicherung herunterladen', exact: true }).click()]);
    const downloaded = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(downloaded.state.plans.find(item => item.id === downloaded.state.activePlanId).name, 'Nur im Arbeitsspeicher');
    await p.getByRole('button', { name: 'Neueren Stand laden', exact: true }).waitFor();
    await c.close();
    return { browserDialogs };
  });

  await check('Final: Failed recovery cannot clear the lock or discard the original unreadable bytes', async () => {
    const c = await context(), raw = '{original unreadable resource data';
    await c.addInitScript(raw => {
      localStorage.setItem('resource-atlas.workspace.v1', raw);
      const native = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === 'resource-atlas.workspace.v1') throw new DOMException('Simulated quota exhaustion', 'QuotaExceededError'); return native.call(this, key, value); };
    }, raw);
    const p = await open(c);
    await p.getByRole('button', { name: 'Neu beginnen', exact: true }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Neu beginnen', exact: true }).click();
    await p.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await p.evaluate(() => localStorage.getItem(window.ResourceAtlas.storageKey)), raw);
    const locked = await p.evaluate(() => { try { const candidate = window.ResourceAtlas.getPlan(); candidate.name = 'Rejected'; window.ResourceAtlas.replacePlan(candidate); return false; } catch { return true; } });
    assert(locked);
    const browserDialogs = [];
    p.on('dialog', async dialog => { browserDialogs.push(dialog.type()); if (dialog.type() === 'beforeunload') await dialog.accept(); else await dialog.dismiss(); });
    const [download] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Sicherung herunterladen', exact: true }).click()]);
    assert.equal(await fs.readFile(await download.path(), 'utf8'), raw);
    await c.close();
    return { browserDialogs };
  });

  await check('Final: Narrow labels, phone inspector and phone role overview remain usable after the polish batch', async () => {
    for (const width of [1024, 390]) {
      const c = await context({ viewport: { width, height: 900 }, ...(width === 390 ? { isMobile: true, hasTouch: true } : {}) });
      const p = await open(c);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      if (width === 1024) await shot(p, 'resource-final-1024-timeline');
      if (width === 390) {
        await p.getByRole('button', { name: 'Einsatz hinzufügen', exact: true }).click();
        await inspector(p).getByRole('button', { name: 'Gesamte Planlaufzeit', exact: true }).waitFor();
        const bounds = await inspector(p).boundingBox();
        assert(bounds.x >= -1 && bounds.x + bounds.width <= 391);
        const action = await inspector(p).locator('button[type=submit]').boundingBox();
        assert(action.y + action.height <= 901);
        await shot(p, 'resource-final-390-inspector');
        await p.getByRole('button', { name: 'Inspector schließen', exact: true }).click();
        await inspector(p).waitFor({ state: 'hidden' });
        await p.getByRole('button', { name: 'Menü öffnen', exact: true }).click();
        await p.getByRole('button', { name: /Rollen & Aufwand/ }).click();
        await p.getByRole('heading', { name: 'Rollen & Aufwand', exact: true }).first().waitFor();
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await shot(p, 'resource-final-390-roles');
      }
      await c.close();
    }
  });

  await check('Final: Reserved-object-key plan IDs and maximum-length copy names retain valid independent workspaces', async () => {
    const c = await context(), p = await open(c);
    const originalPack = await p.evaluate(() => window.ProductFamily.makePackage());
    await p.evaluate(() => {
      const candidate = window.ResourceAtlas.getPlan();
      candidate.id = 'constructor'; candidate.name = 'A'.repeat(200);
      candidate.allocations[0].name = 'E'.repeat(160);
      window.ResourceAtlas.replacePlan(candidate);
    });
    assert.equal((await plan(p)).id, 'constructor');
    await p.evaluate(pack => window.ProductFamily.importPackage(pack), originalPack);
    const exported = await p.evaluate(() => window.ProductFamily.makePackage());
    assert.equal(exported.source.workspaceId, 'constructor');
    assert(exported.entities.some(record => record.source.workspaceId === originalPack.source.workspaceId));
    await p.getByRole('button', { name: 'Einstellungen öffnen', exact: true }).click();
    await p.getByRole('button', { name: 'Plan duplizieren', exact: true }).click();
    const copy = await plan(p);
    assert.notEqual(copy.id, 'constructor'); assert.equal(copy.name.length, 200); assert.match(copy.name, / · Kopie$/);
    assert.equal((await p.evaluate(() => window.ProductFamily.getRegistry())).records.length, 0);
    await p.getByRole('button', { name: 'Einsatzplan anzeigen', exact: true }).click();
    await p.locator('.rt-allocation-shell[data-allocation-id="allocation-ux-concept"] .rt-allocation').click();
    await inspector(p).getByRole('button', { name: 'Einsatz duplizieren', exact: true }).click();
    const name = await p.locator('#allocation-name').inputValue();
    assert.equal(name.length, 160); assert.match(name, / · Kopie$/);
    await saveInspector(p);
    assert.equal((await plan(p)).allocations.length, 8);
    await p.evaluate(() => window.ProductFamily.makePackage());
    await c.close();
  });

  await check('Final: No page errors or external HTTP requests in the targeted correction checks', async () => {
    assert.equal(errors.length, 0, JSON.stringify(errors));
    assert.equal(requests.length, 0, JSON.stringify(requests));
  });
} finally {
  await Promise.allSettled(contexts.map(c => c.close()));
  await browser.close();
  const reportPath = path.join(qa, finalOnly ? 'browser-final-result.json' : 'browser-result.json');
  let report = { passed: checks.every(c => c.passed), checks, errors, requests, screenshots };
  if (onlyMatches) {
    let previous;
    try { previous = JSON.parse(await fs.readFile(reportPath, 'utf8')); } catch {}
    if (previous) {
      const combined = new Map(previous.checks.map(check => [check.name, check]));
      for (const check of checks) combined.set(check.name, check);
      report = { ...report, checks: [...combined.values()], errors: [...previous.errors, ...errors], requests: [...previous.requests, ...requests], screenshots: [...new Set([...previous.screenshots, ...screenshots])], focusedRerun: { pattern: onlyMatches.source, groups: checks.map(check => check.name) } };
      report.passed = report.checks.every(check => check.passed) && !report.errors.length && !report.requests.length;
    }
  }
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, screenshots: screenshots.length, errors: errors.length, requests: requests.length }));
  if (!report.passed) process.exitCode = 1;
}
