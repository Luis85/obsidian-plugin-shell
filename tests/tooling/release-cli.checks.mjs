import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseOperationArguments, readOperationInput } from '../../scripts/release/cli.mjs';

test('release execution CLI requires a separately supplied exact authorization digest', () => {
  const hash = 'a'.repeat(64);
  assert.deepEqual(parseOperationArguments([]), { help: true });
  assert.deepEqual(parseOperationArguments(['--input', 'plan.json']), { input: 'plan.json' });
  assert.deepEqual(parseOperationArguments(['--input', 'plan.json', '--execute', '--authorize', hash]), { input: 'plan.json', execute: true, authorize: hash });
  for (const args of [
    ['--input', 'p', '--execute'], ['--input', 'p', '--authorize', hash],
    ['--input', 'p', '--execute', '--authorize', 'yes'], ['--input', 'p', '--input', 'q'],
    ['--input'], ['--help', '--execute'], ['--unknown'],
  ]) assert.throws(() => parseOperationArguments(args));
});

test('operation JSON cannot provide authorization, clock or remote snapshots', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'release-cli-'));
  try {
    const path = join(folder, 'operation.json');
    const input = { repository: 'owner/repo', candidateDirectory: './packet', commit: 'a'.repeat(40), version: '1.0.0', mode: 'draft' };
    await writeFile(path, JSON.stringify(input));
    assert.deepEqual(await readOperationInput(path), { ...input, candidateDirectory: join(folder, 'packet') });
    for (const extra of [{ authorization: true }, { remote: {} }, { now: '2030-01-01' }, { execute: true }]) {
      await writeFile(path, JSON.stringify({ ...input, ...extra }));
      await assert.rejects(readOperationInput(path), /INVALID_OPERATION_INPUT/);
    }
    for (const invalid of [null, [], {}, { ...input, candidateDirectory: '' }]) {
      await writeFile(path, JSON.stringify(invalid));
      await assert.rejects(readOperationInput(path));
    }
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('CLI help and invalid authorization terminate without invoking gh', () => {
  const help = spawnSync(process.execPath, ['scripts/release/cli.mjs', '--help'], { encoding: 'utf8', windowsHide: true });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /authenticated read-only/);
  const bad = spawnSync(process.execPath, ['scripts/release/cli.mjs', '--input', 'absent.json', '--execute'], { encoding: 'utf8', windowsHide: true });
  assert.equal(bad.status, 1);
  assert.equal(JSON.parse(bad.stderr).error, 'EXECUTION_REQUIRES_EXPLICIT_AUTHORIZATION_DIGEST');
});
