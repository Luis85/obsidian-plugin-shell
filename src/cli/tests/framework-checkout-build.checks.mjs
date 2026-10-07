import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { npmEntry } from '../adapters/framework/process.ts';
import { verifyKit } from '../adapters/framework/kit-integrity.ts';
import { extractArchive } from './framework-archive-fixture.mjs';

const repository = fileURLToPath(new URL('../../../', import.meta.url));

test('a clean source snapshot builds a complete CLI that runs outside the checkout', { timeout: 180000 }, async t => {
  const scratch = await realpath(await mkdtemp(join(tmpdir(), 'workbench-checkout-')));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const checkout = join(scratch, 'checkout'), portable = join(scratch, 'portable');
  await mkdir(checkout); await mkdir(portable);
  const inputs = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: repository, encoding: 'utf8', maxBuffer: 4_000_000,
  }).split('\0').filter(Boolean);
  assert.ok(inputs.length > 0, 'exercise a real source inventory');
  assert.deepEqual(inputs.filter(path => path.startsWith('bin/')), [], 'generated build output must stay outside the source inventory');
  // Include new consumer features alongside their edited registrations, excluding ignored build output.
  // A locally built bin must not conceal a broken build from the source snapshot.
  for (let offset = 0; offset < inputs.length; offset += 32) {
    await Promise.all(inputs.slice(offset, offset + 32).map(async path => {
      await mkdir(dirname(join(checkout, path)), { recursive: true });
      await cp(join(repository, path), join(checkout, path));
    }));
  }
  assert.ok(!(await readdir(checkout)).includes('bin'));
  await symlink(join(repository, 'node_modules'), join(checkout, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  execFileSync(process.execPath, ['tooling/bundling/build-cli.mjs'], {
    cwd: checkout, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000,
  });
  // Packaging through the compiled CLI must retain the shipped compiler's identity.
  // Direct source calls alone cannot detect a broken bundled TypeScript import.
  const archive = join(scratch, 'framework.zip'), repacked = join(scratch, 'repacked');
  const packed = spawnSync(process.execPath, ['bin/app', 'framework', 'pack', '--out', archive, '--yes', '--json'], {
    cwd: checkout, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000,
  });
  assert.equal(packed.error, undefined, packed.error?.message);
  const identity = JSON.parse(await readFile(join(checkout, 'manifest.json'), 'utf8'));
  if (identity.id === 'plugin-shell') {
    assert.equal(packed.status, 0, packed.stdout + packed.stderr);
    await mkdir(repacked);
    await extractArchive(await readFile(archive), repacked);
    const kit = await verifyKit(repacked);
    const pkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
    assert.equal(kit.compilerVersion, pkg.devDependencies.typescript);
  } else {
    // Renamed-template qualification must retain the consumer's distribution boundary.
    assert.equal(packed.status, 1, packed.stdout + packed.stderr);
    assert.equal(JSON.parse(packed.stdout).diagnostics[0].code, 'KIT_AUTHORING_ROOT');
    assert.ok(!(await readdir(scratch)).includes('framework.zip'), 'refused consumer packaging writes no archive');
  }
  await cp(join(checkout, 'bin'), join(portable, 'bin'), { recursive: true });
  assert.deepEqual(await readdir(portable), ['bin']);
  for (const args of [['version'], ['framework', 'status']]) {
    const output = execFileSync(process.execPath, ['bin/app', ...args, '--json'], {
      cwd: portable, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, PATH: dirname(process.execPath), NODE_PATH: '' },
    });
    assert.equal(JSON.parse(output).status, 'ok', output);
  }
  const npm = await npmEntry();
  const typecheck = () => spawnSync(process.execPath, [npm, 'run', 'typecheck'], {
    cwd: checkout, encoding: 'utf8', timeout: 60000, maxBuffer: 4_000_000,
  });
  const valid = typecheck();
  assert.equal(valid.error, undefined, valid.error?.message);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  for (const folder of ['src/plugin/domain', 'src/cli/domain']) {
    await t.test(`the public typecheck rejects a real error under ${folder}`, async () => {
      const probe = join(checkout, folder, 'ci-type-probe.ts');
      try {
        await writeFile(probe, 'export const value: number = "invalid";\n');
        const invalid = typecheck();
        assert.equal(invalid.error, undefined, invalid.error?.message);
        assert.equal(invalid.status, 2, invalid.stdout + invalid.stderr);
        assert.match(invalid.stdout, /ci-type-probe\.ts.*TS2322/);
      } finally { await rm(probe, { force: true }); }
    });
  }
});
