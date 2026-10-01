import { join } from 'node:path';
import { dependencyReadiness } from '../../../scripts/compiler/adapters/dependencies.ts';
import { profiles } from './catalog.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { exists, readBounded } from './files.ts';
import { packKit } from './kit.ts';
import { npmEntry, runNode } from './process.ts';
import { projectConfigs } from '../../../scripts/shared/project-configs.mjs';

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
/** Generated projects keep tool configs under configs/<concern>/; older projects keep their retired root copy. */
async function projectConfig(root: string, kind: ProjectConfigKind, existsPath: typeof exists): Promise<string | null> {
  const config = projectConfigs[kind];
  if (await existsPath(join(root, config.path))) return config.path;
  return await existsPath(join(root, config.legacy)) ? config.legacy : null;
}
async function vitestArguments(root: string, profile: string | undefined, existsPath: typeof exists): Promise<string[]> {
  const project = await projectConfig(root, 'vitest', existsPath);
  if (profile === 'project' || (profile === undefined && project)) return ['run', '--config', project ?? projectConfigs.vitest.path];
  return ['run', '--config', 'configs/testing/vitest.config.mjs'];
}

export async function processOperation(
  request: Request,
  context: Context,
  dependencies: ProcessOperationDependencies = {},
): Promise<Result> {
  const dependencyCheck = dependencies.dependencyReadiness ?? dependencyReadiness;
  const existsPath = dependencies.exists ?? exists;
  const read = dependencies.readBounded ?? readBounded;
  const pack = dependencies.packKit ?? packKit;
  const npm = dependencies.npmEntry ?? npmEntry;
  const run = dependencies.runNode ?? runNode;

  const options = request.options;
  const timeout = Number(stringOption(options, 'timeout') ?? (request.command === 'dev' ? '3600000' : '600000'));
  if (request.command === 'framework pack') {
    const output = stringOption(options, 'out');
    requireThat(output, 'OUTPUT_REQUIRED', 'Supply --out <archive.zip>.');
    if (!options.yes || options['dry-run']) {
      return result(request.command, { output, requires: '--yes', publication: 'not-authorized' }, 'planned');
    }
    return result(request.command, await pack(context, output), 'applied');
  }
  if (options['dry-run'] || (request.command === 'install' && !options.yes)) {
    return result(request.command, {
      execution: 'not-run',
      requires: request.command === 'install' ? '--yes' : 'explicit execution',
      effects: 'project processes may write build output, reports, dependencies or caches',
    }, 'planned');
  }

  let entry: string;
  let args: string[] = [];
  const environment: Record<string, string> = {};
  const profile = stringOption(options, 'profile');

  if (request.command === 'install') {
    const manifests = await Promise.all(['package.json', 'package-lock.json'].map(async path => ({
      path,
      content: (await read(join(context.root, path), 8_000_000)).toString('utf8'),
      ownership: 'extension' as const,
    })));
    const readiness = dependencyCheck(manifests);
    if (!readiness.ready) return {
      ...result(request.command, { execution: 'not-run', dependencies: 'resolution-required' }, 'blocked'),
      diagnostics: readiness.diagnostics,
    };
    entry = await npm();
    args = ['ci', '--no-fund'];
  } else if (request.command === 'build') {
    entry = 'scripts/bundling/build.mjs';
  } else if (request.command === 'test') {
    acceptProfile(request.command, profile);
    if (profile === 'native') entry = 'scripts/testing/check-native.mjs';
    else if (profile === 'obsidian') entry = 'scripts/testing/run-obsidian-tests.mjs';
    else if (profile === 'browser') {
      entry = 'node_modules/@playwright/test/cli.js';
      args = ['test', '--config', 'configs/testing/playwright.config.ts'];
    } else {
      entry = 'node_modules/vitest/vitest.mjs';
      args = await vitestArguments(context.root, profile, existsPath);
    }
  } else if (request.command === 'verify') {
    acceptProfile(request.command, profile);
    if (profile === 'project') {
      entry = await npm();
      args = ['run', 'verify:project'];
    } else entry = 'scripts/quality/verify.mjs';
  } else if (request.command === 'dev') {
    acceptProfile(request.command, profile);
    entry = profile === 'ui' ? 'node_modules/vite/bin/vite.js'
      : profile === 'obsidian' ? 'scripts/dev/obsidian-dev.mjs'
      : 'scripts/dev/watch-local.mjs';
    if (profile === 'preview') {
      return result(request.command, {
        execution: await run(context, 'node_modules/vite/bin/vite.js', ['--config', await projectConfig(context.root, 'preview', existsPath) ?? projectConfigs.preview.path], timeout),
        productAcceptance: 'not-inferred',
      });
    }
    args = profile === 'ui' ? ['--config', 'configs/bundling/vite.harness.config.mjs', '--host', '127.0.0.1']
      : profile === 'obsidian' ? [] : ['--no-local'];
  } else {
    const commit = stringOption(options, 'commit');
    const version = stringOption(options, 'version');
    requireThat(commit && version, 'RELEASE_INPUT_REQUIRED', 'Supply --commit and --version for fixed-source rehearsal.');
    entry = 'scripts/release/rehearse.mjs';
    args = ['--commit', commit, '--version', version];
    environment.npm_execpath = await npm();
  }

  return result(request.command, {
    execution: await run(context, entry, args, timeout, environment),
    profile: profile ?? 'default',
    productAcceptance: 'not-inferred',
    publication: 'not-run',
  });
}
