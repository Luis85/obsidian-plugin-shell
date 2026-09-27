import { Modal, Notice, TFile, TFolder, type Plugin } from 'obsidian';
import {
  validateNativeDefinitions,
  type NativeFileDefinition,
  type NativeMenuDefinition,
} from '../../domain/native-integrations';
import { customFileViewClass, type CustomFileView } from './custom-file-view';
import { CreateCustomFileModal } from './create-custom-file';

/** All host registrations are plugin-owned. Disposing only releases our callbacks, views and dialogs. */
export function bindNativeIntegrations(
  plugin: Plugin,
  files: readonly NativeFileDefinition[],
  menus: readonly NativeMenuDefinition[],
  report: (code: string) => void,
): () => void {
  validateNativeDefinitions(files, menus);
  if (!files.length && !menus.length) return () => {};
  let disposed = false;
  let stopMenu = () => {};
  const commandIds: string[] = [];
  const views = new Set<CustomFileView>();
  const modals = new Set<Modal>();
  const fail = (code: string) => {
    report(code);
    if (!disposed) new Notice('Native file action failed. No replacement or retry was performed.');
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopMenu();
    for (const id of commandIds) {
      try {
        plugin.removeCommand(id);
      } catch {
        report('native.command.dispose');
      }
    }
    for (const modal of modals) {
      try {
        modal.close();
      } catch {
        report('native.modal.dispose');
      }
    }
    modals.clear();
    for (const view of views) {
      try {
        view.disposeNativeView();
      } catch {
        report('native.view.dispose');
      }
    }
    views.clear();
  };
  const create = (definition: NativeFileDefinition, folder: TFolder) => {
    if (disposed) return;
    const modal = new CreateCustomFileModal(
      plugin,
      definition,
      folder,
      () => !disposed,
      () => modals.delete(modal),
    );
    modals.add(modal);
    try {
      modal.open();
    } catch {
      modals.delete(modal);
      fail('native.file.create-dialog');
    }
  };
  const open = async (file: TFile) => {
    if (disposed) return;
    try {
      await plugin.app.workspace.getLeaf('tab').openFile(file);
    } catch {
      fail('native.file.open');
    }
  };
  const invoke = async (definition: NativeMenuDefinition, file: TFile) => {
    if (disposed || !definition.extensions.includes(file.extension.toLowerCase())) return;
    try {
      const result = await definition.run({ path: file.path, name: file.name, extension: file.extension });
      if (disposed) return;
      const modal = new Modal(plugin.app);
      modal.setTitle(result.title);
      modal.contentEl.createEl('p', { text: result.message });
      modal.onClose = () => {
        modal.contentEl.empty();
        modals.delete(modal);
      };
      modals.add(modal);
      modal.open();
    } catch {
      fail('native.menu.execute');
    }
  };
  try {
    for (const definition of files) {
      const type = plugin.manifest.id + '-file-' + definition.id;
      const View = customFileViewClass(definition, type);
      plugin.registerView(type, (leaf) => {
        const view = new View(leaf, fail);
        views.add(view);
        view.register(() => views.delete(view));
        return view;
      });
      // Do not unregister or override another plugin's association; host conflicts fail startup.
      plugin.registerExtensions([definition.extension], type);
      commandIds.push('native-create-' + definition.id);
      plugin.addCommand({
        id: 'native-create-' + definition.id,
        name: 'Create ' + definition.name,
        callback: () => create(definition, plugin.app.vault.getRoot()),
      });
    }
    if (files.length || menus.length) {
      const ref = plugin.app.workspace.on('file-menu', (menu, file) => {
        if (disposed) return;
        for (const definition of files) {
          if (file instanceof TFolder)
            menu.addItem((item) =>
              item
                .setTitle('Create ' + definition.name)
                .setIcon('file-plus')
                .onClick(() => create(definition, file)),
            );
          else if (file instanceof TFile && file.extension.toLowerCase() === definition.extension)
            menu.addItem((item) =>
              item
                .setTitle('Open ' + definition.name)
                .setIcon('file-code')
                .onClick(() => {
                  void open(file);
                }),
            );
        }
        if (file instanceof TFile)
          for (const definition of menus) {
            if (definition.extensions.includes(file.extension.toLowerCase()))
              menu.addItem((item) =>
                item
                  .setTitle(definition.name)
                  .setIcon('file-search')
                  .onClick(() => {
                    void invoke(definition, file);
                  }),
              );
          }
      });
      plugin.registerEvent(ref);
      stopMenu = () => plugin.app.workspace.offref(ref);
    }
    plugin.register(dispose);
    return dispose;
  } catch (error) {
    dispose();
    throw error;
  }
}
