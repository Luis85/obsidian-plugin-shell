import { resolve } from 'node:path';
import { parseJsonData } from '../../../scripts/contracts/json-data.ts';
import { readJson } from '../../adapters/framework/files.ts';
import { loadDefinitions } from '../../../scripts/starters/repository.ts';
import { record, inputValue } from '../../../scripts/starters/validation.ts';
/** Terminal-only presentation and prompts for `new`. The operation result stays the authority. */
import { requireThat, type Context, type Request, type Result } from '../../adapters/framework/contracts.ts';
import { starterCatalog, derivedId, derivedName, invocationDirectory } from '../../adapters/framework/starter-project.ts';
import { parseConfirmation } from '../../../scripts/shared/confirmation.ts';
type Prompt = (query: string) => Promise<string>;
type Write = (text: string) => void;
type Options = Request['options'];
type Definitions = Awaited<ReturnType<typeof loadDefinitions>>;
type Definition = Definitions[number]['definition'];
type StarterInput = Definition['inputs'][number];
async function askTarget(args: string[], prompt: Prompt): Promise<void> {
  if (args[0]) return;
  const answer = (await prompt('New project directory (e.g. ../my-project): ')).trim();
  requireThat(answer, 'TARGET_REQUIRED', 'Supply the new project directory.'); args[0] = invocationDirectory(answer);
}
/** A number selects by position, a word by id, and an empty answer the first starter. */
function pickStarter(definitions: Definitions, answer: string): Definitions[number] | undefined {
  if (/^\d+$/.test(answer)) return definitions[Number(answer) - 1];
  return answer ? definitions.find(entry => entry.definition.id === answer) : definitions[0];
}
async function chooseStarter(definitions: Definitions, options: Options, prompt: Prompt, write: Write): Promise<void> {
  if (typeof options.starter === 'string') return;
  write('\nInstalled starters:\n');
  definitions.forEach(({ definition: d }, index) => write(`  ${index + 1}. ${d.id} — ${d.summary}\n`));
  const selected = pickStarter(definitions, (await prompt(`Starter [1-${definitions.length} or id, default 1]: `)).trim());
  requireThat(selected, 'STARTER_UNKNOWN', 'Choose an installed starter.'); options.starter = selected.definition.id;
}
async function suppliedValues(options: Options, context: Context): Promise<Record<string, unknown>> {
  requireThat(!(options.values && options.answers), 'STARTER_INPUT', 'Use either --values or --answers, not both.');
  if (options.values) return record(await readJson(resolve(context.root, String(options.values))));
  return options.answers ? record(parseJsonData(String(options.answers))) : {};
}
function inputFallback(input: StarterInput, d: Definition, target: string, values: Record<string, unknown>): unknown {
  if (input.id === 'id') return derivedId(target, d.generator.kind === 'companion' ? String(record(d.generator.document.project).id) : d.id);
  if (input.id === 'name') return derivedName(String(values.id ?? 'my-project'));
  return input.default;
}
function inputQuestion(input: StarterInput, fallback: unknown): string {
  const choices = input.choices ? ' (' + input.choices.join(', ') + ')' : '';
  return `${input.label}${choices}${fallback === undefined ? '' : ' [' + String(fallback) + ']'}: `;
}
/** Converts a typed answer after validating its shape; an empty answer takes the fallback. */
function answerValue(input: StarterInput, answer: string, fallback: unknown): unknown {
  if (!answer) return fallback;
  if (input.type === 'boolean') requireThat(/^(true|false|yes|no|y|n)$/i.test(answer), 'STARTER_INPUT', `Answer yes or no for ${input.id}.`);
  if (input.type === 'integer') requireThat(/^-?\d+$/.test(answer), 'STARTER_INPUT', `Enter a whole number for ${input.id}.`);
  if (input.type === 'integer') return Number(answer);
  return input.type === 'boolean' ? /^(true|yes|y)$/i.test(answer) : answer;
}
async function askInputs(d: Definition, target: string, values: Record<string, unknown>, options: Options, prompt: Prompt): Promise<void> {
  for (const input of d.inputs) {
    if (options[input.id] !== undefined && ['id', 'name', 'author'].includes(input.id)) values[input.id] = options[input.id];
    if (values[input.id] !== undefined) continue;
    const fallback = inputFallback(input, d, target, values);
    const answer = (await prompt(inputQuestion(input, fallback))).trim();
    if (!answer && fallback === undefined) { requireThat(!input.required, 'STARTER_INPUT', `Supply ${input.id}.`); continue; }
    values[input.id] = inputValue(answerValue(input, answer, fallback), input);
  }
}
/** Companion starters may opt into Airship and fill a single native file type or context-menu filter. */
async function companionOptions(options: Options, context: Context, prompt: Prompt): Promise<void> {
  if (options.airship === undefined && options['no-airship'] === undefined && parseConfirmation(await prompt('Enable optional Airship tooling? No install or launch [y/N]: ')) === true) options.airship = true;
  const { catalog } = await starterCatalog(context);
  const native = catalog.starters.find(entry => entry.id === options.starter)?.document.design?.nativeIntegrations;
  if (native) await nativeOptions(native, options, prompt);
}
type Native = NonNullable<NonNullable<Awaited<ReturnType<typeof starterCatalog>>['catalog']['starters'][number]['document']['design']>['nativeIntegrations']>;
async function nativeOptions(native: Native, options: Options, prompt: Prompt): Promise<void> {
  if (native.fileTypes.length === 1 && options.extension === undefined) options.extension = (await prompt(`Custom extension [${native.fileTypes[0]!.extension}]: `)).trim() || native.fileTypes[0]!.extension;
  if (native.contextMenus.length === 1 && options.extensions === undefined) options.extensions = (await prompt(`File extension filters [${native.contextMenus[0]!.extensions.join(',')}]: `)).trim() || native.contextMenus[0]!.extensions.join(',');
}
/** Ask only for what is missing; every answer still passes the operation's own validation. */
export async function guidedStarter(request: Request, context: Context, prompt: Prompt, write: Write): Promise<Request> {
  const args = [...request.args], options = { ...request.options };
  await askTarget(args, prompt);
  if (typeof options.from === 'string') return { ...request, args, options };
  const definitions = await loadDefinitions(context.root);
  requireThat(definitions.length, 'STARTER_EMPTY', 'No starters installed. Extract the separate starters ZIP into configs/starters first.');
  await chooseStarter(definitions, options, prompt, write);
  const selected = definitions.find(entry => entry.definition.id === options.starter);
  requireThat(selected, 'STARTER_UNKNOWN', 'Starter is not installed.');
  const d = selected.definition;
  const values = await suppliedValues(options, context);
  await askInputs(d, args[0]!, values, options, prompt);
  // Answers stay data; no editor or third-party process is launched by the wizard.
  delete options.values; options.answers = JSON.stringify(values);
  if (d.generator.kind === 'companion') await companionOptions(options, context, prompt);
  return { ...request, args, options };
}
interface Summary { starter?: { id: string; title: string; version: string; sha256: string }; source?: { file: string; sha256: string; schemaVersion: number }; identity: { id: string; name: string; author: string }; directory: string; vault: string; files: number; acceptanceTodos: number; warnings: string[] }
interface Listing { starters: Array<{ id: string; title: string; category: string; difficulty: string; description: string }> }
interface Review { planHash: string; summary: Summary; conflicts: string[]; next?: string; nextSteps?: string[]; guide?: { readme: string; implementation: string }; install?: Record<string, { exitCode: number }> }
function listingText(starters: Listing['starters']): string {
  return 'Installed JSON starters (local hashes, not signatures):\n' + (starters.length ? '' : 'No starters installed. Extract the separate starters ZIP into configs/starters.\n') + starters.map(entry =>
    `  ${entry.id.padEnd(22)} ${entry.difficulty.padEnd(10)} ${entry.category.padEnd(12)} ${entry.title}: ${entry.description}\n`).join('') + '\nCreate one: node bin/app new ../my-capture --starter <id> [--id my-capture] [--name "My Capture"] --yes\n';
}
function originLine(s: Summary): string {
  if (s.starter) return `  Starter    ${s.starter.id} (${s.starter.title} ${s.starter.version}, sha256 ${s.starter.sha256.slice(0, 12)})`;
  return `  From       ${s.source?.file} (companion project schema ${s.source?.schemaVersion}, sha256 ${s.source?.sha256.slice(0, 12)})`;
}
function followUpLines(data: Review): string[] {
  const lines: string[] = [];
  if (data.next) lines.push('', data.next);
  if (data.install) lines.push('', ...Object.entries(data.install).map(([label, run]) => `${label}: exit ${run.exitCode}`));
  if (data.nextSteps) lines.push('', 'Next steps:', ...data.nextSteps.map(step => '  ' + step));
  if (data.guide) lines.push('', `Read ${data.guide.readme} and ${data.guide.implementation}.`);
  return lines;
}
/** Returns null when the generic renderer should present the result (failures keep their recovery data). */
export function starterText(value: Result): string | null {
  if (value.status === 'failed') return null;
  if (value.status === 'cancelled') return 'new: cancelled; nothing was written.\n';
  const data = value.data as Listing & Review;
  if (Array.isArray(data.starters)) return listingText(data.starters);
  const s = data.summary, lines = [`new: ${value.status}`, originLine(s),
    `  Project    ${s.identity.id} "${s.identity.name}"${s.identity.author ? ' by ' + s.identity.author : ''}`,
    `  Directory  ${s.directory}`, `  Files      ${s.files} generated, including provenance`,
    `  Plan hash  ${data.planHash}`, `  PRD TODOs  ${s.acceptanceTodos} acceptance obligations remain TODO`,
    `  Warnings   ${s.warnings.length ? s.warnings.length + ' scaffold boundaries (listed in --json and design/traceability.json)' : 'none'}`,
    `  Conflicts  ${data.conflicts.length ? data.conflicts.join('; ') : 'none'}`, ...followUpLines(data)];
  return lines.join('\n') + '\n';
}
