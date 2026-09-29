import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { coreSource, pluginSource, cliSource, cliEntry, browserSource } from '../../scripts/compiler/adapters/project/sources.ts';
import { buildSource, licenseSource } from '../../scripts/compiler/adapters/project/build-source.ts';
import { newDocument, documentText } from '../../bin/domain/document.ts';
import { runOperations } from '../../bin/application/operations.ts';
import { analyzeProject } from '../../scripts/compiler/index.ts';
async function scratch(fn) { const root = await mkdtemp(join(await realpath(tmpdir()), 'project-runtime-')); try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); } }
function host(mount) {
  const surfaces = [], notices = [];
  class ItemView { constructor() { this.contentEl = { createDiv() { const surface = { dataset: {}, classList: { add() {} }, removed: false, remove() { this.removed = true; } }; surfaces.push(surface); return surface; } }; } }
  class Plugin {}
  class Notice { constructor(message) { notices.push(message); } }
  let source = stripTypeScriptTypes(pluginSource('lifecycle', 'Lifecycle </script>'));
  source = source.replace(/^import .*;\n/gm, '').replace('export default ', '');
  const api = vm.runInNewContext(source + '\n({ ProjectView, ProjectPlugin });', { Plugin, ItemView, Notice, mount });
  return { ...api, surfaces, notices };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
test('native starter releases a late asynchronous mount after close and repeated close is harmless', async () => {
  const pending = deferred(); let releases = 0;
  const f = host(() => pending.promise), view = new f.ProjectView();
  const opening = view.onOpen(); await view.onClose();
  pending.resolve(() => releases++); await opening; await view.onClose();
  assert.equal(releases, 1); assert.equal(f.surfaces[0].removed, true);
  assert.equal(view.getViewType(), 'lifecycle-view'); assert.equal(view.getDisplayText(), 'Lifecycle </script>');
});
test('native remount cleans the previous application; failure does not leave an owned surface', async () => {
  let releases = 0;
  const f = host(async () => () => releases++), view = new f.ProjectView();
  await view.onOpen(); await view.onOpen(); assert.equal(releases, 1);
  await view.onClose(); await view.onClose(); assert.equal(releases, 2);
  assert.ok(f.surfaces.every(item => item.removed));
  const broken = host(async () => { throw new Error('mount failed'); });
  await assert.rejects(() => new broken.ProjectView().onOpen(), /mount failed/);
  assert.equal(broken.surfaces[0].removed, true); assert.equal(broken.notices.length, 1);
});
test('a cleanup error still clears the native reference and removes its surface', async () => {
  let releases = 0;
  const f = host(async () => () => { releases++; throw new Error('cleanup failed'); }), view = new f.ProjectView();
  await view.onOpen(); await assert.rejects(() => view.onClose(), /cleanup failed/);
  await view.onClose(); assert.equal(releases, 1); assert.equal(f.surfaces[0].removed, true);
});
test('overlapping native opens release only stale application instances and unload owns its view', async () => {
  const first = deferred(); let calls = 0, releases = 0;
  const f = host(async () => ++calls === 1 ? first.promise : () => releases++), view = new f.ProjectView();
  const old = view.onOpen(); await view.onOpen(); first.resolve(() => releases++); await old;
  assert.equal(releases, 1); await view.onClose(); assert.equal(releases, 2);
  const plugin = new f.ProjectPlugin(); let type;
  plugin.app = { workspace: { detachLeavesOfType(value) { type = value; } } };
  plugin.onunload(); assert.equal(type, 'lifecycle-view');
});
test('generated CLI source executes real human/JSON commands without any frontend or dependencies', async () => scratch(async root => {
  const document = runOperations(newDocument('Safe ${notExecuted}'), [{ op: 'page.add', title: '</script><script>throw 1</script>' }]).document;
  const result = await analyzeProject(documentText(document)); assert.equal(result.status, 'ok');
  const files = { 'package.json': '{"type":"module"}', 'src/core/project.ts': coreSource(result.model),
    'src/targets/cli/commands.ts': cliSource(), 'src/targets/cli/main.ts': '#!/usr/bin/env node\n' + cliEntry };
  for (const [path, source] of Object.entries(files)) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), source); }
  function run(args) { return spawnSync(process.execPath, ['--experimental-strip-types', 'src/targets/cli/main.ts', ...args], { cwd: root, encoding: 'utf8', timeout: 5000, env: { ...process.env, NODE_NO_WARNINGS: '1' } }); }
  const list = run(['pages', '--json']); assert.equal(list.status, 0, list.stderr);
  const response = JSON.parse(list.stdout); assert.equal(response.pages[0].title, '</script><script>throw 1</script>'); assert.equal(list.stderr, '');
  const show = run(['show', response.pages[0].id]); assert.equal(show.status, 0); assert.match(show.stdout, /Starting scaffold/);
  const bad = run(['invalid', '--json']); assert.equal(bad.status, 2); assert.equal(JSON.parse(bad.stdout).error.code, 'INVALID_ARGUMENT'); assert.equal(bad.stderr, '');
  const human = run(['invalid']); assert.equal(human.status, 2); assert.equal(human.stdout, ''); assert.match(human.stderr, /Unknown command/);
  assert.equal(run(['--help']).status, 0); assert.equal(run(['pages', '--json', '--json']).status, 2);
}));
test('emitted build adapters are syntactically valid and preserve explicit no-overwrite/CLI boundaries', async () => scratch(async root => {
  for (const source of [buildSource, licenseSource]) {
    const checked = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8', timeout: 5000 });
    assert.equal(checked.status, 0, checked.stderr);
  }
  await mkdir(join(root, 'scripts')); await writeFile(join(root, 'scripts/build.mjs'), buildSource);
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ id: 'probe', name: 'Probe' }));
  const config = async value => writeFile(join(root, 'project.config.json'), JSON.stringify(value));
  function run(args) { return spawnSync(process.execPath, ['scripts/build.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 5000 }); }
  await config({ framework: 'none', targets: ['cli'] });
  assert.match(run(['--prototype']).stderr, /no HTML prototype/);
  assert.match(run(['--replace']).stderr, /applies only to prototype/);
  assert.match(run(['--unknown']).stderr, /Use --prototype/);
  await config({ framework: 'vanilla', targets: ['webapp'] });
  await mkdir(join(root, 'dist')); await writeFile(join(root, 'dist/prototype.html'), 'Keep me');
  assert.match(run(['--prototype']).stderr, /Prototype exists/);
  assert.equal(await readFile(join(root, 'dist/prototype.html'), 'utf8'), 'Keep me');
}));
test('browser readiness is established only after mount, and teardown clears readiness even when cleanup fails', async () => {
  const pending = deferred(), handlers = new Map(), root = { dataset: {}, classList: { add() {} } };
  const document = { querySelector: () => root, documentElement: { dataset: {} } };
  let cleanup = 0;
  const source = stripTypeScriptTypes(browserSource({ framework: 'vanilla' }, 'probe')).replace(/^import .*;\n/gm, '');
  vm.runInNewContext(source, { document, window: { addEventListener: (event, fn) => handlers.set(event, fn), removeEventListener: event => handlers.delete(event) }, mount: () => pending.promise, console });
  assert.equal(document.documentElement.dataset.prototypeReady, undefined);
  pending.resolve(() => { cleanup++; throw new Error('cleanup'); }); await new Promise(done => setImmediate(done));
  assert.equal(document.documentElement.dataset.prototypeReady, 'true');
  assert.throws(() => handlers.get('pagehide')(), /cleanup/); assert.equal(document.documentElement.dataset.prototypeReady, undefined);
  handlers.get('pagehide')(); assert.equal(cleanup, 1);
});


