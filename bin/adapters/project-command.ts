import { legacyProjectCommand } from './legacy-project-command.ts';
import { resolve } from 'node:path';
import { readInput } from '../../scripts/framework/input.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.mjs';
import { projectSelectionRequest, resolveProjectSelection, type ProjectCatalog } from '../../scripts/compiler/domain/project-presets.ts';
import type { Arguments, CommandContext } from './commands.ts';
import { option } from '../domain/command-options.ts';
import { requireSketch } from '../domain/errors.ts';
import { loadProjectCatalog, projectGuide, projectRequest, projectPlan } from './projects.ts';
import { readData, applyPrepared } from './storage.ts';
export async function newProjectCommand(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const allowed = ['root', 'json', 'no-interaction', 'help', 'no-color', 'ui', 'input', 'out', 'apply', 'preset', 'framework', 'targets'];
  requireSketch(Object.keys(args.flags).every(key => allowed.includes(key)), 'PROJECT_OPTION', 'Use new --help for project-creation options; baseline and output-kind options are not accepted.');
  const catalog = await loadProjectCatalog();
  if (args.action === 'presets') {
    requireSketch(!['input', 'apply', 'preset', 'framework', 'targets', 'out'].some(key => args.flags[key]), 'PROJECT_OPTION', 'Preset discovery does not accept input or write options.');
    return { catalog, flow: ['preset', 'framework', 'hybrid-targets-if-needed', 'prototype', 'agreement', 'plan-review', 'apply'] };
  }
  if (args.action === 'guide') return discoverGuide(args, catalog);
  requireSketch(!args.action || args.action === 'validate', 'MAKER_COMMAND', 'Use new presets, new guide, new validate, or new --input.');
  requireSketch(!['preset', 'framework', 'targets'].some(key => args.flags[key]), 'PROJECT_AMBIGUOUS_INPUT', 'Put selection in --input for agent mode; do not override a reviewed request with selection flags.');
  const data = await requestData(args, context);
  if (data !== null && typeof data === 'object' && Object.hasOwn(data, 'prototypeRequest')) return legacyProjectCommand(args, context, data);
  if (args.action === 'validate') {
    requireSketch(!args.flags.apply && !args.flags.out, 'PROJECT_OPTION', 'Validation never writes; omit --apply and --out.');
    const request = await projectRequest(data);
    return { selection: request.selection, answers: request.answers, ready: request.ready, pending: request.pending, brief: request.brief };
  }
  const plan = await projectPlan({ ...context, input: data, out: option(args, 'out', 'projects/prepared-project') });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}

async function discoverGuide(args: Arguments, catalog: ProjectCatalog) {
    requireSketch(!args.flags.input && !args.flags.apply && !args.flags.out, 'PROJECT_OPTION', 'Guide discovery does not accept input or write options.');
    const selection = resolveProjectSelection(catalog, { schemaVersion: 1, catalogVersion: catalog.version,
      preset: option(args, 'preset', 'plugin-nuxtui'), ...(args.flags.framework ? { framework: option(args, 'framework') } : {}),
      ...(args.flags.targets ? { targets: option(args, 'targets').split(',') } : {}) });
    const guide = await projectGuide(selection, catalog);
    const configuration = projectSelectionRequest(selection);
    return { selection, guide, input: { ...configuration, interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version,
      answers: Object.fromEntries(guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => [field.id, field.default])) } } };
  }

async function requestData(args: Arguments, context: CommandContext): Promise<unknown> {
  const input = option(args, 'input');
  requireSketch(input, 'MAKER_INPUT_REQUIRED', 'Use new guide --preset <id> --json to discover the request, then new --input <file|-> --json.');
  return input === '-' ? parseJsonData(await readInput(context.input, context.signal)) : await readData(resolve(context.root, input));
}
