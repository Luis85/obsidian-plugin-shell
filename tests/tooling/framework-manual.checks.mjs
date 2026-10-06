/** Dependency-free documentation contract and writer safety tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildModel, renderReference, renderDiagnostics } from '../../scripts/documentation/render.mjs';
import { synchronize, main, outputs } from '../../scripts/documentation/manual.mjs';
const command = { id: 'sample inspect', summary: 'Inspect the sample.', options: { input: 'value' }, maxArgs: 0, effect: 'read' };
const help = { group: 'inspect', usage: 'node bin/app sample inspect --input sample.json', examples: ['node bin/app sample inspect --input sample.json'], optionHelp: { input: { description: 'Source file.', default: 'sample.json' }, json: { description: 'Structured result.' } } };
const groups = [{ id: 'inspect', title: 'Inspection', commands: ['sample inspect'] }];
function model({ commands = [structuredClone(command)], explain = () => structuredClone(help), grouping = structuredClone(groups), kinds = item => ({ ...item.options, json: 'flag', yes: 'flag' }) } = {}) {
  return buildModel(commands, explain, kinds, grouping, '0.4.0', { EXAMPLE_B: 'Second.', EXAMPLE_A: 'First.' });
}
async function temporary(t) {
  const base = await mkdtemp(join(tmpdir(), 'shell-manual-'));
  t.after(() => rm(base, { recursive: true, force: true })); return base;
}
const folder = base => join(base, 'docs/user-manual/shell-cli/generated');
const files = () => ({ 'reference.md': '# Reference\n', 'diagnostics.md': '# Diagnostics\n', 'commands.json': '{}\n', 'manifest.json': '{}\n' });
test('deterministic model and rendering preserve input objects', () => {
  const before = structuredClone({ command, help, groups });
  const first = model(); assert.deepEqual(first, model());
  assert.equal(renderReference(first), renderReference(model()));
  assert.deepEqual({ command, help, groups }, before);
  assert.deepEqual(first.commands[0].parserOnlyOptions, ['yes']);
  assert.deepEqual(first.diagnostics.map(item => item.id), ['EXAMPLE_A', 'EXAMPLE_B']);
});
test('source defaults and parameter kinds are retained', () => {
  const rendered = renderReference(model());
  assert.match(rendered, /Default: sample.json/); assert.match(rendered, /\| --json \| flag \|/);
  assert.match(rendered, /without documented semantics here: `--yes`/);
  assert.match(rendered, /not proof that a user journey/);
});
test('empty catalogs and unknown effects fail closed', () => {
  assert.throws(() => model({ commands: [] }), /empty command catalog/);
  assert.throws(() => model({ commands: [{ ...command, effect: 'automatic' }] }), /unknown effect/);
});
test('duplicate and colliding command anchors are rejected', () => {
  assert.throws(() => model({ commands: [command, command] }), /duplicate command/);
  assert.throws(() => model({ commands: [command, { ...command, id: 'sample-inspect' }] }), /duplicate command\/anchor/);
});
test('unsafe IDs and invalid positional bounds are rejected', () => {
  assert.throws(() => model({ commands: [{ ...command, id: 'sample <script>' }] }), /unsafe command/);
  assert.throws(() => model({ commands: [{ ...command, maxArgs: -1 }] }), /invalid argument/);
});
test('undocumented new options fail instead of disappearing from the manual', () => {
  assert.throws(() => model({ commands: [{ ...command, options: { ...command.options, added: 'flag' } }] }), /undocumented --added/);
});
test('unknown and empty option documentation is rejected', () => {
  assert.throws(() => model({ explain: () => ({ ...help, optionHelp: { ...help.optionHelp, ghost: { description: 'Ghost' } } }) }), /unknown option --ghost/);
  assert.throws(() => model({ explain: () => ({ ...help, optionHelp: { input: { description: ' ' } } }) }), /undocumented --input/);
});
test('missing usage/examples and summaries fail', () => {
  assert.throws(() => model({ explain: () => ({ ...help, examples: [] }) }), /missing usage\/examples/);
  assert.throws(() => model({ commands: [{ ...command, summary: '' }] }), /missing summary/);
});
test('every command belongs to exactly one agreeing group', () => {
  assert.throws(() => model({ grouping: [] }), /missing\/mismatched group/);
  assert.throws(() => model({ grouping: [...groups, ...groups] }), /multiple groups/);
  assert.throws(() => model({ grouping: [{ ...groups[0], commands: ['missing'] }] }), /unknown command/);
  assert.throws(() => model({ explain: () => ({ ...help, group: 'other' }) }), /missing\/mismatched group/);
});
test('table markup and embedded fences cannot break the reference structure', () => {
  const value = model({ explain: () => ({ ...help, examples: ['echo ```'], optionHelp: { input: { description: '<x>|&\nNext' } } }) });
  const rendered = renderReference(value);
  assert.match(rendered, /&lt;x&gt;&#124;&amp;<br>Next/); assert.match(rendered, /````sh\necho ```\n````/);
  assert.match(renderDiagnostics(value), /EXAMPLE_A[\s\S]*EXAMPLE_B/);
});
test('check-only missing output does not create a directory', async t => {
  const base = await temporary(t); assert.equal((await synchronize(files(), { base, check: true })).length, 4);
  assert.deepEqual(await readdir(base), []);
});
test('generation is idempotent and stale checks do not alter existing files', async t => {
  const base = await temporary(t); assert.equal((await synchronize(files(), { base })).length, 4);
  assert.deepEqual(await synchronize(files(), { base }), []);
  await writeFile(join(folder(base), 'reference.md'), 'drift');
  assert.deepEqual(await synchronize(files(), { base, check: true }), ['reference.md']);
  assert.equal(await readFile(join(folder(base), 'reference.md'), 'utf8'), 'drift');
  assert.deepEqual(await synchronize(files(), { base }), ['reference.md']);
});
test('authored files inside the generated directory are preserved and rejected', async t => {
  const base = await temporary(t); await mkdir(folder(base), { recursive: true });
  await writeFile(join(folder(base), 'my-guide.md'), 'Do not remove');
  await assert.rejects(synchronize(files(), { base }), /MANUAL_UNOWNED_FILE/);
  assert.equal(await readFile(join(folder(base), 'my-guide.md'), 'utf8'), 'Do not remove');
});
test('output contracts reject additional destinations', async t => {
  const base = await temporary(t);
  await assert.rejects(synchronize({ ...files(), '../outside': 'no' }, { base }), /MANUAL_OUTPUT_CONTRACT/);
});
test('symlinked output directories are refused without touching their target', async t => {
  const base = await temporary(t); const outside = await temporary(t);
  try { await symlink(outside, join(base, 'docs'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation unavailable'); return; } throw error; }
  await assert.rejects(synchronize(files(), { base }), /MANUAL_UNSAFE_DIRECTORY/);
  assert.deepEqual(await readdir(outside), []);
});
test('symlinked generated files are refused', async t => {
  const base = await temporary(t); await mkdir(folder(base), { recursive: true });
  const target = join(base, 'keep.md'); await writeFile(target, 'keep');
  try { await symlink(target, join(folder(base), 'reference.md')); }
  catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation unavailable'); return; } throw error; }
  await assert.rejects(synchronize(files(), { base }), /MANUAL_UNSAFE_PATH/);
  assert.equal(await readFile(target, 'utf8'), 'keep');
});
test('unsupported CLI arguments fail before importing framework modules', async () => {
  await assert.rejects(main(['--unknown']), /MANUAL_ARGUMENT/);
  await assert.rejects(main(['--check', '--check']), /MANUAL_ARGUMENT/);
});

test('manual provenance tracks package version while dependency-only updates leave the manual current', async t => {
  const base = await temporary(t);
  const fixtures = {
    'src/cli/adapters/framework/catalog.ts': `export const commands = [${JSON.stringify(command)}]; export const parameterKinds = item => ({ ...item.options, json: 'flag', yes: 'flag' });`,
    'src/cli/adapters/framework/help-text.ts': `export const commandHelp = () => (${JSON.stringify(help)}); export const groups = ${JSON.stringify(groups)};`,
    'src/cli/adapters/framework/increment-catalog.ts': '// catalog input',
    'src/cli/adapters/framework/increment-help.ts': '// help input',
    'src/cli/compiler/domain/diagnostics.ts': 'export const diagnosticCatalog = { EXAMPLE: "Example." };',
    'scripts/documentation/render.mjs': '// renderer input',
    'scripts/documentation/manual.mjs': '// generator input',
  };
  for (const [path, content] of Object.entries(fixtures)) {
    await mkdir(join(base, path, '..'), { recursive: true });
    await writeFile(join(base, path), content);
  }
  const packagePath = join(base, 'package.json');
  await writeFile(packagePath, JSON.stringify({ type: 'module', version: '1.0.0', dependencies: { vue: '3.5.42' } }));
  const initial = await outputs(base);
  await synchronize(initial, { base });
  await writeFile(packagePath, JSON.stringify({ type: 'module', version: '1.0.0', dependencies: { vue: '3.5.43' } }));
  assert.deepEqual(await outputs(base), initial);
  assert.deepEqual(await synchronize(await outputs(base), { base, check: true }), []);
  await writeFile(packagePath, JSON.stringify({ type: 'module', version: '1.0.1' }));
  assert.ok((await synchronize(await outputs(base), { base, check: true })).includes('manifest.json'));
  await writeFile(join(base, 'src/cli/adapters/framework/increment-catalog.ts'), '// changed command catalog');
  assert.notEqual((await outputs(base))['manifest.json'], initial['manifest.json']);
});

test('manual renderer highlights the typed Markdown example without relaxing validation', async () => {
  const config = JSON.parse(await readFile(new URL('../../scripts/documentation/typedoc.json', import.meta.url), 'utf8'));
  const guide = '../../docs/user-manual/shell-cli/application-documentation.md';
  assert.ok(config.projectDocuments.includes(guide), 'Keep the application documentation guide in the rendered handbook.');
  const source = await readFile(new URL(guide, new URL('../../scripts/documentation/', import.meta.url)), 'utf8');
  assert.match(source, /^```markdown$/m, 'Exercise the actual fenced Markdown example.');
  for (const language of ['bash', 'console', 'css', 'html', 'javascript', 'json', 'jsonc', 'json5', 'tsx', 'typescript', 'markdown']) {
    assert.ok(config.highlightLanguages?.includes(language), `Load the ${language} grammar, rather than ignoring its warning.`);
  }
  assert.equal(config.treatWarningsAsErrors, true);
  assert.deepEqual(config.validation, { invalidLink: true, invalidPath: true, notExported: true });
  assert.ok(!config.ignoredHighlightLanguages?.includes('markdown'));
});
