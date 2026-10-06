import type { App, PluginManifest } from 'obsidian';

/** The public App plus the few host internals real-Obsidian tests read. These internals
 * are not part of obsidian.d.ts; keep their use in tests and re-check them on host updates. */
export interface HostApp extends App {
  readonly plugins: {
    readonly plugins: Record<string, { readonly _loaded?: boolean } | undefined>;
    readonly manifests: Record<string, PluginManifest | undefined>;
    readonly enabledPlugins: Set<string>;
  };
  readonly commands: {
    readonly commands: Record<string, { readonly id: string; readonly name: string } | undefined>;
    listCommands(): { readonly id: string; readonly name: string; checkCallback?: (checking: boolean) => boolean | void;
      editorCallback?: unknown; editorCheckCallback?: unknown }[];
    executeCommandById(id: string): boolean;
  };
  readonly viewRegistry: { readonly viewByType: Record<string, unknown> };
}
/** What `obsidian.eval` hands to a function running inside the Obsidian window. */
export interface HostContext {
  readonly app: HostApp;
  readonly pluginId: string;
  readonly plugin: unknown;
}

declare global {
  interface Window { app: HostApp }
}
