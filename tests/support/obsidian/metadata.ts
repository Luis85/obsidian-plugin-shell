/** Simplified Markdown metadata: YAML frontmatter, headings, inline tags and wiki links/embeds. */
import { parse, stringify } from 'yaml';
import type { CachedMetadata, EmbedCache, HeadingCache, LinkCache, Loc, Pos, TagCache } from 'obsidian';
import { Events, track } from './events';
import { TFile, parentPath } from './files';
import type { Vault, VaultObserver } from './vault';

/** Uses the `yaml` package; values match Obsidian for common data but formatting can differ. */
export function parseYaml(text: string): unknown { return parse(text); }
export function stringifyYaml(value: unknown): string { return stringify(value); }

export interface FrontmatterBlock { readonly yaml: string; readonly body: string; readonly endLine: number; readonly endOffset: number }
/** Kit helper: a leading `---` line through the next `---` line; `body` is every byte after it. */
export function splitFrontmatter(text: string): FrontmatterBlock | null {
  const lines = text.split('\n');
  if (lines[0]?.replace(/\r$/, '') !== '---') return null;
  let offset = (lines[0]?.length ?? 0) + 1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.replace(/\r$/, '') === '---') {
      return { yaml: lines.slice(1, i).join('\n'), body: text.slice(Math.min(text.length, offset + line.length + 1)), endLine: i, endOffset: offset + 3 };
    }
    offset += line.length + 1;
  }
  return null;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseLinktext(linktext: string): { path: string; subpath: string } {
  const index = linktext.indexOf('#');
  return index < 0 ? { path: linktext, subpath: '' } : { path: linktext.slice(0, index), subpath: linktext.slice(index) };
}
export function getLinkpath(linktext: string): string { return parseLinktext(linktext).path; }
export function parseFrontMatterTags(frontmatter: unknown): string[] | null {
  if (!isRecord(frontmatter)) return null;
  const raw = frontmatter.tags ?? frontmatter.tag;
  const values = typeof raw === 'string' ? raw.split(/[,\s]+/) : Array.isArray(raw) ? raw.filter(item => typeof item === 'string') : [];
  const tags = values.map(value => value.trim()).filter(Boolean).map(value => value.startsWith('#') ? value : `#${value}`);
  return tags.length ? tags : null;
}
export function getAllTags(cache: CachedMetadata): string[] | null {
  const tags = [...parseFrontMatterTags(cache.frontmatter) ?? [], ...(cache.tags ?? []).map(item => item.tag)];
  return tags.length ? tags : null;
}

