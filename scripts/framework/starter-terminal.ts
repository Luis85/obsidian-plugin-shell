import { resolve } from 'node:path';
import { parseJsonData } from '../contracts/json-data.mjs';
import { readJson } from './files.ts';
import { loadDefinitions } from '../starters/repository.ts';
import { record, inputValue } from '../starters/validation.ts';
/** Terminal-only presentation and prompts for `new`. The operation result stays the authority. */
import { requireThat, type Context, type Request, type Result } from './contracts.ts';
import { starterCatalog, derivedId, derivedName, invocationDirectory } from './starter-project.ts';
type Prompt = (query: string) => Promise<string>;
type Write = (text: string) => void;
/** Ask only for what is missing; every answer still passes the operation's own validation. */
export async function guidedStarter(request: Request, context: Context, prompt: Prompt, write: Write): Promise<Request> {
  const args = [...request.args], options = { ...request.options };
  if (!args[0]) {
    const answer = (await prompt('New project directory (e.g. ../my-project): ')).trim();
    requireThat(answer, 'TARGET_REQUIRED', 'Supply the new project directory.'); args[0] = invocationDirectory(answer);
  }
  if (typeof options.from === 'string') return { ...request, args, options };
  const definitions = await loadDefinitions(context.root);
  requireThat(definitions.length, 'STARTER_EMPTY', 'No starters installed. Extract the separate starters ZIP into configs/starters first.');
  if (typeof options.starter !== 'string') {
    write('\nInstalled starters:\n');
    definitions.forEach(({ definition: d }, index) => write(`  ${index + 1}. ${d.id} — ${d.summary}\n`));
    const answer = (await prompt(`Starter [1-${definitions.length} or id, default 1]: `)).trim();
    const selected = /^\d+$/.test(answer) ? definitions[Number(answer) - 1] : answer ? definitions.find(entry => entry.definition.id === answer) : definitions[0];
    requireThat(selected, 'STARTER_UNKNOWN', 'Choose an installed starter.'); options.starter = selected.definition.id;
  }
  const selected = definitions.find(entry => entry.definition.id === options.starter);
  requireThat(selected, 'STARTER_UNKNOWN', 'Starter is not installed.');
  const d = selected.definition;
  requireThat(!(options.values && options.answers), 'STARTER_INPUT', 'Use either --values or --answers, not both.');
  const values = options.values ? record(await readJson(resolve(context.root, String(options.values)))) : options.answers ? record(parseJsonData(String(options.answers))) : {};
  for (const input of d.inputs) {
    if (options[input.id] !== undefined && ['id', 'name', 'author'].includes(input.id)) values[input.id] = options[input.id];
    if (values[input.id] !== undefined) continue;
    const fallback = input.id === 'id' ? derivedId(args[0]!, d.generator.kind === 'companion' ? String(record(d.generator.document.project).id) : d.id) : input.id === 'name' ? derivedName(String(values.id ?? 'my-project')) : input.default;
    const answer = (await prompt(`${input.label}${input.choices ? ' (' + input.choices.join(', ') + ')' : ''}${fallback === undefined ? '' : ' [' + String(fallback) + ']'}: `)).trim();
    if (!answer && fallback === undefined) { requireThat(!input.required, 'STARTER_INPUT', `Supply ${input.id}.`); continue; }
    if (answer && input.type === 'boolean') requireThat(/^(true|false|yes|no|y|n)$/i.test(answer), 'STARTER_INPUT', `Answer yes or no for ${input.id}.`);
    if (answer && input.type === 'integer') requireThat(/^-?\d+$/.test(answer), 'STARTER_INPUT', `Enter a whole number for ${input.id}.`);
    const value = !answer && fallback !== undefined ? fallback : input.type === 'integer' ? Number(answer) : input.type === 'boolean' ? /^(true|yes|y)$/i.test(answer) : answer;
    values[input.id] = inputValue(value, input);
  }
  // Answers stay data; no editor or third-party process is launched by the wizard.
  delete options.values; options.answers = JSON.stringify(values);
  if (d.generator.kind === 'companion') {
    if (options.airship === undefined && options['no-airship'] === undefined && /^y(?:es)?$/i.test((await prompt('Enable optional Airship tooling? No install or launch [y/N]: ')).trim())) options.airship = true;
    const { catalog } = await starterCatalog(context);
    const native = catalog.starters.find(entry => entry.id === options.starter)?.document.design?.nativeIntegrations;
    if (native?.fileTypes.length === 1 && options.extension === undefined) options.extension = (await prompt(`Custom extension [${native.fileTypes[0]!.extension}]: `)).trim() || native.fileTypes[0]!.extension;
    if (native?.contextMenus.length === 1 && options.extensions === undefined) options.extensions = (await prompt(`File extension filters [${native.contextMenus[0]!.extensions.join(',')}]: `)).trim() || native.contextMenus[0]!.extensions.join(',');
  }
  return { ...request, args, options };
}
interface Summary { starter?: { id: string; title: string; version: string; sha256: string }; source?: { file: string; sha256: string; schemaVersion: number }; identity: { id: string; name: string; author: string }; directory: string; vault: string; files: number; acceptanceTodos: number; warnings: string[] }
interface Listing { starters: Array<{ id: string; title: string; category: string; difficulty: string; description: string }> }
interface Review { planHash: string; summary: Summary; conflicts: string[]; next?: string; nextSteps?: string[]; guide?: { readme: string; implementation: string }; install?: Record<string, { exitCode: number }> }
/** Returns null when the generic renderer should present the result (failures keep their recovery data). */
export function starterText(value: Result): string | null {
  if (value.status === 'failed') return null;
  if (value.status === 'cancelled') return 'new: cancelled; nothing was written.\n';
  const data = value.data as Listing & Review;
  if (Array.isArray(data.starters)) return 'Installed JSON starters (local hashes, not signatures):\n' + (data.starters.length ? '' : 'No starters installed. Extract the separate starters ZIP into configs/starters.\n') + data.starters.map(entry =>
    `  ${entry.id.padEnd(22)} ${entry.difficulty.padEnd(10)} ${entry.category.padEnd(12)} ${entry.title}: ${entry.description}\n`).join('') + '\nCreate one: node shell.mjs new ../my-capture --starter <id> [--id my-capture] [--name "My Capture"] --yes\n';
  const s = data.summary, lines = [`new: ${value.status}`,
    s.starter ? `  Starter    ${s.starter.id} (${s.starter.title} ${s.starter.version}, sha256 ${s.starter.sha256.slice(0, 12)})`
      : `  From       ${s.source?.file} (companion project schema ${s.source?.schemaVersion}, sha256 ${s.source?.sha256.slice(0, 12)})`,
    `  Project    ${s.identity.id} "${s.identity.name}"${s.identity.author ? ' by ' + s.identity.author : ''}`,
    `  Directory  ${s.directory}`, `  Files      ${s.files} generated, including provenance`,
    `  Plan hash  ${data.planHash}`, `  PRD TODOs  ${s.acceptanceTodos} acceptance obligations remain TODO`,
    `  Warnings   ${s.warnings.length ? s.warnings.length + ' scaffold boundaries (listed in --json and design/traceability.json)' : 'none'}`,
    `  Conflicts  ${data.conflicts.length ? data.conflicts.join('; ') : 'none'}`];
  if (data.next) lines.push('', data.next);
  if (data.install) lines.push('', ...Object.entries(data.install).map(([label, run]) => `${label}: exit ${run.exitCode}`));
  if (data.nextSteps) lines.push('', 'Next steps:', ...data.nextSteps.map(step => '  ' + step));
  if (data.guide) lines.push('', `Read ${data.guide.readme} and ${data.guide.implementation}.`);
  return lines.join('\n') + '\n';
}
