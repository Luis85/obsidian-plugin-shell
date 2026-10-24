// Increment: [[docs/increments/cli-release-downloads]]
// AC-4: The shell and starters ZIPs packed from this checkout, extracted into one empty folder without `node_modules`, run `node bin/app new` with a starter and produce the project's `package.json`, `manifest.json` and `AGENTS.md`.
// Packs both downloads with the same commands the Release tier runs (starter-distribution.yml), then uses only the
// extracted files: no repository checkout, no node_modules and no global install.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractArchive } from '../../../src/cli/tests/support/framework-archive-fixture.mjs';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const cli = (app, cwd, args) => {
  const result = spawnSync(process.execPath, [app, ...args, '--json'], { cwd, encoding: 'utf8', timeout: 300_000, maxBuffer: 50_000_000 });
  return { status: result.status, result: JSON.parse(result.stdout || 'null'), stderr: result.stderr };
};

// Only the framework checkout packs release downloads; a renamed or generated consumer (CI's template-authoring legs)
// must keep refusing, as tooling/tests/framework-checkout-build.checks.mjs also asserts.
const exists = path => access(join(root, path)).then(() => true, () => false);
const framework = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')).id === 'plugin-shell'
  && !await exists('shell.config.json') && !await exists('.companion/generation.json');

test('[AC-4] the extracted shell and starters downloads scaffold a plugin without node_modules', async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'cli-downloads-'))); t.after(() => rm(folder, { recursive: true, force: true }));
  const shellZip = join(folder, `workbench-shell-${version}.zip`), startersZip = join(folder, `workbench-starters-${version}.zip`);
  if (!framework) {
    const refused = cli(join(root, 'bin/app'), root, ['framework', 'pack', '--out', shellZip, '--yes']);
    assert.equal(refused.status, 1, refused.stderr); assert.equal(refused.result.diagnostics[0].code, 'KIT_AUTHORING_ROOT');
    await assert.rejects(access(shellZip), { code: 'ENOENT' }, 'a consumer checkout writes no release download');
    return;
  }
  for (const [kind, out] of [['framework', shellZip], ['starters', startersZip]]) {
    const packed = cli(join(root, 'bin/app'), root, [kind, 'pack', '--out', out, '--yes']);
    assert.equal(packed.status, 0, `${kind} pack: ${JSON.stringify(packed.result?.diagnostics)} ${packed.stderr}`);
    assert.equal(packed.result.data.publication, 'not-authorized');
  }
  const download = join(folder, 'download'); await mkdir(download);
  for (const archive of [shellZip, startersZip]) await extractArchive(await readFile(archive), download);
  await assert.rejects(access(join(download, 'node_modules')), { code: 'ENOENT' });
  const app = join(download, 'bin/app');
  const listed = cli(app, download, ['starters', 'list']);
  assert.equal(listed.status, 0, listed.stderr); assert.ok(listed.result.data.starters.some(starter => starter.id === 'quick-capture'));
  const created = cli(app, download, ['new', '../my-plugin', '--starter', 'quick-capture', '--yes']);
  assert.equal(created.status, 0, JSON.stringify(created.result?.diagnostics) + created.stderr);
  const project = join(folder, 'my-plugin');
  for (const file of ['package.json', 'manifest.json', 'AGENTS.md']) await access(join(project, file));
  assert.equal(JSON.parse(await readFile(join(project, 'manifest.json'), 'utf8')).id.length > 0, true);
  assert.ok(!(await readdir(project)).includes('node_modules'), 'scaffolding installs nothing');
});
