import type { DataAdapter, PluginManifest } from 'obsidian';
import type { SettingsStorage } from '../../application/ports';

interface SettingsHost {
  readonly manifest: Pick<PluginManifest, 'id' | 'dir'>;
  readonly app: { readonly vault: { readonly configDir: string; readonly adapter: Pick<DataAdapter, 'exists' | 'read'> } };
  loadData(): Promise<unknown>;
  saveData(value: unknown): Promise<void>;
}

/** Read exact plugin JSON through the public vault adapter; keep the single host writer. */
export function nativeSettingsStorage(plugin: SettingsHost): SettingsStorage {
  const vault = plugin.app.vault;
  const directory = plugin.manifest.dir ?? `${vault.configDir}/plugins/${plugin.manifest.id}`;
  const path = `${directory.replaceAll('\\', '/').replace(/\/+$/, '')}/data.json`;
  return {
    load: () => plugin.loadData(),
    async read() {
      if (!await vault.adapter.exists(path)) return null;
      // A disappeared/inaccessible file after the existence check is a failed read.
      return vault.adapter.read(path);
    },
    save: value => plugin.saveData(value),
  };
}
