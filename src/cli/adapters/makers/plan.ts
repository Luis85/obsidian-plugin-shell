import { readFileSync } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hasPortableProjectSegments } from '#shared/platform/project-path.ts';
import type { FilePlan } from '#shared/platform/file-plan.ts';
import { projectConfigPath } from '#shared/platform/project-configs.mjs';
import { slug, title, recipeOptions } from './arguments.ts';
import { createMakerContext } from './engine.ts';
import { dispatchMaker } from './dispatch.ts';
import type { Backend, MakerArguments, MakerInput, MakerOptions, Preset } from './contracts.ts';

/** One planned project check: a Node entry point and its arguments, run after a successful apply. */
export interface MakerCheck { readonly id: string; readonly command: 'node'; readonly args: readonly string[] }
export interface PlannedMaker {
  readonly maker: string; readonly templateVersion: 2; readonly owner: string | undefined; readonly plan: FilePlan; readonly checks: readonly MakerCheck[];
  /** The full gate is a printed next step; makers never run or report it. */
  readonly next: string;
  readonly entity?: string | undefined; readonly preset?: Preset; readonly backend?: Backend; readonly folder?: string; readonly preference?: string;
}
const backends: readonly string[] = ['domain', 'markdown', 'plugin-data'];
const presets: readonly string[] = ['title', 'task', 'project'];
const isBackend = (value: string): value is Backend => backends.includes(value);
const isPreset = (value: string): value is Preset => presets.includes(value);

const ownerless = ['maker', 'locale', 'plugin'];
const surfaces = ['feature', 'view', 'store', 'component'];
const isMissing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';