test('every generated browser framework passes strict TypeScript, including the asynchronous mount closure', async () => scratch(async root => {
  const { default: ts } = await import('typescript');
  await mkdir(join(root, 'src/ui'), { recursive: true });
  await mkdir(join(root, 'src/targets/preview'), { recursive: true });
  await writeFile(join(root, 'src/ui/mount.ts'), 'export async function mount(root: HTMLElement): Promise<() => void> { return () => root.replaceChildren(); }');
  await writeFile(join(root, 'styles.d.ts'), "declare module '*.css';");
  const entry = join(root, 'src/targets/preview/main.ts');
  const compilerOptions = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true, noUncheckedSideEffectImports: true, types: [] };
  const diagnostics = () => ts.getPreEmitDiagnostics(ts.createProgram([entry, join(root, 'styles.d.ts')], compilerOptions));
  for (const framework of ['vanilla', 'angular', 'nuxtui']) {
    await writeFile(entry, browserSource({ framework }, 'checked-browser'));
    assert.deepEqual(diagnostics().map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [], framework);
  }
  const unsafe = browserSource({ framework: 'vanilla' }, 'checked-browser')
    .replace("const candidate = document.querySelector<HTMLElement>('[data-project-root]');\nif (!candidate) throw new Error('PROJECT_ROOT_MISSING');\nconst root: HTMLElement = candidate;",
      "const root = document.querySelector<HTMLElement>('[data-project-root]');\nif (!root) throw new Error('PROJECT_ROOT_MISSING');");
  await writeFile(entry, unsafe);
  assert.ok(diagnostics().some(diagnostic => [18047, 2345].includes(diagnostic.code)), 'the pre-fix nullable closure must fail the same compiler');
}));
