// Increment: [[docs/increments/resource-atlas-project]]
// AC-3: `docs/concepts/resource-atlas/index.html` is the delivered `resource-atlas.html`: 976316 bytes with SHA-256 `eac459aa86ae12b6efba462cf4b545ee6c9483ed1cced8eb3346c02444c2e0f9`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');

test('[AC-3] the delivered Resource Atlas prototype is kept byte for byte', async () => {
  // The delivery had no manifest; these are the bytes and hash taken when the file was added (also in its README).
  const bytes = await readFile(resolve(root, 'docs/concepts/resource-atlas/index.html'));
  assert.equal(bytes.length, 976316);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'eac459aa86ae12b6efba462cf4b545ee6c9483ed1cced8eb3346c02444c2e0f9');
  assert.match(await readFile(resolve(root, 'docs/concepts/resource-atlas/README.md'), 'utf8'), /eac459aa86ae12b6efba462cf4b545ee6c9483ed1cced8eb3346c02444c2e0f9/);
});
