import { TextFileView, type WorkspaceLeaf } from 'obsidian';
import { pluginIdentity } from '../plugin-identity';
import { validateFileContent, type NativeFileDefinition } from '../../domain/native-integrations';

/** TextFileView owns file IO, rename handling and save-on-close. Never reserialize the user's bytes. */
export abstract class CustomFileView extends TextFileView {
  private raw = '';
  private editor?: HTMLTextAreaElement;
  private status?: HTMLElement;
  private stopped = false;
  constructor(
    leaf: WorkspaceLeaf,
    private readonly definition: NativeFileDefinition,
    private readonly report: (code: string) => void,
  ) {
    super(leaf);
  }
  getIcon(): string {
    return 'file-code';
  }
  getViewData(): string {
    return this.raw;
  }
  setViewData(data: string, clear: boolean): void {
    if (clear) this.clear();
    this.raw = data;
    if (this.stopped) return;
    if (!this.editor) this.renderEditor();
    if (this.editor) this.editor.value = data;
    this.refreshValidation();
  }
  clear(): void {
    this.raw = '';
    if (this.editor) this.editor.value = '';
    if (this.status) this.status.textContent = '';
  }
  /** Keep the buffer available for the host's final save; do not detach workspace leaves. */
  disposeNativeView(): void {
    this.stopped = true;
    if (this.editor) this.editor.disabled = true;
  }
  override async save(clear?: boolean): Promise<void> {
    try {
      await super.save(clear);
    } catch {
      if (this.status)
        this.status.textContent = 'Save failed. Your text is still in this view. Copy it before closing, then retry.';
      this.report('native.file.save');
      // A rejected save must remain visible to host callers (including close/unload).
      throw new Error('NATIVE_FILE_SAVE_FAILED');
    }
  }
  private renderEditor(): void {
    this.contentEl.empty();
    this.contentEl.addClass(pluginIdentity.rootClass, pluginIdentity.scopeClass, 'shell-native-file');
    this.contentEl.dataset.pluginUi = pluginIdentity.id;
    this.contentEl.createEl('h2', { text: this.definition.name });
    this.contentEl.createEl('p', {
      text: 'Edit the file text directly. Changes are saved by Obsidian. Validation never replaces your content.',
    });
    this.editor = this.contentEl.createEl('textarea', {
      attr: { 'aria-label': this.definition.name + ' contents', spellcheck: 'false', rows: '20' },
    });
    this.status = this.contentEl.createEl('p', { attr: { role: 'status', 'aria-live': 'polite' } });
    this.registerDomEvent(this.editor, 'input', () => {
      if (this.stopped || !this.editor) return;
      this.raw = this.editor.value;
      this.refreshValidation();
      this.requestSave();
    });
  }
  private refreshValidation(): void {
    if (this.status)
      this.status.textContent =
        validateFileContent(this.definition, this.raw) ??
        'Valid ' + this.definition.format.toUpperCase() + '. Changes use Obsidian’s file-save lifecycle.';
  }
}

/** Obsidian calls identity methods in its base constructor, before subclass fields exist. */
export function customFileViewClass(definition: NativeFileDefinition, viewType: string): new (leaf: WorkspaceLeaf, report: (code: string) => void) => CustomFileView {
  return class RegisteredCustomFileView extends CustomFileView {
    constructor(leaf: WorkspaceLeaf, report: (code: string) => void) {
      super(leaf, definition, report);
    }
    getViewType(): string {
      return viewType;
    }
    getDisplayText(): string {
      return this.file?.basename ?? definition.name;
    }
  };
}
