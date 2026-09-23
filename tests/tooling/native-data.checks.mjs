import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pendingNativeData } from '../../scripts/testing/native-data.mjs';

test('native saved-data polling waits for missing/partial bytes and returns complete values unchanged', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-data-'));
  try {
    const path = join(root, 'data.json');
    assert.equal(await pendingNativeData(path), undefined);
    await writeFile(path, '{"preferences":');
    assert.equal(await pendingNativeData(path), undefined);
    const value = { preferences: { hideObsidianViewHeader: false }, extension: { retained: true } };
    await writeFile(path, JSON.stringify(value));
    assert.deepEqual(await pendingNativeData(path), value);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('native saved-data polling propagates unrelated filesystem errors', async () => {
  const root = await mkdtemp(join(tmpdir(), 'native-data-error-'));
  try {
    await assert.rejects(pendingNativeData(root), error => error.code !== 'ENOENT' && !(error instanceof SyntaxError));
  } finally { await rm(root, { recursive: true, force: true }); }
});
