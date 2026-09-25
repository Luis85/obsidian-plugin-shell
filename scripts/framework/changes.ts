import { join, resolve } from 'node:path';
import { createFilePlan } from '../shared/file-plan.mjs';
import { parseCompanionDocument } from '../companion/project-contract.mjs';
import { readCompanionProject } from '../companion/read-project.mjs';
import { projectModel } from '../companion/compiler/model.ts';
import { defaults, configuration, identity, object, configFile, designFile, resolveImport, type Configuration } from './configuration.ts';
import { exists, json, hash, readBounded, readConfiguration, readJson } from './files.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
type Entry = { path: string; content: string };
export async function inspectDesign(context: Context, input: string) {
  requireThat(input !== '-' || context.inputText !== undefined, 'STDIN_REQUIRED', 'Supply JSON on stdin.');
  const source = input === '-'
    ? { content: Buffer.from(context.inputText!), document: parseCompanionDocument(context.inputText!) }
    : await readCompanionProject({ input: resolve(context.root, input), vault: context.root, target: '.' });
  const model = projectModel(source.document);
  return { source, model };
}
async function protectIdentity(context: Context, selected: Configuration) {
  if (!await exists(join(context.root, '.companion/generation.json'))) return;
  const current = object(await readJson(join(context.root, 'manifest.json')));
  requireThat(current.id === selected.project.id && current.version === selected.project.version, 'IDENTITY_MIGRATION_REQUIRED', 'A generated plugin cannot change identity/version through import. Use an explicit migration/release plan.');
  const previous = await readConfiguration(context.root);
  requireThat(!previous || JSON.stringify(previous.paths) === JSON.stringify(selected.paths), 'PATH_MIGRATION_REQUIRED', 'Generated source/test/vault paths cannot be moved by changing configuration.');
}
export async function configurationPlan(request: Request, context: Context) {
  const previous = await readConfiguration(context.root), options = request.options;
  let selected = previous;
  const entries: Entry[] = [];
  if (request.command === 'config set') {
    const path = stringOption(options, 'input'); requireThat(path, 'INPUT_REQUIRED', 'Supply --input <configuration.json>.');
    selected = configuration(path === '-' ? JSON.parse(context.inputText ?? '') : await readJson(resolve(context.root, path)));
  } else if (request.command === 'setup') {
    const project = previous?.project;
    const id = stringOption(options, 'id') ?? project?.id;
    const name = stringOption(options, 'name') ?? project?.name;
    const author = stringOption(options, 'author') ?? project?.author;
    if (id && name && author) {
      selected = defaults(identity({ id, name, author, version: stringOption(options, 'version') ?? project?.version ?? '0.1.0', description: stringOption(options, 'description') ?? project?.description ?? '' }));
      selected.paths = { ...(previous?.paths ?? selected.paths),
        ...(options.source ? { codebaseFolder: stringOption(options, 'source')! } : {}),
        ...(options.tests ? { testsFolder: stringOption(options, 'tests')! } : {}),
        ...(options['test-vault'] ? { testVaultFolder: stringOption(options, 'test-vault')! } : {}),
        ...(options['config-dir'] ? { configDirectory: stringOption(options, 'config-dir')! } : {}) };
      selected = configuration(selected);
    }
  }
  const input = stringOption(options, 'input');
  requireThat(!(input && options.blank), 'SETUP_START_CONFLICT', 'Choose --input or --blank, not both.');
  if ((input || options.blank) && request.command !== 'config set') {
    requireThat(input || selected, 'IDENTITY_REQUIRED', 'Configure identity before creating a blank design.');
    const blank = selected ? json({kind: 'obsidian-companion-project', schemaVersion: 3, executable: false, project: selected.project,
      settings: {codebaseFolder: selected.paths.codebaseFolder, testsFolder: selected.paths.testsFolder}, notes: [], design: {
        schema: 3, blueprint: selected.project.name, goal: selected.project.description, platform: 'desktop', nextId: 2, library: [], prds: [], links: [],
        nodes: [{id: 'node-1', slug: 'main', label: selected.project.name, kind: 'view', parent: null, nav: true, entry: true, command: true, ribbon: false, components: [], goal: ''}],
      }}) : '';
    const { source } = await inspectDesign(input ? context : {...context, inputText: blank}, input ?? '-');
    const resolved = resolveImport(selected, source.document, stringOption(options, 'resolve')); selected = resolved.config;
    entries.push({ path: designFile, content: json(resolved.document) });
    // Original data remains available for review; it carries no execution authority.
    entries.push({ path: '.framework/imported-project.json', content: source.content.toString('utf8') });
  }
  requireThat(selected, 'IDENTITY_REQUIRED', 'Supply --id, --name and --author, or --input <project.json>.');
  if (request.command === 'project import') requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json>.');
  await protectIdentity(context, selected);
  entries.push({ path: configFile, content: json(selected) });
  const tracked = entries.filter(entry => entry.path !== configFile);
  if (tracked.length) {
    const receiptPath = '.framework/intake.json';
    const previousReceipt = await exists(join(context.root, receiptPath)) ? object(await readJson(join(context.root, receiptPath))) : {};
    const old = previousReceipt.files === undefined ? {} : object(previousReceipt.files);
    const before = await createFilePlan(context.root, tracked);
    for (const change of before.changes) requireThat(change.beforeHash === null || change.beforeHash === old[change.path], 'IMPORT_OWNERSHIP', `Preserve edited or foreign design file: ${change.path}. Export/reconcile it before importing.`);
    entries.push({ path: receiptPath, content: json({ schemaVersion: 1, files: Object.fromEntries(tracked.map(entry => [entry.path, hash(entry.content)])) }) });
    const generation = '.companion/generation.json';
    if (await exists(join(context.root, generation))) {
      const previousGeneration = object(await readJson(join(context.root, generation)));
      requireThat(previousGeneration.version === 1 && previousGeneration.projectId === selected.project.id && Array.isArray(previousGeneration.files), 'GENERATION_OWNERSHIP', 'Invalid generation ownership record.');
      const ownedDesigns = previousGeneration.files.map(object).filter(file => file.path === designFile);
      requireThat(ownedDesigns.length === 1 && ownedDesigns[0]!.hash === old[designFile] && ownedDesigns[0]!.ownership === 'managed', 'GENERATION_OWNERSHIP', 'The imported design must match the generation receipt before replacement.');
      ownedDesigns[0]!.hash = hash(tracked.find(entry => entry.path === designFile)!.content);
      entries.push({ path: generation, content: json(previousGeneration) });
    }
  }
  const plan = await createFilePlan(context.root, entries);
  return { plan, summary: { configuration: selected, imported: Boolean(input), blank: options.blank === true, next: 'generate', installation: 'not-run' }, conflicts: [] as string[] };
}
export async function vaultPlan(context: Context) {
  const config = await readConfiguration(context.root); requireThat(config, 'CONFIG_REQUIRED', 'Run setup first.');
  const path = `${config.paths.testVaultFolder}/.framework-vault.json`;
  const content = json({ schemaVersion: 1, projectId: config.project.id, purpose: 'isolated-plugin-testing', configDirectory: config.paths.configDirectory });
  // The legacy writer deliberately protects .dev-vault. Do not weaken its protected-root set.
  requireThat(config.paths.testVaultFolder !== '.dev-vault', 'LEGACY_VAULT', 'Use existing setup --profile native for the protected legacy .dev-vault.');
  const plan = await createFilePlan(context.root, [{ path, content }]);
  requireThat(!plan.changes.some(change => change.status === 'update'), 'VAULT_IDENTITY_CONFLICT', 'Existing test-vault ownership differs.');
  return { plan, summary: { vault: config.paths.testVaultFolder, activation: 'manual', writesBusinessData: false }, conflicts: [] as string[] };
}
export async function releaseVersionPlan(request: Request, context: Context) {
  const version = stringOption(request.options, 'version'), notes = stringOption(request.options, 'notes-file');
  requireThat(version && notes, 'RELEASE_INPUT_REQUIRED', 'Supply --version and --notes-file.');
  const { prepareVersion } = await import('../release/prepare.mjs');
  const prepared = await prepareVersion(context.root, version, (await readBounded(resolve(context.root, notes))).toString('utf8'));
  const config = await readConfiguration(context.root);
  const entries = prepared.plan.changes.map(change => ({ path: change.path, content: change.content }));
  if (config) entries.push({ path: configFile, content: json({ ...config, project: { ...config.project, version } }) });
  const plan = await createFilePlan(context.root, entries);
  for (const change of prepared.plan.changes) requireThat(plan.changes.find(entry => entry.path === change.path)?.beforeHash === change.beforeHash, 'PLAN_STALE', 'Release inputs changed while planning.');
  return { plan, summary: { version, publicActions: false, designVersion: 're-import after release preparation before regenerating' }, conflicts: [] as string[] };
}
