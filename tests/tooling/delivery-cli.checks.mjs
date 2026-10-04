import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseDocument } from 'yaml';
import { changelog, docsIndex, handoffPath, readyHandoff, repositoryRoot } from './delivery-fixture.mjs';
import { inspectWorkflow } from '../../scripts/quality/check-repository.mjs';
import { validateChangelog } from '../../scripts/release/changelog.mjs';

const script = name => join(repositoryRoot, 'scripts/delivery', name);
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:DELIVERY_|PR_LABELS$|GIT_)/.test(key)));

/** A real repository: main with the delivery configuration, then a feature branch carrying one increment. */
async function repository(t) {
  const folder = await mkdtemp(join(tmpdir(), 'delivery-git-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const root = join(folder, 'work');
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: cleanEnv });
    if (result.status !== 0) throw new Error(`fixture git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  };
  const write = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  for (const name of ['delivery.json', 'definition-of-ready.json', 'definition-of-done.json', 'increment-handoff.template.md']) {
    await mkdir(join(root, 'configs/delivery'), { recursive: true }); await copyFile(join(repositoryRoot, 'configs/delivery', name), join(root, 'configs/delivery', name));
  }
  const files = { 'package.json': '{ "scripts": { "check": "node bin/app check" } }\n', 'tests/suites.json': '{ "suites": [{ "name": "release" }, { "name": "quality" }] }\n',
    'CHANGELOG.md': changelog.replace('- A greeting command in the palette.\n', '- Older entry.\n'), 'docs/README.md': docsIndex.replace('| [Guide](guide.md) | Use it. |\n', ''),
    'docs/prds/MVP.md': '# MVP\n', 'docs/requirements/WB-PBI-001.md': '# PBI\n', 'scripts/tool.mjs': 'export {};\n', 'src/features/existing.ts': 'export const a = 1;\n' };
  for (const [path, text] of Object.entries(files)) await write(path, text);
  git('init', '--quiet', '--initial-branch=main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'commit.gpgsign', 'false');
  git('add', '.'); git('commit', '--quiet', '-m', 'Base');
  git('checkout', '--quiet', '-b', 'feature/greeting');
  await write(handoffPath, readyHandoff());
  await write('src/features/greeting/command.ts', 'export const greet = () => "hi";\n');
  await write('tests/greeting.checks.mjs', 'export {};\n');
  await write('docs/guide.md', '# Guide\n\n> Type: how-to · Part of the index\n');
  git('add', '.'); git('commit', '--quiet', '-m', 'Greeting increment');
  const run = (name, args = [], env = {}) => {
    const result = spawnSync(process.execPath, [script(name), ...args], { cwd: root, encoding: 'utf8', env: { ...cleanEnv, ...env } });
    return { exit: result.status, stdout: result.stdout, stderr: result.stderr, json: () => JSON.parse(result.stdout) };
  };
  return { root, folder, git, write, run, read: path => readFile(join(root, path), 'utf8') };
}

test('end to end in a real repository: ready, not done with generated docs in --out, then done after --write', async t => {
  const repo = await repository(t);
  const summary = join(repo.folder, 'summary.md');
  const ready = repo.run('ready.mjs', ['--base', 'main', '--json', '--summary', summary]);
  assert.equal(ready.exit, 0, ready.stdout + ready.stderr);
  assert.deepEqual([ready.json().protocolVersion, ready.json().gate, ready.json().status, ready.json().handoff], [1, 'ready', 'ready', handoffPath]);
  assert.match(await readFile(summary, 'utf8'), /^## Definition of Ready: ready\n/);
  const out = join(repo.folder, 'generated');
  const pending = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--out', out]);
  assert.equal(pending.exit, 1);
  assert.match(pending.stdout, /Definition of Done: NOT-DONE[\s\S]*FAIL {2}DOD-02[\s\S]*fix: Tick each criterion[\s\S]*FAIL {2}DOD-04/);
  assert.deepEqual((await readdir(out, { recursive: true })).filter(name => name.endsWith('.md')).sort(), ['CHANGELOG.md', 'docs/README.md', 'docs/increments/sample-increment.md']);
  assert.equal(await repo.read('CHANGELOG.md'), changelog.replace('- A greeting command in the palette.\n', '- Older entry.\n'), '--out never touches the checkout');
  await repo.write(handoffPath, readyHandoff({ checked: true })); repo.git('commit', '--quiet', '-am', 'Evidence');
  const written = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--write', '--json']);
  assert.equal(written.exit, 0, written.stdout);
  assert.equal(written.json().status, 'done'); assert.deepEqual(written.json().generated.written.sort(), ['CHANGELOG.md', 'docs/README.md', handoffPath]);
  const updated = await repo.read('CHANGELOG.md');
  assert.ok(validateChangelog(updated).ok); assert.match(updated, /### Added\n\n- Older entry\.\n- A greeting command in the palette\.\n/);
  assert.match(await repo.read('docs/README.md'), /\| \[Guide\]\(guide\.md\) \| explains the command\. \|/);
  const handoff = await repo.read(handoffPath);
  assert.match(handoff, /\nstatus: Done\n/); assert.match(handoff, /## Completion record\n[\s\S]*Base: `main`[\s\S]*E2E decision: optional; `e2e` label not verifiable locally[\s\S]*was not available here/);
  assert.match(handoff, /Changed files: 6 \(4 added, 2 modified[\s\S]*\| Outside the affected areas \| 0 \|/, 'the record counts the files the write changed');
  const rerun = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--write']);
  assert.equal(rerun.exit, 0); assert.doesNotMatch(rerun.stdout, /wrote /, 'a second --write is a no-op');
  if (process.platform !== 'win32') {
    await mkdir(join(repo.folder, 'deps')); await symlink(join(repo.folder, 'deps'), join(repo.root, 'node_modules'), 'dir');
    const linked = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--json']);
    assert.equal(linked.json().rules.find(rule => rule.id === 'DOD-08').status, 'pass', 'an untracked linked dependency folder is environment, not a change');
  }
  const labelled = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--json'], { PR_LABELS: 'docs,e2e' });
  assert.match(labelled.json().rules.find(rule => rule.id === 'DOD-10').message, /not required/);
});

test('end to end: exemptions, refinement output, handoff choice, usage, configuration and base errors', async t => {
  const repo = await repository(t);
  const exempt = repo.run('ready.mjs', ['--json'], { DELIVERY_HEAD_REF: 'release/1.2.3' });
  assert.equal(exempt.exit, 0); assert.equal(exempt.json().status, 'exempt'); assert.match(exempt.json().notices[0], /release\/1\.2\.3 is exempt/);
  assert.equal(repo.run('done.mjs', [], { DELIVERY_ACTOR: 'dependabot[bot]' }).exit, 0);
  await repo.write(handoffPath, readyHandoff().replace('## Open questions\n\nNone.', '## Open questions\n\n- Which palette group?'));
  const out = join(repo.folder, 'brief');
  const notReady = repo.run('ready.mjs', ['--base', 'main', '--out', out, '--summary', join(repo.folder, 's.md')]);
  assert.equal(notReady.exit, 1); assert.match(notReady.stdout, /Refinement needed: run the `increment-handoff`/);
  assert.match(await readFile(join(out, 'refinement-brief.md'), 'utf8'), /^# Refinement brief: docs\/increments\/sample-increment\.md[\s\S]*ideation-brainstorm/);
  assert.match(await readFile(join(repo.folder, 's.md'), 'utf8'), /### Refinement brief/);
  const created = repo.run('increment.mjs', ['new', 'second-one', '--title', 'Second', '--owner', 'Someone', '--from', 'docs/prds/MVP.md', '--write']);
  assert.equal(created.exit, 0, created.stderr);
  assert.match(await repo.read('docs/increments/second-one.md'), /^---\ntype: Increment\nid: second-one\ntitle: "Second"\nowner: "Someone"[\s\S]*refs: \[docs\/prds\/MVP\.md\]/);
  assert.equal(repo.run('increment.mjs', ['new', 'second-one', '--write']).exit, 2, 'never overwrites');
  assert.equal(repo.run('increment.mjs', ['new', 'Bad_Slug']).exit, 2);
  assert.match(repo.run('increment.mjs', ['new', 'dry-run']).stdout, /^---\ntype: Increment\nid: dry-run\n/);
  const two = repo.run('ready.mjs', ['--base', 'main']);
  assert.equal(two.exit, 1); assert.match(two.stdout, /2 handoffs changed/);
  const chosen = repo.run('ready.mjs', ['--base', 'main', '--json'], { DELIVERY_PR_BODY: 'Summary\n\nHandoff: docs/increments/second-one.md\n' });
  assert.equal(chosen.json().handoff, 'docs/increments/second-one.md');
  const usage = repo.run('ready.mjs', ['--bogus']);
  assert.equal(usage.exit, 2); assert.match(usage.stderr, /DELIVERY_USAGE: unknown argument --bogus[\s\S]*Exit codes/);
  assert.equal(repo.run('done.mjs', ['--base', 'no-such-ref']).exit, 2);
  assert.match(repo.run('done.mjs', ['--base', 'no-such-ref', '--json']).json().error, /DELIVERY_BASE_UNRESOLVED/);
  await repo.write('configs/delivery/definition-of-done.json', (await repo.read('configs/delivery/definition-of-done.json')).replace('"DOD-11"', '"DOD-12"'));
  const invalid = repo.run('done.mjs', ['--base', 'main']);
  assert.equal(invalid.exit, 2); assert.match(invalid.stderr, /DELIVERY_CONFIG_INVALID: configs\/delivery\/definition-of-done\.json: unknown rule "DOD-12"/);
  assert.match(repo.run('ready.mjs', ['--help']).stdout, /--summary/);
});

const workflow = async name => {
  const text = await readFile(join(repositoryRoot, '.github/workflows', name), 'utf8');
  return { text, data: parseDocument(text).toJS() };
};
test('the Definition of Ready and Done workflows are read-only, dependency-free and pass pull-request data only through env', async () => {
  for (const [file, id, name] of [['definition-of-ready.yml', 'ready', 'Definition of Ready'], ['definition-of-done.yml', 'done', 'Definition of Done']]) {
    const { text, data } = await workflow(file);
    assert.equal(inspectWorkflow(text, file).jobs, 1, file);
    assert.deepEqual(Object.keys(data.jobs), [id]); const job = data.jobs[id];
    assert.equal(data.name, name); assert.equal(job.name, name); assert.deepEqual(data.permissions, { contents: 'read' });
    assert.ok(job['timeout-minutes'] <= 5, file); assert.doesNotMatch(text, /npm (?:ci|install)|setup-qualified/, `${file} installs nothing`);
    assert.match(job.if, /!startsWith\(github\.head_ref, 'release\/'\)/, `${file} leaves release heads to release.yml`);
    assert.equal(job.env.DELIVERY_PR_BODY, '${{ github.event.pull_request.body }}'); assert.equal(job.env.DELIVERY_ACTOR, '${{ github.event.pull_request.user.login }}');
    assert.deepEqual(job.steps[0].with, { 'fetch-depth': 0, 'persist-credentials': false });
    assert.equal(job.steps[1].with['node-version-file'], '.nvmrc');
    const run = job.steps.find(step => step.run).run;
    assert.match(run, new RegExp(`node scripts/delivery/${id === 'ready' ? 'ready' : 'done'}\\.mjs --base "origin/\\$BASE_REF" --summary "\\$GITHUB_STEP_SUMMARY" --out`));
    assert.doesNotMatch(run, /--write|\$\{\{/, 'CI never writes and never interpolates');
    const upload = job.steps.find(step => step.uses?.startsWith('actions/upload-artifact@'));
    assert.equal(upload.with['retention-days'], 7); assert.equal(upload.if, '${{ !cancelled() }}');
  }
  const ready = (await workflow('definition-of-ready.yml')).data, done = (await workflow('definition-of-done.yml')).data;
  assert.deepEqual(ready.on.pull_request.types, ['opened', 'synchronize', 'reopened', 'edited', 'ready_for_review']);
  assert.deepEqual(done.on.pull_request.types, ['opened', 'synchronize', 'reopened', 'edited', 'ready_for_review', 'labeled', 'unlabeled']);
  assert.match(done.jobs.done.if, /github\.event\.pull_request\.draft != true/); assert.doesNotMatch(ready.jobs.ready.if, /draft/, 'drafts get the Definition of Ready');
  assert.equal(done.jobs.done.env.PR_LABELS, "${{ join(github.event.pull_request.labels.*.name, ',') }}");
});
