import { join } from 'node:path';
import { dependencyReadiness } from '../../../scripts/compiler/adapters/dependencies.ts';
import { profiles } from './catalog.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { exists, readBounded } from './files.ts';
import { packKit } from '../../../scripts/framework/kit.ts';
import { npmEntry, runNode } from '../../../scripts/framework/process.ts';

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
      args = ['test'];
    } else {
      entry = 'node_modules/vitest/vitest.mjs';
      args = ['run'];
      if (profile === 'project' || (profile === undefined && await existsPath(join(context.root, 'vitest.project.config.mjs')))) {
        args.push('--config', 'vitest.project.config.mjs');
      }
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
        execution: await run(context, 'node_modules/vite/bin/vite.js', ['--config', 'vite.preview.config.mjs'], timeout),
        productAcceptance: 'not-inferred',
      });
    }
    args = profile === 'ui' ? ['--config', 'vite.harness.config.mjs', '--host', '127.0.0.1']
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
