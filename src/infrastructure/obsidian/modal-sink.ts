import { Modal, type App } from 'obsidian';
import type { ModalSink, ModalPresentation, ModalCallbacks, ModalState } from '../../application/modal-port';
import { mountModalContent } from '../ui/modal-content';
class OwnedModal extends Modal {
  private content?: ReturnType<typeof mountModalContent>;
  private closed = false;
  private readonly previous: Element | null;
  constructor(app: App, private readonly presentation: ModalPresentation, private readonly callbacks: ModalCallbacks) {
    super(app); this.previous = this.contentEl.ownerDocument.activeElement; this.setTitle(presentation.title);
  }
  onOpen(): void { this.content = mountModalContent(this.contentEl, this.presentation, this.callbacks, tag => this.contentEl.createEl(tag)); }
  openOwned(): void {
    // Qualified Obsidian 1.13.7 selects its initial control after onOpen returns.
    // Apply our choice after the public open lifecycle, without scheduling work.
    this.open(); if (!this.closed) this.content?.focus();
  }
  update(state: ModalState): void { this.content?.update(state); }
  dismiss(): void { if (!this.closed) this.close(); }
  onClose(): void {
    if (this.closed) return; this.closed = true; let failed = false;
    try { this.content?.dispose(); } catch { failed = true; } this.content = undefined;
    try { if (this.previous?.isConnected && 'focus' in this.previous && typeof this.previous.focus === 'function') this.previous.focus(); } catch { failed = true; }
    if (failed) this.callbacks.failed(); else this.callbacks.cancel();
  }
}
export function nativeModalSink(app: App): ModalSink {
  return { open(presentation, callbacks) {
    const modal = new OwnedModal(app, presentation, callbacks); let closed = false;
    try { modal.openOwned(); } catch (error) { try { modal.close(); } catch { /* Preserve the original opening failure. */ } throw error; }
    return { update: state => { if (!closed) modal.update(state); }, close() { if (closed) return; closed = true; modal.dismiss(); } };
  } };
}
