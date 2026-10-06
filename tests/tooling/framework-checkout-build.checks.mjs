import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { npmEntry } from '../../src/cli/adapters/framework/process.ts';
import { verifyKit } from '../../src/cli/adapters/framework/kit-integrity.ts';
import { extractArchive } from './framework-archive-fixture.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));

test('a fresh tracked checkout builds a complete CLI that runs outside the checkout', { timeout: 180000 }, async t => {
  const scratch = await realpath(await mkdtemp(join(tmpdir(), 'workbench-checkout-')));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const checkout = join(scratch, 'checkout'), portable = join(scratch, 'portable');
  await mkdir(checkout); await mkdir(portable);
  const tracked = execFileSync('git', ['ls-files', '--cached', '-z'], {
    cwd: repository, encoding: 'utf8', maxBuffer: 4_000_000,
  }).split('\0').filter(Boolean);
  assert.ok(tracked.length > 0, 'exercise a real source inventory');
  assert.deepEqual(tracked.filter(path => path.startsWith('bin/')), [], 'the maintainer repository must not track partial build output');
  // Copy only tracked inputs: a locally built bin must not conceal a broken clean checkout.
  for (let offset = 0; offset < tracked.length; offset += 32) {
    await Promise.all(tracked.slice(offset, offset + 32).map(async path => {
      await mkdir(dirname(join(checkout, path)), { recursive: true });
      await cp(join(repository, path), join(checkout, path));
    }));
  }
  assert.ok(!(await readdir(checkout)).includes('bin'));
  await symlink(join(repository, 'node_modules'), join(checkout, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  execFileSync(process.execPath, ['scripts/bundling/build-cli.mjs'], {
    cwd: checkout, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000,
  });
  // Packaging through the compiled CLI must retain the shipped compiler's identity.
  // Direct source calls alone cannot detect a broken bundled TypeScript import.
  const archive = join(scratch, 'framework.zip'), repacked = join(scratch, 'repacked');
  execFileSync(process.execPath, ['bin/app', 'framework', 'pack', '--out', archive, '--yes', '--json'], {
    cwd: checkout, encoding: 'utf8', timeout: 120000, maxBuffer: 4_000_000,
  });
  await mkdir(repacked);
  await extractArchive(await readFile(archive), repacked);
  const kit = await verifyKit(repacked);
  const pkg = JSON.parse(await readFile(join(checkout, 'package.json'), 'utf8'));
  assert.equal(kit.compilerVersion, pkg.devDependencies.typescript);
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
  for (const folder of ['src/domain', 'src/cli/domain']) {
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
