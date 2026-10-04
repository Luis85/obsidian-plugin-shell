import { sha256 } from '../shared/hash.ts';
import { GALLERY_NOTICE, type GalleryJob } from './gallery-matrix.ts';

export interface GalleryEntry extends GalleryJob { sha256: string; commit: string | null; timestamp: string }
export interface GalleryFailure { file: string; message: string }
export interface GalleryIndex {
  schemaVersion: 1; notice: string; target: string; commit: string | null; generatedAt: string;
  entries: GalleryEntry[]; failures: GalleryFailure[];
}
export function buildEntry(job: GalleryJob, png: Uint8Array, commit: string | null, timestamp: string): GalleryEntry {
  return { surfaceId: job.surfaceId, surfaceLabel: job.surfaceLabel, state: job.state, scenario: job.scenario,
    theme: job.theme, width: job.width, file: job.file, sha256: sha256(png), commit, timestamp };
}
export function buildIndex(target: string, commit: string | null, generatedAt: string, entries: GalleryEntry[], failures: GalleryFailure[]): GalleryIndex {
  return { schemaVersion: 1, notice: GALLERY_NOTICE, target, commit, generatedAt, entries, failures };
}
const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escapes text for element content and quoted attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => escapes[character] ?? character);
}
function caption(entry: GalleryEntry): string {
  const scenario = entry.scenario === null ? 'no scenario' : `scenario ${entry.scenario}`;
  const lines = [`${entry.state} · ${scenario}`, `${entry.theme} · ${entry.width}px`, `sha256 ${entry.sha256.slice(0, 12)}`];
  return lines.map(line => `<span>${escapeHtml(line)}</span>`).join('');
}
function figure(entry: GalleryEntry): string {
  const alt = `${entry.surfaceLabel}: ${entry.state}, ${entry.scenario ?? 'no scenario'}, ${entry.theme}, ${entry.width}px`;
  const src = encodeURIComponent(entry.file);
  return `<figure data-theme="${escapeHtml(entry.theme)}" data-width="${entry.width}"><a href="${escapeHtml(src)}"><img loading="lazy" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"></a><figcaption>${caption(entry)}</figcaption></figure>`;
}
function section(surfaceId: string, entries: GalleryEntry[]): string {
  const label = entries[0]?.surfaceLabel ?? surfaceId;
  return `<section><h2>${escapeHtml(label)} <small>${escapeHtml(surfaceId)}</small></h2><div class="grid">${entries.map(figure).join('')}</div></section>`;
}
function groups(entries: readonly GalleryEntry[]): Array<[string, GalleryEntry[]]> {
  const bySurface = new Map<string, GalleryEntry[]>();
  for (const entry of entries) bySurface.set(entry.surfaceId, [...bySurface.get(entry.surfaceId) ?? [], entry]);
  return [...bySurface];
}
function filter(name: string, values: readonly string[], suffix: string): string {
  const buttons = values.map(value => `<label><input type="checkbox" data-filter="${name}" value="${escapeHtml(value)}" checked> ${escapeHtml(value)}${suffix}</label>`);
  return `<fieldset><legend>${name}</legend>${buttons.join('')}</fieldset>`;
}
const unique = <T>(values: T[]): T[] => [...new Set(values)];
const styles = `:root{color-scheme:light dark;font:16px/1.4 system-ui,sans-serif}body{margin:0;padding:16px;background:Canvas;color:CanvasText}
header{border-bottom:1px solid GrayText;margin-bottom:16px}h1{font-size:1.25rem;margin:0 0 4px}.notice{font-weight:600}
fieldset{display:inline-block;margin:0 12px 8px 0}.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;max-width:340px}
figure img{max-width:100%;height:auto;border:1px solid GrayText}figcaption span{display:block;font-size:.85rem;overflow-wrap:anywhere}
h2 small{font-weight:400;color:GrayText}[hidden]{display:none!important}`;
const script = `const boxes=[...document.querySelectorAll('input[data-filter]')];
function apply(){const on=(name)=>new Set(boxes.filter(b=>b.dataset.filter===name&&b.checked).map(b=>b.value));
const themes=on('theme'),widths=on('width');
for(const f of document.querySelectorAll('figure'))f.hidden=!(themes.has(f.dataset.theme)&&widths.has(f.dataset.width));
for(const s of document.querySelectorAll('section'))s.hidden=!s.querySelector('figure:not([hidden])');}
for(const b of boxes)b.addEventListener('change',apply);apply();`;
/** Self-contained page: inline CSS and script, relative images, no remote resources. */
export function renderGalleryHtml(index: GalleryIndex): string {
  const themes = unique(index.entries.map(entry => entry.theme)), widths = unique(index.entries.map(entry => String(entry.width)));
  const meta = `target ${index.target} · commit ${index.commit ?? 'unavailable'} · ${index.generatedAt} · ${index.entries.length} captures`;
  const failures = index.failures.length ? `<p role="alert">${index.failures.length} capture(s) failed: ${escapeHtml(index.failures.map(item => item.file).join(', '))}</p>` : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<title>UI review gallery</title><style>${styles}</style></head><body>
<header><h1>UI review gallery</h1><p class="notice">${escapeHtml(GALLERY_NOTICE)}</p><p>${escapeHtml(meta)}</p>${failures}
${filter('theme', themes, '')}${filter('width', widths, 'px')}</header>
<main>${groups(index.entries).map(([id, entries]) => section(id, entries)).join('')}</main>
<script>${script}</script></body></html>
`;
}
