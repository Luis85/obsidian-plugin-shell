// Increment: [[docs/increments/release-kit-downloads]]
// AC-2: The extracted with-starters kit, without `node_modules`, runs the README quick start (`new --list`, a preview that writes nothing, then `--yes`) and produces a plugin project with `package.json`, `manifest.json` and `AGENTS.md`; the CLI-only kit lists no starters.
// Uses only the extracted files: no repository checkout on the path, no node_modules and no global install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractArchive } from '../../../src/cli/tests/support/framework-archive-fixture.mjs';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const run = (app, cwd, args) => spawnSync(process.execPath, [app, ...args], { cwd, encoding: 'utf8', timeout: 300_000, maxBuffer: 50_000_000 });
const json = (app, cwd, args) => { const result = run(app, cwd, [...args, '--json']); return { status: result.status, result: JSON.parse(result.stdout || 'null'), stderr: result.stderr }; };
const exists = path => access(path).then(() => true, () => false);
const framework = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')).id === 'plugin-shell'
  && !await exists(join(root, 'shell.config.json')) && !await exists(join(root, '.companion/generation.json'));

test('[AC-2] the README quick start scaffolds a plugin from the extracted with-starters kit; the CLI-only kit has no starters', { skip: !framework && 'only the framework checkout packs kits' }, async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'kit-quick-start-'))); t.after(() => rm(folder, { recursive: true, force: true }));
  const workbench = join(folder, 'workbench'), lean = join(folder, 'lean');
  for (const [kit, extra] of [[workbench, ['--with-starters']], [lean, []]]) {
    const archive = kit + '.zip';
    const packed = json(join(root, 'bin/app'), root, ['framework', 'pack', ...extra, '--out', archive, '--yes']);
    assert.equal(packed.status, 0, JSON.stringify(packed.result?.diagnostics) + packed.stderr);
    await mkdir(kit); await extractArchive(await readFile(archive), kit);
    assert.equal(await exists(join(kit, 'node_modules')), false);
  }
  assert.deepEqual(json(join(lean, 'bin/app'), lean, ['new', '--list']).result.data.starters, []);

  // The README's commands, in its order, from inside the extracted folder.
  const app = join(workbench, 'bin/app'), readme = await readFile(join(workbench, 'README.md'), 'utf8');
  const request = ['new', '../my-notes', '--starter', 'blank', '--id', 'my-notes', '--name', 'My Notes', '--author', 'Your Name'];
  assert.ok(readme.includes('node bin/app new ../my-notes --starter blank --id my-notes --name "My Notes" --author "Your Name" --yes'));
  const listed = run(app, workbench, ['new', '--list']);
  assert.equal(listed.status, 0, listed.stderr); assert.match(listed.stdout, /^\s+blank\s/m);
  const preview = run(app, workbench, request);
  assert.equal(preview.status, 0, preview.stderr); assert.match(preview.stdout, /No files or processes changed/);
  assert.equal(await exists(join(folder, 'my-notes')), false, 'the preview writes nothing');
  const created = run(app, workbench, [...request, '--no-git', '--yes']);
  assert.equal(created.status, 0, created.stdout + created.stderr);
  const project = join(folder, 'my-notes');
  for (const file of ['package.json', 'manifest.json', 'AGENTS.md']) assert.ok(await exists(join(project, file)), file);
  assert.equal(JSON.parse(await readFile(join(project, 'manifest.json'), 'utf8')).id, 'my-notes');
  assert.ok(!(await readdir(project)).includes('node_modules'), 'scaffolding installs nothing');
});
