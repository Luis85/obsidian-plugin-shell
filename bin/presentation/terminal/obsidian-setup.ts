import type { Context, Request, Result } from '../../adapters/framework/contracts.ts';
import { parseConfirmation } from '../../../scripts/shared/confirmation.ts';
type Execute = (request: Request, context: Context) => Promise<Result>;
type Prompt = (message: string) => Promise<string>;
const yes = (answer: string) => parseConfirmation(answer) === true;

/** The note paths of each proposed `docs import` batch, without the command words and flags. */
function importBatches(report: Result): string[][] {
  const batches = (report.data as { import?: { batches?: unknown } } | null)?.import?.batches;
  if (!Array.isArray(batches)) return [];
  return batches.filter(Array.isArray).map(batch => batch.slice(4).filter((arg): arg is string => typeof arg === 'string' && !arg.startsWith('--')))
    .filter(batch => batch.length > 0);
}
/**
 * Interactive setup only: an opt-in, read-only connection to one named vault through the official Obsidian CLI.
 * `obsidian status` verifies the CLI and the vault; `obsidian prepare` scans the configured documentation paths.
 * Neither writes to the vault or stores the vault name. The supported typed notes it finds are returned as
 * batches for the existing reviewed `docs import`; an unavailable CLI or vault only skips this step.
 */
export async function setupObsidian(context: Context, execute: Execute, prompt: Prompt, render: (result: Result) => void): Promise<string[][]> {
  if (!yes(await prompt('Connect an Obsidian vault through the official Obsidian CLI (desktop 1.12.7+, read-only)? [y/N] '))) return [];
  const vault = (await prompt('Obsidian vault name or ID: ')).trim();
  if (!vault) return [];
  const options = { 'obsidian-vault': vault };
  const status = await execute({ command: 'obsidian status', args: [], options }, context); render(status);
  if (status.status !== 'ok') return [];
  if (!yes(await prompt('Prepare the vault now? Scans the configured documentation paths for supported typed Markdown; nothing in the vault changes. [y/N] '))) return [];
  const report = await execute({ command: 'obsidian prepare', args: [], options }, context); render(report);
  return report.status === 'ok' ? importBatches(report) : [];
}
