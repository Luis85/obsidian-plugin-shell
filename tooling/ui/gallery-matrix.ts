import { sha256 } from '../../src/shared/platform/hash.ts';

/** Evidence for human review only. Never an acceptance result and never a stored baseline. */
export const GALLERY_NOTICE = 'Evidence for human review — not acceptance, not a baseline';
const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];
/** Wide desktop first, then the narrow phone-class width. */
const WIDTHS = [1280, 360] as const;
export type Width = number;
/** The preview states of the shared visual runtime, in display order. */
export const STATES = ['default', 'loading', 'empty', 'error', 'disabled'] as const;

/** One renderable condition of a surface; `scenario` is null when no authored scenario is selected. */
export interface Variant { state: string; scenario: string | null }
export interface Surface { id: string; label: string; variants: readonly Variant[] }
export interface GalleryJob {
  surfaceId: string; surfaceLabel: string; state: string; scenario: string | null;
  theme: Theme; width: Width; file: string;
}
export interface MatrixOptions { themes?: readonly Theme[]; widths?: readonly Width[] }

const codePoints = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const stateRank = (state: string): number => {
  const index = (STATES as readonly string[]).indexOf(state);
  return index < 0 ? STATES.length : index;
};
/** Readable lowercase identifier with hyphens; lossy, so use `slug` for anything that must stay unique. */
export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
/** File-name segment; a lossy rewrite gets a short digest so distinct ids never collide. */
export function slug(value: string): string {
  const readable = slugify(value);
  if (readable === value && readable !== '') return readable;
  return `${readable || 'x'}-${sha256(value).slice(0, 6)}`;
}
export function fileName(job: Omit<GalleryJob, 'file'>): string {
  const parts = [slug(job.surfaceId), job.state, job.scenario === null ? 'none' : `s-${slug(job.scenario)}`, job.theme, String(job.width)];
  return `${parts.join('__')}.png`;
}
/** Fixed-width string parts so one lexicographic comparison orders every dimension. */
function sortKey(job: GalleryJob): string[] {
  const pad = (value: number) => String(value).padStart(5, '0');
  return [job.surfaceId, pad(stateRank(job.state)), job.state, job.scenario === null ? '0' : '1', job.scenario ?? '', pad(THEMES.indexOf(job.theme)), pad(100_000 - job.width)];
}
function compareJobs(a: GalleryJob, b: GalleryJob): number {
  const left = sortKey(a), right = sortKey(b);
  for (const [index, part] of left.entries()) {
    const order = codePoints(part, right[index] ?? '');
    if (order !== 0) return order;
  }
  return 0;
}
function jobsForSurface(surface: Surface, themes: readonly Theme[], widths: readonly Width[]): GalleryJob[] {
  const jobs: GalleryJob[] = [];
  for (const variant of surface.variants) for (const theme of themes) for (const width of widths) {
    const job = { surfaceId: surface.id, surfaceLabel: surface.label, state: variant.state, scenario: variant.scenario, theme, width };
    jobs.push({ ...job, file: fileName(job) });
  }
  return jobs;
}
/** Surface x state x scenario x theme x width in a deterministic order, independent of discovery order. */
export function expandMatrix(surfaces: readonly Surface[], options: MatrixOptions = {}): GalleryJob[] {
  const themes = options.themes ?? THEMES, widths = options.widths ?? WIDTHS;
  const jobs = surfaces.flatMap(surface => jobsForSurface(surface, themes, widths)).sort(compareJobs);
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.file)) throw new Error(`GALLERY_DUPLICATE_ENTRY: ${job.file}`);
    seen.add(job.file);
  }
  return jobs;
}
