import { join } from 'node:path';
import { dependencyReadiness } from '../../compiler/adapters/dependencies.ts';
import { profiles } from './catalog.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { exists, readBounded } from './files.ts';
import { packKit } from './kit.ts';
import { npmEntry, runNode } from './process.ts';
import { testingTool } from './testing-tools.ts';
import { projectConfigs } from '#shared/platform/project-configs.mjs';
import { repositoryScope, toolingFolder } from './repository-scope.ts';

export interface ProcessOperationDependencies {
  dependencyReadiness?: typeof dependencyReadiness;
  exists?: typeof exists;
  readBounded?: typeof readBounded;
  packKit?: typeof packKit;
  npmEntry?: typeof npmEntry;
  runNode?: typeof runNode;
}

function acceptProfile(command: string, profile: string | undefined): void {
  const allowed = profiles[command] ?? [];
  const label = command[0]!.toUpperCase() + command.slice(1);
  requireThat(profile === undefined || allowed.includes(profile), 'PROFILE_UNKNOWN',
    `${label} profile: ${allowed.slice(0, -1).join(', ')} or ${allowed.at(-1)}.`);
}

type ProjectConfigKind = keyof typeof projectConfigs;
/** Generated projects use only canonical tool configuration under configs/<concern>/. */
async function projectConfig(root: string, kind: ProjectConfigKind, existsPath: typeof exists): Promise<string | null> {
  const config = projectConfigs[kind];
  return await existsPath(join(root, config.path)) ? config.path : null;
}
async function vitestArguments(root: string, profile: string | undefined, existsPath: typeof exists): Promise<string[]> {
  const project = await projectConfig(root, 'vitest', existsPath);
  if (profile === 'project' || (profile === undefined && project)) return ['run', '--config', project ?? projectConfigs.vitest.path];
  return ['run', '--config', 'configs/testing/vitest.config.mjs'];
}

