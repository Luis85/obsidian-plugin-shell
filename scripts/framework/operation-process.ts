import { join } from 'node:path';
import { dependencyReadiness } from '../compiler/adapters/dependencies.ts';
import { profiles } from './catalog.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { readBounded } from './files.ts';
import { packKit } from './kit.ts';
import { npmEntry, runNode } from './process.ts';
import { projectConfigPath, projectConfigs } from '../shared/project-configs.mjs';

function acceptProfile(command: string, profile: string | undefined): void {
  const allowed = profiles[command] ?? [];
  const label = command[0]!.toUpperCase() + command.slice(1);
  requireThat(profile === undefined || allowed.includes(profile), 'PROFILE_UNKNOWN',
    `${label} profile: ${allowed.slice(0, -1).join(', ')} or ${allowed.at(-1)}.`);
}

export async function processOperation(request: Request, context: Context): Promise<Result> {
  const options = request.options;
  const timeout = Number(stringOption(options, 'timeout') ?? (request.command === 'dev' ? '3600000' : '600000'));
  if (request.command === 'framework pack') {
    const output = stringOption(options, 'out');
    requireThat(output, 'OUTPUT_REQUIRED', 'Supply --out <archive.zip>.');
    if (!options.yes || options['dry-run']) {
      return result(request.command, { output, requires: '--yes', publication: 'not-authorized' }, 'planned');
    }
    return result(request.command, await packKit(context, output), 'applied');
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
      content: (await readBounded(join(context.root, path), 8_000_000)).toString('utf8'),
      ownership: 'extension' as const,
    })));
    const readiness = dependencyReadiness(manifests);
    if (!readiness.ready) return {
      ...result(request.command, { execution: 'not-run', dependencies: 'resolution-required' }, 'blocked'),
      diagnostics: readiness.diagnostics,
    };
    entry = await npmEntry();
    args = ['ci', '--no-fund'];
  } else if (request.command === 'build') {
    entry = 'scripts/bundling/build.mjs';
  } else if (request.command === 'test') {
    acceptProfile(request.command, profile);
    if (profile === 'native') entry = 'scripts/testing/check-native.mjs';
    else if (profile === 'obsidian') entry = 'scripts/testing/run-obsidian-tests.mjs';
    else if (profile === 'browser') { entry = 'node_modules/@playwright/test/cli.js'; args = ['test', '--config', 'configs/testing/playwright.config.ts']; }
    else {
      entry = 'node_modules/vitest/vitest.mjs';
      args = ['run'];
      const project = projectConfigPath(context.root, 'vitest');
      if (profile === 'project' || (profile === undefined && project)) args.push('--config', project ?? projectConfigs.vitest.path);
      else args.push('--config', 'configs/testing/vitest.config.mjs');
    }
  } else if (request.command === 'verify') {
    acceptProfile(request.command, profile);
    if (profile === 'project') { entry = await npmEntry(); args = ['run', 'verify:project']; }
    else entry = 'scripts/quality/verify.mjs';
  } else if (request.command === 'dev') {
    acceptProfile(request.command, profile);
    entry = profile === 'ui' ? 'node_modules/vite/bin/vite.js'
      : profile === 'obsidian' ? 'scripts/dev/obsidian-dev.mjs'
      : 'scripts/dev/watch-local.mjs';
    if (profile === 'preview') {
      return result(request.command, {
        execution: await runNode(context, 'node_modules/vite/bin/vite.js', ['--config', projectConfigPath(context.root, 'preview') ?? projectConfigs.preview.path], timeout),
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
    environment.npm_execpath = await npmEntry();
  }
  return result(request.command, {
    execution: await runNode(context, entry, args, timeout, environment),
    profile: profile ?? 'default',
    productAcceptance: 'not-inferred',
    publication: 'not-run',
  });
}
