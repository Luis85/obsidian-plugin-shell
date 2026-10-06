import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough, Readable } from 'node:stream';
const { test } = await (process.env.VITEST ? import('vitest') : import('node:test'));
import { makerMain } from '../../src/cli/app.ts';
import { routeArguments } from '../../src/cli/adapters/router.ts';
import { designTemplates } from '../../src/cli/adapters/design-source.ts';
import { renderDesignFolder } from '../../src/cli/application/design-folder.ts';
import { loadGuide } from '../../src/cli/adapters/prototype.ts';
import { prototypeWizard, studio } from '../../src/cli/presentation/studio.ts';
import { projectWizard } from '../../src/cli/presentation/project-wizard.ts';
import { newDocument } from '../../src/cli/domain/document.ts';
import { runOperations } from '../../src/cli/application/operations.ts';
const frameworkRoot = resolve(import.meta.dirname, '../..');
async function scratch(fn) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'design-journey-'));
  try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
function scripted(answers) {
  let cursor = 0; const transcript = [];
  return { transcript, ask: async prompt => { assert.ok(cursor < answers.length, `Missing answer for ${prompt}`); transcript.push(prompt); return answers[cursor++]; },
    write: line => transcript.push(line), done: () => assert.equal(cursor, answers.length) };
}
async function run(argv) {
  const output = new PassThrough(), error = new PassThrough(), chunks = [];
  output.on('data', chunk => chunks.push(chunk));
  const code = await makerMain(argv, frameworkRoot, { input: Readable.from([]), output, error, env: {} });
  return { code, result: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
}
const read = (root, path) => readFile(join(root, path), 'utf8');
test('agents prepare, apply and inspect a design folder through the maker CLI with the reviewed plan hash', async () => scratch(async root => {
  assert.equal(routeArguments(['design', 'status']).surface, 'maker');
  assert.deepEqual(routeArguments(['help', 'design']).args, ['design', '--help']);
  const help = await run(['design', '--help', '--json']);
  assert.match(help.result.data.help, /design prepare --name my-prototype/);
  assert.ok(help.result.data.commands.includes('design'));
  const missing = await run(['design', 'prepare', '--name', 'issue-desk', '--root', root, '--json']);
  assert.deepEqual([missing.code, missing.result.diagnostics[0].code], [1, 'DESIGN_SOURCE_MISSING']);
  const request = join(root, 'request.json');
  await writeFile(request, JSON.stringify({ schemaVersion: 1, title: 'Issue desk', operations: [{ op: 'page.add', title: 'Issues' }] }));
  const saved = await run(['sketch', '--root', root, '--input', request, '--json']);
  await run(['sketch', '--root', root, '--input', request, '--json', '--apply', saved.result.data.planHash]);
  const planned = await run(['design', 'prepare', '--name', 'issue-desk', '--root', root, '--json']);
  assert.deepEqual([planned.code, planned.result.data.status, planned.result.data.folder], [0, 'planned', 'docs/design/issue-desk']);
  await assert.rejects(() => read(root, 'docs/design/issue-desk/AGENTS.md'));
  const refused = await run(['design', 'prepare', '--name', 'issue-desk', '--root', root, '--json', '--apply', 'f'.repeat(64)]);
  assert.deepEqual([refused.code, refused.result.diagnostics[0].code], [1, 'MAKER_APPROVAL']);
  const applied = await run(['design', 'prepare', '--name', 'issue-desk', '--root', root, '--json', '--apply', planned.result.data.planHash]);
  assert.equal(applied.result.data.status, 'applied');
  assert.match(await read(root, 'docs/design/issue-desk/AGENTS.md'), /Issue desk/);
  const status = await run(['design', '--root', root, '--json']);
  assert.deepEqual(status.result.data.folders.map(item => [item.name, item.state]), [['issue-desk', 'current']]);
  const sync = await run(['design', 'sync', '--name', 'issue-desk', '--root', root, '--json']);
  assert.ok(sync.result.data.changes.every(change => change.status === 'unchanged'));
  for (const [argv, code] of [[['design', 'status', '--apply', 'x'], 'DESIGN_OPTION'], [['design', 'publish', '--name', 'x'], 'MAKER_COMMAND'], [['design', 'sync'], 'DESIGN_NAME']]) {
    const failed = await run([...argv, '--root', root, '--json']);
    assert.deepEqual([failed.code, failed.result.diagnostics[0].code], [1, code], argv.join(' '));
  }
}));
test('the prototype guide offers a design folder that follows the prepared package and keeps its brief', { timeout: 180000 }, async () => scratch(async root => {
  const session = scripted(['Issue desk', 'new', 'Issues', 'back', 'save', 'y', 'exit']);
  await studio(session, { root, frameworkRoot, project: 'design/project.json' });
  const guide = await loadGuide();
  const answers = guide.steps.flatMap(step => step.fields).filter(field => !field.when)
    .map(field => field.id === 'title' ? '' : field.kind === 'confirm' ? 'y' : field.kind === 'select' ? String(field.default) : '');
  const wizard = scripted([...answers, 'prepared', 'y', 'y', 'y']);
  const completion = await prototypeWizard(wizard, { root, frameworkRoot, project: 'design/project.json' });
  wizard.done();
  assert.ok(wizard.transcript.some(line => /Create a Claude Design folder at docs\/design\/issue-desk\?/.test(line)));
  assert.match(completion, /Design folder ready: docs\/design\/issue-desk/);
  const manifest = JSON.parse(await read(root, 'docs/design/issue-desk/design.manifest.json'));
  assert.deepEqual([manifest.source.kind, manifest.source.path, manifest.brief], ['project', 'prepared/companion.project.json', { scope: 'root', path: 'prepared/design-brief.md' }]);
  const brief = await read(root, 'docs/design/issue-desk/context/brief.md');
  assert.match(brief, /## Prepared prototype brief/);
  assert.ok(brief.includes((await read(root, 'prepared/design-brief.md')).split('\n').find(line => line.trim() && !line.startsWith('#'))));
  const declined = scripted([...answers, 'second', 'y', 'n']);
  await prototypeWizard(declined, { root, frameworkRoot, project: 'design/project.json' });
  declined.done();
  const studioDesign = scripted(['design', 'y', 'y', 'exit']);
  await studio(studioDesign, { root, frameworkRoot, project: 'design/project.json' });
  studioDesign.done();
  assert.equal(JSON.parse(await read(root, 'docs/design/issue-desk/design.manifest.json')).source.path, 'design/project.json');
}));
test('a new project offers its design folder inside the generated source with the starter target', async () => scratch(async root => {
  const events = [];
  const ui = { ask: async () => { throw new Error('Plain prompt in rich UI.'); }, write: value => events.push(['write', value]), rich: {
    context: () => undefined, busy: () => undefined, review: async label => { events.push(['review', label]); },
    select: async (label, items, initial) => {
      events.push(['select', label]);
      if (label === 'Which project starter do you want to run?') return 'plugin-vanilla';
      if (label.startsWith('Do you agree') || label === 'Apply this reviewed plan?' || label.startsWith('Create a Claude Design folder')) return 'yes';
      return initial || items[0].id;
    },
    multi: async () => { throw new Error('No multi-select expected.'); },
    text: async value => value.title === 'Prototype title' ? 'Field notes' : value.title === 'Project package output folder' ? 'prepared' : value.initial,
  } };
  const completion = await projectWizard(ui, { root, frameworkRoot });
  assert.match(completion, /Design folder ready: docs\/design\/field-notes/);
  const folder = 'prepared/source/docs/design/field-notes';
  const manifest = JSON.parse(await read(root, `${folder}/design.manifest.json`));
  assert.deepEqual([manifest.source.path, manifest.targets, manifest.framework, manifest.brief], ['design/project.json', ['plugin'], 'vanilla', { scope: 'folder', path: 'notes/prototype-brief.md' }]);
  assert.equal(await read(root, `${folder}/notes/prototype-brief.md`), await read(root, 'prepared/design-brief.md'));
  assert.match(await read(root, `${folder}/AGENTS.md`), /plain TypeScript and DOM APIs/);
}));
test('a terminal target gets command-journey guidance and no host tokens', async () => {
  const document = runOperations(newDocument('Ops tool'), [{ op: 'page.add', title: 'Status' }]).document;
  document.design.nodes[0].acceptance = { states: ['default', 'empty'], minWidth: 320, notes: 'Keep  output short.' };
  const { managed } = renderDesignFolder({ name: 'ops-tool', title: 'Ops tool', folder: 'docs/design/ops-tool', sourcePath: 'design/project.json', document,
    brief: '# Brief\n\n## Problem\n\nSlow checks.\n', target: { targets: ['cli'], framework: 'none', source: 'configs/ops-tool-config.json' }, tokens: '{"groups":[{"id":"colors","names":["--text-normal"]}]}', templates: await designTemplates(),
    facts: { sources: [], fingerprint: 'f'.repeat(64), codebase: 'src', tests: 'tests', packageJson: null, layout: [], components: [], libraryUsage: [], tokens: null, origins: new Map(), trace: null, limits: null, docs: [], placement: [] } });
  const files = new Map(managed.map(entry => [entry.path, entry.content]));
  assert.ok(!files.has('context/obsidian-tokens.json'));
  assert.match(files.get('context/design-tokens.md'), /no host token set/);
  assert.doesNotMatch(files.get('context/design-tokens.md'), /--text-normal/);
  assert.match(files.get('AGENTS.md'), /Terminal application: there are no screens/);
  assert.match(files.get('context/brief.md'), /Target: Terminal application\./);
  assert.match(files.get('context/brief.md'), /^### Problem$/m);
  assert.match(files.get('context/screens.md'), /- Acceptance: states default, empty; themes light, dark; minimum width 320px; Keep output short\./);
  const guide = files.get('ENGINEERING_HANDOFF_GUIDE.md');
  assert.match(guide, /Target: Terminal application, frontend `none` \(source: configs\/ops-tool-config\.json\)/);
  assert.match(guide, /5\. Show the success, empty and failure output of every command, and its `--json` form\./);
  assert.match(guide, /6\. Mark repeated regions as named components, so each becomes one small, reusable implementation file\./);
});
