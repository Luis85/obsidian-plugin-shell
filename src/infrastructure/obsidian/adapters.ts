import { Modal, Notice, TFile, TFolder, type Plugin } from 'obsidian';
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
    documents: {
      async create(path, markdown) {
        if (app.vault.getAbstractFileByPath(path)) return failure('conflict', 'error.conflict');
        const segments = path.split('/').slice(0, -1);
        try {
          for (let i = 1; i <= segments.length; i++) {
            const folder = segments.slice(0, i).join('/');
            const existing = app.vault.getAbstractFileByPath(folder);
            if (existing && !(existing instanceof TFolder)) return failure('conflict', 'error.conflict');
            if (!existing) {
              try { await app.vault.createFolder(folder); }
              catch { if (!(app.vault.getAbstractFileByPath(folder) instanceof TFolder)) return failure('storage', 'error.write'); }
            }
          }
        } catch { return failure('storage', 'error.write'); }
        if (app.vault.getAbstractFileByPath(path)) return failure('conflict', 'error.conflict');
        try { await app.vault.create(path, markdown); return success(undefined); }
        catch {
          // Never retry an uncertain write under a different name. Reconcile the exact content.
          try {
            const file = app.vault.getAbstractFileByPath(path);
            if (file instanceof TFile && await app.vault.read(file) === markdown) return success(undefined);
          } catch { /* The original effect remains uncertain. */ }
          return failure('uncertain', 'error.uncertain');
        }
      },
    },
    host: {
      kind: 'obsidian',
      dispose() { for (const modal of modals) modal.close(); },
      async openDocument(path) {
        const file = app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) return failure('storage', 'error.open');
        try { await app.workspace.getLeaf('tab').openFile(file); return success(undefined); }
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
    },
  };
}
