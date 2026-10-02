const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilerOperation } from '../../bin/compiler/adapters/cli.ts';
import { createRecorder, formatDiagnostics, writeReports } from '../../bin/compiler/adapters/reporting.ts';
import { dependencyReadiness } from '../../bin/compiler/adapters/dependencies.ts';
import { loadTemplateSnapshot } from '../../bin/compiler/adapters/template-snapshot.ts';
import { diagnostic } from '../../bin/compiler/domain/diagnostics.ts';

// Drives the compiler host CLI adapters (bin/compiler/adapters/{cli,reporting,dependencies,template-snapshot}.ts).
const after = (t, cleanup) => t.after ? t.after(cleanup) : t.onTestFinished(cleanup);
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = await readFile(join(root, 'docs/concepts/companion/starters/blank.companion.json'), 'utf8');
const context = { root, frameworkRoot: root, inputText: source };
// Compiler adapters throw CompilerError, whose stable code lives on its diagnostic.
const failsWith = code => error => error?.diagnostic?.code === code;
const request = (command, options = {}, args = []) => ({ command, args, options: { input: '-', ...options } });
const templateRoots = ['src', 'scripts', 'tests', 'harness', 'docs', '.github', 'bin', 'plugins', 'configs'];
const templateFiles = ['package.json', 'package-lock.json', 'manifest.json', 'versions.json', 'tsconfig.json', '.gitignore', '.nvmrc', 'AGENTS.md', 'LICENSE', 'README.md',
  'TEMPLATE-GUIDE.md', 'SHELL-FIRST-OVERVIEW.md', 'DESIGN-CONSTRAINTS.md', 'PROJECT-SETUP-HANDOUT.md', 'app.mjs', 'shell.mjs'];
/** The smallest tree the template loader accepts: every root folder and root file, no generator templates. */
async function templateTree(folder) {
  for (const name of templateRoots) await mkdir(join(folder, name), { recursive: true });
  for (const name of templateFiles) await writeFile(join(folder, name), name.endsWith('.json') ? '{}\n' : name + '\n');
}
const scratch = async (t, prefix) => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  after(t, () => rm(folder, { recursive: true, force: true }));
  return folder;
};

test('explain names a known diagnostic and refuses an unknown code', async () => {
  const explained = await compilerOperation({ command: 'compiler explain', args: ['COMPILER_JSON_INVALID'], options: {} }, context);
  assert.equal(explained.status, 'ok'); assert.equal(explained.data.code, 'COMPILER_JSON_INVALID'); assert.match(explained.data.help, /UTF-8/);
  await assert.rejects(compilerOperation({ command: 'compiler explain', args: ['NOPE'], options: {} }, context), { code: 'COMPILER_CODE_UNKNOWN' });
  await assert.rejects(compilerOperation({ command: 'compiler explain', args: [], options: {} }, context), { code: 'COMPILER_CODE_UNKNOWN' });
});

test('option validation fails in order with stable codes before any input is read', async () => {
  await assert.rejects(compilerOperation({ command: 'compiler check', args: [], options: {} }, context), { code: 'INPUT_REQUIRED' });
  await assert.rejects(compilerOperation(request('compiler inspect', { stage: 'bad' }), context), { code: 'COMPILER_STAGE_UNKNOWN' });
  await assert.rejects(compilerOperation(request('compiler check', { 'output-kind': 'bad' }), context), { code: 'COMPILER_OUTPUT_UNKNOWN' });
  await assert.rejects(compilerOperation(request('compiler check', { debug: true }), context), { code: 'COMPILER_DEBUG_REQUIRES_REPORT' });
  await assert.rejects(compilerOperation(request('compiler check'), { ...context, inputText: undefined }), { code: 'STDIN_REQUIRED' });
});

test('file input is decoded strictly and invalid UTF-8 is a typed parse diagnostic', async t => {
  const folder = await scratch(t, 'compiler-cli-input-');
  await writeFile(join(folder, 'project.json'), source);
  await writeFile(join(folder, 'binary.json'), Buffer.from([0xff, 0xfe, 0x7b]));
  const ok = await compilerOperation(request('compiler check', { input: 'project.json' }), { ...context, root: folder });
  assert.equal(ok.status, 'ok'); assert.equal(ok.data.project, JSON.parse(source).project.id); assert.equal(ok.data.ir, undefined);
  await assert.rejects(compilerOperation(request('compiler check', { input: 'binary.json' }), { ...context, root: folder }),
    error => failsWith('COMPILER_JSON_INVALID')(error) && error.diagnostic.source.file === 'binary.json' && error.cause instanceof TypeError);
});

