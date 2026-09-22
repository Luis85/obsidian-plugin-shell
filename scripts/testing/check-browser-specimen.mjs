/** Optional pre-provisioned Playwright probe. Served and inline results are never conflated. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createFixtureServer } from '../harness/serve-style-fixture.mjs';
import { sourceInputs, sha256 } from './source-inputs.mjs';
import { createFaultLedger } from './fault-ledger.mjs';
import { validatePlan } from './test-plan.mjs';
import { inlineSpecimen } from './browser-input.mjs';
import { specimenChecks } from '../../tests/browser-specimen/specimen.checks.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const options = { mode: 'served', repeat: 2, driver: null, browser: null };
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--mode') options.mode = process.argv[++i];
  else if (flag === '--repeat') options.repeat = Number(process.argv[++i]);
  else if (flag === '--driver') options.driver = process.argv[++i];
  else if (flag === '--browser') options.browser = process.argv[++i];
  else if (flag === '--help') {
    console.log('node scripts/testing/check-browser-specimen.mjs [--mode served|inline] [--repeat 2..5] [--driver /absolute/preprovisioned/playwright/index.mjs] [--browser /absolute/chromium]');
    process.exit(0);
  } else throw new Error('UNKNOWN_ARGUMENT');
}
if (!['served','inline'].includes(options.mode) || !Number.isInteger(options.repeat) ||
    options.repeat < 2 || options.repeat > 5 || (options.driver && !isAbsolute(options.driver)) || (options.browser && !isAbsolute(options.browser))) throw new Error('INVALID_OPTIONS');
const mode = options.mode === 'served' ? 'browser-specimen' : 'browser-inline-diagnostic';
const input = await sourceInputs(root);
const directory = resolve(root,'reports/browser-specimen',`run-${Date.now()}-${randomUUID()}`);
await mkdir(directory, { recursive: true });
let browser; let server; let fatal = null; let browserVersion = null; let driverVersion = null;
const runs = [];
const watchdog = setTimeout(() => { console.error('BROWSER_RUN_TIMEOUT'); process.exit(2); }, 120000);
try {
  const plan = validatePlan(JSON.parse(await readFile(resolve(root,'docs/testing/test-plan.json'),'utf8')));
  const expected = plan.suites.find((s) => s.id === 'browser-specimen').testIds;
  if (JSON.stringify(expected) !== JSON.stringify(specimenChecks.map((c) => c.id))) throw new Error('BROWSER_INVENTORY_MISMATCH');
  // Explicit trusted local module override only; no downloads or unpinned npx execution.
  const api = await import(options.driver ? pathToFileURL(options.driver).href : '@playwright/test');
  if (options.driver) {
    const pkg = JSON.parse(await readFile(resolve(dirname(options.driver),'package.json'),'utf8'));
    driverVersion = { name: pkg.name, version: pkg.version };
  }
  browser = await api.chromium.launch({ headless: true, ...(options.browser ? { executablePath:options.browser } : {}) }); browserVersion = browser.version();
  let url;
  if (options.mode === 'served') {
    server = createFixtureServer();
    await new Promise((ok, bad) => { server.once('error', bad); server.listen(0,'127.0.0.1',ok); });
    url = `http://127.0.0.1:${server.address().port}/harness/style-fixture/`;
  }
  const html = options.mode === 'inline' ? await inlineSpecimen(root) : null;
  for (let repetition = 0; repetition < options.repeat; repetition++) {
    const results = [];
    for (const check of specimenChecks) {
      const context = await browser.newContext({ viewport: { width:1280,height:900 },
        locale:'en-US', timezoneId:'UTC', colorScheme:'dark', reducedMotion:'reduce', serviceWorkers:'block' });
      await context.tracing.start({ screenshots:true, snapshots:true });
      const page = await context.newPage(); page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(5000);
      const ledger = createFaultLedger();
      page.on('pageerror', () => ledger.record('PAGE_ERROR','specimen'));
      page.on('console', (message) => { if (message.type() === 'error') ledger.record('CONSOLE_ERROR','specimen'); });
      page.on('requestfailed', () => ledger.record('REQUEST_FAILED','specimen'));
      await context.route('**/*', async (route) => {
        const requested = new URL(route.request().url());
        if (url && requested.origin === new URL(url).origin) await route.continue();
        else { ledger.record('UNEXPECTED_NETWORK','specimen'); await route.abort(); }
      });
      let result;
      try {
        await page.clock.setFixedTime(new Date('2026-09-22T10:00:00Z'));
        if (html) await page.setContent(html); else await page.goto(url);
        await page.waitForFunction(() => document.body.dataset.fixtureReady === 'true');
        const observed = await check.run({ page, ledger }); ledger.assertExpected(check.expected ?? []);
        result = { id:check.id, status:'passed', observed };
        if (repetition === 0 && ['BRW-01','BRW-02'].includes(check.id)) await page.screenshot({ path:resolve(directory,`${check.id}.png`),fullPage:true });
      } catch (error) {
        result = { id:check.id, status:String(error.message).includes('ERR_BLOCKED_BY_ADMINISTRATOR') ? 'infrastructure-error' : 'failed', reason:String(error.message).slice(0,1500), faults:ledger.snapshot() };
        await page.screenshot({ path:resolve(directory,`${repetition}-${check.id}-failure.png`),fullPage:true }).catch(() => {});
      } finally {
        await context.tracing.stop({ path:resolve(directory,`${repetition}-${check.id}.zip`) }); await context.close();
      }
      results.push(result);
    }
    runs.push(results);
  }
} catch (error) { fatal = String(error.message).slice(0,1500); }
finally {
  clearTimeout(watchdog);
  if (browser) await browser.close();
  if (server) { server.closeAllConnections(); await new Promise((ok) => server.close(ok)); }
}
const after = await sourceInputs(root);
const outcomeDigests = runs.map((run) => sha256(JSON.stringify(run.map(({id,status,observed}) => ({id,status,observed})))));
const passed = !fatal && after.digest === input.digest && runs.length === options.repeat &&
  runs.every((run) => run.length === specimenChecks.length && run.every((r) => r.status === 'passed')) && new Set(outcomeDigests).size === 1;
const report = { schemaVersion:1, mode, status:passed?'passed':(fatal || runs.some((run) => run.some((r) => r.status === 'infrastructure-error')))?'infrastructure-error':'failed',
  fatal, inputDigest:input.digest, browserVersion, driverVersion, explicitBrowserOverride:Boolean(options.browser), node:process.version,
  timezone:'UTC', fixedTime:'2026-09-22T10:00:00Z', repetitions:runs.length, retries:0,
  outcomeDigests, runs, releaseReady:false, nativeVerified:false,
  limitation:options.mode==='inline'?'No served navigation, CSS import loading, or response CSP proof.':'Standalone fixture only; no real Vue/plugin runtime.' };
await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({ status:report.status, mode, repetitions:runs.length, checksPerRun:specimenChecks.length,
  report:relative(root,resolve(directory,'report.json')).split('\\').join('/'), releaseReady:false }));
process.exitCode = passed?0:report.status === 'infrastructure-error'?2:1;
