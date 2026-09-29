import assert from 'node:assert/strict';
import { realpath, mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable, Writable, PassThrough } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { projectWizard } from '../../bin/presentation/project-create.ts';
import { loadProjectCatalog, loadProjectGuide, projectCreatePlan } from '../../bin/adapters/project-create.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { main } from '../../bin/shell.ts';
import { Back } from '../../bin/presentation/prompts.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const catalog = await loadProjectCatalog(), guide = await loadProjectGuide();
async function scratch(run) { const root = await mkdtemp(join(await realpath(tmpdir()), 'presets-ui-')); try { await run(root); } finally { await rm(root, { recursive: true, force: true }); } }
async function contents(root, path = '') {
  const entries = [];
  for (const item of await readdir(join(root, path), { withFileTypes: true })) {
    const name = path ? path + '/' + item.name : item.name;
    if (item.isDirectory()) entries.push(...await contents(root, name));
    else entries.push([name, (await readFile(join(root, name))).toString('base64')]);
  }
  return entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}
function plain(lines) {
  let index = 0; const transcript = [];
  return { transcript, ask: async prompt => { assert.ok(index < lines.length, `Missing answer to ${prompt}`); return lines[index++]; },
    write: text => transcript.push(text), done: () => assert.equal(index, lines.length) };
}
const defaults = () => guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => field.id === 'title' ? 'Desk' : field.kind === 'confirm' ? 'y' : '');
function rich(preset = 'cli', frontend = 'none', apply = true, overrides = {}) {
  const calls = [], transcript = [];
  const adapter = {
    select: async (title, choices, initial) => {
      calls.push({ title, choices, initial });
      if (title.startsWith('1.')) return preset;
      if (title.startsWith('2.')) return frontend;
      if (title === 'Apply this reviewed plan?') return apply ? 'yes' : 'no';
      if (title.includes('agree to this complete brief')) return 'yes';
      return initial;
    },
    multi: async (_title, items) => { assert.equal(items.length, 4); return ['cli', 'plugin']; },
    text: async request => request.title === 'Prototype title' ? 'Desk' : request.title === 'Project package output folder' ? 'prepared' : request.initial,
    review: async (title, sections) => { calls.push({ title, sections }); },
    context: () => {}, busy: () => {}, ...overrides,
  };
  return { rich: adapter, calls, transcript, ask: async () => { throw new Error('Unexpected plain fallback'); }, write: text => transcript.push(text) };
}
test('plain project creation follows preset/frontend/interview and matches agent package bytes', async () => scratch(async root => {
  const human = join(root, 'human'), agent = join(root, 'agent'); await mkdir(human); await mkdir(agent);
  const ui = plain(['hybrid', '4,1', 'vanilla', ...defaults(), 'prepared', 'y']);
  await projectWizard(ui, { root: human, frameworkRoot }); ui.done();
  const text = await readFile(join(human, 'prepared/project-create.json'), 'utf8');
  const args = parseArguments(['new', '--input', '-', '--out', 'prepared']);
  const context = { root: agent, frameworkRoot, input: Readable.from([text]) };
  const plan = await execute(args, context);
  await execute({ ...args, flags: { ...args.flags, apply: plan.planHash } }, { ...context, input: Readable.from([text]) });
  assert.deepEqual(await contents(join(human, 'prepared')), await contents(join(agent, 'prepared')));
  const output = ui.transcript.join('');
  assert.ok(output.indexOf('1. Choose a project preset') < output.indexOf('2. Choose the frontend'));
  assert.ok(output.indexOf('2. Choose the frontend') < output.indexOf('Product and intended outcome'));
  assert.match(output, /# Implement Desk/);
}));
test('TUI skips inapplicable frontend selection, reviews full JSON and prompt, and equals agent output', async () => scratch(async root => {
  const human = join(root, 'human'), agent = join(root, 'agent'); await mkdir(human); await mkdir(agent);
  const ui = rich(); await projectWizard(ui, { root: human, frameworkRoot });
  assert.ok(!ui.calls.some(call => call.title.startsWith('2.')));
  const review = ui.calls.find(call => call.title === 'Review before writing');
  assert.ok(review.sections.some(section => section.title === 'Execution prompt'));
  assert.ok(review.sections.some(section => section.title === 'Companion JSON'));
  assert.equal(ui.calls.find(call => call.title === 'Apply this reviewed plan?').initial, 'no');
  const input = JSON.parse(await readFile(join(human, 'prepared/project-create.json'), 'utf8'));
  const plan = await projectCreatePlan({ root: agent, frameworkRoot, out: 'prepared', input, catalog, guide });
  await applyPrepared(plan, plan.planHash);
  assert.deepEqual(await contents(join(human, 'prepared')), await contents(join(agent, 'prepared')));
}));
test('hybrid target selection, Back and declined review never write prematurely', async () => scratch(async root => {
  const refused = rich('hybrid', 'vanilla', false);
  assert.equal(await projectWizard(refused, { root, frameworkRoot }), undefined);
  assert.deepEqual(await readdir(root), []);
  assert.ok(refused.calls.find(call => call.title.startsWith('2.')).choices.some(item => item.id === 'angular'));
  const original = refused.rich.select; let retried = false;
  refused.rich.select = async (...args) => { if (args[0].startsWith('2.') && !retried) { retried = true; throw new Back(); } return original(...args); };
  await projectWizard(refused, { root, frameworkRoot }); assert.equal(retried, true);
  const invalid = plain(['hybrid', '1', 'cli', ...defaults(), 'prepared', 'n']);
  await projectWizard(invalid, { root, frameworkRoot }); invalid.done();
  assert.match(invalid.transcript.join(''), /at least two distinct runtimes/);
  const cancelled = rich('cli', 'none', false, { select: async () => { throw new Back(); } });
  await assert.rejects(() => projectWizard(cancelled, { root, frameworkRoot }), Back);
  assert.deepEqual(await readdir(root), []);
}));
test('returning from prototype to preset and unresolved agreement preserve cancellation and retry behavior', async () => scratch(async root => {
  const ui = rich('cli', 'none', false); const read = ui.rich.text;
  let back = false;
  ui.rich.text = async request => { if (request.title === 'Prototype title' && !back) { back = true; throw new Back(); } return read(request); };
  await projectWizard(ui, { root, frameworkRoot });
  assert.equal(ui.calls.filter(call => call.title.startsWith('1.')).length, 2);
  const refusal = plain(['cli', ...defaults().slice(0, -1), 'n', 'prepared', 'cli', ...defaults(), 'prepared', 'n']);
  await projectWizard(refusal, { root, frameworkRoot }); refusal.done();
  assert.match(refusal.transcript.join(''), /PROTOTYPE_AGREEMENT/);
  const stopped = rich('hybrid', 'vanilla', false, { multi: async () => { const error = new Error('Cancelled'); error.code = 'CANCELLED'; throw error; } });
  await assert.rejects(() => projectWizard(stopped, { root, frameworkRoot }), /Cancelled/);
  assert.deepEqual(await readdir(root), []);
}));
test('agent discovery, validation and failures use one JSON response without opening the terminal', async () => scratch(async root => {
  const stdout = [], stderr = [];
  const io = text => ({ input: Readable.from([text]), output: new Writable({ write(chunk, _encoding, done) { stdout.push(String(chunk)); done(); } }),
    error: new Writable({ write(chunk, _encoding, done) { stderr.push(String(chunk)); done(); } }), env: { CI: '1' } });
  for (const action of ['presets', 'guide']) {
    stdout.length = 0;
    assert.equal(await main(['new', action, '--json', '--root', root], frameworkRoot, io('')), 0);
    const data = JSON.parse(stdout.join('')).data;
    if (action === 'guide') { assert.equal(data.input.prototypeRequest.answers.approved, false); assert.equal(data.input.frontend, 'nuxt-ui'); }
    else assert.deepEqual(data.stages, ['preset', 'frontend', 'prototype', 'review', 'apply']);
  }
  const input = { schemaVersion: 1, catalogVersion: catalog.version, preset: 'cli', prototypeRequest: {
    schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: { title: 'Desk', approved: false } } };
  stdout.length = 0;
  assert.equal(await main(['new', 'validate', '--input', '-', '--json', '--root', root], frameworkRoot, io(JSON.stringify(input))), 0);
  assert.equal(JSON.parse(stdout.join('')).data.ready, false);
  for (const args of [['new', 'unexpected'], ['new', '--kind', 'clickdummy'], ['new', '--input', '-']]) {
    stdout.length = 0;
    assert.equal(await main([...args, '--json', '--root', root], frameworkRoot, io('{"prototype":{}}')), 1);
    assert.equal(JSON.parse(stdout.join('')).status, 'failed');
  }
  assert.deepEqual(stderr, []); assert.deepEqual(await readdir(root), []);
}));
test('interactive new and the empty default workspace start at presets and restore cancellation', async () => scratch(async root => {
  for (const command of ['new', 'studio']) {
    const input = new PassThrough(); input.isTTY = true; let answered = false; const stdout = [];
    const error = new Writable({ write(chunk, _encoding, done) {
      if (String(chunk).includes('Choose number or ID') && !answered) { answered = true; queueMicrotask(() => input.write(':back\n')); }
      done();
    } }); error.isTTY = true;
    const code = await main([command, '--ui', 'plain', '--root', root], frameworkRoot, { input,
      output: new Writable({ write(chunk, _encoding, done) { stdout.push(String(chunk)); done(); } }), error, env: {} });
    assert.equal(code, 130); assert.equal(answered, true); assert.deepEqual(stdout, []); input.destroy();
  }
}));
