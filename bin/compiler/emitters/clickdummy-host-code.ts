import type { Add } from './file-code.ts';

/** Browser-only ownership shared by generated previews; no host, data or framework dependency. */
export function clickdummyHostCode(add: Add): void {
  add('harness/prototype/clickdummy-host.ts', `type Dispose = () => void;
interface DialogOptions {
  document: Document; owner: string; label(id: string): string | undefined;
  mount(target: HTMLElement, id: string): Dispose; error(message: string): void;
}
interface Frame {
  dialog: HTMLDialogElement; closeButton: HTMLButtonElement; trigger: HTMLElement | null;
  release?: Dispose; cancel(event: Event): void; close(): void;
}
/** Own each dialog and its frame together. Native close, Escape and reset use the same teardown. */
export function createDialogHost(options: DialogOptions) {
  const frames: Frame[] = [];
  const report = () => options.error('Preview dialog cleanup failed. Reset preview before continuing.');
  function finish(frame: Frame, restoreFocus = true): void {
    const index = frames.indexOf(frame); if (index < 0) return;
    // Closing a parent also releases descendants, in reverse mounting order.
    for (const item of frames.splice(index).reverse()) {
      item.closeButton.removeEventListener('click', item.close);
      item.dialog.removeEventListener('cancel', item.cancel);
      item.dialog.removeEventListener('close', item.close);
      try { item.release?.(); } catch { report(); }
      try { if (item.dialog.open) item.dialog.close(); } catch { report(); }
      finally { item.dialog.remove(); }
    }
    if (!restoreFocus) return;
    const trigger = frame.trigger;
    const target = trigger?.isConnected && !trigger.closest('[inert]') && !trigger.matches(':disabled')
      ? trigger : frames.at(-1)?.closeButton ?? options.document.getElementById('clickdummy-surface');
    target?.focus({ preventScroll: true });
  }
  function open(id: string, mount = options.mount): boolean {
    const label = options.label(id);
    if (label === undefined || frames.length >= 12) {
      options.error('This preview dialog is unavailable or the dialog limit has been reached.'); return false;
    }
    const document = options.document, active = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'clickdummy-dialog ps--' + options.owner; dialog.dataset.pluginUi = options.owner;
    dialog.setAttribute('aria-label', label);
    const closeButton = document.createElement('button'); closeButton.type = 'button'; closeButton.textContent = 'Close dialog';
    const content = document.createElement('div'); dialog.append(closeButton, content);
    const frame: Frame = { dialog, closeButton,
      trigger: active instanceof HTMLElement ? active : null,
      cancel(event) { event.preventDefault(); finish(frame); }, close() { finish(frame); } };
    closeButton.addEventListener('click', frame.close);
    dialog.addEventListener('cancel', frame.cancel); dialog.addEventListener('close', frame.close);
    document.body.append(dialog); frames.push(frame);
    try {
      dialog.showModal(); const release = mount(content, id);
      if (!frames.includes(frame)) { release(); return false; }
      frame.release = release; closeButton.focus(); return true;
    } catch {
      finish(frame); options.error('This preview dialog could not be opened. No data was saved.'); return false;
    }
  }
  return { open, closeAll() { const first = frames[0]; if (first) finish(first, false); } };
}
interface LifecycleOptions { mount(): Dispose; closeDialogs(): void; error(message: string): void }
/** pagehide can be a back/forward-cache suspension, not permanent disposal. Resume exactly once. */
export function createPreviewLifecycle(window: Window, options: LifecycleOptions) {
  let release: Dispose | undefined, disposed = false;
  function stop(): void {
    const previous = release; release = undefined;
    try { options.closeDialogs(); } catch { options.error('Preview dialog cleanup failed.'); }
    try { previous?.(); } catch { options.error('Preview cleanup failed. Reset preview before continuing.'); }
  }
  function start(): void {
    if (disposed || release) return;
    try { release = options.mount(); } catch { options.error('Preview could not be opened. Reload the file to retry.'); }
  }
  window.addEventListener('pagehide', stop); window.addEventListener('pageshow', start); start();
  return {
    reset() { if (!disposed) { stop(); start(); } },
    dispose() { if (disposed) return; disposed = true; window.removeEventListener('pagehide', stop); window.removeEventListener('pageshow', start); stop(); },
  };
}
`);
}
