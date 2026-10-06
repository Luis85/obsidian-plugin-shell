/** Public TextFileView lifecycle double. Saves are explicit/awaitable, not a filesystem emulator. */
import { ItemView } from './workspace';
import type { TFile } from './files';
import { track } from './events';
export abstract class TextFileView extends ItemView {
  file: TFile | null = null;
  data = '';
  requestSave = (): void => {
    void track(this.save());
  };
  abstract getViewData(): string;
  abstract setViewData(data: string, clear: boolean): void;
  abstract clear(): void;
  override getState(): Record<string, unknown> {
    return { file: this.file?.path ?? null };
  }
  override async setState(state: unknown): Promise<void> {
    const path =
      state && typeof state === 'object' && 'file' in state && typeof state.file === 'string' ? state.file : null;
    const next = path ? this.app.vault.getFileByPath(path) : null;
    if (this.file && this.file !== next) await this.onUnloadFile(this.file);
    this.file = next;
    if (next) await this.onLoadFile(next);
  }
  async onLoadFile(file: TFile): Promise<void> {
    this.data = await this.app.vault.read(file);
    this.setViewData(this.data, true);
  }
  async onUnloadFile(_file: TFile): Promise<void> {
    await this.save();
    this.clear();
    this.file = null;
    this.data = '';
  }
  async save(_clear?: boolean): Promise<void> {
    const data = this.getViewData();
    if (this.file && data !== this.data) {
      await this.app.vault.modify(this.file, data);
      this.data = data;
    }
  }
  protected override async onClose(): Promise<void> {
    if (this.file) await this.onUnloadFile(this.file);
  }
}
