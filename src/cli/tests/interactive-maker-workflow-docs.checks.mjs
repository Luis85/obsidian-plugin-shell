import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { testWorkflowCommand } from '../adapters/test-workflow-command.ts';
import { testWorkflowNote, testWorkflowOrphans } from '../adapters/test-workflow-docs-plan.ts';
import { readTestWorkflow, testWorkflowJson } from '../domain/test-workflow.ts';
import { describeTestWorkflowStep, renderTestWorkflowDocs, testWorkflowFrontmatter } from '../domain/test-workflow-docs.ts';
import { hash } from '../adapters/framework/files.ts';
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'workflow-docs-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const definition = (extra = {}) => ({ schemaVersion: 1, id: 'login', title: 'Log *in*', purpose: 'Members reach their dashboard.', status: 'active',
  target: { kind: 'static', folder: 'site' }, data: { values: { user: { email: 'm@example.com', pin: 1234 } } },
  steps: [
    { kind: 'goto', path: '/' }, { kind: 'fill', id: 'email', target: { label: 'Email' }, value: '{{data.user.email}}', note: 'Use the | pipe' },
    { kind: 'fill', target: { label: 'PIN' }, value: '{{data.user.pin}}' }, { kind: 'press', key: 'Enter' }, { kind: 'click', target: { role: 'button', name: 'Log in' } },
    { kind: 'expectUrl', path: '/dashboard' }, { kind: 'expectText', target: { role: 'heading' }, text: 'Hello', match: 'exact' },
  ], ...extra });
async function seed(root, value = definition()) {
  await mkdir(join(root, 'configs/tests/workflows'), { recursive: true }); await mkdir(join(root, 'site'), { recursive: true });
  await writeFile(join(root, 'configs/tests/workflows', value.id + '.json'), JSON.stringify(value));
  await writeFile(join(root, 'site/index.html'), '<!doctype html><title>Site</title>');
}
const run = (root, action, flags = {}) => testWorkflowCommand({ command: 'workflow', action, flags }, { root, frameworkRoot: root });
const applied = async (root, action, flags = {}) => run(root, action, { ...flags, apply: (await run(root, action, flags)).planHash });
const notePath = root => join(root, 'docs/tests/workflows/login.md');

test('every step kind reads as one plain sentence, and the note body lists steps, assertions, data and the run', () => {
  const steps = [['goto', { path: '/a' }, 'Visit /a'], ['click', { target: { text: 'Go' } }, 'Click text "Go"'], ['select', { target: { label: 'Size' }, value: 'M' }, 'Select "M" in field labelled "Size"'],
    ['check', { target: { label: 'A' } }, 'Check field labelled "A"'], ['uncheck', { target: { label: 'A' } }, 'Uncheck field labelled "A"'], ['press', { key: 'Tab', target: { label: 'A' } }, 'Press Tab in field labelled "A"'],
    ['waitFor', { target: { role: 'dialog' } }, 'Wait until dialog is visible'], ['expectVisible', { target: { role: 'dialog' } }, 'Expect dialog to be visible'],
    ['expectHidden', { target: { role: 'dialog' } }, 'Expect dialog to be hidden'], ['expectText', { target: { role: 'heading' }, text: 'Hi' }, 'Expect heading to contain text "Hi"'],
    ['expectUrl', { path: '/b', match: 'contains' }, 'Expect the URL to contain /b'], ['expectTitle', { text: 'T', match: 'contains' }, 'Expect the page title to contain "T"'],
    ['expectTitle', { text: 'T' }, 'Expect the page title to be "T"'], ['expectCount', { target: { role: 'row' }, count: 2 }, 'Expect 2 × row'], ['expectValue', { target: { label: 'A' }, value: 'v' }, 'Expect field labelled "A" to have value "v"'],
    ['screenshot', { name: 'full', fullPage: true, mask: [{ testId: 'clock' }], caption: 'All of it' }, 'Screenshot "full" (full page), masking 1 element: All of it'],
    ['screenshot', { name: 'part', target: { role: 'main' }, mask: [{ text: 'a' }, { text: 'b' }] }, 'Screenshot "part" of main, masking 2 elements'], ['screenshot', { name: 'view' }, 'Screenshot "view" (viewport)']];
  for (const [kind, fields, text] of steps) assert.equal(describeTestWorkflowStep({ kind, ...fields }), text);
  const value = readTestWorkflow(definition());
  const body = renderTestWorkflowDocs(value, [{ reference: '{{data.user.email}}', source: 'inline value', value: 'm@example.com' }], { result: 'failed', at: '2026-10-01T10:00:00.000Z', summary: '3/7 steps passed.', definition: 'x' });
  for (const expected of ['# Log \\*in\\*', '> Test workflow `login` · active · viewport 1280×800 · step timeout 5000 ms', '`static site`: A project folder with index.html',
    '1. Visit /', '2. Fill field labelled "Email" with "{{data.user.email}}" (id `email`) — Use the \\| pipe', '4. Press Enter', '5. Click button "Log in"',
    '## Assertions', '- Step 6: Expect the URL to be /dashboard', '- Step 7: Expect heading to have text "Hello"', '| `{{data.user.email}}` | inline value | m@example.com |',
    'Failed at 2026-10-01T10:00:00.000Z: 3/7 steps passed.', 'Generated from `configs/tests/workflows/login.json` by `node bin/app workflow docs --name login`.'])
    assert.ok(body.includes(expected), expected);
  const shots = renderTestWorkflowDocs(readTestWorkflow(definition({ steps: [...definition().steps, { kind: 'screenshot', name: 'dashboard', fullPage: true }] })), [],
    { result: 'passed', at: '2026-10-01T10:00:00.000Z', summary: '8/8 steps passed.', definition: 'x', screenshots: ['reports/workflows/login/run-1/screenshots/dashboard.png'] });
  for (const expected of ['## Screenshots', 'Captured for human review in each run report; never compared with a baseline.', '- Step 8: Screenshot "dashboard" (full page)',
    'Screenshots of that run (local report files, not committed):', '- `reports/workflows/login/run-1/screenshots/dashboard.png`'])
    assert.ok(shots.includes(expected), expected);
  assert.ok(!body.includes('## Screenshots'), 'no screenshot section without screenshot steps');
  const bare = renderTestWorkflowDocs(readTestWorkflow(definition({ data: undefined, steps: [{ kind: 'goto', path: '/' }] })), []);
  assert.ok(bare.includes('No assertions: this workflow only checks') && bare.includes('No test data: every value') && bare.includes('No run recorded for this version'));
  assert.deepEqual(testWorkflowFrontmatter(value), { type: 'TestWorkflow', id: 'login', title: 'Log *in*', target: 'static site', status: 'active' });
  assert.deepEqual(testWorkflowOrphans(['login.md', 'old.md', 'README.md', 'notes.txt'], new Set(['login'])), ['docs/tests/workflows/old.md']);
});

