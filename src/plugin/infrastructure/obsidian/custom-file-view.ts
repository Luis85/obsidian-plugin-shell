import { TextFileView, type WorkspaceLeaf } from 'obsidian';
import { pluginIdentity } from '../plugin-identity';
import { validateFileContent, type NativeFileDefinition } from '../../domain/native-integrations';
import type { NativeFileEditorSession, NativeFileEditorState } from '../../application/native-file-editor';

/** Mounts a registered editor UI into the view; returns its release. Bootstrap supplies the Vue implementation. */
export type MountNativeFileEditor = (root: HTMLElement, session: NativeFileEditorSession) => () => void;

/** TextFileView owns file IO, rename handling and save-on-close. Never reserialize the user's bytes. */
export abstract class CustomFileView extends TextFileView {
  private raw = '';
  private rendered = false;
  private editor?: HTMLTextAreaElement;
  private status?: HTMLElement;
  private release?: () => void;
  private stopped = false;
  private readonly listeners = new Set<() => void>();
  private readonly session: NativeFileEditorSession;
  constructor(
    leaf: WorkspaceLeaf,
    private readonly definition: NativeFileDefinition,
    private readonly report: (code: string) => void,
    private readonly mountEditor?: MountNativeFileEditor,
  ) {
    super(leaf);
    this.session = {
      definition,
      current: () => this.state(),
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      update: (content) => this.replace(content),
    };
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
    if (!this.rendered) this.renderEditor();
    if (this.editor) this.editor.value = data;
    this.refreshValidation();
    this.notify();
  }
  clear(): void {
    this.raw = '';
    if (this.editor) this.editor.value = '';
    if (this.status) this.status.textContent = '';
    this.notify();
  }
  /** Keep the buffer available for the host's final save; do not detach workspace leaves. */
  disposeNativeView(): void {
    this.stopped = true;
    if (this.editor) this.editor.disabled = true;
    this.notify();
    this.unmountEditor();
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
  protected override async onClose(): Promise<void> {
    try {
      await super.onClose();
    } finally {
      this.unmountEditor();
    }
  }
  private state(): NativeFileEditorState {
    const file = this.file ? { path: this.file.path, name: this.file.name, basename: this.file.basename } : null;
    return { content: this.raw, file, validation: validateFileContent(this.definition, this.raw), editable: !this.stopped };
  }
  private replace(content: string): void {
    if (this.stopped || typeof content !== 'string' || content === this.raw) return;
    this.raw = content;
    this.notify();
    this.requestSave();
  }
  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      try {
        listener();
      } catch {
        this.report('native.file.editor-listener');
      }
    }
  }
  private unmountEditor(): void {
    const release = this.release;
    this.release = undefined;
    this.listeners.clear();
    if (!release) return;
    try {
      release();
    } catch {
      this.report('native.file.editor-dispose');
    }
  }
  private renderEditor(): void {
    this.rendered = true;
    this.contentEl.empty();
    this.contentEl.addClass(pluginIdentity.rootClass, pluginIdentity.scopeClass, 'shell-native-file');
    this.contentEl.dataset.pluginUi = pluginIdentity.id;
    if (this.mountEditor && this.renderCustomEditor(this.mountEditor)) return;
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
  /** A failing custom editor falls back to the raw text editor, so the file stays editable. */
  private renderCustomEditor(mount: MountNativeFileEditor): boolean {
    const root = this.contentEl.createDiv({ cls: 'shell-native-file-editor' });
    try {
      this.release = mount(root, this.session);
    } catch {
      this.report('native.file.editor-mount');
      this.listeners.clear();
      this.contentEl.empty();
      return false;
    }
    this.status = this.contentEl.createEl('p', { attr: { role: 'status', 'aria-live': 'polite' } });
    return true;
  }
  private refreshValidation(): void {
    if (this.status && this.editor)
      this.status.textContent =
        validateFileContent(this.definition, this.raw) ??
        'Valid ' + this.definition.format.toUpperCase() + '. Changes use Obsidian’s file-save lifecycle.';
  }
}

/** Obsidian calls identity methods in its base constructor, before subclass fields exist. */
export function customFileViewClass(definition: NativeFileDefinition, viewType: string, mountEditor?: MountNativeFileEditor): new (leaf: WorkspaceLeaf, report: (code: string) => void) => CustomFileView {
  return class RegisteredCustomFileView extends CustomFileView {
    constructor(leaf: WorkspaceLeaf, report: (code: string) => void) {
      super(leaf, definition, report, mountEditor);
    }
    getViewType(): string {
      return viewType;
    }
    getDisplayText(): string {
      return this.file?.basename ?? definition.name;
    }
  };
}
