import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { changelog, configs, docsIndex, handoffPath, readyHandoff, repositoryRoot } from './delivery-fixture.mjs';
import { criterionSlug, planStubs, renderStub, stubPath, stubsOf, withEvidence } from '../../scripts/delivery/acceptance-stubs.mjs';
import { pendingAllowed, pendingStubAllowance, stubIncrement } from '../../scripts/delivery/acceptance-guard.mjs';
import { parseHandoff } from '../../scripts/delivery/handoff.mjs';
import { reviewChanges } from '../../scripts/quality/self-review.mjs';

const config = await configs();
const settings = config.delivery.acceptance;
const template = await readFile(join(repositoryRoot, settings.template), 'utf8');
const folder = 'tests/tooling/acceptance/sample-increment';
const pendingCall = ['test', 'todo'].join('.');
const withoutEvidence = text => text.replaceAll(' Evidence: `tests/greeting.checks.mjs`', '');

test('stubs: one per criterion, named by id and text, pending, linked to the increment and never replacing a file', () => {
  assert.equal(criterionSlug('Given a `vault`, When the user runs it, Then the palette lists the greeting command and much more text', 48), 'given-a-when-the-user-runs-it-then-the-palette');
  assert.equal(criterionSlug('!!!', 48), 'criterion');
  assert.equal(stubPath(settings, 'sample-increment', { id: 'AC-12', text: 'The palette lists it.' }), `${folder}/ac-12.checks.mjs`);
  const slugged = { ...settings, pattern: 'tests/tooling/acceptance/{increment}/{ac}-{slug}.checks.mjs' };
  assert.equal(stubPath(slugged, 'sample-increment', { id: 'AC-12', text: 'The palette lists it.' }), `${folder}/ac-12-the-palette-lists-it.checks.mjs`);
  const stub = renderStub(template, { incrementId: 'sample-increment', incrementPath: handoffPath, criterion: { id: 'AC-1', text: "Given a vault, When the user's command runs, Then it greets" } });
  assert.match(stub, /^\/\/ sample-increment AC-1: acceptance test stub/);
  assert.match(stub, /\/\/ Increment: \[\[docs\/increments\/sample-increment\]\]\n\/\/ AC-1: Given a vault, When the user's command runs, Then it greets\n\/\/ Given a vault\n\/\/ When the user's command runs\n\/\/ Then it greets\nimport test from 'node:test';/);
  assert.ok(stub.includes(`${pendingCall}('sample-increment AC-1: Given a vault, When the user\\'s command runs, Then it greets');`));
  assert.doesNotMatch(renderStub(template, { incrementId: 'x', incrementPath: 'docs/increments/x.md', criterion: { id: 'AC-2', text: 'Plain text.' } }), /\{\{|\/\/ Given/);
  const text = withoutEvidence(readyHandoff());
  const existing = `${folder}/ac-1-renamed-text.checks.mjs`, orphan = `${folder}/ac-7-removed.checks.mjs`;
  const plan = planStubs(settings, { incrementId: 'sample-increment', incrementPath: handoffPath, incrementText: text, model: parseHandoff(text), files: [existing, orphan, `${folder}/nested/ac-3.checks.mjs`], template });
  assert.deepEqual(plan.create.map(item => item.path), [`${folder}/ac-2.checks.mjs`]);
  assert.deepEqual([plan.existing, plan.orphans, plan.evidence], [[existing], [orphan], ['AC-1', 'AC-2']]);
  assert.match(plan.incrementText, new RegExp(`AC-1: The palette lists the greeting command\\. Evidence: \`${existing}\`\n`));
  assert.ok(plan.incrementText.replace(/ Evidence: `[^`]+`/g, '') === text, 'only the evidence is added');
  const real = planStubs(settings, { incrementId: 'sample-increment', incrementPath: handoffPath, incrementText: readyHandoff(), model: parseHandoff(readyHandoff()), files: ['tests/greeting.checks.mjs'], template });
  assert.deepEqual([real.create, real.evidence], [[], []], 'a criterion that already names an existing test needs no stub');
  assert.deepEqual([...stubsOf(settings, 'sample-increment', [existing, orphan, 'tests/tooling/acceptance/other/ac-1.checks.mjs']).keys()], ['AC-1', 'AC-7']);
  assert.equal(withEvidence('- [ ] AC-1: first\n  continued\n- [ ] AC-2: x\n', [{ line: 1, path: 'p.mjs' }], 'Evidence:'), '- [ ] AC-1: first\n  continued Evidence: `p.mjs`\n- [ ] AC-2: x\n');
});

test('the pending-stub exception: only a pending marker in a stub of an unfinished increment', async t => {
  const statusOf = status => () => status;
  const line = `${pendingCall}('sample-increment AC-1: x');`;
  assert.equal(stubIncrement(settings, `${folder}/ac-1-x.checks.mjs`), 'sample-increment');
  for (const path of [`${folder}/helper.mjs`, `${folder}/deep/ac-1.checks.mjs`, 'tests/tooling/ac-1-x.checks.mjs', 'tests/tooling/acceptance/ac-1.checks.mjs']) assert.equal(stubIncrement(settings, path), null, path);
  assert.equal(pendingAllowed(config.delivery, `${folder}/ac-1-x.checks.mjs`, line, statusOf('In progress')), true);
  for (const status of ['Done', 'Cancelled', null]) assert.equal(pendingAllowed(config.delivery, `${folder}/ac-1-x.checks.mjs`, line, statusOf(status)), false, String(status));
  assert.equal(pendingAllowed(config.delivery, 'tests/tooling/other.checks.mjs', line, statusOf('In progress')), false);
  assert.equal(pendingAllowed(config.delivery, `${folder}/ac-1-x.checks.mjs`, "test.only('x', () => {});", statusOf('In progress')), false, 'focus stays forbidden');
  assert.equal(pendingAllowed(config.delivery, `${folder}/ac-1-x.checks.mjs`, `${line} test.skip('y');`, statusOf('In progress')), false);
  const root = await mkdtemp(join(tmpdir(), 'delivery-guard-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(await (await pendingStubAllowance(root))(`${folder}/ac-1-x.checks.mjs`, line), false, 'no delivery configuration allows nothing');
  const write = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  await write('configs/delivery/delivery.json', await readFile(join(repositoryRoot, 'configs/delivery/delivery.json'), 'utf8'));
  await write(handoffPath, readyHandoff({ status: 'In progress' }));
  await write('docs/increments/done-increment.md', readyHandoff({ status: 'Done' }).replace('id: sample-increment', 'id: done-increment'));
  const added = (path, text) => ({ path, status: 'A', added: [{ line: 3, text }], removed: [] });
  const findings = async files => {
    for (const file of files) await write(file.path, `// x\n// y\n${file.added[0].text}\n`);
    return (await reviewChanges(root, files)).filter(item => item.rule === 'SR-FOCUSED-TEST').map(item => item.file);
  };
  assert.deepEqual(await findings([added(`${folder}/ac-1-x.checks.mjs`, line)]), [], 'a generated stub of an In progress increment may stay pending');
  const negatives = [added('tests/tooling/acceptance/done-increment/ac-1-x.checks.mjs', line), added('tests/tooling/feature.checks.mjs', line),
    added(`${folder}/ac-2-y.checks.mjs`, "test.only('y', () => {});"), added(`${folder}/helper.checks.mjs`, line), added('tests/tooling/acceptance/missing/ac-1-x.checks.mjs', line)];
  assert.deepEqual((await findings(negatives)).sort(), negatives.map(file => file.path).sort(), 'everywhere else, and after Done, a pending or focused test stays a finding');
});

const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:DELIVERY_|PR_LABELS$|GIT_)/.test(key)));
async function repository(t) {
  const root = await mkdtemp(join(tmpdir(), 'delivery-acceptance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: cleanEnv });
    if (result.status !== 0) throw new Error(`fixture git ${args.join(' ')}: ${result.stderr}`);
  };
  const write = async (path, text) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), text); };
  for (const name of ['delivery.json', 'definition-of-ready.json', 'definition-of-done.json', 'increment-handoff.template.md', 'acceptance-stub.checks.mjs.tmpl'])
    await write(`configs/delivery/${name}`, await readFile(join(repositoryRoot, 'configs/delivery', name), 'utf8'));
  const files = { 'package.json': '{ "scripts": { "check": "node bin/app check" } }\n', 'tests/suites.json': '{ "suites": [{ "name": "release" }] }\n', 'CHANGELOG.md': changelog,
    'docs/README.md': docsIndex, 'docs/prds/MVP.md': '# MVP\n', 'docs/requirements/WB-PBI-001.md': '# PBI\n', 'scripts/tool.mjs': 'export {};\n', 'tests/greeting.checks.mjs': 'export {};\n' };
  for (const [path, text] of Object.entries(files)) await write(path, text);
  git('init', '--quiet', '--initial-branch=main'); git('config', 'user.name', 'Fixture'); git('config', 'user.email', 'fixture@example.invalid'); git('config', 'commit.gpgsign', 'false');
  git('add', '.'); git('commit', '--quiet', '-m', 'Base'); git('checkout', '--quiet', '-b', 'increment/sample-increment');
  const run = (name, args) => {
    const result = spawnSync(process.execPath, [join(repositoryRoot, 'scripts/delivery', name), ...args], { cwd: root, encoding: 'utf8', env: cleanEnv });
    return { exit: result.status, stdout: result.stdout, stderr: result.stderr, json: () => JSON.parse(result.stdout) };
  };
  return { root, git, write, run, read: path => readFile(join(root, path), 'utf8') };
}
const rule = (report, id) => report.rules.find(item => item.id === id);