test('inspection returns the IR or the artifact inventory, never both', async () => {
  const ir = await compilerOperation(request('compiler inspect'), context);
  assert.equal(ir.data.ir.project.id, JSON.parse(source).project.id); assert.equal(ir.data.inventory, undefined); assert.ok('migration' in ir.data);
  const artifacts = await compilerOperation(request('compiler inspect', { stage: 'artifacts', 'output-kind': 'clickdummy' }), context);
  assert.equal(artifacts.status, 'ok'); assert.equal(artifacts.data.ir, undefined); assert.equal(artifacts.data.outputKind, 'clickdummy');
  assert.ok(artifacts.data.inventory.length > 0);
  assert.ok(artifacts.data.inventory.every(entry => Object.keys(entry).sort().join() === 'ownership,path,producer'));
  const failed = await compilerOperation(request('compiler inspect'), { ...context, inputText: '{' });
  assert.equal(failed.status, 'failed'); assert.equal(failed.data.ir, undefined); assert.equal(failed.data.project, undefined);
});

test('an installed kit supplies its packaged template to artifact inspection', async t => {
  const folder = await scratch(t, 'compiler-cli-kit-');
  await templateTree(join(folder, '.framework/template'));
  await writeFile(join(folder, '.framework/kit.json'), '{}\n');
  const result = await compilerOperation(request('compiler inspect', { stage: 'artifacts', 'output-kind': 'clickdummy' }), { ...context, frameworkRoot: folder });
  // The packaged template carries no bundled offline builder, so lowering refuses click-dummy output from it.
  assert.equal(result.status, 'failed'); assert.equal(result.diagnostics[0].code, 'COMPILER_TEMPLATE_INVALID'); assert.match(result.diagnostics[0].message, /offline builder/);
});

test('debug reports are retained only beside an explicit contained report directory', async t => {
  const folder = await scratch(t, 'compiler-cli-report-');
  const result = await compilerOperation(request('compiler check', { 'report-dir': 'reports/compiler/run', debug: true }), { ...context, root: folder });
  assert.equal(result.status, 'ok'); assert.ok(result.data.report.startsWith('reports/compiler/run/'));
  assert.deepEqual((await readdir(join(folder, result.data.report))).sort(), ['debug.json', 'diagnostics.json', 'events.ndjson', 'summary.json']);
  const recorder = createRecorder(true);
  const summary = { compilerVersion: 'x', status: 'ok', outputKind: 'obsidian-plugin', fingerprint: null, artifacts: 0, diagnostics: [], readiness: {} };
  for (const directory of ['reports/other', '../reports/compiler'])
    await assert.rejects(writeReports(folder, directory, recorder, summary), failsWith('COMPILER_REPORT_FAILED'));
  const written = await writeReports(folder, 'reports/compiler', recorder, summary);
  await assert.rejects(writeReports(folder, 'reports/compiler', recorder, summary), failsWith('COMPILER_REPORT_FAILED'));
  assert.ok(written.endsWith(recorder.runId));
});

test('the recorder bounds events and cause chains, including cyclic causes', () => {
  const recorder = createRecorder(true);
  for (let index = 0; index < 1005; index++) recorder.onEvent({ event: 'started', phase: 'parse' });
  assert.equal(recorder.events.length, 1000); assert.equal(recorder.events.at(-1).sequence, 1000);
  const cyclic = new Error('loop'); cyclic.cause = cyclic;
  recorder.onFailure(cyclic, 'emit'); recorder.onFailure('not an error', 'emit');
  assert.equal(recorder.debugReport().failures.length, 1);
  let chain = new Error('0'); for (let index = 1; index < 12; index++) chain = new Error(String(index), { cause: chain });
  recorder.onFailure(chain, 'emit');
  assert.equal(recorder.debugReport().failures.length, 8);
  const report = recorder.report({ compilerVersion: 'x', status: 'ok', outputKind: 'clickdummy', fingerprint: null, artifacts: 0, diagnostics: [], readiness: {} });
  assert.equal(report.schemaVersion, 1); assert.equal(report.runId, recorder.runId); assert.equal(typeof report.durationMs, 'number');
});

