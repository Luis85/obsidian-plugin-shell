import assert from 'node:assert/strict';
import { realpath, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { terminalFixture } from './interactive-maker-tui-fixture.mjs';
import { studio } from '../../src/cli/presentation/studio.ts';
import { interview } from '../../src/cli/presentation/guide.ts';
import { loadGuide } from '../../src/cli/adapters/prototype.ts';
import { resolveAnswers, readGuide } from '../../src/cli/domain/guide.ts';
import { newDocument, documentText } from '../../src/cli/domain/document.ts';
import { runOperations } from '../../src/cli/application/operations.ts';
import { review } from '../../src/cli/presentation/review.ts';
import { savePlan } from '../../src/cli/adapters/storage.ts';
import { Back } from '../../src/cli/presentation/prompts.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(run) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-tui-'));
  try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function respond(f, current, keys, next) {
  await f.until(current); const from = f.chunks.length; f.send(keys);
  if (next) await f.until(next, from);
}
test('full keyboard workspace produces the exact agent-authored Companion document', async () => scratch(async root => {
  const f = terminalFixture(); f.session.start();
  try {
    const task = studio(f.ui, { root, frameworkRoot, project: 'design/project.json' });
    await respond(f, 'Project title', 'Issue desk\r', 'What would you like');
    await respond(f, 'What would you like', '\r', 'Page title');
    await respond(f, 'Page title', 'Issues\r', 'Sketch this page');
    await respond(f, 'Sketch this page', '/bulk\r', 'Bulk-create components');
    await respond(f, 'Bulk-create components', '\x1b[200~Card\nFilters\x1b[201~\r', 'Sketch this page');
    await respond(f, 'Sketch this page', '\x1b', 'What would you like');
    await respond(f, 'What would you like', '/save\r', 'Review before writing');
    assert.match(f.text(), /UNSAVED DRAFT/);
    await respond(f, 'Review before writing', '\r', 'Apply this reviewed plan?');
    await respond(f, 'Apply this reviewed plan?', '\x1b[B\r', 'What would you like');
    await respond(f, 'What would you like', '/exit\r'); await task;
    const expected = runOperations(newDocument('Issue desk'), [
      { op: 'page.add', title: 'Issues', as: 'issues' },
      { op: 'page.attach', page: '@issues', components: [{ title: 'Card' }, { title: 'Filters' }] },
    ]).document;
    assert.equal(await readFile(join(root, 'design/project.json'), 'utf8'), documentText(expected));
  } finally { f.close(); }
}));
test('real terminal prototype questions and JSON answers resolve identically without changing semicolon-containing defaults', async () => {
  const guide = await loadGuide(), f = terminalFixture(); f.session.start();
  try {
    const task = interview(f.ui, guide);
    const fields = guide.steps.flatMap(step => step.fields).filter(field => !field.when);
    for (const [i, field] of fields.entries()) {
      if (field.kind === 'confirm') {
        await respond(f, 'Review your prototype brief', '\r', field.label.slice(0, 40));
        f.send('\x1b[B\r');
      } else {
        await f.until(field.label.slice(0, 40));
        const from = f.chunks.length; f.send(field.id === 'title' ? 'Prototype\r' : '\r');
        await f.until(i + 1 === fields.length - 1 ? 'Review your prototype brief' : fields[i + 1].label.slice(0, 40), from);
      }
    }
    assert.deepEqual({ ...await task }, { ...resolveAnswers(guide, { title: 'Prototype', approved: true }).answers });
  } finally { f.close(); }
});
test('guide backtracking drops inactive branches and renews explicit agreement', async () => {
  const definition = await loadGuide();
  definition.steps = [{ title: 'Small guide', fields: [
    { id: 'title', label: 'Title', help: 'Title', kind: 'text', required: true, default: '' },
    { id: 'mode', label: 'Mode', help: 'Mode', kind: 'select', choices: ['new', 'existing'], default: 'new' },
    { id: 'baseline', label: 'Baseline', help: 'Revision', kind: 'text', default: '', required: true, when: { field: 'mode', equals: 'existing' } },
    { id: 'outcome', label: 'Outcome', help: 'Outcome', kind: 'text', default: 'Explore' },
    { id: 'approved', label: 'Agree?', help: 'Review', kind: 'confirm', default: false },
  ] }];
  definition.constraints = [{ field: 'approved', equals: true, message: 'Agree first.' }];
  const guide = readGuide(definition), f = terminalFixture(); f.session.start();
  try {
    const task = interview(f.ui, guide);
    await respond(f, 'Title', 'P\r', 'Mode');
    await respond(f, 'Mode', '\x1b[B\r', 'Baseline');
    await respond(f, 'Baseline', 'revision\r', 'Outcome');
    await respond(f, 'Outcome', '\x1b', 'Baseline');
    await respond(f, 'Baseline', '\x1b', 'Mode');
    await respond(f, 'Mode', '\x1b[A\r', 'Outcome');
    await respond(f, 'Outcome', '\r', 'Review your prototype brief');
    await respond(f, 'Review your prototype brief', '\r', 'Agree?'); f.send('\r');
    const result = await task;
    assert.equal(result.mode, 'new'); assert.equal(result.approved, false); assert.ok(!('baseline' in result));
    const cancelled = interview(f.ui, guide); f.send('\x1b'); await assert.rejects(cancelled, Back);
  } finally { f.close(); }
});
test('review shows every planned path and the prompt; Escape and default no cannot write', async () => scratch(async root => {
  const plan = await savePlan(root, 'design/project.json', newDocument('P'), null);
  const f = terminalFixture(); f.session.start();
  try {
    const detailed = { ...plan, data: { ...plan.data, prompt: 'Detailed execution prompt\n'.repeat(50) + 'LAST PROMPT LINE' } };
    const task = review(f.ui, detailed);
    f.send('\t\x1b[F'); assert.match(f.text(), /LAST PROMPT LINE/);
    f.send('\r'); await f.until('Apply this reviewed plan?'); f.send('\r'); assert.equal(await task, false);
    await assert.rejects(() => readFile(join(root, 'design/project.json')));
    const back = review(f.ui, detailed); f.send('\x1b'); await assert.rejects(back, Back);
    const applied = review(f.ui, detailed); f.send('\r'); await f.until('Apply this reviewed plan?');
    await new Promise(resolve => setImmediate(resolve)); f.send('\x1b[B\r'); assert.equal(await applied, true);
    const repeat = await savePlan(root, 'design/project.json', newDocument('P'), plan.plan.changes[0].afterHash);
    const unchanged = review(f.ui, repeat); f.send('\r'); await new Promise(resolve => setImmediate(resolve)); f.send('\x1b[B\r');
    assert.equal(await unchanged, true); assert.match(f.text(), /No changes needed/);
  } finally { f.close(); }
}));
