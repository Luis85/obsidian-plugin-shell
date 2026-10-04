import { OperationError, type Context, type Request, type Result } from '../../adapters/framework/contracts.ts';
import { Back } from '../prompts.ts';
import { startWizard } from '../wizards/registry.ts';
import { starterRequest } from '../wizards/starter.ts';
/** Terminal-only presentation and prompts for `new`. The operation result stays the authority. */
type Prompt = (query: string) => Promise<string>;
type Write = (text: string) => void;
/**
 * The interview defined by configs/wizards/new-starter.json asks only for what is missing; every answer still passes the
 * operation's own validation. Going back from the first question cancels before anything is written.
 */
export async function guidedStarter(request: Request, context: Context, prompt: Prompt, write: Write): Promise<Request> {
  const state = { request: { args: [...request.args], options: { ...request.options } } };
  try { await startWizard({ ask: prompt, write }, 'new-starter', { ...context }, state); }
  catch (error) { if (error instanceof Back) throw new OperationError('CANCELLED', 'new cancelled; nothing was written.'); throw error; }
  const { args, options } = starterRequest(state, 'result');
  return { ...request, args, options };
}
interface Summary { starter?: { id: string; title: string; version: string; sha256: string }; source?: { file: string; sha256: string; schemaVersion: number }; identity: { id: string; name: string; author: string }; directory: string; vault: string; files: number; acceptanceTodos: number; warnings: string[]; hosting?: { platform: string; connect: string[] } }
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
  const hosting = data.summary?.hosting;
  if (data.nextSteps && hosting) lines.push('', `Hosting ${hosting.platform} (commands are printed, never run):`, ...hosting.connect.map(step => '  ' + step));
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
    ...(s.hosting ? [`  Hosting    ${s.hosting.platform}`] : []),
    `  Conflicts  ${data.conflicts.length ? data.conflicts.join('; ') : 'none'}`, ...followUpLines(data)];
  return lines.join('\n') + '\n';
}
