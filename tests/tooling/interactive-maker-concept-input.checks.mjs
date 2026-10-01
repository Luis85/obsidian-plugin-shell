import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodeConceptInput as relocatedDecode, readConceptInput as relocatedRead } from '../../bin/adapters/framework/concept-input.ts';
import * as legacy from '../../scripts/framework/concept-input.ts';

const frameworkRoot = resolve(import.meta.dirname, '../..');
const projectText = await readFile(join(frameworkRoot, 'docs/concepts/companion/companion-project.json'), 'utf8');

test('relocated concept input preserves compatibility and canonical JSON decoding', () => {
  assert.equal(legacy.decodeConceptInput, relocatedDecode);
  assert.equal(legacy.readConceptInput, relocatedRead);
  const decoded = relocatedDecode(Buffer.from(projectText), 'json');
  assert.equal(decoded.status, 'data');
  assert.match(decoded.payloadSha256, /^[a-f0-9]{64}$/);
  assert.ok(['project-json', 'concept-json'].includes(decoded.encoding));
});

test('relocated concept input treats ordinary HTML as reference-only and reads inert markers', () => {
  const reference = relocatedDecode(Buffer.from('<!doctype html><h1>Reference only</h1>'), 'html');
  assert.equal(reference.status, 'reference-only');
  const html = '<script type="application/json" id="companion-project">' + projectText + '</script>';
  const embedded = relocatedDecode(Buffer.from(html), 'html');
  assert.equal(embedded.status, 'data');
  assert.match(embedded.payloadSha256, /^[a-f0-9]{64}$/);
});

test('relocated concept input enforces project-relative docs/concepts paths', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'concept-input-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'docs/concepts'), { recursive: true });
  await writeFile(join(root, 'docs/concepts/example.json'), projectText);
  const context = { root, frameworkRoot };
  const loaded = await relocatedRead(context, 'docs/concepts/example.json');
  assert.equal(loaded.path, 'docs/concepts/example.json');
  assert.equal(loaded.decoded.status, 'data');
  await assert.rejects(relocatedRead(context, '../outside.json'), /CONCEPT_PATH/);
});
