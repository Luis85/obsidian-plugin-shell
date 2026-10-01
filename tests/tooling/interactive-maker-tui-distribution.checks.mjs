import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { assembleKit, installedCompiler } from '../../scripts/framework/kit.ts';
import { assembleStarterPack } from '../../scripts/starters/operations.ts';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
const frameworkRoot = resolve(import.meta.dirname, '../..');
let compilerVersion;
try { compilerVersion = JSON.parse(await readFile(join(frameworkRoot, 'node_modules/typescript/package.json'), 'utf8')).version; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const qualified = compilerVersion === '6.0.3';
if (process.env.CI && process.env.CI !== 'false') assert.equal(qualified, true, 'CI requires repository-local TypeScript 6.0.3.');
const check = qualified ? test : test.skip;
check('compiled maker kit discovers contracts without dependencies and refuses repacking an example-removed consumer', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-compiled-'));
  try {
    const compiler = await installedCompiler(); assert.equal(compiler.version, '6.0.3');
    if (await reviewedExamplesRemoved(frameworkRoot)) {
      // Consumer verification has no pristine showcase to package. Enforce that boundary instead.
      await assert.rejects(assembleKit({ root, frameworkRoot }, compiler), { code: 'KIT_OWNERSHIP' });
      await assert.rejects(readFile(join(root, 'app.mjs')), { code: 'ENOENT' });
      return;
    }
    const files = await assembleKit({ root, frameworkRoot }, compiler);
    // Extract exactly the release's executable files and launcher, without template dependencies.
    for (const file of files.filter(item => item.path.startsWith('.framework/compiled/') || ['app.mjs', 'bin/app', 'shell.mjs'].includes(item.path))) {
      const target = join(root, file.path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.bytes);
    }
    await assert.rejects(() => readFile(join(root, 'node_modules/typescript/package.json')));
    // The shell carries no starters: project creation and setup wait for the separate pack.
    const bare = spawnSync(process.execPath, ['bin/app', 'new', 'starters', '--json'], { cwd: root, encoding: 'utf8', timeout: 20000 });
    assert.equal(bare.status, 0, bare.stderr + bare.stdout); assert.deepEqual(JSON.parse(bare.stdout).data.starters, []);
    const noSetup = spawnSync(process.execPath, ['shell.mjs', 'project-setup', 'guide', '--json'], { cwd: root, encoding: 'utf8', timeout: 20000 });
    assert.equal(noSetup.status, 1); assert.equal(JSON.parse(noSetup.stdout).diagnostics[0].code, 'PROJECT_STARTER_UNKNOWN');
    for (const file of await assembleStarterPack({ root: frameworkRoot, frameworkRoot })) {
      const target = join(root, file.path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.bytes);
    }
    for (const args of [['studio', '--help', '--json'], ['sketch', 'schema', '--json'], ['prototype', 'guide', '--json'], ['project-setup', 'schema', '--json'], ['project-setup', 'guide', '--json'], ['first-run', 'schema', '--json'], ['first-run', 'status', '--json'], ['settings', 'schema', '--json'], ['settings', 'show', '--json'], ['new', 'starters', '--json'], ['new', 'guide', '--starter', 'cli', '--json']]) {
      // Alternate the extensionless entry and the legacy shim; both must reach the compiled maker.
      const run = spawnSync(process.execPath, [args[0] === 'settings' ? 'shell.mjs' : 'bin/app', ...args], { cwd: root, encoding: 'utf8', timeout: 20000 });
      assert.equal(run.status, 0, run.stderr + run.stdout);
      const result = JSON.parse(run.stdout); assert.equal(result.status, 'ok');
      if (args[0] === 'studio') assert.match(result.data.help, /--ui <auto\|tui\|plain>/);
      if (args[0] === 'new') assert.ok(args[1] === 'starters' ? result.data.starters.length === 11 : result.data.selection.framework === 'none');
      if (args[0] === 'project-setup' && args[1] === 'guide') assert.equal(result.data.selection.starter.id, 'webapp-angular');
      if (args[0] === 'prototype') assert.equal(result.data.guide.id, 'companion-prototype');
    }
    const screen = await readFile(join(root, '.framework/compiled/bin/presentation/tui/session.js'), 'utf8');
    assert.match(screen, /node:readline/); assert.ok(!screen.includes("from './state.ts'"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
