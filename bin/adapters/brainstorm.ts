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
import { readData, readSnapshot, prepared, applyPrepared, type Prepared } from './storage.ts';
import { object, text } from '../domain/data.ts';
import { requireSketch, slug } from '../domain/errors.ts';
import { documentText } from '../domain/document.ts';
import { brainstormGuide, brainstormSchema, featureConcept, readFeatureBrainstorm, type FeatureBrainstorm } from '../domain/brainstorm.ts';
import { projectPath } from '../domain/user-settings.ts';
import { option, type Arguments } from '../domain/command-options.ts';
import type { CommandContext } from './commands.ts';

export interface BrainstormOptions extends CommandContext { project: string; out?: string }
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
export async function validateBrainstormFeature(input: unknown, options: BrainstormOptions) {
  const current = await base(options), request = readFeatureBrainstorm(input);
  const result = featureConcept(request, current);
  return { ready: true, request, definition: result.definition, concept: result.concept,
    candidate: summary(result.candidate), mapping: result.mapping };
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
  const entries: { path: string; content: string; encoding?: 'base64' }[] = [
    { path: out + '/feature.definition.json', content: JSON.stringify(result.definition, null, 2) + '\n' },
    { path: out + '/candidate.project.json', content: documentText(result.candidate) },
    { path: conceptPath, content: JSON.stringify(result.concept, null, 2) + '\n' },
  ];
  let compiler: Record<string, unknown> | null = null;
  if (request.output !== 'definition') {
    const selection = await savedProjectSelection(options.root);
    const kind = request.output === 'prototype' ? 'clickdummy' : selection ? 'project' : 'obsidian-plugin';
    const emitted = await compile(result.candidate, options.frameworkRoot, kind, options.signal,
      kind === 'project' ? selection : undefined);
    compiler = { outputKind: kind, fingerprint: emitted.compilation.fingerprint,
      readiness: emitted.compilation.readiness, artifacts: emitted.artifacts.length };
    const owned = emitted.artifacts.map(item => ({
      path: item.path, sha256: hash(Buffer.from(item.content, item.encoding ?? 'utf8')),
    }));
    entries.push(...emitted.artifacts.map(item => {
      requireSketch(!item.encoding || item.encoding === 'utf8' || item.encoding === 'base64',
        'BRAINSTORM_ENCODING', 'Unsupported compiler artifact encoding.');
      return { path: sourcePath(out) + '/' + item.path, content: item.content,
        ...(item.encoding === 'base64' ? { encoding: 'base64' as const } : {}) };
    }));
    entries.push({ path: sourcePath(out) + '/.maker/receipt.json',
      content: JSON.stringify({ schemaVersion: 1, files: owned }, null, 2) + '\n' });
  }
  entries.push({ path: out + '/README.md', content: handoff(request, out, conceptPath, result.mapping, compiler) });
  const plan = await createFilePlan(options.root, entries);
  requireSketch(plan.changes.every(change => change.status === 'create' || change.status === 'unchanged'),
    'BRAINSTORM_OUTPUT_EXISTS', 'An existing brainstorm or source file differs. Preserve it and choose a different --out or feature ID.');
  const detail = { definition: result.definition, conceptPath, candidatePath: out + '/candidate.project.json',
    output: out, compiler, verification: request.verification, generated: request.output !== 'definition',
    imported: false, executed: false, prompt: handoff(request, out, conceptPath, result.mapping, compiler),
    document: result.candidate };
  return prepared(plan, detail, { base: current.sha256, project: current.document.project.id, request });
}
function handoff(request: FeatureBrainstorm, out: string, conceptPath: string,
  mapping: { title: string; surfaceId: string; route: string | null }[], compiler: Record<string, unknown> | null): string {
  return [
    '# ' + request.name + ' — brainstorm handoff',
    '',
    request.purpose, '',
    'Status: draft. No source code, tests or feature acceptance are implied by this definition.',
    '',
    '## Canonical handoff',
    '- Feature definition: ' + out + '/feature.definition.json',
    '- Canonical candidate project: ' + out + '/candidate.project.json',
    '- Additive, exact-base feature concept: ' + conceptPath,
    '',
    '## Feature surfaces',
    ...mapping.map(item => '- ' + item.title + ': ' + item.surfaceId + (item.route ? ' (' + item.route + ')' : ' (dialog)')),
    '',
    'Actors/entities and acceptance criteria remain planning information; use the canonical semantic, requirement and visual editors to refine them.',
    'Sitemap transitions describe intended navigation and do not prove executable page events.',
    '',
    '## Import (independent review and approval)',
    '1. Inspect the concept: node shell.mjs concept inspect --input ' + conceptPath + ' --json',
    '2. Review the separate import plan: node shell.mjs concept import --input ' + conceptPath + ' --json',
    '3. If approved, repeat the import command with --apply <fresh-planHash> --json.',
    'Use the configured project importer. If this root is an unconfigured maker workspace, configure a project before importing.',
    '',
    '## Generated source',
    compiler ? '- Generated source: ' + out + '/source (full-project compiler output, not scoped native acceptance).' :
      '- No source was requested. Use a new reviewed brainstorm or the existing shell generator after importing the feature.',
    compiler ? '- Compiler evidence: ' + JSON.stringify(compiler) : '',
    '',
    '## Execution (separate approval; no implicit npm or browser processes)',
    request.verification === 'none' ? '- No automated verification requested.' :
      '- Request a fresh verification plan: node shell.mjs brainstorm verify --out ' + out + ' --json',
    request.verification === 'none' ? '' :
      '- After reviewing the scripts, pinned toolchain and process effects, repeat with --apply <fresh-planHash> --json.',
    '- Project/native acceptance and publication remain separate from compilation and local test/build results.',
    '',
  ].filter((line, index, array) => line !== '' || array[index - 1] !== '').join('\n') + '\n';
}
function absoluteInput(context: CommandContext, name: string) {
  // readData enforces bounded JSON. Resolve only below the selected workspace:
  // --input - is the supported path-independent agent transport.
  const path = projectPath(name);
  return join(context.root, path);
}
async function inputData(args: Arguments, context: CommandContext): Promise<unknown> {
  const source = option(args, 'input');
  requireSketch(source, 'BRAINSTORM_INPUT', 'Use brainstorm schema, then --input <relative.json|->.');
  return source === '-' ? parseJsonData(await readInput(context.input, context.signal)) : readData(absoluteInput(context, source));
}
export async function brainstormCommand(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const allowed = ['root', 'project', 'input', 'out', 'apply', 'json', 'no-interaction', 'help', 'no-color', 'ui'];
  requireSketch(Object.keys(args.flags).every(key => allowed.includes(key)),
    'BRAINSTORM_OPTION', 'Unsupported brainstorm option.');
  if (args.action === 'guide' || args.action === 'schema') {
    requireSketch(!['input', 'out', 'apply'].some(key => args.flags[key]), 'BRAINSTORM_OPTION', 'Discovery never writes.');
    return args.action === 'guide' ? { guide: brainstormGuide } : { schema: brainstormSchema() };
  }
  const options = { ...context, project: option(args, 'project', 'design/project.json'),
    out: option(args, 'out') || undefined };
  if (args.action === 'context') {
    requireSketch(!['input', 'out', 'apply'].some(key => args.flags[key]), 'BRAINSTORM_OPTION', 'Context inspection never writes.');
    return brainstormContext(options);
  }
  if (args.action === 'verify') {
    requireSketch(!args.flags.input, 'BRAINSTORM_OPTION', 'Verification reads its existing output package, not an unreviewed request.');
    const plan = await brainstormVerifyPlan(context, option(args, 'out'));
    return option(args, 'apply') ? executeBrainstormVerification(plan, option(args, 'apply'), context) : { ...plan,
      status: plan.blockers.length ? 'blocked' : 'planned', executed: false };
  }
  requireSketch(args.action === 'feature' || args.action === 'validate', 'BRAINSTORM_COMMAND',
    'Use brainstorm guide, schema, context, validate, feature or verify. Project brainstorming is a future sub-use-case.');
  requireSketch(args.action !== 'validate' || !['out', 'apply'].some(key => args.flags[key]),
    'BRAINSTORM_OPTION', 'Validation has no write options.');
  const request = await inputData(args, context);
  if (args.action === 'validate') return validateBrainstormFeature(request, options);
  const plan = await brainstormFeaturePlan(request, options);
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
function equal(actual: unknown, expected: unknown) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
/** Read-only executable plan bound to every generated input and the exact npm executable. */
export async function brainstormVerifyPlan(context: CommandContext, folder: string): Promise<BrainstormVerificationPlan> {
  requireSketch(folder, 'BRAINSTORM_OUTPUT', 'Supply --out <existing-brainstorm-package>.');
  const out = projectPath(folder), source = sourcePath(out);
  const definitionBytes = await readBounded(join(context.root, out, 'feature.definition.json'), 4_000_000);
  const definitionHash = hash(definitionBytes), definition = object(parseJsonData(definitionBytes.toString('utf8')));
  requireSketch(definition.kind === 'shell-feature-definition' && definition.schemaVersion === 1 &&
    definition.status === 'draft' && definition.execution === 'not-run', 'BRAINSTORM_DEFINITION',
  'Verification needs an unchanged brainstorm definition produced by this workflow.');
  const request = readFeatureBrainstorm(definition.feature);
  requireSketch(request.output !== 'definition' && request.verification !== 'none',
    'BRAINSTORM_VERIFICATION', 'This definition did not request generated source with verification.');
  const receipt = object(await readData(join(context.root, source, '.maker/receipt.json')));
  requireSketch(receipt.schemaVersion === 1 && Array.isArray(receipt.files), 'BRAINSTORM_RECEIPT',
    'Generated source ownership receipt is missing or invalid.');
  const inventory = await firstRunInventory(context.root, source);
  const owned = new Map((receipt.files as unknown[]).map(item => {
    const row = object(item);
    return [text(row.path, 'receipt path', 300), text(row.sha256, 'receipt sha256', 64)];
  }));
  requireSketch(owned.size === receipt.files.length &&
    [...owned].every(([path, digest]) => inventory.some(file => file.path === source + '/' + path && file.sha256 === digest)),
    'BRAINSTORM_SOURCE_CHANGED', 'Generated source differs from the reviewed compiler output; do not execute it through brainstorm.');
  const tool = await firstRunTool(), npm = object(await readData(join(context.root, source, 'package.json')));
  const scripts = object(npm.scripts), lock = inventory.find(file => file.path === source + '/package-lock.json');
  requireSketch(lock && typeof scripts.test === 'string' && (request.verification === 'test' || typeof scripts.build === 'string'),
    'BRAINSTORM_SCRIPTS', 'Verification needs a generated package-lock.json and the requested test/build scripts.');
  const manager = text(npm.packageManager, 'packageManager');
  const nodeVersion = (await readBounded(join(context.root, source, '.nvmrc'), 100)).toString('utf8').trim();
  requireSketch(/^\d+\.\d+\.\d+$/.test(nodeVersion) && /^npm@\d+\.\d+\.\d+$/.test(manager),
    'BRAINSTORM_TOOLCHAIN', 'Generated source needs exact .nvmrc and npm packageManager versions.');
  const expected = { node: nodeVersion, npm: manager.slice(4) };
  const blockers = [tool.node === expected.node ? '' : 'Select Node ' + expected.node + '; found ' + tool.node,
    tool.version === expected.npm ? '' : 'Select npm ' + expected.npm + '; found ' + tool.version].filter(Boolean);
  const steps = [{ label: 'install', args: ['ci', '--no-fund'] }, { label: 'test', args: ['run', 'test'] },
    ...(request.verification === 'test-build' ? [{ label: 'build', args: ['run', 'build'] }] : [])];
  const effects = ['npm ci downloads and executes dependency lifecycle scripts with the current user permissions.',
    'Generated project tests/builds are trusted local code; they may write caches, lock data, reports and dist.',
    'No process starts during brainstorming, validation, generation or verification planning.',
    'Execution requires separate current-plan hash approval, fails on the first error and never publishes or starts a browser.',
    'External process side effects are not rolled back; native Companion acceptance remains unverified.'];
  const planHash = hash(JSON.stringify({ root: context.root, out, source, definitionHash, inventory,
    tool, expected, steps }));
  return { root: context.root, out, source, definitionHash, inventory, tool, expected, blockers,
    steps, effects, requested: request.verification, planHash };
}
/** Process consent cannot be smuggled into a generation or concept-import approval. */
export async function executeBrainstormVerification(plan: BrainstormVerificationPlan, approval: string, context: CommandContext) {
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
