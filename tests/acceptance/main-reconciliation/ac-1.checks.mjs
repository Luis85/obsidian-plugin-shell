// Increment: [[docs/increments/main-reconciliation]] — portable built CLI and authoring tools.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { verifyKit } from '../../../src/cli/adapters/framework/kit-integrity.ts';
import { starterDocument } from '../../support/starter-documents.mjs';
const source = fileURLToPath(new URL('../../../', import.meta.url));

test('a copied bin runs, generates a project and authors a feature without source checkout or node_modules', { timeout: 180000 }, async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'portable-workbench-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(join(source, 'bin'), join(root, 'bin'), { recursive: true });
  assert.deepEqual(await readdir(root), ['bin']);
  const kit = await verifyKit(root);
  const invoke = (args, expectedExit = 0) => {
    const run = spawnSync(process.execPath, [join(root, 'bin/app'), ...args, '--json'], {
      cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 16_000_000,
      env: { ...process.env, PATH: dirname(process.execPath), NODE_PATH: '' },
    });
    assert.equal(run.error, undefined, run.error?.message);
    assert.equal(run.status, expectedExit, run.stderr + run.stdout);
    return JSON.parse(run.stdout);
  };
  const cli = (...args) => invoke(args);
  for (const command of ['version', 'help', 'schema', 'capabilities']) assert.equal(cli(command).status, 'ok', command);
  await mkdir(join(root, 'src/cli'), { recursive: true });
  await writeFile(join(root, 'src/cli/app.ts'), 'throw new Error("development source must not execute");');
  await writeFile(join(root, 'package.json'), '{"name":"unrelated-project","version":"9.9.9"}');
  const version = cli('version').data;
  assert.equal(version.distribution, 'compiled-kit');
  assert.equal(version.frameworkVersion, kit.version, 'a built app keeps its own identity beside unrelated development sources');
  await rm(join(root, 'src'), { recursive: true }); await rm(join(root, 'package.json'));
  assert.equal(cli('framework', 'status').status, 'ok');
  const input = starterDocument('blank'); input.project.author = 'Portable fixture';
  await writeFile(join(root, 'project-input.json'), JSON.stringify(input));
  assert.equal(cli('setup', '--input', 'project-input.json', '--yes').status, 'applied');
  assert.equal(cli('generate', '--yes').status, 'applied');
  assert.ok(!(await readdir(root)).includes('node_modules'));
  assert.equal(cli('make', 'feature', 'portable-notes', '--entity', 'portable-note').status, 'planned');
  const made = invoke(['make', 'feature', 'portable-notes', '--entity', 'portable-note', '--yes'], 1);
  assert.equal(made.status, 'failed');
  assert.ok(made.diagnostics.some(item => item.code === 'MAKER_CHECKS_FAILED'), 'source is authored; project checks honestly require installed project dependencies');
  assert.match(await readFile(join(root, 'src/features/portable-notes/portable-note.entity.ts'), 'utf8'), /portable/);
  assert.ok(!(await readdir(root)).includes('node_modules'));
  await verifyKit(root);
});
