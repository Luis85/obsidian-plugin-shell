/** Terminal-only presentation and prompts for `new`. The operation result stays the authority. */
import { requireThat, type Context, type Request, type Result } from './contracts.ts';
import { starterCatalog, derivedId, derivedName, pluginIdProblem, invocationDirectory } from './starter-project.ts';
type Prompt = (query: string) => Promise<string>;
type Write = (text: string) => void;
/** Ask only for what is missing; every answer still passes the operation's own validation. */
export async function guidedStarter(request: Request, context: Context, prompt: Prompt, write: Write): Promise<Request> {
  const args = [...request.args], options = { ...request.options };
  const { catalog } = await starterCatalog(context);
  if (!args[0]) {
    const answer = (await prompt('New project directory (outside this checkout, e.g. ../my-plugin): ')).trim();
    requireThat(answer, 'TARGET_REQUIRED', 'Supply the new project directory.'); args[0] = invocationDirectory(answer);
  }
  if (typeof options.starter !== 'string') {
    write('\nStarters:\n');
    catalog.starters.forEach((entry, index) => write(`  ${String(index + 1).padStart(2)}. ${entry.id.padEnd(22)} ${entry.level.padEnd(10)} ${entry.summary}\n`));
    const answer = (await prompt(`Starter [1-${catalog.starters.length} or id, default 1]: `)).trim();
    const chosen = /^\d+$/.test(answer) ? catalog.starters[Number(answer) - 1] : answer ? catalog.starters.find(entry => entry.id === answer) : catalog.starters[0];
    requireThat(chosen, 'STARTER_UNKNOWN', `Unknown starter ${answer}; use new --list.`); options.starter = chosen.id;
  }
  if (typeof options.id !== 'string') {
    const entry = catalog.starters.find(item => item.id === options.starter);
    const fallback = derivedId(args[0], entry?.document.project.id ?? 'my-plugin');
    for (let attempt = 0; attempt < 3 && typeof options.id !== 'string'; attempt++) {
      const answer = (await prompt(`Plugin ID [${fallback}]: `)).trim() || fallback, problem = pluginIdProblem(answer);
      if (problem) write(problem + '\n'); else options.id = answer;
    }
    requireThat(typeof options.id === 'string', 'INVALID_PLUGIN_ID', 'No valid plugin ID was entered.');
  }
  if (typeof options.name !== 'string') options.name = (await prompt(`Plugin name [${derivedName(options.id)}]: `)).trim() || derivedName(options.id);
  return { ...request, args, options };
}
interface Summary { starter: { id: string; title: string; version: string; sha256: string }; identity: { id: string; name: string; author: string }; directory: string; vault: string; files: number; acceptanceTodos: number; warnings: string[] }
interface Listing { starters: Array<{ id: string; title: string; category: string; difficulty: string; description: string }> }
interface Review { planHash: string; summary: Summary; conflicts: string[]; next?: string; nextSteps?: string[]; guide?: { readme: string; implementation: string }; install?: Record<string, { exitCode: number }> }
/** Returns null when the generic renderer should present the result (failures keep their recovery data). */
export function starterText(value: Result): string | null {
  if (value.status === 'failed') return null;
  if (value.status === 'cancelled') return 'new: cancelled; nothing was written.\n';
  const data = value.data as Listing & Review;
  if (Array.isArray(data.starters)) return 'Starters (catalog SHA-256 verified):\n' + data.starters.map(entry =>
    `  ${entry.id.padEnd(22)} ${entry.difficulty.padEnd(10)} ${entry.category.padEnd(12)} ${entry.title}: ${entry.description}\n`).join('') + '\nCreate one: node shell.mjs new ../my-plugin --starter <id> [--id my-plugin] [--name "My Plugin"] --yes\n';
  const s = data.summary, lines = [`new: ${value.status}`,
    `  Starter    ${s.starter.id} (${s.starter.title} ${s.starter.version}, sha256 ${s.starter.sha256.slice(0, 12)})`,
    `  Plugin     ${s.identity.id} "${s.identity.name}"${s.identity.author ? ' by ' + s.identity.author : ''}`,
    `  Directory  ${s.directory}`, `  Files      ${s.files} generated (+ .companion/generation.json ownership receipt)`,
    `  Plan hash  ${data.planHash}`, `  PRD TODOs  ${s.acceptanceTodos} acceptance obligations remain TODO`,
    `  Warnings   ${s.warnings.length ? s.warnings.length + ' scaffold boundaries (listed in --json and design/traceability.json)' : 'none'}`,
    `  Conflicts  ${data.conflicts.length ? data.conflicts.join('; ') : 'none'}`];
  if (data.next) lines.push('', data.next);
  if (data.install) lines.push('', ...Object.entries(data.install).map(([label, run]) => `${label}: exit ${run.exitCode}`));
  if (data.nextSteps) lines.push('', 'Next steps:', ...data.nextSteps.map(step => '  ' + step));
  if (data.guide) lines.push('', `Read ${data.guide.readme} and ${data.guide.implementation}.`);
  return lines.join('\n') + '\n';
}
