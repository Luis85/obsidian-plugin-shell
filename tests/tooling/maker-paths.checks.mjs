import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makerFixture, installMakerFoundation, makerSourceRoot } from './maker-fixture.mjs';
import { planMaker } from '../../scripts/makers/plan.mjs';
import { parseArguments } from '../../scripts/makers/arguments.mjs';
import { applyFilePlan } from '../../scripts/shared/file-plan.mjs';

test('[MAKER-CANONICAL-ROOT] the fixture exposes its actual filesystem spelling', () => makerFixture(async root => {
  assert.equal(root, await realpath(root));
}));

test('[MAKER-SHORT-PATH] generated DOM tests run when the temporary parent uses a real Windows 8.3 alias', { skip: process.platform !== 'win32' }, async t => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'maker path qualification-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const shortened = spawnSync('cmd.exe', ['/d', '/v:off', '/s', '/c', 'for %I in ("%MAKER_TEST_DIRECTORY%") do @echo "%~sI"'], {
    encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true,
    env: { ...process.env, MAKER_TEST_DIRECTORY: temporary }, timeout: 10000,
  });
  assert.equal(shortened.status, 0, shortened.stderr);
  const alias = shortened.stdout.trim().replace(/^"|"$/g, '');
  assert.equal(await realpath(alias), temporary);
  if (!alias.includes('~') || alias.toLowerCase() === temporary.toLowerCase()) {
    t.skip('This volume did not supply an 8.3 alias; canonical-root qualification still runs'); return;
  }
  await makerFixture(async root => {
    assert.equal(root, await realpath(root));
    const child = relative(temporary, root);
    assert.ok(child && child !== '..' && !child.startsWith('..') && !isAbsolute(child));
    await installMakerFoundation(root);
    const request = parseArguments(['feature', 'records', '--entity', 'record']);
    await applyFilePlan((await planMaker(root, request)).plan);
    const run = spawnSync(process.execPath, [join(makerSourceRoot, 'node_modules/vitest/vitest.mjs'), 'run',
      'tests/runtime/generated/records-workspace-component.test.ts', 'tests/runtime/generated/records-workspace-actions.test.ts'], {
      cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(run.error, undefined, run.error?.message);
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /4 passed/);
  }, { temporaryRoot: alias });
});