test('workflow docs creates a note with frontmatter, keeps hand-written text and refuses edited or unmarked notes', async () => scratch(async root => {
  await seed(root);
  assert.equal((await run(root, 'check')).workflows[0].issues[0].code, 'WORKFLOW_DOC_MISSING');
  assert.equal((await applied(root, 'docs', { name: 'login' })).status, 'applied');
  const first = await readFile(notePath(root), 'utf8');
  assert.match(first, /^---\ntype: "TestWorkflow"\nid: "login"\ntitle: "Log \*in\*"\ntarget: "static site"\nstatus: "active"\n---\n<!-- workflow:generated:start sha256=[0-9a-f]{64} -->\n# Log/);
  assert.ok(first.includes('| `{{data.user.pin}}` | inline value | 1234 |') && first.endsWith('<!-- workflow:generated:end -->\n\n## Notes\n\nHand-written notes outside the generated block are kept when this note is regenerated.\n'));
  assert.equal((await run(root, 'check')).status, 'ok');
  const authored = first.replace('---\n<!-- workflow', '---\nWritten above the block.\n<!-- workflow') + 'More notes by hand.\n';
  await writeFile(notePath(root), authored);
  await writeFile(join(root, 'configs/tests/workflows/login.json'), JSON.stringify(definition({ title: 'Log in' })));
  assert.equal((await run(root, 'check')).workflows[0].issues[0].code, 'WORKFLOW_DOC_STALE');
  assert.equal((await applied(root, 'docs')).status, 'applied');
  const second = await readFile(notePath(root), 'utf8');
  assert.ok(second.includes('title: "Log in"\n') && second.includes('---\nWritten above the block.\n<!-- workflow') && second.endsWith('regenerated.\nMore notes by hand.\n'));
  assert.equal((await run(root, 'docs')).changes[0].status, 'unchanged');
  await writeFile(notePath(root), second.replace('1. Visit /', '1. Visit the home page'));
  await assert.rejects(() => run(root, 'docs'), error => error.code === 'WORKFLOW_DOCS_EDITED' && /run workflow docs again/.test(error.message));
  assert.equal((await run(root, 'check')).workflows[0].issues[0].code, 'WORKFLOW_DOCS_EDITED');
  await writeFile(notePath(root), second.replace('status: "active"', 'status: "retired"'));
  await assert.rejects(() => run(root, 'docs'), /edited by hand/, 'the hash covers the frontmatter too');
  await writeFile(notePath(root), second.replace(/^---\n[\s\S]*?\n---\n/, ''));
  await assert.rejects(() => run(root, 'docs'), /edited by hand/, 'a note without its frontmatter no longer matches');
  await writeFile(notePath(root), '# My own page\n');
  await assert.rejects(() => run(root, 'docs'), error => error.code === 'WORKFLOW_DOCS_MARKERS');
  assert.equal(await readFile(notePath(root), 'utf8'), '# My own page\n');
  await writeFile(join(root, 'docs/tests/workflows/retired.md'), '# Gone\n');
  const check = await run(root, 'check');
  assert.deepEqual(check.orphans.map(item => [item.code, item.path]), [['WORKFLOW_DOC_ORPHAN', 'docs/tests/workflows/retired.md']]);
  assert.equal(check.status, 'failed');
}));

test('a recorded run is carried forward only while the definition is unchanged', async () => scratch(async root => {
  await seed(root);
  const value = readTestWorkflow(definition()), digest = hash(testWorkflowJson(value));
  const recorded = await testWorkflowNote(root, value, [], { result: 'passed', at: '2026-10-02T08:00:00.000Z', summary: '7/7 steps passed.', definition: digest });
  await mkdir(join(root, 'docs/tests/workflows'), { recursive: true }); await writeFile(join(root, recorded.path), recorded.content);
  assert.ok(recorded.content.includes('lastRun: "passed"\nlastRunAt: "2026-10-02T08:00:00.000Z"\nlastRunSummary: "7/7 steps passed."\nlastRunDefinition: "' + digest + '"'));
  const again = await testWorkflowNote(root, value, []);
  assert.equal(again.state, 'current');
  assert.deepEqual(again.run, { result: 'passed', at: '2026-10-02T08:00:00.000Z', summary: '7/7 steps passed.', definition: digest });
  const changed = await testWorkflowNote(root, readTestWorkflow(definition({ status: 'draft' })), []);
  assert.equal(changed.state, 'stale');
  assert.equal(changed.run, undefined);
  assert.ok(!changed.content.includes('lastRun') && changed.content.includes('No run recorded for this version'));
}));
