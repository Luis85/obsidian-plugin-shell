import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Page } from '@playwright/test';

export const reportsRoot = resolve('reports/obsidian');

/** A fresh evidence folder per case: reports/obsidian/cases/<file>--<test name>. */
export async function caseDirectory(file: string, name: string): Promise<string> {
  const safe = `${basename(file).replace(/\.obsidian\.ts$/, '')}--${name}`.replace(/[^a-z0-9_-]+/giu, '-').replace(/^-+|-+$/g, '').slice(0, 160);
  const directory = join(reportsRoot, 'cases', safe);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  return directory;
}
export async function writeEvidence(directory: string, name: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value, (_key, item: unknown) => item instanceof Error
    ? { name: item.name, message: item.message, stack: item.stack, ...(item instanceof AggregateError ? { errors: item.errors as unknown[] } : {}) }
    : item, 2);
  await writeFile(join(directory, `${name}.json`), `${text}\n`);
}
export function sourceCommit(): string {
  const declared = process.env.SOURCE_COMMIT ?? process.env.GITHUB_SHA;
  if (declared) return declared;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim(); }
  catch { return 'unknown'; }
}
/** Screenshot and DOM for every case, captured before the host is closed; failures are recorded, not thrown. */
export async function capturePage(page: Page, directory: string, name = 'final'): Promise<void> {
  const errors: unknown[] = [];
  try { await page.screenshot({ path: join(directory, `${name}.png`) }); } catch (error) { errors.push(error); }
  try { await writeFile(join(directory, `${name}.html`), await page.content()); } catch (error) { errors.push(error); }
  if (errors.length) await writeEvidence(directory, `${name}-capture-errors`, errors);
}
