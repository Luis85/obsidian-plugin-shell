// Increment: [[docs/increments/release-kit-downloads]]
// AC-1: `node bin/app framework pack --with-starters --out <zip> --yes` packs every installed starter as `configs/starters/<id>.json` beside `bin/`, while `framework pack` without the flag packs none, and both extracted kits pass `framework status`.
// Runs the checkout's real CLI; a generated consumer must keep refusing to pack, as in cli-release-downloads AC-4.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractArchive } from '../../../src/cli/tests/support/framework-archive-fixture.mjs';

const root = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
const cli = (app, cwd, args) => {
  const result = spawnSync(process.execPath, [app, ...args, '--json'], { cwd, encoding: 'utf8', timeout: 300_000, maxBuffer: 50_000_000 });
  return { status: result.status, result: JSON.parse(result.stdout || 'null'), stderr: result.stderr };
};
const exists = path => access(join(root, path)).then(() => true, () => false);
const framework = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')).id === 'plugin-shell'
  && !await exists('shell.config.json') && !await exists('.companion/generation.json');

test('[AC-1] --with-starters adds every installed starter beside bin/; without it no starter ships; both kits verify', async t => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'kit-starters-'))); t.after(() => rm(folder, { recursive: true, force: true }));
  if (!framework) {
    const refused = cli(join(root, 'bin/app'), root, ['framework', 'pack', '--with-starters', '--out', join(folder, 'kit.zip'), '--yes']);
    assert.equal(refused.status, 1, refused.stderr); assert.equal(refused.result.diagnostics[0].code, 'KIT_AUTHORING_ROOT');
    return;
  }
  const preview = cli(join(root, 'bin/app'), root, ['framework', 'pack', '--with-starters', '--out', join(folder, 'preview.zip')]);
  assert.equal(preview.result.status, 'planned'); assert.equal(preview.result.data.starters, true);
  assert.deepEqual(await readdir(folder), [], 'a preview writes nothing');
  const installed = (await readdir(join(root, 'configs/starters'))).filter(name => name.endsWith('.json')).sort();
  assert.ok(installed.length > 0);
  for (const [name, extra, expected] of [['lean', [], []], ['full', ['--with-starters'], installed]]) {
    const archive = join(folder, `${name}.zip`), kit = join(folder, name);
    const packed = cli(join(root, 'bin/app'), root, ['framework', 'pack', ...extra, '--out', archive, '--yes']);
    assert.equal(packed.status, 0, JSON.stringify(packed.result?.diagnostics) + packed.stderr);
    assert.equal(packed.result.data.starters, expected.length);
    await mkdir(kit); await extractArchive(await readFile(archive), kit);
    const shipped = await readdir(join(kit, 'configs/starters')).catch(() => []);
    assert.deepEqual(shipped.sort(), expected, name);
    for (const file of expected) assert.deepEqual(await readFile(join(kit, 'configs/starters', file)), await readFile(join(root, 'configs/starters', file)), file);
    // Starters are data beside the kit, not kit inventory: the integrity check is the same for both downloads.
    const kitJson = JSON.parse(await readFile(join(kit, 'bin/kit.json'), 'utf8'));
    assert.ok(!kitJson.files.some(file => file.path.startsWith('configs/')), name);
    const status = cli(join(kit, 'bin/app'), kit, ['framework', 'status']);
    assert.equal(status.status, 0, JSON.stringify(status.result?.diagnostics) + status.stderr);
  }
});
