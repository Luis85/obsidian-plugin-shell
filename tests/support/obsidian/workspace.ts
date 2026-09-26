/** Workspace, leaves and views: registered view creators really open, close and receive state. */
import type { ViewState } from 'obsidian';
import type { App } from './app';
import { Component, type Scope } from './component';
import { make } from './dom';
import { Events, track } from './events';
import { TFile } from './files';
import type { Menu } from './ui';

export type ViewCreator = (leaf: WorkspaceLeaf) => View;
export type LeafKind = 'tab' | 'split' | 'window' | 'left' | 'right';

export abstract class View extends Component {
  app: App;
  icon = 'document';
  navigation = false;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  scope: Scope | null = null;
  /** Like the host, identity methods run inside this constructor, before subclass fields exist. */
  constructor(leaf: WorkspaceLeaf) {
    super(); this.leaf = leaf; this.app = leaf.app;
    this.containerEl = make(null, 'div', { cls: 'workspace-leaf-content', attr: { 'data-type': this.getViewType() } });
  }
  abstract getViewType(): string;
  getDisplayText(): string { return this.getViewType(); }
  getIcon(): string { return this.icon; }
  getState(): Record<string, unknown> { return {}; }
  async setState(_state: unknown, _result: { history: boolean }): Promise<void> {}
  getEphemeralState(): Record<string, unknown> { return {}; }
  setEphemeralState(_state: unknown): void {}
  onResize(): void {}
  onPaneMenu(_menu: Menu, _source: string): void {}
  protected async onOpen(): Promise<void> {}
  protected async onClose(): Promise<void> {}
  /** Kit-internal lifecycle used by leaves: load, then `onOpen`; `onClose`, then unload. */
  async openView(): Promise<void> { this.load(); await this.onOpen(); }
  async closeView(): Promise<void> { try { await this.onClose(); } finally { this.unload(); } }
}

export abstract class ItemView extends View {
  contentEl: HTMLElement;
  private readonly actionsEl: HTMLElement;
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    const header = make(this.containerEl, 'div', 'view-header');
    make(header, 'div', { cls: 'view-header-title', text: this.getDisplayText() });
    this.actionsEl = make(header, 'div', 'view-actions');
    this.contentEl = make(this.containerEl, 'div', 'view-content');
  }
  addAction(icon: string, title: string, callback: (event: MouseEvent) => unknown): HTMLElement {
    const action = make(this.actionsEl, 'button', { cls: ['clickable-icon', 'view-action'], attr: { 'aria-label': title, 'data-icon': icon } });
    action.addEventListener('click', callback); return action;
  }
}

/** Minimal file view: tracks its file; no editor or rendering. */
export class MarkdownView extends ItemView {
  file: TFile | null = null;
  getViewType(): string { return 'markdown'; }
  override getDisplayText(): string { return this.file?.basename ?? ''; }
  override getState(): Record<string, unknown> { return { file: this.file?.path ?? null }; }
  override async setState(state: unknown): Promise<void> {
    const path = typeof state === 'object' && state && 'file' in state && typeof state.file === 'string' ? state.file : null;
    this.file = path === null ? null : this.app.vault.getFileByPath(path);
  }
}
/** Placeholder for empty leaves and for views whose plugin unloaded or type is unknown. */
class PlaceholderView extends View {
  constructor(leaf: WorkspaceLeaf, private readonly type = 'empty', private readonly state: Record<string, unknown> = {}) {
    super(leaf); this.containerEl.setAttribute('data-type', type);
  }
  getViewType(): string { return this.type; }
  override getState(): Record<string, unknown> { return this.state; }
}

export class WorkspaceLeaf extends Events {
  readonly app: App;
  view: View;
  readonly containerEl: HTMLElement;
  pinned = false;
  constructor(readonly workspace: Workspace, public kind: LeafKind = 'tab') {
    super(); this.app = workspace.app;
    this.containerEl = make(null, 'div', 'workspace-leaf');
    this.view = new PlaceholderView(this); this.containerEl.append(this.view.containerEl);
  }
  get isDeferred(): boolean { return false; }
  async loadIfDeferred(): Promise<void> {}
  getViewState(): ViewState { return { type: this.view.getViewType(), state: this.view.getState(), active: this.workspace.activeLeaf === this, pinned: this.pinned }; }
  /** Unknown types keep a placeholder (no throw), like the host. */
  async setViewState(state: ViewState): Promise<void> {
    const creator = this.app.viewRegistry.getViewCreatorByType(state.type);
    const view = creator ? creator(this) : new PlaceholderView(this, state.type, state.state ?? {});
    await this.open(view, state.state);
    if (state.active) this.workspace.setActiveLeaf(this);
    this.workspace.trigger('layout-change');
  }
  async open(view: View, state?: unknown): Promise<View> {
    const previous = this.view; this.view = view;
    await previous.closeView();
    this.containerEl.replaceChildren(view.containerEl);
    if (state !== undefined) await view.setState(state, { history: false });
    await view.openView();
    return view;
  }
  async openFile(file: TFile, openState: { active?: boolean } = {}): Promise<void> {
    await this.setViewState({ type: 'markdown', state: { file: file.path }, active: openState.active ?? true });
    this.workspace.setActiveFile(file);
  }
  getDisplayText(): string { return this.view.getDisplayText(); }
  getIcon(): string { return this.view.getIcon(); }
  setPinned(pinned: boolean): void { this.pinned = pinned; }
  togglePinned(): void { this.pinned = !this.pinned; }
  getEphemeralState(): Record<string, unknown> { return this.view.getEphemeralState(); }
  setEphemeralState(state: unknown): void { this.view.setEphemeralState(state); }
  /** Closes the view (tracked for `flushObsidian`) and removes the leaf. */
  detach(): void {
    if (!this.workspace.leaves.includes(this)) return;
    this.workspace.remove(this);
    void track(this.view.closeView());
    this.containerEl.remove();
  }
  /** Kit-internal: the owning plugin unloaded; keep the leaf and its state, close the view. */
  unloadView(): void {
    const previous = this.view;
    this.view = new PlaceholderView(this, previous.getViewType(), previous.getState());
    this.containerEl.replaceChildren(this.view.containerEl);
    void track(previous.closeView());
  }
}

