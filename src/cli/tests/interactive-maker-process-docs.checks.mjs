import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { processCommand } from '../adapters/process-command.ts';
import { processCatalogContext, processEntry } from '../adapters/process-catalog.ts';
import { processDocsPlan } from '../adapters/process-docs-plan.ts';
import { applyPrepared } from '../adapters/storage.ts';
import { processWikilinks, renderProcessDocs } from '../domain/process-docs.ts';
import { readProcess } from '../domain/process.ts';
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'process-docs-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const definition = (extra = {}) => ({ schemaVersion: 1, id: 'intake', version: 1, title: 'Feature intake', purpose: 'Triage | route requests.', status: 'active', owner: 'triager',
  roles: [{ id: 'requester', title: 'Requester' }, { id: 'triager', title: 'Triager', description: 'Owns the queue.' }],
  steps: [
    { id: 'submit', title: 'Submit "request"', actor: 'requester', bind: 'request', fields: [{ id: 'summary', kind: 'text', label: 'Summary', required: true }, { id: 'impact', kind: 'number', label: 'Impact' }],
      next: [{ to: 'accept', when: { path: 'request.impact', gte: 3 } }, { to: 'decline' }], doc: { text: 'Use the [[docs/guide|guide]] and [[docs/guide#scope]].' } },
    { id: 'accept', title: 'Accept', actor: 'triager', form: 'project-identity', terminal: true, outcome: 'accepted' },
    { id: 'decline', title: 'Decline', actor: 'triager', terminal: true },
  ],
  rules: [
    { id: 'summarized', statement: 'Requests have a summary.', severity: 'block', steps: ['submit'], require: { path: 'request.summary', length: true, gte: 3 }, doc: { file: 'rules/summary.md' } },
    { id: 'impact-known', statement: 'Impact is estimated.', rationale: 'Ranking.', severity: 'warn', when: { path: 'request.summary', present: true }, require: { path: 'request.impact', present: true } },
    { id: 'noted', statement: 'Low impact is noted.', severity: 'info', steps: ['submit'], require: { not: { path: 'request.impact', lt: 1 } } },
  ],
  doc: { file: 'intake.md' }, ...extra });
async function project(root, value = definition()) {
  await mkdir(join(root, 'configs/processes/docs/rules'), { recursive: true }); await mkdir(join(root, 'docs'), { recursive: true });
  await writeFile(join(root, 'configs/processes', value.id + '.json'), JSON.stringify(value));
  await writeFile(join(root, 'configs/processes/docs/intake.md'), 'Intake notes. See [[README]].\n');
  await writeFile(join(root, 'configs/processes/docs/rules/summary.md'), 'Short summaries are fine.\n');
  await writeFile(join(root, 'docs/guide.md'), '# Guide\n'); await writeFile(join(root, 'README.md'), '# Readme\n');
}
const run = (root, action, flags = {}) => processCommand({ command: 'process', action, flags }, { root });

