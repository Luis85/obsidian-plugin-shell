import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateAuthoringDocument, parseAuthoringDocument, migrateAuthoringDocument } from '../../scripts/companion/authoring-contract.ts';
import { airshipOptions, airshipConfig, toolingSchema } from '../../scripts/companion/tooling-contract.mjs';
import { withAirshipOption } from '../../scripts/companion/tooling-options.ts';
import { compileProject, loadTemplateSnapshot } from '../../scripts/compiler/index.ts';
import { planArtifacts, applyProject } from '../../scripts/compiler/adapters/workspace-plan.ts';
import { parseCliArguments } from '../../scripts/framework/catalog.ts';
import { executeOperation } from '../../scripts/framework/operations.ts';
import { planOperation, applyOperation } from '../../scripts/framework/planning.ts';
import { airshipEnvironment } from '../../scripts/framework/airship.ts';
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/quick-capture.companion.json'), 'utf8'));
const enabled = () => withAirshipOption(structuredClone(source), { airship: true });
const template = await loadTemplateSnapshot(root);
const request = (command, options = {}) => ({ command, args: [], options });
async function scratch(t, document = enabled()) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'shell-airship-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'design'));
  await writeFile(join(directory, 'design/project.json'), JSON.stringify(document));
  return { root: directory, frameworkRoot: root };
}

