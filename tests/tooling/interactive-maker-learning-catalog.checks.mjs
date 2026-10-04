import assert from 'node:assert/strict';
import { readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { checkedLearningCatalog, learningIssues, learningStepMarkdown, loadLearningCatalog } from '../../bin/adapters/learning-catalog.ts';
import { evaluateLearningStep } from '../../bin/adapters/learning-checks.ts';
import { learningProgressPlan, learningProgressSummary, loadLearningProgress, restartLearningPlan } from '../../bin/adapters/learning-progress-store.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { definitionsRoot, loadCatalog } from '../../bin/adapters/wizard-catalog.ts';
import { completeLearningStep, newLearningProgress } from '../../bin/domain/learning-progress.ts';
import { contactForm, greetWizard, learningPath, project, put, scratch, shippedLearningIssues, step, wizard } from './interactive-maker-learning-fixture.mjs';
const repository = resolve(import.meta.dirname, '../..');
const now = '2026-10-04T10:00:00.000Z';
const guide = '# Guide\n\n## Start here\n\nText.\n';

test('shipped learning paths live in configs/learning, load, and pass every reference check', async () => {
  const catalog = await loadLearningCatalog();
  assert.equal(catalog.root, definitionsRoot);
  assert.equal(catalog.repository, repository);
  assert.deepEqual([...catalog.paths.keys()].sort(), ['author-a-learning-path', 'author-a-wizard', 'idea-to-prototype-with-claude-design']);
  assert.deepEqual(await learningIssues(catalog, await loadCatalog()), await shippedLearningIssues(repository));
  assert.deepEqual(catalog.paths.get('author-a-learning-path').prerequisites, ['author-a-wizard']);
  for (const name of await readdir(join(repository, 'configs/learning/paths')))
    assert.equal(JSON.parse(await readFile(join(repository, 'configs/learning/paths', name), 'utf8')).$schema, '../../schemas/learning-path.schema.json', name);
  const schema = JSON.parse(await readFile(join(repository, 'configs/schemas/learning-path.schema.json'), 'utf8'));
  assert.deepEqual(schema.$defs.condition.properties.kind.enum, ['checklist-complete', 'form-valid', 'answer', 'file-exists', 'file-contains', 'wizard-completed', 'wizard-check']);
  assert.deepEqual(schema.$defs.action.properties.kind.enum, ['wizard', 'form', 'command']);
  const wizardCourse = catalog.paths.get('author-a-wizard');
  assert.match(learningStepMarkdown(catalog, wizardCourse.steps[0]), /\[\[docs\/development\/WIZARDS-AND-FORMS#Run, inspect and check/);
  assert.match(learningStepMarkdown(catalog, wizardCourse.steps[1]), /lowercase kebab-case ids/);
  assert.equal(learningStepMarkdown(catalog, { id: 'x', markdown: undefined }), undefined);
  const kinds = new Set([...catalog.paths.values()].flatMap(path => path.steps.flatMap(item => (item.winConditions ?? []).map(condition => condition.kind))));
  assert.deepEqual([...kinds].sort(), ['answer', 'checklist-complete', 'file-contains', 'file-exists', 'form-valid', 'wizard-check', 'wizard-completed']);
  const ignored = await readFile(join(repository, '.gitignore'), 'utf8');
  assert.ok(ignored.split('\n').includes('.workbench/learning/'), 'learner progress is personal state');
});

test('the catalog reports unknown references, unsafe content, broken links and prerequisite cycles', async () => scratch(async root => {
  const configs = await project(root, {
    forms: { contact: contactForm },
    wizards: { greet: greetWizard },
    docs: { 'docs/guide.md': guide, 'README.md': '# Readme\n' },
    content: { 'one/lesson.md': 'Read [[docs/guide#Start here]] and [[docs/missing]].', 'one/bad.md': '<script>x</script>', 'one/binary.md': Buffer.from([0xff, 0xfe, 0x00]) },
    paths: {
      one: learningPath('one', [
        step('read', { markdown: { file: 'one/lesson.md' }, docs: ['README', 'docs/guide#Nope', 'bin/README'] }),
        step('bad', { markdown: { file: 'one/bad.md' } }),
        step('binary', { markdown: { file: 'one/binary.md' } }),
        step('gone', { markdown: { file: 'one/gone.md' } }),
        step('refs', { form: 'ghost', bind: 'x', actions: [{ id: 'w', kind: 'wizard', label: 'W', wizard: 'phantom' }, { id: 'f', kind: 'form', label: 'F', form: 'nobody', bind: 'y' }, { id: 'ok', kind: 'wizard', label: 'OK', wizard: '{{x.id}}' }] }),
        step('hooks', { fields: [{ id: 'pick', kind: 'select', label: 'Pick', choicesFrom: 'settings.folders' }, { id: 'more', kind: 'section', label: 'More', form: 'absent', bind: 'more' }], bind: 'h' }),
      ], { prerequisites: ['two'] }),
      two: learningPath('two', [step('a')], { prerequisites: ['one', 'ghost'] }),
    },
  });
  const catalog = await loadLearningCatalog(configs), definitions = await loadCatalog(configs);
  assert.equal(catalog.repository, root);
  const issues = await learningIssues(catalog, definitions);
  for (const pattern of [/content one\/bad.md: .*executable markup/, /content one\/binary.md: /, /content one\/gone.md: /,
    /path one.read: broken documentation link \[\[docs\/missing\]\]: docs\/missing.md does not exist/, /path one.read: broken documentation link \[\[docs\/guide#Nope\]\]: no heading "Nope"/,
    /path one.read: broken documentation link \[\[bin\/README\]\]/, /path one.refs: unknown form ghost/, /path one.refs: unknown form nobody/, /path one.refs: unknown wizard phantom/,
    /path one.hooks.pick: inline fields cannot name code hooks/, /path one.hooks.more: unknown form absent/, /prerequisite cycle one → two → one/, /path two: unknown prerequisite ghost/])
    assert.ok(issues.some(item => pattern.test(item)), `${pattern}\n${issues.join('\n')}`);
  assert.ok(!issues.some(item => /docs\/guide#Start here|\[\[README\]\]|wizard \{\{/.test(item)), issues.join('\n'));
  await assert.rejects(() => checkedLearningCatalog(definitions, configs), /LEARNING_REFERENCE|unknown form ghost/);
  await put(root, 'configs/learning/paths/three.json', learningPath('renamed', [step('a')]));
  await assert.rejects(() => loadLearningCatalog(configs), /three.json must be named renamed.json/);
  await put(root, 'configs/learning/paths/three.json', '{"schemaVersion": 1,');
  await assert.rejects(() => loadLearningCatalog(configs), /three.json: /);
  await put(root, 'configs/learning/paths/three.json', learningPath('three', [step('a', { run: true })]));
  await assert.rejects(() => loadLearningCatalog(configs), /three.json: Unknown fields: run/);
  const empty = await loadLearningCatalog(join(root, 'nowhere'));
  assert.deepEqual([empty.paths.size, empty.contentIssues], [0, []]);
}));

test('file and catalog win conditions read the project with bounded, link-refusing checks', async () => scratch(async root => {
  const course = learningPath('files', [step('files', { winConditions: [
    { kind: 'file-exists', file: 'notes/{{me.name}}.md' },
    { kind: 'file-contains', file: 'notes/{{me.name}}.md', text: 'Hello {{me.name}}', label: 'Your note greets you' },
    { kind: 'file-exists', file: '{{me.dir}}/config' },
    { kind: 'wizard-check', wizard: '{{me.wizard}}' },
    { kind: 'wizard-check' },
  ] })]);
  const configs = await project(root, { paths: { files: course } }), catalog = await loadLearningCatalog(configs), definitions = await loadCatalog(configs);
  const path = catalog.paths.get('files'), context = { root, definitions }, progress = newLearningProgress(path, now);
  const results = async () => (await evaluateLearningStep(context, path.steps[0], progress)).map(check => [check.met, check.label, check.detail]);
  assert.deepEqual((await results()).map(item => item[2]), ['Answer me.name in an earlier step first.', 'Answer me.name in an earlier step first.', 'Answer me.dir in an earlier step first.', 'Answer me.wizard in an earlier step first.', undefined]);
  progress.answers.me = { name: 'ann', dir: '.git', wizard: 'greet' };
  let checks = await results();
  assert.deepEqual(checks[0], [false, 'File notes/ann.md exists', 'notes/ann.md does not exist yet.']);
  assert.deepEqual(checks[2], [false, 'File .git/config exists', '.git/config is not a safe project-relative file.']);
  assert.deepEqual(checks[3], [false, 'wizard check passes and lists greet', 'wizard check passes, but configs/wizards/greet.json is missing.']);
  assert.deepEqual(checks[4], [true, 'wizard check passes', undefined]);
  await put(root, 'notes/ann.md', 'Hi there');
  await project(root, { forms: { contact: contactForm }, wizards: { greet: greetWizard } });
  checks = await results();
  assert.deepEqual(checks.slice(0, 2), [[true, 'File notes/ann.md exists', undefined], [false, 'Your note greets you', 'notes/ann.md does not contain "Hello ann" yet.']]);
  assert.deepEqual(checks[3], [true, 'wizard check passes and lists greet', undefined]);
  await put(root, 'notes/ann.md', 'Hello ann!');
  assert.equal((await results())[1][0], true);
  await put(root, 'notes/ann.md', 'x'.repeat(1_000_001) + 'Hello ann');
  assert.deepEqual((await results())[1], [false, 'Your note greets you', 'notes/ann.md is larger than 1000000 characters.']);
  await put(root, 'outside.txt', 'Hello ann');
  progress.answers.me.name = 'link';
  await symlink(join(root, 'outside.txt'), join(root, 'notes/link.md'));
  assert.match((await results())[0][2], /PLAN_SYMLINK/);
  await put(root, 'configs/wizards/broken.json', wizard('broken', [{ id: 'a', kind: 'form', form: 'missing' }]));
  assert.match((await results())[4][2], /wizard broken.a: unknown form missing/);
  await put(root, 'configs/wizards/broken.json', '{');
  assert.match((await results())[4][2], /broken.json/);
}));

test('progress is saved, resumed and restarted only through reviewed, hash-guarded plans', async () => scratch(async root => {
  const configs = await project(root, { paths: { one: learningPath('one', [step('a', { checklist: [{ id: 'x', label: 'X' }] }), step('b')]) } });
  const path = (await loadLearningCatalog(configs)).paths.get('one'), file = join(root, '.workbench/learning/one.json');
  assert.deepEqual(await loadLearningProgress(root, path), { progress: null, beforeHash: null });
  assert.deepEqual(await learningProgressSummary(root, path), { totalSteps: 2, completedSteps: 0, currentStep: null, finished: false, started: false });
  await assert.rejects(() => restartLearningPlan(root, path), /No saved progress for one/);
  const progress = completeLearningStep(path, { ...newLearningProgress(path, now), checklists: { a: ['x'] } }, 'a', now);
  const plan = await learningProgressPlan(root, progress, null);
  assert.deepEqual(plan.plan.changes.map(change => [change.path, change.status]), [['.workbench/learning/one.json', 'create']]);
  assert.equal((await applyPrepared(plan)).status, 'planned');
  await assert.rejects(() => readFile(file), /ENOENT/);
  await assert.rejects(() => applyPrepared(plan, 'not-the-hash'), /plan changed/);
  assert.equal((await applyPrepared(plan, plan.planHash)).status, 'applied');
  const resumed = await loadLearningProgress(root, path);
  assert.deepEqual(JSON.parse(JSON.stringify(resumed.progress)), JSON.parse(JSON.stringify(progress)));
  assert.equal(resumed.progress.currentStep, 'b');
  assert.deepEqual(await learningProgressSummary(root, path), { totalSteps: 2, completedSteps: 1, currentStep: 'b', finished: false, started: true });
  await assert.rejects(() => learningProgressPlan(root, progress, null), /changed since it was loaded/);
  const stale = await learningProgressPlan(root, { ...progress, currentStep: 'a' }, resumed.beforeHash);
  await writeFile(file, (await readFile(file, 'utf8')).replace('"b"', '"a"'));
  await assert.rejects(() => applyPrepared(stale, stale.planHash), /PLAN_STALE/);
  await writeFile(file, '{"schemaVersion": 1, "producer": "someone-else"}');
  await assert.rejects(() => loadLearningProgress(root, path), /cannot be resumed .*left unchanged. Restart explicitly with learn restart --name one/);
  assert.deepEqual(await learningProgressSummary(root, path), { error: 'LEARNING_PROGRESS' });
  assert.equal(await readFile(file, 'utf8'), '{"schemaVersion": 1, "producer": "someone-else"}');
  const restart = await restartLearningPlan(root, path);
  assert.deepEqual([restart.data.restarted, restart.plan.changes[0].status], [true, 'delete']);
  assert.equal((await applyPrepared(restart, restart.planHash)).status, 'applied');
  await assert.rejects(() => readFile(file), /ENOENT/);
}));
