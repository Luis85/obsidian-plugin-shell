import { resolve, join } from 'node:path';
import { inspectStyles } from './styles.ts';
import { fixtureOperation } from './fixtures.ts';
import { operationSchemas } from './schemas.ts';
import { commands, descriptor, validateRequest, parameterKinds } from './catalog.ts';
import { capabilityCatalog } from '../operations/catalog.mjs';
import { result, failure, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { planOperation, applyOperation, savePlan, loadPlan } from './planning.ts';
import { status, releaseCheck } from './inspection.ts';
import { inspectDesign } from './changes.ts';
import { readConfiguration, exists } from './files.ts';
import { verifyKit } from './kit-integrity.ts';
import { packKit } from './kit.ts';
import { npmEntry, runNode } from './process.ts';
async function fileOperation(request: Request, context: Context): Promise<Result> {
  const stored = request.command.startsWith('plan ');
  if (stored) requireThat(request.args[0], 'PLAN_REQUIRED', 'Supply the saved plan filename.');
  const planned = stored ? await loadPlan(context, request.args[0]!) : await planOperation(request, context);
  const output = stringOption(request.options, 'plan-out');
  const saved = output ? await savePlan(context, planned, output) : null;
  const apply = request.command !== 'plan inspect' && !request.options['dry-run'] && (request.options.apply !== undefined || request.options.yes === true);
  if (!apply) return result(request.command, { ...planned.review, ...(saved ? { saved } : {}) }, planned.conflicts.length ? 'blocked' : 'planned');
  const expected = stringOption(request.options, 'apply') ?? planned.planHash;
  const applied = await applyOperation(planned, context, expected);
  return result(request.command, { ...planned.review, applied }, applied.written.length ? 'applied' : 'unchanged');
}
async function processOperation(request: Request, context: Context): Promise<Result> {
  const options = request.options, timeout = Number(stringOption(options, 'timeout') ?? (request.command === 'dev' ? '3600000' : '600000'));
  if (request.command === 'framework pack') {
    const output = stringOption(options, 'out'); requireThat(output, 'OUTPUT_REQUIRED', 'Supply --out <archive.zip>.');
    if (!options.yes || options['dry-run']) return result(request.command, { output, requires: '--yes', publication: 'not-authorized' }, 'planned');
    return result(request.command, await packKit(context, output), 'applied');
  }
  if (options['dry-run'] || (request.command === 'install' && !options.yes)) return result(request.command, { execution: 'not-run', requires: request.command === 'install' ? '--yes' : 'explicit execution', effects: 'project processes may write build output, reports, dependencies or caches' }, 'planned');
  let entry: string, args: string[] = [];
  const environment: Record<string, string> = {};
  const profile = stringOption(options, 'profile');
  if (request.command === 'install') { entry = await npmEntry(); args = ['ci', '--no-fund']; }
  else if (request.command === 'build') entry = 'scripts/bundling/build.mjs';
  else if (request.command === 'test') {
    requireThat(profile === undefined || ['unit', 'project', 'browser', 'native'].includes(profile), 'PROFILE_UNKNOWN', 'Test profile: unit, project, browser or native.');
    if (profile === 'native') entry = 'scripts/testing/check-native.mjs';
    else if (profile === 'browser') { entry = 'node_modules/@playwright/test/cli.js'; args = ['test']; }
    else { entry = 'node_modules/vitest/vitest.mjs'; args = ['run']; if (profile === 'project' || (profile === undefined && await exists(join(context.root, 'vitest.project.config.mjs')))) args.push('--config', 'vitest.project.config.mjs'); }
  } else if (request.command === 'verify') {
    requireThat(profile === undefined || ['full', 'project'].includes(profile), 'PROFILE_UNKNOWN', 'Verify profile: full or project.');
    if (profile === 'project') { entry = await npmEntry(); args = ['run', 'verify:project']; }
    else entry = 'scripts/quality/verify.mjs';
  } else if (request.command === 'dev') {
    requireThat(profile === undefined || ['watch', 'ui'].includes(profile), 'PROFILE_UNKNOWN', 'Dev profile: watch or ui.');
    entry = profile === 'ui' ? 'node_modules/vite/bin/vite.js' : 'scripts/dev/watch-local.mjs';
    args = profile === 'ui' ? ['--config', 'vite.harness.config.mjs', '--host', '127.0.0.1'] : ['--no-local'];
  } else {
    const commit = stringOption(options, 'commit'), version = stringOption(options, 'version');
    requireThat(commit && version, 'RELEASE_INPUT_REQUIRED', 'Supply --commit and --version for fixed-source rehearsal.');
    entry = 'scripts/release/rehearse.mjs'; args = ['--commit', commit, '--version', version]; environment.npm_execpath = await npmEntry();
  }
  return result(request.command, { execution: await runNode(context, entry, args, timeout, environment), profile: profile ?? 'default', productAcceptance: 'not-inferred', publication: 'not-run' });
}
async function readOperation(request: Request, context: Context): Promise<Result> {
  if (request.command === 'version') {
    const kit = await exists(join(context.frameworkRoot, '.framework/kit.json'));
    const { readJson } = await import('./files.ts');
    const metadata = await readJson(join(context.frameworkRoot, kit ? '.framework/kit.json' : 'package.json')) as { version?: string };
    return result(request.command, { frameworkVersion: metadata.version, nodeVersion: process.version, protocolVersion: 1, distribution: kit ? 'compiled-kit' : 'source' });
  }
  if (request.command === 'styles inspect') return result(request.command, await inspectStyles(request, context));
  if (request.command.startsWith('config ')) return result(request.command, { configuration: await readConfiguration(context.root), source: 'shell.config.json', identityAuthority: 'manifest.json after generation', overrides: 'none' });
  if (request.command === 'project inspect') {
    const input = stringOption(request.options, 'input'); requireThat(input, 'INPUT_REQUIRED', 'Supply --input <project.json>.');
    const { model, source } = await inspectDesign(context, input);
    return result(request.command, { schemaVersion: source.document.schemaVersion, project: model.project, entities: model.entities.length, sources: model.sources.length, screens: model.screens.length, components: model.components.length, acceptanceObligations: model.requirements.length, warnings: model.warnings });
  }
  if (request.command === 'framework status') {
    const kit = await verifyKit(context.root); return result(request.command, { version: kit.version, sourceHash: kit.sourceHash, compilerVersion: kit.compilerVersion, verifiedFiles: kit.files.length, authenticity: 'checksums-are-not-signatures' });
  }
  if (request.command === 'release check') return releaseCheck(context, stringOption(request.options, 'input'));
  return status(context, request.command);
}
/** Programmatic adapter shared by the terminal and future companion. No prompt or process-global cwd change. */
export async function executeOperation(input: Request, context: Context): Promise<Result> {
  let command = 'unknown';
  try {
    const request = validateRequest(input); command = request.command;
    requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
    if (command === 'schema') return result(command, operationSchemas());
    if (request.options.help || command === 'help' || command === 'capabilities') {
      const selected = command === 'help' ? request.args.join(' ') : request.options.help ? command : '';
      const entries = selected ? [descriptor(selected)] : commands;
      return result(command, { protocolVersion: 1, commands: entries.map(entry => ({ ...entry, options: parameterKinds(entry), availability: 'implemented', execution: entry.effect === 'process' ? 'trusted-project-code' : entry.effect })),
        makers: capabilityCatalog().makers, examples: ['node shell.mjs setup --input project.json --dry-run', 'node shell.mjs generate --plan-out generation.plan.json', 'node shell.mjs plan apply generation.plan.json --yes'],
        transport: 'terminal-or-shared-TypeScript-API', approvals: 'never portable' });
    }
    if (descriptor(command).effect === 'fixtures') return await fixtureOperation(request, context);
    if (command === 'make' && (request.args.length === 0 || ['list', 'describe'].includes(request.args[0]!) || request.options.list)) {
      const makers = capabilityCatalog().makers.filter((item: { id: string }) => request.args[0] !== 'describe' || item.id === request.args[1]);
      requireThat(makers.length > 0, 'MAKER_UNKNOWN', 'Supply an existing recipe ID; use make list.');
      return result(command, { makers });
    }
    if (command === 'plan inspect' || descriptor(command).effect === 'plan') return await fileOperation(request, context);
    if (descriptor(command).effect === 'process') return await processOperation(request, context);
    if (command === 'release operate') {
      const path = stringOption(request.options, 'input'); requireThat(path, 'INPUT_REQUIRED', 'Supply --input <release-operation.json>.');
      if (request.options['dry-run']) return result(command, { execution: 'not-run', input: path, requestedMode: request.options.execute ? 'candidate-write' : 'remote-discovery', candidateEligibility: 'not-checked', publication: 'not-authorized' }, 'planned');
      const args = ['--input', resolve(context.root, path)];
      if (request.options.execute) { const authorization = stringOption(request.options, 'authorize'); requireThat(authorization, 'RELEASE_AUTHORIZATION', 'Public execution requires a separate --authorize digest. --yes is not authorization.'); args.push('--execute', '--authorize', authorization); }
      else requireThat(request.options.authorize === undefined, 'RELEASE_AUTHORIZATION', '--authorize requires --execute.');
      const exit = await runNode(context, 'scripts/release/cli.mjs', args);
      requireThat(!exit.truncated, 'RELEASE_OUTPUT_LIMIT', 'Release output exceeded its bound; do not infer success or retry writes automatically.');
      return result(command, { execution: exit, receipt: JSON.parse(exit.stdout) });
    }
    return await readOperation(request, context);
  } catch (error) { return failure(command, error); }
}
