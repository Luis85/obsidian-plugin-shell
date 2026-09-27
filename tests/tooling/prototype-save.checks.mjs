/** Shared safe writer integration; package fixtures are explicitly synthetic, not Vue acceptance. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { saveConcept } from '../../.claude/skills/companion-prototype-design/scripts/save-concept.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const tests = path.join(root, '.claude/skills/companion-prototype-design/tests');
const python = process.env.PYTHON || 'python3';
const pythonAvailable = spawnSync(python, ['--version'], { stdio: 'ignore' }).status === 0;
test('concept save uses the same scanner and shared planner with explicit approval and fresh-folder protection', { skip: !pythonAvailable && 'Python package-scanner prerequisite unavailable' }, async t => {
  const temp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'prototype-save-'));
  const slug = 'save-helper-' + path.basename(temp).toLowerCase().replace(/[^a-z0-9]/g, '');
  const destination = path.join(root, 'docs/concepts', slug);
  t.after(() => { fs.rmSync(temp, { recursive: true, force: true }); fs.rmSync(destination, { recursive: true, force: true }); });
  // Reuse the existing synthetic package fixture, rather than creating a second test schema.
  const script = `import sys, shutil, json\nsys.path.insert(0, sys.argv[1])\nfrom test_pack_concept import PackagingTests\nf=PackagingTests(); f.setUp()\nf.manifest['slug']=sys.argv[3]; f.update_manifest()\nshutil.copytree(f.root, sys.argv[2]); f.doCleanups()\n`;
  const source = path.join(temp, 'delivery');
  const fixture = spawnSync(python, ['-B', '-c', script, tests, source, slug], { encoding: 'utf8', timeout: 30000 });
  assert.equal(fixture.status, 0, fixture.stderr);
  const planned = await saveConcept(root, source, slug);
  assert.equal(planned.status, 'planned'); assert.equal(fs.existsSync(destination), false);
  assert.ok(planned.data.changes.every(change => change.status === 'create'));
  await assert.rejects(saveConcept(root, source, slug, { apply: planned.data.planHash }), /APPROVAL/);
  fs.appendFileSync(path.join(source, 'README.md'), '\nChanged after review.\n');
  await assert.rejects(saveConcept(root, source, slug, { execute: true, apply: planned.data.planHash }), /STALE_PLAN/);
  assert.equal(fs.existsSync(destination), false);
  const next = await saveConcept(root, source, slug);
  const applied = await saveConcept(root, source, slug, { execute: true, apply: next.data.planHash });
  assert.equal(applied.status, 'applied'); assert.equal(applied.data.execution, 'shared-file-plan');
  assert.equal(fs.readFileSync(path.join(destination, 'README.md'), 'utf8'), fs.readFileSync(path.join(source, 'README.md'), 'utf8'));
  await assert.rejects(saveConcept(root, source, slug), /DESTINATION_EXISTS/);
  await assert.rejects(saveConcept(root, source, '../unsafe'), /SLUG/);
});
