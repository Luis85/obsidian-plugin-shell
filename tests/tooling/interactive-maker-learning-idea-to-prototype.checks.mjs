// The shipped idea-to-prototype-with-claude-design course: structure, references, cited commands and win conditions
// evaluated against a scratch project whose prototype package and design folder are written by the real CLI.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { main } from '../../bin/app.ts';
import { learningIssues, learningStepMarkdown, loadLearningCatalog } from '../../bin/adapters/learning-catalog.ts';
import { evaluateLearningStep } from '../../bin/adapters/learning-checks.ts';
import { loadCatalog } from '../../bin/adapters/wizard-catalog.ts';
import { completeLearningStep, newLearningProgress } from '../../bin/domain/learning-progress.ts';
import { put, scratch, shippedLearningIssues } from './interactive-maker-learning-fixture.mjs';
const repository = resolve(import.meta.dirname, '../..');
const id = 'idea-to-prototype-with-claude-design';
const now = '2026-10-04T10:00:00.000Z';
const steps = ['understand-the-journey', 'name-your-prototype', 'brainstorm-the-idea', 'write-the-design-brief', 'prepare-the-design-folder',
  'design-in-claude-design', 'request-the-handover', 'save-and-sync', 'implement-in-the-prototype', 'record-an-increment', 'add-to-the-release-candidate'];
/** Commands of the release-candidate feature, which is delivered separately and may not be installed yet. */
const pendingRoots = new Set(['increment', 'candidate']);
const course = async () => (await loadLearningCatalog()).paths.get(id);

async function cli(root, ...argv) {
  const output = new PassThrough(), chunks = [];
  output.on('data', chunk => chunks.push(chunk));
  const code = await main([...argv, '--root', root, '--json'], repository, { input: Readable.from([]), output, error: new PassThrough(), env: {} });
  const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(code, 0, JSON.stringify(json.diagnostics));
  return json;
}
/** Plan, then apply exactly the reviewed hash, like a learner following the step's commands. */
async function planAndApply(root, ...argv) {
  const planned = await cli(root, ...argv);
  assert.equal(planned.status, 'planned');
  assert.equal((await cli(root, ...argv, '--apply', planned.data.planHash)).status, 'applied');
}
/** Invocable command ids from the real CLI: the framework catalog and the maker surface listed by its own help. */
function commandIds() {
  const run = (...args) => spawnSync(process.execPath, ['bin/app', ...args], { cwd: repository, encoding: 'utf8', timeout: 120_000 }).stdout;
  const ids = new Set(JSON.parse(run('capabilities', '--json')).data.commands.map(entry => entry.id));
  for (const line of run('brainstorm', '--help').split('\n')) {
    const [command, action] = (/^\s*node bin\/app\s+(.*)$/.exec(line)?.[1] ?? '').trim().split(/\s+/);
    if (/^[a-z][a-z-]*$/.test(command ?? '')) { ids.add(command); if (/^[a-z][a-z-]*$/.test(action ?? '')) ids.add(`${command} ${action}`); }
  }
  return ids;
}
const known = (ids, [command, action]) => ids.has(`${command} ${action}`) || (ids.has(command) && !/^[a-z][a-z-]*$/.test(action ?? ''));

test('the course teaches the journey in order and passes learn check except the pending release-candidate guide', async () => {
  const catalog = await loadLearningCatalog(), definitions = await loadCatalog(), path = catalog.paths.get(id);
  assert.deepEqual(path.steps.map(item => item.id), steps);
  assert.deepEqual([path.prerequisites, path.title], [[], 'From idea to prototype with Claude Design']);
  const issues = (await learningIssues(catalog, definitions)).filter(issue => issue.startsWith(`path ${id}.`) || issue.includes(`content idea-to-prototype/`));
  const pending = await shippedLearningIssues(repository);
  assert.deepEqual(issues, pending);
  assert.ok(pending.every(issue => /\.(?:record-an-increment|add-to-the-release-candidate): .*RELEASE-CANDIDATES/.test(issue)), pending.join('\n'));
  const wizards = path.steps.flatMap(item => (item.actions ?? []).flatMap(action => action.wizard ? [action.wizard] : []));
  assert.deepEqual(wizards, ['brainstorm', 'prototype']);
  assert.ok(wizards.every(wizard => definitions.wizards.has(wizard)));
  const glossary = learningStepMarkdown(catalog, path.steps[0]);
  for (const term of ['Brief (design brief)', 'Prototype package', 'Design folder', 'Handoff guide', 'Implementation map', 'Increment', 'Release candidate', '## Where to find what'])
    assert.ok(glossary.includes(term), term);
  for (const index of [9, 10]) assert.match(path.steps[index].title, /\(release-candidate feature\)$/);
});

