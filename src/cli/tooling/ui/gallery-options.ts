import { hasPortableProjectSegments, hasProtectedProjectRoot } from '#shared/platform/project-path.ts';

const GALLERY_TARGETS = ['harness', 'clickdummy'] as const;
export type GalleryTarget = (typeof GALLERY_TARGETS)[number];
const DEFAULT_OUT = 'reports/ui-gallery';
export const DEFAULT_CLICKDUMMY = 'clickdummy.html';
export interface GalleryOptions { target: GalleryTarget; out: string; input: string | undefined; json: boolean }
/** Raw option values as the shared CLI parser delivers them. */
export type RawGalleryOptions = Readonly<Record<string, string | boolean | undefined>>;

const known = new Set(['target', 'out', 'input', 'json']);
function fail(code: string, message: string): never {
  throw Object.assign(new Error(`${code}: ${message}`), { code });
}
function relativePath(name: string, value: string): string {
  if (!hasPortableProjectSegments(value) || hasProtectedProjectRoot(value)) {
    fail('GALLERY_PATH', `--${name} must be a relative path inside the project, such as ${DEFAULT_OUT}.`);
  }
  return value;
}
function text(raw: RawGalleryOptions, name: string): string | undefined {
  const value = raw[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') fail('GALLERY_OPTION', `--${name} requires a value.`);
  return value;
}
/** Validates already-split options; the single rule set for the script and the `ui gallery` command. */
export function galleryOptions(raw: RawGalleryOptions): GalleryOptions {
  for (const key of Object.keys(raw)) if (!known.has(key)) fail('GALLERY_OPTION', `Unknown option --${key}.`);
  const target = text(raw, 'target') ?? 'harness';
  if (!(GALLERY_TARGETS as readonly string[]).includes(target)) fail('GALLERY_TARGET', `--target must be ${GALLERY_TARGETS.join(' or ')}.`);
  const input = text(raw, 'input');
  if (input !== undefined && target !== 'clickdummy') fail('GALLERY_OPTION', '--input applies only to --target clickdummy.');
  return {
    target: target as GalleryTarget,
    out: relativePath('out', text(raw, 'out') ?? DEFAULT_OUT),
    input: input === undefined ? undefined : relativePath('input', input),
    json: raw.json === true,
  };
}
/** Parses `--name value` and `--json` words into raw options, rejecting positional or repeated words. */
export function parseGalleryArguments(argv: readonly string[]): GalleryOptions {
  const raw: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index++) {
    const word = argv[index]!;
    if (!word.startsWith('--')) fail('GALLERY_OPTION', `Unexpected argument ${word}.`);
    const key = word.slice(2);
    if (Object.hasOwn(raw, key)) fail('GALLERY_OPTION', `Repeated option ${word}.`);
    if (key === 'json') { raw[key] = true; continue; }
    const value = argv[++index];
    if (value === undefined || value.startsWith('--')) fail('GALLERY_OPTION', `Supply a value for ${word}.`);
    raw[key] = value;
  }
  return galleryOptions(raw);
}
