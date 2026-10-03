import { mentions } from './ui-status-source.ts';
/** Summaries of retained report files. They describe what a report contains; they never promote a result to acceptance. */
export type ReportRead = { state: 'absent' } | { state: 'invalid' } | { state: 'present'; value: unknown };
export interface E2eEvidence {
  path: string; state: 'absent' | 'invalid' | 'present';
  specs: number; passed: number; failed: number; skipped: number;
  projects: string[]; themes: string[]; widths: number[]; passedIds: string[];
}
export interface GalleryEvidence {
  path: string; state: 'absent' | 'invalid' | 'present'; recognized: boolean; entries: number;
  surfaces: string[]; themes: string[]; widths: number[];
}
export const E2E_RESULTS_PATH = 'reports/e2e/results.json';
export const GALLERY_INDEX_PATH = 'reports/ui-gallery/index.json';

type Record_ = Record<string, unknown>;
const isRecord = (value: unknown): value is Record_ => value !== null && typeof value === 'object' && !Array.isArray(value);
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const sorted = <T extends string | number>(values: Iterable<T>): T[] => [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const WIDTH = [/(?<![\d.])(\d{3,4})\s*px\b/gi, /(?<![\w])w(\d{3,4})\b/gi, /@\s*(\d{3,4})\b/g, /(?<![\d.])(\d{3,4})x\d{3,4}\b/g];
/** Light/dark theme words observed in a label. */
function themesIn(label: string): string[] { return sorted([...label.matchAll(/\b(light|dark)\b/gi)].map(match => match[1]!.toLowerCase())); }
/** Pixel widths observed in a label (`390px`, `w768`, `@1280`, `1280x800`); plausible viewport range only. */
function widthsIn(label: string): number[] {
  const found = WIDTH.flatMap(pattern => [...label.matchAll(pattern)].map(match => Number(match[1])));
  return sorted(found.filter(plausible));
}
const plausible = (width: number): boolean => width >= 240 && width <= 4096;
/** Project names are labels chosen by the config, so a bare numeric segment (`chromium-dark-1280`) is a width there. */
function projectWidths(name: string): number[] {
  return sorted([...widthsIn(name), ...name.split(/[-_\s]/).filter(part => /^\d{3,4}$/.test(part)).map(Number).filter(plausible)]);
}
interface SpecResult { title: string; file: string; status: 'passed' | 'failed' | 'skipped'; projects: string[] }
function specStatus(spec: Record_): SpecResult['status'] {
  const statuses = array(spec.tests).filter(isRecord).map(test => test.status);
  if (statuses.includes('unexpected')) return 'failed';
  if (statuses.length > 0) return statuses.every(status => status === 'skipped') ? 'skipped' : 'passed';
  return spec.ok === true ? 'passed' : 'failed';
}
function collectSpecs(suite: Record_, inherited: string, out: SpecResult[], depth: number): void {
  const file = typeof suite.file === 'string' ? suite.file : inherited;
  for (const spec of array(suite.specs).filter(isRecord)) {
    const projects = array(spec.tests).filter(isRecord).map(test => test.projectName).filter((name): name is string => typeof name === 'string');
    out.push({ title: typeof spec.title === 'string' ? spec.title : '', file: typeof spec.file === 'string' ? spec.file : file, status: specStatus(spec), projects });
  }
  if (depth < 12) for (const child of array(suite.suites).filter(isRecord)) collectSpecs(child, file, out, depth + 1);
}
const emptyE2e = (state: E2eEvidence['state']): E2eEvidence => ({ path: E2E_RESULTS_PATH, state, specs: 0, passed: 0, failed: 0, skipped: 0, projects: [], themes: [], widths: [], passedIds: [] });
/** Reads a Playwright JSON-reporter file. `knownIds` are the ids that appear in titles of specs that passed. */
export function summarizeE2e(read: ReportRead, knownIds: readonly string[]): E2eEvidence {
  if (read.state !== 'present') return emptyE2e(read.state);
  const specs: SpecResult[] = [];
  if (isRecord(read.value)) for (const suite of array(read.value.suites).filter(isRecord)) collectSpecs(suite, '', specs, 0);
  const labels = specs.flatMap(spec => [spec.title, ...spec.projects]), passedTitles = specs.filter(spec => spec.status === 'passed').map(spec => spec.title).join('\n');
  const count = (status: SpecResult['status']) => specs.filter(spec => spec.status === status).length;
  return { ...emptyE2e('present'), specs: specs.length, passed: count('passed'), failed: count('failed'), skipped: count('skipped'),
    projects: sorted(specs.flatMap(spec => spec.projects)), themes: sorted(labels.flatMap(themesIn)), widths: sorted([...specs.flatMap(spec => widthsIn(spec.title)), ...specs.flatMap(spec => spec.projects.flatMap(projectWidths))]),
    passedIds: knownIds.filter(id => mentions(passedTitles, id)) };
}
const ENTRY_KEYS = ['entries', 'screenshots', 'captures', 'shots', 'items', 'pages', 'surfaces'];
function galleryEntries(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return null;
  const key = ENTRY_KEYS.find(name => Array.isArray(value[name]));
  return key ? value[key] as unknown[] : null;
}
const firstText = (entry: Record_, keys: string[]): string | null => keys.map(key => entry[key]).find((value): value is string => typeof value === 'string' && value !== '') ?? null;
function entryWidth(entry: Record_): number | null {
  const viewport = isRecord(entry.viewport) ? entry.viewport.width : undefined;
  const raw = entry.width ?? viewport;
  const width = typeof raw === 'string' ? Number(raw) : raw;
  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : null;
}
const emptyGallery = (state: GalleryEvidence['state']): GalleryEvidence => ({ path: GALLERY_INDEX_PATH, state, recognized: false, entries: 0, surfaces: [], themes: [], widths: [] });
const topLevel = <T>(value: unknown, key: string, pick: (item: unknown) => T | null): T[] => isRecord(value) ? array(value[key]).map(pick).filter((item): item is T => item !== null) : [];
/** Reads reports/ui-gallery/index.json tolerantly; an unrecognised shape is reported as such, not guessed at. */
export function summarizeGallery(read: ReportRead): GalleryEvidence {
  if (read.state !== 'present') return emptyGallery(read.state);
  const entries = galleryEntries(read.value);
  if (!entries) return { ...emptyGallery('present'), themes: sorted(topLevel(read.value, 'themes', item => typeof item === 'string' ? item : null)), widths: sorted(topLevel(read.value, 'widths', item => typeof item === 'number' ? item : null)) };
  const records = entries.filter(isRecord);
  const widths = [...records.map(entryWidth), ...topLevel(read.value, 'widths', item => typeof item === 'number' ? item : null)].filter((item): item is number => item !== null);
  const themes = [...records.map(entry => firstText(entry, ['theme'])), ...topLevel(read.value, 'themes', item => typeof item === 'string' ? item : null)].filter((item): item is string => item !== null);
  return { path: GALLERY_INDEX_PATH, state: 'present', recognized: true, entries: records.length,
    surfaces: sorted(records.map(entry => firstText(entry, ['definitionId', 'surfaceId', 'surface', 'definition', 'pageId', 'page', 'id'])).filter((item): item is string => item !== null)),
    themes: sorted(themes), widths: sorted(widths) };
}