test('generated documentation covers overview, roles, steps, Mermaid flow, rules by severity, step details and links', () => {
  const value = readProcess(definition());
  assert.deepEqual(processWikilinks('[[a]] [[b/c.json|x]] [[d#h|y]]'), ['a.md', 'b/c.json', 'd.md']);
  const text = renderProcessDocs(value, { files: new Map([['intake.md', 'Intake [[README]].'], ['rules/summary.md', 'Rule note.']]), link: target => '../' + target,
    fields: step => step.form ? [{ id: 'name', kind: 'title', label: 'Project name' }] : step.fields ?? [] });
  for (const expected of ['# Feature intake', '> Business process `intake` · version 1 · active · owner: Triager', 'Triage | route requests.', 'Intake [README](../README.md).',
    '| Triager | `triager` | Owns the queue. | Accept; Decline |', '| 1 | Submit "request" (`submit`) | Requester | Summary; Impact | — | `accept` if `request.impact gte 3`; `decline` |',
    '| 2 | Accept (`accept`) | Triager | form `project-identity` | — | ends (accepted) |', '| 3 | Decline (`decline`) | Triager | confirmation | — | ends |',
    '```mermaid', '  step_submit["Submit #quot;request#quot;"]', '  step_accept(["Accept"])', '  step_submit -->|"request.impact gte 3"| step_accept', '  step_submit --> step_decline',
    '### Block', '| `summarized` | Requests have a summary. | `submit` | require `request.summary length gte 3` | — |',
    '### Warn', '| `impact-known` | Impact is estimated. | whole process | when `request.summary present`, require `request.impact present` | Ranking. |',
    '### Info', 'require `not(request.impact lt 1)`', '### 1. Submit "request"', '- Summary (text, required)', 'Use the [guide](../docs/guide.md) and [docs/guide](../docs/guide.md#scope).',
    '- block `summarized`: Requests have a summary.', 'Rule note.', '- Source notes: `configs/processes/docs/intake.md`', '- [docs/guide.md](../docs/guide.md)',
    'Generated from `configs/processes/intake.json` by `node bin/app process docs --name intake`.'])
    assert.ok(text.includes(expected), expected);
  assert.equal(text.includes('\n\n\n'), false);
  const bare = renderProcessDocs(readProcess(definition({ rules: [], doc: undefined, steps: definition().steps.map(step => ({ ...step, doc: undefined })), references: { pages: ['node-1'], journeys: [] } })),
    { files: new Map(), link: target => target, fields: () => [] });
  assert.ok(bare.includes('No business rules.') && bare.includes('- pages: `node-1`') && !bare.includes('journeys') && !bare.includes('## Related documentation'));
});

test('process docs creates a page, keeps authored text on regeneration and refuses edited or unmarked pages', async () => scratch(async root => {
  await project(root);
  const planned = await run(root, 'docs', { name: 'intake' });
  assert.deepEqual([planned.status, planned.path, planned.changes[0].status], ['planned', 'docs/processes/intake.md', 'create']);
  await assert.rejects(() => readFile(join(root, 'docs/processes/intake.md')), /ENOENT/, 'planning writes nothing');
  assert.equal((await run(root, 'docs', { name: 'intake', apply: planned.planHash })).status, 'applied');
  const page = join(root, 'docs/processes/intake.md'), first = await readFile(page, 'utf8');
  assert.match(first, /^<!-- process:generated:start sha256=[0-9a-f]{64} -->\n# Feature intake\n/);
  assert.ok(first.endsWith('<!-- process:generated:end -->\n\n## Notes\n\nHand-written notes outside the generated block are kept when this page is regenerated.\n'));
  assert.ok(first.includes('[guide](../guide.md)') && first.includes('[README](../../README.md)'));
  assert.equal((await run(root, 'docs', { name: 'intake' })).changes[0].status, 'unchanged');
  const authored = `Preface written by hand.\n${first}More notes by hand.\n`;
  await writeFile(page, authored);
  await writeFile(join(root, 'configs/processes/intake.json'), JSON.stringify(definition({ title: 'Feature intake v2', version: 2 })));
  const again = await run(root, 'docs', { name: 'intake' });
  assert.equal(again.changes[0].status, 'update');
  await run(root, 'docs', { name: 'intake', apply: again.planHash });
  const second = await readFile(page, 'utf8');
  assert.ok(second.startsWith('Preface written by hand.\n<!-- process:generated:start') && second.endsWith('## Notes\n\nHand-written notes outside the generated block are kept when this page is regenerated.\nMore notes by hand.\n'));
  assert.ok(second.includes('# Feature intake v2\n') && !second.includes('# Feature intake\n'));
  await writeFile(page, second.replace('# Feature intake v2', '# Edited by hand'));
  await assert.rejects(() => run(root, 'docs', { name: 'intake' }), /PROCESS_DOCS_EDITED|edited by hand since it was generated/);
  await writeFile(page, '# My own page\n');
  await assert.rejects(() => run(root, 'docs', { name: 'intake' }), /no single generated block/);
  await writeFile(page, `${second}\n${second}`);
  await assert.rejects(() => run(root, 'docs', { name: 'intake' }), /no single generated block/);
  assert.equal(await readFile(page, 'utf8'), `${second}\n${second}`, 'refusals write nothing');
  for (const out of ['../outside', 'configs/processes', '/abs']) await assert.rejects(() => run(root, 'docs', { name: 'intake', out }), /project-relative folder/, out);
  const custom = await run(root, 'docs', { name: 'intake', out: 'handbook/' });
  assert.equal(custom.path, 'handbook/intake.md');
}));

test('a reviewed docs plan refuses to apply over a page that changed after planning', async () => scratch(async root => {
  await project(root);
  const context = await processCatalogContext(root), entry = await processEntry(root, 'intake', context);
  const plan = await processDocsPlan(entry.definition, context, entry.docs);
  await mkdir(join(root, 'docs/processes')); await writeFile(join(root, 'docs/processes/intake.md'), 'Written meanwhile.\n');
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /changed|stale|STALE|exists/i);
  assert.equal(await readFile(join(root, 'docs/processes/intake.md'), 'utf8'), 'Written meanwhile.\n');
}));

