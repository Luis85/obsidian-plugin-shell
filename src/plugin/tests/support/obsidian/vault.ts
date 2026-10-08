/** In-memory Vault and DataAdapter over one shared byte store. */
import { Events } from './events';
import { TAbstractFile, TFile, TFolder, descendants, hiddenPath, parentPath, utf8Size } from './files';

interface StoredFile { data: string; ctime: number; mtime: number; revision: number }
/** Kit-internal hook used by the metadata cache; not an Obsidian API. */
export interface VaultObserver {
  changed(file: TFile, data: string, immediate: boolean): void;
  deleted(file: TFile): void;
  renamed(file: TFile, oldPath: string): void;
}
export interface TrashRecord { readonly path: string; readonly system: boolean; readonly data: string | null }

const missing = (path: string) => new Error(`ENOENT: no such file or directory, '${path}'`);
const root = (path: string) => path === '/' ? '' : path;
const depth = (path: string) => path.split('/').length;
let revisions = 0;

/** Raw storage shared by the vault index and `vault.adapter`, including hidden config files. */
export class TestAdapter {
  readonly files = new Map<string, StoredFile>();
  readonly folders = new Set<string>();
  /** Kit-internal: the owning vault reconciles its index after adapter writes. */
  onChange: () => void = () => undefined;
  constructor(private readonly name: string) {}
  getName(): string { return this.name; }
  async exists(path: string): Promise<boolean> { const key = root(path); return key === '' || this.files.has(key) || this.folders.has(key); }
  async stat(path: string) {
    const key = root(path); const file = this.files.get(key);
    if (file) return { type: 'file' as const, ctime: file.ctime, mtime: file.mtime, size: utf8Size(file.data) };
    return key === '' || this.folders.has(key) ? { type: 'folder' as const, ctime: 0, mtime: 0, size: 0 } : null;
  }
  async list(path: string): Promise<{ files: string[]; folders: string[] }> {
    const key = root(path);
    if (key !== '' && !this.folders.has(key)) throw missing(path);
    const children = (paths: Iterable<string>) => [...paths].filter(item => parentPath(item) === key).sort();
    return { files: children(this.files.keys()), folders: children(this.folders) };
  }
  async read(path: string): Promise<string> { return this.text(path); }
  async write(path: string, data: string): Promise<void> { this.put(path, data); this.onChange(); }
  async append(path: string, data: string): Promise<void> { this.put(path, (this.files.get(path)?.data ?? '') + data); this.onChange(); }
  async process(path: string, fn: (data: string) => string): Promise<string> {
    const next = fn(this.text(path)); this.put(path, next); this.onChange(); return next;
  }
  async mkdir(path: string): Promise<void> { this.ensureFolder(root(path)); this.onChange(); }
  async remove(path: string): Promise<void> { if (!this.files.delete(path)) throw missing(path); this.onChange(); }
  async rmdir(path: string, recursive: boolean): Promise<void> {
    if (!this.folders.has(path)) throw missing(path);
    const inside = (item: string) => item.startsWith(`${path}/`);
    if (!recursive && ([...this.files.keys()].some(inside) || [...this.folders].some(inside))) throw new Error(`ENOTEMPTY: directory not empty, '${path}'`);
    this.drop(path); this.onChange();
  }
  async rename(from: string, to: string): Promise<void> { this.move(from, to); this.onChange(); }
  async copy(from: string, to: string): Promise<void> {
    if (this.files.has(to) || this.folders.has(to)) throw new Error(`EEXIST: file already exists, '${to}'`);
    this.put(to, this.text(from)); this.onChange();
  }
  async trashSystem(path: string): Promise<boolean> { this.drop(path); this.onChange(); return true; }
  async trashLocal(path: string): Promise<void> { this.move(path, `.trash/${path.slice(path.lastIndexOf('/') + 1)}`); this.onChange(); }
  getResourcePath(path: string): string { return `app://obsidian-test-kit/${encodeURI(path)}`; }
  /** Kit-internal raw mutations; they never notify the vault. */
  text(path: string): string { const file = this.files.get(path); if (!file) throw missing(path); return file.data; }
  put(path: string, data: string): void {
    this.ensureFolder(parentPath(path)); const now = Date.now(); const previous = this.files.get(path);
    this.files.set(path, { data, ctime: previous?.ctime ?? now, mtime: now, revision: ++revisions });
  }
  ensureFolder(path: string): void {
    const parts = path ? path.split('/') : [];
    for (let i = 1; i <= parts.length; i++) this.folders.add(parts.slice(0, i).join('/'));
  }
  drop(path: string): void {
    for (const key of [...this.files.keys()]) if (key === path || key.startsWith(`${path}/`)) this.files.delete(key);
    for (const key of [...this.folders]) if (key === path || key.startsWith(`${path}/`)) this.folders.delete(key);
  }
  move(from: string, to: string): void {
    if (this.files.has(to) || this.folders.has(to)) throw new Error(`EEXIST: file already exists, '${to}'`);
    if (!this.files.has(from) && !this.folders.has(from)) throw missing(from);
    const target = (key: string) => to + key.slice(from.length);
    this.ensureFolder(parentPath(to));
    for (const [key, value] of [...this.files]) if (key === from || key.startsWith(`${from}/`)) { this.files.delete(key); this.files.set(target(key), value); }
    for (const key of [...this.folders]) if (key === from || key.startsWith(`${from}/`)) { this.folders.delete(key); this.folders.add(target(key)); }
  }
}