test('every command the course shows or cites exists in the real CLI, except the pending release-candidate commands', async () => {
  const catalog = await loadLearningCatalog(), path = catalog.paths.get(id), ids = commandIds();
  const scripts = JSON.parse(await readFile(join(repository, 'package.json'), 'utf8')).scripts;
  assert.deepEqual([known(ids, ['design', 'prepare']), known(ids, ['design', 'publish']), known(ids, ['design', '--name'])], [true, false, true]);
  const shown = path.steps.flatMap(item => (item.actions ?? []).flatMap(action => action.command ? [action.command] : []));
  const cited = path.steps.flatMap(item => [...(learningStepMarkdown(catalog, item) ?? '').matchAll(/node bin\/app[^`\n]*/g)].map(match => match[0]));
  const unknown = new Set();
  for (const line of [...shown, ...cited]) {
    const npm = /^npm run ([^ ]+)/.exec(line);
    if (npm) { assert.ok(Object.hasOwn(scripts, npm[1]), line); continue; }
    const tokens = line.replace(/^node bin\/app\s*/, '').split(/\s+/).filter(Boolean);
    if (!tokens.length || known(ids, tokens)) continue;
    assert.ok(pendingRoots.has(tokens[0]), `unknown command: ${line}`);
    unknown.add(tokens[0]);
  }
  assert.ok(shown.some(line => line.startsWith('node bin/app design prepare --name <slug> --project prototypes/<slug>/companion.project.json --package prototypes/<slug>')));
  assert.ok([...unknown].every(root => !ids.has(root)), 'a release-candidate command is installed, so it must resolve');
});

test('win conditions follow the real prototype package and design folder, then the design work and the release records', async () => scratch(async root => {
  const path = await course(), context = { root, definitions: await loadCatalog() };
  let progress = { ...newLearningProgress(path, now), answers: {
    plan: { title: 'Reading log', slug: 'reading-log', version: '0.5.0' }, idea: { route: 'prd', record: 'docs/prds/reading-log.md' },
    handover: { prototypeFile: 'node-1--compact.html' }, release: { incrementId: 'INC-0001', incrementFile: 'INC-0001-reading-log.md' } } };
  progress.checklists = Object.fromEntries(path.steps.filter(item => item.checklist).map(item => [item.id, item.checklist.map(entry => entry.id)]));
  const unmet = async index => (await evaluateLearningStep(context, path.steps[index], progress)).filter(check => !check.met).map(check => `${check.label}: ${check.detail}`);
  const complete = async index => { assert.deepEqual(await unmet(index), [], path.steps[index].id); progress = completeLearningStep(path, progress, path.steps[index].id, now); };
  for (const index of [0, 1]) await complete(index);
  assert.deepEqual(await unmet(2), ['Your brainstorm result docs/prds/reading-log.md exists: docs/prds/reading-log.md does not exist yet.']);
  await put(root, 'docs/prds/reading-log.md', '---\ntype: prd\nid: reading-log\ntitle: Reading log\n---\n# Reading log\n');
  await complete(2);
  assert.equal((await unmet(3)).length, 4, 'no package yet');
  await put(root, 'answers.json', { schemaVersion: 1, guideId: 'companion-prototype', guideVersion: 1, answers: { title: 'Reading log', pages: ['Overview', 'Details'], approved: true } });
  await planAndApply(root, 'prototype', '--input', 'answers.json', '--out', 'prototypes/reading-log');
  await complete(3);
  assert.match((await unmet(4))[0], /docs\/design\/reading-log\/design\.manifest\.json does not exist yet/);
  await planAndApply(root, 'design', 'prepare', '--name', 'reading-log', '--project', 'prototypes/reading-log/companion.project.json', '--package', 'prototypes/reading-log');
  await complete(4);
  for (const index of [5, 6]) await complete(index);
  const map = join(root, 'docs/design/reading-log/handoff/implementation-map.md'), seeded = await readFile(map, 'utf8');
  assert.deepEqual((await unmet(7)).map(item => item.split(':')[0]), ['File docs/design/reading-log/prototypes/node-1--compact.html exists',
    'The prototype maps its elements with data-design-id', 'At least one implementation-map row is ready']);
  await put(root, 'docs/design/reading-log/prototypes/node-1--compact.html', '<!doctype html><main data-design-id="node-1">Overview</main>\n');
  await put(root, 'docs/design/reading-log/handoff/implementation-map.md', seeded.replace('| `node-1` | todo | — | — |', '| `node-1` | ready | prototypes/node-1--compact.html | Lists books |'));
  const status = await cli(root, 'design', 'status', '--name', 'reading-log');
  assert.deepEqual([status.data.folders[0].state, status.data.folders[0].prototypes, status.data.folders[0].implementation], ['current', ['prototypes/node-1--compact.html'], { ready: 1, todo: 1 }]);
  await complete(7);
  assert.deepEqual(await unmet(8), ['At least one implementation-map row is implemented: docs/design/reading-log/handoff/implementation-map.md does not contain "| implemented |" yet.']);
  await put(root, 'docs/design/reading-log/handoff/implementation-map.md', (await readFile(map, 'utf8')).replace('| ready |', '| implemented |'));
  await complete(8);
  assert.equal((await unmet(9)).length, 4, 'no increment note yet');
  await put(root, 'docs/releases/increments/INC-0001-reading-log.md', '---\ntype: Increment\nid: INC-0001\nsources:\n  - prototypes/reading-log\n---\n# Reading log\n');
  assert.deepEqual(await unmet(9), ['Its sources list docs/design/reading-log: docs/releases/increments/INC-0001-reading-log.md does not contain "docs/design/reading-log" yet.']);
  await put(root, 'docs/releases/increments/INC-0001-reading-log.md', '---\ntype: Increment\nid: INC-0001\nsources:\n  - prototypes/reading-log\n  - docs/design/reading-log\n---\n# Reading log\n');
  await complete(9);
  await put(root, 'docs/releases/candidates/0.5.0/README.md', '---\ntype: ReleaseCandidate\nversion: 0.5.0\nincrements: []\n---\n');
  assert.deepEqual(await unmet(10), ['The candidate lists INC-0001: docs/releases/candidates/0.5.0/README.md does not contain "INC-0001" yet.']);
  await put(root, 'docs/releases/candidates/0.5.0/README.md', '---\ntype: ReleaseCandidate\nversion: 0.5.0\nincrements:\n  - INC-0001\n---\n');
  await complete(10);
  assert.deepEqual([Object.keys(progress.completed), progress.currentStep], [steps, 'add-to-the-release-candidate']);
}));
