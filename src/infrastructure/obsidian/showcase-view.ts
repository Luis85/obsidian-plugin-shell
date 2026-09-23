import { ItemView, Menu, type WorkspaceLeaf } from 'obsidian';
import type { PreferenceService } from '../../application/preference-service';
import type { ErrorReporter } from '../../application/ports';
import { bindViewHeader, SHOWCASE_VIEW } from './view-header';
import { pluginIdentity } from '../plugin-identity';
export { SHOWCASE_VIEW } from './view-header';
export type MountView = (root: HTMLElement, showViewActions: (event: MouseEvent) => void) => () => void;
interface ViewServices {
  preferences: PreferenceService;
  diagnostics: ErrorReporter;
  text(key: string): string;
  toggleHeader(): void;
}
export class ShowcaseView extends ItemView {
  private cleanup?: () => void;
  private restoreHeader?: () => void;
  private root?: HTMLElement;
  private menu?: Menu;
  constructor(leaf: WorkspaceLeaf, private readonly mountUi: MountView, private readonly services: ViewServices,
    private readonly owned: (view: ShowcaseView, open: boolean) => void) { super(leaf); }
  getViewType(): string { return SHOWCASE_VIEW; }
  getDisplayText(): string { return pluginIdentity.name; }
  getIcon(): string { return 'blocks'; }
  async onOpen(): Promise<void> {
    this.disposeView();
    this.owned(this, true);
    try {
      this.contentEl.empty();
      this.contentEl.addClass(pluginIdentity.hostClass);
      this.root = this.contentEl.createDiv({ cls: pluginIdentity.rootClass });
      this.restoreHeader = bindViewHeader(this.containerEl, this.services.preferences, this.services.diagnostics);
      this.cleanup = this.mountUi(this.root, event => this.showViewActions(event));
    } catch (error) { this.disposeView(); throw error; }
  }
  /** A host Menu, positioned in the owning document (including pop-out windows). */
  private showViewActions(event: MouseEvent): void {
    this.menu?.hide();
    const menu = new Menu(); this.menu = menu;
    this.onPaneMenu(menu, 'more-options');
    menu.addSeparator();
    menu.addItem(item => item.setTitle(this.services.text('view.split')).setIcon('separator-vertical').onClick(async () => {
      try { await this.app.workspace.getLeaf('split').setViewState({ type: SHOWCASE_VIEW, active: true }); }
      catch { this.services.diagnostics.report('view.split', 'view.open'); }
    }));
    menu.addItem(item => item.setTitle(this.services.text('view.popout')).setIcon('external-link').onClick(() => this.app.workspace.moveLeafToPopout(this.leaf)));
    menu.addItem(item => item.setTitle(this.services.text('view.close')).setIcon('x').onClick(() => this.leaf.detach()));
    const target = event.currentTarget;
    const rect = target && 'getBoundingClientRect' in target && typeof target.getBoundingClientRect === 'function'
      ? target.getBoundingClientRect() : this.containerEl.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom }, this.containerEl.ownerDocument);
  }
  onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    menu.addItem(item => item.setTitle(this.services.text('settings.hideHeader')).setIcon('panel-top').setChecked(this.services.preferences.current.hideObsidianViewHeader).onClick(() => this.services.toggleHeader()));
  }
  disposeView(): void {
    // Never detach a leaf on disposal/unload. Restore host presentation before services stop.
    try { this.menu?.hide(); this.cleanup?.(); }
    finally {
      this.menu = undefined; this.cleanup = undefined;
      this.restoreHeader?.(); this.restoreHeader = undefined;
      this.root?.remove(); this.root = undefined;
      this.contentEl.removeClass(pluginIdentity.hostClass); this.owned(this, false);
    }
  }
  async onClose(): Promise<void> { this.disposeView(); }
}
