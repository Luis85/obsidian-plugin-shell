import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { compileProject, loadTemplateSnapshot } from '../../bin/compiler/index.ts';
import { parseBrowserStarter } from '../../bin/adapters/starters/browser.ts';

const root = fileURLToPath(new URL('../../', import.meta.url)), template = await loadTemplateSnapshot(root);
const eslint = join(root, 'node_modules/eslint/bin/eslint.js');

/** Materialize one shipped starter exactly as the compiler emits it, then reuse this checkout's installed toolchain. */
async function emitProject(starter, t) {
  const definition = parseBrowserStarter(await readFile(join(root, 'configs/starters', starter + '.json'), 'utf8'));
  const result = await compileProject({ source: JSON.stringify(definition.generator.document), sourceName: starter + '.json', template });
  assert.equal(result.status, 'ok', JSON.stringify(result.diagnostics));
  // Canonical path: ESLint reports real paths (macOS tmpdir() is under the /var symlink).
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'journey-lint-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const file of result.artifacts) {
    const target = join(dir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content);
  }
  await symlink(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
  const base = result.model.sourceRoot, owned = path => (path.startsWith(base + '/presentation/journey/') || path.startsWith(base + '/bootstrap/journey-')) && /\.(?:ts|vue)$/.test(path) && !path.endsWith('.d.ts');
  const journey = result.artifacts.map(file => file.path).filter(owned);
  return { dir, journey, sourceRoot: result.model.sourceRoot };
}

/** Run the generated project's own ESLint configuration, the same one its agent gate uses. */
function lint(dir, files) {
  const run = spawnSync(process.execPath, [eslint, '-c', 'configs/lint/eslint.config.mjs', '--max-warnings', '0', '--format', 'json', ...files],
    { cwd: dir, encoding: 'utf8', timeout: 480_000, maxBuffer: 20_000_000 });
  assert.ok(run.stdout, 'ESLint produced no report: ' + run.stderr);
  const messages = JSON.parse(run.stdout).flatMap(report => report.messages.map(message => ({ file: relative(dir, report.filePath).split(sep).join('/'), rule: message.ruleId, severity: message.severity, line: message.line, text: message.message })));
  return { status: run.status, messages };
}

for (const starter of ['feature-showcase', 'companion-plugin']) {
  test(`[GENERATED-LINT] ${starter}: emitted product code, including the Journey editor, passes the generated project's own ESLint with no errors or warnings`, async t => {
    const { dir, journey, sourceRoot } = await emitProject(starter, t);
    assert.ok(journey.some(path => path.endsWith('components/EditorForm.vue')) && journey.some(path => path.endsWith('bootstrap/journey-mount.ts')), 'the editor sources are emitted');
    const result = lint(dir, [sourceRoot, 'harness/prototype']);
    assert.deepEqual(result.messages, [], 'emitted product code must satisfy the generated lint rules, including vue/no-mutating-props and no-empty-object-type');
    assert.equal(result.status, 0);
  });
}

test('[GENERATED-LINT] a prop mutation injected into the emitted editor fails the same generated lint check', async t => {
  const { dir, journey } = await emitProject('feature-showcase', t);
  const target = journey.find(path => path.endsWith('components/PageInspector.vue'));
  const original = await readFile(join(dir, target), 'utf8');
  const poisoned = original.replace('<aside class="jm-inspector"', '<aside class="jm-inspector" @click="store.query=\'x\'"');
  assert.notEqual(poisoned, original);
  await writeFile(join(dir, target), poisoned);
  const result = lint(dir, [target]);
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.messages.map(({ file, rule, severity }) => [file, rule, severity]), [[target, 'vue/no-mutating-props', 2]]);
});
