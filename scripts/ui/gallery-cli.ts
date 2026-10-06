import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { clickdummySession } from './gallery-clickdummy.ts';
import { harnessSession } from './gallery-harness.ts';
import { DEFAULT_CLICKDUMMY, parseGalleryArguments, type GalleryOptions } from './gallery-options.ts';
import { runGallery, type CaptureSession, type GalleryResult } from './gallery-run.ts';

const git = promisify(execFile);
export interface CliDependencies {
  root: string; clock: () => Date; commit: (root: string) => Promise<string | null>;
  session: (options: GalleryOptions, root: string) => Promise<CaptureSession>;
  out: (text: string) => void; err: (text: string) => void;
}
/** HEAD from git when available; a missing git or a non-repository is simply no commit. */
async function headCommit(root: string): Promise<string | null> {
  try { return (await git('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim() || null; } catch { return null; }
}
const defaultDependencies = (): CliDependencies => ({
  root: process.cwd(), clock: () => new Date(), commit: headCommit,
  session: (options, root) => (options.target === 'harness' ? harnessSession(root) : clickdummySession(root, options.input ?? DEFAULT_CLICKDUMMY)),
  out: text => { process.stdout.write(text); }, err: text => { process.stderr.write(text); },
});
function summary(options: GalleryOptions, result: GalleryResult): Record<string, unknown> {
  const { index } = result;
  return { status: index.failures.length ? 'failed' : 'captured', target: options.target, out: options.out, captures: index.entries.length,
    failures: index.failures, commit: index.commit, index: `${options.out}/index.json`, gallery: `${options.out}/gallery.html`, notice: index.notice };
}
function report(options: GalleryOptions, result: GalleryResult): string {
  if (options.json) return `${JSON.stringify(summary(options, result))}\n`;
  const { index } = result;
  const lines = [`${index.notice}`, `Captured ${index.entries.length} screenshot(s) from ${options.target} into ${options.out}/`,
    `Open ${options.out}/gallery.html; index at ${options.out}/index.json.`];
  for (const failure of index.failures) lines.push(`FAILED ${failure.file}: ${failure.message}`);
  return `${lines.join('\n')}\n`;
}
function failed(json: boolean, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Gallery capture failed.';
  const code = /^([A-Z][A-Z_0-9]+):/.exec(message)?.[1] ?? 'GALLERY_FAILED';
  return json ? `${JSON.stringify({ status: 'failed', code, message })}\n` : `${message}\n`;
}
/** Runs the gallery; 0 when every capture succeeded, 1 for capture failures, 2 for unusable options or startup. */
export async function runCli(argv: readonly string[], deps: CliDependencies = defaultDependencies()): Promise<number> {
  try {
    const options = parseGalleryArguments(argv);
    const session = await deps.session(options, deps.root);
    const result = await runGallery({ target: options.target, outDirectory: resolve(deps.root, options.out), session, commit: await deps.commit(deps.root), clock: deps.clock });
    deps.out(report(options, result));
    return result.index.failures.length ? 1 : 0;
  } catch (error) {
    deps.err(failed(argv.includes('--json'), error));
    return 2;
  }
}
