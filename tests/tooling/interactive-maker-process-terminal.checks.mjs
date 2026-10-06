import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { launchProcess } from '../../src/cli/presentation/wizards/process-launch.ts';
import { Back } from '../../src/cli/presentation/prompts.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const BACK = Symbol('back');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'process-terminal-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
/** Terminal-UI prompts answer by title (undefined keeps the initial value); validators run like the real session. */
function rich(answers) {
  const asked = [], rejected = [], reviews = [], contexts = [];
  const next = title => {
    asked.push(title);
    const queue = answers[title];
    if (!queue?.length) throw Object.assign(new Error('Unexpected prompt: ' + title), { code: 'CANCELLED' });
    const value = queue.shift(); if (value === BACK) throw new Back(); return value;
  };
  return { asked, rejected, reviews, contexts, left: () => Object.entries(answers).filter(([, queue]) => queue.length).map(([title]) => title), ui: {
    write: () => {}, ask: async () => { throw new Error('plain prompt in terminal UI'); }, rich: {
      context: value => contexts.push(value), busy: () => {}, review: async (title, sections) => { reviews.push({ title, sections }); },
      select: async (title, items, initial) => { const value = next(title) ?? initial; assert.ok(items.some(item => item.id === value), `${title}: ${value}`); return value; },
      multi: async (title, _items, selected) => next(title) ?? selected,
      text: async request => {
        while (true) { const value = next(request.title) ?? request.initial; const error = request.validate?.(value); if (!error) return value; rejected.push([request.title, error]); }
      },
    } } };
}
const definition = () => ({ schemaVersion: 1, id: 'purchase', version: 3, title: 'Purchase', purpose: 'Buy approved items.', status: 'active', owner: 'buyer',
  roles: [{ id: 'requester', title: 'Requester' }, { id: 'buyer', title: 'Buyer' }],
  steps: [
    { id: 'request', title: 'Request items', actor: 'requester', bind: 'order', doc: { file: 'request.md', text: 'Old note.' }, fields: [
      { id: 'items', kind: 'list', label: 'Items', required: true, help: 'One per line.' },
      { id: 'urgency', kind: 'select', label: 'Urgency', choices: ['low', 'high'], default: 'low' },
      { id: 'extra', kind: 'section', label: 'Extra', fields: [{ id: 'memo', kind: 'text', label: 'Memo' }] },
    ], next: [{ to: 'buy' }] },
    { id: 'buy', title: 'Buy', actor: 'buyer', outputs: ['invoice.total'], next: [{ to: 'done', when: { path: 'invoice.total', lte: 1000 } }, { to: 'escalate' }] },
    { id: 'escalate', title: 'Escalate', actor: 'buyer', terminal: true, outcome: 'escalated' },
    { id: 'done', title: 'Done', actor: 'buyer', terminal: true, outcome: 'bought' },
  ],
  rules: [{ id: 'has-items', statement: 'An order lists at least one item.', severity: 'block', steps: ['request'], require: { path: 'order.items', length: true, gte: 1 } }] });
async function seed(root) {
  await mkdir(join(root, 'configs/processes/docs'), { recursive: true });
  await writeFile(join(root, 'configs/processes/purchase.json'), JSON.stringify(definition()));
  await writeFile(join(root, 'configs/processes/docs/request.md'), 'Request notes.\n');
}
const options = root => ({ root, frameworkRoot });

