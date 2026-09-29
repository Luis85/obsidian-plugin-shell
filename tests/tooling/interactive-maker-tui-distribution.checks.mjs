import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { assembleKit, installedCompiler } from '../../scripts/framework/kit.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
let compilerVersion;
try { compilerVersion = JSON.parse(await readFile(join(frameworkRoot, 'node_modules/typescript/package.json'), 'utf8')).version; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const qualified = compilerVersion === '6.0.3';
if (process.env.CI && process.env.CI !== 'false') assert.equal(qualified, true, 'CI requires repository-local TypeScript 6.0.3.');
const check = qualified ? test : test.skip;
check('compiled maker kit discovers TUI and guide contracts before installing any dependencies', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-compiled-'));
  try {
    const compiler = await installedCompiler(); assert.equal(compiler.version, '6.0.3');
    const files = await assembleKit({ root, frameworkRoot }, compiler);
    // Extract exactly the release's executable files and launcher, without template dependencies.
    for (const file of files.filter(item => item.path.startsWith('.framework/compiled/') || item.path === 'shell.mjs')) {
      const target = join(root, file.path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, file.bytes);
    }
    await assert.rejects(() => readFile(join(root, 'node_modules/typescript/package.json')));
    for (const args of [['studio', '--help', '--json'], ['sketch', 'schema', '--json'], ['prototype', 'guide', '--json'], ['new', 'presets', '--json'], ['new', 'guide', '--json']]) {
      const run = spawnSync(process.execPath, ['shell.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 20000 });
      assert.equal(run.status, 0, run.stderr + run.stdout);
      const result = JSON.parse(run.stdout); assert.equal(result.status, 'ok');
      if (args[0] === 'studio') assert.match(result.data.help, /--ui <auto\|tui\|plain>/);
      if (args[0] === 'prototype') assert.equal(result.data.guide.id, 'companion-prototype');
      if (args[0] === 'new' && args[1] === 'presets') assert.equal(result.data.catalog.presets.length, 5);
      if (args[0] === 'new' && args[1] === 'guide') assert.equal(result.data.guide.id, 'project-prototype');
    }
    const screen = await readFile(join(root, '.framework/compiled/bin/presentation/tui/session.js'), 'utf8');
    assert.match(screen, /node:readline/); assert.ok(!screen.includes("from './state.ts'"));
  } finally { await rm(root, { recursive: true, force: true }); }
});
