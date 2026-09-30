import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm, readdir, symlink, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { loadSettings, settingsPlan, guardedText } from '../../bin/adapters/user-settings.ts';
import { defaultSettings } from '../../bin/domain/user-settings.ts';
import { intakePrds } from '../../bin/adapters/prd-intake.ts';
import { projectSetupPlan, setupStatus, setupPrerequisites, angularSetupGuide } from '../../bin/adapters/project-setup.ts';
import { setupExample } from '../../bin/application/setup-schema.ts';
import { applyPrepared } from '../../bin/adapters/storage.ts';
import { execute, parseArguments } from '../../bin/adapters/commands.ts';
import { main } from '../../bin/shell.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
const markdown = (id = 'PRD-1') => `---\ntype: prd\nid: ${id}\ntitle: Product\n---\n# Original\nUntouched source.\n`;
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'angular-setup-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
async function vault(root) {
  const git = spawnSync('git', ['init', root], { encoding: 'utf8' }); assert.equal(git.status, 0, git.stderr);
  await mkdir(join(root, '.obsidian'));
  await writeFile(join(root, '.obsidian', 'app.json'), '{"safe":true}\n');
  await mkdir(join(root, 'docs/prds'), { recursive: true });
  await writeFile(join(root, 'docs/prds/product.md'), markdown());
}
const context = root => ({ root, frameworkRoot });
const request = changes => ({ ...structuredClone(setupExample), boilerplate: false, ...changes });
async function run(root, argv, input) {
  return execute(parseArguments(argv), { ...context(root), input: Readable.from([JSON.stringify(input)]) });
}
test('settings are read-only until approved; stale approvals and corrupt/future settings preserve bytes', async () => scratch(async root => {
  assert.equal((await loadSettings(root)).content, null); assert.deepEqual(await readdir(root), []);
  const plan = await settingsPlan(root, { schemaVersion: 1, preferences: { author: 'Alice' } });
  assert.equal((await applyPrepared(plan)).status, 'planned'); assert.deepEqual(await readdir(root), []);
  await assert.rejects(() => applyPrepared(plan, 'wrong'), /plan changed/);
  await applyPrepared(plan, plan.planHash); assert.equal((await loadSettings(root)).settings.preferences.author, 'Alice');
  const updated = await settingsPlan(root, { schemaVersion: 1, preferences: { ui: 'plain' } });
  await writeFile(join(root, 'configs/user-settings.json'), '{"schemaVersion":999}');
  await assert.rejects(() => applyPrepared(updated, updated.planHash), /PLAN_STALE/);
  for (const value of ['{"schemaVersion":999}', '{broken', '{"schemaVersion":1,"__proto__":{}}']) {
    await writeFile(join(root, 'configs/user-settings.json'), value); await assert.rejects(() => loadSettings(root));
    await assert.rejects(() => settingsPlan(root, { schemaVersion: 1 })); assert.equal(await readFile(join(root, 'configs/user-settings.json'), 'utf8'), value);
  }
}));
test('PRD scan is recursive, deterministic, ignores untyped notes and supports contained imports', async () => scratch(async root => {
  await vault(root); await mkdir(join(root, 'docs/prds/sub'));
  await writeFile(join(root, 'docs/prds/sub/second.md'), markdown('PRD-2'));
  await writeFile(join(root, 'docs/prds/readme.md'), '# Not a PRD');
  let scan = await intakePrds(root, defaultSettings, { mode: 'scan' });
  assert.deepEqual(scan.prds.map(p => p.id), ['PRD-1', 'PRD-2']); assert.deepEqual(scan.ignored, ['docs/prds/readme.md']);
  scan = await intakePrds(root, { ...defaultSettings, preferences: { ...defaultSettings.preferences, scanRecursive: false } }, { mode: 'scan' });
  assert.equal(scan.prds.length, 1);
  await writeFile(join(root, 'added.md'), markdown('PRD-3'));
  const added = await intakePrds(root, defaultSettings, { mode: 'add', files: ['added.md'], documents: [{ filename: 'inline.md', markdown: markdown('PRD-4') }] });
  assert.equal(added.imports.length, 2); assert.equal(added.guards.length, 1);
  assert.equal(added.prds[0].source.path, 'docs/prds/added.md');
  await assert.rejects(() => readFile(join(root, 'docs/prds/added.md')));
}));
test('PRD intake reports malformed, duplicate, empty, missing, unsafe and invalid-source requests', async () => scratch(async root => {
  await vault(root);
  for (const input of [{ mode: 'none' }, { mode: 'scan', files: [] }, { mode: 'add', files: ['missing.md'] },
    { mode: 'add', files: ['docs/prds/product.md', 'docs/prds/product.md'] }, { mode: 'add', files: ['../outside.md'] },
    { mode: 'add', files: ['a.json'] }, { mode: 'add', documents: [{ filename: 'folder/a.md', markdown: markdown() }] },
    { mode: 'add', documents: [{ filename: 'a.md', markdown: 12 }] }, { mode: 'add', documents: [{ filename: 'a.md', markdown: '# no type' }] },
    { mode: 'add', documents: [{ filename: 'a.md', markdown: markdown() }, { filename: 'b.md', markdown: markdown() }] },
    { mode: 'add', files: [] }]) await assert.rejects(() => intakePrds(root, defaultSettings, input));
  await writeFile(join(root, 'docs/prds/duplicate.md'), markdown());
  await assert.rejects(() => intakePrds(root, defaultSettings, { mode: 'scan' }), /Duplicate PRD/);
  await rm(join(root, 'docs/prds'), { recursive: true });
  await assert.rejects(() => intakePrds(root, defaultSettings, { mode: 'scan' }), /No typed PRDs/);
}));
test('setup requires the actual Git root and a non-symlink vault; does not initialize either', async () => scratch(async root => {
  await assert.rejects(() => setupPrerequisites(root)); assert.deepEqual(await readdir(root), []);
  await mkdir(join(root, '.git')); await mkdir(join(root, '.obsidian'));
  await assert.rejects(() => setupPrerequisites(root), /working-tree root/);
}));
test('minimal setup is a no-write preview, preserves host/PRDs, repeats unchanged and uses saved paths', async () => scratch(async root => {
  await vault(root);
  const input = request({ settings: { schemaVersion: 1, paths: { project: 'specs/product.json', app: 'products/web' }, preferences: { author: 'Alice' } } });
  const plan = await projectSetupPlan(context(root), input);
  assert.equal(plan.data.installed, false); assert.equal(plan.data.runtimeAccepted, false); assert.equal(plan.data.start, null);
  await assert.rejects(() => readFile(join(root, 'configs/user-settings.json')));
  assert.equal(plan.plan.changes.find(c => c.path === 'docs/prds/product.md').status, 'unchanged');
  await applyPrepared(plan, plan.planHash);
  assert.equal(await readFile(join(root, 'docs/prds/product.md'), 'utf8'), markdown());
  assert.equal(await readFile(join(root, '.obsidian/app.json'), 'utf8'), '{"safe":true}\n');
  const repeat = await projectSetupPlan(context(root), input); assert.ok(repeat.plan.changes.every(c => c.status === 'unchanged'));
  assert.equal((await applyPrepared(repeat, repeat.planHash)).status, 'unchanged');
  const show = await run(root, ['sketch', 'show'], undefined); assert.equal(show.projectPath, 'specs/product.json');
  assert.equal(show.pages[0].title, 'Hello world'); assert.equal(show.sitemap.routes[0].path, '/');
  assert.equal((await setupStatus(root)).state.phase, 'prepared');
  await assert.rejects(() => settingsPlan(root, { schemaVersion: 1, paths: { app: 'moved' } }), /migration/);
  const prefs = await settingsPlan(root, { schemaVersion: 1, preferences: { ui: 'plain' } }); await applyPrepared(prefs, prefs.planHash);
  await assert.rejects(() => projectSetupPlan(context(root), request({ project: { ...setupExample.project, name: 'Other' } })), /Setup paths changed|already exists/);
}));
test('setup preflight rejects changed PRD inventory, cancellation, existing project files and imported conflicts', async () => scratch(async root => {
  await vault(root); const plan = await projectSetupPlan(context(root), request());
  await writeFile(join(root, 'docs/prds/new.md'), markdown('PRD-2'));
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /inventory changed/);
  await assert.rejects(() => readFile(join(root, 'configs/user-settings.json')));
  await rm(join(root, 'docs/prds/new.md'));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => projectSetupPlan({ ...context(root), signal: controller.signal }, request()), /cancelled/);
  await assert.rejects(() => applyPrepared(plan, plan.planHash, controller.signal), /Cancelled/);
  await mkdir(join(root, 'design')); await writeFile(join(root, 'design/project.json'), '{}');
  await assert.rejects(() => projectSetupPlan(context(root), request()), /preserves existing/);
  await rm(join(root, 'design/project.json'));
  await assert.rejects(() => projectSetupPlan(context(root), request({ prds: { mode: 'add', documents: [{ filename: 'product.md', markdown: markdown('Other') }] } })), /replace an existing PRD/);
}));
test('setup validates choices and supports adding PRDs without modifying originals', async () => scratch(async root => {
  await vault(root);
  for (const value of [{}, request({ schemaVersion: 2 }), request({ prototypeInterview: undefined }), request({ boilerplate: 'yes' }), request({ operations: null }), request({ extra: true })]) await assert.rejects(() => projectSetupPlan(context(root), value));
  await writeFile(join(root, 'other.md'), markdown('PRD-2'));
  const plan = await projectSetupPlan(context(root), request({ prds: { mode: 'add', files: ['other.md'] } }));
  await applyPrepared(plan, plan.planHash);
  assert.equal(await readFile(join(root, 'docs/prds/other.md'), 'utf8'), markdown('PRD-2'));
  assert.equal(await readFile(join(root, 'other.md'), 'utf8'), markdown('PRD-2'));
}));
test('agent discovery and validation work without a terminal and never imply file approval', async () => scratch(async root => {
  for (const argv of [['settings','schema'], ['settings','show'], ['project-setup','schema'], ['project-setup','guide'], ['project-setup','status']]) assert.ok(await run(root, argv, undefined));
  await assert.rejects(() => run(root, ['settings','wat'], {}));
  await assert.rejects(() => run(root, ['project-setup','wat'], {}));
  await assert.rejects(() => run(root, ['project-setup','--out','wrong'], request()));
  await vault(root);
  assert.equal((await run(root, ['project-setup','scan'], undefined)).prds.length, 1);
  assert.equal((await run(root, ['project-setup','validate','--input','-'], request())).status, 'validated');
  await assert.rejects(() => run(root, ['project-setup','validate','--apply','x','--input','-'], request()));
  const planned = await run(root, ['project-setup','--input','-'], request());
  await run(root, ['project-setup','--input','-','--apply',planned.planHash], request());
  assert.equal((await run(root, ['project-setup','status'], undefined)).state.boilerplatePrepared, false);
  let out = '', err = '';
  const output = new Writable({ write(chunk, _encoding, done) { out += chunk; done(); } });
  const error = new Writable({ write(chunk, _encoding, done) { err += chunk; done(); } });
  assert.equal(await main(['project-setup','--root',root,'--json'], frameworkRoot, { input: Readable.from([]), output, error, env: { CI: 'true' } }), 1);
  assert.equal(JSON.parse(out).status, 'failed'); assert.equal(err, '');
}));
test('settings approval is invalidated when setup state appears after preview', async () => scratch(async root => {
  const plan = await settingsPlan(root, { schemaVersion: 1 });
  await mkdir(join(root, 'configs')); await writeFile(join(root, 'configs/project-setup.json'), '{}');
  await assert.rejects(() => applyPrepared(plan, plan.planHash), /state changed/);
  await assert.rejects(() => readFile(join(root, 'configs/user-settings.json')));
}));
test('symlink sources and settings are refused rather than followed', async () => scratch(async root => {
  if (process.platform === 'win32') return;
  await vault(root); await writeFile(join(root, 'outside.md'), markdown('PRD-2'));
  await symlink(join(root, 'outside.md'), join(root, 'docs/prds/link.md'));
  await assert.rejects(() => intakePrds(root, defaultSettings, { mode: 'scan' }), /symbolic links/);
  await assert.rejects(() => guardedText(root, 'docs/prds/link.md'), /SYMLINK/);
}));
for (const prototype of [false, true]) test(`Angular source plan with prototype=${prototype} has a Hello world entry and real npm start script`, async () => scratch(async root => {
  await vault(root); const { guide } = await angularSetupGuide(frameworkRoot);
  const answers = Object.fromEntries(guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => [field.id, field.default]));
  const input = request({ boilerplate: true, prototypeInterview: prototype ? { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version, answers: { ...answers, title: 'Example product', approved: true } } : null,
    operations: [{ op: 'page.add', title: 'Orders', as: 'orders' }, { op: 'entity.add', title: 'Order' }, { op: 'data-source.add', title: 'Orders', kind: 'api' }, { op: 'journey.add', title: 'Browse', pages: ['@orders'] }] });
  const plan = await projectSetupPlan(context(root), input);
  const file = path => plan.plan.changes.find(c => c.path === path)?.content;
  assert.equal(JSON.parse(file('apps/product/package.json')).scripts.start, 'npm run build && node scripts/serve.mjs');
  assert.match(file('apps/product/scripts/serve.mjs'), /127\.0\.0\.1/);
  assert.match(file('apps/product/src/core/project.ts'), /Hello world/);
  assert.equal(plan.data.document.design.nodes[0].entry, true);
  assert.equal(plan.data.document.design.semantic.entities[0].name, 'Order');
  assert.equal(Boolean(file('prototypes/project/execution-prompt.md')), prototype);
  assert.equal(plan.data.businessImplemented, false); assert.equal(plan.data.start.cwd, 'apps/product');
  await applyPrepared(plan, plan.planHash);
  const redo = await projectSetupPlan(context(root), input); assert.ok(redo.plan.changes.every(c => c.status === 'unchanged'));
  const app = join(root, 'apps/product');
  const core = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/scaffold.test.mjs'], { cwd: app, encoding: 'utf8' });
  assert.equal(core.status, 0, core.stdout + core.stderr);
  const syntax = spawnSync(process.execPath, ['--check', 'scripts/serve.mjs'], { cwd: app, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
}));
test('later prototype preparation retains saved Angular selection and uses its configured output', async () => scratch(async root => {
  await vault(root);
  const setup = await projectSetupPlan(context(root), request({ settings: { schemaVersion: 1, paths: { prototypes: 'drafts/prototype' } } }));
  await applyPrepared(setup, setup.planHash);
  const discovered = await run(root, ['prototype', 'guide'], undefined);
  assert.equal(discovered.selection.framework, 'angular');
  const input = { ...discovered.input, answers: { ...discovered.input.answers, title: 'Example product', approved: true } };
  const plan = await run(root, ['prototype', '--input', '-'], input);
  assert.equal(plan.selection.framework, 'angular');
  assert.equal(plan.changes.find(c => c.path === 'drafts/prototype/source/package.json').status, 'create');
  assert.ok(!plan.changes.some(c => c.path.startsWith('apps/product/')));
  await run(root, ['prototype', '--input', '-', '--apply', plan.planHash], input);
  const pkg = JSON.parse(await readFile(join(root, 'drafts/prototype/source/package.json'), 'utf8'));
  assert.equal(pkg.dependencies['@angular/core'], '22.0.0');
}));

test('packaged settings and setup examples execute against the canonical schema and real services', async () => scratch(async root => {
  await vault(root);
  const input = JSON.parse(await readFile(join(frameworkRoot, 'bin/examples/angular-setup.json'), 'utf8'));
  input.settings = JSON.parse(await readFile(join(frameworkRoot, 'bin/examples/user-settings.json'), 'utf8'));
  const source = await readFile(join(frameworkRoot, 'bin/examples/product-prd.md'), 'utf8');
  input.prds = { mode: 'add', documents: [{ filename: 'example.md', markdown: source }] };
  const plan = await projectSetupPlan(context(root), input);
  assert.equal(plan.data.document.design.semantic.entities[0].properties.length, 2);
  assert.equal(plan.data.document.design.sitemap.journeys[0].steps.length, 2);
  assert.equal(plan.data.document.design.prds[0].markdown, source);
  assert.equal(plan.data.selection.framework, 'angular');
  await applyPrepared(plan, plan.planHash);
  assert.equal(await readFile(join(root, 'docs/prds/example.md'), 'utf8'), source);
}));

test('setup runs the installed webapp-angular starter by ID and fails closed when it is missing or not Angular', async () => scratch(async root => {
  await vault(root);
  const plan = await projectSetupPlan(context(root), request());
  const saved = JSON.parse(plan.plan.changes.find(change => change.path === 'project.config.json').content);
  assert.equal(saved.schemaVersion, 2); assert.equal(saved.starter.id, 'webapp-angular'); assert.deepEqual(saved, plan.data.selection);
  const shell = join(root, 'shell'); await mkdir(join(shell, 'configs/starters'), { recursive: true });
  await assert.rejects(() => projectSetupPlan({ root, frameworkRoot: shell }, request()), /No project starters are installed/);
  const definition = JSON.parse(await readFile(join(frameworkRoot, 'configs/starters/webapp-angular.json'), 'utf8'));
  delete definition.generator.angularPins; definition.generator.framework = 'vanilla';
  await writeFile(join(shell, 'configs/starters/webapp-angular.json'), JSON.stringify(definition));
  await assert.rejects(() => angularSetupGuide(shell), /select Angular with a webapp target/);
  await cp(join(frameworkRoot, 'configs/starters/cli.json'), join(shell, 'configs/starters/cli.json'));
  await rm(join(shell, 'configs/starters/webapp-angular.json'));
  await assert.rejects(() => angularSetupGuide(shell), /Choose an installed project starter: cli/);
  assert.equal((await run(root, ['project-setup', 'guide'], undefined)).selection.starter.id, 'webapp-angular');
  await assert.rejects(() => execute(parseArguments(['project-setup', 'guide', '--starter', 'cli']), { ...context(root), input: Readable.from([]) }), /webapp-angular/);
}));