const loc = (line: number, col: number, offset: number): Loc => ({ line, col, offset });
const span = (line: number, start: number, end: number, lineOffset: number): Pos => ({ start: loc(line, start, lineOffset + start), end: loc(line, end, lineOffset + end) });
/** Parse one Markdown document the way the kit's cache does; exported for direct assertions. */
export function parseMarkdownMetadata(text: string): CachedMetadata {
  const cache: CachedMetadata = {};
  const block = splitFrontmatter(text);
  if (block) {
    cache.frontmatterPosition = { start: loc(0, 0, 0), end: loc(block.endLine, 3, block.endOffset) };
    try { const value: unknown = parse(block.yaml); if (isRecord(value)) cache.frontmatter = value; } catch { /* Invalid YAML: no properties, like the host. */ }
  }
  const headings: HeadingCache[] = []; const tags: TagCache[] = []; const links: LinkCache[] = []; const embeds: EmbedCache[] = [];
  const lines = text.split('\n'); let offset = 0; let fence: string | null = null;
  lines.forEach((raw, index) => {
    const lineOffset = offset; offset += raw.length + 1;
    if (block && index <= block.endLine) return;
    const line = raw.replace(/\r$/, '');
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) { fence = fence ? null : marker; return; }
    if (fence) return;
    const heading = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (heading?.[1] && heading[2]) headings.push({ heading: heading[2], level: heading[1].length, position: span(index, 0, line.length, lineOffset) });
    const code = line.replace(/`[^`]*`/g, value => ' '.repeat(value.length));
    for (const match of code.matchAll(/(!?)\[\[([^\]\n]+?)\]\]/g)) {
      const [target = '', alias] = (match[2] ?? '').split('|');
      const start = match.index;
      const item = { link: target.trim(), original: match[0], displayText: alias ?? target.trim(), position: span(index, start, start + match[0].length, lineOffset) };
      (match[1] ? embeds : links).push(item);
    }
    if (heading) return;
    for (const match of code.matchAll(/(^|\s)(#[\p{L}\p{N}_/-]+)/gu)) {
      const tag = match[2] ?? '';
      if (/^#[\d/]+$/.test(tag)) continue;
      const start = match.index + (match[1]?.length ?? 0);
      tags.push({ tag, position: span(index, start, start + tag.length, lineOffset) });
    }
  });
  if (headings.length) cache.headings = headings;
  if (tags.length) cache.tags = tags;
  if (links.length) cache.links = links;
  if (embeds.length) cache.embeds = embeds;
  return cache;
}

/**
 * Parses asynchronously after vault writes, like the host: `getFileCache` stays stale until
 * `changed` fires. Await `flushObsidian()` (or a `changed` event) before asserting metadata.
 * Seeded files are parsed synchronously, as if the cache had resolved before the test.
 */
export class MetadataCache extends Events implements VaultObserver {
  resolvedLinks: Record<string, Record<string, number>> = {};
  unresolvedLinks: Record<string, Record<string, number>> = {};
  private readonly caches = new Map<string, CachedMetadata>();
  private readonly queued = new Map<TFile, string>();
  constructor(private readonly vault: Vault) { super(); vault.observer = this; }
  getFileCache(file: TFile): CachedMetadata | null { return this.caches.get(file.path) ?? null; }
  getCache(path: string): CachedMetadata | null { return this.caches.get(path) ?? null; }
  changed(file: TFile, data: string, immediate: boolean): void {
    if (file.extension !== 'md') return;
    if (immediate) { this.caches.set(file.path, parseMarkdownMetadata(data)); this.relink(); return; }
    const idle = !this.queued.size; this.queued.set(file, data);
    // A few microtask hops put parsing after the writer's own await continuation, so code that
    // reads the cache right after a write sees stale data, as it can in the host. Never timers.
    if (idle) void track(Promise.resolve().then(() => undefined).then(() => undefined).then(() => this.process()));
  }
  deleted(file: TFile): void {
    const previous = this.caches.get(file.path) ?? null;
    this.caches.delete(file.path); this.queued.delete(file); this.relink();
    this.trigger('deleted', file, previous);
  }
  renamed(file: TFile, oldPath: string): void {
    const cache = this.caches.get(oldPath);
    this.caches.delete(oldPath); if (cache) this.caches.set(file.path, cache);
    this.relink();
  }
  /** Basic: source-folder relative, then vault path, then shortest case-insensitive suffix match. */
  getFirstLinkpathDest(linkpath: string, sourcePath: string): TFile | null {
    const target = getLinkpath(linkpath);
    if (!target) return this.vault.getFileByPath(sourcePath);
    const folder = parentPath(sourcePath);
    for (const path of [...(folder ? [`${folder}/${target}`, `${folder}/${target}.md`] : []), target, `${target}.md`]) {
      const file = this.vault.getFileByPath(path); if (file) return file;
    }
    const wanted = target.toLowerCase();
    const matches = this.vault.getFiles().filter(file => {
      const full = file.path.toLowerCase(); const bare = file.extension === 'md' ? full.slice(0, -3) : full;
      return [full, bare].some(candidate => candidate === wanted || candidate.endsWith(`/${wanted}`));
    });
    return matches.sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path))[0] ?? null;
  }
  /** "Shortest path when possible": the bare name when unique, else the full path. */
  fileToLinktext(file: TFile, _sourcePath: string, omitMdExtension = true): string {
    const bare = omitMdExtension && file.extension === 'md';
    const unique = this.vault.getFiles().filter(other => other.name === file.name).length === 1;
    const name = unique ? (bare ? file.basename : file.name) : file.path;
    return bare && !unique ? name.slice(0, -3) : name;
  }
  private process(): void {
    const batch = [...this.queued]; this.queued.clear();
    for (const [file, data] of batch) {
      if (this.vault.getFileByPath(file.path) !== file) continue;
      const cache = parseMarkdownMetadata(data);
      this.caches.set(file.path, cache); this.relink();
      this.trigger('changed', file, data, cache); this.trigger('resolve', file);
    }
    this.trigger('resolved');
  }
  private relink(): void {
    this.resolvedLinks = {}; this.unresolvedLinks = {};
    for (const [path, cache] of this.caches) {
      const resolved: Record<string, number> = {}; const unresolved: Record<string, number> = {};
      for (const ref of [...cache.links ?? [], ...cache.embeds ?? []]) {
        const target = this.getFirstLinkpathDest(ref.link, path);
        const bucket = target ? resolved : unresolved; const key = target?.path ?? getLinkpath(ref.link);
        bucket[key] = (bucket[key] ?? 0) + 1;
      }
      this.resolvedLinks[path] = resolved; this.unresolvedLinks[path] = unresolved;
    }
  }
}
