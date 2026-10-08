import assert from 'node:assert/strict';
import { mkdtemp, realpath, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { hash } from '../../adapters/framework/files.ts';
import { mapBounded } from '#shared/platform/bounded-map.ts';
import { loadTemplateSnapshot } from '../../compiler/index.ts';
import { newDocument, documentText } from '../../domain/document.ts';
import { runOperations } from '../../application/operations.ts';
import { applyOperation, planOperation } from '../../adapters/framework/planning.ts';
import { Back } from '#tui/prompts.ts';

export const frameworkRoot = resolve(import.meta.dirname, '../../../..');
export const BACK = Symbol('back');
export const captureRequest = { schemaVersion: 1, name: 'Capture inbox', purpose: 'Quickly capture and inspect ideas',
  actors: ['Member'], entities: ['Capture'], acceptance: ['A saved capture can be reopened'],
  pages: [
    { title: 'Inbox', kind: 'view', purpose: 'Review captured ideas',
      interactions: [{ kind: 'navigate', label: 'Open details', target: 'Details' },
        { kind: 'action', label: 'Save capture', outcome: 'Persist after validation' }] },
    { title: 'Details', kind: 'page', purpose: 'Inspect a selected capture', interactions: [] },
  ], output: 'definition', verification: 'none' };

/**
 * Isolated maker workspace. `configured` seeds the project through the real
 * `project import` operation so concept import owns design/project.json.
 */
export async function brainstormScratch(fn, { configured = false, project = true } = {}) {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'maker-brainstorm-'));
  const options = { root, frameworkRoot, project: 'design/project.json', input: Readable.from([]) };
  try {
    const document = configured ? runOperations(newDocument('Capture project'), [{ op: 'page.add', title: 'Home' }]).document
      : newDocument('Capture project');
    if (configured) {
      await writeFile(join(root, 'seed.json'), documentText(document));
      const seeded = await planOperation({ command: 'project import', args: [], options: { input: 'seed.json' } }, options);
      await applyOperation(seeded, options, seeded.planHash);
    } else if (project) {
      await mkdir(join(root, 'design'));
      await writeFile(join(root, 'design/project.json'), documentText(document));
    }
    await fn(options, document);
  } finally { await rm(root, { recursive: true, force: true }); }
}
export const readText = (root, path) => readFile(join(root, path), 'utf8');
export const readScratchJson = async (root, path) => JSON.parse(await readText(root, path));
export async function writeJson(root, path, value) {
  await writeFile(join(root, path), JSON.stringify(value, null, 2) + '\n');
}

/**
 * Controlled local npm-cli.js child selected through QUALIFIED_NPM (the same
 * selection path as the qualified toolchain). It records each invocation outside
 * the generated source; it is not a registry install or a generated-project test.
 */
