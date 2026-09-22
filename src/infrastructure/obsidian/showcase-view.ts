import { ItemView, type WorkspaceLeaf } from 'obsidian';
export const SHOWCASE_VIEW = 'plugin-shell-showcase';
export type MountView = (root: HTMLElement) => () => void;
export class ShowcaseView extends ItemView {
  private cleanup?: () => void;
  constructor(leaf: WorkspaceLeaf, private readonly mountUi: MountView) { super(leaf); }
  getViewType(): string { return SHOWCASE_VIEW; }
  getDisplayText(): string { return 'Plugin shell'; }
  getIcon(): string { return 'blocks'; }
  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('plugin-shell-host');
    const root = this.contentEl.createDiv({ cls: 'plugin-shell' });
    this.cleanup = this.mountUi(root);
  }
  async onClose(): Promise<void> { this.cleanup?.(); this.cleanup = undefined; }
}
