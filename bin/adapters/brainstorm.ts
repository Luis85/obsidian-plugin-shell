import { join } from 'node:path';
import { parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { hash, readBounded } from '../../scripts/framework/files.ts';
import { readInput } from '../../scripts/framework/input.ts';
import { runNode } from '../../scripts/framework/process.ts';
import { createFilePlan } from '../../scripts/shared/file-plan.mjs';
import { firstRunInventory } from './first-run-inventory.ts';
import { firstRunTool } from './first-run-plan.ts';
import { compile } from './compiler.ts';
import { savedProjectSelection } from './project-selection.ts';
import { outputBoundary } from './package-plan.ts';
import { readData, readSnapshot, prepared, applyPrepared, type Entry, type Prepared } from './storage.ts';
import { object, text } from '../domain/data.ts';
import { requireSketch, slug } from '../domain/errors.ts';
import { documentText } from '../domain/document.ts';
import { brainstormGuide, brainstormSchema, featureConcept, readFeatureBrainstorm, type FeatureBrainstorm } from '../domain/brainstorm.ts';
import { projectPath } from '../domain/user-settings.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import type { CommandContext } from './commands.ts';

export interface BrainstormOptions extends Omit<CommandContext, 'input'> {
  project: string; out?: string; input?: CommandContext['input'];
}
type ProcessContext = Omit<CommandContext, 'input'>;
export interface BrainstormVerificationPlan {
  root: string; out: string; source: string; planHash: string;
  requested: 'test' | 'test-build'; inventory: { path: string; sha256: string }[];
  definitionHash: string; tool: Awaited<ReturnType<typeof firstRunTool>>;
  expected: { node: string; npm: string }; blockers: string[]; steps: { label: string; args: string[] }[];
  effects: string[];
}
function sourcePath(out: string): string {
  return projectPath(out + '/source');
}
function outputFolder(request: FeatureBrainstorm, proposed?: string): string {
  return projectPath(proposed || 'brainstorms/' + slug(request.name, 'feature'));
}
function summary(document: { project: { id: string; name: string }; design: { nodes: unknown[]; links: unknown[]; features?: { items: unknown[] } } }) {
  return { project: document.project, surfaces: document.design.nodes.length,
    transitions: document.design.links.length, features: document.design.features?.items.length ?? 0 };
}
async function base(options: BrainstormOptions) {
  const snapshot = await readSnapshot(options.root, options.project);
  requireSketch(snapshot.document && snapshot.beforeHash, 'BRAINSTORM_PROJECT_REQUIRED',
    'Save an existing project before brainstorming a feature; project brainstorming is planned separately.');
  return { document: snapshot.document, sha256: snapshot.beforeHash };
}
export async function brainstormContext(options: BrainstormOptions) {
  const current = await base(options);
  return { projectPath: options.project, project: current.document.project, baseSha256: current.sha256,
    pages: current.document.design.nodes.map(node => ({ id: node.id, title: node.label, kind: node.kind })),
    features: current.document.design.features?.items.map(item => ({ id: item.id, name: item.name })) ?? [],
    note: 'The exact baseSha256 can be included in an agent-generated brainstorm request to reject stale input.' };
}
async function validateBrainstormFeature(input: unknown, options: BrainstormOptions) {
  const current = await base(options), request = readFeatureBrainstorm(input);
  const result = featureConcept(request, current);
  return { ready: true, request, definition: result.definition, concept: result.concept,
    candidate: summary(result.candidate), mapping: result.mapping };
}
type CompilerArtifact = Awaited<ReturnType<typeof compile>>['artifacts'][number];
function artifactEncoding(item: CompilerArtifact): 'base64' | undefined {
  const encoding = 'encoding' in item ? item.encoding : undefined;
  requireSketch(encoding === undefined || encoding === 'utf8' || encoding === 'base64',
    'BRAINSTORM_ENCODING', 'Unsupported compiler artifact encoding.');
  return encoding === 'base64' ? encoding : undefined;
}
function artifactBytes(item: CompilerArtifact): Buffer {
  return Buffer.from(item.content, artifactEncoding(item) ?? 'utf8');
}
function artifactEntry(out: string, item: CompilerArtifact): Entry {
  const encoding = artifactEncoding(item);
  return { path: sourcePath(out) + '/' + item.path, content: item.content, ...(encoding ? { encoding } : {}) };
}
async function generatedEntries(request: FeatureBrainstorm, result: ReturnType<typeof featureConcept>,
  options: BrainstormOptions, out: string): Promise<{ entries: Entry[]; compiler: Record<string, unknown> | null }> {
  if (request.output === 'definition') return { entries: [], compiler: null };
  const selection = await savedProjectSelection(options.root);
  const kind = request.output === 'prototype' ? 'clickdummy' : selection ? 'project' : 'obsidian-plugin';
  const selected = kind === 'obsidian-plugin' ? undefined : selection;
  const emitted = await compile(result.candidate, options.frameworkRoot, kind, options.signal, selected);
  const compiler = { outputKind: kind, fingerprint: emitted.compilation.fingerprint,
    readiness: emitted.compilation.readiness, artifacts: emitted.artifacts.length };
  const owned = emitted.artifacts.map(item => ({ path: item.path, sha256: hash(artifactBytes(item)) }));
  const entries = emitted.artifacts.map(item => artifactEntry(out, item));
  entries.push({ path: sourcePath(out) + '/.maker/receipt.json',
    content: JSON.stringify({ schemaVersion: 1, files: owned }, null, 2) + '\n' });
  return { entries, compiler };
}
/**
 * Prepare an immutable concept handoff, an inspectable definition, and optionally
 * compiler-generated source. Import and execution remain separate user decisions.
 * Every output is create-only (or byte-identical), never an implicit regeneration.
 */
export async function brainstormFeaturePlan(input: unknown, options: BrainstormOptions): Promise<Prepared> {
  const current = await base(options), request = readFeatureBrainstorm(input);
  const result = featureConcept(request, current), out = outputFolder(request, options.out);
  outputBoundary(options.root, options.frameworkRoot, out);
  const conceptPath = 'docs/concepts/brainstorms/' + String(result.definition.featureId) + '.json';
  const entries: Entry[] = [
    { path: out + '/feature.definition.json', content: JSON.stringify(result.definition, null, 2) + '\n' },
    { path: out + '/candidate.project.json', content: documentText(result.candidate) },
    { path: conceptPath, content: JSON.stringify(result.concept, null, 2) + '\n' },
  ];
  const generated = await generatedEntries(request, result, options, out);
  entries.push(...generated.entries);
  const prompt = handoff(request, out, conceptPath, result.mapping, generated.compiler);
  entries.push({ path: out + '/README.md', content: prompt });
  const plan = await createFilePlan(options.root, entries);
  requireSketch(plan.changes.every(change => change.status === 'create' || change.status === 'unchanged'),
    'BRAINSTORM_OUTPUT_EXISTS', 'An existing brainstorm or source file differs. Preserve it and choose a different --out or feature ID.');
  const detail = { definition: result.definition, conceptPath, candidatePath: out + '/candidate.project.json',
    output: out, compiler: generated.compiler, verification: request.verification,
    generated: request.output !== 'definition', imported: false, executed: false,
    prompt, document: result.candidate };
  return prepared(plan, detail, { base: current.sha256, project: current.document.project.id, request });
}
function handoff(request: FeatureBrainstorm, out: string, conceptPath: string,
  mapping: { title: string; surfaceId: string; route: string | null }[], compiler: Record<string, unknown> | null): string {
  return [
    '# ' + request.name + ' — brainstorm handoff', '', request.purpose, '',
    'Status: draft. No source code, tests or feature acceptance are implied by this definition.', '',
    '## Canonical handoff',
    '- Feature definition: ' + out + '/feature.definition.json',
    '- Canonical candidate project: ' + out + '/candidate.project.json',
    '- Additive, exact-base feature concept: ' + conceptPath, '',
    '## Feature surfaces',
    ...mapping.map(item => '- ' + item.title + ': ' + item.surfaceId + (item.route ? ' (' + item.route + ')' : ' (dialog)')), '',
    'Actors/entities and acceptance criteria remain planning information; use the canonical semantic, requirement and visual editors to refine them.',
    'Sitemap transitions describe intended navigation and do not prove executable page events.', '',
    '## Import (independent review and approval)',
    '1. Inspect the concept: node shell.mjs concept inspect --input ' + conceptPath + ' --json',
    '2. Review the separate import plan: node shell.mjs concept import --input ' + conceptPath + ' --json',
    '3. If approved, repeat the import command with --apply <fresh-planHash> --json.',
    'Use the configured project importer. If this root is an unconfigured maker workspace, configure a project before importing.', '',
    '## Generated source',
    compiler ? '- Generated source: ' + out + '/source (full-project compiler output, not scoped native acceptance).' :
      '- No source was requested. Use a new reviewed brainstorm or the existing shell generator after importing the feature.',
    compiler ? '- Compiler evidence: ' + JSON.stringify(compiler) : '', '',
    '## Execution (separate approval; no implicit npm or browser processes)',
    request.verification === 'none' ? '- No automated verification requested.' :
      '- Request a fresh verification plan: node shell.mjs brainstorm verify --out ' + out + ' --json',
    request.verification === 'none' ? '' :
      '- After reviewing the scripts, pinned toolchain and process effects, repeat with --apply <fresh-planHash> --json.',
    '- Project/native acceptance and publication remain separate from compilation and local test/build results.', '',
  ].filter((line, index, array) => line !== '' || array[index - 1] !== '').join('\n') + '\n';
}
function absoluteInput(context: CommandContext, name: string) {
  const path = projectPath(name);
  return join(context.root, path);
}
async function inputData(args: Arguments, context: CommandContext): Promise<unknown> {
  const source = option(args, 'input');
  requireSketch(source, 'BRAINSTORM_INPUT', 'Use brainstorm schema, then --input <relative.json|->.');
  return source === '-' ? parseJsonData(await readInput(context.input, context.signal)) : readData(absoluteInput(context, source));
}
function commandOptions(args: Arguments, context: CommandContext): BrainstormOptions {
  return { ...context, project: option(args, 'project', 'design/project.json'),
    out: option(args, 'out') || undefined };
}
function discovery(args: Arguments): Record<string, unknown> | undefined {
  if (args.action !== 'guide' && args.action !== 'schema') return;
  requireSketch(!['input', 'out', 'apply'].some(key => args.flags[key]),
    'BRAINSTORM_OPTION', 'Discovery never writes.');
  return args.action === 'guide' ? { guide: brainstormGuide } : { schema: brainstormSchema() };
}
async function verificationCommand(args: Arguments, context: CommandContext) {
  requireSketch(!args.flags.input, 'BRAINSTORM_OPTION',
    'Verification reads its existing output package, not an unreviewed request.');
  const plan = await brainstormVerifyPlan(context, option(args, 'out'));
  return option(args, 'apply') ? executeBrainstormVerification(plan, option(args, 'apply'), context) :
    { ...plan, status: plan.blockers.length ? 'blocked' : 'planned', executed: false };
}
async function featureCommand(args: Arguments, context: CommandContext, options: BrainstormOptions) {
  requireSketch(args.action === 'feature' || args.action === 'validate', 'BRAINSTORM_COMMAND',
    'Use brainstorm guide, schema, context, validate, feature or verify. Project brainstorming is a future sub-use-case.');
  requireSketch(args.action !== 'validate' || !['out', 'apply'].some(key => args.flags[key]),
    'BRAINSTORM_OPTION', 'Validation has no write options.');
  const request = await inputData(args, context);
  if (args.action === 'validate') return validateBrainstormFeature(request, options);
  const plan = await brainstormFeaturePlan(request, options);
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
export async function brainstormCommand(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const allowed = ['root', 'project', 'input', 'out', 'apply', 'json', 'no-interaction', 'help', 'no-color', 'ui'];
  requireSketch(Object.keys(args.flags).every(key => allowed.includes(key)),
    'BRAINSTORM_OPTION', 'Unsupported brainstorm option.');
  const discovered = discovery(args);
  if (discovered) return discovered;
  const options = commandOptions(args, context);
  if (args.action === 'context') {
    requireSketch(!['input', 'out', 'apply'].some(key => args.flags[key]),
      'BRAINSTORM_OPTION', 'Context inspection never writes.');
    return brainstormContext(options);
  }
  if (args.action === 'verify') return verificationCommand(args, context);
  return featureCommand(args, context, options);
}
function equal(actual: unknown, expected: unknown) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
interface VerificationDefinition {
  request: FeatureBrainstorm; definitionHash: string;
}
async function verificationDefinition(context: ProcessContext, out: string): Promise<VerificationDefinition> {
  const bytes = await readBounded(join(context.root, out, 'feature.definition.json'), 4_000_000);
  const definition = object(parseJsonData(bytes.toString('utf8')));
  requireSketch(definition.kind === 'shell-feature-definition' && definition.schemaVersion === 1 &&
    definition.status === 'draft' && definition.execution === 'not-run', 'BRAINSTORM_DEFINITION',
  'Verification needs an unchanged brainstorm definition produced by this workflow.');
  const request = readFeatureBrainstorm(definition.feature);
  requireSketch(request.output !== 'definition' && request.verification !== 'none',
    'BRAINSTORM_VERIFICATION', 'This definition did not request generated source with verification.');
  return { request, definitionHash: hash(bytes) };
}
async function verifiedInventory(context: ProcessContext, source: string) {
  const receipt = object(await readData(join(context.root, source, '.maker/receipt.json')));
  requireSketch(receipt.schemaVersion === 1 && Array.isArray(receipt.files), 'BRAINSTORM_RECEIPT',
    'Generated source ownership receipt is missing or invalid.');
  const inventory = await firstRunInventory(context.root, source);
  const owned = new Map(receipt.files.map(item => {
    const row = object(item), path = text(row.path, 'receipt path', 300), digest = text(row.sha256, 'receipt sha256', 64);
    requireSketch(/^[a-f0-9]{64}$/.test(digest), 'BRAINSTORM_RECEIPT', 'Generated source receipt contains an invalid digest.');
    return [path, digest];
  }));
  const unchanged = owned.size === receipt.files.length && [...owned].every(([path, digest]) =>
    inventory.some(file => file.path === source + '/' + path && file.sha256 === digest));
  requireSketch(unchanged, 'BRAINSTORM_SOURCE_CHANGED',
    'Generated source differs from the reviewed compiler output; do not execute it through brainstorm.');
  return inventory;
}
async function generatedToolchain(context: ProcessContext, source: string,
  request: FeatureBrainstorm, inventory: { path: string; sha256: string }[]) {
  const tool = await firstRunTool(), npm = object(await readData(join(context.root, source, 'package.json')));
  const scripts = object(npm.scripts), lock = inventory.find(file => file.path === source + '/package-lock.json');
  requireSketch(lock && typeof scripts.test === 'string' &&
    (request.verification === 'test' || typeof scripts.build === 'string'), 'BRAINSTORM_SCRIPTS',
  'Verification needs a generated package-lock.json and the requested test/build scripts.');
  const manager = text(npm.packageManager, 'packageManager');
  const node = (await readBounded(join(context.root, source, '.nvmrc'), 100)).toString('utf8').trim();
  requireSketch(/^\d+\.\d+\.\d+$/.test(node) && /^npm@\d+\.\d+\.\d+$/.test(manager),
    'BRAINSTORM_TOOLCHAIN', 'Generated source needs exact .nvmrc and npm packageManager versions.');
  const expected = { node, npm: manager.slice(4) };
  const blockers = [tool.node === expected.node ? '' : 'Select Node ' + expected.node + '; found ' + tool.node,
    tool.version === expected.npm ? '' : 'Select npm ' + expected.npm + '; found ' + tool.version].filter(Boolean);
  return { tool, expected, blockers };
}
function verificationSteps(requested: BrainstormVerificationPlan['requested']) {
  return [{ label: 'install', args: ['ci', '--no-fund'] }, { label: 'test', args: ['run', 'test'] },
    ...(requested === 'test-build' ? [{ label: 'build', args: ['run', 'build'] }] : [])];
}
function verificationEffects(): string[] {
  return ['npm ci downloads and executes dependency lifecycle scripts with the current user permissions.',
    'Generated project tests/builds are trusted local code; they may write caches, lock data, reports and dist.',
    'No process starts during brainstorming, validation, generation or verification planning.',
    'Execution requires separate current-plan hash approval, fails on the first error and never publishes or starts a browser.',
    'External process side effects are not rolled back; native Companion acceptance remains unverified.'];
}
/** Read-only executable plan bound to every generated input and the exact npm executable. */
export async function brainstormVerifyPlan(context: ProcessContext, folder: string): Promise<BrainstormVerificationPlan> {
  requireSketch(folder, 'BRAINSTORM_OUTPUT', 'Supply --out <existing-brainstorm-package>.');
  const out = projectPath(folder), source = sourcePath(out);
  const definition = await verificationDefinition(context, out);
  const inventory = await verifiedInventory(context, source);
  const environment = await generatedToolchain(context, source, definition.request, inventory);
  const requested = definition.request.verification as BrainstormVerificationPlan['requested'];
  const steps = verificationSteps(requested), effects = verificationEffects();
  const planHash = hash(JSON.stringify({ root: context.root, out, source,
    definitionHash: definition.definitionHash, inventory, tool: environment.tool,
    expected: environment.expected, steps }));
  return { root: context.root, out, source, definitionHash: definition.definitionHash, inventory,
    ...environment, steps, effects, requested, planHash };
}
/** Process consent cannot be smuggled into a generation or concept-import approval. */
export async function executeBrainstormVerification(plan: BrainstormVerificationPlan, approval: string, context: ProcessContext) {
  requireSketch(approval === plan.planHash, 'BRAINSTORM_APPROVAL', 'Review the latest verification planHash before running processes.');
  requireSketch(!plan.blockers.length, 'BRAINSTORM_TOOLCHAIN', plan.blockers.join(' '));
  requireSketch(!context.signal?.aborted, 'CANCELLED', 'Verification cancelled before execution.');
  const fresh = await brainstormVerifyPlan(context, plan.out);
  requireSketch(equal(fresh, plan), 'BRAINSTORM_STALE', 'Generated inputs or tools changed after approval.');
  const outcomes: { label: string; exitCode: number }[] = [];
  for (const step of plan.steps) {
    requireSketch(!context.signal?.aborted, 'CANCELLED', 'Verification cancelled before ' + step.label + '.');
    const observed = await brainstormVerifyPlan(context, plan.out);
    requireSketch(equal(observed, plan), 'BRAINSTORM_STALE',
      'An input, dependency lock or npm executable changed; stop before another process.');
    context.progress?.('BRAINSTORM_STAGE ' + step.label + '\n');
    const result = await runNode({ ...context, root: join(context.root, plan.source) },
      plan.tool.entry, step.args, 600_000, { CI: 'true', npm_config_update_notifier: 'false' });
    outcomes.push({ label: step.label, exitCode: result.exitCode });
  }
  return { status: 'ok', executed: true, planHash: plan.planHash, outcomes, acceptance: 'not-inferred',
    publication: 'not-run', externalEffects: 'preserved-not-rolled-back' };
}
