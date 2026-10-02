/** Real skill inventory, source inventory and archive assembler; no duplicate distribution implementation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prototypeSkillFiles, prototypeSkillRoot, prototypeCodexSkillPath } from '../../scripts/companion/prototype-skill.mjs';
import { sourceInputs } from '../../scripts/testing/source-inputs.mjs';
import { reviewedExamplesRemoved } from './example-sources-fixture.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
function copySkill(t) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'prototype-inventory-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(root, prototypeSkillRoot), path.join(dir, prototypeSkillRoot), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(dir, prototypeCodexSkillPath)), { recursive: true });
  fs.copyFileSync(path.join(root, prototypeCodexSkillPath), path.join(dir, prototypeCodexSkillPath));
  return dir;
}
test('only the named complete skill is inventoried, not personal settings or other skills', async t => {
  const copy = copySkill(t);
  fs.writeFileSync(path.join(copy, '.claude/settings.local.json'), '{"private":true}');
  fs.mkdirSync(path.join(copy, '.claude/skills/private-skill'));
  fs.writeFileSync(path.join(copy, '.claude/skills/private-skill/SKILL.md'), 'private');
  const entries = await prototypeSkillFiles(copy);
  assert.ok(entries.length >= 40); assert.ok(entries.every(file => file.path.startsWith(prototypeSkillRoot + '/') || file.path === prototypeCodexSkillPath));
  const empty = path.join(copy, 'legacy'); fs.mkdirSync(empty);
  assert.deepEqual(await prototypeSkillFiles(empty), []);
});
test('missing, modified, duplicate and unlisted skill payloads fail closed', async t => {
  const copy = copySkill(t), target = path.join(copy, prototypeSkillRoot), skill = path.join(target, 'SKILL.md');
  const original = fs.readFileSync(skill); fs.writeFileSync(skill, 'tampered');
  await assert.rejects(prototypeSkillFiles(copy), /INTEGRITY/); fs.writeFileSync(skill, original);
  fs.writeFileSync(path.join(target, 'unlisted.md'), 'foreign');
  await assert.rejects(prototypeSkillFiles(copy), /INVENTORY/); fs.unlinkSync(path.join(target, 'unlisted.md'));
  const inventory = path.join(target, 'PACKAGE-INVENTORY.json');
  const raw = fs.readFileSync(inventory), parsed = JSON.parse(raw); parsed.files[1] = parsed.files[0];
  fs.writeFileSync(inventory, JSON.stringify(parsed)); await assert.rejects(prototypeSkillFiles(copy), /INVENTORY/);
  fs.writeFileSync(inventory, raw); fs.unlinkSync(skill); await assert.rejects(prototypeSkillFiles(copy), /INVENTORY/);
});
test('source-only evidence inventories include the skill and enforce existing per-file limits', async () => {
  const inputs = await sourceInputs(root);
  const found = inputs.files.filter(file => file.path.startsWith(prototypeSkillRoot + '/') || file.path === prototypeCodexSkillPath);
  const skill = await prototypeSkillFiles(root);
  assert.equal(found.length, skill.length);
  for (const file of found) assert.ok(file.limit === null || file.lines <= file.limit, `${file.path}: ${file.lines}/${file.limit}`);
});
test('actual archive assembler preserves exact skill bytes in its verified template inventory', { timeout: 60000 }, async t => {
  if (await reviewedExamplesRemoved(root)) { t.skip('Examples were removed from this checkout; kit packing needs the reviewed framework sources'); return; }
  const { assembleKit } = await import('../../scripts/framework/kit.ts');
  let compiler;
  try { const { installedCompiler } = await import('../../scripts/framework/kit.ts'); compiler = await installedCompiler(); }
  catch (error) {
    // Explicitly test assembly only on a dependency-free host. This is NOT TS compilation evidence.
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    t.diagnostic('Assembly-only test: TypeScript is not installed; emitted compiled fixtures are not executable evidence.');
    compiler = { version: 'assembly-test-no-transpilation', compile: () => '// Assembly test only; not runnable compiled code.\n' };
  }
  const files = await assembleKit({ root, frameworkRoot: root }, compiler);
  const inventory = JSON.parse(files.find(file => file.path === 'bin/kit.json').bytes);
  for (const expected of await prototypeSkillFiles(root)) {
    const key = 'bin/template/' + expected.path;
    const shipped = files.find(file => file.path === key);
    assert.ok(shipped?.bytes.equals(expected.bytes), key);
    assert.equal(inventory.files.find(file => file.path === key)?.bytes, expected.bytes.length);
  }
  assert.ok(!files.some(file => file.path.includes('settings.local.json')));
});

test('Codex entrypoint refers to the one canonical skill and ships no duplicate implementation', async t => {
  const copy = copySkill(t);
  const file = path.join(copy, prototypeCodexSkillPath);
  const body = fs.readFileSync(file, 'utf8');
  assert.match(body, /^---\nname: companion-prototype-design\ndescription:/);
  const link = body.match(/\[canonical Claude skill\]\(([^)]+)\)/);
  assert.ok(link);
  assert.equal(path.resolve(path.dirname(file), link[1]), path.join(copy, prototypeSkillRoot, 'SKILL.md'));
  assert.match(body, /single source of truth/); assert.match(body, /missing or unreadable/);
  assert.match(body, /canonical\s+skill directory/); assert.match(body, /Reuse its scripts directly/);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['SKILL.md']);
  assert.ok(body.length < 2000);
  fs.mkdirSync(path.join(copy, '.agents/skills/private-skill'));
  fs.writeFileSync(path.join(copy, '.agents/skills/private-skill/SKILL.md'), 'private');
  fs.writeFileSync(path.join(copy, '.agents/private-settings.json'), 'private');
  assert.ok((await prototypeSkillFiles(copy)).every(entry => !entry.path.includes('private')));
});
test('missing, tampered, unlisted and orphan Codex entrypoints fail before distribution', async t => {
  const copy = copySkill(t), file = path.join(copy, prototypeCodexSkillPath);
  const original = fs.readFileSync(file);
  fs.unlinkSync(file); await assert.rejects(prototypeSkillFiles(copy), /ENTRYPOINT_MISSING/);
  fs.writeFileSync(file, 'tampered'); await assert.rejects(prototypeSkillFiles(copy), /INTEGRITY/);
  fs.writeFileSync(file, original);
  const inventory = path.join(copy, prototypeSkillRoot, 'PACKAGE-INVENTORY.json');
  const bytes = fs.readFileSync(inventory), parsed = JSON.parse(bytes);
  parsed.entrypoints[0].path = '.agents/private-settings.json';
  fs.writeFileSync(inventory, JSON.stringify(parsed)); await assert.rejects(prototypeSkillFiles(copy), /allowlist/);
  delete parsed.entrypoints;
  fs.writeFileSync(inventory, JSON.stringify(parsed)); await assert.rejects(prototypeSkillFiles(copy), /unlisted/);
  fs.writeFileSync(inventory, bytes);
  fs.rmSync(path.join(copy, prototypeSkillRoot), { recursive: true });
  await assert.rejects(prototypeSkillFiles(copy), /without canonical skill/);
});
