// Increment: [[docs/increments/resource-atlas-project]]
// AC-4: All five family projects carry a byte-identical exchange protocol whose `APPS` names `component-atlas`, `storyloom`, `sitemap-atlas`, `dissect` and `resource-atlas`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const PROTOCOLS = ['component-atlas', 'storyloom', 'sitemap-atlas', 'dissect-canvas'].map(name => `projects/${name}/src/protocol.mjs`)
  .concat('projects/resource-atlas/src/family-protocol.mjs');

test('[AC-4] all five family projects carry the same exchange protocol', async () => {
  const [first, ...rest] = await Promise.all(PROTOCOLS.map(path => readFile(resolve(root, path), 'utf8')));
  rest.forEach((text, index) => assert.equal(text, first, `${PROTOCOLS[index + 1]} differs from ${PROTOCOLS[0]}`));
});

test('[AC-4] the protocol names all five tools', async () => {
  const { APPS } = await import(pathToFileURL(resolve(root, PROTOCOLS.at(-1))).href);
  assert.deepEqual(Object.keys(APPS), ['component-atlas', 'storyloom', 'sitemap-atlas', 'dissect', 'resource-atlas']);
  assert.equal(APPS['resource-atlas'].file, 'resource-atlas.html');
});
