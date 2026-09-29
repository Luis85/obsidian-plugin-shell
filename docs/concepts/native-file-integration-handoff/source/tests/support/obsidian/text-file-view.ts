/** Opt-in TextFileView protocol double. This is not real Obsidian persistence/concurrency evidence. */
import { ItemView } from './workspace';
import { TFile } from './files';
export abstract class TextFileView extends ItemView {
  file: TFile | null = null;
  data = '';
  abstract getViewData(): string;
  abstract setViewData(data: string, clear: boolean): void;
  abstract clear(): void;
  override getState(): Record<string, unknown> { return {file:this.file?.path}; }
  override async setState(state: unknown): Promise<void> {
    if (this.file) await this.save(true);
    this.clear();
    const path = state && typeof state === 'object' && 'file' in state && typeof state.file === 'string' ? state.file : '';
    this.file = this.app.vault.getFileByPath(path);
    this.data = this.file ? await this.app.vault.read(this.file) : '';
    this.setViewData(this.data,true);
  }
  async save(_clear?: boolean): Promise<void> {
    if (!this.file) return;
    const content = this.getViewData();
    if (content !== this.data) { await this.app.vault.modify(this.file,content); this.data = content; }
  }
  override async closeView(): Promise<void> { await this.save(true); await super.closeView(); }
}
