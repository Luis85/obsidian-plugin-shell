import { resolve } from 'node:path';
import { readInput } from '../../scripts/shared/input.ts';
import { parseJsonData } from '../../scripts/contracts/json-data.ts';
import type { Arguments, CommandContext } from './commands.ts';
import { option } from '../domain/command-options.ts';
import { requireSketch, SketchError } from '../domain/errors.ts';
import { projectGuide, projectRequest, projectPlan, projectStarter, projectStarters } from './projects.ts';
import { readData, applyPrepared } from './storage.ts';
const projectFlow = ['starter', 'prototype', 'agreement', 'plan-review', 'apply'];
export async function newProjectCommand(args: Arguments, context: CommandContext): Promise<Record<string, unknown>> {
  const allowed = ['root', 'json', 'no-interaction', 'help', 'no-color', 'ui', 'input', 'out', 'apply', 'starter'];
  requireSketch(Object.keys(args.flags).every(key => allowed.includes(key)), 'PROJECT_OPTION', 'Use new --help for project-creation options; baseline and output-kind options are not accepted.');
  if (args.action === 'starters') {
    requireSketch(!['input', 'apply', 'starter', 'out'].some(key => args.flags[key]), 'PROJECT_OPTION', 'Starter discovery does not accept input, selection or write options.');
    const starters = (await projectStarters(context.frameworkRoot)).map(({ selection, ...starter }) => ({ ...starter,
      projectType: selection.projectType, framework: selection.framework, targets: selection.targets }));
    return { starters, flow: projectFlow };
  }
  if (args.action === 'guide') return discoverGuide(args, context);
  requireSketch(!args.action || args.action === 'validate', 'MAKER_COMMAND', 'Use new starters, new guide, new validate, or new --input.');
  if (args.flags.starter) await refuseStarterFlag(args, context);
  const data = await requestData(args, context);
  if (args.action === 'validate') {
    requireSketch(!args.flags.apply && !args.flags.out, 'PROJECT_OPTION', 'Validation never writes; omit --apply and --out.');
    const request = await projectRequest(data, context.frameworkRoot);
    return { selection: request.selection, answers: request.answers, ready: request.ready, pending: request.pending, brief: request.brief };
  }
  const plan = await projectPlan({ ...context, input: data, out: option(args, 'out', 'projects/prepared-project') });
  return applyPrepared(plan, option(args, 'apply') || undefined, context.signal);
}
/** Non-interactive `new --starter <id>` cannot run an interview; say which route fits the starter. */
async function refuseStarterFlag(args: Arguments, context: CommandContext): Promise<never> {
  requireSketch(!args.flags.input, 'PROJECT_AMBIGUOUS_INPUT', 'Put the starter ID in --input for agent mode; do not override a reviewed request with --starter.');
  const id = option(args, 'starter');
  requireSketch((await projectStarters(context.frameworkRoot)).some(item => item.id === id), 'TARGET_REQUIRED', `${id} is not an installed project starter. File and Companion starters need a directory: new <dir> --starter ${id}.`);
  throw new SketchError('PROJECT_TERMINAL_REQUIRED', `Run new --starter ${id} in a terminal, or use new guide --starter ${id} --json and new --input for agents.`);
}
async function discoverGuide(args: Arguments, context: CommandContext) {
  requireSketch(!args.flags.input && !args.flags.apply && !args.flags.out, 'PROJECT_OPTION', 'Guide discovery does not accept input or write options.');
  requireSketch(args.flags.starter, 'PROJECT_STARTER_REQUIRED', 'Choose a project starter: new guide --starter <id> --json. List them with new starters --json.');
  const { selection } = await projectStarter(context.frameworkRoot, option(args, 'starter'));
  const guide = await projectGuide(selection);
  return { selection, guide, input: { schemaVersion: 2, starter: selection.starter.id, interview: { schemaVersion: 1, guideId: guide.id, guideVersion: guide.version,
    answers: Object.fromEntries(guide.steps.flatMap(step => step.fields).filter(field => !field.when).map(field => [field.id, field.default])) } } };
}
async function requestData(args: Arguments, context: CommandContext): Promise<unknown> {
  const input = option(args, 'input');
  requireSketch(input, 'MAKER_INPUT_REQUIRED', 'Use new guide --starter <id> --json to discover the request, then new --input <file|-> --json.');
  return input === '-' ? parseJsonData(await readInput(context.input, context.signal)) : await readData(resolve(context.root, input));
}