test('terminal diagnostics neutralize control codes and name the source location', () => {
  const located = diagnostic('COMPILER_SCHEMA_INVALID', 'validate', 'bad\u001b[2Jtitle\u009b', { file: 'p\u0007.json', jsonPointer: '' });
  const plain = diagnostic('COMPILER_JSON_INVALID', 'parse', 'plain');
  const text = formatDiagnostics([located, plain]);
  assert.ok(!/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(text));
  assert.match(text, /p .json · \/ \(input\)/); assert.match(text, /^ERROR COMPILER_SCHEMA_INVALID \[validate\]/);
  assert.match(formatDiagnostics([{ ...located, source: { ...located.source, jsonPointer: '/a', document: 'sitemap' } }]), /\/a \(sitemap\)/);
});

test('dependency readiness reports unresolved pins, a missing lock root and invalid manifests', () => {
  const files = (pkg, lock) => [{ path: 'package.json', content: JSON.stringify(pkg) }, { path: 'package-lock.json', content: JSON.stringify(lock) }];
  const pkg = { dependencies: { vue: '1.0.0' }, devDependencies: { vite: '2.0.0' } };
  const locked = { packages: { '': { dependencies: { vue: '1.0.0' }, devDependencies: { vite: '2.0.0' } },
    'node_modules/vue': { version: '1.0.0' }, 'node_modules/vite': { version: '2.0.0' } } };
  assert.deepEqual(dependencyReadiness(files(pkg, locked)), { ready: true, diagnostics: [] });
  const drifted = dependencyReadiness(files(pkg, { packages: { ...locked.packages, 'node_modules/vite': { version: '2.0.1' } } }));
  assert.equal(drifted.ready, false); assert.match(drifted.diagnostics[0].message, /vite@2\.0\.0$/);
  const rootless = dependencyReadiness(files({}, {}));
  assert.equal(rootless.diagnostics[0].code, 'COMPILER_DEPENDENCY_RESOLUTION_REQUIRED'); assert.match(rootless.diagnostics[0].message, /lockfile root/);
  assert.throws(() => dependencyReadiness([{ path: 'package.json', content: '{}' }]), failsWith('COMPILER_TEMPLATE_INVALID'));
  assert.throws(() => dependencyReadiness(files({}, {}).map(file => ({ ...file, content: '{' }))), failsWith('COMPILER_TEMPLATE_INVALID'));
});

test('template snapshots refuse links, fonts and cancellation and expose only text templates', async t => {
  const folder = await scratch(t, 'compiler-cli-template-');
  await templateTree(folder);
  await mkdir(join(folder, 'src/__pycache__'), { recursive: true });
  await writeFile(join(folder, 'src/__pycache__/x.pyc'), 'cache');
  await writeFile(join(folder, 'src/data.gz'), Buffer.from([1, 2, 3]));
  await writeFile(join(folder, 'src/main.ts'), 'export {};\n');
  const snapshot = await loadTemplateSnapshot(folder);
  assert.equal(snapshot.text('src/main.ts'), 'export {};\n'); assert.ok(Object.isFrozen(snapshot));
  assert.ok(!snapshot.frameworkFiles.some(file => file.path.includes('__pycache__')));
  assert.equal(snapshot.frameworkFiles.find(file => file.path === 'src/data.gz').encoding, 'base64');
  assert.throws(() => snapshot.text('src/data.gz'), failsWith('COMPILER_TEMPLATE_INVALID'));
  assert.throws(() => snapshot.text('missing.ts'), failsWith('COMPILER_TEMPLATE_INVALID'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadTemplateSnapshot(folder, controller.signal), failsWith('COMPILER_CANCELLED'));
  await writeFile(join(folder, 'src/font.woff2'), 'font');
  await assert.rejects(loadTemplateSnapshot(folder), failsWith('COMPILER_TEMPLATE_INVALID'));
  await rm(join(folder, 'src/font.woff2'));
  await symlink(join(folder, 'src/main.ts'), join(folder, 'src/link.ts'));
  await assert.rejects(loadTemplateSnapshot(folder), error => failsWith('COMPILER_TEMPLATE_INVALID')(error) && /GENERATOR_TEMPLATE_LINK/.test(error.diagnostic.message));
});
