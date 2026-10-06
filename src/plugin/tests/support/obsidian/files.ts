/** Vault entry classes and path helpers matching Obsidian's public shapes. */
import type { Vault } from './vault';

/** Obsidian's documented normalization: collapse/trim slashes, NBSP to space, NFC. Empty becomes '/'. */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/([\\/])+/g, '/').replace(/(^\/+|\/+$)/g, '');
  return (trimmed === '' ? '/' : trimmed).replace(/ | /g, ' ').normalize('NFC');
}
export function parentPath(path: string): string {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
}
/** Obsidian keeps dot-prefixed files and folders (for example the config dir) out of the vault index. */
export function hiddenPath(path: string): boolean {
  return path.split('/').some(segment => segment.startsWith('.'));
}

export abstract class TAbstractFile {
  path = '';
  name = '';
  parent: TFolder | null = null;
  vault!: Vault;
  constructor(path = '', vault?: Vault) { if (vault) this.vault = vault; this.setPath(path); }
  /** Kit-internal: rename bookkeeping keeps object identity like the host. */
  setPath(path: string): void {
    this.path = path;
    this.name = path === '/' ? '' : path.slice(path.lastIndexOf('/') + 1);
  }
}

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
  // Subclass fields initialize after the base constructor; derive names again afterwards.
  constructor(path = '', vault?: Vault) { super(path, vault); this.setPath(path); }
  override setPath(path: string): void {
    super.setPath(path);
    const dot = this.name.lastIndexOf('.');
    this.basename = dot > 0 ? this.name.slice(0, dot) : this.name;
    this.extension = dot > 0 ? this.name.slice(dot + 1) : '';
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  isRoot(): boolean { return this.path === '/'; }
}

/** Kit-internal: every descendant of a folder, parents before children. */
export function descendants(folder: TFolder): TAbstractFile[] {
  return folder.children.flatMap(child => child instanceof TFolder ? [child, ...descendants(child)] : [child]);
}
export function utf8Size(data: string): number { return new TextEncoder().encode(data).length; }
