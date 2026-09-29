import { lstat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { createFilePlan } from '../../scripts/shared/file-plan.mjs';
import { hash } from '../../scripts/framework/files.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { resolveProjectSelection } from '../../scripts/compiler/domain/project-presets.ts';
import { newDocument, openDocument, documentText } from '../domain/document.ts';
import { object, keys, text, list } from '../domain/data.ts';
import { requireSketch } from '../domain/errors.ts';
import { settingsPath, setupStatePath, readSettings } from '../domain/user-settings.ts';
import { runOperations } from '../application/operations.ts';
import { outline } from '../application/summary.ts';
import { prepared, type Prepared, type Entry } from './storage.ts';
import { loadSettings, guardedText, jsonText } from './user-settings.ts';
import { loadProjectCatalog, projectGuide } from './projects.ts';
import { prototypePlan } from './prototype.ts';
import { boilerplatePlan } from './compiler.ts';
import { intakePrds, type Intake } from './prd-intake.ts';
export { setupSchema, setupExample } from '../application/setup-schema.ts';
interface SetupContext { root: string; frameworkRoot: string; signal?: AbortSignal }
export async function angularSetupGuide() {
  const catalog = await loadProjectCatalog();
  const selection = resolveProjectSelection(catalog, { schemaVersion: 1, catalogVersion: catalog.version, preset: 'webapp-vanilla', framework: 'angular' });
  return { selection, guide: await projectGuide(selection, catalog) };
}
/** A vault directory is verifiable; an open Obsidian session is not inferred. */
export async function setupPrerequisites(root: string) {
  await createFilePlan(root, []);
  for (const name of ['.git', '.obsidian']) {
    let info;
    try { info = await lstat(join(root, name)); }
    catch { requireSketch(false, 'SETUP_PREREQUISITE', `Open this project as an Obsidian vault and initialize Git first (missing ${name}).`); }
    requireSketch(!info.isSymbolicLink() && (info.isDirectory() || (name === '.git' && info.isFile())), 'SETUP_PREREQUISITE', 'Git/vault roots cannot be symbolic links.');
  }
  const git = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', timeout: 3000, windowsHide: true });
  requireSketch(git.status === 0 && resolve(git.stdout.trim()) === resolve(root), 'SETUP_GIT_ROOT', 'The selected vault must itself be the Git working-tree root.');
  return { git: 'existing', vault: 'configured', obsidianSession: 'not-inspected' };
}
export async function setupStatus(root: string) {
  const { settings } = await loadSettings(root), state = await guardedText(root, setupStatePath);
  return { settings, state: state.content === null ? null : parseJsonData(state.content),
    next: state.content ? ['sketch show', 'sketch', 'sketch generate'] : ['project-setup'],
    installed: 'not-inspected', built: 'not-inspected', runtime: 'not-inspected' };
}
function request(input: unknown) {
  const raw = object(input); keys(raw, ['schemaVersion', 'settings', 'project', 'prds', 'prototypeInterview', 'operations', 'boilerplate']);
  requireSketch(raw.schemaVersion === 1, 'SETUP_VERSION', 'Expected setup schemaVersion 1.');
  const project = object(raw.project); keys(project, ['name', 'description', 'product']);
  requireSketch(typeof raw.boilerplate === 'boolean' && raw.prototypeInterview !== undefined, 'SETUP_CHOICE', 'Explicitly choose boilerplate true/false and prototype answers/null.');
  return { schemaVersion: 1, settings: raw.settings, project: { name: text(project.name, 'name', 80),
    description: text(project.description, 'description', 400), product: text(project.product, 'product', 1000) },
    prds: object(raw.prds), prototypeInterview: raw.prototypeInterview, operations: list(raw.operations, 'operations', 500), boilerplate: raw.boilerplate };
}
function intakeIdentity(value: Intake): string {
  return hash(jsonText({ prds: value.prds, guards: value.guards, imports: value.imports, ignored: value.ignored }));
}
function entriesFrom(value: Prepared): Entry[] {
  return value.plan.changes.map(change => {
    requireSketch(change.content !== null, 'SETUP_PLAN', 'Setup never deletes files.');
    return { path: change.path, content: change.content, ...(change.encoding ? { encoding: change.encoding } : {}) };
  });
}
/** Optional prototype, bricks and final compilation compose one reviewed plan, not a second generator. */
export async function projectSetupPlan(context: SetupContext, input: unknown): Promise<Prepared> {
  const { root, frameworkRoot, signal } = context;
  requireSketch(!signal?.aborted, 'CANCELLED', 'Setup cancelled.');
  const prerequisites = await setupPrerequisites(root), data = request(input);
  const current = await loadSettings(root), settings = data.settings === undefined ? current.settings : readSettings(data.settings, current.settings);
  const existingState = await guardedText(root, setupStatePath);
  const requestHash = hash(jsonText(data));
  if (existingState.content !== null) {
    const state = object(parseJsonData(existingState.content));
    requireSketch(jsonText(readSettings({ schemaVersion: 1, paths: state.paths }).paths) === jsonText(settings.paths), 'SETUP_PATH_MIGRATION', 'Setup paths changed. Move/reconcile files explicitly before changing the saved path configuration.');
    requireSketch(state.schemaVersion === 1 && state.requestHash === requestHash, 'SETUP_EXISTS', 'Setup already exists. Use sketch to continue editing or project-setup status; changed setup requests do not replace existing projects.');
  }
  const intake = await intakePrds(root, settings, data.prds), intakeHash = intakeIdentity(intake);
  const { selection, guide } = await angularSetupGuide();
  let document = newDocument(data.project.name);
  document.project.description = data.project.description;
  document.project.author = settings.preferences.author;
  document.design.goal = data.project.product;
  document.design.prds = intake.prds;
  document = runOperations(document, [{ op: 'page.add', title: 'Hello world', as: 'hello' },
    { op: 'sitemap.route', page: '@hello', path: '/' }]).document;
  const packages: Prepared[] = [];
  if (data.prototypeInterview !== null) {
    const prototype = await prototypePlan({ ...context, out: settings.paths.prototypes, guide, input: data.prototypeInterview, baseline: document, selection });
    document = openDocument(prototype.data.document); packages.push(prototype);
  }
  document = runOperations(document, data.operations).document;
  if (data.boilerplate) packages.push(await boilerplatePlan(root, frameworkRoot, settings.paths.app, document, 'project', signal, selection));
  const brief = `---\ntype: project-brief\nproject: ${document.project.id}\n---\n\n# ${data.project.name}\n\n## Project\n\n${data.project.description}\n\n## Product\n\n${data.project.product}\n\n## Sources\n\n${intake.prds.map(prd => '- ' + prd.source.path + ' (' + prd.source.sha256 + ')').join('\n')}\n\nPRDs were imported verbatim. Requirements have not been mapped or implemented by setup.\n`;
  const owned: Entry[] = [
    { path: settings.paths.project, content: documentText(document) },
    { path: 'project.config.json', content: jsonText(selection) },
    { path: settings.paths.brief, content: brief },
  ];
  const ownerPlan = await createFilePlan(root, owned);
  for (const change of ownerPlan.changes) requireSketch(change.beforeHash === null || (existingState.content !== null && change.status === 'unchanged'), 'SETUP_FILE_CONFLICT', 'Setup preserves existing project/brief files: ' + change.path);
  const imports = await createFilePlan(root, intake.imports);
  for (const change of imports.changes) requireSketch(change.status === 'create' || change.status === 'unchanged', 'PRD_FILE_CONFLICT', 'Import will not replace an existing PRD: ' + change.path);
  const state = { schemaVersion: 1, requestHash, phase: 'prepared', selection, paths: settings.paths,
    prototypePrepared: data.prototypeInterview !== null, boilerplatePrepared: data.boilerplate, prds: intake.prds.map(prd => ({ id: prd.id, ...prd.source })),
    installed: false, built: false, runtimeAccepted: false, businessImplemented: false };
  const entries = [...intake.guards, ...intake.imports, ...owned,
    { path: settingsPath, content: jsonText(settings) }, { path: setupStatePath, content: jsonText(state) }, ...packages.flatMap(entriesFrom)];
  const plan = await createFilePlan(root, entries);
  for (const guard of intake.guards) requireSketch(plan.changes.find(change => change.path === guard.path)?.beforeHash === hash(guard.content), 'MAKER_STALE', 'A PRD source changed during planning.');
  for (const previous of [ownerPlan, imports, ...packages.map(pkg => pkg.plan)]) for (const before of previous.changes)
    requireSketch(plan.changes.find(change => change.path === before.path)?.beforeHash === before.beforeHash, 'MAKER_STALE', 'Files changed while composing setup.');
  requireSketch(plan.changes.find(change => change.path === settingsPath)?.beforeHash === current.beforeHash && plan.changes.find(change => change.path === setupStatePath)?.beforeHash === existingState.beforeHash, 'MAKER_STALE', 'Settings or setup state changed during planning.');
  const result = prepared(plan, { settings, prerequisites, selection, document, outline: outline(document), prds: state.prds,
    ignoredMarkdown: intake.ignored, phase: 'prepared', prototypePrepared: state.prototypePrepared, boilerplatePrepared: state.boilerplatePrepared,
    installed: false, built: false, runtimeAccepted: false, businessImplemented: false,
    start: data.boilerplate ? { cwd: settings.paths.app, commands: [['npm', 'install'], ['npm', 'run', 'typecheck'], ['npm', 'test'], ['npm', 'start']] } : null,
    next: 'Use shell.mjs sketch to edit bricks. Dependencies, builds and application startup require explicit separate commands.' }, { requestHash, intakeHash });
  return { ...result, validate: async () => {
    await setupPrerequisites(root);
    requireSketch(intakeIdentity(await intakePrds(root, settings, data.prds)) === intakeHash, 'SETUP_STALE_PRDS', 'PRD inventory changed after preview; review setup again.');
  } };
}
