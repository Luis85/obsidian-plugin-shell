// Increment: [[docs/increments/product-family-projects]]
// AC-4: Each project builds exactly its own editor: `app.config.mjs` names the editor file that is the only file in `editors/`, `package.json` defines `check` (build and protocol tests) and `test:e2e`, and its CI runs `check` on every pull request and `test:e2e` behind the `e2e` opt-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../../..');
const FAMILY = { 'component-atlas': 'component-atlas', storyloom: 'storyloom', 'sitemap-atlas': 'sitemap-atlas', 'dissect-canvas': 'dissect' };
const runs = job => job.steps.map(step => step.run ?? '').join('\n');

for (const [name, appId] of Object.entries(FAMILY)) {
  const folder = resolve(root, 'projects', name);

  test(`[AC-4] ${name} builds only its own editor`, async () => {
    const { APP } = await import(resolve(folder, 'app.config.mjs'));
    assert.equal(APP.appId, appId);
    assert.deepEqual(await readdir(resolve(folder, 'editors')), [APP.file]);
    const index = await readFile(resolve(folder, 'index.html'), 'utf8');
    assert.match(index, new RegExp(`"appId":"${appId}"`), 'the development page selects the same editor');
  });

  test(`[AC-4] ${name} wires its gate and browser verification into scripts and CI`, async () => {
    const { scripts } = JSON.parse(await readFile(resolve(folder, 'package.json'), 'utf8'));
    assert.equal(scripts.check, 'npm run build && npm test');
    assert.equal(scripts.build, 'vite build && node scripts/package.mjs');
    assert.equal(scripts.test, 'node --test tests/protocol.test.mjs');
    assert.equal(scripts['test:e2e'], 'node tests/browser.mjs');
    const workflow = parse(await readFile(resolve(folder, '.github/workflows/ci.yml'), 'utf8'));
    assert.ok(workflow.on.pull_request, 'CI runs on pull requests');
    assert.equal(workflow.jobs.check.if, undefined, 'check always runs');
    assert.match(runs(workflow.jobs.check), /run check$/m);
    assert.match(workflow.jobs.browser.if, /'e2e'/);
    assert.match(workflow.jobs.browser.if, /inputs\.e2e == true/);
    assert.match(runs(workflow.jobs.browser), /run test:e2e$/m);
  });
}
