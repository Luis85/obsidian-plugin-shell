import { galleryOptions, type GalleryOptions } from '../../tooling/ui/gallery-options.ts';
import { result, requireThat, stringOption, type Context, type Request, type Result } from './contracts.ts';
import { runNode } from './process.ts';
import { toolingPath } from './repository-scope.ts';

/** The capture script: tooling/ in current projects, scripts/ in older generated consumers (repository-scope.ts). */
const entry = (root: string): string => toolingPath(root, 'ui/review-gallery.mjs');
const NOTICE = 'Evidence for human review — not acceptance, not a baseline';

/** Validates the shared option rules; only these four options reach the capture script. */
function requested(request: Request): GalleryOptions {
  return galleryOptions({ target: stringOption(request.options, 'target'), out: stringOption(request.options, 'out'), input: stringOption(request.options, 'input') });
}
export function galleryArguments(options: GalleryOptions): string[] {
  return ['--target', options.target, '--out', options.out, ...(options.input === undefined ? [] : ['--input', options.input]), '--json'];
}
function receipt(stdout: string): unknown {
  try { return JSON.parse(stdout); } catch { return undefined; }
}
/** `ui gallery`: launches the shipped capture script (trusted project code, local browser) and relays its receipt. */
export async function uiGallery(request: Request, context: Context): Promise<Result> {
  const options = requested(request);
  if (request.options['dry-run']) {
    return result(request.command, { target: options.target, out: options.out, input: options.input ?? null, execution: 'not-run', notice: NOTICE,
      requires: 'Chromium (SHELL_CHROMIUM or the pinned Playwright browser), and for --target clickdummy a built clickdummy.html.' }, 'planned');
  }
  const execution = await runNode(context, entry(context.root), galleryArguments(options), Number(stringOption(request.options, 'timeout') ?? '600000'));
  requireThat(!execution.truncated, 'GALLERY_OUTPUT_LIMIT', 'Gallery output was truncated; do not infer success.');
  const summary = receipt(execution.stdout);
  requireThat(summary !== undefined, 'GALLERY_RECEIPT', 'The gallery script did not return a receipt.');
  return result(request.command, { receipt: summary, acceptance: 'not-inferred', notice: NOTICE });
}
