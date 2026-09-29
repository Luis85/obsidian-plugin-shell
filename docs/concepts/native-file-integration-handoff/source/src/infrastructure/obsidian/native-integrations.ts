import { Modal, Notice, TFile, type Plugin } from 'obsidian';
import { NATIVE_TEXT_LIMIT, nativeTextIssue, type NativeFileType, type NativeFileAction } from '../../domain/native-file';
import { nativeFileViewClass, type NativeFailure } from './native-file-view';
/** Host-owned registrations are cleaned by Plugin. This scope revokes in-flight work and closes its modals. */
export function registerNativeIntegrations(plugin: Plugin, types: readonly NativeFileType[], actions: readonly NativeFileAction[], report: NativeFailure): () => void {
  let disposed = false;
  const modals = new Set<Modal>(), installed = new Map<string,string>(), pending = new Set<string>();
  const active = () => !disposed;
  const notice = (text: string) => { if (active()) new Notice(text); };
  const fail = (code: string, message: string) => { if (active()) { report(code,'native.integration'); notice(message); } };
  const matches = (file: unknown, extensions: readonly string[]): file is TFile => file instanceof TFile && extensions.includes(file.extension.toLowerCase());
  const current = (file: TFile, extensions: readonly string[]) => active() && matches(file,extensions) && plugin.app.vault.getAbstractFileByPath(file.path) === file;
  async function open(file: TFile, viewType: string): Promise<void> {
    if (!active()) return;
    const leaf = plugin.app.workspace.getLeaf('tab');
    await leaf.setViewState({type:viewType,active:true,state:{file:file.path}});
    if (active()) await plugin.app.workspace.revealLeaf(leaf);
  }
  async function create(type: NativeFileType, viewType: string): Promise<void> {
    if (!active() || pending.has(type.id)) return;
    pending.add(type.id);
    try {
      let path = `New-${type.id}.${type.extension}`, suffix = 2;
      while (plugin.app.vault.getAbstractFileByPath(path) && suffix <= 1000) path = `New-${type.id}-${suffix++}.${type.extension}`;
      if (plugin.app.vault.getAbstractFileByPath(path)) throw new Error('NATIVE_NAME_LIMIT');
      // Exactly one create; an uncertain failure never triggers an automatic retry.
      const file = await plugin.app.vault.create(path,type.defaultContent);
      try { await open(file,viewType); }
      catch { fail('native.open-failed','The file was created, but its view could not open. Open it from the file explorer; do not create it again.'); }
    } catch { fail('native.create-failed','The file could not be created. Check the vault before retrying.'); }
    finally { pending.delete(type.id); }
  }
  async function run(action: NativeFileAction, file: TFile): Promise<void> {
    if (!current(file,action.extensions) || pending.has(action.id)) return;
    const path = file.path; pending.add(action.id);
    try {
      const result = await action.run({name:file.name,extension:file.extension,async read() {
        if (!current(file,action.extensions) || file.path !== path) throw new Error('NATIVE_STALE_FILE');
        if (file.stat.size > NATIVE_TEXT_LIMIT) throw new Error('NATIVE_FILE_TOO_LARGE');
        const text = await plugin.app.vault.read(file);
        if (!current(file,action.extensions) || file.path !== path) throw new Error('NATIVE_STALE_FILE');
        if (text.length > NATIVE_TEXT_LIMIT || new TextEncoder().encode(text).length > NATIVE_TEXT_LIMIT) throw new Error('NATIVE_FILE_TOO_LARGE');
        return text;
      }});
      if (!current(file,action.extensions) || file.path !== path) return;
      if (typeof result.title !== 'string' || typeof result.message !== 'string' || result.title.length > 200 || result.message.length > 100000) throw new Error('NATIVE_ACTION_RESULT');
      const modal = new Modal(plugin.app); modals.add(modal); modal.setTitle(result.title);
      modal.onOpen = () => { modal.contentEl.createEl('p',{text:result.message}); };
      modal.onClose = () => { modal.contentEl.empty(); modals.delete(modal); };
      modal.open();
    } catch { fail('native.action-failed','The file action could not complete. No success was recorded.'); }
    finally { pending.delete(action.id); }
  }
  const stop = () => { if (disposed) return; disposed = true; for (const modal of modals) { try { modal.close(); } catch { report('native.cleanup-failed','native.integration'); } } modals.clear(); };
  // Register this before any host operation so partial startup failures also revoke the scope.
  plugin.register(stop);
  try {
    const ids = [...types,...actions].map(entry => entry.id);
    if (new Set(ids).size !== ids.length || new Set(types.map(type => type.extension)).size !== types.length) throw new Error('NATIVE_DUPLICATE_IDENTITY');
    for (const type of types) {
      if (nativeTextIssue(type.defaultContent,type)) throw new Error('NATIVE_DEFAULT_CONTENT');
      const viewType = `${plugin.manifest.id}-file-${type.id}`;
      const View = nativeFileViewClass(type,viewType,report,active);
      try { plugin.registerView(viewType,leaf => new View(leaf)); plugin.registerExtensions([type.extension],viewType); }
      catch { fail('native.registration-failed',`The .${type.extension} file type could not be registered. Another plugin may already own it.`); continue; }
      installed.set(type.extension,viewType);
      plugin.addCommand({id:`new-native-${type.id}`,name:`Create ${type.name} file`,callback:() => { void create(type,viewType); }});
    }
    for (const action of actions) plugin.addCommand({id:`native-action-${action.id}`,name:action.name,checkCallback(checking) {
      const file = plugin.app.workspace.getActiveFile();
      if (!active() || !matches(file,action.extensions)) return false;
      if (!checking) void run(action,file); return true;
    }});
    plugin.registerEvent(plugin.app.workspace.on('file-menu',(menu,file) => {
      if (!active() || !(file instanceof TFile)) return;
      const type = types.find(item => item.extension === file.extension.toLowerCase());
      const viewType = installed.get(file.extension.toLowerCase());
      if (type && viewType) menu.addItem(item => item.setTitle(`Open in ${type.name}`).setIcon(type.icon).onClick(() => {
        if (current(file,[type.extension])) void open(file,viewType).catch(() => fail('native.open-failed','The file view could not open. The file was not modified.'));
      }));
      for (const action of actions.filter(item => matches(file,item.extensions))) menu.addItem(item => item.setTitle(action.name).setIcon(action.icon).onClick(() => { void run(action,file); }));
    }));
    return stop;
  } catch (error) { stop(); throw error; }
}
