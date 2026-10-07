import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { adoptInvocation } from '../adapters/framework/adopt-invocation.ts';
import { executeOperation } from '../adapters/framework/operations.ts';
import { fileSymlink } from './file-symlink.mjs';
import { fixtureNames, frameworkRoot, run, runJson, withProject } from './interactive-maker-adopt-fixture.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));

const sha = value => createHash('sha256').update(value).digest('hex');
async function digest(directory, prefix = '') {
  const entries = [];
  for (const entry of (await readdir(join(directory, prefix), { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) entries.push(...await digest(directory, path)); else entries.push(`${path}:${sha(await readFile(join(directory, path)))}`);
  }
  return entries;
}
const planOf = (project, ...extra) => ['adopt', 'plan', '--target', project, ...extra];
const planFile = project => join(project, 'docs/workbench/ADOPTION-PLAN.md');
const code = result => result.json.diagnostics[0]?.code;

test('analysis is strictly read-only on every fixture and recommends the expected strategy', async () => {
  const expected = { 'angular-ngmodule-legacy': 'B', 'angular-standalone': 'A', 'existing-agent-setup': 'A', hostile: 'B', 'nx-angular': 'B', 'obsidian-plugin': 'C', 'react-vite': 'B' };
  assert.deepEqual(await fixtureNames(), Object.keys(expected));
  for (const name of Object.keys(expected)) {
    await withProject(name, async project => {
      const before = await digest(project);
      const analyzed = await runJson(['adopt', 'analyze', '--target', project]);
      assert.equal(analyzed.code, 0, analyzed.stderr); assert.equal(analyzed.json.status, 'ok'); assert.equal(analyzed.json.data.report.schema, 'workbench-adoption-report/v1'); assert.equal(analyzed.json.data.written, null);
      const planned = await runJson(planOf(project));
      assert.equal(planned.json.data.summary.strategy, expected[name], name); assert.equal(planned.json.status, 'planned');
      assert.deepEqual(await digest(project), before, `${name} was modified`);
    });
  }
});
test('the report records facts from the fixtures: versions, builders, routes, agent files and findings', async () => {
  const report = async name => withProject(name, async project => (await runJson(['adopt', 'analyze', '--target', project])).json.data.report);
  const modern = await report('angular-standalone'), legacy = await report('angular-ngmodule-legacy'), agents = await report('existing-agent-setup'), plugin = await report('obsidian-plugin');
  assert.equal(modern.angular.major, 21); assert.deepEqual(modern.angular.routing.paths.slice(0, 3), ['orders', 'orders/:id', 'customers']); assert.deepEqual(modern.tooling.testing, ['jest']); assert.ok(modern.angular.libraries.includes('Angular Material'));
  assert.equal(legacy.angular.projects[0].builderClass, 'webpack'); assert.equal(legacy.angular.bootstrap, 'bootstrapModule'); assert.equal(legacy.findings[0].id, 'ANGULAR_TARGET_GAP'); assert.equal(legacy.findings[0].severity, 'block');
  assert.deepEqual(agents.agents.skills, ['release-notes']); assert.ok(agents.agents.claudeSettings.hooks && agents.agents.claudeSettings.permissions); assert.ok(agents.findings.some(item => item.id === 'PATH_COLLISION' && item.evidence.includes('design')) || agents.findings.some(item => item.id === 'PATH_COLLISION'));
  assert.ok(agents.ui.tokenFiles.includes('design/tokens.json')); assert.equal(plugin.frameworks[0].id, 'obsidian-plugin'); assert.equal(plugin.frameworks[0].detail, 'minAppVersion 1.5.0');
  const hostile = await withProject('hostile', async project => (await runJson(['adopt', 'analyze', '--target', project])).json.data.report);
  assert.deepEqual(hostile.findings.filter(item => item.id === 'MALFORMED_CONFIG').flatMap(item => item.evidence), ['angular.json', 'manifest.json', 'package.json']);
});
test('the target comes from --target, --root or the invoking directory and report paths resolve from it', async () => {
  await withProject('react-vite', async (project, root) => {
    const viaRoot = await runJson(['adopt', 'analyze', '--root', project]); assert.equal(viaRoot.json.data.report.target.name, 'project');
    for (const bad of [join(root, 'missing'), join(project, 'package.json')]) { const failed = await runJson(['adopt', 'analyze', '--target', bad]); assert.equal(failed.code, 1); assert.equal(code(failed), 'TARGET_NOT_FOUND'); }
    const request = { command: 'adopt analyze', args: [], options: { report: 'r.json', out: 'o.json', json: true } };
    const fromCwd = await adoptInvocation(request, project);
    assert.equal(fromCwd.root, project); assert.equal(fromCwd.request.options.report, join(project, 'r.json')); assert.equal(fromCwd.request.options.out, join(project, 'o.json')); assert.equal(fromCwd.request.options.target, undefined);
    const plan = await adoptInvocation({ command: 'adopt plan', args: [], options: { out: 'docs/p.md', target: '.' } }, project); assert.equal(plan.request.options.out, 'docs/p.md');
    const nested = await adoptInvocation({ command: 'adopt plan', args: [], options: { target: 'nonexistent' } }, project).catch(error => error); assert.equal(nested.code, 'TARGET_NOT_FOUND');
  });
});
test('analyze --out writes a reviewed report only outside the project or under docs/workbench and never replaces silently', async () => {
  await withProject('angular-standalone', async (project, root) => {
    const outside = join(root, 'report.json'), before = await digest(project);
    const written = await runJson(['adopt', 'analyze', '--target', project, '--out', outside]); assert.equal(written.code, 0, written.stderr);
    const stored = JSON.parse(await readFile(outside, 'utf8')); assert.equal(stored.schema, 'workbench-adoption-report/v1'); assert.equal(written.json.data.written.sha256, sha(await readFile(outside))); assert.deepEqual(await digest(project), before);
    const again = await runJson(['adopt', 'analyze', '--target', project, '--out', outside]); assert.equal(code(again), 'ADOPT_OUT_EXISTS'); assert.equal(again.code, 1);
    assert.equal((await runJson(['adopt', 'analyze', '--target', project, '--out', outside, '--replace'])).code, 0);
    for (const refused of ['report.json', 'src/report.json', 'docs/workbench/report.md', 'docs/report.json']) {
      const failed = await runJson(['adopt', 'analyze', '--target', project, '--out', join(project, refused)]); assert.equal(code(failed), 'ADOPT_OUT_INSIDE_TARGET', refused);
    }
    assert.deepEqual(await digest(project), before);
    assert.equal(code(await runJson(['adopt', 'analyze', '--target', project, '--out', project])), 'ADOPT_OUT_PATH');
    assert.equal(code(await runJson(['adopt', 'analyze', '--target', project, '--out', join(root, 'missing/r.json')])), 'ADOPT_OUT_PARENT');
    assert.equal(code(await runJson(['adopt', 'analyze', '--target', project, '--out', outside, '--dry-run'])), 'ADOPT_DRY_RUN_OUT');
    const inside = join(project, 'docs/workbench/adoption-report.json');
    assert.equal((await runJson(['adopt', 'analyze', '--target', project, '--out', inside])).code, 0);
    const rerun = await runJson(['adopt', 'analyze', '--target', project]); assert.equal(rerun.json.data.report.workbench.present, false); assert.equal(rerun.json.data.report.scan.files, stored.scan.files);
  });
});
test('a plan preview prints the plan and its hashes and writes nothing', async () => {
  await withProject('angular-standalone', async project => {
    const before = await digest(project);
    const preview = await runJson(planOf(project));
    assert.equal(preview.code, 0); assert.equal(preview.json.status, 'planned');
    const { planHash, summary, changes } = preview.json.data;
    assert.match(planHash, /^[a-f0-9]{64}$/); assert.equal(summary.markdownSha256, sha(summary.markdown)); assert.match(summary.markdown, /^# Workbench adoption plan: project\n/);
    assert.deepEqual(changes.map(change => [change.path, change.status]), [['docs/workbench/ADOPTION-PLAN.md', 'create']]); assert.equal(summary.output, 'docs/workbench/ADOPTION-PLAN.md'); assert.equal(summary.source, 'inline-analysis'); assert.equal(summary.recordedAt, null);
    assert.deepEqual(await digest(project), before);
    assert.equal((await runJson(planOf(project))).json.data.planHash, planHash, 'same input, same hash');
    const dry = await runJson(planOf(project, '--yes', '--dry-run')); assert.equal(dry.json.status, 'planned'); assert.deepEqual(await digest(project), before);
    const human = await run(planOf(project)); assert.equal(human.code, 0, human.stderr);
    assert.match(human.stdout, /^adopt plan: planned\n# Workbench adoption plan: project/); assert.ok(human.stdout.includes(`Markdown SHA-256  ${summary.markdownSha256}`)); assert.ok(human.stdout.includes(`Plan hash         ${planHash}`)); assert.match(human.stdout, /Next: .*--apply [a-f0-9]{64}/);
  });
});
test('applying the reviewed hash writes exactly the plan file, once, and a rerun changes nothing', async () => {
  await withProject('angular-ngmodule-legacy', async project => {
    const before = await digest(project);
    const { json: { data: { planHash, summary } } } = await runJson(planOf(project));
    const applied = await runJson(planOf(project, '--apply', planHash)); assert.equal(applied.code, 0, applied.stderr); assert.equal(applied.json.status, 'applied'); assert.equal(applied.json.data.applied.written.length, 1);
    const after = await digest(project);
    assert.deepEqual(after.filter(item => !before.includes(item)).map(item => item.split(':')[0]), ['docs/workbench/ADOPTION-PLAN.md']); assert.deepEqual(before.filter(item => !after.includes(item)), []);
    assert.equal(sha(await readFile(planFile(project))), summary.markdownSha256);
    const again = await runJson(planOf(project, '--yes')); assert.equal(again.json.status, 'unchanged'); assert.deepEqual(await digest(project), after);
    assert.equal((await runJson(planOf(project))).json.data.summary.markdownSha256, summary.markdownSha256, 'the plan file does not change the analysis');
  });
});
test('a stale or wrong hash is refused before anything is written', async () => {
  await withProject('react-vite', async project => {
    const before = await digest(project);
    const wrong = await runJson(planOf(project, '--apply', 'a'.repeat(64))); assert.equal(wrong.code, 1); assert.equal(code(wrong), 'PLAN_STALE');
    const malformed = await runJson(planOf(project, '--apply', 'nope')); assert.equal(code(malformed), 'INVALID_PLAN_HASH');
    const { json: { data: { planHash } } } = await runJson(planOf(project));
    await writeFile(join(project, 'src/Extra.tsx'), 'export {};\n'); await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'changed', dependencies: { react: '19.0.0' } }));
    const stale = await runJson(planOf(project, '--apply', planHash)); assert.equal(code(stale), 'PLAN_STALE');
    assert.equal((await readdir(project)).includes('docs'), false); assert.ok(before.length > 0);
  });
});
test('an existing different plan or foreign file is a conflict; only an earlier plan can be replaced and only explicitly', async () => {
  await withProject('angular-standalone', async project => {
    await mkdir(join(project, 'docs/workbench'), { recursive: true });
    await writeFile(planFile(project), '# Workbench adoption plan: edited by hand\n\nOwner notes.\n');
    const blocked = await runJson(planOf(project)); assert.equal(blocked.code, 1); assert.equal(blocked.json.status, 'blocked'); assert.match(blocked.json.diagnostics.length ? blocked.json.diagnostics[0].message : blocked.json.data.conflicts[0], /--replace|already holds/);
    assert.match(blocked.json.data.conflicts[0], /pass --replace/);
    const stillBlocked = await runJson(planOf(project, '--yes')); assert.equal(stillBlocked.code, 1); assert.match(await readFile(planFile(project), 'utf8'), /edited by hand/);
    const replaced = await runJson(planOf(project, '--replace', '--yes')); assert.equal(replaced.json.status, 'applied'); assert.doesNotMatch(await readFile(planFile(project), 'utf8'), /edited by hand/);
    await writeFile(join(project, 'README.md'), '# My project\n');
    const foreign = await runJson(planOf(project, '--out', 'README.md', '--replace')); assert.equal(foreign.code, 1); assert.equal(foreign.json.status, 'blocked'); assert.match(foreign.json.data.conflicts[0], /not an adoption plan; it is never replaced/);
    const forced = await runJson(planOf(project, '--out', 'README.md', '--replace', '--yes')); assert.equal(code(forced), 'PLAN_CONFLICT'); assert.equal(await readFile(join(project, 'README.md'), 'utf8'), '# My project\n');
  });
});
test('--out is a Markdown path inside the target; escapes, protected folders and links are refused', async t => {
  await withProject('react-vite', async (project, root) => {
    const ok = await runJson(planOf(project, '--out', 'docs/plans/legacy.md', '--yes')); assert.equal(ok.json.status, 'applied'); assert.match(await readFile(join(project, 'docs/plans/legacy.md'), 'utf8'), /^# Workbench adoption plan/);
    for (const [out, expected] of [['../escape.md', 'PLAN_UNSAFE_PATH'], [join(root, 'abs.md'), 'PLAN_UNSAFE_PATH'], ['.git/plan.md', 'PLAN_PROTECTED_PATH'], ['plan.txt', 'ADOPT_PLAN_OUT'], ['docs\\plan.md', 'PLAN_UNSAFE_PATH'], ['node_modules/p.md', 'PLAN_PROTECTED_PATH']]) {
      const failed = await runJson(planOf(project, '--out', out, '--yes')); assert.equal(failed.code, 1, out); assert.equal(code(failed), expected, out);
    }
    assert.equal((await readdir(root)).includes('escape.md'), false);
    await mkdir(join(root, 'elsewhere')); await symlink(join(root, 'elsewhere'), join(project, 'linked'), 'junction');
    const linked = await runJson(planOf(project, '--out', 'linked/plan.md', '--yes')); assert.equal(code(linked), 'PLAN_SYMLINK'); assert.deepEqual(await readdir(join(root, 'elsewhere')), []);
    if (await fileSymlink(t, join(root, 'elsewhere/x.md'), join(project, 'docs/plans/link.md'))) assert.equal(code(await runJson(planOf(project, '--out', 'docs/plans/link.md', '--yes'))), 'PLAN_SYMLINK');
  });
});
test('a stored report is rendered instead of re-analyzing and is validated as untrusted input', async () => {
  await withProject('angular-standalone', async (project, root) => {
    const file = join(root, 'report.json');
    await runJson(['adopt', 'analyze', '--target', project, '--out', file]);
    const stored = JSON.parse(await readFile(file, 'utf8'));
    const planned = await runJson(planOf(project, '--report', file)); assert.equal(planned.json.status, 'planned'); assert.equal(planned.json.data.summary.source, 'report-file'); assert.equal(planned.json.data.summary.recordedAt, stored.recordedAt); assert.ok(planned.json.data.summary.markdown.includes(stored.recordedAt));
    await writeFile(join(project, 'package.json'), '{ "name": "changed" }');
    assert.equal((await runJson(planOf(project, '--report', file))).json.data.planHash, planned.json.data.planHash, 'the report, not the project, decides the content');
    const mutate = async change => { const copy = JSON.parse(JSON.stringify(stored)); change(copy); const path = join(root, 'bad.json'); await writeFile(path, JSON.stringify(copy)); return code(await runJson(planOf(project, '--report', path))); };
    assert.equal(await mutate(data => { data.schema = 'other/v9'; }), 'ADOPT_REPORT_SCHEMA'); assert.equal(await mutate(data => { data.findings[0].severity = 'critical'; }), 'ADOPT_REPORT_INVALID'); assert.equal(await mutate(data => { delete data.runtime; }), 'ADOPT_REPORT_INVALID');
    await writeFile(join(root, 'junk.json'), 'not json'); assert.equal((await runJson(planOf(project, '--report', join(root, 'junk.json')))).code, 1);
    await writeFile(join(root, 'huge.json'), ' '.repeat(4_100_000)); assert.equal(code(await runJson(planOf(project, '--report', join(root, 'huge.json')))), 'INPUT_LIMIT');
    assert.equal((await runJson(planOf(project, '--report', join(root, 'absent.json')))).code, 1);
    assert.equal((await readdir(project)).includes('docs'), false);
  });
});
test('adopt skill previews both agent copies, installs them byte-identical to the shipped skill and never overwrites', async () => {
  const claude = await readFile(join(frameworkRoot, '.claude/skills/adopt-existing-project/SKILL.md')), codex = await readFile(join(frameworkRoot, '.agents/skills/adopt-existing-project/SKILL.md'));
  assert.deepEqual(await readFile(join(frameworkRoot, 'templates/adoption/claude-skill/SKILL.md')), claude); assert.deepEqual(await readFile(join(frameworkRoot, 'templates/adoption/agents-skill/SKILL.md')), codex);
  await withProject('existing-agent-setup', async project => {
    const before = await digest(project);
    const preview = await runJson(['adopt', 'skill', '--target', project]); assert.equal(preview.json.status, 'planned'); assert.deepEqual(preview.json.data.changes.map(change => change.path), ['.claude/skills/adopt-existing-project/SKILL.md', '.agents/skills/adopt-existing-project/SKILL.md']);
    assert.deepEqual(await digest(project), before);
    const applied = await runJson(['adopt', 'skill', '--target', project, '--apply', preview.json.data.planHash]); assert.equal(applied.json.status, 'applied');
    assert.deepEqual(await readFile(join(project, '.claude/skills/adopt-existing-project/SKILL.md')), claude); assert.deepEqual(await readFile(join(project, '.agents/skills/adopt-existing-project/SKILL.md')), codex);
    assert.deepEqual((await digest(project)).filter(item => !before.includes(item)).length, 2);
    assert.equal((await runJson(['adopt', 'skill', '--target', project, '--yes'])).json.status, 'unchanged');
    await writeFile(join(project, '.claude/skills/adopt-existing-project/SKILL.md'), 'local edit\n');
    const refused = await runJson(['adopt', 'skill', '--target', project, '--yes']); assert.equal(refused.code, 1); assert.equal(await readFile(join(project, '.claude/skills/adopt-existing-project/SKILL.md'), 'utf8'), 'local edit\n');
    assert.match((await runJson(['adopt', 'skill', '--target', project])).json.data.conflicts[0], /never overwritten/);
  });
  await withProject('react-vite', async project => {
    await mkdir(join(project, '.agents/skills/adopt-existing-project'), { recursive: true }); await writeFile(join(project, '.agents/skills/adopt-existing-project/SKILL.md'), 'mine\n');
    const blocked = await runJson(['adopt', 'skill', '--target', project, '--yes']); assert.equal(blocked.code, 1);
    assert.equal((await readdir(project, { recursive: true })).some(path => path.includes('.claude')), false, 'no partial install');
  });
});
test('missing skill templates fail closed, a stray bin/template is never probed and an unverified kit marker is refused', async () => {
  await withProject('react-vite', async (project, root) => {
    const empty = join(root, 'framework'); await mkdir(empty);
    const missing = await executeOperation({ command: 'adopt skill', args: [], options: { 'dry-run': true } }, { root: project, frameworkRoot: empty }); assert.equal(missing.status, 'failed'); assert.equal(missing.diagnostics[0].code, 'ADOPT_TEMPLATE_MISSING');
    for (const [name, text] of [['claude-skill', 'kit claude\n'], ['agents-skill', 'kit agents\n']]) { await mkdir(join(empty, 'bin/template/templates/adoption', name), { recursive: true }); await writeFile(join(empty, 'bin/template/templates/adoption', name, 'SKILL.md'), text); }
    const stray = await executeOperation({ command: 'adopt skill', args: [], options: {} }, { root: project, frameworkRoot: empty });
    assert.equal(stray.status, 'failed'); assert.equal(stray.diagnostics[0].code, 'ADOPT_TEMPLATE_MISSING', 'without bin/kit.json the root is a checkout');
    await writeFile(join(empty, 'bin/kit.json'), '{}');
    const unverified = await executeOperation({ command: 'adopt skill', args: [], options: {} }, { root: project, frameworkRoot: empty });
    assert.equal(unverified.status, 'failed'); assert.equal(unverified.diagnostics[0].code, 'KIT_VERSION');
    assert.equal((await readdir(project, { recursive: true })).some(path => path.includes('.claude')), false);
  });
});
test('help, capabilities and argument validation describe the adopt commands', async () => {
  const help = await runJson(['help', 'adopt', 'plan']); assert.equal(help.json.data.commands[0].id, 'adopt plan'); assert.ok('report' in help.json.data.commands[0].optionHelp); assert.equal(help.json.data.commands[0].optionHelp.out.default, 'docs/workbench/ADOPTION-PLAN.md');
  const all = await runJson(['capabilities']); assert.deepEqual(all.json.data.commands.filter(item => item.id.startsWith('adopt ')).map(item => [item.id, item.group, item.execution]), [['adopt analyze', 'adopt', 'read'], ['adopt plan', 'adopt', 'plan'], ['adopt skill', 'adopt', 'plan']]);
  assert.ok(all.json.data.groups.some(group => group.id === 'adopt'));
  assert.equal(code(await runJson(['adopt', 'analyze', 'extra'])), 'INVALID_ARGUMENT'); assert.equal(code(await runJson(['adopt', 'analyze', '--report', 'x'])), 'INVALID_OPTION'); assert.equal(code(await runJson(['adopt', 'skill', '--out', 'x'])), 'INVALID_OPTION');
  assert.equal(code(await runJson(['adopt', 'analyse'])), 'UNKNOWN_COMMAND'); assert.equal(code(await runJson(['adopt', 'analyze', '--target'])), 'MISSING_VALUE');
  const text = await run(['help', 'adopt', 'analyze']); assert.match(text.stdout, /read-only/); assert.equal(resolve(frameworkRoot), frameworkRoot);
});
test('the human analysis view lists facts and findings with a next step and no raw JSON', async () => {
  await withProject('angular-ngmodule-legacy', async project => {
    const human = await run(['adopt', 'analyze', '--target', project]); assert.equal(human.code, 0, human.stderr);
    for (const text of ['adopt analyze: ok', 'Angular', '15.2.10', '[FAIL] ANGULAR_TARGET_GAP', '[warn] NODE_MAJOR_DIFFERS', 'Next: node bin/app adopt plan']) assert.ok(human.stdout.includes(text), text);
    assert.ok(!human.stdout.trim().startsWith('{'));
    const out = join(project, '..', 'r.json'); const written = await run(['adopt', 'analyze', '--target', project, '--out', out]); assert.match(written.stdout, /Report written/);
  });
});
