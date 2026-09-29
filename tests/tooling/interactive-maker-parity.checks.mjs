import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { studio, prototypeWizard } from '../../bin/presentation/studio.ts';
import { loadGuide } from '../../bin/adapters/prototype.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { checkSteps } from '../../scripts/framework/check.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
function scripted(answers) {
  let cursor = 0;
  return { ask: async prompt => { assert.ok(cursor < answers.length, `Missing answer: ${prompt}`); return answers[cursor++]; },
    write: () => {}, done: () => assert.equal(cursor, answers.length) };
}
async function contents(root, path = '') {
  const found = [];
  for (const entry of await readdir(join(root, path), { withFileTypes: true })) {
    const name = path ? path + '/' + entry.name : entry.name;
    if (entry.isDirectory()) found.push(...await contents(root, name));
    else found.push([name, (await readFile(join(root, name))).toString('base64')]);
  }
  return found.sort(([a], [b]) => a.localeCompare(b));
}
test('complete interactive and agent sessions produce byte-identical sketch and prototype packages', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-parity-'));
  try {
    const human = join(root, 'human'), agent = join(root, 'agent');
    await mkdir(human); await mkdir(agent);
    const ui = scripted(['Issue desk', 'new', 'Issues', 'bulk', 'Card; Filters', 'back', 'new', 'Details', 'back', 'save', 'y', 'exit']);
    await studio(ui, { root: human, frameworkRoot, project: 'design/project.json' }); ui.done();
    const request = { schemaVersion: 1, title: 'Issue desk', operations: [
      { op: 'page.add', title: 'Issues', as: 'issues' },
      { op: 'page.attach', page: '@issues', components: [{ title: 'Card' }, { title: 'Filters' }] },
      { op: 'page.add', title: 'Details' },
    ] };
    const context = { root: agent, frameworkRoot, input: Readable.from([JSON.stringify(request)]) };
    const args = parseArguments(['sketch', '--input', '-', '--json']);
    const preview = await execute(args, context);
    await execute({ ...args, flags: { ...args.flags, apply: preview.planHash } }, { ...context, input: Readable.from([JSON.stringify(request)]) });
    assert.equal(await readFile(join(human, 'design/project.json'), 'utf8'), await readFile(join(agent, 'design/project.json'), 'utf8'));
    const guide = await loadGuide();
    const answers = guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => field.kind === 'confirm' ? 'y' : '');
    const wizard = scripted([...answers, 'prepared', 'y']);
    await prototypeWizard(wizard, { root: human, frameworkRoot, project: 'design/project.json' }); wizard.done();
    const answerText = await readFile(join(human, 'prepared/prototype-answers.json'), 'utf8');
    const proto = parseArguments(['prototype', '--input', '-', '--out', 'prepared', '--json']);
    const planned = await execute(proto, { ...context, input: Readable.from([answerText]) });
    await execute({ ...proto, flags: { ...proto.flags, apply: planned.planHash } }, { ...context, input: Readable.from([answerText]) });
    assert.deepEqual(await contents(join(human, 'prepared')), await contents(join(agent, 'prepared')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('full and fast daily gates include maker types and tests when the CLI is present', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-gates-'));
  try {
    await mkdir(join(root, 'bin'));
    await writeFile(join(root, 'bin/shell.ts'), 'export {};');
    await writeFile(join(root, 'tsconfig.maker.json'), '{}');
    const full = await checkSteps(root, false), fast = await checkSteps(root, true, async () => null);
    for (const plan of [full, fast]) {
      assert.ok(plan.steps.some(step => step.id === 'maker-types'));
      assert.ok(plan.steps.some(step => step.id === 'maker-tests'));
    }
    assert.deepEqual(full.steps.find(step => step.id === 'eslint').args, ['src', 'bin', '--max-warnings', '0']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