test('end to end: a new increment gets stubs, is ready while they are pending and done only once they assert', async t => {
  const repo = await repository(t);
  const created = repo.run('increment.mjs', ['new', 'sample-increment', '--title', 'Sample increment', '--owner', 'Maintainer', '--kickoff', '--issue', '--write']);
  assert.equal(created.exit, 0, created.stderr);
  const generated = await repo.read(handoffPath);
  assert.match(generated, /\npullRequests: \[sample-increment-kickoff\]\nissues: \[sample-increment\]\nbranch: "increment\/sample-increment"\nbase: main\n---/);
  assert.match(await repo.read('docs/pull-requests/sample-increment-kickoff.md'), /^---\ntype: PullRequest\nid: sample-increment-kickoff\ntitle: "Kick-off: Sample increment"\nincrement: sample-increment\nstatus: New\nkind: kickoff\nbase: main\nhead: "increment\/sample-increment"\n---/);
  assert.equal(repo.run('increment.mjs', ['new', 'sample-increment', '--kickoff', '--write']).exit, 2, 'never overwrites');
  const authored = withoutEvidence(readyHandoff({ status: 'Ready' })).replace('refs: [', 'pullRequests: [sample-increment-kickoff]\nissues: [sample-increment]\nbranch: "increment/sample-increment"\nbase: main\nrefs: [');
  await repo.write(handoffPath, authored); repo.git('add', '.'); repo.git('commit', '--quiet', '-m', 'Increment');
  const before = repo.run('ready.mjs', ['--base', 'main', '--json']);
  assert.equal(before.exit, 1); assert.equal(before.json().scope.kind, 'kickoff');
  assert.deepEqual(before.json().rules.filter(item => item.status === 'fail').map(item => item.id), ['DOR-24']);
  assert.equal(before.json().generated.stubs.length, 2);
  const written = repo.run('ready.mjs', ['--base', 'main', '--write', '--json']);
  assert.equal(written.exit, 0, written.stdout);
  const stubs = written.json().generated.stubs;
  assert.deepEqual(stubs, [`${folder}/ac-1.checks.mjs`, `${folder}/ac-2.checks.mjs`]);
  assert.deepEqual(written.json().generated.written.sort(), [handoffPath, ...stubs].sort());
  assert.match(await repo.read(stubs[0]), /AC-1: The palette lists the greeting command\.[\s\S]*test\.todo\('sample-increment AC-1: The palette lists the greeting command\.'\);/);
  assert.match(await repo.read(handoffPath), new RegExp(`- \\[ \\] AC-2: A failing notice reports the error without a partial write\\. Evidence: \`${stubs[1]}\``));
  const again = repo.run('ready.mjs', ['--base', 'main', '--write', '--json']);
  assert.deepEqual(again.json().generated.written, [], 'a second --write changes nothing');
  const listed = repo.run('acceptance.mjs', ['stubs', '--increment', 'sample-increment', '--json']);
  assert.equal(listed.exit, 0, listed.stderr); assert.deepEqual([listed.json().planned, listed.json().existing], [[], stubs]);
  const pending = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--json']).json();
  assert.equal(pending.scope.kind, 'kickoff'); assert.equal(rule(pending, 'DOD-18').status, 'fail');
  assert.deepEqual(rule(pending, 'DOD-18').details, stubs.map((path, index) => `AC-${index + 1}: ${path} is still pending`).flatMap((item, index) => [item, `AC-${index + 1}: ${stubs[index]} asserts nothing`]));
  for (const [index, path] of stubs.entries()) await repo.write(path, `import test from 'node:test';\nimport assert from 'node:assert/strict';\n\ntest('sample-increment AC-${index + 1}: implemented', () => { assert.equal(1 + 1, 2); });\n`);
  const implemented = repo.run('done.mjs', ['--base', 'main', '--no-plan', '--json']).json();
  assert.equal(rule(implemented, 'DOD-18').status, 'pass', JSON.stringify(rule(implemented, 'DOD-18')));
  await repo.write(`${folder}/ac-9-removed-criterion.checks.mjs`, '// AC-9\n');
  assert.equal(rule(repo.run('ready.mjs', ['--base', 'main', '--json']).json(), 'DOR-25').status, 'warn');
  assert.match(repo.run('acceptance.mjs', ['stubs', '--increment', 'sample-increment']).stdout, /warning: orphan stub .*ac-9-removed-criterion/);
  assert.equal(repo.run('acceptance.mjs', ['stubs', '--increment', 'missing']).exit, 1);
  assert.equal(repo.run('acceptance.mjs', ['stubs']).exit, 2);
});