test('terminal-UI editing: Back leaves an item form, removal needs a yes, forms replace inline fields and JSON-only details survive', async () => scratch(async root => {
  await seed(root);
  const f = rich({
    'What do you want to do with business processes?': ['edit'], 'Which process do you want to edit?': ['purchase'],
    'Process title': [undefined], 'Purpose: why does this process exist?': [undefined], Status: [undefined], Version: [undefined], 'Overview notes in Markdown (optional)': [undefined],
    'Roles (2)': ['add', 'add', undefined], 'Roles (3)': ['remove'], 'Role title': [BACK, 'Auditor'], 'Responsibilities (optional)': [undefined],
    'Which role do you want to remove?': ['auditor'], 'Remove role auditor?': ['yes'], 'Which role owns the process?': [undefined],
    'Steps (the first step starts the process) (4)': ['edit-0', 'edit-1', 'done'], 'Step title': [undefined, undefined], 'Who performs this step?': [undefined, undefined],
    'What happens in this step (optional)': [undefined, 'Order through the catalog.'], 'Input collected in this step': [undefined, 'form'], Form: ['project-identity'],
    'Input fields (id:kind:Label)': ['items:list:Things\nurgency:select=low/high/critical:Urgency\nextra:section:More'],
    'Store the answers under (dotted path, empty for the top level)': [undefined, 'vendor'], 'Data produced outside the form (dotted paths, optional)': [undefined, undefined],
    'Does the process end at this step?': [undefined, undefined], 'Next steps, first match wins': [undefined, undefined], 'Step notes in Markdown (optional)': ['', undefined],
    'Business rules (1)': ['edit-0', 'done'], 'Rule statement in plain language': [undefined], Severity: ['warn'], 'Why the rule exists (optional)': [undefined],
    'Where is the rule checked?': [undefined], Steps: [undefined], 'Applies only when (all must hold; empty for always)': ['order.urgency equals "high"'],
    'The requirement holds when': [undefined], 'Requirement conditions (path operator value)': [undefined], 'Rule notes in Markdown (optional)': [undefined],
    'Apply this reviewed plan?': ['yes'],
  });
  assert.match(await launchProcess(f.ui, { command: 'process', action: '', flags: {} }, options(root)), /^Process purchase saved to configs\/processes\/purchase\.json/);
  const value = JSON.parse(await readFile(join(root, 'configs/processes/purchase.json'), 'utf8')), original = definition();
  assert.deepEqual([value.version, value.roles, value.steps.length], [4, original.roles, 4]);
  assert.deepEqual(value.steps[0].fields, [{ id: 'items', kind: 'list', label: 'Things', help: 'One per line.' }, { id: 'urgency', kind: 'select', label: 'Urgency', choices: ['low', 'high', 'critical'].map(id => ({ id, label: id })), default: 'low' },
    { ...original.steps[0].fields[2], label: 'More' }], 'choices are stored in the canonical form-engine shape');
  assert.deepEqual(value.steps[0].doc, { file: 'request.md' }, 'clearing the note text keeps the linked file');
  assert.deepEqual(value.steps[1], { id: 'buy', title: 'Buy', actor: 'buyer', description: 'Order through the catalog.', form: 'project-identity', bind: 'vendor', outputs: ['invoice.total'], next: original.steps[1].next });
  assert.deepEqual(value.rules[0], { ...original.rules[0], severity: 'warn', when: { path: 'order.urgency', equals: 'high' } });
  assert.ok(f.contexts.some(item => item.title === 'Business process Purchase' && item.location === 'Steps'));
  assert.deepEqual(f.reviews.map(item => item.title), ['Review before writing']);
  assert.deepEqual(f.left(), []);
}));

test('terminal-UI run: a form step, a declared output and a terminal outcome, with the trail reviewed but not saved', async () => scratch(async root => {
  await seed(root);
  const configured = definition();
  configured.steps[1] = { ...configured.steps[1], form: 'project-identity', bind: 'vendor' };
  await writeFile(join(root, 'configs/processes/purchase.json'), JSON.stringify(configured));
  const f = rich({
    'Which process do you want to run?': ['purchase'], Items: ['', 'Paper; Toner'], Urgency: ['high'], Memo: [undefined], 'Project name': ['Acme'],
    'Describe your project': ['Office supplies'], 'Describe the product and desired outcome': ['Stocked office'],
    'Value of invoice.total (JSON or text)': ['1200'], 'Mark "Escalate" as done?': ['yes'], 'Save the audit trail as JSON?': [undefined],
  });
  assert.equal(await launchProcess(f.ui, { command: 'process', action: 'run', flags: {} }, options(root)), 'Purchase completed: escalated.\n');
  assert.deepEqual(f.rejected, [['Items', 'Items needs at least one item.']]);
  const trail = JSON.parse(f.reviews[0].sections[0].body);
  assert.deepEqual([trail.status, trail.outcome, trail.data.order.items, trail.data.vendor.name, trail.data.invoice.total], ['completed', 'escalated', ['Paper', 'Toner'], 'Acme', 1200]);
  assert.deepEqual(trail.trail.map(item => item.transition?.to ?? 'end'), ['buy', 'escalate', 'end']);
}));
