import { Modal, Notice, TFile, type Plugin } from 'obsidian';
import { nativeDocumentStorage } from './document-storage';
import { nativeNotification } from './notification-sink';
import { nativeModalSink } from './modal-sink';
import { failure, success } from '../../domain/outcome';
import type { ServiceAdapters } from '../../application/ports';
/** All Obsidian/file objects end at this adapter. */
export function nativeAdapters(plugin: Plugin): ServiceAdapters {
  const { app } = plugin;
  const modals = new Set<Modal>();
  const key = (value: string) => `${plugin.manifest.id}:${value}`;
  return {
    settings: { load: () => plugin.loadData(), save: value => plugin.saveData(value) },
    local: { get: name => app.loadLocalStorage(key(name)), set: (name, value) => app.saveLocalStorage(key(name), value) },
    newId: () => crypto.randomUUID(), now: () => new Date().toISOString(),
    documents: nativeDocumentStorage(app.vault),
    modals: nativeModalSink(app),
    host: {
      kind: 'obsidian',
      dispose() { for (const modal of modals) modal.close(); },
      async openDocument(path) {
        try {
          const file = app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile)) return failure('storage', 'error.open');
          await app.workspace.getLeaf('tab').openFile(file); return success(undefined);
        }
        catch { return failure('storage', 'error.open'); }
      },
      showModal(title, text) {
        const modal = new Modal(app);
        modal.setTitle(title);
        modal.contentEl.createEl('p', { text });
        modals.add(modal);
        modal.onClose = () => { modals.delete(modal); };
        modal.open();
      },
      notice(text, duration = 4000) { const notice = new Notice(text, duration); return () => notice.hide(); },
      notification: nativeNotification,
    },
  };
}
