/** FileManager: frontmatter round-trips and link-aware renames over the kit vault. */
import { parse, stringify } from 'yaml';
import { TAbstractFile, TFile, TFolder } from './files';
import { getLinkpath, isRecord, splitFrontmatter, type MetadataCache } from './metadata';
import type { Vault } from './vault';

export class FileManager {
  constructor(private readonly vault: Vault, private readonly metadataCache: MetadataCache) {}
  /**
   * Atomic through `vault.process`: `fn` mutates the parsed object; the body bytes after the
   * closing `---` stay identical. Formatting is the `yaml` package's, not necessarily the
   * host's, so assert parsed values (or the body) rather than exact YAML spacing.
   * Invalid YAML throws and writes nothing. An emptied object removes the block.
   */
  async processFrontMatter(file: TFile, fn: (frontmatter: Record<string, unknown>) => void): Promise<void> {
    await this.vault.process(file, data => {
      const block = splitFrontmatter(data);
      const parsed: unknown = block ? parse(block.yaml) ?? {} : {};
      if (!isRecord(parsed)) throw new Error('OBSIDIAN_TEST_KIT_FRONTMATTER_NOT_AN_OBJECT');
      fn(parsed);
      const body = block ? block.body : data;
      return Object.keys(parsed).length ? `---\n${stringify(parsed)}---\n${body}` : body;
    });
  }
  /** Renames, then rewrites `[[links]]` in other notes that resolved to the moved file. */
  async renameFile(file: TAbstractFile, newPath: string): Promise<void> {
    const sources = file instanceof TFile ? this.linkSources(file) : new Map<TFile, Set<string>>();
    await this.vault.rename(file, newPath);
    if (!(file instanceof TFile)) return;
    const replacement = (source: TFile) => this.metadataCache.fileToLinktext(file, source.path);
    for (const [source, links] of sources) {
      // Only whole link targets: `[[Old]]`, `[[Old|alias]]`, `[[Old#heading]]`, never `[[Older]]`.
      const pattern = new RegExp(`(!?\\[\\[)(${[...links].map(escape).join('|')})(?=[\\]|#])`, 'g');
      await this.vault.process(source, data => data.replace(pattern, (_match, open: string) => `${open}${replacement(source)}`));
    }
  }
  async trashFile(file: TAbstractFile): Promise<void> { await this.vault.trash(file, true); }
  generateMarkdownLink(file: TFile, sourcePath: string, subpath = '', alias?: string): string {
    return `[[${this.metadataCache.fileToLinktext(file, sourcePath)}${subpath}${alias ? `|${alias}` : ''}]]`;
  }
  getNewFileParent(_sourcePath: string): TFolder { return this.vault.getRoot(); }
  private linkSources(file: TFile): Map<TFile, Set<string>> {
    const sources = new Map<TFile, Set<string>>();
    for (const source of this.vault.getMarkdownFiles()) {
      for (const ref of [...this.metadataCache.getFileCache(source)?.links ?? [], ...this.metadataCache.getFileCache(source)?.embeds ?? []]) {
        if (this.metadataCache.getFirstLinkpathDest(ref.link, source.path) !== file) continue;
        sources.set(source, (sources.get(source) ?? new Set()).add(getLinkpath(ref.link)));
      }
    }
    return sources;
  }
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