function checkRecipeOptions(maker: string, options: MakerOptions): void {
  if (maker === 'feature' && options['--feature'] !== undefined)
    throw new Error('--feature belongs to child recipes; feature uses its positional group name');
  if (maker === 'entity' && options['--entity'] !== undefined)
    throw new Error('--entity belongs to the feature recipe; entity uses its positional entity name');
  const allowed = new Set(recipeOptions(maker));
  for (const option of Object.keys(options))
    if (!allowed.has(option)) throw new Error(`${option} is not supported by the ${maker} recipe`);
}
function resolveOwner(maker: string, name: string, options: MakerOptions): string | undefined {
  if (ownerless.includes(maker)) return undefined;
  return slug(maker === 'feature' ? name : options['--feature'], 'feature name (--feature is required)');
}
function resolveEntity(maker: string, name: string, options: MakerOptions): string | undefined {
  if (!['entity', 'feature'].includes(maker)) return undefined;
  return slug(maker === 'entity' ? name : (options['--entity'] ?? name), 'entity name');
}
function checkIdentifierLengths(maker: string, owner: string | undefined, name: string): void {
  if (owner && `${owner}-${maker === 'feature' ? 'about-command' : `${name}-${maker}`}`.length > 64)
    throw new Error('Composed command identifier exceeds 64 characters; shorten the feature or component name');
  if (surfaces.includes(maker) && `${owner}-${maker === 'feature' ? 'workspace' : name}`.length > 54)
    throw new Error('Composed native view identifier exceeds 54 characters');
  if (maker === 'setting' && `${owner}-${name}-setting`.length > 50)
    throw new Error('Composed setting entity identifier exceeds 50 characters');
}
function resolveBackend(maker: string, options: MakerOptions): Backend {
  const backend = options['--backend'] ?? (maker === 'entity' && !options['--document'] ? 'domain' : 'markdown');
  if (!isBackend(backend))
    throw new Error('Unknown backend; select domain, markdown or plugin-data');
  if (options['--document'] && backend !== 'markdown') throw new Error('--document requires the markdown backend');
  return backend;
}
// Intentional portability boundary: folder segments are portable project segments (no Windows-reserved names or
// characters, no C0/C1 controls) and never hidden.
function unsafeFolder(folder: string): boolean {
  return folder.length > 160 || folder !== folder.trim() || !hasPortableProjectSegments(folder) || folder.split('/').some(part => part.startsWith('.'));
}
function resolveDocument(options: MakerOptions, owner: string | undefined, name: string): { preset: Preset; folder: string } {
  const preset = options['--preset'] ?? 'title';
  const folder = options['--folder'] ?? title(owner ?? name);
  if (!isPreset(preset)) throw new Error('Unknown preset; select title, task or project');
  if (unsafeFolder(folder)) throw new Error('Unsafe document folder');
  return { preset, folder };
}
async function ownerDirectoryExists(root: string, owner: string): Promise<boolean> {
  try {
    const entry = await lstat(resolve(root, 'src/features', owner));
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Feature owner must be a real directory');
    return true;
  } catch (error) {
    if (!isMissing(error)) throw error;
    return false;
  }
}
async function checkOwner(root: string, maker: string, owner: string | undefined): Promise<boolean> {
  if (!owner) return false;
  const exists = await ownerDirectoryExists(root, owner);
  if (maker !== 'feature' && !exists)
    throw new Error(`Feature ${owner} does not exist. Create it first with make feature ${owner}.`);
  return exists;
}
function planMetadata({ maker, name, options, owner, entity, preset, backend, folder }: MakerInput): Partial<PlannedMaker> {
  if (['feature', 'entity'].includes(maker)) return { entity, preset, backend, ...(backend === 'markdown' ? { folder } : {}) };
  if (maker !== 'setting') return {};
  const preference = options['--preference'];
  return { backend: 'plugin-data', ...(preference ? { preference } : { entity: `${owner}-${name}-setting` }) };
}
const pluginChecks: readonly MakerCheck[] = [
  { id: 'plugin-registry', command: 'node', args: ['scripts/quality/check-workbench-plugins.mjs'] },
  { id: 'plugin-types', command: 'node', args: ['node_modules/typescript/bin/tsc', '--noEmit', '--project', 'configs/types/tsconfig.maker.json'] },
  { id: 'plugin-tests', command: 'node', args: ['scripts/testing/suites.mjs', 'workbench-plugins'] },
];
/** A root `tsconfig.json` that is a solution (`files: []` plus `references`) checks no file with `--noEmit`. */
function solutionRoot(root: string): boolean {
  let config: unknown;
  try { config = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8')); } catch { return false; }
  if (config === null || typeof config !== 'object' || Array.isArray(config)) return false;
  const { files, references } = config as { files?: unknown; references?: unknown };
  return Array.isArray(files) && files.length === 0 && Array.isArray(references) && references.length > 0;
}
/** Type-check step: a generated project's own config, a solution root in build mode, otherwise the root config. */
export function makerTypecheck(root: string): MakerCheck {
  const tsconfig = projectConfigPath(root, 'typescript');
  const args = tsconfig ? ['--noEmit', '--project', tsconfig] : solutionRoot(root) ? ['-b'] : ['--noEmit'];
  return { id: 'typecheck', command: 'node', args: ['node_modules/vue-tsc/bin/vue-tsc.js', ...args] };
}
/** A generated project checks its own project-scoped TypeScript and Vitest configuration, the same ones `check` uses. */
function planChecks(root: string, maker: string, tests: ReadonlySet<string>): MakerCheck[] {
  const runtimeTests = [...tests].filter((path) => path.endsWith('.test.ts'));
  const toolingTests = [...tests].filter((path) => path.endsWith('.checks.mjs'));
  const vitestConfig = projectConfigPath(root, 'vitest') ?? 'configs/testing/vitest.config.mjs';
  return [
    ...(maker === 'plugin' ? pluginChecks : []),
    makerTypecheck(root),
    ...(runtimeTests.length
      ? [{ id: 'generated-tests', command: 'node' as const, args: ['node_modules/vitest/vitest.mjs', 'run', '--config', vitestConfig, ...runtimeTests] }]
      : []),
    // A node:test file runs its own tests when executed directly and exits non-zero on failure.
    ...toolingTests.map((path) => ({ id: `tooling-test:${path.slice(path.lastIndexOf('/') + 1, -'.checks.mjs'.length)}`, command: 'node' as const, args: [path] })),
    { id: 'events-check', command: 'node', args: ['scripts/events/catalog.mjs', '--check'] },
    { id: 'entities-check', command: 'node', args: ['scripts/makers/entities.mjs', '--check'] },
  ];
}
async function fullGate(root: string): Promise<string> {
  try {
    await lstat(resolve(root, '.companion/generation.json'));
    return 'npm run verify:project';
  } catch (error) {
    if (!isMissing(error)) throw error;
    return 'npm run verify';
  }
}
/** Validation order is part of the contract: earlier problems are reported first. */
function resolveRequest(request: MakerArguments): MakerInput {
  const maker = slug(request.maker, 'recipe name');
  const name = slug(request.name, 'maker name');
  const { options } = request;
  checkRecipeOptions(maker, options);
  const owner = resolveOwner(maker, name, options);
  const entity = resolveEntity(maker, name, options);
  checkIdentifierLengths(maker, owner, name);
  const backend = resolveBackend(maker, options);
  return { maker, name, options, owner, entity, backend, ...resolveDocument(options, owner, name) };
}
export async function planMaker(root: string, request: MakerArguments, { beforeFinalize }: { beforeFinalize?: () => unknown } = {}): Promise<PlannedMaker> {
  const input = resolveRequest(request);
  const { maker, owner } = input;
  const ownerExists = await checkOwner(root, maker, owner);
  const context = createMakerContext(root);
  await dispatchMaker(context, input);
  const plan = await context.finish(beforeFinalize);
  if (maker === 'feature' && ownerExists && plan.changes.some((change) => change.status === 'create'))
    throw new Error(`Feature ${owner} already exists. Use a child recipe to extend it.`);
  return {
    maker,
    templateVersion: 2,
    owner,
    ...planMetadata(input),
    plan,
    checks: planChecks(root, maker, context.tests),
    next: await fullGate(root),
  };
}
