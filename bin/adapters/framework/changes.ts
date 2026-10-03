import { setupSource } from './setup-source.ts';
import { prepareHandout } from './handout-workspace.ts';
import { setupMcpFiles } from '../../../scripts/agent/mcp-config.mjs';
import { withAirshipOption } from '../../../scripts/companion/tooling-options.ts';
import { serializeJson as json } from '../../../scripts/contracts/serialization.ts';
import { join, resolve } from 'node:path';
import { createFilePlan } from '../../../scripts/shared/file-plan.ts';
import { parseAuthoringDocument, AUTHORING_VERSION as COMPANION_VERSION } from '../../../scripts/companion/authoring-contract.ts';
import { readCompanionProject } from './read-project.ts';
import { projectModel } from '../../compiler/emitters/model.ts';
import { defaults, configuration, identity, object, configFile, designFile, resolveImport, type Configuration } from './configuration.ts';
import { exists, hash, readBounded, readConfiguration, readJson } from './files.ts';
import { requireThat, stringOption, type Context, type Request } from './contracts.ts';
type Entry = { path: string; content: string | null };
export async function inspectDesign(context: Context, input: string) {
  requireThat(input !== '-' || context.inputText !== undefined, 'STDIN_REQUIRED', 'Supply JSON on stdin.');
  const source = input === '-'
    ? { content: Buffer.from(context.inputText!), document: parseAuthoringDocument(context.inputText!) }
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
type Options = Request['options'];
const pathOptions = [['source', 'codebaseFolder'], ['tests', 'testsFolder'], ['test-vault', 'testVaultFolder'], ['config-dir', 'configDirectory']] as const;
/** Setup identity from explicit options over any previous configuration; incomplete identity keeps the previous one. */
function setupIdentity(options: Options, project: Configuration['project'] | undefined) {
  const field = (key: 'id' | 'name' | 'author' | 'version' | 'description') => stringOption(options, key) ?? project?.[key];
  return { id: field('id'), name: field('name'), author: field('author'), version: field('version') ?? '0.1.0', description: field('description') ?? '' };
}
function setupConfiguration(options: Options, previous: Configuration | null): Configuration | null {
  const { id, name, author, version, description } = setupIdentity(options, previous?.project);
  if (!(id && name && author)) return previous;
  const selected = defaults(identity({ id, name, author, version, description }));
  const paths = { ...(previous?.paths ?? selected.paths) };
  for (const [option, key] of pathOptions) if (options[option]) paths[key] = stringOption(options, option)!;
  return configuration({ ...selected, paths });
}
async function requestedConfiguration(request: Request, context: Context, previous: Configuration | null): Promise<Configuration | null> {
  if (request.command === 'setup') return setupConfiguration(request.options, previous);
  if (request.command !== 'config set') return previous;
  const path = stringOption(request.options, 'input'); requireThat(path, 'INPUT_REQUIRED', 'Supply --input <configuration.json>.');
  return configuration(path === '-' ? JSON.parse(context.inputText ?? '') : await readJson(resolve(context.root, path)));
}
/** The minimal one-view design a blank setup starts from. */
function blankDesign(selected: Configuration | null): string {
  if (!selected) return '';
  return json({kind: 'obsidian-companion-project', schemaVersion: COMPANION_VERSION, executable: false, project: selected.project,
    settings: {codebaseFolder: selected.paths.codebaseFolder, testsFolder: selected.paths.testsFolder}, notes: [], design: {
      schema: COMPANION_VERSION, blueprint: selected.project.name, goal: selected.project.description, platform: 'desktop', nextId: 2, library: [], prds: [], links: [],
      nodes: [{id: 'node-1', slug: 'main', label: selected.project.name, kind: 'view', parent: null, nav: true, entry: true, command: true, ribbon: false, components: [], goal: ''}],
    }});
}
type Intake = Awaited<ReturnType<typeof setupSource>> | { input: string | undefined; context: Context; origin: null };
/** Imports the supplied or blank design and returns the resolved configuration with the design entries. */
async function designImport(options: Options, intake: Intake, context: Context, selected: Configuration | null): Promise<{ selected: Configuration; entries: Entry[] }> {
  const input = intake.input;
  requireThat(input || selected, 'IDENTITY_REQUIRED', 'Configure identity before creating a blank design.');
  const { source } = await inspectDesign(input ? intake.context : {...context, inputText: blankDesign(selected)}, input ?? '-');
  const resolved = resolveImport(selected, source.document, stringOption(options, 'resolve'));
  return { selected: resolved.config, entries: [
    { path: designFile, content: json(withAirshipOption(resolved.document, options)) },
    // Original data remains available for review; it carries no execution authority.
    { path: '.framework/imported-project.json', content: source.content.toString('utf8') },
  ] };
}
/** Re-owns the design in an existing generation receipt; the old design must match that receipt. */
async function generationEntry(context: Context, selected: Configuration, tracked: Entry[], old: Record<string, unknown>): Promise<Entry | null> {
  const generation = '.companion/generation.json';
  const design = tracked.find(entry => entry.path === designFile && entry.content !== null);
  if (!design || !await exists(join(context.root, generation))) return null;
  const previousGeneration = object(await readJson(join(context.root, generation)));
  requireThat(previousGeneration.version === 1 && previousGeneration.projectId === selected.project.id && Array.isArray(previousGeneration.files), 'GENERATION_OWNERSHIP', 'Invalid generation ownership record.');
  const ownedDesigns = (previousGeneration.files as unknown[]).map(object).filter(file => file.path === designFile);
  requireThat(ownedDesigns.length === 1 && ownedDesigns[0]!.hash === old[designFile] && ownedDesigns[0]!.ownership === 'managed', 'GENERATION_OWNERSHIP', 'The imported design must match the generation receipt before replacement.');
  ownedDesigns[0]!.hash = hash(design.content!);
  return { path: generation, content: json(previousGeneration) };
}
/** Imported files may replace only files this intake previously wrote; the receipt records the new hashes. */
async function ownershipEntries(context: Context, selected: Configuration, tracked: Entry[]): Promise<Entry[]> {
  if (!tracked.length) return [];
  const receiptPath = '.framework/intake.json';
  const previousReceipt = await exists(join(context.root, receiptPath)) ? object(await readJson(join(context.root, receiptPath))) : {};
  const old = previousReceipt.files === undefined ? {} : object(previousReceipt.files);
  const before = await createFilePlan(context.root, tracked);
  for (const change of before.changes) requireThat(change.beforeHash === null || change.beforeHash === old[change.path], 'IMPORT_OWNERSHIP', `Preserve edited or foreign design file: ${change.path}. Export/reconcile it before importing.`);
  const current = { ...old };
  for (const entry of tracked) {
    if (entry.content === null) delete current[entry.path];
    else current[entry.path] = hash(entry.content);
  }
  const receipt = { path: receiptPath, content: json({ schemaVersion: 1, files: current }) };
  const generation = await generationEntry(context, selected, tracked, old);
  return generation ? [receipt, generation] : [receipt];
}
async function managedMcpEnabled(context: Context): Promise<boolean> {
  const receiptPath = '.framework/intake.json';
  if (!await exists(join(context.root, receiptPath))) return false;
  const receipt = object(await readJson(join(context.root, receiptPath)));
  const owned = receipt.files === undefined ? {} : object(receipt.files);
  const probe = await createFilePlan(context.root, setupMcpFiles().map(file => ({ path: file.path, content: null })));
  return probe.changes.every(change => change.beforeHash !== null && owned[change.path] === change.beforeHash);
}
/** Setup writes the local Workbench MCP files on --mcp (with a bin/app launcher) and removes them on --no-mcp. */
async function mcpEntries(request: Request, context: Context): Promise<Array<{ path: string; content: string | null }>> {
  if (request.command !== 'setup') return [];
  if (request.options.mcp === true) {
    requireThat(await exists(join(context.root, 'bin/app')), 'MCP_SERVER_MISSING', 'This project has no bin/app launcher for the local Workbench MCP.');
    return setupMcpFiles();
  }
  return request.options['no-mcp'] === true ? setupMcpFiles().map(file => ({ path: file.path, content: null })) : [];
}
/** Without either flag setup preserves an already managed configuration. */
function agentMcpSummary(options: Options, priorMcp: boolean) {
  const action = options.mcp === true ? 'enable' : options['no-mcp'] === true ? 'disable' : 'preserve';
  const enabled = action === 'enable' || (action === 'preserve' && priorMcp);
  return { enabled, action, clients: enabled ? ['claude-code', 'codex'] : [] };
}
function checkStartOptions(options: Options, input: string | undefined): void {
  requireThat(!(options.airship || options['no-airship']) || input || options.blank, 'AIRSHIP_DESIGN_REQUIRED', 'Use --input/--starter/--blank, or airship enable/disable on an existing design.');
  requireThat(!(input && options.blank), 'SETUP_START_CONFLICT', 'Choose --input or --blank, not both.');
}
export async function configurationPlan(request: Request, context: Context) {
  const previous = await readConfiguration(context.root), options = request.options;
  requireThat(!(options.mcp && options['no-mcp']), 'MCP_OPTION_CONFLICT', 'Choose --mcp or --no-mcp, not both.');
  let selected = await requestedConfiguration(request, context, previous);
  const entries: Entry[] = [];
  const intake: Intake = request.command === 'setup' ? await setupSource(request, context, selected) : { input: stringOption(options, 'input'), context, origin: null };
  const input = intake.input;
  checkStartOptions(options, input);
  if ((input || options.blank) && request.command !== 'config set') {
    const design = await designImport(options, intake, context, selected);
    selected = design.selected; entries.push(...design.entries);
  }
  requireThat(selected, 'IDENTITY_REQUIRED', 'Supply --id, --name and --author, or --input <project.json>.');
  if (request.command === 'project import') requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json>.');
  await protectIdentity(context, selected);
  const priorMcp = request.command === 'setup' ? await managedMcpEnabled(context) : false;
  entries.push(...await mcpEntries(request, context));
  entries.push({ path: configFile, content: json(selected) });
  entries.push(...await ownershipEntries(context, selected, entries.filter(entry => entry.path !== configFile)));
  // A created handout becomes human-owned; keep it outside the intake ownership receipt.
  if (request.command === 'setup') entries.push(...(await prepareHandout(context.root, { virtualFiles: { [configFile]: json(selected) } })).entries);
  const plan = await createFilePlan(context.root, entries);
  return { plan, summary: { configuration: selected, imported: Boolean(input) && intake.origin === null, starter: intake.origin, blank: options.blank === true,
    agentMcp: agentMcpSummary(options, priorMcp), next: 'generate', installation: 'not-run' }, conflicts: [] as string[] };
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
  const { prepareVersion } = await import('../../../scripts/release/prepare.mjs');
  const prepared = await prepareVersion(context.root, version, (await readBounded(resolve(context.root, notes))).toString('utf8'));
  const config = await readConfiguration(context.root);
  const entries = prepared.plan.changes.map((change: { path: string; content: string | null }) => ({ path: change.path, content: change.content }));
  if (config) entries.push({ path: configFile, content: json({ ...config, project: { ...config.project, version } }) });
  const plan = await createFilePlan(context.root, entries);
  for (const change of prepared.plan.changes) requireThat(plan.changes.find(entry => entry.path === change.path)?.beforeHash === change.beforeHash, 'PLAN_STALE', 'Release inputs changed while planning.');
  return { plan, summary: { version, publicActions: false, designVersion: 're-import after release preparation before regenerating' }, conflicts: [] as string[] };
}