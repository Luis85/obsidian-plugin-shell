/** Windows root aliases (case and 8.3 spellings) through the shared file plan and the real dependency-free setup dry run. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, rm, access, realpath, cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createFilePlan, applyFilePlan } from '../../src/shared/platform/file-plan.ts';
async function fixture(work) {
  const root = await mkdtemp(join(tmpdir(), 'template-file-plan-'));
  try { await work(root); } finally { await rm(root, { recursive: true, force: true }); }
}

async function setupDryRun(alias, canonical) {
  const source = fileURLToPath(new URL('../../', import.meta.url));
  // The dependency-free setup entry plus its complete relative import closure, kept at the repository layout.
  for (const path of ['tooling/setup.mjs', 'tooling/setup', 'src/shared/platform', 'src/cli/tooling/agent/mcp-config.mjs', 'src/shared/companion/schema/hosting.mjs', 'configs/forms/setup-identity.json']) {
    await mkdir(dirname(join(canonical, path)), { recursive: true }); await cp(join(source, path), join(canonical, path), { recursive: true });
  }
  for (const name of ['manifest.json', 'package.json', 'package-lock.json', 'versions.json']) await cp(join(source, name), join(canonical, name));
  const result = spawnSync(process.execPath, [join(alias, 'tooling/setup.mjs'), '--dry-run', '--json'], { cwd: alias, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stdout + result.stderr); assert.equal(JSON.parse(result.stdout).dryRun, true);
  await assert.rejects(access(join(canonical, '.template-state')));
}
test('[PLAN-03-09] Windows root case aliases support setup while destination case collisions still fail', { skip: process.platform !== 'win32' }, () => fixture(async root => {
  const canonical = await realpath(root); const alias = canonical.toUpperCase();
  const plan = await createFilePlan(alias, [{ path: 'created.txt', content: 'safe' }]);
  assert.equal(plan.root, canonical); await applyFilePlan(plan);
  assert.equal(await readFile(join(canonical, 'created.txt'), 'utf8'), 'safe');
  await assert.rejects(createFilePlan(alias, [{ path: 'Created.txt', content: 'different' }]), /CASE_COLLISION/);
  await setupDryRun(alias, canonical);
}));

test('[PLAN-03-10] real Windows 8.3 aliases support safe plans and dependency-free setup dry run', { skip: process.platform !== 'win32' }, t => fixture(async root => {
  const canonical = await realpath(root);
  const short = spawnSync('cmd.exe', ['/d', '/v:off', '/s', '/c', 'for %I in ("%PLAN_TEST_DIRECTORY%") do @echo "%~sI"'], {
    encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true, env: { ...process.env, PLAN_TEST_DIRECTORY: canonical }, timeout: 10000,
  });
  assert.equal(short.status, 0, short.stderr); const alias = short.stdout.trim().replace(/^"|"$/g, '');
  assert.equal(await realpath(alias), canonical);
  if (!alias.includes('~') || alias.toLowerCase() === canonical.toLowerCase()) { t.skip('This fixture has no 8.3 spelling; actual case-alias setup and junction regressions still run'); return; }
  const plan = await createFilePlan(alias, [{ path: 'through-alias.txt', content: 'safe' }]); assert.equal(plan.root, canonical);
  await applyFilePlan(plan); assert.equal(await readFile(join(canonical, 'through-alias.txt'), 'utf8'), 'safe');
  await setupDryRun(alias, canonical);
}));
