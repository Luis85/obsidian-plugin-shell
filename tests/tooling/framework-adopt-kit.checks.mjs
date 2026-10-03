import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { included } from '../../bin/adapters/framework/distribution.ts';
import { assembleKit, installedCompiler } from '../../bin/adapters/framework/kit.ts';
import { listFiles } from '../../bin/adapters/framework/kit-integrity.ts';
import { materialize } from './interactive-maker-adopt-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const templates = ['templates/adoption/claude-skill/SKILL.md', 'templates/adoption/agents-skill/SKILL.md'];

test('the adoption skill templates are part of the distributed kit inventory', async () => {
  const listed = await listFiles(root, 'templates');
  for (const path of templates) { assert.ok(listed.includes(path), path); assert.equal(included(path), true, path); }
});
test('an extracted compiled kit analyzes a project, plans, installs the skill and verifies itself from the project root', { timeout: 300000 }, async t => {
  const project = await realpath(await mkdtemp(join(tmpdir(), 'adopt-kit-')));
  t.after(() => rm(project, { recursive: true, force: true }));
  const files = await assembleKit({ root: project, frameworkRoot: root }, await installedCompiler());
  const kit = file => join(project, 'tools/shell-cli', file);
  assert.ok(files.some(file => file.path === 'bin/template/' + templates[0]) && files.some(file => file.path === 'bin/template/' + templates[1]));
  for (const file of files) { await mkdir(dirname(kit(file.path)), { recursive: true }); await writeFile(kit(file.path), file.bytes); }
  await materialize('angular-standalone', project);
  const cli = (...args) => { const run = spawnSync(process.execPath, [kit('bin/app'), ...args, '--json'], { cwd: project, encoding: 'utf8', timeout: 120000, maxBuffer: 20_000_000 }); return { code: run.status, json: JSON.parse(run.stdout) }; };
  const status = cli('framework', 'status', '--root', 'tools/shell-cli'); assert.equal(status.code, 0, JSON.stringify(status.json));
  const analyzed = cli('adopt', 'analyze'); assert.equal(analyzed.json.status, 'ok');
  const report = analyzed.json.data.report;
  assert.equal(report.workbench.kitPath, 'tools/shell-cli'); assert.equal(report.workbench.present, false); assert.ok(report.findings.some(item => item.id === 'WORKBENCH_KIT_PRESENT'));
  assert.match(report.targets.node.source, /\.nvmrc$/); assert.equal(report.targets.node.major, 24); assert.match(report.targets.typescript.source, /package\.json$/); assert.equal(report.targets.typescript.major, 6); assert.equal(report.targets.angular.version, null, 'a kit without the starters ZIP cannot name the Angular target');
  assert.ok(report.findings.some(item => item.id === 'ANGULAR_TARGET_UNKNOWN'));
  assert.ok(!report.scan.skipped.directories.every(path => !path.includes('CLI kit')), 'the kit folder is recorded and not scanned');
  const preview = cli('adopt', 'plan'); assert.equal(preview.json.status, 'planned');
  const applied = cli('adopt', 'plan', '--apply', preview.json.data.planHash); assert.equal(applied.json.status, 'applied');
  assert.match(await readFile(join(project, 'docs/workbench/ADOPTION-PLAN.md'), 'utf8'), /^# Workbench adoption plan: /);
  const skill = cli('adopt', 'skill', '--yes'); assert.equal(skill.json.status, 'applied');
  assert.deepEqual(await readFile(join(project, '.claude/skills/adopt-existing-project/SKILL.md')), await readFile(join(root, '.claude/skills/adopt-existing-project/SKILL.md')));
  assert.deepEqual(await readFile(join(project, '.agents/skills/adopt-existing-project/SKILL.md')), await readFile(join(root, '.agents/skills/adopt-existing-project/SKILL.md')));
  assert.equal(cli('adopt', 'skill', '--yes').json.status, 'unchanged');
});
