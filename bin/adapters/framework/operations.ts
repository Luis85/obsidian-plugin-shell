import { resolve } from 'node:path';
import { packStarterOperation, readStarterOperation } from '../../../scripts/starters/operations.ts';
import { starterProcessOperation } from '../../../scripts/starters/processes.ts';
import { airshipOperation } from './airship.ts';
import { buildClickdummy } from './clickdummy.ts';
import { checkOperation } from '../../../scripts/framework/check.ts';
import { commands, descriptor, parameterKinds, validateRequest } from './catalog.ts';
import { compilerOperation } from '../../../scripts/compiler/adapters/cli.ts';
import { docsRead } from './docs.ts';
import { fixtureOperation } from './fixtures.ts';
import { commandHelp, helpIndex } from './help-text.ts';
import { operationSchemas } from './schema.ts';
import { setupProgress } from './setup-progress.ts';
import { starterListing, completeStarterProject } from '../../../scripts/framework/starter-project.ts';
import { storybookOperation } from './storybook.ts';
import { submissionCheck } from '../../../scripts/framework/submission.ts';
import { suggestions, didYouMean } from './suggest.ts';
import { capabilityCatalog } from '../../../scripts/operations/catalog.mjs';
import { result, failure, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { runNode } from './process.ts';
import { fileOperation } from './file-operation.ts';
import { processOperation } from './process-operation.ts';
import { readOperation } from './read-operation.ts';

/** Programmatic adapter shared by the terminal and future companion. No prompt or process-global cwd change. */
export async function executeOperation(input: Request, context: Context): Promise<Result> {
  let command = 'unknown';
  try {
    const request = validateRequest(input);
    command = request.command;
    requireThat(!context.signal?.aborted, 'CANCELLED', 'Operation cancelled.');
    if (command === 'schema') return result(command, operationSchemas());
    if (request.options.help || command === 'help' || command === 'capabilities') {
      const selected = command === 'help' ? request.args.join(' ') : request.options.help ? command : '';
      const entries = selected ? [descriptor(selected)] : commands;
      const scope = selected ? 'command' : command === 'capabilities' || request.options.all ? 'all' : 'golden-path';
      return result(command, {
        protocolVersion: 1,
        scope,
        ...helpIndex(),
        commands: entries.map(entry => ({
          ...entry,
          options: parameterKinds(entry),
          availability: 'implemented',
          execution: entry.effect === 'process' ? 'trusted-project-code' : entry.effect,
          ...commandHelp(entry),
        })),
        makers: capabilityCatalog().makers,
        examples: [
          'node bin/app new ../my-plugin --starter blank --yes',
          'node bin/app setup --input project.json --dry-run',
          'node bin/app generate --plan-out generation.plan.json',
          'node bin/app plan apply generation.plan.json --yes',
        ],
        transport: 'terminal-or-shared-TypeScript-API',
        approvals: 'never portable',
      });
    }
    if (command === 'starters pack') return await packStarterOperation(request, context);
    if (command === 'starters run') return await starterProcessOperation(request, context);
    if (command.startsWith('starters ') && descriptor(command).effect === 'read') return await readStarterOperation(request, context);
    if (command.startsWith('docs ') && descriptor(command).effect !== 'plan') return await docsRead(request, context);
    if (descriptor(command).effect === 'fixtures') return await fixtureOperation(request, context);
    if (command === 'make' && (request.args.length === 0 || ['list', 'describe'].includes(request.args[0]!) || request.options.list)) {
      const catalog: Array<{ id: string }> = capabilityCatalog().makers;
      const makers = catalog.filter(item => request.args[0] !== 'describe' || item.id === request.args[1]);
      requireThat(makers.length > 0, 'MAKER_UNKNOWN',
        `Supply an existing recipe ID; use make list.${didYouMean(suggestions(request.args[1] ?? '', catalog.map(item => item.id)), value => `"${value}"`)}`);
      return result(command, { makers });
    }
    if (command === 'setup status' || command === 'setup resume') return await setupProgress(request, context, executeOperation);
    if (command === 'new') {
      return request.options.list
        ? await starterListing(context)
        : await completeStarterProject(await fileOperation(request, context), request, context);
    }
    if (command.startsWith('storybook ')) return await storybookOperation(request, context);
    if (command.startsWith('compiler ')) return await compilerOperation(request, context);
    if (command === 'clickdummy build') return await buildClickdummy(request, context);
    if (command === 'check') return await checkOperation(request, context);
    if (command === 'check submission') return await submissionCheck(context, request.options['dry-run'] === true);
    if (command.startsWith('airship ') && descriptor(command).effect !== 'plan') return await airshipOperation(request, context);
    if (command === 'plan inspect' || descriptor(command).effect === 'plan') return await fileOperation(request, context);
    if (descriptor(command).effect === 'process') return await processOperation(request, context);
    if (command === 'release operate') {
      const path = stringOption(request.options, 'input');
      requireThat(path, 'INPUT_REQUIRED', 'Supply --input <release-operation.json>.');
      if (request.options['dry-run']) {
        return result(command, {
          execution: 'not-run',
          input: path,
          requestedMode: request.options.execute ? 'candidate-write' : 'remote-discovery',
          candidateEligibility: 'not-checked',
          publication: 'not-authorized',
        }, 'planned');
      }
      const args = ['--input', resolve(context.root, path)];
      if (request.options.execute) {
        const authorization = stringOption(request.options, 'authorize');
        requireThat(authorization, 'RELEASE_AUTHORIZATION',
          'Public execution requires a separate --authorize digest. --yes is not authorization.');
        args.push('--execute', '--authorize', authorization);
      } else {
        requireThat(request.options.authorize === undefined, 'RELEASE_AUTHORIZATION', '--authorize requires --execute.');
      }
      const exit = await runNode(context, 'scripts/release/cli.mjs', args);
      requireThat(!exit.truncated, 'RELEASE_OUTPUT_LIMIT',
        'Release output exceeded its bound; do not infer success or retry writes automatically.');
      return result(command, { execution: exit, receipt: JSON.parse(exit.stdout) });
    }
    return await readOperation(request, context);
  } catch (error) {
    return failure(command, error);
  }
}
