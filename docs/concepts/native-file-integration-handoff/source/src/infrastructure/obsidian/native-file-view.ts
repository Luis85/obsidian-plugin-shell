import { TextFileView, type WorkspaceLeaf } from 'obsidian';
import type { NativeFileType } from '../../domain/native-file';
import { NativeFileDraft } from '../../application/native-file-draft';
import { pluginIdentity } from '../plugin-identity';
export type NativeFailure = (code: string, operation: string) => void;
/** Identity methods close over the definition: Obsidian calls them from super(). */
export function nativeFileViewClass(type: NativeFileType, viewType: string, report: NativeFailure, active: () => boolean) {
  return class NativeFileView extends TextFileView {
    private readonly draft = new NativeFileDraft(type);
    private editor?: HTMLTextAreaElement;
    private status?: HTMLElement;
    private saveButton?: HTMLButtonElement;
    private discardButton?: HTMLButtonElement;
    private saving = false;
    private generation = 0;
    constructor(leaf: WorkspaceLeaf) { super(leaf); }
    getViewType(): string { return viewType; }
    getDisplayText(): string { return this.file?.basename ?? type.name; }
    getIcon(): string { return type.icon; }
    getViewData(): string { return this.draft.content; }
    setViewData(data: string, clear: boolean): void {
      if (clear) this.generation++;
      this.draft.load(data,clear); this.renderState();
    }
    clear(): void { this.generation++; this.draft.load('',true); this.renderState(); }
    async onOpen(): Promise<void> {
      this.contentEl.empty();
      const root = this.contentEl.createDiv({ cls: [pluginIdentity.rootClass,pluginIdentity.scopeClass,'native-file-editor'] });
      root.dataset.pluginUi = pluginIdentity.id;
      root.createEl('h2',{text:type.name});
      root.createEl('p',{text:'Save writes valid content. Drafts are not autosaved: copy invalid or conflicted text before closing. Closing discards unsaved edits.'});
      const label = root.createEl('label'); label.createSpan({text:'File contents'});
      this.editor = label.createEl('textarea',{attr:{rows:18,spellcheck:'false','aria-label':'File contents'}});
      this.registerDomEvent(this.editor,'input',() => { this.draft.edit(this.editor!.value); this.renderState(); });
      const actions = root.createDiv();
      this.saveButton = actions.createEl('button',{text:'Save',attr:{type:'button'}});
      this.discardButton = actions.createEl('button',{text:'Discard draft / load incoming',attr:{type:'button'}});
      this.registerDomEvent(this.saveButton,'click',() => { void this.commitDraft(); });
      this.registerDomEvent(this.discardButton,'click',() => { this.draft.discard(); this.renderState(); });
      this.status = root.createEl('p',{attr:{role:'status','aria-live':'polite'}});
      this.renderState();
    }
    private progressText(): string {
      if (this.saving) return 'Saving…';
      return this.draft.dirty ? 'Unsaved draft. Save before closing this view.' : 'No unsaved changes.';
    }
    private controlState() {
      const readOnly = this.saving || !active(), issue = this.draft.issue;
      return {
        readOnly, invalid: Boolean(issue), message: issue ?? this.progressText(),
        saveDisabled: readOnly || !this.draft.dirty || Boolean(issue),
        discardDisabled: readOnly || (!this.draft.dirty && !this.draft.blocked),
      };
    }
    private renderState(): void {
      if (!this.editor || !this.status || !this.saveButton || !this.discardButton) return;
      const state = this.controlState();
      if (this.editor.value !== this.draft.draft) this.editor.value = this.draft.draft;
      this.editor.readOnly = state.readOnly;
      this.editor.setAttribute('aria-invalid',String(state.invalid));
      this.status.textContent = state.message;
      this.saveButton.disabled = state.saveDisabled;
      this.discardButton.disabled = state.discardDisabled;
    }
    private async commitDraft(): Promise<void> {
      if (!active() || this.saving || !this.file || !this.draft.dirty || !this.draft.accept()) return;
      this.saving = true; const generation = this.generation, content = this.draft.content;
      this.renderState();
      try { await this.save(); if (this.generation === generation) this.draft.saved(content); }
      catch { if (this.generation === generation) this.draft.failed(); report('native.save-failed','file.save'); }
      finally { this.saving = false; this.renderState(); }
    }
    /** Never retry an uncertain write during host close; preserve invalid/incoming bytes. */
    override async save(clear?: boolean): Promise<void> {
      if (this.draft.blocked) return;
      await super.save(clear);
    }
    async onClose(): Promise<void> {
      this.generation++; this.contentEl.empty(); this.editor = undefined; this.status = undefined;
      this.saveButton = undefined; this.discardButton = undefined;
    }
  };
}