test('process check reports doc files, wikilinks, forms, references and file names per process', async () => scratch(async root => {
  await project(root);
  assert.deepEqual(await run(root, 'check'), { processes: [{ id: 'intake', issues: [], warnings: [] }], issues: 0, status: 'ok' });
  const broken = definition({ id: 'broken', references: { entities: ['task', 'ghost'], journeys: ['journey-1'], pages: ['node-9'] },
    steps: definition().steps.map(step => step.id === 'accept' ? { ...step, form: 'no-such-form' } : step.id === 'submit' ? { ...step, doc: { text: '[[docs/missing]] [[../etc/passwd]]', file: 'gone.md' } } : step) });
  await writeFile(join(root, 'configs/processes/broken.json'), JSON.stringify(broken));
  await writeFile(join(root, 'configs/processes/renamed.json'), JSON.stringify(definition()));
  await writeFile(join(root, 'configs/processes/invalid.json'), JSON.stringify({ ...definition(), run: 'rm -rf /' }));
  let checked = await run(root, 'check');
  const issues = Object.fromEntries(checked.processes.map(item => [item.id, item.issues.map(issue => issue.code)]));
  assert.deepEqual(issues, { broken: ['PROCESS_FORM', 'PROCESS_DOC_MISSING', 'PROCESS_DOC_LINK', 'PROCESS_DOC_LINK'], intake: [], invalid: ['MAKER_UNKNOWN_FIELD'], renamed: ['PROCESS_FILE'] });
  assert.deepEqual(checked.processes.find(item => item.id === 'broken').warnings, ['4 project reference(s) not verified: no design/project.json in this project.']);
  assert.equal(checked.status, 'failed');
  await mkdir(join(root, 'design'));
  await writeFile(join(root, 'design/project.json'), JSON.stringify({ design: { nodes: [{ id: 'node-9' }], semantic: { entities: [{ id: 'er-entity-1', slug: 'task' }] }, sitemap: { journeys: [{ id: 'journey-1' }] } } }));
  checked = await run(root, 'check');
  const found = checked.processes.find(item => item.id === 'broken');
  assert.deepEqual([found.warnings, found.issues.filter(issue => issue.code === 'PROCESS_REFERENCE').map(issue => issue.message)],
    [[], ['references.entities names ghost, which design/project.json does not define.']]);
  const listed = await run(root, 'list');
  assert.deepEqual(listed.processes.map(item => [item.id, item.status, item.steps ?? 0]), [['broken', 'active', 3], ['intake', 'active', 3], ['invalid', 'invalid', 0], ['renamed', 'active', 3]]);
  await assert.rejects(() => run(root, 'docs', { name: 'broken' }), /PROCESS_INVALID|has findings/);
  await assert.rejects(() => run(root, 'show', { name: 'nope' }), /Unknown process nope/);
}));
