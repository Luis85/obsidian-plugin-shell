import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, cp, copyFile, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('foundation native driver retains separate failed attempts and their original bytes before any host launch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-attempt-retention-'));
  try {
    await cp(resolve('scripts/testing'), join(root, 'scripts/testing'), { recursive: true });
    await cp(resolve('scripts/shared'), join(root, 'scripts/shared'), { recursive: true });
    await copyFile(resolve('scripts/examples/templates/scripts__testing__check-native.mjs.txt'), join(root, 'scripts/testing/check-native.mjs'));
    await copyFile(resolve('scripts/examples/templates/scripts__testing__native-profile.json.txt'), join(root, 'scripts/testing/native-profile.json'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/manifest.json'), JSON.stringify({ id: 'retention-fixture', name: 'Retention Fixture', version: '1.0.0' }));
    await symlink(resolve('node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const execute = () => {
      const child = spawnSync(process.execPath, ['scripts/testing/check-native.mjs', '--allow-download'],
        { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 1_000_000 });
      assert.equal(child.error, undefined, child.error?.message);
      assert.equal(child.status, 1, child.stderr || child.stdout);
      const report = JSON.parse(child.stdout);
      assert.equal(report.status, 'failed');
      assert.match(report.reason, /ENOENT/);
      assert.match(report.reason, /\.native-runner.*obsidian-launcher.*package\.json/);
      assert.deepEqual(report.checks, []); assert.deepEqual(report.assets, []); assert.deepEqual(report.errors, []);
      assert.equal(report.launcherVersion, undefined); assert.equal(report.cleanupFailure, undefined);
      assert.equal(report.scratchPreserved, undefined);
      return report;
    };
    const first = execute();
    const firstDirectory = first.attemptDirectory ?? join(root, 'reports/native');
    const originalReport = await readFile(join(firstDirectory, 'report.json'));
    const originalLog = await readFile(join(firstDirectory, 'host.log'));
    const second = execute();
    const attempts = await readdir(join(root, 'reports/native/attempts')).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    assert.equal(attempts.length, 2, 'Every failed attempt must remain in a separate directory');
    assert.notEqual(first.attemptDirectory, second.attemptDirectory);
    assert.deepEqual(attempts.map(name => join(root, 'reports/native/attempts', name)).sort(),
      [first.attemptDirectory, second.attemptDirectory].sort());
    assert.deepEqual(await readFile(join(firstDirectory, 'report.json')), originalReport);
    assert.deepEqual(await readFile(join(firstDirectory, 'host.log')), originalLog);
    assert.deepEqual(JSON.parse(originalReport), first);
    const lastReport = await readFile(join(second.attemptDirectory, 'report.json'));
    assert.deepEqual(JSON.parse(lastReport), second);
    assert.deepEqual(await readFile(join(root, 'reports/native/report.json')), lastReport);
    assert.deepEqual(await readFile(join(second.attemptDirectory, 'host.log')), Buffer.alloc(0));
    assert.deepEqual(await readdir(join(root, '.native-cache/qualification')), []);
    assert.equal((await readdir(root)).includes('.native-runner'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
