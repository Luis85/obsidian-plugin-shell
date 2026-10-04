import { Modal, Setting, type Plugin, type TFolder } from 'obsidian';
import { nativeFilePath, type NativeFileDefinition } from '../../domain/native-integrations';

/** No write occurs before explicit confirmation; vault.create never overwrites an existing file. */
export class CreateCustomFileModal extends Modal {
  private busy = false;
  private closed = false;
  constructor(
    private readonly plugin: Plugin,
    private readonly definition: NativeFileDefinition,
    private readonly folder: TFolder,
    private readonly active: () => boolean,
    private readonly finished: () => void,
  ) {
    super(plugin.app);
  }
  override onOpen(): void {
    this.setTitle('Create ' + this.definition.name);
    let name = 'Untitled';
    this.contentEl.createEl('p', {
      text:
        'Create a .' +
        this.definition.extension +
        ' file in ' +
        (this.folder.path || 'the vault root') +
        '. Existing files are never replaced.',
    });
    const status = this.contentEl.createEl('p', { attr: { role: 'status' } });
    new Setting(this.contentEl).setName('File name (without extension)').addText((input) =>
      input.setValue(name).onChange((value) => {
        name = value;
      }),
    );
    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText('Create file')
        .setCta()
        .onClick(() => {
          void this.create(name, status, (disabled) => button.setDisabled(disabled));
        }),
    );
  }
  private async create(input: string, status: HTMLElement, disable: (value: boolean) => unknown): Promise<void> {
    if (this.busy || this.closed || !this.active()) return;
    const path = nativeFilePath(this.folder.path, input, this.definition.extension);
    if (!path) {
      status.textContent = 'Use a file name without folders, reserved names, or special characters.';
      return;
    }
    this.busy = true;
    disable(true);
    let file;
    try {
      file = await this.plugin.app.vault.create(path, this.definition.initialContent);
    } catch {
      this.busy = false;
      disable(false);
      status.textContent = 'File was not created. Check whether the name already exists or the folder is writable.';
      return;
    }
    // A committed create must not be retried merely because opening the view fails.
    if (this.closed || !this.active()) return;
    try {
      await this.plugin.app.workspace.getLeaf('tab').openFile(file);
      this.close();
    } catch {
      status.textContent =
        'File created, but the view could not open. Open the file from the file explorer. Do not create it again.';
    }
  }
  override onClose(): void {
    this.closed = true;
    this.contentEl.empty();
    this.finished();
  }
}