export class Vault extends Events {
  readonly adapter: TestAdapter;
  configDir: string;
  /** Kit-only record of `trash` calls in order, with the bytes that were trashed. */
  readonly trashed: TrashRecord[] = [];
  observer?: VaultObserver;
  private readonly rootFolder: TFolder;
  private readonly index = new Map<string, TAbstractFile>();
  private readonly seen = new Map<TFile, number>();
  constructor(options: { name?: string; configDir?: string } = {}) {
    super();
    this.adapter = new TestAdapter(options.name ?? 'Test Vault');
    this.configDir = options.configDir ?? '.obsidian';
    this.rootFolder = new TFolder('/', this);
    this.adapter.onChange = () => this.reconcile(false);
  }
  getName(): string { return this.adapter.getName(); }
  getRoot(): TFolder { return this.rootFolder; }
  getAbstractFileByPath(path: string): TAbstractFile | null { return path === '/' ? this.rootFolder : this.index.get(path) ?? null; }
  getFileByPath(path: string): TFile | null { const file = this.index.get(path); return file instanceof TFile ? file : null; }
  getFolderByPath(path: string): TFolder | null { const folder = this.getAbstractFileByPath(path); return folder instanceof TFolder ? folder : null; }
  getFiles(): TFile[] { return [...this.index.values()].filter(entry => entry instanceof TFile); }
  getMarkdownFiles(): TFile[] { return this.getFiles().filter(file => file.extension === 'md'); }
  getAllLoadedFiles(): TAbstractFile[] { return [this.rootFolder, ...this.index.values()]; }
  getAllFolders(includeRoot = false): TFolder[] {
    const folders = [...this.index.values()].filter(entry => entry instanceof TFolder);
    return includeRoot ? [this.rootFolder, ...folders] : folders;
  }
  async read(file: TFile): Promise<string> { return this.adapter.text(this.live(file).path); }
  async cachedRead(file: TFile): Promise<string> { return this.read(file); }
  /** Rejects existing paths and missing parent folders; create folders first, as native code must. */
  async create(path: string, data: string): Promise<TFile> {
    this.creatable(path); this.adapter.put(path, data); this.reconcile(false);
    const file = this.getFileByPath(path); if (!file) throw missing(path);
    return file;
  }
  /** Creates missing parent folders too; each new folder emits `create`, parents first. */
  async createFolder(path: string): Promise<TFolder> {
    if (this.adapter.files.has(path) || this.adapter.folders.has(path)) throw new Error('Folder already exists.');
    if (hiddenPath(path)) throw new Error('OBSIDIAN_TEST_KIT_HIDDEN_PATH: use vault.adapter for hidden paths');
    this.adapter.ensureFolder(path); this.reconcile(false);
    const folder = this.getFolderByPath(path); if (!folder) throw missing(path);
    return folder;
  }
  async modify(file: TFile, data: string): Promise<void> { this.write(file, data); }
  async append(file: TFile, data: string): Promise<void> { this.write(file, this.adapter.text(this.live(file).path) + data); }
  /** Synchronous read-modify-write: a throwing callback leaves the bytes untouched. */
  async process(file: TFile, fn: (data: string) => string): Promise<string> {
    const next = fn(this.adapter.text(this.live(file).path)); this.write(file, next); return next;
  }
  async delete(file: TAbstractFile, _force?: boolean): Promise<void> { this.adapter.drop(this.live(file).path); this.reconcile(false); }
  /** `system=false` moves bytes into the hidden `.trash` folder; both are recorded in `trashed`. */
  async trash(file: TAbstractFile, system: boolean): Promise<void> {
    const entry = this.live(file);
    this.trashed.push({ path: entry.path, system, data: entry instanceof TFile ? this.adapter.text(entry.path) : null });
    if (system) this.adapter.drop(entry.path); else this.adapter.move(entry.path, `.trash/${entry.name}`);
    this.reconcile(false);
  }
  /** Keeps object identity and fires `rename` for the entry and every descendant. */
  async rename(file: TAbstractFile, newPath: string): Promise<void> {
    const entry = this.live(file); const oldPath = entry.path;
    if (newPath === oldPath) return;
    this.creatable(newPath);
    const moved = entry instanceof TFolder ? [entry, ...descendants(entry)] : [entry];
    const previous = moved.map(item => item.path);
    this.adapter.move(oldPath, newPath);
    for (const item of moved) this.index.delete(item.path);
    this.detach(entry);
    moved.forEach((item, i) => item.setPath(newPath + (previous[i] ?? '').slice(oldPath.length)));
    for (const item of moved) this.index.set(item.path, item);
    this.attach(entry);
    moved.forEach((item, i) => {
      this.trigger('rename', item, previous[i]);
      if (item instanceof TFile) this.observer?.renamed(item, previous[i] ?? '');
    });
  }
  async copy(file: TFile, newPath: string): Promise<TFile> { return this.create(newPath, await this.read(file)); }
  getResourcePath(file: TFile): string { return this.adapter.getResourcePath(file.path); }
  /** Kit-only: load files without events, as if they existed before the app started. */
  seed(files: Readonly<Record<string, string>>): void {
    for (const [path, data] of Object.entries(files)) this.adapter.put(path, data);
    this.reconcile(true);
  }
  private creatable(path: string): void {
    if (this.adapter.files.has(path) || this.adapter.folders.has(path)) throw new Error('File already exists.');
    if (hiddenPath(path)) throw new Error('OBSIDIAN_TEST_KIT_HIDDEN_PATH: use vault.adapter for hidden paths');
    const parent = parentPath(path);
    if (parent && !this.adapter.folders.has(parent)) throw new Error(`ENOENT: parent folder does not exist, '${parent}'`);
  }
  private write(file: TFile, data: string): void { this.adapter.put(this.live(file).path, data); this.reconcile(false); }
  private live<T extends TAbstractFile>(file: T): T {
    const entry: TAbstractFile = file;
    if (entry !== this.rootFolder && this.index.get(entry.path) !== entry) throw missing(entry.path);
    return file;
  }
  private attach(entry: TAbstractFile): void {
    const parent = this.getFolderByPath(parentPath(entry.path) || '/') ?? this.rootFolder;
    entry.parent = parent; parent.children.push(entry);
  }
  private detach(entry: TAbstractFile): void {
    if (entry.parent) entry.parent.children = entry.parent.children.filter(child => child !== entry);
    entry.parent = null;
  }
  /** Align the index with raw storage: additions (parents first), modifications, removals (children first). */
  private reconcile(silent: boolean): void {
    const visible = (path: string) => !hiddenPath(path);
    for (const path of [...this.adapter.folders].filter(visible).sort((a, b) => depth(a) - depth(b))) {
      if (this.index.has(path)) continue;
      const folder = new TFolder(path, this); this.index.set(path, folder); this.attach(folder);
      if (!silent) this.trigger('create', folder);
    }
    for (const [path, stored] of [...this.adapter.files].filter(([path]) => visible(path))) {
      const existing = this.index.get(path);
      const file = existing instanceof TFile ? existing : new TFile(path, this);
      if (this.seen.get(file) === stored.revision) continue;
      const created = !existing; this.seen.set(file, stored.revision);
      Object.assign(file.stat, { ctime: stored.ctime, mtime: stored.mtime, size: utf8Size(stored.data) });
      if (created) { this.index.set(path, file); this.attach(file); }
      if (!silent) this.trigger(created ? 'create' : 'modify', file);
      this.observer?.changed(file, stored.data, silent);
    }
    const gone = [...this.index.values()].filter(entry => entry instanceof TFile ? !this.adapter.files.has(entry.path) : !this.adapter.folders.has(entry.path));
    for (const entry of gone.sort((a, b) => depth(b.path) - depth(a.path))) {
      this.index.delete(entry.path); this.detach(entry);
      if (!silent) this.trigger('delete', entry);
      if (entry instanceof TFile) { this.seen.delete(entry); this.observer?.deleted(entry); }
    }
  }
}

/** A standalone in-memory vault. Prefer `createTestApp` when code also needs workspace or metadata. */
export function createTestVault(files: Readonly<Record<string, string>> = {}, options: { name?: string; configDir?: string } = {}): Vault {
  const vault = new Vault(options); vault.seed(files); return vault;
}
