import type { ModalSink } from '../../src/application/modal-port';
import { mountModalContent } from '../../src/infrastructure/ui/modal-content';
export function browserModalSink(): ModalSink {
  return { open(presentation, callbacks) {
    const previous = document.activeElement; const dialog = document.createElement('dialog'); dialog.className = 'harness-modal';
    dialog.setAttribute('aria-label', presentation.title); const title = document.createElement('h2'); title.textContent = presentation.title; dialog.append(title);
    const content = mountModalContent(dialog, presentation, callbacks, tag => dialog.ownerDocument.createElement(tag)); let closed = false;
    const finish = () => {
      if (closed) return; closed = true; let failed = false;
      try { content.dispose(); } catch { failed = true; }
      dialog.removeEventListener('close', finish); dialog.removeEventListener('cancel', cancel); dialog.remove();
      try { if (previous?.isConnected && 'focus' in previous && typeof previous.focus === 'function') previous.focus(); } catch { failed = true; }
      if (failed) callbacks.failed(); else callbacks.cancel();
    };
    const cancel = (event: Event) => { event.preventDefault(); finish(); };
    dialog.addEventListener('close', finish); dialog.addEventListener('cancel', cancel); document.body.append(dialog);
    try { dialog.showModal(); content.focus(); } catch (error) { finish(); throw error; }
    return { update: state => content.update(state), close() { if (closed) return; try { dialog.close(); } finally { finish(); } } };
  } };
}
