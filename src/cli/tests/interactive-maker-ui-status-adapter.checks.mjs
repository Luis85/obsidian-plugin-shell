import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { main } from '../adapters/framework-cli.ts';
import { uiOperation } from '../adapters/framework/ui-operation.ts';
import { fileSymlink } from '../../../tests/support/file-symlink.mjs';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);

const frameworkRoot = resolve(import.meta.dirname, '../../..');
function capture() {
  let text = '';
  const stream = new PassThrough();
  stream.isTTY = false; stream.on('data', chunk => { text += String(chunk); });
  return { stream, read: () => text };
}
async function run(argv) {
  const output = capture(), error = capture();
  const code = await main(argv, frameworkRoot, { input: Readable.from([]), output: output.stream, error: error.stream, env: { CI: 'true', NO_COLOR: '1' } });
  return { code, stdout: output.read(), stderr: error.read() };
}
async function write(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), typeof content === 'string' ? content : JSON.stringify(content));
}
const STUB = 'export const execute = async () => { throw new NotImplementedError("vp-1", "vi-1"); };\n';
const hook = (id, extra = {}) => ({ id, definitionId: 'vp-1', nodeId: 'vn-1', label: `Hook ${id}`, event: 'click', verification: 'business-todo',
  implementation: `src/generated/application/interactions/${id}.ts`, test: `tests/project/acceptance/${id}.test.ts`, ...extra });
async function project(t, files = {}) {
  const base = await realpath(await mkdtemp(join(tmpdir(), 'ui-status-'))), root = join(base, 'project');
  after(t, () => rm(base, { recursive: true, force: true }));
  await write(root, 'design/visual-traceability.json', { definitions: [{ id: 'vp-1', kind: 'page', ownerId: 'node-2', component: 'a.vue' }],
    interactions: [hook('vi-1'), hook('vi-2'), hook('vi-3', { implementation: '../outside.ts' }), hook('vi-4', { verification: 'executable-ui-effect', implementation: null, test: null })],
    businessAcceptance: 'not-implemented' });
  await write(root, 'design/project.json', { design: { nodes: [{ id: 'node-2', label: 'Capture inbox' }],
    sitemap: { journeys: [{ id: 'j1', name: 'Capture', steps: [{ id: 's1', surface: 'node-2' }, { id: 's2', surface: 'node-2' }] }] } } });
  await write(root, 'src/generated/application/interactions/vi-1.ts', STUB);
  await write(root, 'tests/project/acceptance/vi-1.test.ts', "it.todo('[vi-1] capture');\n");
  await write(root, 'src/generated/application/interactions/vi-2.ts', 'export const execute = async () => ({ ok: true });\n');
  await write(root, 'tests/project/acceptance/vi-2.test.ts', "it('[vi-2] works', () => {});\n");
  await write(root, 'tests/e2e/journeys/j1.spec.ts', "test('[j1/s1] opens', async () => {});\n");
  for (const [path, content] of Object.entries(files)) await write(root, path, content);
  return root;
}
const status = async root => JSON.parse((await run(['ui', 'status', '--root', root, '--json'])).stdout);
const find = (report, id) => report.data.interactions.find(item => item.id === id);