interface Host {
  dependencyCheck: typeof dependencyReadiness; existsPath: typeof exists; read: typeof readBounded;
  pack: typeof packKit; npm: typeof npmEntry; run: typeof runNode;
}
/** The trusted process to launch, or a finished result when the command resolves without one. */
type Invocation = { entry: string; args?: string[]; environment?: Record<string, string> } | { done: Result };
type Resolve = (request: Request, context: Context, host: Host, profile: string | undefined, timeout: number) => Promise<Invocation>;
async function installInvocation(request: Request, context: Context, host: Host): Promise<Invocation> {
  const manifests = await Promise.all(['package.json', 'package-lock.json'].map(async path => ({
    path,
    content: (await host.read(join(context.root, path), 8_000_000)).toString('utf8'),
    ownership: 'extension' as const,
  })));
  const readiness = host.dependencyCheck(manifests);
  if (!readiness.ready) return { done: {
    ...result(request.command, { execution: 'not-run', dependencies: 'resolution-required' }, 'blocked'),
    diagnostics: readiness.diagnostics,
  } };
  return { entry: await host.npm(), args: ['ci', '--no-fund'] };
}
/** `driver` entries name a test driver that testingTool locates (tooling/testing here, scripts/testing in a generated project). */
const testEntries: Record<string, { entry: string; args?: string[]; driver?: boolean }> = {
  native: { entry: 'check-native.mjs', driver: true },
  obsidian: { entry: 'run-obsidian-tests.mjs', driver: true },
  browser: { entry: 'node_modules/@playwright/test/cli.js', args: ['test', '--config', 'configs/testing/playwright.config.ts'] },
};
async function testInvocation(request: Request, context: Context, host: Host, profile: string | undefined): Promise<Invocation> {
  acceptProfile(request.command, profile);
  if (profile && Object.hasOwn(testEntries, profile)) {
    const { entry, args = [], driver } = testEntries[profile]!;
    return { entry: driver ? await testingTool(context.root, entry, host.existsPath) : entry, args: [...args] };
  }
  return { entry: 'node_modules/vitest/vitest.mjs', args: await vitestArguments(context.root, profile, host.existsPath) };
}
async function verifyInvocation(request: Request, context: Context, host: Host, profile: string | undefined): Promise<Invocation> {
  acceptProfile(request.command, profile);
  if (profile === 'project') return { entry: await host.npm(), args: ['run', 'verify:project'] };
  // The shell repository verifies through tooling/quality; a generated project carries its own copy under scripts/quality.
  return { entry: `${toolingFolder(repositoryScope(context.root))}/quality/verify.mjs` };
}
const devEntries: Record<string, { entry: string; args: string[] }> = {
  ui: { entry: 'node_modules/vite/bin/vite.js', args: ['--config', 'configs/bundling/vite.harness.config.mjs', '--host', '127.0.0.1'] },
  obsidian: { entry: 'scripts/dev/obsidian-dev.mjs', args: [] },
};
async function devInvocation(request: Request, context: Context, host: Host, profile: string | undefined, timeout: number): Promise<Invocation> {
  acceptProfile(request.command, profile);
  if (profile === 'preview') {
    const config = await projectConfig(context.root, 'preview', host.existsPath) ?? projectConfigs.preview.path;
    return { done: result(request.command, { execution: await host.run(context, 'node_modules/vite/bin/vite.js', ['--config', config], timeout), productAcceptance: 'not-inferred' }) };
  }
  if (profile && Object.hasOwn(devEntries, profile)) return { ...devEntries[profile]!, args: [...devEntries[profile]!.args] };
  return { entry: 'scripts/dev/watch-local.mjs', args: ['--no-local'] };
}
async function rehearseInvocation(request: Request, _context: Context, host: Host): Promise<Invocation> {
  const commit = stringOption(request.options, 'commit');
  const version = stringOption(request.options, 'version');
  requireThat(commit && version, 'RELEASE_INPUT_REQUIRED', 'Supply --commit and --version for fixed-source rehearsal.');
  return { entry: 'scripts/release/rehearse.mjs', args: ['--commit', commit, '--version', version], environment: { npm_execpath: await host.npm() } };
}
const invocations: Record<string, Resolve> = {
  install: installInvocation,
  build: async () => ({ entry: 'scripts/bundling/build.mjs' }),
  test: testInvocation,
  verify: verifyInvocation,
  dev: devInvocation,
};
function dryRunPlan(request: Request): Result | null {
  const options = request.options;
  if (options['dry-run'] || (request.command === 'install' && !options.yes)) {
    return result(request.command, {
      execution: 'not-run',
      requires: request.command === 'install' ? '--yes' : 'explicit execution',
      effects: 'project processes may write build output, reports, dependencies or caches',
    }, 'planned');
  }
  return null;
}
async function frameworkPack(request: Request, context: Context, host: Host): Promise<Result> {
  const output = stringOption(request.options, 'out');
  requireThat(output, 'OUTPUT_REQUIRED', 'Supply --out <archive.zip>.');
  if (!request.options.yes || request.options['dry-run']) {
    return result(request.command, { output, requires: '--yes', publication: 'not-authorized' }, 'planned');
  }
  return result(request.command, await host.pack(context, output), 'applied');
}
/** Real host operations unless a contract test injects one. */
function hostFor(dependencies: ProcessOperationDependencies): Host {
  return {
    dependencyCheck: dependencies.dependencyReadiness ?? dependencyReadiness,
    existsPath: dependencies.exists ?? exists,
    read: dependencies.readBounded ?? readBounded,
    pack: dependencies.packKit ?? packKit,
    npm: dependencies.npmEntry ?? npmEntry,
    run: dependencies.runNode ?? runNode,
  };
}
export async function processOperation(
  request: Request,
  context: Context,
  dependencies: ProcessOperationDependencies = {},
): Promise<Result> {
  const host = hostFor(dependencies);
  const timeout = Number(stringOption(request.options, 'timeout') ?? (request.command === 'dev' ? '3600000' : '600000'));
  if (request.command === 'framework pack') return frameworkPack(request, context, host);
  const planned = dryRunPlan(request);
  if (planned) return planned;
  const profile = stringOption(request.options, 'profile');
  const resolveInvocation = Object.hasOwn(invocations, request.command) ? invocations[request.command]! : rehearseInvocation;
  const invocation = await resolveInvocation(request, context, host, profile, timeout);
  if ('done' in invocation) return invocation.done;
  return result(request.command, {
    execution: await host.run(context, invocation.entry, invocation.args ?? [], timeout, invocation.environment ?? {}),
    profile: profile ?? 'default',
    productAcceptance: 'not-inferred',
    publication: 'not-run',
  });
}
