/** Integration tests use the actual local shell operations, compiler, starter and file planner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { prototypeSkillFiles, prototypeSkillRoot, prototypeCodexSkillPath } from '../../bin/adapters/framework/prototype-skill.ts';
import { shellOperation, npmOperation } from '../../.claude/skills/companion-prototype-design/scripts/lib/framework.mjs';
import { starterDocumentText } from '../support/starter-documents.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(root, prototypeSkillRoot, 'scripts/prototype.mjs');
function scratch(t) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'prototype-shell-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir;
}
test('actual CLI discovers the shell registry, maker contracts and matching project scripts', async () => {
  const child = spawnSync(process.execPath, [cli, 'discover', '--repo', root], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(child.status, 0, child.stderr);
  const found = JSON.parse(child.stdout); assert.equal(found.protocolVersion, 1); assert.equal(found.status, 'ok');
  for (const id of ['project inspect', 'project import', 'new', 'generate', 'styles inspect', 'test', 'check', 'make']) assert.ok(found.data.commands.some(c => c.id === id), id);
  for (const id of ['feature', 'component', 'view', 'store', 'usecase']) assert.ok(found.data.makers.some(m => m.id === id), id);
  assert.deepEqual(found.data.profiles.test, ['unit', 'project', 'browser', 'native', 'obsidian']);
  assert.match(found.data.scripts['test:prototypes'], /suites\.mjs prototypes/);
});
test('actual project inspector, styles inspector and maker discovery accept the real blank starter', async t => {
  const input = path.join(scratch(t), 'blank.json'); fs.writeFileSync(input, starterDocumentText('blank'));
  for (const args of [['project', 'inspect', '--input', input], ['styles', 'inspect', '--input', input], ['make', 'describe', 'feature']]) {
    const outcome = await shellOperation(root, args); assert.equal(outcome.status, 'ok', JSON.stringify(outcome.diagnostics));
  }
  const preview = await npmOperation(root, 'check:source');
  assert.equal(preview.status, 'planned'); assert.equal(preview.data.execution, 'not-run');
  await assert.rejects(npmOperation(root, 'release:operate', { execute: true }), /PROTOTYPE_SCRIPT/);
});
test('actual shell build and install remain nonexecuting plans until separately authorized', async () => {
  for (const command of ['build', 'install', 'check']) {
    const outcome = await shellOperation(root, [command]);
    assert.equal(outcome.status, 'planned', JSON.stringify(outcome));
  }
});
test('reviewed starter generation ships the product kit and only the click-dummy worker of the prototype skill, and rejects stale approvals', { timeout: 120000 }, async t => {
  const temp = scratch(t), target = path.join(temp, 'notes-prototype');
  const args = ['new', target, '--starter', 'blank', '--id', 'notes-prototype', '--name', 'Notes Prototype'];
  const plan = await shellOperation(root, args);
  assert.equal(plan.status, 'planned', JSON.stringify(plan.diagnostics)); assert.match(plan.data.planHash, /^[a-f0-9]{64}$/);
  assert.equal(fs.existsSync(target), false);
  await assert.rejects(shellOperation(root, [...args, '--apply', plan.data.planHash]), /APPROVAL/);
  const stale = await shellOperation(root, [...args, '--apply', '0'.repeat(64)], { execute: true });
  assert.equal(stale.status, 'failed'); assert.equal(fs.existsSync(target), false);
  const applied = await shellOperation(root, [...args, '--apply', plan.data.planHash], { execute: true });
  assert.equal(applied.status, 'applied', JSON.stringify(applied.diagnostics));
  const receipt = JSON.parse(fs.readFileSync(path.join(target, '.companion/generation.json'), 'utf8'));
  // The framework's repository-specific skill, its evidence and its Codex entrypoint are not part of a product.
  assert.equal(fs.existsSync(path.join(target, prototypeSkillRoot)), false);
  assert.equal(fs.existsSync(path.join(target, path.dirname(prototypeCodexSkillPath))), false);
  assert.ok(!receipt.files.some(record => record.path.includes('companion-prototype-design')));
  const worker = 'scripts/clickdummy/lib/build-worker.mjs';
  const shipped = (await prototypeSkillFiles(root)).find(file => file.path === prototypeSkillRoot + '/scripts/lib/build-worker.mjs');
  assert.ok(fs.readFileSync(path.join(target, worker)).equals(shipped.bytes));
  assert.equal(receipt.files.find(record => record.path === worker)?.ownership, 'extension');
  const scripts = JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).scripts;
  assert.equal(scripts['prototype:build'], undefined); assert.equal(scripts['prototype:tools'], undefined); assert.ok(scripts['build:clickdummy']);
  // The generator's native ownership rules, not a new copy operation, preserve edits.
  const skillFile = path.join(target, '.claude/skills/implement-requirement/SKILL.md');
  const adapterFile = path.join(target, '.agents/skills/implement-requirement/SKILL.md');
  const adapterBytes = fs.readFileSync(adapterFile, 'utf8');
  fs.writeFileSync(adapterFile, adapterBytes + '\nUser adapter annotation.\n');
  const original = fs.readFileSync(skillFile, 'utf8'); fs.writeFileSync(skillFile, original + '\nUser customization.\n');
  const { planProject, applyProject } = await import('../../bin/compiler/adapters/project-plan.ts');
  const options = { input: path.join(target, 'design/project.json'), vault: temp, target: path.basename(target), templateRoot: root };
  const regeneration = await planProject(options); assert.deepEqual(regeneration.conflicts, []);
  await applyProject(regeneration, regeneration.hash);
  assert.equal(fs.readFileSync(skillFile, 'utf8'), original + '\nUser customization.\n');
  assert.equal(fs.readFileSync(adapterFile, 'utf8'), adapterBytes + '\nUser adapter annotation.\n');
});

test('saved plans cannot smuggle native or release operations through the prototype adapter', async t => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'prototype-plan-scope-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'saved.json');
  for (const command of ['plugin install', 'release prepare', 'framework upgrade', 'plan inspect']) {
    fs.writeFileSync(file, JSON.stringify({ protocolVersion: 1, root,
      request: { command, args: [], options: {} }, planHash: 'a'.repeat(64) }));
    await assert.rejects(shellOperation(root, ['plan', 'inspect', file]), /PROTOTYPE_(SCOPE|PLAN)/);
    await assert.rejects(shellOperation(root, ['plan', 'apply', file, '--apply', 'a'.repeat(64)], { execute: true }), /PROTOTYPE_(SCOPE|PLAN)/);
  }
});
