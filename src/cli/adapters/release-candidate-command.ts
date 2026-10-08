import { option, type Arguments } from '../domain/command-options.ts';
import { requireSketch, SketchError } from '#shared/contracts/sketch-errors.ts';
import { readCandidateInput, readCandidateVersion } from '../domain/release-candidate.ts';
import { applyPrepared, type Prepared } from './storage.ts';
import { candidateViews, candidateWorld, candidateWorldFindings, openCandidates, type CandidateContext } from './release-candidate-store.ts';
import { candidateAddPlan, candidateCreatePlan, candidateDocsPlan, candidateRemovePlan, candidateStatusPlan, candidateTarget } from './release-candidate-plan.ts';
import type { CommandContext } from './commands.ts';
/** Actions that need a person; `candidate new` without --input runs the candidate-new wizard in a terminal. */
export const candidateInteractiveActions: readonly string[] = ['new'];
interface Invocation { args: Arguments; candidates: CandidateContext; context: CommandContext; input: () => Promise<unknown> }
const planned = async (call: Invocation, plan: Promise<Prepared>) => applyPrepared(await plan, option(call.args, 'apply') || undefined, call.context.signal);
function required(args: Arguments, name: string, hint: string): string {
  const value = option(args, name);
  requireSketch(value, 'CANDIDATE_OPTION', `Use candidate ${args.action} ${hint}.`);
  return value;
}
const versionOf = (args: Arguments) => readCandidateVersion(required(args, 'version', '--version <x.y.z>'));
const itemOf = (args: Arguments) => required(args, 'item', '--version <x.y.z> --item ITEM-0001');
async function list(call: Invocation): Promise<Record<string, unknown>> {
  const world = await candidateWorld(call.candidates), findings = candidateWorldFindings(world, world.items);
  const valid = world.snapshot.candidates.filter(note => note.record && !note.issues.some(item => item.severity === 'error'));
  const rows = valid.map(note => ({ version: note.record!.version, status: note.record!.status, targetDate: note.record!.targetDate ?? null, owner: note.record!.owner ?? null,
    items: note.record!.items, path: note.path, errors: findings.filter(item => item.severity === 'error' && item.path === note.path).length }));
  return { folder: call.candidates.folder, asOf: call.candidates.asOf, count: rows.length, candidates: rows.sort((a, b) => a.version.localeCompare(b.version, 'en', { numeric: true })),
    needsAttention: world.snapshot.candidates.filter(note => !valid.includes(note)).map(note => ({ path: note.path, state: note.state, issues: note.issues })), ignored: world.snapshot.ignored };
}
async function show(call: Invocation): Promise<Record<string, unknown>> {
  const version = versionOf(call.args), target = await candidateTarget(call.candidates, version), { world, note } = target;
  const findings = candidateWorldFindings(world, world.items).filter(item => item.id === version || item.path === note!.path);
  const views = candidateViews(world, world.items, note!.record, target.path);
  return { version, path: target.path, sha256: note!.beforeHash, record: note!.record, items: views.increments, missing: views.missing, risks: views.risks, findings, content: note!.content };
}
async function check(call: Invocation): Promise<Record<string, unknown>> {
  const world = await candidateWorld(call.candidates), issues = candidateWorldFindings(world, world.items);
  const errors = issues.filter(item => item.severity === 'error').length;
  return { folder: call.candidates.folder, itemsFolder: call.candidates.increments.folder, asOf: call.candidates.asOf, candidates: world.snapshot.candidates.length,
    errors, warnings: issues.length - errors, issues, ignored: world.snapshot.ignored, status: errors ? 'failed' : 'ok' };
}
/** `candidate new --version <v> [--input <file>]`: the input may add targetDate, owner, release items and a goal; a version in both places must agree. */
async function create(call: Invocation): Promise<Record<string, unknown>> {
  const prefix = call.candidates.increments.loaded.definition.idPrefix;
  const input = readCandidateInput(option(call.args, 'input') ? await call.input() : {}, prefix), flag = option(call.args, 'version');
  const version = flag ? readCandidateVersion(flag) : input.version;
  requireSketch(version, 'CANDIDATE_OPTION', 'Use candidate new --version <x.y.z> (or a version in the --input file).');
  requireSketch(!input.version || input.version === version, 'CANDIDATE_INPUT', `--version ${version} and the input version ${input.version} differ.`);
  return planned(call, candidateCreatePlan(call.candidates, { ...input, version }));
}
const actions: Readonly<Record<string, (call: Invocation) => Promise<Record<string, unknown>>>> = {
  '': list,
  list,
  show,
  check,
  new: create,
  add: call => planned(call, candidateAddPlan(call.candidates, versionOf(call.args), itemOf(call.args))),
  remove: call => planned(call, candidateRemovePlan(call.candidates, versionOf(call.args), itemOf(call.args))),
  status: call => planned(call, candidateStatusPlan(call.candidates, versionOf(call.args), required(call.args, 'to', '--version <x.y.z> --to <draft|frozen|qualified|released|abandoned>'))),
  docs: call => planned(call, candidateDocsPlan(call.candidates, versionOf(call.args))),
};
/**
 * `node bin/app candidate …`: list, show and check read; new, add, remove, status and docs plan one reviewed write
 * (the README and every release item note it moves) that only `--apply <planHash>` performs.
 */
export async function candidateCommand(args: Arguments, context: CommandContext, input: () => Promise<unknown>): Promise<Record<string, unknown>> {
  const action = Object.hasOwn(actions, args.action) ? actions[args.action] : undefined;
  if (!action) throw new SketchError('CANDIDATE_COMMAND', 'Use candidate list|show|check|new|add|remove|status|docs, or candidate new in a terminal.');
  return action({ args, context, input, candidates: await openCandidates(context.root, option(args, 'as-of') || undefined) });
}
