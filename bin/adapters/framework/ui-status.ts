import { readdir } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';
import { collectUiStatus, isUiProject, type UiStatusPort } from '../../application/ui-status.ts';
import type { ReportRead } from '../../domain/ui-status-evidence.ts';
import type { SpecFile } from '../../domain/ui-status-source.ts';
import { parseJsonData } from '../../../scripts/contracts/json-data.ts';
import { readBounded } from './files.ts';
import { OperationError, result, type Context, type Request, type Result } from './contracts.ts';

const SPEC_ROOT = 'tests/e2e', SPEC_PATTERN = /\.spec\.(?:ts|mts|js|mjs)$/, SPEC_LIMIT = 500, JSON_LIMIT = 16_000_000;
/** Project-relative POSIX paths only: no absolute, parent or NUL segments, whatever the traceability file claims. */
function containedPath(path: string): boolean {
  const clean = normalize(path);
  return !isAbsolute(path) && !path.includes('\0') && !path.includes('\\') && clean !== '..' && !clean.startsWith('../') && clean !== '.';
}
const missing = (error: unknown): boolean => error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
async function jsonReport(root: string, path: string): Promise<ReportRead> {
  try {
    const bytes = await readBounded(join(root, path), JSON_LIMIT);
    return { state: 'present', value: parseJsonData(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } catch (error) { return missing(error) ? { state: 'absent' } : { state: 'invalid' }; }
}
async function textFile(root: string, path: string): Promise<string | null> {
  if (!containedPath(path)) return null;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(join(root, path))); } catch { return null; }
}
async function walk(root: string, folder: string, found: string[], depth: number): Promise<void> {
  if (depth > 6 || found.length >= SPEC_LIMIT) return;
  const entries = await readdir(join(root, folder), { withFileTypes: true }).catch(() => []);
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) await walk(root, path, found, depth + 1);
    else if (entry.isFile() && SPEC_PATTERN.test(entry.name) && found.length < SPEC_LIMIT) found.push(path);
  }
}
async function specFiles(root: string): Promise<SpecFile[]> {
  const paths: string[] = [];
  await walk(root, SPEC_ROOT, paths, 0);
  const texts = await Promise.all(paths.map(async path => ({ path, text: await textFile(root, path) })));
  return texts.flatMap(item => item.text === null ? [] : [{ path: item.path, text: item.text }]);
}
const fileSystemPort = (root: string): UiStatusPort => ({
  readJson: path => jsonReport(root, path), readText: path => textFile(root, path), specFiles: () => specFiles(root),
});
const WARNINGS: Record<string, string> = {
  invalid: 'could not be read as bounded JSON; its facts are ignored',
  absent: 'is missing; the facts it carries are unavailable',
};
function warnings(report: Awaited<ReturnType<typeof collectUiStatus>>): string[] {
  const { traceability, project } = report.sources;
  return [['design/visual-traceability.json', traceability], ['design/project.json', project]]
    .filter(([, state]) => state !== 'present').map(([path, state]) => `${path} ${WARNINGS[state!]}`);
}
/** `ui status`: read-only; fails only when the root carries neither visual traceability nor a companion project. */
export async function uiStatus(request: Request, context: Context): Promise<Result> {
  const report = await collectUiStatus(fileSystemPort(context.root));
  if (!isUiProject(report)) throw new OperationError('UI_PROJECT_NOT_FOUND',
    'This folder is not a generated UI project: neither design/visual-traceability.json nor design/project.json exists.', 'Use --root <generated project folder>.');
  return { ...result(request.command, report), diagnostics: warnings(report).map(message => ({ code: 'UI_STATUS_SOURCE', message, severity: 'warning' as const })) };
}