test('ui status reads a real project folder through the CLI and never writes', async t => {
  const root = await project(t);
  const { code, stderr, stdout } = await run(['ui', 'status', '--root', root, '--json']);
  assert.equal(code, 0); assert.equal(stderr, '');
  const report = JSON.parse(stdout);
  assert.equal(report.protocolVersion, 1); assert.equal(report.command, 'ui status'); assert.equal(report.status, 'ok');
  assert.equal(report.data.schemaVersion, 1); assert.equal(report.data.behaviorAcceptance, 'not-run');
  assert.deepEqual(report.data.totals.interactions, { total: 4, generated: 1, todo: 2, implemented: 1 });
  assert.deepEqual([find(report, 'vi-1').state, find(report, 'vi-2').state, find(report, 'vi-4').state], ['todo', 'implemented', 'generated']);
  assert.deepEqual(report.data.totals.journeys, { total: 1, steps: 2, stepsWithSpec: 1 });
  assert.equal(report.data.surfaces[0].label, 'Capture inbox');
  assert.equal(report.data.evidence.e2e.state, 'absent'); assert.equal(report.data.evidence.gallery.state, 'absent');
});
test('a link-escaping implementation path is treated as missing, not read', async t => {
  const root = await project(t);
  await writeFile(join(root, '..', 'outside.ts'), 'export const execute = async () => ({ ok: true });\n');
  const item = find(await status(root), 'vi-3');
  assert.equal(item.state, 'todo'); assert.deepEqual(item.reasons.slice(0, 1), ['stub-missing']);
  assert.equal(item.stub.exists, false);
});
test('absolute, drive and backslash implementation paths are treated as missing on every host', async t => {
  const root = await project(t);
  const escapes = ['/outside.ts', 'C:/outside.ts', 'C:outside.ts', '..\\outside.ts', 'src/../../outside.ts'];
  await write(root, 'design/visual-traceability.json', { definitions: [{ id: 'vp-1', kind: 'page' }],
    interactions: escapes.map((path, index) => hook(`vi-e${index}`, { implementation: path })) });
  // Real targets exist, so only the containment check can keep them unread; POSIX hosts can also hold the drive-shaped names.
  await writeFile(join(root, '..', 'outside.ts'), STUB);
  if (process.platform !== 'win32') { await write(root, 'C:/outside.ts', STUB); await write(root, 'C:outside.ts', STUB); }
  const report = await status(root);
  assert.deepEqual(escapes.map((_, index) => find(report, `vi-e${index}`).stub.exists), escapes.map(() => false));
});
test('a symlinked linked file is not followed', async t => {
  const root = await project(t);
  if (!await fileSymlink(t, join(root, 'tests/project/acceptance/vi-2.test.ts'), join(root, 'tests/project/acceptance/vi-link.test.ts'))) return;
  await write(root, 'design/visual-traceability.json', { definitions: [{ id: 'vp-1', kind: 'page' }], interactions: [hook('vi-9', { implementation: null, test: 'tests/project/acceptance/vi-link.test.ts' })] });
  const item = find(await status(root), 'vi-9');
  assert.deepEqual([item.state, item.reasons], ['todo', ['test-missing']]);
});
test('retained e2e and gallery reports are summarised when present', async t => {
  const root = await project(t, {
    'reports/e2e/results.json': { suites: [{ file: 'tests/e2e/ui-quality.spec.ts', specs: [{ title: '[vi-2] ok @ 390px dark', ok: true, tests: [{ projectName: 'chromium', status: 'expected' }] }] }] },
    'reports/ui-gallery/index.json': { schemaVersion: 1, entries: [{ surfaceId: 'vp-1', theme: 'dark', width: 390 }] },
  });
  const { evidence } = (await status(root)).data;
  assert.deepEqual([evidence.e2e.passed, evidence.e2e.themes, evidence.e2e.widths, evidence.e2e.passedIds], [1, ['dark'], [390], ['vi-2']]);
  assert.deepEqual([evidence.gallery.entries, evidence.gallery.surfaces, evidence.gallery.widths], [1, ['vp-1'], [390]]);
  assert.deepEqual(evidence.surfacesWithoutGalleryEntry, []);
});
test('unreadable traceability is reported as a warning while the command still succeeds', async t => {
  const root = await project(t, { 'design/visual-traceability.json': '{ not json' });
  const { code, stdout } = await run(['ui', 'status', '--root', root, '--json']);
  const report = JSON.parse(stdout);
  assert.equal(code, 0); assert.equal(report.data.sources.traceability, 'invalid');
  assert.equal(report.data.totals.interactions.total, 0);
  assert.equal(report.diagnostics[0].code, 'UI_STATUS_SOURCE'); assert.equal(report.diagnostics[0].severity, 'warning');
});
test('human output is a compact table with a proof line and a next step', async t => {
  const root = await project(t);
  const { code, stdout } = await run(['ui', 'status', '--root', root]);
  assert.equal(code, 0);
  assert.match(stdout, /^ui status: ok/);
  assert.match(stdout, /Interactions\s+4 \(2 todo, 1 implemented, 1 generated\)/);
  assert.match(stdout, /\[todo\]\s+vi-1\s+Hook vi-1 \(vp-1\)\s+stub-throws-not-implemented, test-has-todo/);
  assert.match(stdout, /no test was executed; business acceptance not-run/);
  assert.match(stdout, /Next: open src\/generated\/application\/interactions\/vi-1\.ts/);
  assert.doesNotMatch(stdout, /vi-2\s+Hook vi-2/, 'implemented work is not listed as todo');
});
test('a folder without design files is not a project: clear error and exit 1', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'ui-status-empty-')));
  after(t, () => rm(root, { recursive: true, force: true }));
  const json = await run(['ui', 'status', '--root', root, '--json']);
  assert.equal(json.code, 1);
  const report = JSON.parse(json.stdout);
  assert.equal(report.status, 'failed'); assert.equal(report.diagnostics[0].code, 'UI_PROJECT_NOT_FOUND');
  assert.match(report.diagnostics[0].message, /visual-traceability\.json/);
  const human = await run(['ui', 'status', '--root', root]);
  assert.equal(human.code, 1); assert.match(human.stderr, /UI_PROJECT_NOT_FOUND/);
});
test('the ui group rejects subcommands it has no handler for', async () => {
  await assert.rejects(() => uiOperation({ command: 'ui nothing', args: [], options: {} }, { root: '.', frameworkRoot }), /Unknown ui command/);
  await assert.rejects(() => uiOperation({ command: 'ui constructor', args: [], options: {} }, { root: '.', frameworkRoot }), /Unknown ui command/);
});
