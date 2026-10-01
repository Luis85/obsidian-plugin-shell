import type { Context, Request, Result } from '../../adapters/framework/contracts.ts';
import { parseConfirmation } from '../../../scripts/shared/confirmation.ts';
type Execute = (request: Request, context: Context) => Promise<Result>;
type Prompt = (message: string) => Promise<string>;
/** Invoked only by the interactive setup adapter; each documentation write has its own reviewed approval. */
export async function setupDocumentation(direction: 'import' | 'export', current: Result, context: Context, execute: Execute, prompt: Prompt, render: (result: Result) => void, sources?: string[]): Promise<Result> {
  const question = sources ? `Import ${sources.length} supported typed note(s) found in the Obsidian vault?`
    : direction === 'import' ? 'Import typed Markdown application docs before source generation?' : 'Generate or update Markdown documentation for the accepted project?';
  if (parseConfirmation(await prompt(question + ' [y/N] ')) !== true) return current;
  const path = direction === 'import' && !sources ? (await prompt('File or folder [configured documentation paths]: ')).trim() : '';
  const request: Request = { command: 'docs ' + direction, args: sources ?? (path ? [path] : []), options: {} };
  const plan = await execute(request, context); render(plan);
  const planHash = (plan.data as { planHash?: string } | null)?.planHash;
  if (plan.status !== 'planned' || !planHash) return plan;
  if (parseConfirmation(await prompt('Apply these reviewed documentation changes? [y/N] ')) !== true) return { ...plan, status: 'cancelled' };
  const outcome = await execute({ ...request, options: { apply: planHash, yes: true } }, context); render(outcome); return outcome;
}