export class Workspace extends Events {
  layoutReady = false;
  activeLeaf: WorkspaceLeaf | null = null;
  readonly leaves: WorkspaceLeaf[] = [];
  private activeFile: TFile | null = null;
  private readonly readyCallbacks: (() => unknown)[] = [];
  private rootEl?: HTMLElement;
  constructor(readonly app: App) { super(); }
  /** Created on first access and attached to `document.body` when a DOM exists. */
  get containerEl(): HTMLElement {
    if (!this.rootEl) { this.rootEl = make(null, 'div', 'workspace'); document.body.append(this.rootEl); }
    return this.rootEl;
  }
  /** Runs immediately once the layout is ready, otherwise when `setLayoutReady()` runs. */
  onLayoutReady(callback: () => unknown): void { if (this.layoutReady) callback(); else this.readyCallbacks.push(callback); }
  /** Kit-only: finish startup (`TestApp.loadPlugin` does this after `onload`). */
  setLayoutReady(): void {
    if (this.layoutReady) return;
    this.layoutReady = true; for (const callback of this.readyCallbacks.splice(0)) callback();
  }
  /** `false`/omitted reuses the active unpinned leaf; anything else creates a new leaf. */
  getLeaf(newLeaf?: boolean | 'tab' | 'split' | 'window'): WorkspaceLeaf {
    if (!newLeaf && this.activeLeaf && !this.activeLeaf.pinned) return this.activeLeaf;
    return this.createLeaf(newLeaf === 'split' || newLeaf === 'window' ? newLeaf : 'tab');
  }
  getRightLeaf(_split: boolean): WorkspaceLeaf { return this.createLeaf('right'); }
  getLeftLeaf(_split: boolean): WorkspaceLeaf { return this.createLeaf('left'); }
  getLeavesOfType(type: string): WorkspaceLeaf[] { return this.leaves.filter(leaf => leaf.view.getViewType() === type); }
  getActiveViewOfType<T extends View>(type: abstract new (...args: never[]) => T): T | null {
    const view = this.activeLeaf?.view; return view instanceof type ? view : null;
  }
  getMostRecentLeaf(): WorkspaceLeaf | null { return this.activeLeaf; }
  iterateAllLeaves(callback: (leaf: WorkspaceLeaf) => unknown): void { for (const leaf of [...this.leaves]) callback(leaf); }
  iterateRootLeaves(callback: (leaf: WorkspaceLeaf) => unknown): void { this.iterateAllLeaves(leaf => { if (leaf.kind === 'tab' || leaf.kind === 'split') callback(leaf); }); }
  detachLeavesOfType(type: string): void { for (const leaf of this.getLeavesOfType(type)) leaf.detach(); }
  async revealLeaf(leaf: WorkspaceLeaf): Promise<void> { await leaf.loadIfDeferred(); }
  moveLeafToPopout(leaf: WorkspaceLeaf): { leaf: WorkspaceLeaf } { leaf.kind = 'window'; this.trigger('layout-change'); return { leaf }; }
  setActiveLeaf(leaf: WorkspaceLeaf): void {
    if (this.activeLeaf === leaf) return;
    this.activeLeaf = leaf; this.trigger('active-leaf-change', leaf);
    if (leaf.view instanceof MarkdownView && leaf.view.file) this.setActiveFile(leaf.view.file);
  }
  getActiveFile(): TFile | null { return this.activeFile; }
  /** Kit-only: make a file active and fire `file-open`, as opening it in the editor would. */
  setActiveFile(file: TFile | null): void {
    if (this.activeFile === file) return;
    this.activeFile = file; this.trigger('file-open', file);
  }
  async openLinkText(linktext: string, sourcePath: string, newLeaf?: boolean | 'tab' | 'split' | 'window'): Promise<void> {
    const file = this.app.metadataCache.getFirstLinkpathDest(linktext, sourcePath);
    if (!file) throw new Error(`OBSIDIAN_TEST_KIT_UNRESOLVED_LINK: ${linktext}`);
    await this.getLeaf(newLeaf).openFile(file);
  }
  requestSaveLayout(): void {}
  /** Kit-internal: the plugin that registered `type` unloaded. */
  unloadViewsOfType(type: string): void { for (const leaf of this.getLeavesOfType(type)) leaf.unloadView(); }
  /** Kit-internal bookkeeping for `WorkspaceLeaf.detach`. */
  remove(leaf: WorkspaceLeaf): void {
    this.leaves.splice(this.leaves.indexOf(leaf), 1);
    if (this.activeLeaf === leaf) this.activeLeaf = this.leaves.at(-1) ?? null;
    this.trigger('layout-change');
  }
  private createLeaf(kind: LeafKind): WorkspaceLeaf {
    const leaf = new WorkspaceLeaf(this, kind); this.leaves.push(leaf); this.containerEl.append(leaf.containerEl);
    return leaf;
  }
}
