import { TFile, TFolder, type EventRef, type Plugin } from 'obsidian';
import type { EventPublisher, ShellEvents } from '../../application/events';
import type { ErrorReporter, TimerScheduler, Unsubscribe } from '../../application/ports';

/** Native observations invalidate projections; they never claim a committed use case. */
export function bindHostEvents(plugin: Plugin, events: EventPublisher<Pick<ShellEvents, Extract<keyof ShellEvents, `host.${string}`>>>, errors: ErrorReporter, timers: TimerScheduler,
  options: { modifications?: boolean; metadata?: boolean; layoutDelay?: number } = {}): Unsubscribe {
  let disposed = false; let started = false; let revision = 0; let layoutTimer: Unsubscribe | undefined;
  const owned: { source: { offref(ref: EventRef): void }; ref: EventRef }[] = [];
  const { vault, workspace, metadataCache } = plugin.app;
  const controls = (value: string) => Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  const own = (source: { offref(ref: EventRef): void }, ref: EventRef) => { owned.push({ source, ref }); plugin.registerEvent(ref); };
  const path = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || !value || value.length > 4096 || /^[a-z]:/i.test(value) || value.includes('\\') || controls(value) || value.split('/').some(part => !part || part === '.' || part === '..')) { errors.report('host.payload', 'host.bridge'); return undefined; }
    const config = vault.configDir.replaceAll('\\', '/').toLowerCase().replace(/\/$/, ''); const lower = value.toLowerCase();
    return lower === config || lower.startsWith(`${config}/`) ? undefined : value;
  };
  const entry = (value: unknown) => {
    if (!(value instanceof TFile) && !(value instanceof TFolder)) { errors.report('host.payload', 'host.bridge'); return undefined; }
    const normalized = path(value.path); if (!normalized) return undefined;
    return { path: normalized, kind: value instanceof TFile ? 'file' as const : 'folder' as const };
  };
  const safe = <A extends unknown[]>(callback: (...args: A) => void) => (...args: A) => {
    if (disposed) return;
    try { callback(...args); } catch { errors.report('host.event', 'host.bridge'); }
  };
  const dispose = () => {
    if (disposed) return; disposed = true; const cancel = layoutTimer; layoutTimer = undefined;
    try { cancel?.(); } catch { errors.report('host.cleanup', 'host.bridge'); }
    for (const { source, ref } of owned.splice(0)) {
      try { source.offref(ref); } catch { errors.report('host.cleanup', 'host.bridge'); }
    }
  };
  workspace.onLayoutReady(() => {
    if (disposed || started) return; started = true;
    try {
      own(vault, vault.on('create', safe(file => { const value = entry(file); if (value) events.publish({ type: 'host.vault.entry-created', payload: value }); })));
      own(vault, vault.on('delete', safe(file => { const value = entry(file); if (value) events.publish({ type: 'host.vault.entry-deleted', payload: value }); })));
      own(vault, vault.on('rename', safe((file, old) => {
        const value = entry(file); const oldPath = path(old);
        if (value && oldPath) events.publish({ type: 'host.vault.entry-renamed', payload: { ...value, oldPath } });
      })));
      if (options.modifications !== false) own(vault, vault.on('modify', safe(file => {
        const value = entry(file); if (!value || !(file instanceof TFile)) return;
        const modifiedTime = Number.isFinite(file.stat?.mtime) && file.stat.mtime >= 0 ? file.stat.mtime : null;
        events.publish({ type: 'host.vault.entry-modified', payload: { path: value.path, modifiedTime } });
      })));
      own(workspace, workspace.on('file-open', safe(file => {
        const value = file === null ? null : entry(file);
        if (value === undefined) return;
        events.publish({ type: 'host.workspace.file-opened', payload: { path: value?.path ?? null } });
        events.publish({ type: 'host.active-file-changed', payload: { available: value !== null } });
      })));
      own(workspace, workspace.on('active-leaf-change', safe(leaf => {
        const viewType = leaf?.view.getViewType() ?? null;
        if (viewType !== null && (typeof viewType !== 'string' || !viewType || viewType.length > 200 || controls(viewType))) { errors.report('host.payload', 'host.bridge'); return; }
        events.publish({ type: 'host.workspace.active-view-changed', payload: { viewType } });
      })));
      own(workspace, workspace.on('layout-change', safe(() => {
        if (layoutTimer) return;
        layoutTimer = timers.after(options.layoutDelay ?? 50, safe(() => {
          layoutTimer = undefined;
          if (!disposed) events.publish({ type: 'host.workspace.layout-changed', payload: { revision: ++revision } });
        }));
      })));
      if (options.metadata !== false) own(metadataCache, metadataCache.on('changed', safe(file => {
        const value = entry(file); if (value && file instanceof TFile) events.publish({ type: 'host.metadata.changed', payload: { path: value.path } });
      })));
    } catch { errors.report('host.registration', 'host.bridge'); dispose(); }
  });
  return dispose;
}