export async function fakeNpm(root, { version = '11.19.1', fail = '' } = {}) {
  const folder = join(root, 'fake-npm'), log = join(folder, 'calls.log');
  await mkdir(join(folder, 'bin'), { recursive: true });
  await writeFile(join(folder, 'package.json'), JSON.stringify({ version, type: 'module' }));
  const entry = join(folder, 'bin/npm-cli.js');
  const write = async suffix => writeFile(entry, `import { appendFile, mkdir, writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
await appendFile(${JSON.stringify(log)}, JSON.stringify({ cwd: process.cwd(), args, ci: process.env.CI }) + '\\n');
console.log('FAKE_NPM ' + args.join(' '));
if (args[0] === 'ci') { await mkdir('node_modules', { recursive: true }); await writeFile('node_modules/.installed', 'fixture'); }
if (args[1] === ${JSON.stringify(fail)}) process.exit(3);
${suffix}`);
  await write('');
  const previous = process.env.QUALIFIED_NPM;
  process.env.QUALIFIED_NPM = entry;
  return {
    entry,
    async calls() {
      try { return (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
      catch (error) { if (error?.code === 'ENOENT') return []; throw error; }
    },
    /** Changing executable bytes after approval must invalidate the reviewed plan. */
    tamper: () => write('// changed after approval\n'),
    /** A timed-out test's body keeps running; its late restore must not clear a later test's own fake. */
    restore() {
      if (process.env.QUALIFIED_NPM !== entry) return;
      if (previous === undefined) delete process.env.QUALIFIED_NPM; else process.env.QUALIFIED_NPM = previous;
    },
  };
}

/**
 * Updates one generated file and re-binds its ownership receipt and definition,
 * producing a self-consistent package so later validation stages are reachable.
 */
export async function resign(root, out, mutate) {
  const receiptPath = out + '/source/.maker/receipt.json';
  const receipt = await readScratchJson(root, receiptPath);
  const changed = await mutate(receipt);
  for (const path of changed ?? []) {
    const row = receipt.files.find(item => item.path === path);
    row.sha256 = hash(await readFile(join(root, out, 'source', path)));
  }
  const text = JSON.stringify(receipt) + '\n';
  await writeFile(join(root, receiptPath), text);
  const definition = await readScratchJson(root, out + '/feature.definition.json');
  definition.generatedSource.receiptSha256 = hash(text);
  await writeJson(root, out + '/feature.definition.json', definition);
}

/**
 * Pins the generated source's `.nvmrc` to the running Node through the reviewed
 * re-signing path, so verification plans carry no Node blocker on any toolchain
 * row (as the first-run fixture app does). No-op when the pin already matches.
 */
export async function pinGeneratedNode(root, out) {
  const path = join(root, out, 'source/.nvmrc');
  if ((await readFile(path, 'utf8')).trim() === process.versions.node) return;
  await resign(root, out, async () => { await writeFile(path, process.versions.node + '\n'); return ['.nvmrc']; });
}
/**
 * Materializes the exact framework template snapshot under the scratch root with
 * its `.nvmrc` pinned to the running Node. Generated prototype source copies that
 * pin, so a wizard flow that generates and then offers its run can execute on
 * every toolchain row. The repository template itself is never changed.
 */
export async function pinnedFramework(root) {
  const target = join(root, 'pinned-framework'), snapshot = await loadTemplateSnapshot(frameworkRoot);
  const files = [...snapshot.frameworkFiles, ...snapshot.skillFiles];
  // Each folder is created once, then the same bytes are written with bounded parallelism instead of one by one.
  for (const folder of new Set(files.map(file => dirname(join(target, file.path))))) await mkdir(folder, { recursive: true });
  await mapBounded(files, 16, file => writeFile(join(target, file.path), Buffer.from(file.content, file.encoding ?? 'utf8')));
  await writeFile(join(target, '.nvmrc'), process.versions.node + '\n');
  return target;
}

/** One-screen feature with no interactions; `extra` overrides or extends the scripted answers. */
export function quickNote(extra = {}) {
  return { 'Brainstorm': ['feature'], 'What is the name of the new feature?': ['Quick note'],
    'What problem does this feature solve': ['Capture a note'], 'Who will use or interact with it?': [''],
    'Which actors/entities or business objects are involved?': [''], 'Main feature view title': ['Notes'],
    'What does the user accomplish on ': ['Write notes'], 'Feature screens': ['done'], 'Interactions on ': ['done'],
    'How will you recognize the feature as useful and correct?': [''], 'What should be prepared?': ['definition'],
    'Continue to the reviewed file plan?': ['yes'], 'Apply this reviewed plan?': ['yes'], ...extra };
}
function pick(answers, title) {
  const key = Object.keys(answers).filter(item => title.startsWith(item)).sort((a, b) => b.length - a.length)[0];
  assert.ok(key !== undefined, 'Unexpected prompt: ' + title);
  assert.ok(answers[key].length, 'No scripted answer left for: ' + title);
  const value = answers[key].shift();
  if (value === BACK) throw new Back();
  return value;
}
/**
 * Scripted rich terminal: every prompt must be answered by title (longest prefix),
 * validators run like the real TerminalSession (invalid values are rejected and
 * the next scripted value is read), and unused answers are reported by `left`.
 */
export function scriptedRich(answers) {
  const events = [], contexts = [], reviews = [], writes = [], rejected = [];
  const ui = {
    ask: async question => { throw new Error('Plain prompt in rich UI: ' + question); },
    write: value => writes.push(value),
    rich: {
      context: value => contexts.push(value), busy: value => events.push(['busy', value]),
      async select(title, items, initial) {
        events.push(['select', title, items.map(item => item.id), initial]);
        const value = pick(answers, title);
        const chosen = value === undefined ? initial : value;
        assert.ok(items.some(item => item.id === chosen), 'Unavailable choice ' + chosen + ' for ' + title);
        return chosen;
      },
      async multi() { throw new Error('Brainstorm does not use multi-select.'); },
      async text(request) {
        events.push(['text', request.title, request.initial, Boolean(request.multiline)]);
        while (true) {
          const scripted = pick(answers, request.title), value = scripted === undefined ? request.initial : scripted;
          const error = request.validate?.(value);
          if (!error) return value;
          rejected.push([request.title, error]);
        }
      },
      async review(title, sections) { events.push(['review', title]); reviews.push({ title, sections }); },
    },
  };
  const left = () => Object.entries(answers).filter(([, queue]) => queue.length).map(([key]) => key);
  return { ui, events, contexts, reviews, writes, rejected, left, output: () => writes.join('') };
}
/** Line-mode prompts answer strictly in order and record every question shown. */
export function scriptedPlain(lines) {
  const questions = [], writes = [];
  const ui = {
    ask: async question => {
      questions.push(question);
      assert.ok(lines.length, 'No scripted line left for: ' + question);
      return lines.shift();
    },
    write: value => writes.push(value),
  };
  return { ui, questions, writes, output: () => writes.join(''), left: () => lines.length };
}
