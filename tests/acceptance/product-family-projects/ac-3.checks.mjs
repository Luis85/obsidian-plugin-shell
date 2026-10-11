// Increment: [[docs/increments/product-family-projects]]
// AC-3: Each `docs/concepts/<name>/index.html` matches the byte count and SHA-256 recorded for its file in `docs/concepts/product-family/delivery/DELIVERY-MANIFEST.json`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const DELIVERED = {
  'component-atlas': 'component-atlas.html',
  storyloom: 'storyloom-prototype.html',
  'sitemap-atlas': 'sitemap-atlas.html',
  'dissect-canvas': 'dissect-canvas.html',
};

test('[AC-3] each delivered prototype is kept byte for byte', async () => {
  const manifest = JSON.parse(await readFile(resolve(root, 'docs/concepts/product-family/delivery/DELIVERY-MANIFEST.json'), 'utf8'));
  assert.deepEqual(Object.keys(manifest.files).sort(), Object.values(DELIVERED).sort());
  for (const [name, file] of Object.entries(DELIVERED)) {
    const bytes = await readFile(resolve(root, 'docs/concepts', name, 'index.html'));
    assert.equal(bytes.length, manifest.files[file].bytes, `${name} byte count`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.files[file].sha256, `${name} SHA-256`);
  }
});
