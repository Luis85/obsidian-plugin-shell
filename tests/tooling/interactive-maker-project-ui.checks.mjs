import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { projectWizard } from '../../bin/presentation/project-wizard.ts';
import { projectPlan } from '../../bin/adapters/projects.ts';
import { Back } from '../../bin/presentation/prompts.ts';
import { initialState } from '../../bin/presentation/tui/state.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(fn) { const root = await mkdtemp(join(await realpath(tmpdir()), 'project-ui-')); try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); } }
function richUI(options = {}) {
  const events = [], previews = [], contexts = [];
  let agreements = 0;
  const ui = {
    ask: async () => { throw new Error('Plain prompt in rich UI.'); }, write: value => events.push(['write', value]),
    rich: {
      context: value => contexts.push(value), busy: value => events.push(['busy', value]),
      select: async (label, items, initial) => {
        events.push(['select', label, items, initial]);
        if (label === 'What kind of project are you creating?') return options.preset ?? 'plugin-vanilla';
        if (label === 'Choose a frontend framework') return options.framework ?? 'vanilla';
        if (label.startsWith('Do you agree')) { agreements++; return options.agree === false ? 'no' : 'yes'; }
        if (label === 'Apply this reviewed plan?') return options.apply === false ? 'no' : 'yes';
        return initial || items[0].id;
      },
      multi: async (label, items, selected) => { events.push(['multi', label, selected]); return options.targets ?? ['plugin', 'webapp']; },
      text: async value => { events.push(['text', value.title]); if (value.title === 'Prototype title') return options.title ?? 'Human project'; if (value.title === 'Project package output folder') return 'prepared'; return value.initial; },
      review: async (label, sections) => { events.push(['review', label]); previews.push({ label, sections }); },
    },
  };
  return { ui, events, contexts, previews, agreements: () => agreements };
}
test('human rich flow orders preset, framework and prototype; applies the identical agent request', async () => scratch(async root => {
  const human = richUI();
  const completed = await projectWizard(human.ui, { root, frameworkRoot });
  assert.match(completed, /framework: vanilla/);
  const selectionIndex = human.events.findIndex(event => event[1] === 'What kind of project are you creating?');
  const frameworkIndex = human.events.findIndex(event => event[1] === 'Choose a frontend framework');
  const interviewIndex = human.events.findIndex(event => event[1] === 'Prototype title');
  assert.ok(selectionIndex < frameworkIndex && frameworkIndex < interviewIndex);
  const review = human.previews.find(item => item.label === 'Review your prototype brief');
  assert.match(review.sections[0].body, /Plugin with vanilla Obsidian/);
  const request = JSON.parse(await readFile(join(root, 'prepared/project-request.json'), 'utf8'));
  const plan = await projectPlan({ root, frameworkRoot, out: 'prepared', input: request });
  assert.ok(plan.plan.changes.every(change => change.status === 'unchanged'));
  assert.equal(request.interview.answers.approved, true);
}));
test('CLI goes directly from preset to command prototype without asking for a frontend', async () => scratch(async root => {
  const f = richUI({ preset: 'cli', apply: false });
  await projectWizard(f.ui, { root, frameworkRoot });
  assert.ok(!f.events.some(event => event[1] === 'Choose a frontend framework'));
  assert.ok(f.events.some(event => String(event[1]).includes('no frontend framework')));
  await assert.rejects(() => readFile(join(root, 'prepared/project.config.json')));
  assert.ok(f.events.some(event => event[1] === 'Apply this reviewed plan?'));
}));
test('hybrid target selection is explicit, rejects a single target and retains selections on revisit', async () => scratch(async root => {
  const f = richUI({ preset: 'hybrid', framework: 'angular', apply: false });
  let calls = 0;
  f.ui.rich.multi = async () => ++calls === 1 ? ['plugin'] : ['cli', 'plugin'];
  await projectWizard(f.ui, { root, frameworkRoot });
  assert.equal(calls, 2);
  assert.ok(f.events.some(event => String(event[1]).includes('at least two')));
  const brief = f.previews.find(item => item.label === 'Review your prototype brief').sections[0].body;
  assert.match(brief, /Frontend: Angular/); assert.match(brief, /Targets: plugin, cli/);
  const state = initialState({ kind: 'multi', title: 'Targets', items: [{ id: 'plugin', label: 'Plugin' }, { id: 'cli', label: 'CLI' }], selected: ['cli', 'unknown', 'cli'] });
  assert.deepEqual(state.checked, ['cli']);
}));
test('Back reopens selection; changed frameworks discard prior agreement and require a fresh review', async () => scratch(async root => {
  const f = richUI({ apply: false });
  let frameworkCalls = 0, outputCalls = 0, titleCalls = 0;
  const select = f.ui.rich.select, text = f.ui.rich.text;
  f.ui.rich.select = async (...args) => args[0] === 'Choose a frontend framework' ? (++frameworkCalls === 1 ? 'vanilla' : 'angular') : select(...args);
  f.ui.rich.text = async value => {
    if (value.title === 'Project package output folder' && ++outputCalls === 1) throw new Back();
    if (value.title === 'Prototype title' && ++titleCalls === 2) throw new Back();
    return text(value);
  };
  await projectWizard(f.ui, { root, frameworkRoot });
  assert.equal(frameworkCalls, 2); assert.equal(f.agreements(), 2);
  assert.match(f.previews.filter(item => item.label === 'Review your prototype brief').at(-1).sections[0].body, /Frontend: Angular/);
  await assert.rejects(() => readFile(join(root, 'prepared/project.config.json')));
}));
test('plain mode follows the same catalog and guide with default-No file approval', async () => scratch(async root => {
  const transcript = []; let choices = 0;
  const ui = { write: value => transcript.push(value), ask: async prompt => {
    if (prompt.startsWith('Choose number or ID')) return ++choices === 1 ? 'cli' : '';
    if (prompt.startsWith('Prototype title')) return 'Plain CLI';
    if (prompt.startsWith('Do you agree')) return 'y';
    if (prompt.startsWith('Project package output folder')) return 'prepared';
    return '';
  } };
  assert.equal(await projectWizard(ui, { root, frameworkRoot }), undefined);
  assert.ok(transcript.some(value => value.includes('No project files written')));
  assert.ok(transcript.some(value => value.includes('Frontend: No frontend')));
  await assert.rejects(() => readFile(join(root, 'prepared/project.config.json')));
}));
test('cancellation at entry, an aborted signal and unknown defaults never create files', async () => scratch(async root => {
  const f = richUI(); f.ui.rich.select = async () => { throw new Back(); };
  await assert.rejects(() => projectWizard(f.ui, { root, frameworkRoot }), Back);
  await assert.rejects(() => projectWizard(f.ui, { root, frameworkRoot, signal: AbortSignal.abort() }), /cancelled/);
  await assert.rejects(() => projectWizard(f.ui, { root, frameworkRoot, preset: 'unknown' }), /Choose a preset/);
  await assert.rejects(() => projectWizard(f.ui, { root, frameworkRoot, framework: 'react' }), /supported/);
}));