test('absent opt-in preserves legacy input/version; explicit settings round-trip as inert v6 data', () => {
  assert.equal(airshipOptions().enabled, false);
  assert.equal(withAirshipOption(source, {}), source);
  const document = enabled();
  assert.equal(document.schemaVersion, 6);
  assert.equal(document.tooling.airship.enabled, true);
  assert.deepEqual(parseAuthoringDocument(JSON.stringify(document)), document);
  assert.equal(withAirshipOption(document, { 'no-airship': true }).tooling.airship.enabled, false);
  assert.equal(Object.hasOwn(source, 'tooling'), false);
  assert.throws(() => withAirshipOption(source, { airship: true, 'no-airship': true }), /AIRSHIP_OPTION_CONFLICT/);
  assert.equal(toolingSchema().properties.airship.properties.enabled.default, false);
});
test('bad settings fail closed with schema diagnostics; no artifact is emitted', async () => {
  for (const airship of [null, true, {}, { enabled: 'true' }, { enabled: true, exec: 'touch bad' },
    { enabled: true, agent: 'shell' }, { enabled: true, host: '0.0.0.0' }, { enabled: true, safe: false },
    { enabled: true, port: 1 }, { enabled: true, targetPort: 65536 }, { enabled: true, port: 5173 },
    { enabled: true, port: 7000, targetPort: 7000 }, { enabled: true, targetPort: 1.5 }]) {
    const document = enabled(); document.tooling = { airship };
    assert.throws(() => validateAuthoringDocument(document));
    const compiled = await compileProject({ source: JSON.stringify(document), template });
    assert.equal(compiled.status, 'failed');
    assert.equal(compiled.diagnostics[0].code, 'COMPILER_SCHEMA_INVALID');
    assert.deepEqual(compiled.artifacts, []);
  }
  const legacy = structuredClone(source); legacy.tooling = { airship: { enabled: true } };
  assert.equal(validateAuthoringDocument(legacy).tooling.airship.enabled, true);
  assert.equal(migrateAuthoringDocument(legacy).document.tooling.airship.enabled, true);
});
test('all starters emit source previews without optional dependencies; Airship is data-only opt-in for both targets', async () => {
  const catalog = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters/catalog.json'), 'utf8'));
  for (const starter of catalog.starters) {
    const file = starter.file ?? starter.path;
    assert.ok(file, JSON.stringify(starter));
    const document = JSON.parse(await readFile(join(root, 'docs/concepts/companion/starters', file), 'utf8'));
    for (const outputKind of ['obsidian-plugin', 'clickdummy']) {
      const plain = await compileProject({ source: JSON.stringify(document), template, outputKind });
      const opted = await compileProject({ source: JSON.stringify(withAirshipOption(document, { airship: true })), template, outputKind });
      assert.equal(plain.status, 'ok', JSON.stringify(plain.diagnostics));
      assert.equal(opted.status, 'ok', JSON.stringify(opted.diagnostics));
      const get = (result, path) => result.artifacts.find(file => file.path === path)?.content;
      assert.ok(get(plain, 'vite.preview.config.mjs'));
      assert.equal(get(plain, 'airship.config.json'), undefined);
      assert.equal(JSON.parse(get(opted, 'airship.config.json')).safe, true);
      assert.equal(get(plain, 'package-lock.json'), get(opted, 'package-lock.json'));
      assert.equal(get(plain, 'package.json'), get(opted, 'package.json'));
      assert.equal(JSON.parse(get(opted, 'package.json')).dependencies['@airshiplabs/cli'], undefined);
      for (const file of plain.artifacts.filter(file => file.path.startsWith(plain.model.sourceRoot + '/'))) {
        assert.equal(get(opted, file.path), file.content, file.path);
        assert.ok(!file.content.includes('data-v-inspector'), file.path);
      }
    }
  }
});
test('custom source paths survive preview generation and unrelated optional scripts remain unchanged', async () => {
  const document = enabled(); document.settings = { codebaseFolder: 'product source', testsFolder: 'product tests' };
  const original = template.frameworkFiles.find(file => file.path === 'package.json');
  const pkg = JSON.parse(original.content); pkg.scripts.storybook = 'storybook dev -p 6006';
  const enhanced = { ...template, frameworkFiles: template.frameworkFiles.map(file => file === original ? { ...file, content: JSON.stringify(pkg) } : file) };
  const compiled = await compileProject({ source: JSON.stringify(document), template: enhanced });
  assert.equal(compiled.status, 'ok', JSON.stringify(compiled.diagnostics));
  assert.match(compiled.artifacts.find(file => file.path === 'vite.preview.config.mjs').content, /product source\/generated/);
  assert.equal(JSON.parse(compiled.artifacts.find(file => file.path === 'package.json').content).scripts.storybook, pkg.scripts.storybook);
});
test('enable and disable use reviewed plans without installation; stale/foreign config stays untouched', async t => {
  const context = await scratch(t, source);
  const plan = await planOperation(request('airship enable', { agent: 'codex', 'target-port': '6300', port: '6301' }), context);
  assert.equal(plan.summary.installation, 'not-run');
  await applyOperation(plan, context, plan.planHash);
  const config = JSON.parse(await readFile(join(context.root, 'airship.config.json'), 'utf8'));
  assert.deepEqual(config, { target: 6300, port: 6301, host: '127.0.0.1', agent: 'codex', mode: 'canvas', safe: true, commit: false, open: false });
  const off = await executeOperation(request('airship disable', { yes: true }), context);
  assert.equal(off.status, 'applied');
  assert.equal((await executeOperation(request('airship start', { yes: true }), context)).diagnostics[0].code, 'AIRSHIP_DISABLED');
  const stale = await planOperation(request('airship enable'), context);
  await writeFile(join(context.root, 'airship.config.json'), '{"exec":"do not run"}');
  await assert.rejects(() => applyOperation(stale, context, stale.planHash), { code: 'AIRSHIP_CONFIG_CONFLICT' });
  assert.equal(await readFile(join(context.root, 'airship.config.json'), 'utf8'), '{"exec":"do not run"}');
});
test('Airship-edited extension source survives unchanged regeneration; changed generator output conflicts', async t => {
  const document = enabled(), compiled = await compileProject({ source: JSON.stringify(document), template });
  assert.equal(compiled.status, 'ok');
  const vault = await realpath(await mkdtemp(join(tmpdir(), 'airship-owned-')));
  t.after(() => rm(vault, { recursive: true, force: true }));
  const target = join(vault, 'project');
  const file = compiled.artifacts.find(file => file.path.startsWith(compiled.model.sourceRoot) && file.path.endsWith('.vue'));
  const input = { content: Buffer.from(JSON.stringify(document)), vault, target };
  const options = { target: 'project', templateRoot: root };
  let plan = await planArtifacts(options, input, compiled.model, [file]); await applyProject(plan, plan.hash);
  const edited = file.content + '\n<!-- Airship source edit -->\n';
  await writeFile(join(target, file.path), edited);
  plan = await planArtifacts(options, input, compiled.model, [file]);
  assert.deepEqual(plan.conflicts, []); assert.ok(plan.preserved.includes(file.path));
  await applyProject(plan, plan.hash); assert.equal(await readFile(join(target, file.path), 'utf8'), edited);
  const conflict = await planArtifacts(options, input, compiled.model, [{ ...file, content: file.content + '\n<!-- changed model -->' }]);
  assert.ok(conflict.conflicts.some(message => message.includes(file.path)));
  await assert.rejects(() => applyProject(conflict, conflict.hash), /Generation conflicts/);
  assert.equal(await readFile(join(target, file.path), 'utf8'), edited);
});
test('launch is separately approved, local, safe, no-auto-commit and immune to AIRSHIP_* overrides', async t => {
  const context = await scratch(t);
  await writeFile(join(context.root, 'airship.config.json'), JSON.stringify(airshipConfig(enabled().tooling)));
  const base = join(context.root, '.airship-tooling/node_modules/@airshiplabs/cli');
  await mkdir(join(base, 'dist'), { recursive: true });
  await writeFile(join(base, 'package.json'), '{"name":"@airshiplabs/cli","version":"0.3.0","type":"module"}');
  await writeFile(join(base, 'dist/index.js'), 'console.log(JSON.stringify({args:process.argv.slice(2),override:process.env.AIRSHIP_EXEC??null}));');
  const prior = process.env.AIRSHIP_EXEC; process.env.AIRSHIP_EXEC = 'must-not-execute';
  t.after(() => { if (prior === undefined) delete process.env.AIRSHIP_EXEC; else process.env.AIRSHIP_EXEC = prior; });
  const planned = await executeOperation(request('airship start'), context); assert.equal(planned.status, 'planned');
  const launched = await executeOperation(request('airship start', { yes: true }), context);
  assert.equal(launched.status, 'ok', JSON.stringify(launched));
  const recorded = JSON.parse(launched.data.execution.stdout);
  assert.equal(recorded.override, null); assert.ok(recorded.args.includes('--safe')); assert.ok(recorded.args.includes('--no-commit'));
  assert.equal(recorded.args[recorded.args.indexOf('--host') + 1], '127.0.0.1');
  assert.equal(recorded.args[recorded.args.indexOf('--cwd') + 1], context.root);
  assert.deepEqual(airshipEnvironment({ AIRSHIP_EXEC: 'x', AIRSHIP_SAFE: 'false', HOME: 'keep' }), { AIRSHIP_EXEC: undefined, AIRSHIP_SAFE: undefined });
  await writeFile(join(context.root, 'airship.config.json'), '{"safe":false}');
  assert.equal((await executeOperation(request('airship start', { yes: true }), context)).diagnostics[0].code, 'AIRSHIP_CONFIG_CONFLICT');
});
test('new/setup opt-in flags and Airship commands are discoverable; unknown launch flags are rejected', () => {
  assert.equal(parseCliArguments(['new', '../sample', '--starter', 'blank', '--airship']).options.airship, true);
  assert.equal(parseCliArguments(['setup', '--blank', '--no-airship']).options['no-airship'], true);
  assert.equal(parseCliArguments(['airship', 'enable', '--agent', 'codex']).command, 'airship enable');
  assert.throws(() => parseCliArguments(['airship', 'start', '--exec', 'unsafe']));
  assert.throws(() => parseCliArguments(['airship', 'start', '--host', '0.0.0.0']));
});

test('generated preview entry points are analyzed and inert tooling stays inside the authoring boundary', async () => {
  const config = JSON.parse(await readFile(join(root, '.fallowrc.json'), 'utf8'));
  const tools = config.framework.find(item => item.name === 'airship-source-preview-tools');
  assert.equal(tools.entryPointRole, 'support', 'preview/build tools are not plugin production roots');
  for (const entry of ['scripts/airship/preview-config.mjs', 'scripts/airship/qualify.mjs']) {
    assert.ok(tools.entryPoints.includes(entry)); assert.equal(config.entry.includes(entry), false);
  }
  const zone = config.boundaries.zones.find(zone => zone.name === 'companion-authoring-contract');
  for (const file of ['scripts/companion/tooling-contract.mjs', 'scripts/companion/tooling-options.ts']) assert.ok(zone.patterns.includes(file));
  assert.deepEqual(config.boundaries.rules.find(rule => rule.from === zone.name).allow, [zone.name]);
  assert.ok(!config.ignorePatterns.some(pattern => pattern.includes('airship')));
});
