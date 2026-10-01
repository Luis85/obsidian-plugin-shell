import type { Context, Request, Result } from '../../adapters/framework/contracts.ts';
import { parseConfirmation } from '../../../scripts/shared/confirmation.ts';
type Execute = (request: Request, context: Context) => Promise<Result>;
type Prompt = (message: string) => Promise<string>;
function question(direction: 'import' | 'export', sources?: string[]): string {
  if (sources) return `Import ${sources.length} supported typed note(s) found in the Obsidian vault?`;
  return direction === 'import' ? 'Import typed Markdown application docs before source generation?' : 'Generate or update Markdown documentation for the accepted project?';
}
async function documentationArgs(direction: 'import' | 'export', prompt: Prompt, sources?: string[]): Promise<string[]> {
  if (sources) return sources;
  const path = direction === 'import' ? (await prompt('File or folder [configured documentation paths]: ')).trim() : '';
  return path ? [path] : [];
}
/** Invoked only by the interactive setup adapter; each documentation write has its own reviewed approval. */
export async function setupDocumentation(direction: 'import' | 'export', current: Result, context: Context, execute: Execute, prompt: Prompt, render: (result: Result) => void, sources?: string[]): Promise<Result> {
  if (parseConfirmation(await prompt(question(direction, sources) + ' [y/N] ')) !== true) return current;
  const request: Request = { command: 'docs ' + direction, args: await documentationArgs(direction, prompt, sources), options: {} };
  const plan = await execute(request, context); render(plan);
  const planHash = (plan.data as { planHash?: string } | null)?.planHash;
  if (plan.status !== 'planned' || !planHash) return plan;
  if (parseConfirmation(await prompt('Apply these reviewed documentation changes? [y/N] ')) !== true) return { ...plan, status: 'cancelled' };
  const outcome = await execute({ ...request, options: { apply: planHash, yes: true } }, context); render(outcome); return outcome;
}
